// READ-ONLY cohort scan: "THROTTLE-EXIT STRANDED" students.
//
// The signature (first seen live in CS-2026-07-27, 임유이/Yui Lim, INT B3):
//   1. The student's day N was built as a THROTTLE review-only day (reviewMode=true → 0 new words)
//      → the app served the review test directly (session phase=review-study, no new-word test).
//   2. They re-took that day's review until their last-3 review average rose ABOVE the 0.50 EXIT
//      threshold (exactly what TAs tell them to do) → deriveThrottleMode flips to FALSE.
//   3. Day N is now a NORMAL day (pace new words). completeSession's F-4 evidence check
//      (functions/foundation.js:1410) now needs a passed day-N `new` anchor that can never exist
//      → every further review submit returns `no_evidence` → "이 날을 완료하려면 먼저 새 단어
//      시험을 통과해야 합니다" and the day never completes.
//
// Routing (DailySessionFlow.jsx:822 "ATTEMPTS ARE THE SOLE AUTHORITY") sends a CLEAN page load to
// the new-word phase, so the state is recoverable by a reload — but the stale session_state keeps
// re-serving the review test to a student who stays in the tab, and the error text tells them
// nothing actionable. Remedy per student: delete the stale session_state (guard: NO passed day-N
// `new` attempt to lose) → clean rebuild → Study New Words → New Words Test → Review → day
// completes.
//
//   NODE_PATH=/app/node_modules node scripts/cs/scan-throttle-exit-stranded.mjs [classNameRegex=26SM]
//
// ZERO writes.
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();

const CLASS_RE = new RegExp(process.argv[2] || '26SM', 'i');
const ENTER = 0.30, EXIT = 0.50;

// Mirrors src/utils/forcedPathway.js reviewAvgLastN / deriveThrottleMode exactly.
const reviewAvgLastN = (rs, n = 3) => {
  if (!Array.isArray(rs) || rs.length === 0) return null;
  const valid = rs.filter(s => s?.reviewScore !== null && s?.reviewScore !== undefined).map(s => s.reviewScore).slice(-n);
  return valid.length < n ? null : valid.reduce((a, b) => a + b, 0) / valid.length;
};
const deriveThrottleMode = (rs, priorMode = false) => {
  const avg = reviewAvgLastN(rs, 3);
  if (avg == null) return false;
  if (avg < ENTER) return true;
  if (avg > EXIT) return false;
  return priorMode === true;
};

const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
};

// ── cohort ────────────────────────────────────────────────────────────────────
const classes = (await db.collection('classes').get()).docs
  .filter(d => CLASS_RE.test(d.data().name || ''))
  .map(d => ({ id: d.id, name: d.data().name, studentIds: d.data().studentIds || [], assignments: d.data().assignments || {} }));
const uids = [...new Set(classes.flatMap(c => c.studentIds))];
const clsById = Object.fromEntries(classes.map(c => [c.id, c]));
console.log(`cohort: ${classes.length} classes matching /${CLASS_RE.source}/i · ${uids.length} distinct students`);

const sizeCache = new Map();
const listSize = async l => {
  if (!l) return null;
  if (!sizeCache.has(l)) { try { sizeCache.set(l, (await db.collection('lists').doc(l).collection('words').count().get()).data().count); } catch { sizeCache.set(l, null); } }
  return sizeCache.get(l);
};

// ── pass 1: every student's session_states + class_progress ───────────────────
let scanned = 0;
const candidates = [];
await mapLimit(uids, 24, async uid => {
  const [ssSnap, cpSnap] = await Promise.all([
    db.collection('users').doc(uid).collection('session_states').get(),
    db.collection('users').doc(uid).collection('class_progress').get(),
  ]);
  if (++scanned % 200 === 0) process.stderr.write(`  …${scanned}/${uids.length}\n`);
  const cps = Object.fromEntries(cpSnap.docs.map(d => [d.id, d.data()]));
  for (const s of ssSnap.docs) {
    const ss = s.data();
    // The stranded shape: parked in the review phase with the new-word test NOT passed.
    if (ss.phase !== 'review-study' || ss.newWordsTestPassed === true) continue;
    const cp = cps[s.id];
    if (!cp) continue;
    candidates.push({ uid, sessionId: s.id, ss, cp });
  }
});
console.log(`pass 1: ${candidates.length} sessions parked in review-study with newWordsTestPassed!==true`);

// ── pass 2: confirm against attempts + live throttle mode ─────────────────────
const rows = await mapLimit(candidates, 16, async c => {
  const { uid, ss, cp } = c;
  const listId = cp.listId || ss.listId, classId = cp.classId || ss.classId;
  const csd = cp.currentStudyDay ?? 0, twi = cp.totalWordsIntroduced ?? 0;
  const day = ss.currentStudyDay ?? (csd + 1);
  const size = await listSize(listId);
  const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get())
    .docs.map(d => d.data());
  const dayAttempts = at.filter(a => a.studyDay === day);
  const passedNewForDay = dayAttempts.some(a => a.sessionType === 'new' && a.passed === true);
  const reviewsForDay = dayAttempts.filter(a => a.sessionType === 'review');
  const modeNow = deriveThrottleMode(cp.recentSessions || [], cp.reviewMode === true);
  const listEnd = size != null && twi >= size;
  // Stranded ⟺ the day is NOT review-only any more (throttle exited, not list-end) AND the day's
  // new-word anchor does not exist AND they already submitted that day's review (so they are
  // actively hitting the completion gate, not merely mid-day).
  const stranded = !modeNow && !listEnd && !passedNewForDay && reviewsForDay.length > 0;
  return {
    stranded, uid, classId, listId, day, csd, twi, size,
    className: clsById[classId]?.name || classId,
    storedMode: cp.reviewMode, modeNow, avg3: reviewAvgLastN(cp.recentSessions || [], 3),
    reviews: reviewsForDay.length,
    lastReview: reviewsForDay.map(a => a.submittedAt?.toMillis?.() ?? 0).sort().at(-1) || 0,
    scores: reviewsForDay.map(a => a.score),
  };
});

const hits = rows.filter(r => r.stranded).sort((a, b) => b.lastReview - a.lastReview);
console.log(`\n★ THROTTLE-EXIT STRANDED: ${hits.length}\n`);
const emails = [];
for (const h of hits) {
  const u = (await db.collection('users').doc(h.uid).get()).data() || {};
  const email = u.email || '(no email)';
  emails.push(email);
  console.log(`  ${(u.profile?.displayName || u.displayName || '?').padEnd(14)} ${email.padEnd(34)} [${h.className}] list=${String(h.listId).slice(0, 8)}`);
  console.log(`      day=${h.day} csd=${h.csd} twi=${h.twi}/${h.size} storedMode=${h.storedMode} modeNow=${h.modeNow} avg3=${h.avg3?.toFixed(3)} · ${h.reviews} review(s) for the day [${h.scores.join(',')}] · last ${new Date(h.lastReview).toISOString().slice(0, 16)}`);
}
console.log(`\nemails: ${emails.join(' ')}`);
// Near-misses worth eyeballing: parked in review-study, no new anchor, but no review submitted yet
// (they have not hit the gate) or still in review mode (legitimately a review-only day).
const nm = rows.filter(r => !r.stranded);
console.log(`\nnot stranded: ${nm.length} (${nm.filter(r => r.modeNow).length} still review-mode = legit review-only, ` +
  `${nm.filter(r => !r.modeNow && r.twi >= (r.size ?? Infinity)).length} list-end, ` +
  `${nm.filter(r => !r.modeNow && r.reviews === 0).length} no review submitted for the day yet, ` +
  `${nm.filter(r => !r.modeNow && r.reviews > 0 && r.twi < (r.size ?? Infinity)).length} have the day's new anchor)`);
process.exit(0);

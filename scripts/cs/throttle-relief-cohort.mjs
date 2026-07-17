/**
 * ⛔⛔ DO-NOT-RUN (DEPRECATED 2026-07-17) ⛔⛔ — the csd-down + un-throttle legs are IATROGENIC: they minted
 * ~9 of the 14 I4-"stuck" students (orchestrator-verified; see CONSOLIDATED_ROADMAP_2026-07-17.md §A4 +
 * SUPPORT_RUNBOOK CS-2026-07-17). Superseded by the PR-1/PR-3 code fix. NEVER run against 26SM. A runtime
 * guard below aborts unless LSR_ALLOW_IATROGENIC=1. Kept for the record only.
 *
 * CS-2026-07-17: TEMPORARY cohort throttle relief (David-authorized band-aid while the forced-pathway
 * code fix is built). Moves every currently-THROTTLED 26SM student off throttle so they get new words
 * today. Mechanism: allocation recomputes interventionLevel from recentSessions each session
 * (studyService.js:325), so we NULL the reviewScores in recentSessions → calculateInterventionLevel
 * returns 0 (0 non-null reviews). We do NOT fabricate scores (the 07-15 synthetic-0.5 reset caused the
 * 김예린 phantom-record tickets — CS-2026-07-16). New-word scores + entries are preserved. Also sets
 * interventionLevel=0, recomputes stats, clears session_state. Reprieve lasts ~3 real reviews, then the
 * window rebuilds (re-throttles a genuine low-reviewer — expected; the durable fix is the deploy).
 *
 *   node scripts/cs/throttle-relief-cohort.mjs [--commit]
 */
import admin from 'firebase-admin'; import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });

// ⛔ DO-NOT-RUN guard (2026-07-17): this script's csd-down + un-throttle legs are iatrogenic (minted ~9 of the
// 14 I4-stuck students). Superseded by the PR-1/PR-3 code fix. Aborts unless explicitly overridden.
if (process.env.LSR_ALLOW_IATROGENIC !== '1') {
  console.error('⛔ throttle-relief-cohort.mjs is DEPRECATED / DO-NOT-RUN — iatrogenic (minted ~9 of the 14 I4-stuck).');
  console.error('   Superseded by the PR-1/PR-3 fix. If you truly must run it, set LSR_ALLOW_IATROGENIC=1. See CONSOLIDATED_ROADMAP_2026-07-17.md §A4.');
  process.exit(1);
}
const db = admin.firestore(); const T = admin.firestore.Timestamp;
const COMMIT = process.argv.includes('--commit');
mkdirSync('/app/scripts/cs/backups_throttle_relief', { recursive: true });

// EXACT mirror of calculateInterventionLevel
const civ = rs => { const v = (rs || []).filter(s => s.reviewScore != null).map(s => s.reviewScore).slice(-3); if (v.length < 3) return 0; const a = v.reduce((x, y) => x + y, 0) / v.length; return a >= 0.75 ? 0 : a <= 0.30 ? 1 : (0.75 - a) / 0.45; };
const stats = ss => { const nw = ss.filter(s => s.newWordScore != null).map(s => s.newWordScore); return { avgNewWordScore: nw.length ? nw.reduce((a, b) => a + b, 0) / nw.length : null, avgReviewScore: null }; };

const cs = await db.collection('classes').get();
const class26 = {}, classPace = {}; cs.forEach(d => { const c = d.data(); const n = c.name || ''; if (/26SM/i.test(n) && !/\bDUP\b|25WT/i.test(n)) { class26[d.id] = n; classPace[d.id] = c.dailyWordGoal || c.dailyPace || 80; } });
const uids = [...new Set(cs.docs.filter(d => class26[d.id]).flatMap(d => d.data().studentIds || []))];
// list sizes (to exclude list-end students: un-throttling gives them 0 words — they need next-list advance)
const listSize = {};
async function sizeOf(lid) { if (listSize[lid] != null) return listSize[lid]; const d = await db.collection('lists').doc(lid).get(); return listSize[lid] = d.exists ? (d.data().wordCount || 0) : 0; }
console.log(`mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'} | 26SM classes: ${Object.keys(class26).length} | students: ${uids.length}\n`);

let throttled = 0, byClass = {}, listEndSkipped = 0, csdFixed = 0;
console.log('email                              class            csd  twi   interv→0   reviewEntriesNulled');
for (const uid of uids) {
  const cps = (await db.collection('users').doc(uid).collection('class_progress').get()).docs.filter(c => class26[c.data().classId]);
  const u = (await db.collection('users').doc(uid).get()).data();
  for (const c of cps) {
    const p = c.data(); const rs = p.recentSessions || [];
    const intervNow = civ(rs);
    if (intervNow <= 0) continue;                 // only throttled docs (interv>0 = seeing fewer words)
    const lsize = await sizeOf(p.listId);
    const twi = p.totalWordsIntroduced || 0;
    if (lsize > 0 && twi >= lsize) { listEndSkipped++; continue; } // list-end: un-throttle is a no-op → needs next-list advance
    throttled++;
    const cls = class26[p.classId]; byClass[cls] = (byClass[cls] || 0) + 1;
    const nulledCount = rs.filter(s => s.reviewScore != null).length;
    const cleaned = rs.map(s => ({ ...s, reviewScore: null }));
    // csd reconcile: last day the student genuinely INTRODUCED new words (the twi anchor). Pulls back the
    // empty-skip runaway; review-only days do NOT advance csd (matches the design decision). Non-stranding:
    // never demote BELOW a genuinely-completed day. Only reconcile DOWN (runaway); leave undercounts alone here.
    const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', p.listId).where('sessionType', '==', 'new').get()).docs.map(d => d.data());
    const passedNewDays = at.filter(a => a.passed === true && Number.isInteger(a.studyDay)).map(a => a.studyDay);
    const anchorDay = passedNewDays.length ? Math.max(...passedNewDays) : null;
    const csdBefore = p.currentStudyDay || 0;
    const pace = classPace[p.classId] || 80;
    // reconcile ONLY when clearly inflated (runaway): csd currently AHEAD of the anchor day.
    const csdNew = (anchorDay != null && csdBefore > anchorDay) ? anchorDay : csdBefore;
    const csdTag = csdNew !== csdBefore ? `  csd ${csdBefore}→${csdNew} [runaway -${csdBefore - csdNew}]` : '';
    console.log(`${String(u?.email || uid.slice(0, 12)).padEnd(34)} ${cls.slice(0, 15).padEnd(15)} ${String(csdBefore).padStart(3)} ${String(twi).padStart(4)}(≈d${Math.round(twi / pace)})   ${intervNow.toFixed(2)}→0.00   n${nulledCount}${csdTag}`);
    if (csdNew !== csdBefore) csdFixed++;
    if (COMMIT) {
      writeFileSync(`/app/scripts/cs/backups_throttle_relief/${uid}_${c.id}.json`, JSON.stringify({ uid, email: u?.email, doc: c.id, before: { currentStudyDay: csdBefore, interventionLevel: p.interventionLevel, recentSessions: rs, stats: p.stats } }, null, 2));
      const writeObj = {
        recentSessions: cleaned, interventionLevel: 0,
        stats: { ...(p.stats || {}), ...stats(cleaned) },
        throttleReliefAt: T.now(),
        throttleReliefNote: 'CS-2026-07-17: cohort throttle relief + runaway-csd reconcile (David-authorized) — reviewScores nulled → interv 0; csd reconciled to last passed-new (twi anchor) when inflated. Temporary bridge until forced-pathway code fix.',
        updatedAt: T.now()
      };
      if (csdNew !== csdBefore) writeObj.currentStudyDay = csdNew;
      await c.ref.set(writeObj, { merge: true });
      const ss = db.collection('users').doc(uid).collection('session_states').doc(c.id);
      if ((await ss.get()).exists) await ss.delete();
    }
  }
}
console.log(`\n=== ${COMMIT ? '[COMMITTED]' : '[DRY-RUN — add --commit]'} throttled docs moved off throttle: ${throttled} ===`);
console.log(`of those, csd reconciled DOWN (runaway pulled back to twi anchor): ${csdFixed}`);
console.log(`list-end students SKIPPED (blocked by finishing the list, not throttle → need next-list advance): ${listEndSkipped}`);
console.log('by class:', JSON.stringify(byClass, null, 0));
process.exit(0);

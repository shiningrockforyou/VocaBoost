// READ-ONLY: verify the weekly challenge-token reset live. Mirrors the DEPLOYED (6094cdd) logic exactly
// (functions/index.js availableChallengeTokens + startOfKstWeekMs, Monday 04:00 KST boundary) and computes,
// for real 26SM students, their token count NOW vs under the old 30-day rule — highlighting who the weekly
// reset releases. Run AFTER 04:00 KST to see the full reset. No writes.
//   NODE_PATH=/app/node_modules node scripts/cs/verify-token-reset.mjs
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();

// --- DEPLOYED logic (byte-mirror of functions/index.js @ 6094cdd) ---
const KST_OFFSET_MS = 540 * 60 * 1000;
const WEEKLY_RESET_HOUR_KST = 4;
function startOfKstWeekMs(nowMs) {
  const rs = WEEKLY_RESET_HOUR_KST * 60 * 60 * 1000;
  const d = new Date(nowMs + KST_OFFSET_MS - rs);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - KST_OFFSET_MS + rs;
}
const newRule = (hist, now) => { const ws = startOfKstWeekMs(now); return Math.max(0, 5 - (hist || []).filter((h) => h.status === 'rejected' && (h.challengedAt?.toMillis?.() ?? 0) >= ws).length); };
const oldRule = (hist, now) => Math.max(0, 5 - (hist || []).filter((h) => h.status === 'rejected' && (h.replenishAt?.toMillis?.() ?? 0) > now).length);
const kst = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16) + ' KST';

const now = Date.now();
const ws = startOfKstWeekMs(now);
const d = new Date(now + KST_OFFSET_MS);
const isPost4amMon = !(d.getUTCDay() === 1 && d.getUTCHours() < WEEKLY_RESET_HOUR_KST);
console.log(`now = ${kst(now)}   |   current token-week starts ${kst(ws)}`);
console.log(isPost4amMon ? '>> PAST the Mon-04:00 boundary — this reflects the FIRED weekly reset.\n' : '>> Still BEFORE Mon 04:00 KST — the big release fires at 04:00 (this is the pre-reset baseline).\n');

const cs = await db.collection('classes').get();
const uids = new Set();
cs.forEach((c) => { if (/26SM/i.test(c.data().name || '')) (c.data().studentIds || []).forEach((u) => uids.add(u)); });

let scanned = 0, released = [], stillPenalized = [];
for (const uid of uids) {
  let u; try { u = (await db.collection('users').doc(uid).get()).data(); } catch { continue; }
  const hist = u?.challenges?.history || [];
  if (!hist.length) continue;
  scanned++;
  const oldT = oldRule(hist, now), newT = newRule(hist, now);
  const name = u?.profile?.displayName || uid.slice(0, 8);
  if (oldT < 5 && newT === 5) released.push({ name, oldT });
  else if (newT < 5) stillPenalized.push({ name, newT, oldT });
}
console.log(`26SM students with challenge history: ${scanned}`);
console.log(`\nRELEASED by the weekly reset (was <5 under old 30-day rule → now 5): ${released.length}`);
released.sort((a, b) => a.oldT - b.oldT).slice(0, 40).forEach((r) => console.log(`  ${r.name}: ${r.oldT} → 5`));
console.log(`\nStill penalized (a rejection in the CURRENT token-week — correctly <5): ${stillPenalized.length}`);
stillPenalized.slice(0, 20).forEach((r) => console.log(`  ${r.name}: now ${r.newT}${r.oldT !== r.newT ? ` (old rule ${r.oldT})` : ''}`));
console.log(`\nVERDICT: ${isPost4amMon ? (released.length > 0 ? `weekly reset CONFIRMED live — ${released.length} students released to 5.` : 'no students were penalized under the old rule (nothing to release).') : 'baseline captured; re-run after 04:00 KST for the fired reset.'}`);
process.exit(0);

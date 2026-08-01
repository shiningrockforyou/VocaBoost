// graduation-validity-probe.mjs — READ-ONLY diagnostic (DEEPFIX2 item 15 evidence).
// Question: is graduating UNTESTED words valid? Direct proven-vs-filled graduation join is impossible
// historically (graduation picks unlogged; returnMasteredWords nulls masteredAt) — so this measures the
// EVIDENCE CLASSES the policies trust, from attempts alone:
//   For every answered word-row in a REVIEW test, classify by the word's PRIOR review evidence:
//     proven        = last prior review answer was CORRECT
//     proven21      = subset of proven with >=21 calendar days since the word last APPEARED in a review test
//                     (enriched for post-mastered-rest returns)
//     afterWrong    = last prior review answer was WRONG
//     untestedFresh = never review-tested before; first review test <=14d after word introduction
//     untestedAged  = never review-tested before; first review test  >14d after introduction
//                     (the class filled-graduation trusts: long-studied, never proven)
//   Accuracy per class; headline delta = proven vs untestedAged. Overall first, then per student.
// Usage: NODE_PATH=/app/node_modules node scripts/cs/graduation-validity-probe.mjs [classNameRegex=26SM] [limitStudents]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "node:fs";

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const filter = new RegExp(process.argv[2] || "26SM");
const LIMIT = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;
const DAY = 86400e3, FRESH_D = 14, GAP_D = 21;
const CLASSES = ["proven", "proven21", "afterWrong", "untestedFresh", "untestedAged"];

const cs = await db.collection("classes").get();
const students = new Map(); // uid -> classNames
cs.forEach(d => {
  const c = d.data();
  if (filter.test(c.name || "")) (c.studentIds || []).forEach(uid => {
    if (!students.has(uid)) students.set(uid, []);
    students.get(uid).push(c.name);
  });
});
let uids = [...students.keys()];
if (uids.length > LIMIT) uids = uids.slice(0, LIMIT);
console.error(`cohort: ${uids.length} students (${filter})`);

const overall = Object.fromEntries(CLASSES.map(k => [k, { n: 0, c: 0 }]));
const perStudent = [];
let done = 0;

async function runStudent(uid) {
  const snap = await db.collection("attempts").where("studentId", "==", uid).get();
  const atts = snap.docs.map(d => d.data())
    .filter(a => a.submittedAt && a.listId && Array.isArray(a.answers))
    .sort((a, b) => a.submittedAt.toMillis() - b.submittedAt.toMillis());
  const mine = Object.fromEntries(CLASSES.map(k => [k, { n: 0, c: 0 }]));
  const intro = new Map(), prior = new Map(), lastSeen = new Map(); // key: listId|wordId
  for (const a of atts) {
    const t = a.submittedAt.toMillis();
    for (const r of a.answers) {
      if (!r || !r.wordId) continue;
      const k = a.listId + "|" + r.wordId;
      if (!intro.has(k)) intro.set(k, t); // first appearance in ANY attempt (new tests precede reviews)
      if (a.sessionType !== "review") continue;
      const ok = r.isCorrect === true;
      const p = prior.get(k);
      let cls;
      if (p === undefined) cls = (t - intro.get(k)) > FRESH_D * DAY ? "untestedAged" : "untestedFresh";
      else cls = p ? "proven" : "afterWrong";
      mine[cls].n++; if (ok) mine[cls].c++;
      if (p === true && (t - lastSeen.get(k)) >= GAP_D * DAY) { mine.proven21.n++; if (ok) mine.proven21.c++; }
      prior.set(k, ok); lastSeen.set(k, t);
    }
  }
  for (const k of CLASSES) { overall[k].n += mine[k].n; overall[k].c += mine[k].c; }
  perStudent.push({ uid, classes: students.get(uid), stats: mine });
  if (++done % 50 === 0) console.error(`  ${done}/${uids.length}`);
}

const POOL = 16;
for (let i = 0; i < uids.length; i += POOL) await Promise.all(uids.slice(i, i + POOL).map(runStudent));

const pct = s => s.n ? (100 * s.c / s.n) : null;
console.log("\nOVERALL (answered review-test word rows):");
for (const k of CLASSES) console.log(`  ${k.padEnd(14)} n=${String(overall[k].n).padStart(7)}  acc=${pct(overall[k])?.toFixed(1)}%`);
console.log(`  DELTA proven − untestedAged = ${(pct(overall.proven) - pct(overall.untestedAged)).toFixed(1)} pp`);
console.log(`  DELTA proven21 − untestedAged = ${(pct(overall.proven21) - pct(overall.untestedAged)).toFixed(1)} pp`);

const MIN_N = 15;
const deltas = perStudent
  .filter(s => s.stats.proven.n >= MIN_N && s.stats.untestedAged.n >= MIN_N)
  .map(s => ({ uid: s.uid, d: pct(s.stats.proven) - pct(s.stats.untestedAged), pn: s.stats.proven.n, un: s.stats.untestedAged.n }))
  .sort((a, b) => a.d - b.d);
if (deltas.length) {
  const q = f => deltas[Math.min(deltas.length - 1, Math.floor(f * deltas.length))].d;
  const mean = deltas.reduce((a, x) => a + x.d, 0) / deltas.length;
  console.log(`\nPER-STUDENT delta (proven − untestedAged), students with n>=${MIN_N} in both: ${deltas.length}`);
  console.log(`  mean=${mean.toFixed(1)}pp  p10=${q(.1).toFixed(1)}  p25=${q(.25).toFixed(1)}  median=${q(.5).toFixed(1)}  p75=${q(.75).toFixed(1)}  p90=${q(.9).toFixed(1)}`);
  console.log(`  students with delta>0: ${(100 * deltas.filter(x => x.d > 0).length / deltas.length).toFixed(0)}%`);
}
writeFileSync("/app/docs/plans/deepfix2/evidence/graduation-validity-26SM.json",
  JSON.stringify({ ranAt: new Date().toISOString(), cohort: String(filter), students: uids.length, overall, perStudent }, null, 1));
console.error("\nwrote docs/plans/deepfix2/evidence/graduation-validity-26SM.json");

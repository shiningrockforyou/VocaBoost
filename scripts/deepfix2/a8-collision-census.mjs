// a8-collision-census.mjs — READ-ONLY cohort census of A8 cross-list wordId collisions [stage-2 act 1
// surfaced a REAL one: B1 fail-closed on the first affected student]. Counts affected students + the
// collision shapes so the resolution decision is data-grounded. No writes, no abort — census only.
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/a8-collision-census.mjs --classAllowlist=FILE
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "node:fs";
import { computeStudentLabels } from "./b1-replay-lib.mjs";

const m = process.argv.slice(2).map(a => a.match(/^--classAllowlist=(.*)$/)).find(Boolean);
if (!m) { console.error("--classAllowlist=FILE required"); process.exit(2); }
const allow = new Set(JSON.parse(readFileSync(m[1], "utf-8")));
const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const cs = await db.collection("classes").get();
const students = new Set();
cs.forEach(d => { if (allow.has(d.id)) (d.data().studentIds || []).forEach(u => students.add(u)); });
console.error(`census over ${students.size} students`);
const watermark = Date.now();
const affected = [];
let done = 0;
for (const uid of [...students].sort()) {
  const r = await computeStudentLabels(db, uid, watermark, {});
  if (r.wordIdCollisions.length) {
    const shapes = r.wordIdCollisions.slice(0, 30).map(c => ({
      wordId: c.wordId,
      keys: c.keys,
      values: c.keys.map(k => r.wordsOut[k]),
    }));
    affected.push({ uid, collisions: r.wordIdCollisions.length, lists: [...new Set(r.wordIdCollisions.flatMap(c => c.keys.map(k => k.split("|")[0])))], shapes: shapes.slice(0, 5) });
    process.stderr.write("X");
  } else process.stderr.write(".");
  if (++done % 100 === 0) console.error(` ${done}`);
}
console.error("");
const out = { probe: "a8-collision-census", at: new Date().toISOString(), cohort: students.size,
  affectedStudents: affected.length, totalCollisions: affected.reduce((a, s) => a + s.collisions, 0),
  listsInvolved: [...new Set(affected.flatMap(s => s.lists))], perStudent: affected };
writeFileSync(new URL("../../audit/deepfix/trackB_baselines/a8-census.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ cohort: out.cohort, affectedStudents: out.affectedStudents, totalCollisions: out.totalCollisions, listsInvolved: out.listsInvolved }, null, 2));

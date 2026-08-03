#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — engine-key-provenance-scan.mjs   ***STRICTLY READ-ONLY***
 * ============================================================================
 * WHY THIS EXISTS (Codex r79, NEED_TO_FIX 20). The merged rules artifact says,
 * at firestore.merged.rules:133 and :346, that because the attempt CREATE guard
 * denies a client all four engine keys, "the presence of any one of them proves
 * the document was server-written".
 *
 * That is true GOING FORWARD — once the artifact is live. It is NOT true of
 * HISTORY: the ruleset live until now allows a client-created attempt to carry
 * arbitrary extra fields. So a pre-existing attempt COULD carry a forged
 * `resetEpoch`/`presentationId`/`queueId`/`engineResult`, and the engine's
 * discriminator (completion.js:340 keys on resetEpoch PRESENCE) would then read
 * it as engine evidence.
 *
 * What we had before this script was NOT a cohort-wide proof:
 *   - the client feature flag is off (REVIEW_V2_CLIENT=false),
 *   - a source grep finds no client writer,
 *   - b2-database-investigation.mjs:73 counted resetEpoch present/absent — but
 *     over a SAMPLE, and for ONE of the four keys.
 * Codex's ask, quoted: "scan the production attempts for all four keys and
 * quarantine anything that is not fully bound to a real server presentation."
 *
 * WHAT IT DOES
 *   1. FULL cohort scan of `attempts` (paged; authoritative — deliberately not
 *      an index-dependent query, because a missing/exempted single-field index
 *      would silently under-report exactly the documents we are hunting).
 *   2. For every attempt carrying ANY engine key, resolve provenance against
 *      `users/{studentId}/review_presentations/{presentationId}`: the doc must
 *      exist AND be owned by that uid AND the attempt's own engine stamps must
 *      be internally coherent.
 *   3. Classify each hit: SERVER_BOUND | UNBOUND | INCOHERENT | NO_STUDENT.
 *      Anything not SERVER_BOUND is a QUARANTINE CANDIDATE.
 *
 * It writes NOTHING to Firestore. Its only output is a receipt JSON.
 *
 * Usage (from /app):
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/engine-key-provenance-scan.mjs [--limit N] [--out PATH]
 * Exit: 0 clean (zero quarantine candidates) · 1 candidates found · 2 could not run.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/app/functions/index.js");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const ENGINE_KEYS = ["resetEpoch", "presentationId", "queueId", "engineResult"];
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const LIMIT = Number(argOf("--limit", "0")) || 0;   // 0 = the whole cohort
const OUT = argOf("--out", "/app/audit/deepfix/task3/live_baseline/engine-key-provenance-receipt.json");
const PAGE = 500;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST is set — this scan is meant for PRODUCTION, read-only.");
  process.exit(2);
}

let key;
try {
  key = JSON.parse(readFileSync("/app/scripts/serviceAccountKey.json", "utf8"));
} catch (e) {
  console.error(`FATAL: cannot read scripts/serviceAccountKey.json — ${e.message}`);
  process.exit(2);
}
if (!getApps().length) initializeApp({ credential: cert(key), projectId: key.project_id });
const db = getFirestore();

/** Provenance verdict for ONE attempt carrying at least one engine key. */
async function classify(id, a) {
  const present = ENGINE_KEYS.filter((k) => a[k] !== undefined);
  const studentId = typeof a.studentId === "string" ? a.studentId : null;
  const pid = typeof a.presentationId === "string" && a.presentationId ? a.presentationId : null;
  const base = { id, studentId, presentIds: present, testId: a.testId ?? null,
    createdAt: a.createdAt?.toDate?.()?.toISOString?.() ?? null };

  if (!studentId) return { ...base, verdict: "NO_STUDENT", why: "attempt carries engine keys but no studentId to resolve provenance against" };
  if (!pid) {
    return { ...base, verdict: "UNBOUND",
      why: `carries ${present.join("+")} but NO presentationId, so it can never be tied to a server presentation` };
  }
  let snap;
  try {
    snap = await db.doc(`users/${studentId}/review_presentations/${pid}`).get();
  } catch (e) {
    return { ...base, verdict: "INCOHERENT", why: `presentation lookup failed: ${e.message}` };
  }
  if (!snap.exists) {
    return { ...base, verdict: "UNBOUND",
      why: `presentationId ${pid} does not exist under users/${studentId}/review_presentations` };
  }
  const p = snap.data() ?? {};
  const problems = [];
  // The presentation must belong to this student, and the attempt's stamps must
  // agree with it. A forged attempt can name a REAL presentation id (they are
  // derivable), so ownership + coherence are what actually bind it.
  if (p.uid && p.uid !== studentId) problems.push(`presentation.uid ${p.uid} != attempt.studentId ${studentId}`);
  if (a.queueId !== undefined && p.queueId !== undefined && a.queueId !== p.queueId) {
    problems.push(`queueId ${a.queueId} != presentation.queueId ${p.queueId}`);
  }
  if (a.resetEpoch !== undefined && !Number.isInteger(a.resetEpoch)) {
    problems.push(`resetEpoch ${JSON.stringify(a.resetEpoch)} is not an integer`);
  }
  if (a.resetEpoch !== undefined && p.resetEpoch !== undefined && a.resetEpoch !== p.resetEpoch) {
    problems.push(`resetEpoch ${a.resetEpoch} != presentation.resetEpoch ${p.resetEpoch}`);
  }
  if (problems.length) return { ...base, verdict: "INCOHERENT", why: problems.join(" · ") };
  return { ...base, verdict: "SERVER_BOUND", why: `bound to a real presentation owned by ${studentId}` };
}

const counts = Object.fromEntries(ENGINE_KEYS.map((k) => [k, 0]));
const byVerdict = { SERVER_BOUND: 0, UNBOUND: 0, INCOHERENT: 0, NO_STUDENT: 0 };
const hits = [];
let scanned = 0, cursor = null, pages = 0;

console.log("[provenance] FULL cohort scan of `attempts` (read-only)…");
for (;;) {
  let q = db.collection("attempts").orderBy("__name__").limit(PAGE);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  pages++;
  for (const doc of page.docs) {
    scanned++;
    const a = doc.data();
    const present = ENGINE_KEYS.filter((k) => a[k] !== undefined);
    if (!present.length) continue;
    for (const k of present) counts[k]++;
    const v = await classify(doc.id, a);
    byVerdict[v.verdict]++;
    hits.push(v);
  }
  cursor = page.docs[page.docs.length - 1];
  if (pages % 10 === 0) console.log(`  …${scanned} scanned, ${hits.length} carrying an engine key`);
  if (LIMIT && scanned >= LIMIT) break;
  if (page.size < PAGE) break;
}

const quarantine = hits.filter((h) => h.verdict !== "SERVER_BOUND");
const receipt = {
  kind: "engine-key-provenance-scan",
  readOnly: true,
  date: new Date().toISOString(),
  projectId: key.project_id,
  scope: LIMIT ? `FIRST ${LIMIT} attempts (PARTIAL — not a cohort proof)` : "FULL `attempts` collection",
  engineKeys: ENGINE_KEYS,
  scanned,
  attemptsCarryingAnyEngineKey: hits.length,
  perKeyPresence: counts,
  byVerdict,
  quarantineCandidates: quarantine,
  claimThisSupports: quarantine.length === 0 && !LIMIT
    ? "COHORT-WIDE: no pre-existing attempt carries an engine key that is not bound to a real, owned server presentation. The artifact's 'presence proves server authorship' therefore holds for the existing corpus as well as going forward."
    : "NOT a clean provenance proof — see quarantineCandidates (or re-run without --limit for a cohort-wide result).",
};
writeFileSync(OUT, JSON.stringify(receipt, null, 2) + "\n");

console.log(`\n[provenance] scanned ${scanned} attempts across ${pages} page(s)`);
console.log(`[provenance] carrying an engine key: ${hits.length}  ${JSON.stringify(counts)}`);
console.log(`[provenance] verdicts: ${JSON.stringify(byVerdict)}`);
if (quarantine.length) {
  console.log(`\n[provenance] !! ${quarantine.length} QUARANTINE CANDIDATE(S):`);
  for (const h of quarantine.slice(0, 20)) console.log(`   ${h.verdict}  ${h.id}  ${h.why}`);
}
console.log(`[provenance] receipt -> ${OUT.replace("/app/", "")}`);
process.exit(quarantine.length ? 1 : 0);

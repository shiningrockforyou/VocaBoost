// b1-expected-labels.mjs — READ-ONLY (Track B stage B1, 14_ §2) — v6 (r57 closure: THE REPLAY LAW LIVES IN
// b1-replay-lib.mjs, shared verbatim with B3/B4 — one law, zero drift; this file = cohort iteration + artifacts).
// r55 additions: CHALLENGE-MUTATION law (adjudicated rows replay as stored — the stored-score law absorbs the
//   flip; per-student mutationRisk {pendingChallenges, adjudicatedAtOrAfterWatermark, challengeTsUnknown}
//   emitted — B3 re-reads flagged students; B4's delta covers post-watermark adjudications; historical
//   resting-at-acceptance is NOT reconstructable ⇒ documented conservative posture, no stamping depends on it) ·
//   graded===false excluded (synthetic manualOverride anchors = the NAMED eligible exception) · per-signature
//   exclusion COUNTS · atomic RUN MANIFEST (hash-bound JSONL+summary, written last) · strict integer --limit ·
//   --classAllowlist REQUIRED in --full mode [r56].
// [r62p] reviewRestingUntil is LIVE-ONLY (r59-A9 FINAL): no seed, no --seedRru, no rru in the baseline —
//   the lib's legacyResting census is informational transient-sizing ONLY and appears in the summary, never
//   in the per-word expected state.
// Computes the EXPECTED post-backfill per-word label state per student under the final law.
// The artifact IS the B4 comparison baseline: per-word values for the FIVE backfill label fields +
// per-(student,list) resetEpoch snapshot + watermark metadata, emitted as JSONL + a summary JSON + digests.
//
// LAW (ledger cites; r53/panel adjudications applied):
//  - PROOF comparator = the validity-checked STORED score >= 92 (R2-35/R2-33 letter; r53-B1 + panel B1-Q3:
//    row-recompute substitution REMOVED — rows are used only to FENCE the stored score, never to replace it).
//  - B1-Q1 (r53 adjudicated YES): uniform 92 bar across ALL eligible graded attempt types.
//  - R2-41(a): fails/corrects accrue from ALL eligible graded attempts.
//  - Clock seed (B1-Q2, r53 adjudicated YES): `reviewLastTestedAt` [FIELD RENAMED per r53-B3: the server
//    rotation clock is a NEW field, born server-only — legacy client-written `lastTestedAt` is untouched and
//    retires at DF2-46] = latest ELIGIBLE review-type attempt containing the word; null ⇒ field NOT written
//    (frozen no-review-history behavior: unseeded words tie-break by wordIndex per DF2-14 contract (4)).
//  - r48 fence, FAIL-CLOSED (r53-B1): an attempt is ELIGIBLE only if ALL hold — submittedAt + listId + classId
//    present · score a finite number in [0,100] · totalQuestions a positive integer <= 500 · rows an array of
//    well-formed {wordId: non-empty string, isCorrect: boolean} · no duplicate wordId within rows ·
//    rows.length <= totalQuestions · |rows-recomputed − stored| <= 2pp when rows cover totalQuestions.
//    Anything else ⇒ EXCLUDED from ALL labels, counted per-signature AND per-class. Never clamped.
//  - Conflicting duplicates (panel law fix): attempts grouped by signature (classId|listId|day|type|submittedAt);
//    any group with >1 distinct content ⇒ the WHOLE group excluded (order-independent); identical duplicates ⇒
//    one replayed, drops counted.
//  - Blanks (R2-17/B2): absent rows carry no wordId ⇒ per-word blank-fails UNATTRIBUTABLE — published as
//    blankUndercount, never guessed.
//  - Teacher edits [r54-1.3]: teacherEdited attempts NEVER mint proof from the overridden score — the organic
//    preOverride.score governs (absent ⇒ excluded `editedNoOrganicScore`); row facts replay unchanged.
//  - Watermark [r54-1.1]: enforced PER-ATTEMPT in the fence (postWatermark exclusion; no composite index exists
//    for a query bound) — every attempt in the baseline has submittedAt < watermark; the boundary is durable.
//    LIMITATION (documented, r54): tombstones and attempts are separate reads, not one snapshot — a reset landing
//    mid-run can skew ONE student; B3's epoch-skip rule + B4's delta sweep absorb it (that student re-baselines).
//  - Epoch: per-(uid,listId) resetEpoch snapshot read from progress_meta/{listId} + list_progress/{listId}
//    (the REAL tombstones, foundation.js:496-532/2047-2140; absent ⇒ 0); attempts predating resetAt are
//    excluded + counted (preEpochExcluded); the snapshot is emitted so B3's skip-rule is executable.
//
// Usage: sample: node b1-expected-labels.mjs [--cohort=REGEX] [--limit=N]
//        full:   node b1-expected-labels.mjs --full --classAllowlist=FILE   (exact class-doc-id JSON array)
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { computeStudentLabels } from "./b1-replay-lib.mjs";
import { auditRoot } from "./b-baseline.mjs";

const KNOWN = new Set(["cohort", "limit", "full", "classAllowlist", "watermark", "outDir", "deltaAuth"]); // r64: --uids DELETED (no parent hashes ⇒ chain-dead; shared filenames ⇒ overwrite footgun)
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  return [m[1], m[2] ?? true];
}));
const filter = new RegExp(args.cohort || "26SM");
const FULL = args.full === true || args.full === "true"; // --full and --full=true both run FULL [r54]
if (args.full !== undefined && !FULL) { console.error("--full must be bare or =true"); process.exit(2); }
if (FULL && !args.classAllowlist) { console.error("--full requires --classAllowlist=FILE (exact class-doc-id JSON array — regex matching is NOT a cohort boundary: /26SM/ matches '25WT DUP REPRO 26SM...' test classes [r56]); sample mode may use --cohort"); process.exit(2); }
if (FULL && args.limit !== undefined) { console.error("--limit conflicts with --full [r56]"); process.exit(2); }
if (args.cohort !== undefined && (typeof args.cohort !== "string" || !args.cohort)) { console.error("--cohort requires a non-empty value"); process.exit(2); }
if (args.limit !== undefined && !/^[1-9]\d*$/.test(String(args.limit))) { console.error("--limit must be a positive integer [r55]"); process.exit(2); }
// DELTA/REPLAY modes [r59-A2, --uids DELETED r64]: --deltaAuth=FILE = the B4-materialized delta authority;
// --watermark=MS pins the boundary (fidelity replays at the ORIGINAL watermark); --outDir overrides the target.
if (args.watermark !== undefined && !/^[1-9]\d{9,}$/.test(String(args.watermark))) { console.error("--watermark must be epoch ms"); process.exit(2); }
if (args.watermark !== undefined && parseInt(args.watermark, 10) > Date.now() + 300e3) { console.error("--watermark is in the FUTURE — a future boundary makes later attempts invisible to the final B4 (false PASS) [r62p]"); process.exit(2); }
if (args.deltaAuth !== undefined && (typeof args.deltaAuth !== "string" || !args.deltaAuth)) { console.error("--deltaAuth=FILE required"); process.exit(2); }
if (args.deltaAuth && !(args.full === true || args.full === "true")) { console.error("--deltaAuth requires --full --classAllowlist (enrollment scope must be the REAL cohort boundary, not a sample regex [r62])"); process.exit(2); }
if (args.outDir !== undefined && (typeof args.outDir !== "string" || !args.outDir)) { console.error("--outDir=DIR required"); process.exit(2); }
const LIMIT = FULL ? Infinity : parseInt(args.limit || "50", 10);
const THRESHOLD = 92;

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const cs = await db.collection("classes").get();
const students = new Set();
let classesMatched = [];
if (FULL) {
  const allow = new Set(JSON.parse(readFileSync(args.classAllowlist, "utf-8")));
  cs.forEach(d => { if (allow.has(d.id)) { classesMatched.push({ id: d.id, name: d.data().name }); (d.data().studentIds || []).forEach(u => students.add(u)); } });
  if (classesMatched.length !== allow.size) { console.error(`FATAL: allowlist names ${allow.size} classes; matched ${classesMatched.length}`); process.exit(2); }
  console.error(`allowlist: ${classesMatched.length} classes -> ${students.size} students`);
} else {
  cs.forEach(d => { const c = d.data(); if (filter.test(c.name || "")) { classesMatched.push({ id: d.id, name: c.name }); (c.studentIds || []).forEach(u => students.add(u)); } });
}
let uids = [...students].sort();
let deltaAuthMeta = null;
if (args.deltaAuth) {
  // r62: direct consumption — no manual surgery; uids extracted; parent hashes stamped into the manifest
  let auth, authRaw;
  try { authRaw = readFileSync(args.deltaAuth); auth = JSON.parse(authRaw.toString());
    if (auth.probe !== "b4-delta" || auth.version !== 2 || !Array.isArray(auth.uids) || !auth.uids.length || !auth.baselineManifestSha256) throw new Error("bad shape/version");
    if (!auth.uids.every(u => typeof u === "string" && u) || new Set(auth.uids).size !== auth.uids.length) throw new Error("uids must be unique nonempty strings"); }
  catch (e) { console.error(`FATAL: bad --deltaAuth: ${e.message}`); process.exit(2); }
  deltaAuthMeta = { parentOriginalManifestSha256: auth.baselineManifestSha256,
                    parentDeltaAuthSha256: createHash("sha256").update(authRaw).digest("hex") };
  const scope = new Set(uids);
  const departed = auth.uids.filter(u => !scope.has(u));
  uids = auth.uids.filter(u => scope.has(u)).sort();
  if (departed.length) { console.error(`NOTE [roster churn]: ${departed.length} delta uids departed the cohort — listed in the manifest as departedUids`); deltaAuthMeta.departedUids = departed; }
  if (!uids.length) console.error("NOTE [r63 A6]: ALL delta uids departed — emitting an auditable EMPTY delta layer (zero rows, all excused via departedUids); the next B4 counts them departed and the chain converges");
}
if (!args.deltaAuth && uids.length > LIMIT) {
  const step = Math.max(1, Math.floor(uids.length / LIMIT));
  uids = uids.filter((_, i) => i % step === 0).slice(0, LIMIT);
}
const mode = args.deltaAuth ? "delta" : (FULL ? "full" : "sample");
if (students.size === 0) { console.error("FATAL: cohort selection matched zero students"); process.exit(2); }
const watermark = args.watermark ? parseInt(args.watermark, 10) : Date.now(); // pinned via --watermark or fresh [r59]
console.error(`B1 v6: ${uids.length}/${students.size} students (${mode}); watermark ${new Date(watermark).toISOString()}`);

const EXCL_KEYS = ["missingCoreField","postWatermark","unknownType","ungraded","badScore","badTotal","badRows","dupWordIdInRows","rowsGtTotal","scoreRowsDisagree","dupConflictGroup","preEpoch","editedNoOrganicScore"];
const excl = Object.fromEntries(EXCL_KEYS.map(k => [k, 0]));
const exclByClass = {};
const agg = { attemptsSeen: 0, attemptsEligible: 0, attemptsExcluded: 0, identicalDupsDropped: 0, teacherEditedSeen: 0, blankUndercount: 0, syntheticAnchorBlanks: 0,
  mutationRiskStudents: 0,
  words: 0, failed: 0, everCorrect: 0, proven: 0, needsPriority: 0, fillEligible: 0, clockSeeded: 0, failCountHist: {} };
const exclBySignature = {}; // per-signature exclusion COUNTS [r55 — counts, not a row list]
const bumpExcl = (reason, classId, sigKey) => {
  excl[reason]++; agg.attemptsExcluded++;
  const c = classId || "UNKNOWN_CLASS";
  exclByClass[c] = exclByClass[c] || {}; exclByClass[c][reason] = (exclByClass[c][reason] || 0) + 1;
  const k = `${reason}|${sigKey || c + "|?"}`;
  exclBySignature[k] = (exclBySignature[k] || 0) + 1;
};

// UID-bearing baseline ⇒ GITIGNORED local dir [r54-1.7]; atomic: write .tmp, rename on completion
const { pathToFileURL } = await import("node:url");
const { resolve: resolvePath } = await import("node:path");
const outDir = args.outDir ? pathToFileURL(resolvePath(args.outDir) + "/") : auditRoot(); // r62p pathToFileURL + r65 DEEPFIX_AUDIT_ROOT isolation
const { mkdirSync } = await import("node:fs"); mkdirSync(outDir, { recursive: true });
const jsonlFinal = new URL(`b1-expected-labels-${mode}.jsonl`, outDir);
const jsonlTmp = new URL(`b1-expected-labels-${mode}.jsonl.tmp`, outDir);
const jsonl = createWriteStream(jsonlTmp);
jsonl.on("error", e => { console.error(`FATAL: jsonl stream error: ${e.message}`); process.exit(2); });
const jwrite = line => new Promise(r => { jsonl.write(line) ? r() : jsonl.once("drain", r); }); // r63: backpressure
const digests = {};

for (const uid of uids) {
  const counters = {
    bump: (reason, classId, sigKey) => bumpExcl(reason, classId, sigKey),
    note: (name) => { if (name === "attemptsSeen") agg.attemptsSeen++; if (name === "teacherEditedSeen") agg.teacherEditedSeen++; },
  };
  const r = await computeStudentLabels(db, uid, watermark, counters);
  agg.attemptsEligible += r.local.eligible;
  agg.identicalDupsDropped += r.local.identicalDupsDropped;
  agg.blankUndercount += r.local.blankUndercount;
  agg.syntheticAnchorBlanks += r.local.syntheticAnchorBlanks;
  agg.legacyRestingInWindow = (agg.legacyRestingInWindow || 0) + r.legacyRestingCensus.inWindow;
  agg.legacyRestingExpired = (agg.legacyRestingExpired || 0) + r.legacyRestingCensus.expiredUncounted;
  agg.legacyRestingCountFailed = (agg.legacyRestingCountFailed || 0) + r.legacyRestingCensus.expiredCountFailed;
  const mine = { words: 0, failed: 0, proven: 0, needsPriority: 0, fillEligible: 0 };
  for (const w of Object.values(r.wordsOut)) {
    agg.words++; mine.words++;
    if (w.fc > 0) { agg.failed++; mine.failed++; }
    if (w.lc !== null) agg.everCorrect++;
    if (w.lp !== null) { agg.proven++; mine.proven++; }
    if (w.rlt !== null) agg.clockSeeded++;
    // (rru retired from wordsOut [r60])
    const needsPriority = w.fc > 0 && (w.lc === null || w.lf > w.lc);
    const fillEligible = w.fc === 0 || (w.lp !== null && w.lp >= w.lf);
    if (needsPriority) { agg.needsPriority++; mine.needsPriority++; }
    if (fillEligible) { agg.fillEligible++; mine.fillEligible++; }
    agg.failCountHist[Math.min(w.fc, 10)] = (agg.failCountHist[Math.min(w.fc, 10)] || 0) + 1;
    const pr = w.lp !== null, np = needsPriority;
    const k = (pr ? "proven" : "unproven") + "_" + (np ? "priority" : (w.lc !== null ? "correct" : "untouched"));
    agg.jointMix = agg.jointMix || {}; agg.jointMix[k] = (agg.jointMix[k] || 0) + 1;
  }
  if (r.mutationRisk.pendingChallenges || r.mutationRisk.adjudicatedAtOrAfterWatermark || r.mutationRisk.challengeTsUnknown) agg.mutationRiskStudents++;
  // r65p: A8 collision = exit 8 everywhere (3 collided with driver skip semantics)
  if (r.wordIdCollisions.length) { console.error(`FATAL [A8]: uid ${uid} has ${r.wordIdCollisions.length} cross-list wordId collisions w/ divergent expectations`); process.exit(8); }
  const line = { uid, epochByList: r.epochByList, mutationRisk: r.mutationRisk, challengeDigest: r.challengeDigest, words: r.wordsOut };
  await jwrite(JSON.stringify(line) + "\n");
  digests[uid] = { ...mine, digest: r.digest };
  process.stderr.write(".");
}
console.error("");
await new Promise(res => jsonl.end(res));
const { renameSync } = await import("node:fs");
renameSync(jsonlTmp, jsonlFinal); // atomic completion [r54-1.6]

const pct = (a, b) => b ? ((100 * a) / b).toFixed(1) + "%" : "n/a";
const summary = { probe: "b1-expected-labels", version: 6, mode, cohortFilter: String(filter),
  law: "STORED>=92 (R2-35/B1-Q3) · uniform across ALL eligible graded types {new,review,retest} (B1-Q1) · reviewLastTestedAt review-type seed, null⇒not-written (B1-Q2) · rru RETIRED from the baseline (r59-A9/r62p: live-only; census informational) · challenge-mutation flagging (r55) · fail-closed fence incl. graded/synthetic law · whole-group dup exclusion · epoch tombstones",
  watermark, students: uids.length, cohortTotal: students.size,
  attempts: { seen: agg.attemptsSeen, eligible: agg.attemptsEligible, excluded: agg.attemptsExcluded, identicalDupsDropped: agg.identicalDupsDropped, teacherEditedSeen: agg.teacherEditedSeen },
  exclusions: excl, exclusionsByClass: exclByClass, exclusionsBySignature: exclBySignature, blankUndercount: agg.blankUndercount, syntheticAnchorBlanks: agg.syntheticAnchorBlanks,
  legacyResting: { inWindow: agg.legacyRestingInWindow || 0, expired: agg.legacyRestingExpired || 0, countFailed: agg.legacyRestingCountFailed || 0, law: "INFORMATIONAL ONLY — rru is LIVE-ONLY (r59-A9/r60); this sizes the launch transient" },
  mutationRiskStudents: agg.mutationRiskStudents,
  words: agg.words, clockSeeded: agg.clockSeeded,
  distributions: { failed: pct(agg.failed, agg.words), everCorrect: pct(agg.everCorrect, agg.words), proven: pct(agg.proven, agg.words),
    needsPriority: pct(agg.needsPriority, agg.words), fillEligible: pct(agg.fillEligible, agg.words) },
  jointMix: Object.fromEntries(Object.entries(agg.jointMix || {}).map(([k, v]) => [k, +(v / agg.words).toFixed(4)])),
  failCountHist: agg.failCountHist, perStudentDigests: digests };
// atomic publish [r55]: summary via tmp+rename, then the hash-bound RUN MANIFEST written LAST — consumers
// (B3/B4/H8) verify the manifest before trusting the pair
const sumTmp = new URL(`b1-expected-labels-${mode}.json.tmp`, outDir);
const sumFinal = new URL(`b1-expected-labels-${mode}.json`, outDir);
writeFileSync(sumTmp, JSON.stringify(summary, null, 2)); renameSync(sumTmp, sumFinal);
const jsonlBytes = readFileSync(jsonlFinal); const sumBytes = readFileSync(sumFinal);
const manTmp = new URL(`b1-manifest-${mode}.json.tmp`, outDir);
writeFileSync(manTmp, JSON.stringify({ probe: "b1-expected-labels", version: 6, mode, watermark, classesMatched, ...(deltaAuthMeta || {}),
  jsonlSha256: createHash("sha256").update(jsonlBytes).digest("hex"),
  summarySha256: createHash("sha256").update(sumBytes).digest("hex") }, null, 2));
renameSync(manTmp, new URL(`b1-manifest-${mode}.json`, outDir));
// a REDACTED pointer (no uids) stays in evidence/ for the repo record
if (!process.env.DEEPFIX_AUDIT_ROOT) // r65p: isolated (lap) runs must not write into tracked evidence/
writeFileSync(new URL(`../../docs/plans/deepfix2/evidence/b1-baseline-pointer-${mode}.json`, import.meta.url),
  JSON.stringify({ probe: "b1-expected-labels", version: 6, mode, watermark, students: uids.length, cohortTotal: students.size,
    attempts: summary.attempts, exclusions: excl, blankUndercount: agg.blankUndercount, words: agg.words, clockSeeded: agg.clockSeeded,
    distributions: summary.distributions, artifactPath: "audit/deepfix/trackB_baselines/ (LOCAL, gitignored — uid-bearing)",
    jointMix: summary.jointMix }, null, 2));
console.log(JSON.stringify({ mode, students: uids.length, attempts: summary.attempts, exclusions: excl,
  blankUndercount: agg.blankUndercount, words: agg.words, clockSeeded: agg.clockSeeded, distributions: summary.distributions }, null, 2));

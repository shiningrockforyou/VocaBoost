// b1-expected-labels.mjs — READ-ONLY (Track B stage B1, 14_ §2) — v5 (r56 correction fold).
// r55 additions: CHALLENGE-MUTATION law (adjudicated rows replay as stored — the stored-score law absorbs the
//   flip; per-student mutationRisk {pendingChallenges, adjudicatedAtOrAfterWatermark, challengeTsUnknown}
//   emitted — B3 re-reads flagged students; B4's delta covers post-watermark adjudications; historical
//   resting-at-acceptance is NOT reconstructable ⇒ documented conservative posture, no stamping depends on it) ·
//   `rru` (reviewRestingUntil seed: legacy masteredAt+21d, VALIDATED — inside the live 21-day window AND the
//   word has eligible history; else not seeded + counted) · graded===false excluded (synthetic manualOverride
//   anchors = the NAMED eligible exception) · per-signature exclusion COUNTS · atomic RUN MANIFEST (hash-bound
//   JSONL+summary, written last) · strict integer --limit · --cohort REQUIRED in --full mode.
// Computes the EXPECTED post-backfill per-word label state per student under the final law.
// The artifact IS the B4 comparison baseline: per-word five-field values + per-(student,list) resetEpoch
// snapshot + watermark metadata, emitted as JSONL (one student per line) + a summary JSON + per-student digests.
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
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b1-expected-labels.mjs [--cohort=REGEX] [--limit=N] [--full]
//   (named flags — the r53 positional-parse bug is closed; defaults: cohort 26SM, limit 50, sample mode)
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";

const KNOWN = new Set(["cohort", "limit", "full", "classAllowlist"]);
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
if (uids.length > LIMIT) {
  const step = Math.max(1, Math.floor(uids.length / LIMIT));
  uids = uids.filter((_, i) => i % step === 0).slice(0, LIMIT);
}
const mode = FULL ? "full" : "sample";
if (students.size === 0) { console.error("FATAL: cohort selection matched zero students"); process.exit(2); }
const watermark = Date.now(); // READ BOUNDARY [r54/r55]: enforced PER-ATTEMPT in the fence (postWatermark; index-free)
console.error(`B1 v5: ${uids.length}/${students.size} students (${mode}); watermark ${new Date(watermark).toISOString()}`);

const EXCL_KEYS = ["missingCoreField","postWatermark","unknownType","ungraded","badScore","badTotal","badRows","dupWordIdInRows","rowsGtTotal","scoreRowsDisagree","dupConflictGroup","preEpoch","editedNoOrganicScore"];
const excl = Object.fromEntries(EXCL_KEYS.map(k => [k, 0]));
const exclByClass = {};
const agg = { attemptsSeen: 0, attemptsEligible: 0, attemptsExcluded: 0, identicalDupsDropped: 0, teacherEditedSeen: 0, blankUndercount: 0, syntheticAnchorBlanks: 0,
  rruSeeded: 0, rruRejectedNoHistory: 0, rruRejectedFuture: 0, rruExpiredUncounted: 0, mutationRiskStudents: 0,
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
const outDir = new URL("../../audit/deepfix/trackB_baselines/", import.meta.url);
const { mkdirSync } = await import("node:fs"); mkdirSync(outDir, { recursive: true });
const jsonlFinal = new URL(`b1-expected-labels-${mode}.jsonl`, outDir);
const jsonlTmp = new URL(`b1-expected-labels-${mode}.jsonl.tmp`, outDir);
const jsonl = createWriteStream(jsonlTmp);
const digests = {};

for (const uid of uids) {
  // epoch snapshot from the REAL tombstones
  const epochByList = {};
  for (const coll of ["progress_meta", "list_progress"]) {
    const snap = await db.collection("users").doc(uid).collection(coll).get();
    for (const d of snap.docs) {
      const v = d.data();
      const cur = epochByList[d.id] || { resetEpoch: 0, resetAt: null };
      epochByList[d.id] = {
        resetEpoch: Math.max(cur.resetEpoch, v.resetEpoch ?? 0),
        resetAt: Math.max(cur.resetAt ?? 0, v.resetAt?.toMillis?.() ?? 0) || null,
      };
    }
  }
  // epoch-0 SERIALIZATION [r54-1.5]: every list the student's attempts touch gets an EXPLICIT entry
  // single-field query (no composite index exists); the watermark boundary is enforced PER-ATTEMPT in the
  // fence below (postWatermark exclusion) — same invariant, index-free [r54-1.1]
  const snap = await db.collection("attempts").where("studentId", "==", uid).get();
  // ---- pass 1: eligibility fence (fail-closed) + signature grouping
  const groups = new Map();
  const mut = { pendingChallenges: 0, adjudicatedTotal: 0, adjudicatedAtOrAfterWatermark: 0, challengeTsUnknown: 0, challengedAttemptIds: [] };
  for (const d of snap.docs) {
    const a = d.data(); agg.attemptsSeen++;
    // challenge-mutation scan FIRST [r56/panel: an excluded attempt's pending challenge must still flag the
    // student — in-place mutations are invisible to submittedAt]; ids give B3/B4 the re-read identity
    if (Array.isArray(a.answers)) for (const r of a.answers) {
      if (!r || !r.challengeStatus) continue;
      if (r.challengeStatus === "pending") mut.pendingChallenges++;
      else {
        mut.adjudicatedTotal++;
        const rt = r.challengeReviewedAt?.toMillis?.() ?? (typeof r.challengeReviewedAt === "string" ? Date.parse(r.challengeReviewedAt) : typeof r.challengeReviewedAt === "number" ? r.challengeReviewedAt : NaN);
        if (Number.isFinite(rt)) { if (rt >= watermark) mut.adjudicatedAtOrAfterWatermark++; }
        else mut.challengeTsUnknown++;
      }
      if (!mut.challengedAttemptIds.includes(d.id) && mut.challengedAttemptIds.length < 200) mut.challengedAttemptIds.push(d.id);
    }
    const classId = typeof a.classId === "string" ? a.classId : null;
    if (typeof a.submittedAt?.toMillis !== "function" || typeof a.listId !== "string" || !a.listId || !classId) { bumpExcl("missingCoreField", classId); continue; }
    const t = a.submittedAt.toMillis();
    if (typeof t !== "number" || !Number.isFinite(t)) { bumpExcl("missingCoreField", classId); continue; }
    if (t >= watermark) { bumpExcl("postWatermark", classId, `${classId}|${a.listId}`); continue; }
    // sessionType WHITELIST [r54-1.2]: only known graded types replay; unknown shapes are excluded, not defaulted
    const sType = a.sessionType ?? a.type ?? null;
    if (sType !== "new" && sType !== "review" && sType !== "retest") { bumpExcl("unknownType", classId, `${classId}|${a.listId}|${sType}`); continue; }
    // graded fence [r56 — EXACT]: eligible iff graded === true OR the NAMED synthetic exception
    // (manualOverride === true, which carries graded:true and empty rows anyway); everything else — missing,
    // null, malformed — is EXCLUDED (B2: 3/1,185 sampled attempts lack the field; exercised data)
    if (a.graded !== true && a.manualOverride !== true) { bumpExcl("ungraded", classId, `${classId}|${a.listId}|${sType}`); continue; }
    // answers must BE an array [r54-1.2] — absence is not an empty test
    if (!Array.isArray(a.answers)) { bumpExcl("badRows", classId, `${classId}|${a.listId}|${sType}`); continue; }
    // teacher-edit adjudication [r54-1.3, forward-compatible]: an edited grade NEVER mints proof; the organic
    // preOverride score governs when present; row facts (fail/correct) replay unchanged
    const edited = a.teacherEdited === true;
    const effScoreRaw = edited ? (a.preOverride && typeof a.preOverride.score === "number" ? a.preOverride.score : null) : (a.score ?? a.scorePercent);
    if (edited) agg.teacherEditedSeen++;
    const epoch = epochByList[a.listId];
    if (epoch?.resetAt && t < epoch.resetAt) { bumpExcl("preEpoch", classId, `${classId}|${a.listId}`); continue; }
    const s = effScoreRaw;
    if (edited && s === null) { bumpExcl("editedNoOrganicScore", classId, `${classId}|${a.listId}`); continue; } // edited w/o preOverride: no provable organic score
    const sigKey = `${classId}|${a.listId}|${sType}`;
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 100) { bumpExcl("badScore", classId, sigKey); continue; }
    const tq = a.totalQuestions;
    if (!Number.isInteger(tq) || tq <= 0 || tq > 500) { bumpExcl("badTotal", classId, sigKey); continue; }
    const rowsRaw = a.answers;
    const rows = [];
    let rowsOk = true, dupRow = false; const seenW = new Set();
    for (const r of rowsRaw) {
      if (!r || typeof r.wordId !== "string" || !r.wordId || typeof r.isCorrect !== "boolean") { rowsOk = false; break; }
      if (seenW.has(r.wordId)) { rowsOk = false; dupRow = true; break; }
      seenW.add(r.wordId); rows.push({ wordId: r.wordId, ok: r.isCorrect });
    }
    if (!rowsOk) { bumpExcl(dupRow ? "dupWordIdInRows" : "badRows", classId, sigKey); continue; }
    if (rows.length > tq) { bumpExcl("rowsGtTotal", classId, sigKey); continue; }
    const correct = rows.filter(r => r.ok).length;
    if (rows.length === tq && Math.abs((correct / tq) * 100 - s) > 2) { bumpExcl("scoreRowsDisagree", classId, sigKey); continue; }
    const sig = `${classId}|${a.listId}|${a.dayNumber ?? a.studyDay}|${sType}|${t}`;
    // content hash: totalQuestions INCLUDED, rows SORTED by wordId (order-insensitive) [r54-1.4]
    const content = createHash("sha256").update(s + "|" + tq + "|" + [...rows].sort((x, y) => x.wordId < y.wordId ? -1 : 1).map(r => r.wordId + ":" + r.ok).join(",")).digest("hex");
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push({ t, classId, listId: a.listId, type: sType, rows, stored: s, tq, content, sig, synthetic: a.manualOverride === true });
  }
  for (const g of groups.values()) for (const a of g) if (!epochByList[a.listId]) epochByList[a.listId] = { resetEpoch: 0, resetAt: null };
  // ---- pass 2: duplicate law — conflicting group excluded WHOLE; identical ⇒ one replayed
  const atts = [];
  for (const [sig, g] of groups) {
    const contents = new Set(g.map(x => x.content));
    if (contents.size > 1) { g.forEach(x => bumpExcl("dupConflictGroup", x.classId, x.sig)); continue; }
    if (g.length > 1) agg.identicalDupsDropped += g.length - 1;
    const a = g[0];
    agg.attemptsEligible++;
    // synthetic CS anchors (manualOverride, answers:[]) are eligible but their phantom blanks are NOT
    // presented-word blanks — counted separately [closure-panel fix]
    if (a.rows.length < a.tq) { if (a.synthetic) agg.syntheticAnchorBlanks += a.tq - a.rows.length; else agg.blankUndercount += a.tq - a.rows.length; }
    atts.push(a);
  }
  atts.sort((x, y) => x.t - y.t);
  // ---- pass 3: replay under the law (STORED score >= 92 mints proof)
  const words = new Map();
  for (const a of atts) {
    const passing = a.stored >= THRESHOLD;
    for (const r of a.rows) {
      const k = a.listId + "|" + r.wordId;
      let w = words.get(k);
      if (!w) { w = { fc: 0, lf: null, lc: null, lp: null, rlt: null }; words.set(k, w); }
      if (r.ok) { w.lc = a.t; if (passing) w.lp = a.t; }
      else { w.fc++; w.lf = a.t; }
      if (a.type === "review") w.rlt = a.t; // reviewLastTestedAt seed (review-type only, B1-Q2)
    }
  }
  // ---- rru seed [r55]: legacy masteredAt within the live 21-day window + eligible history ⇒ reviewRestingUntil
  const rruByKey = {};
  {
    const cutoff = new Date(watermark - 21 * 86400e3);
    const msnap = await db.collection("users").doc(uid).collection("study_states").where("masteredAt", ">", cutoff).get();
    // expired-window rows are query-invisible by design — counted via aggregation so the rejection ledger is complete [panel]
    try { agg.rruExpiredUncounted += (await db.collection("users").doc(uid).collection("study_states").where("masteredAt", "<=", cutoff).count().get()).data().count; } catch {}
    const byWordId = new Map();
    for (const k of words.keys()) { const wid = k.split("|")[1]; if (!byWordId.has(wid)) byWordId.set(wid, []); byWordId.get(wid).push(k); }
    for (const d of msnap.docs) {
      const mAt = d.data().masteredAt?.toMillis?.();
      if (!mAt || mAt > watermark) { agg.rruRejectedFuture++; continue; } // future-forged timestamps [r56 threat]
      const keys = byWordId.get(d.id);
      // AUTHORITATIVE-EVIDENCE validation [r56]: masteredAt alone is client-writable — require the word to have
      // been REVIEW-TESTED in the eligible baseline (rlt non-null): graduation without review appearance is not
      // a shape the legacy system produces organically
      const reviewTested = (keys || []).filter(k => words.get(k)?.rlt !== null && words.get(k)?.rlt !== undefined);
      if (!reviewTested.length) { agg.rruRejectedNoHistory++; continue; }
      for (const k of reviewTested) { rruByKey[k] = mAt + 21 * 86400e3; agg.rruSeeded++; }
    }
  }
  // ---- emit per-word state + digest
  const wordsOut = {};
  const mine = { words: words.size, failed: 0, proven: 0, needsPriority: 0, fillEligible: 0 };
  for (const [k, w] of [...words.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    agg.words++;
    if (w.fc > 0) { agg.failed++; mine.failed++; }
    if (w.lc) agg.everCorrect++;
    if (w.lp) { agg.proven++; mine.proven++; }
    if (w.rlt) agg.clockSeeded++;
    const needsPriority = w.fc > 0 && (!w.lc || w.lf > w.lc);
    const fillEligible = w.fc === 0 || (w.lp !== null && w.lp >= w.lf);
    if (needsPriority) { agg.needsPriority++; mine.needsPriority++; }
    if (fillEligible) { agg.fillEligible++; mine.fillEligible++; }
    agg.failCountHist[Math.min(w.fc, 10)] = (agg.failCountHist[Math.min(w.fc, 10)] || 0) + 1;
    wordsOut[k] = { fc: w.fc, lf: w.lf, lc: w.lc, lp: w.lp, rlt: w.rlt, rru: rruByKey[k] ?? null };
  }
  // joint-mix accumulation (H8's launch-seed input: proven × priority cross)
  for (const w of Object.values(wordsOut)) {
    const pr = w.lp !== null, np = w.fc > 0 && (w.lc === null || w.lf > w.lc);
    const k = (pr ? "proven" : "unproven") + "_" + (np ? "priority" : (w.lc !== null ? "correct" : "untouched"));
    agg.jointMix = agg.jointMix || {}; agg.jointMix[k] = (agg.jointMix[k] || 0) + 1;
  }
  if (mut.pendingChallenges || mut.adjudicatedAtOrAfterWatermark || mut.challengeTsUnknown) agg.mutationRiskStudents++;
  const line = { uid, epochByList, mutationRisk: mut, words: wordsOut };
  jsonl.write(JSON.stringify(line) + "\n");
  digests[uid] = { ...mine, digest: createHash("sha256").update(JSON.stringify(wordsOut)).digest("hex") };
  process.stderr.write(".");
}
console.error("");
await new Promise(res => jsonl.end(res));
const { renameSync } = await import("node:fs");
renameSync(jsonlTmp, jsonlFinal); // atomic completion [r54-1.6]

const pct = (a, b) => b ? ((100 * a) / b).toFixed(1) + "%" : "n/a";
const summary = { probe: "b1-expected-labels", version: 5, mode, cohortFilter: String(filter),
  law: "STORED>=92 (R2-35/B1-Q3) · uniform across ALL eligible graded types {new,review,retest} (B1-Q1) · reviewLastTestedAt review-type seed, null⇒not-written (B1-Q2) · rru validated masteredAt seed (r55) · challenge-mutation flagging (r55) · fail-closed fence incl. graded/synthetic law · whole-group dup exclusion · epoch tombstones",
  watermark, students: uids.length, cohortTotal: students.size,
  attempts: { seen: agg.attemptsSeen, eligible: agg.attemptsEligible, excluded: agg.attemptsExcluded, identicalDupsDropped: agg.identicalDupsDropped, teacherEditedSeen: agg.teacherEditedSeen },
  exclusions: excl, exclusionsByClass: exclByClass, exclusionsBySignature: exclBySignature, blankUndercount: agg.blankUndercount, syntheticAnchorBlanks: agg.syntheticAnchorBlanks,
  rru: { seeded: agg.rruSeeded, rejectedNoHistory: agg.rruRejectedNoHistory, rejectedFuture: agg.rruRejectedFuture, expiredUncountedInWindowQuery: agg.rruExpiredUncounted, law: "seed iff masteredAt ∈ (watermark-21d, watermark] AND the word is REVIEW-TESTED in the eligible baseline (rlt≠null) [r56]" },
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
writeFileSync(manTmp, JSON.stringify({ probe: "b1-expected-labels", version: 5, mode, watermark, classesMatched,
  jsonlSha256: createHash("sha256").update(jsonlBytes).digest("hex"),
  summarySha256: createHash("sha256").update(sumBytes).digest("hex") }, null, 2));
renameSync(manTmp, new URL(`b1-manifest-${mode}.json`, outDir));
// a REDACTED pointer (no uids) stays in evidence/ for the repo record
writeFileSync(new URL(`../../docs/plans/deepfix2/evidence/b1-baseline-pointer-${mode}.json`, import.meta.url),
  JSON.stringify({ probe: "b1-expected-labels", version: 5, mode, watermark, students: uids.length, cohortTotal: students.size,
    attempts: summary.attempts, exclusions: excl, blankUndercount: agg.blankUndercount, words: agg.words, clockSeeded: agg.clockSeeded,
    distributions: summary.distributions, artifactPath: "audit/deepfix/trackB_baselines/ (LOCAL, gitignored — uid-bearing)",
    jointMix: summary.jointMix }, null, 2));
console.log(JSON.stringify({ mode, students: uids.length, attempts: summary.attempts, exclusions: excl,
  blankUndercount: agg.blankUndercount, words: agg.words, clockSeeded: agg.clockSeeded, distributions: summary.distributions }, null, 2));

// delta-chain-fixture.mjs — THE END-TO-END DELTA-CHAIN INTEGRATION FIXTURE [r61 closure — both reviewers].
//
// Proves the Track B chain COMPOSES, against a fake in-memory Firestore and the REAL law code:
//   FULL baseline (real computeStudentLabels + B1-format artifacts)
//     → live mutation after the watermark (uB) + roster churn (uC departs)
//     → simulated B4 delta detection → materialized delta-auth.json
//     → simulated B1 --deltaAuth delta layer (parent hashes + departedUids, fresh watermark)
//     → REAL loadDeltaLayer / loadVerifiedBaselineIndexed / resolveExpectedSource
//     → simulated B3 apply onto fake study_states → simulated B4 re-verify ⇒ ZERO diffs (convergence)
//   plus the NEGATIVE battery: every binding in the chain, tampered, must THROW.
//
// What this does NOT cover (honestly): the B1/B3/B4 CLIs' arg parsing and live-Firestore I/O (they
// require firebase-admin + the service key). The shared law modules those CLIs delegate to —
// b1-replay-lib.mjs and b-baseline.mjs — ARE the code under test here; artifact formats are byte-law.
//
// Run: node scripts/deepfix2/delta-chain-fixture.mjs   (exit 0 = all checks pass)
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { computeStudentLabels } from "./b1-replay-lib.mjs";
import { loadVerifiedBaseline, loadVerifiedBaselineIndexed, loadDeltaLayer, resolveExpectedSource, isRosterAdded, isFieldLiveExempt, assertLayerChainOrder, assessLease } from "./b-baseline.mjs";
import { applyChunkInTxn } from "./b3-txn-core.mjs";

let checks = 0, failures = 0;
const ok = (cond, label) => { checks++; if (!cond) { failures++; console.error(`FAIL: ${label}`); } };
const throws = (fn, needle, label) => {
  checks++;
  try { fn(); failures++; console.error(`FAIL (no throw): ${label}`); }
  catch (e) { if (!String(e.message).includes(needle)) { failures++; console.error(`FAIL (wrong error '${e.message}'): ${label}`); } }
};

// ---------- fake Firestore (exactly the surface b1-replay-lib uses) ----------
const TS = ms => ({ toMillis: () => ms });
const state = {
  attempts: [], // {id, data}
  tombstones: {}, // uid -> {progress_meta:{listId:{...}}, list_progress:{...}}
  study: {}, // uid -> {wordId: fields}
};
const fakeDb = {
  collection(name) {
    if (name === "attempts") return { where: (f, op, v) => ({ get: async () => ({ docs: state.attempts.filter(a => a.data.studentId === v).map(a => ({ id: a.id, data: () => a.data })) }) }) };
    if (name === "users") return { doc: uid => ({ collection: sub => {
      if (sub === "progress_meta" || sub === "list_progress") {
        const m = state.tombstones[uid]?.[sub] || {};
        return { get: async () => ({ docs: Object.entries(m).map(([id, d]) => ({ id, data: () => d })) }) };
      }
      if (sub === "study_states") {
        const docs = Object.entries(state.study[uid] || {});
        return { where: (f, op, v) => {
          const cut = v.getTime();
          const match = docs.filter(([, d]) => { const ms = d.masteredAt?.toMillis?.(); return typeof ms === "number" && (op === ">" ? ms > cut : ms <= cut); });
          return { get: async () => ({ size: match.length }), count: () => ({ get: async () => ({ data: () => ({ count: match.length }) }) }) };
        } };
      }
      throw new Error(`fake: unknown subcollection ${sub}`);
    } }) };
    throw new Error(`fake: unknown collection ${name}`);
  },
};

// ---------- seed: three students, attempts before W0 ----------
const DAY = 86400e3;
const W0 = 100 * DAY, W1 = 110 * DAY;
const mkAttempt = (id, uid, t, type, rows, score) => ({ id, data: {
  studentId: uid, classId: "cls1", listId: "L1", sessionType: type, submittedAt: TS(t), graded: true,
  score, totalQuestions: rows.length, dayNumber: 1, answers: rows.map(([w, c]) => ({ wordId: w, isCorrect: c })),
} });
state.attempts.push(
  mkAttempt("a1", "uA", 90 * DAY, "new", [["w1", true], ["w2", true]], 100),
  mkAttempt("a2", "uA", 91 * DAY, "review", [["w1", true], ["w2", false]], 50),
  mkAttempt("b1", "uB", 92 * DAY, "new", [["w1", true], ["w3", true]], 100),
  mkAttempt("b2", "uB", 93 * DAY, "review", [["w3", false]], 0),
  mkAttempt("c1", "uC", 94 * DAY, "new", [["w2", true]], 100),
);

const compute = (uid, wm) => computeStudentLabels(fakeDb, uid, wm, {});

// ---------- B1-format artifact writers (byte-law replica; verified by the REAL loaders) ----------
const writeBaselineDir = (dir, mode, watermark, rowsByUid, extraManifest = {}) => {
  mkdirSync(dir, { recursive: true });
  const lines = Object.entries(rowsByUid).map(([uid, r]) =>
    JSON.stringify({ uid, epochByList: r.epochByList, mutationRisk: r.mutationRisk, challengeDigest: r.challengeDigest, words: r.wordsOut }));
  const jsonl = lines.length ? lines.join("\n") + "\n" : "";
  const summary = JSON.stringify({ probe: "b1-summary", students: lines.length });
  writeFileSync(join(dir, `b1-expected-labels-${mode}.jsonl`), jsonl);
  writeFileSync(join(dir, `b1-expected-labels-${mode}.json`), summary);
  const manifest = { probe: "b1-expected-labels", version: 6, mode, watermark,
    classesMatched: [{ id: "cls1" }],
    jsonlSha256: createHash("sha256").update(jsonl).digest("hex"),
    summarySha256: createHash("sha256").update(summary).digest("hex"), ...extraManifest };
  const mPath = join(dir, mode === "delta" ? "b1-manifest-delta.json" : "b1-manifest.json");
  writeFileSync(mPath, JSON.stringify(manifest, null, 2));
  return mPath;
};

const root = mkdtempSync(join(tmpdir(), "deltachain-"));

// ===== STAGE 1: the FULL original baseline at W0 =====
const rows0 = { uA: await compute("uA", W0), uB: await compute("uB", W0), uC: await compute("uC", W0) };
const originalManifestPath = writeBaselineDir(join(root, "original"), "full", W0, rows0);
const original = loadVerifiedBaseline(originalManifestPath);
const originalIdx = loadVerifiedBaselineIndexed(originalManifestPath);
ok(original.rows.size === 3, "original loads 3 rows");
ok(originalIdx.rows.size === 3 && originalIdx.rows.has("uB"), "indexed loader: size+has");
ok(JSON.stringify(originalIdx.rows.get("uB")) === JSON.stringify(original.rows.get("uB")), "indexed loader ≡ eager loader per row");
ok([...originalIdx.rows.keys()].sort().join(",") === "uA,uB,uC", "indexed loader keys()");

// ===== STAGE 2: live mutation AFTER W0 + roster churn =====
state.attempts.push(mkAttempt("b3", "uB", 105 * DAY, "review", [["w3", true], ["w1", true]], 100)); // uB's post-W0 pass
const roster = new Set(["uA", "uB"]); // uC departs

// ===== STAGE 3: simulated B4 delta detection at W0 → materialized delta-auth =====
const deltaUids = [];
for (const uid of ["uA", "uB", "uC"]) {
  const counters = { post: 0 }; // postWatermark fence bumps = mutation after the baseline
  const live = await computeStudentLabels(fakeDb, uid, W0, { bump: r => { if (r === "postWatermark") counters.post++; } });
  if (counters.post > 0 || live.challengeDigest !== original.rows.get(uid).challengeDigest) deltaUids.push(uid);
}
deltaUids.push("uC"); // uC flagged pre-departure (the churn case under test)
ok(deltaUids.includes("uB") && !deltaUids.includes("uA"), "B4 sim: uB is delta (post-W0 attempt), uA is not");
const deltaDir = join(root, "delta0");
mkdirSync(deltaDir, { recursive: true });
const auth = { probe: "b4-delta", version: 2, baselineManifestSha256: original.manifestSha256, uids: [...new Set(deltaUids)].sort() };
const authBytes = JSON.stringify(auth, null, 2);
writeFileSync(join(deltaDir, "delta-auth.json"), authBytes);

// ===== STAGE 4: simulated B1 --deltaAuth at W1 (parent hashes + departedUids) =====
const departed = auth.uids.filter(u => !roster.has(u));
const scopeUids = auth.uids.filter(u => roster.has(u));
ok(departed.join(",") === "uC" && scopeUids.join(",") === "uB", "B1 --deltaAuth sim: departed=[uC], scope=[uB]");
const rows1 = {};
for (const uid of scopeUids) rows1[uid] = await compute(uid, W1);
writeBaselineDir(deltaDir, "delta", W1, rows1, {
  parentOriginalManifestSha256: original.manifestSha256,
  parentDeltaAuthSha256: createHash("sha256").update(authBytes).digest("hex"),
  departedUids: departed,
});

// ===== STAGE 5: REAL loader chain + per-uid resolution =====
const layer = loadDeltaLayer(deltaDir, original.manifestSha256, W0);
ok(layer.base.rows.size === 1 && layer.base.rows.has("uB"), "delta layer loads with departed uid excused");
const rA = resolveExpectedSource("uA", original, [layer]);
const rB = resolveExpectedSource("uB", original, [layer]);
ok(rA.layer === "original" && rA.watermark === W0, "uA resolves to the ORIGINAL");
ok(rB.layer === "delta0" && rB.watermark === W1, "uB resolves to the DELTA layer");
ok(JSON.stringify(rB.row.words) !== JSON.stringify(original.rows.get("uB").words), "uB's delta row differs (absorbed the post-W0 attempt)");
ok(rB.row.words["L1|w3"].lp === 105 * DAY, "uB w3 lastProven = the post-W0 passing review");
const rAi = resolveExpectedSource("uA", originalIdx, [layer]);
ok(JSON.stringify(rAi.row) === JSON.stringify(rA.row), "resolution identical through the INDEXED original");

// ===== STAGE 6: simulated B3 apply → simulated B4 verify ⇒ ZERO diffs =====
const FIELD_MAP = { fc: "reviewFailCount", lf: "reviewLastFailedAt", lc: "reviewLastCorrectAt", lp: "reviewLastProvenAt", rlt: "reviewLastTestedAt" };
state.study.uA = { w1: { reviewFailCount: 99 }, w2: {} }; // wrong current values → must be repaired
state.study.uB = { w1: {}, w3: { reviewLastProvenAt: "CORRUPT-STRING" } }; // corrupt-typed → must be repaired
for (const uid of roster) {
  const src = resolveExpectedSource(uid, original, [layer]);
  for (const [k, w] of Object.entries(src.row.words)) {
    const wid = k.split("|")[1];
    if (!state.study[uid][wid]) state.study[uid][wid] = {};
    const doc = state.study[uid][wid];
    for (const [short, field] of Object.entries(FIELD_MAP)) {
      const exp = w[short];
      if (exp === null || exp === undefined) delete doc[field]; // expected-null ⇒ FieldValue.delete()
      else doc[field] = short === "fc" ? exp : TS(exp);
    }
  }
}
let diffs = 0;
for (const uid of roster) {
  const src = resolveExpectedSource(uid, original, [layer]);
  for (const [k, w] of Object.entries(src.row.words)) {
    const doc = state.study[uid][k.split("|")[1]] || {};
    for (const [short, field] of Object.entries(FIELD_MAP)) {
      const exp = w[short];
      const raw = doc[field];
      const act = raw === undefined ? null : (short === "fc" ? (typeof raw === "number" ? raw : "CORRUPT") : (raw?.toMillis?.() ?? "CORRUPT"));
      if (act !== (exp ?? null)) diffs++;
    }
  }
}
ok(diffs === 0, `post-apply verify: ZERO diffs (got ${diffs}) — the chain CONVERGES`);

// ===== STAGE 7: the NEGATIVE battery — every binding, tampered, throws =====
const cloneLayer = (name, mutate) => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const f of ["delta-auth.json", "b1-manifest-delta.json", "b1-expected-labels-delta.jsonl", "b1-expected-labels-delta.json"])
    writeFileSync(join(dir, f), readFileSync(join(deltaDir, f)));
  mutate(dir);
  return dir;
};
throws(() => loadDeltaLayer(cloneLayer("n1", d => { // flip a byte in the delta JSONL
  const p = join(d, "b1-expected-labels-delta.jsonl"); const b = Buffer.from(readFileSync(p)); b[10] ^= 1; writeFileSync(p, b);
}), original.manifestSha256, W0), "JSONL hash mismatch", "tampered delta rows die");
throws(() => loadDeltaLayer(deltaDir, "0".repeat(64), W0), "DIFFERENT original", "mispaired original sha dies");
throws(() => loadDeltaLayer(cloneLayer("n2", d => { // edit delta-auth AFTER the manifest stamped it
  const a = JSON.parse(readFileSync(join(d, "delta-auth.json"), "utf-8")); a.uids = [...a.uids]; writeFileSync(join(d, "delta-auth.json"), JSON.stringify(a, null, 1));
}), original.manifestSha256, W0), "parentDeltaAuthSha256", "post-stamp auth edit dies");
throws(() => loadDeltaLayer(deltaDir, original.manifestSha256, W1), "must EXCEED", "delta watermark ≤ original dies");
{ // valid hashes but a row for a uid NOT in delta-auth → uid-set law
  const dir = join(root, "n3");
  const rogue = { ...rows1, uZ: rows1.uB };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "delta-auth.json"), authBytes);
  writeBaselineDir(dir, "delta", W1, rogue, {
    parentOriginalManifestSha256: original.manifestSha256,
    parentDeltaAuthSha256: createHash("sha256").update(authBytes).digest("hex"),
    departedUids: departed,
  });
  throws(() => loadDeltaLayer(dir, original.manifestSha256, W0), "uid-set", "rogue uid row dies");
}
{ // auth uid missing from rows WITHOUT a departed excusal → dies; the departed law is the ONLY excusal
  const dir = join(root, "n4");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "delta-auth.json"), authBytes);
  writeBaselineDir(dir, "delta", W1, rows1, {
    parentOriginalManifestSha256: original.manifestSha256,
    parentDeltaAuthSha256: createHash("sha256").update(authBytes).digest("hex"),
    departedUids: [], // uC unexcused
  });
  throws(() => loadDeltaLayer(dir, original.manifestSha256, W0), "uid-set", "unexcused missing delta uid dies");
}
throws(() => loadVerifiedBaselineIndexed(join(root, "delta0", "b1-manifest-delta.json"), { requireMode: "full" }), "≠ required", "mode law holds on the indexed loader");
{ // r62p: duplicate uid rows are a baseline-integrity failure, both loaders
  const dir = join(root, "n5");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ uid: "uA", epochByList: {}, mutationRisk: {}, challengeDigest: "x", words: {} });
  const jsonl = line + "\n" + line + "\n";
  const summary = JSON.stringify({ probe: "b1-summary" });
  writeFileSync(join(dir, "b1-expected-labels-full.jsonl"), jsonl);
  writeFileSync(join(dir, "b1-expected-labels-full.json"), summary);
  writeFileSync(join(dir, "b1-manifest.json"), JSON.stringify({ probe: "b1-expected-labels", version: 6, mode: "full", watermark: W0,
    jsonlSha256: createHash("sha256").update(jsonl).digest("hex"), summarySha256: createHash("sha256").update(summary).digest("hex") }));
  throws(() => loadVerifiedBaseline(join(dir, "b1-manifest.json")), "duplicate uid", "dup-uid row dies (eager)");
  throws(() => loadVerifiedBaselineIndexed(join(dir, "b1-manifest.json")), "duplicate uid", "dup-uid row dies (indexed)");
}
{ // r62p [panel D3]: a FUTURE watermark is a false-PASS hazard — loaders reject it
  const dir = join(root, "n6");
  const future = Date.now() + 864e5;
  writeBaselineDir(dir, "full", future, { uA: rows0.uA });
  throws(() => loadVerifiedBaseline(join(dir, "b1-manifest.json")), "FUTURE", "future watermark dies");
}

// ===== STAGE 8 [r62p]: multi-layer resolution ordering + the rosterAdded law =====
const W2 = 120 * DAY;
state.attempts.push(mkAttempt("b4", "uB", 115 * DAY, "review", [["w1", false]], 0)); // post-W1 fail
const layer2Dir = join(root, "delta1");
mkdirSync(layer2Dir, { recursive: true });
const auth2 = { probe: "b4-delta", version: 2, baselineManifestSha256: original.manifestSha256, uids: ["uB"] };
const auth2Bytes = JSON.stringify(auth2, null, 2);
writeFileSync(join(layer2Dir, "delta-auth.json"), auth2Bytes);
writeBaselineDir(layer2Dir, "delta", W2, { uB: await compute("uB", W2) }, {
  parentOriginalManifestSha256: original.manifestSha256,
  parentDeltaAuthSha256: createHash("sha256").update(auth2Bytes).digest("hex"),
  departedUids: [],
});
const layer2 = loadDeltaLayer(layer2Dir, original.manifestSha256, W0);
const rB2 = resolveExpectedSource("uB", original, [layer, layer2]);
ok(rB2.layer === "delta1" && rB2.watermark === W2, "LATEST layer wins the resolution");
ok(rB2.row.words["L1|w1"].lf === 115 * DAY, "the W2 layer's row carries the post-W1 fail");
const rB2rev = resolveExpectedSource("uB", original, [layer2, layer]); // order-insensitive
ok(rB2rev.watermark === W2, "resolution is layer-order-insensitive (watermark decides)");
ok(isRosterAdded("uNEW", original, [layer, layer2]) === true, "uncovered joiner IS rosterAdded");
ok(isRosterAdded("uB", original, [layer2]) === false, "layer-covered joiner is NOT rosterAdded [D2 — the permanent non-PASS loop is dead]");
ok(isRosterAdded("uA", original, []) === false, "original-covered uid is NOT rosterAdded");

// ===== STAGE 9 [r62p — the r61-A3 race battery]: THE phase-2 txn core under reset interleavings =====
const DEL = Symbol("delete");
const fakeTs = { fromMillis: ms => ({ toMillis: () => ms, __ms: ms }) };
const fakeFv = { delete: () => DEL };
const coreReadCurrent = (cur, field) => {
  if (!cur || !(field in cur)) return { v: null, corrupt: false };
  const raw = cur[field];
  if (field === "reviewFailCount") return typeof raw === "number" && Number.isInteger(raw) ? { v: raw, corrupt: false } : { v: "CORRUPT", corrupt: true };
  const ms = raw?.toMillis?.();
  return typeof ms === "number" ? { v: ms, corrupt: false } : { v: "CORRUPT", corrupt: true };
};
const mkTxn = (tombDocs, targetDocs, writes) => ({
  get: async q => ({ docs: q.__docs }),
  getAll: async (...refs) => refs.map(r => ({ exists: r.__data !== null, data: () => r.__data, ref: r })),
  update: (ref, u) => writes.push({ ref: ref.__id, op: "update", u }),
  set: (ref, u) => writes.push({ ref: ref.__id, op: "set", u }),
});
const runCore = async ({ tomb, targets, chunk, snapshotEpoch }) => {
  const writes = [];
  const txn = mkTxn(tomb, targets, writes);
  const ctx = {
    tombstoneQueries: [{ __docs: tomb }, { __docs: [] }],
    targetRef: w => ({ __id: w, __data: targets[w] ?? null }),
    expectedEpochByList: snapshotEpoch, Timestamp: fakeTs, FieldValue: fakeFv, readCurrent: coreReadCurrent,
  };
  const out = await applyChunkInTxn(txn, { ...ctx, chunk });
  return { out, writes };
};
const tombDoc = (id, d) => ({ id, data: () => d });
const CH = [{ wordId: "w1", sets: { reviewLastProvenAt: 105 * DAY, reviewFailCount: 2 }, deletes: ["reviewLastFailedAt"] }];
const SNAP = { L1: { resetEpoch: 1, resetAt: 50 * DAY } };
{ // (a) live lock ⇒ RESET_LOCKED, ZERO writes
  let threw = null;
  try { await runCore({ tomb: [tombDoc("L1", { resetEpoch: 1, resetAt: TS(50 * DAY), resetInProgress: { opId: "x" } })], targets: {}, chunk: CH, snapshotEpoch: SNAP }); }
  catch (e) { threw = e.message; }
  ok(threw === "RESET_LOCKED", "txn-core: live lock aborts");
}
{ // (b) COMPLETED reset (lock cleared, epoch bumped) ⇒ EPOCH_DRIFT, ZERO writes — the r62-panel counterexample
  let threw = null;
  try { await runCore({ tomb: [tombDoc("L1", { resetEpoch: 2, resetAt: TS(106 * DAY) })], targets: {}, chunk: CH, snapshotEpoch: SNAP }); }
  catch (e) { threw = e.message; }
  ok(threw === "EPOCH_DRIFT", "txn-core: completed reset between phases aborts (NEW-2 closed)");
}
{ // (c) normal: re-diffed exact writes; delete materializes; counts land
  const { out, writes } = await runCore({ tomb: [tombDoc("L1", { resetEpoch: 1, resetAt: TS(50 * DAY) })],
    targets: { w1: { reviewLastFailedAt: TS(90 * DAY), reviewFailCount: 2 } }, chunk: CH, snapshotEpoch: SNAP });
  ok(out.written === 1 && writes.length === 1 && writes[0].op === "update", "txn-core: one re-diffed update");
  const u = writes[0].u;
  ok(u.reviewLastProvenAt?.__ms === 105 * DAY && u.reviewLastFailedAt === DEL && !("reviewFailCount" in u), "txn-core: stale plan values are re-diffed — equal fc not re-forced, delete materialized");
}
{ // (d) current already ≡ expected ⇒ ZERO writes (the plan is a hint, never authority)
  const { out, writes } = await runCore({ tomb: [tombDoc("L1", { resetEpoch: 1, resetAt: TS(50 * DAY) })],
    targets: { w1: { reviewLastProvenAt: TS(105 * DAY), reviewFailCount: 2 } }, chunk: CH, snapshotEpoch: SNAP });
  ok(out.written === 0 && writes.length === 0 && out.verifiedEqual === 1, "txn-core: fully-converged doc writes NOTHING");
}

// ===== STAGE 9b [r64 — Codex A1's cumulative counterexample]: the pre-flip tail survives every post-flip
// increment; only the THROUGH-CUTOFF replay catches it =====
{
  const FLIP2 = 100 * DAY, CUT = 110 * DAY;
  state.attempts.push(
    mkAttempt("d1", "uD", 90 * DAY, "review", [["w9", false]], 0),
    mkAttempt("d2", "uD", 95 * DAY, "review", [["w9", false]], 0),   // the pre-flip TAIL B3 never applied
    mkAttempt("d3", "uD", 105 * DAY, "review", [["w9", false]], 0)); // the post-flip live fail (+1 on disk)
  const atFlip = await compute("uD", FLIP2);
  const atCut = await compute("uD", CUT);
  const diskFc = 2; // B3 wrote 1 (missing d2's tail), the live writer incremented to 2, lf stamped ≥ flip
  ok(atFlip.wordsOut["L1|w9"].fc === 2, "cumulative: flip-boundary expected fc = 2");
  ok(atCut.wordsOut["L1|w9"].fc === 3, "cumulative: through-cutoff expected fc = 3");
  ok(diskFc === atFlip.wordsOut["L1|w9"].fc, "cumulative: the OLD flip-boundary comparison sees a COINCIDENTAL match (the false green Codex named)");
  ok(diskFc !== atCut.wordsOut["L1|w9"].fc, "cumulative: the r64 through-cutoff law CATCHES the deficit (2 ≠ 3)");
}
// ===== STAGE 9c [r66 — THE ADJUDICATION-REALITY LAW, Codex r65 A1]: the accept writer flipped isCorrect
// AND recomputed the stored score (production reality); grading truth is reconstructed; the mint is
// stamped at challengeReviewedAt; as-of-boundary acceptance =====
{
  state.attempts.push({ id: "e1", data: { studentId: "uE", classId: "cls1", listId: "L1", sessionType: "review",
    submittedAt: TS(96 * DAY), graded: true, score: 50, totalQuestions: 2, dayNumber: 1, // 50 = the accept writer's recompute (1 of 2 effective-correct)
    answers: [
      { wordId: "w7", isCorrect: true, challengeStatus: "accepted", challengeReviewedAt: TS(105 * DAY) }, // LEGACY row: isCorrect ALREADY flipped in place
      { wordId: "w8", isCorrect: false, challengeStatus: "rejected", challengeReviewedAt: TS(105 * DAY) },
    ] } });
  const e = await compute("uE", 120 * DAY);
  const w7 = e.wordsOut["L1|w7"], w8 = e.wordsOut["L1|w8"];
  ok(w7.fc === 1 && w7.lf === 96 * DAY, "reality law: the LEGACY accepted row's pre-accept fail is RECONSTRUCTED (fc/lf grading-time)");
  ok(w7.lc === 105 * DAY, "reality law: the mint is stamped at challengeReviewedAt, never the attempt time");
  ok(w7.lp === null, "reality law: no proof mint on a failing test (pass-gated unchanged)");
  ok(w8.fc === 1 && w8.lc === null, "reality law: a REJECTED challenge changes NOTHING");
  const eAt100 = await compute("uE", 100 * DAY);
  ok(eAt100.wordsOut["L1|w7"].lc === null, "reality law: AS-OF-BOUNDARY — an accept reviewed at 105d is INVISIBLE to a 100d replay");
  { // r67 [Codex A1 + panel NEW-3 — the tautology dies; the census is REAL and counted]
    const cen = {}; const cc = { note: nm => { cen[nm] = (cen[nm] || 0) + 1; }, bump: () => {} };
    await computeStudentLabels(fakeDb, "uE", 120 * DAY, cc);
    ok((cen.legacyAcceptedReconstructed || 0) >= 1, "R2-49 census: legacyAcceptedReconstructed COUNTS the legacy row");
  }
  state.attempts.push({ id: "e2", data: { studentId: "uE", classId: "cls1", listId: "L1", sessionType: "review",
    submittedAt: TS(97 * DAY), graded: true, score: 100, totalQuestions: 1, dayNumber: 2,
    answers: [{ wordId: "w7", isCorrect: false, gradedIsCorrect: false, challengeStatus: "accepted", challengeReviewedAt: TS(106 * DAY) }] } });
  const e2 = await compute("uE", 120 * DAY);
  ok(e2.wordsOut["L1|w7"].fc === 2, "reality law: the PREIMAGE field (gradedIsCorrect) is grading truth when present — fail kept");
  ok(e2.wordsOut["L1|w7"].lp === 106 * DAY, "reality law: a PASSING accepted test mints proof at review time");
}

// ===== STAGE 9d [r67 — Codex r66 A2's sibling-proof reproduction]: a POST-boundary accept must not
// retroactively make the attempt passing at the boundary =====
{
  state.attempts.push(
    { id: "f1", data: { studentId: "uF", classId: "cls1", listId: "L1", sessionType: "new", submittedAt: TS(90 * DAY), graded: true, score: 100, totalQuestions: 1, dayNumber: 1, answers: [{ wordId: "w1", isCorrect: true }] } },
    { id: "f2", data: { studentId: "uF", classId: "cls1", listId: "L1", sessionType: "review", submittedAt: TS(91 * DAY), graded: true, score: 100, totalQuestions: 2, dayNumber: 2, // stored ALREADY recomputed by the post-boundary accept
      answers: [
        { wordId: "w1", isCorrect: true },
        { wordId: "w2", isCorrect: true, challengeStatus: "accepted", challengeReviewedAt: TS(150 * DAY) }, // accepted AFTER every boundary below
      ] } });
  const f = await compute("uF", 100 * DAY); // boundary BEFORE the review instant
  ok(f.wordsOut["L1|w1"].lp === 90 * DAY, "as-of passing: w1's proof stays at day-1 — the day-2 attempt is NOT passing as-of (reconstructed 50 < 92)");
  ok(f.wordsOut["L1|w2"].fc === 1, "as-of: the accepted row's historical fail stands");
  const f2 = await compute("uF", 160 * DAY); // boundary AFTER the review instant
  ok(f2.wordsOut["L1|w1"].lp === 91 * DAY, "as-of passing: past the review instant the acceptance IS effective — day-2 becomes proof");
}
// ===== STAGE 9e [r67 — Codex r66 A4]: the pure lease-state law =====
{
  const now = 10 * 3600e3;
  ok(assessLease({ pid: 1, at: now - 3 * 3600e3 }, () => "alive", now).stale === false, "lease: ALIVE holder owned at ANY age");
  ok(assessLease({ pid: 1, at: now - 3 * 3600e3 }, () => "eperm", now).stale === false, "lease: EPERM holder owned FOREVER");
  ok(assessLease({ pid: 1, at: now - 60e3 }, () => "dead", now).stale === true, "lease: DEAD holder stale immediately");
  ok(assessLease({ at: now - 3 * 3600e3 }, () => "alive", now).stale === true, "lease: aged NO-IDENTITY lease stale");
  ok(assessLease({ at: now - 60e3 }, () => "alive", now).stale === false, "lease: fresh no-identity lease protected");
  ok(assessLease(null, () => "alive", now).stale === true, "lease: unparseable with NO mtime info = stale (conservative)");
}

// ===== STAGE 9f [r68 — Codex r67 A2]: EXACT terminal schema — truthiness dies =====
{
  const mk = lines => lines.map(x => JSON.stringify(x)).join("\n") + "\n";
  const O = "o".repeat(64);
  const base = { version: 1, runId: "t1", attempt: 0, originalManifestSha256: O };
  const Z = { txnFailures: 0, skippedResetLocked: 0, skippedEpochDrift: 0 };
  const { parseLedgerStrict } = await import("./b-baseline.mjs");
  throws(() => parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { ...Z, cutoverAborted: "yes" } }]), O), "non-boolean", "schema: string cutoverAborted dies");
  throws(() => parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { ...Z, cutoverAborted: 1 } }]), O), "non-boolean", "schema: numeric cutoverAborted dies");
  throws(() => parseLedgerStrict(mk([{ ...base, probe: "b3-intent", deltaManifestSha256: "aaa" }, { ...base, probe: "b3-applied", deltaManifestSha256: "bbb", outcome: { ...Z, cutoverAborted: true } }]), O), "≠ its intent", "schema: cutover delta-sha must bind to its intent");
  // r69 [Codex B1]: counter SHAPES — strings/NaN/negatives die on ANY completion
  throws(() => parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { ...Z, txnFailures: "many" } }]), O), "non-negative integer", "schema: string counter dies");
  throws(() => parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { ...Z, skippedResetLocked: -2 } }]), O), "non-negative integer", "schema: negative counter dies");
  { // r69 [accuracy NEW-2]: postFlip failed-latest = published ORPHAN disposition, never a brick
    const failed = parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { txnFailures: 3, skippedResetLocked: 0, skippedEpochDrift: 0 } }]), O, { postFlip: true });
    ok(failed.problems.length === 0 && failed.orphans.length === 1 && failed.orphans[0].outcome.txnFailures === 3, "postFlip: a FAILED latest completion = published orphan with its counts");
  }
  const okRed = parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }, { ...base, probe: "b3-applied", outcome: { txnFailures: 2, skippedResetLocked: 0, skippedEpochDrift: 0, cutoverAborted: true } }]), O);
  ok(okRed.cutoverRuns.length === 1 && okRed.cutoverRuns[0].outcome.txnFailures === 2 && okRed.problems.length === 0, "schema: REAL pre-abort counts SURFACE via cutoverRuns, terminal not a problem");
  const orph = parseLedgerStrict(mk([{ ...base, probe: "b3-intent" }]), O, { postFlip: true });
  ok(orph.problems.length === 0 && orph.orphans.length === 1, "postFlip: a dangling pre-flip intent = published ORPHAN, never a brick");
}
// ===== STAGE 9g [r68 — asof NEW-4]: the other two censuses COUNT =====
{
  state.attempts.push({ id: "g1", data: { studentId: "uG", classId: "cls1", listId: "L1", sessionType: "review",
    submittedAt: TS(96 * DAY), graded: true, score: 50, totalQuestions: 2, dayNumber: 1,
    answers: [
      { wordId: "w1", isCorrect: true, challengeStatus: "accepted" }, // accepted, NO timestamp
      { wordId: "w2", isCorrect: false, challengeStatus: "banana" }, // rogue status
    ] } });
  const cen = {}; const cc = { note: nm => { cen[nm] = (cen[nm] || 0) + 1; }, bump: () => {} };
  await computeStudentLabels(fakeDb, "uG", 120 * DAY, cc);
  ok((cen.acceptedNoTimestamp || 0) === 1, "census: acceptedNoTimestamp counts EXACTLY 1");
  ok((cen.challengeStatusUnknownEnum || 0) === 1, "census: rogue status counts EXACTLY 1");
}
// ===== STAGE 9h [r68]: unparseable-lease aged law =====
{
  const now = 10 * 3600e3;
  ok(assessLease(null, () => "alive", now, 2 * 3600e3, now - 60e3).stale === false, "lease: FRESH unparseable (mtime) protected");
  ok(assessLease(null, () => "alive", now, 2 * 3600e3, now - 3 * 3600e3).stale === true, "lease: AGED unparseable stale");
  ok(assessLease({ pid: 0, at: now - 60e3 }, () => "alive", now).stale === false, "lease: pid 0 = fresh no-identity (protected)");
  ok(assessLease({ pid: -1, at: now - 3 * 3600e3 }, () => "alive", now).stale === true, "lease: aged non-positive pid = no-identity stale");
}

// ===== STAGE 9i [r70 — THE A8 MERGE LAW, R2-50]: duplicate-list restudy merges per the live rerun law =====
{
  state.attempts.push(
    { id: "h1", data: { studentId: "uH", classId: "cls1", listId: "LA", sessionType: "review", submittedAt: TS(90 * DAY), graded: true, score: 0, totalQuestions: 1, dayNumber: 1, answers: [{ wordId: "wDUP", isCorrect: false }] } },
    { id: "h2", data: { studentId: "uH", classId: "cls1", listId: "LB", sessionType: "review", submittedAt: TS(95 * DAY), graded: true, score: 100, totalQuestions: 1, dayNumber: 1, answers: [{ wordId: "wDUP", isCorrect: true }] } });
  const cen = {}; const cc = { note: nm => { cen[nm] = (cen[nm] || 0) + 1; }, bump: () => {} };
  const h = await computeStudentLabels(fakeDb, "uH", 120 * DAY, cc);
  const a = h.wordsOut["LA|wDUP"], b = h.wordsOut["LB|wDUP"];
  ok(JSON.stringify(a) === JSON.stringify(b), "A8 merge: both list keys carry the IDENTICAL merged value");
  ok(a.fc === 1 && a.lf === 90 * DAY, "A8 merge: fc SUMS across lists (the lap-1 fail is kept)");
  ok(a.lc === 95 * DAY && a.lp === 95 * DAY && a.rlt === 95 * DAY, "A8 merge: timestamps take the LATEST (the lap-2 pass)");
  ok(h.wordIdCollisions.length === 0, "A8 merge: the divergence census is EMPTY post-merge (no abort)");
  ok((cen.a8MergedWords || 0) === 1, "A8 merge: the census counts EXACTLY the merged word");
}

// ===== STAGE 10 [r63]: per-field post-flip exemption (A2), chain order (A6), shapes, all-departed no-op =====
{
  const FLIP = 200 * DAY;
  ok(isFieldLiveExempt("reviewLastCorrectAt", { reviewLastCorrectAt: TS(FLIP + 1) }, FLIP) === true, "A2: field with its OWN fresh stamp is exempt");
  ok(isFieldLiveExempt("reviewLastCorrectAt", { reviewLastCorrectAt: TS(FLIP - 1) }, FLIP) === false, "A2: stale field is NOT exempt");
  ok(isFieldLiveExempt("reviewFailCount", { reviewLastCorrectAt: TS(FLIP + 1) }, FLIP) === false, "A2 COUNTEREXAMPLE: a fresh UNRELATED stamp does NOT exempt fc");
  ok(isFieldLiveExempt("reviewFailCount", { reviewLastFailedAt: TS(FLIP + 1) }, FLIP) === false, "r64 A1: fc is NEVER timestamp-exempt — an increment preserves a pre-flip deficit (through-cutoff law only)");
  ok(isFieldLiveExempt("reviewRestingUntil", { reviewRestingUntil: TS(FLIP + 21 * DAY) }, FLIP) === true, "A2: live graduation rru exempt");
  ok(isFieldLiveExempt("reviewRestingUntil", { reviewRestingUntil: TS(FLIP - 1) }, FLIP) === false, "A2: stale rru is a diff");
  ok(isFieldLiveExempt("reviewRestingUntil", { reviewRestingUntil: TS(FLIP + 40 * DAY) }, FLIP) === false, "r64: rogue far-future rru NOT exempt (35d cap)");
  ok(isFieldLiveExempt("reviewLastCorrectAt", { reviewLastCorrectAt: TS(Date.now() + 3600e3) }, FLIP) === false, "r64: rogue future-dated event stamp NOT self-exempting");
}
{
  const fakeL = w => ({ base: { manifest: { watermark: w } } });
  throws(() => assertLayerChainOrder([fakeL(W1), fakeL(W1)]), "strictly increasing", "A6: equal layer watermarks die (resolver tie impossible)");
  throws(() => assertLayerChainOrder([fakeL(W2), fakeL(W1)]), "strictly increasing", "A6: descending chain dies");
  let okOrder = true; try { assertLayerChainOrder([fakeL(W1), fakeL(W2)]); } catch { okOrder = false; }
  ok(okOrder, "A6: strictly increasing chain passes");
}
{ // A6: row shape — a row missing challengeDigest is baseline corruption
  const dir = join(root, "n7");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ uid: "uA", epochByList: {}, words: {} });
  const jsonl = line + "\n";
  const summary = JSON.stringify({ probe: "b1-summary" });
  writeFileSync(join(dir, "b1-expected-labels-full.jsonl"), jsonl);
  writeFileSync(join(dir, "b1-expected-labels-full.json"), summary);
  writeFileSync(join(dir, "b1-manifest.json"), JSON.stringify({ probe: "b1-expected-labels", version: 6, mode: "full", watermark: W0,
    jsonlSha256: createHash("sha256").update(jsonl).digest("hex"), summarySha256: createHash("sha256").update(summary).digest("hex") }));
  throws(() => loadVerifiedBaseline(join(dir, "b1-manifest.json")), "challengeDigest", "A6: malformed row shape dies");
}
{ // A6: departed must be a SUBSET of the auth uids
  const dir = join(root, "n8");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "delta-auth.json"), authBytes);
  writeBaselineDir(dir, "delta", W1, rows1, {
    parentOriginalManifestSha256: original.manifestSha256,
    parentDeltaAuthSha256: createHash("sha256").update(authBytes).digest("hex"),
    departedUids: [...departed, "uZ"],
  });
  throws(() => loadDeltaLayer(dir, original.manifestSha256, W0), "not in delta-auth", "A6: non-auth departed uid dies");
}
{ // A6: the ALL-DEPARTED layer is an auditable NO-OP, not a brick — zero rows, all excused
  const dir = join(root, "n9");
  mkdirSync(dir, { recursive: true });
  const authAll = { probe: "b4-delta", version: 2, baselineManifestSha256: original.manifestSha256, uids: ["uB", "uC"] };
  const authAllBytes = JSON.stringify(authAll, null, 2);
  writeFileSync(join(dir, "delta-auth.json"), authAllBytes);
  writeBaselineDir(dir, "delta", W1, {}, {
    parentOriginalManifestSha256: original.manifestSha256,
    parentDeltaAuthSha256: createHash("sha256").update(authAllBytes).digest("hex"),
    departedUids: ["uB", "uC"],
  });
  const L = loadDeltaLayer(dir, original.manifestSha256, W0);
  ok(L.base.rows.size === 0, "A6: all-departed empty layer loads (chain converges via departure, not a fatal)");
}
{ // A6: duplicate uids inside delta-auth die
  const dir = join(root, "n10");
  mkdirSync(dir, { recursive: true });
  const authDup = { probe: "b4-delta", version: 2, baselineManifestSha256: original.manifestSha256, uids: ["uB", "uB"] };
  const authDupBytes = JSON.stringify(authDup, null, 2);
  writeFileSync(join(dir, "delta-auth.json"), authDupBytes);
  writeBaselineDir(dir, "delta", W1, rows1, {
    parentOriginalManifestSha256: original.manifestSha256,
    parentDeltaAuthSha256: createHash("sha256").update(authDupBytes).digest("hex"),
    departedUids: [],
  });
  throws(() => loadDeltaLayer(dir, original.manifestSha256, W0), "duplicates", "A6: duplicate delta-auth uids die");
}

console.log(JSON.stringify({ probe: "delta-chain-fixture", checks, failures, root }, null, 2));
process.exit(failures ? 1 : 0);

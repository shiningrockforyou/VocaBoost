// b-baseline.mjs — shared VERIFIED-BASELINE loading + delta-chain resolution for B3/B4 [r60 closure #1/#3].
// One loader, one chain law: FULL(M0) → B4 delta-auth(DA) → B1 --deltaAuth fresh-watermark delta(M1)
// [r62p — the --uids path is DEAD: it stamps no parent hashes and loadDeltaLayer rejects its output] →
// B3/B4 consume M1 bound to DA bound to M0. Every hop hash-verified; nothing optional.
import { readFileSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// r65 [Codex r64 A6]: ONE artifact root — DEEPFIX_AUDIT_ROOT redirects every baseline/ledger/run path
// (the emulator lap runs in an ISOLATED root and can never touch the shared forensic chain).
export function auditRoot() {
  const env = process.env.DEEPFIX_AUDIT_ROOT;
  if (env) return pathToFileURL(env.replace(/\\/g, "/").replace(/\/?$/, "/"));
  return new URL("../../audit/deepfix/trackB_baselines/", import.meta.url);
}

export function sha256File(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

// r62p [panel D3]: a FUTURE watermark is hash-consistent and yields a FALSE PASS (attempts land "before" a
// boundary that hasn't arrived — the final B4 sees no newAttempts). One understood schema, one sane clock.
const CLOCK_SKEW_MS = 5 * 60e3;
function validateManifestCommon(manifest) {
  if (manifest.probe !== "b1-expected-labels") throw new Error("manifest.probe mismatch");
  if (manifest.version !== 6) throw new Error(`baseline version ${manifest.version} ≠ 6 (one understood schema [r62p])`);
  const w = manifest.watermark;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) throw new Error("manifest watermark missing/non-finite [r62p]");
  if (w > Date.now() + CLOCK_SKEW_MS) throw new Error(`manifest watermark ${new Date(w).toISOString()} is in the FUTURE — false-PASS hazard [r62p]`);
}

// r63/r64 A2+A1: THE PER-FIELD POST-FLIP EXEMPTION — a doc-wide skip let one fresh stamp hide a stale/
// corrupt UNTOUCHED field. A mismatched TIMESTAMP field is exempt ONLY if that field itself proves live
// ownership (its actual value ≥ flipTs — last-write semantics make the flip-boundary expectation
// legitimately superseded). **reviewFailCount is NEVER exempt here [r64 — Codex A1]: a counter INCREMENTS;
// a fresh reviewLastFailedAt proves fc was TOUCHED post-flip, not that its pre-increment base was correct
// (an omitted pre-flip tail survives every post-flip increment). fc is verified by the THROUGH-CUTOFF law
// instead: expected = a SECOND replay at a captured cutoff (which includes post-flip attempts), compared
// exactly — see B4 --postFlip.** Corrupt-typed values are NEVER exempt.
export function isFieldLiveExempt(field, cur, flipTs) {
  if (!cur || !flipTs) return false;
  if (field === "reviewFailCount") return false; // cumulative — through-cutoff law only [r64]
  const ms = cur[field]?.toMillis?.();
  if (typeof ms !== "number" || ms < flipTs) return false;
  // r64 sanity bound: a rogue FUTURE-dated stamp must not self-exempt — event fields ≤ now+5min;
  // reviewRestingUntil is legitimately future (graduation+21d) so its bound is flip+35d
  const cap = field === "reviewRestingUntil" ? flipTs + 35 * 86400e3 : Date.now() + 300e3;
  return ms <= cap;
}

// r62p [panel D2]: THE rosterAdded LAW — a live uid is rosterAdded ONLY while covered by NEITHER the
// original NOR any applied layer. (Original-only made every post-baseline joiner a permanent non-PASS loop.)
// r63 A6: EXACT row shape — a malformed row is baseline corruption, never a silent undefined downstream
export function validateRowShape(r) {
  if (typeof r.uid !== "string" || !r.uid) throw new Error("baseline row lacks a nonempty string uid");
  if (typeof r.epochByList !== "object" || r.epochByList === null || Array.isArray(r.epochByList)) throw new Error(`row ${r.uid}: epochByList not an object`);
  if (typeof r.challengeDigest !== "string" || !r.challengeDigest) throw new Error(`row ${r.uid}: challengeDigest missing`);
  if (typeof r.words !== "object" || r.words === null || Array.isArray(r.words)) throw new Error(`row ${r.uid}: words not an object`);
}

export function isRosterAdded(uid, original, deltaLayers) {
  if (original.rows.has(uid)) return false;
  for (const L of deltaLayers) if (L.base.rows.has(uid)) return false;
  return true;
}

// r62 BOUNDED MEMORY: same verification as loadVerifiedBaseline, but rows are an OFFSET INDEX — the JSONL
// is hashed once (transient buffer), then each row is parsed on demand from its byte range. Steady-state
// memory = the {uid → [offset,len]} index, not 947 full word maps. The facade quacks like the eager Map
// (get/has/keys/size) so resolveExpectedSource and scope checks work unchanged.
export function loadVerifiedBaselineIndexed(manifestPath, { requireMode = null } = {}) {
  manifestPath = manifestPath.replace(/\\/g, "/"); // Windows path coverage [r62]
  if (!existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  validateManifestCommon(manifest);
  if (requireMode && manifest.mode !== requireMode) throw new Error(`baseline mode '${manifest.mode}' ≠ required '${requireMode}'`);
  const dir = manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1);
  const jsonlPath = `${dir}b1-expected-labels-${manifest.mode}.jsonl`;
  const sumPath = `${dir}b1-expected-labels-${manifest.mode}.json`;
  let buf = readFileSync(jsonlPath);
  if (createHash("sha256").update(buf).digest("hex") !== manifest.jsonlSha256) throw new Error("JSONL hash mismatch");
  if (!manifest.summarySha256) throw new Error("manifest lacks summarySha256");
  if (createHash("sha256").update(readFileSync(sumPath)).digest("hex") !== manifest.summarySha256) throw new Error("summary hash mismatch");
  const index = new Map();
  let pos = 0;
  while (pos < buf.length) {
    let nl = buf.indexOf(0x0a, pos);
    if (nl === -1) nl = buf.length;
    if (nl > pos) {
      // r64 [Codex B2]: EAGER envelope validation — a malformed row must die at load, not lurk behind a
      // departed uid that keys() enumerates but get() never fetches (transient parse; nothing retained)
      const r = JSON.parse(buf.toString("utf-8", pos, nl));
      validateRowShape(r);
      if (index.has(r.uid)) throw new Error(`duplicate uid row in baseline: ${r.uid}`);
      index.set(r.uid, [pos, nl - pos]);
    }
    pos = nl + 1;
  }
  buf = null; // release — from here on, rows come off disk by byte range
  const fd = openSync(jsonlPath, "r");
  const rows = {
    get(uid) {
      const e = index.get(uid);
      if (!e) return undefined;
      const b = Buffer.allocUnsafe(e[1]);
      readSync(fd, b, 0, e[1], e[0]);
      const r = JSON.parse(b.toString("utf-8"));
      validateRowShape(r); // r63 A6
      return r;
    },
    has(uid) { return index.has(uid); },
    keys() { return index.keys(); },
    get size() { return index.size; },
    close() { try { closeSync(fd); } catch {} }, // r63: releases the byte-range fd (long-lived callers)
  };
  return { manifest, rows, manifestSha256: sha256File(manifestPath), dir, indexed: true };
}

export function loadVerifiedBaseline(manifestPath, { requireMode = null } = {}) {
  manifestPath = manifestPath.replace(/\\/g, "/"); // Windows path coverage [r62]
  if (!existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  validateManifestCommon(manifest);
  if (requireMode && manifest.mode !== requireMode) throw new Error(`baseline mode '${manifest.mode}' ≠ required '${requireMode}'`);
  const dir = manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1);
  const jsonlPath = `${dir}b1-expected-labels-${manifest.mode}.jsonl`;
  const sumPath = `${dir}b1-expected-labels-${manifest.mode}.json`;
  const jsonlRaw = readFileSync(jsonlPath);
  if (createHash("sha256").update(jsonlRaw).digest("hex") !== manifest.jsonlSha256) throw new Error("JSONL hash mismatch");
  if (!manifest.summarySha256) throw new Error("manifest lacks summarySha256");
  if (createHash("sha256").update(readFileSync(sumPath)).digest("hex") !== manifest.summarySha256) throw new Error("summary hash mismatch");
  const rows = new Map();
  for (const ln of jsonlRaw.toString().split("\n")) {
    if (!ln) continue; const r = JSON.parse(ln);
    validateRowShape(r);
    if (rows.has(r.uid)) throw new Error(`duplicate uid row in baseline: ${r.uid}`);
    rows.set(r.uid, r);
  }
  return { manifest, rows, manifestSha256: sha256File(manifestPath), dir };
}

// A delta LAYER = {dir} containing: delta-auth.json (B4-emitted, binds to the ORIGINAL manifest) +
// b1-manifest-delta.json (the fresh-watermark B1 --deltaAuth artifacts — parent-hash-stamped [r64: the
// --uids path is deleted]).
export function loadDeltaLayer(dir, originalManifestSha256, originalWatermark = 0) {
  const d = dir.replace(/\\/g, "/").replace(/\/?$/, "/"); // Windows path coverage [r62]
  const authPath = `${d}delta-auth.json`;
  if (!existsSync(authPath)) throw new Error(`delta-auth.json missing in ${dir}`);
  const authRaw = readFileSync(authPath);
  const auth = JSON.parse(authRaw.toString());
  if (auth.probe !== "b4-delta") throw new Error("delta-auth probe mismatch");
  if (auth.version !== 2) throw new Error("delta-auth version ≠ 2 (one understood schema [r62p])");
  // r63 A6: exact DA shape — unique nonempty string uids
  if (!Array.isArray(auth.uids) || !auth.uids.length) throw new Error("delta-auth uids missing/empty");
  if (!auth.uids.every(u => typeof u === "string" && u)) throw new Error("delta-auth uids must be nonempty strings");
  if (new Set(auth.uids).size !== auth.uids.length) throw new Error("delta-auth uids contain duplicates");
  if (auth.baselineManifestSha256 !== originalManifestSha256) throw new Error("delta-auth is bound to a DIFFERENT original baseline");
  const base = loadVerifiedBaseline(`${d}b1-manifest-delta.json`, { requireMode: "delta" });
  // r62: BOTH parent hashes stamped by B1 --deltaAuth and verified here — mispaired stale artifacts die
  if (base.manifest.parentOriginalManifestSha256 !== originalManifestSha256) throw new Error("delta baseline's parentOriginalManifestSha256 ≠ the original");
  const authSha = createHash("sha256").update(authRaw).digest("hex");
  if (base.manifest.parentDeltaAuthSha256 !== authSha) throw new Error("delta baseline's parentDeltaAuthSha256 ≠ this delta-auth.json");
  const departedRaw = base.manifest.departedUids || [];
  // r63 A6: departed law shape — strings, unique, and a SUBSET of the auth uids
  if (!Array.isArray(departedRaw) || !departedRaw.every(u => typeof u === "string" && u)) throw new Error("departedUids must be an array of nonempty strings");
  if (new Set(departedRaw).size !== departedRaw.length) throw new Error("departedUids contain duplicates");
  const authSet = new Set(auth.uids);
  for (const u of departedRaw) if (!authSet.has(u)) throw new Error(`departed uid ${u} is not in delta-auth (not an excusal authority)`);
  const departed = new Set(departedRaw);
  const expectUids = new Set(auth.uids.filter(u => !departed.has(u)));
  const baseUids = new Set(base.rows.keys());
  if (expectUids.size !== baseUids.size || ![...expectUids].every(u => baseUids.has(u)))
    throw new Error("delta baseline uid-set ≠ (delta-auth uids − departed) [roster-churn law, r62]");
  if (!(base.manifest.watermark > originalWatermark)) throw new Error(`delta watermark ${base.manifest.watermark} must EXCEED the original ${originalWatermark} [r62 — ≤ silently no-ops]`);
  return { auth, base, authSha };
}

// r66 [Codex r65 A3]: THE ONE STRICT LEDGER REDUCER — B4's audit and B3's repair-reality scan consume the
// SAME law: malformed/unknown/versionless/outcome-less lines THROW; per runId the LATEST attempt must have
// a clean completion; applied layer shas are collected for coverage checks.
export function parseLedgerStrict(text, originalManifestSha256, opts = {}) {
  const intents = new Map(); const applieds = new Map(); const latestAttempt = new Map();
  const ordered = []; // r68: record order IS custody order — the overtake law needs positions
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]; if (!ln.trim()) continue;
    let e; try { e = JSON.parse(ln); } catch { throw new Error(`malformed line ${i + 1}`); }
    if (e.probe !== "b3-intent" && e.probe !== "b3-applied") throw new Error(`unknown probe '${e.probe}' line ${i + 1}`);
    if (e.version !== 1) throw new Error(`record version ${e.version} ≠ 1 at line ${i + 1}`);
    if (!Number.isInteger(e.attempt)) throw new Error(`record lacks integer attempt at line ${i + 1}`);
    if (e.originalManifestSha256 !== originalManifestSha256) continue;
    const key = `${e.runId}#${e.attempt}`;
    if (e.probe === "b3-intent") intents.set(key, e);
    else {
      const o = e.outcome;
      if (typeof o !== "object" || o === null) throw new Error(`completion lacks outcome at line ${i + 1}`);
      for (const cf of ["txnFailures", "skippedResetLocked", "skippedEpochDrift"]) {
        if (!Number.isInteger(o[cf]) || o[cf] < 0) throw new Error(`completion counter ${cf} must be a non-negative integer at line ${i + 1} [r69 — strings/NaN/negatives evaded the arithmetic checks]`);
      }
      // r68 [Codex r67 A2 — truthiness was fail-open]: EXACT terminal schema. cutoverAborted must be the
      // literal boolean true; a terminal completion must bind to ITS OWN intent's identity (same key, same
      // delta sha) — a contradictory or unknown terminal shape is ledger corruption, not leniency.
      if ("cutoverAborted" in o && o.cutoverAborted !== true) throw new Error(`non-boolean cutoverAborted at line ${i + 1} (exact schema [r68])`);
      if (o.cutoverAborted === true) {
        const intent = intents.get(key);
        if (!intent) throw new Error(`cutover completion without its intent at line ${i + 1}`);
        if ((intent.deltaManifestSha256 ?? null) !== (e.deltaManifestSha256 ?? null)) throw new Error(`cutover completion delta-sha ≠ its intent's at line ${i + 1}`);
      }
      applieds.set(key, e);
    }
    ordered.push({ key, runId: e.runId, attempt: e.attempt, probe: e.probe, deltaManifestSha256: e.deltaManifestSha256 ?? null, cutoverAborted: e.probe === "b3-applied" ? e.outcome?.cutoverAborted === true : false, line: i + 1 });
    latestAttempt.set(e.runId, Math.max(latestAttempt.get(e.runId) ?? -1, e.attempt));
  }
  const problems = []; const orphans = []; const appliedLayerShas = new Set(); const cutoverRuns = [];
  for (const [runId, att] of latestAttempt) {
    const key = `${runId}#${att}`;
    const done = applieds.get(key);
    if (!done) {
      // r68 [cutover NEW-2 — crash-then-flip bricked the gate]: under postFlip, a dangling intent is
      // TERMINAL-BY-FLIP (B3 is forbidden forever) — published as an ORPHAN, settled by the gate's
      // tail/diffs law, never a fatal problem. Pre-flip it remains a blocking problem (resume it).
      if (opts.postFlip) orphans.push({ runId, attempt: att, deltaManifestSha256: intents.get(key)?.deltaManifestSha256 ?? null });
      else problems.push(`${runId} attempt ${att}: intent without completion (crash mid-run? resume it)`);
      continue;
    }
    const o = done.outcome;
    if (o.cutoverAborted === true) {
      // r68 [cutover NEW-3 — fabricated zeros hid pre-abort failures]: terminal, but its REAL counts are
      // SURFACED (cutoverRuns), never clean-skipped into silence.
      cutoverRuns.push({ runId, attempt: att, outcome: o, deltaManifestSha256: done.deltaManifestSha256 ?? null });
      continue;
    }
    if ((o.txnFailures || 0) + (o.skippedResetLocked || 0) + (o.skippedEpochDrift || 0) > 0) {
      // r69 [accuracy NEW-2 — the asymmetric brick]: post-flip NOTHING can resume — a failed/skipped
      // latest completion becomes a PUBLISHED orphan disposition (counts surfaced), never a fatal.
      if (opts.postFlip) orphans.push({ runId, attempt: att, deltaManifestSha256: done.deltaManifestSha256 ?? null, outcome: o });
      else problems.push(`${runId} attempt ${att}: latest completion has failures/skips — resume to a clean completion`);
    }
  }
  for (const [, e] of applieds) if (e.deltaManifestSha256 && e.outcome?.cutoverAborted !== true) appliedLayerShas.add(e.deltaManifestSha256);
  return { problems, orphans, cutoverRuns, appliedLayerShas, intents, applieds, latestAttempt, ordered };
}

// r67 [Codex r66 A4]: THE LEASE-STATE LAW, pure — EPERM (exists-but-unsignalable) is ALIVE-equivalent and
// NEVER reaped at any age; only a provably-dead holder (ESRCH), or an aged lease with NO usable identity
// (missing/malformed pid), is stale. probe(pid) returns "alive" | "dead" | "eperm".
export function assessLease(holder, probe, nowMs, agedMs = 2 * 3600e3, mtimeMs = null) {
  // r68 [Codex r67 B1 + cutover NEW-5]: an UNPARSEABLE lease follows the same aged law (age from the file
  // mtime when content is unreadable) — never instantly stale; pid must be a POSITIVE integer to count as
  // identity (pid ≤ 0 is kernel-special and unprobeable — no-identity, not permanently-owned).
  if (!holder || typeof holder !== "object") {
    const aged = mtimeMs != null ? nowMs - mtimeMs > agedMs : true;
    return { stale: aged, reason: aged ? "aged-unparseable" : "fresh-unparseable" };
  }
  const aged = nowMs - (holder.at || 0) > agedMs;
  if (!Number.isInteger(holder.pid) || holder.pid <= 0) return { stale: aged, reason: aged ? "aged-no-identity" : "fresh-no-identity" };
  const p = probe(holder.pid);
  if (p === "dead") return { stale: true, reason: "dead" };
  return { stale: false, reason: p === "eperm" ? "eperm-owned" : "alive" }; // EPERM owned FOREVER [r67]
}

// r63 A6: THE CHAIN ORDER LAW — applied layers must be STRICTLY INCREASING in watermark (equal watermarks
// would make per-uid resolution depend on CLI argument order via the resolver's >=).
export function assertLayerChainOrder(deltaLayers) {
  for (let i = 1; i < deltaLayers.length; i++)
    if (!(deltaLayers[i].base.manifest.watermark > deltaLayers[i - 1].base.manifest.watermark))
      throw new Error(`applied-delta chain not strictly increasing at position ${i} (${deltaLayers[i - 1].base.manifest.watermark} → ${deltaLayers[i].base.manifest.watermark}) — pass layers in application order [r63 A6]`);
}

// Per-uid resolution across the chain: the LATEST delta layer containing the uid wins; else the original.
export function resolveExpectedSource(uid, original, deltaLayers) {
  let chosen = { row: original.rows.get(uid) ?? null, watermark: original.manifest.watermark, layer: "original" };
  for (let i = 0; i < deltaLayers.length; i++) {
    const L = deltaLayers[i];
    if (L.base.rows.has(uid) && L.base.manifest.watermark >= chosen.watermark)
      chosen = { row: L.base.rows.get(uid), watermark: L.base.manifest.watermark, layer: `delta${i}` };
  }
  return chosen;
}

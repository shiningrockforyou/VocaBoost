// b-baseline.mjs — shared VERIFIED-BASELINE loading + delta-chain resolution for B3/B4 [r60 closure #1/#3].
// One loader, one chain law: FULL(M0) → B4 delta-auth(DA) → B1 --deltaAuth fresh-watermark delta(M1)
// [r62p — the --uids path is DEAD: it stamps no parent hashes and loadDeltaLayer rejects its output] →
// B3/B4 consume M1 bound to DA bound to M0. Every hop hash-verified; nothing optional.
import { readFileSync, existsSync, openSync, readSync } from "node:fs";
import { createHash } from "node:crypto";

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

// r62p [panel D2]: THE rosterAdded LAW — a live uid is rosterAdded ONLY while covered by NEITHER the
// original NOR any applied layer. (Original-only made every post-baseline joiner a permanent non-PASS loop.)
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
      const head = buf.toString("utf-8", pos, Math.min(pos + 256, nl));
      const m = head.match(/^\{"uid":"([^"]+)"/);
      const uid = m ? m[1] : JSON.parse(buf.toString("utf-8", pos, nl)).uid;
      if (index.has(uid)) throw new Error(`duplicate uid row in baseline: ${uid}`);
      index.set(uid, [pos, nl - pos]);
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
      return JSON.parse(b.toString("utf-8"));
    },
    has(uid) { return index.has(uid); },
    keys() { return index.keys(); },
    get size() { return index.size; },
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
  for (const ln of jsonlRaw.toString().split("\n")) { if (!ln) continue; const r = JSON.parse(ln); if (rows.has(r.uid)) throw new Error(`duplicate uid row in baseline: ${r.uid}`); rows.set(r.uid, r); }
  return { manifest, rows, manifestSha256: sha256File(manifestPath), dir };
}

// A delta LAYER = {dir} containing: delta-auth.json (B4-emitted, binds to the ORIGINAL manifest) +
// b1-manifest-delta.json (the fresh-watermark B1 --uids artifacts).
export function loadDeltaLayer(dir, originalManifestSha256, originalWatermark = 0) {
  const d = dir.replace(/\\/g, "/").replace(/\/?$/, "/"); // Windows path coverage [r62]
  const authPath = `${d}delta-auth.json`;
  if (!existsSync(authPath)) throw new Error(`delta-auth.json missing in ${dir}`);
  const authRaw = readFileSync(authPath);
  const auth = JSON.parse(authRaw.toString());
  if (auth.probe !== "b4-delta") throw new Error("delta-auth probe mismatch");
  if (auth.version !== 2) throw new Error("delta-auth version ≠ 2 (one understood schema [r62p])");
  if (auth.baselineManifestSha256 !== originalManifestSha256) throw new Error("delta-auth is bound to a DIFFERENT original baseline");
  const base = loadVerifiedBaseline(`${d}b1-manifest-delta.json`, { requireMode: "delta" });
  // r62: BOTH parent hashes stamped by B1 --deltaAuth and verified here — mispaired stale artifacts die
  if (base.manifest.parentOriginalManifestSha256 !== originalManifestSha256) throw new Error("delta baseline's parentOriginalManifestSha256 ≠ the original");
  const authSha = createHash("sha256").update(authRaw).digest("hex");
  if (base.manifest.parentDeltaAuthSha256 !== authSha) throw new Error("delta baseline's parentDeltaAuthSha256 ≠ this delta-auth.json");
  const departed = new Set(base.manifest.departedUids || []);
  const expectUids = new Set(auth.uids.filter(u => !departed.has(u)));
  const baseUids = new Set(base.rows.keys());
  if (expectUids.size !== baseUids.size || ![...expectUids].every(u => baseUids.has(u)))
    throw new Error("delta baseline uid-set ≠ (delta-auth uids − departed) [roster-churn law, r62]");
  if (!(base.manifest.watermark > originalWatermark)) throw new Error(`delta watermark ${base.manifest.watermark} must EXCEED the original ${originalWatermark} [r62 — ≤ silently no-ops]`);
  return { auth, base, authSha };
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

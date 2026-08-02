// b3-txn-core.mjs — THE PHASE-2 CHUNK TRANSACTION LAW, extracted [r62p — the twice-demanded r61-A3 race
// fixture needs THE code under test, not a replica]. B3 calls this inside db.runTransaction; the fixture
// calls it with a fake txn. Injection-free of firebase-admin: Timestamp/FieldValue come in via ctx.
//
// LAW (H6 §9 letter): ALL READS FIRST — both tombstone collections (lock + EPOCH re-check against the
// phase-1 snapshot [r62p — a reset that completed and CLEARED its lock between phases must still abort]),
// then the chunk's target docs; THEN writes, each re-diffed against the txn-read state (recompute-or-abort —
// a stale phase-1 plan value that no longer diffs writes nothing; the plan is a hint, never authority).
// Throws "RESET_LOCKED" on a live lock, "EPOCH_DRIFT" on any snapshot list whose resetEpoch/resetAt
// advanced. Returns counts — the CALLER applies them AFTER commit (SDK retries re-execute this function;
// counts applied inside would inflate the audited result [r62p NEW-3]).
export const CHUNK_SIZE = 300; // writes/txn — headroom under Firestore's 500-op limit

export async function applyChunkInTxn(txn, ctx) {
  const { tombstoneQueries, chunk, targetRef, expectedEpochByList, Timestamp, FieldValue, readCurrent, configRef } = ctx;
  const out = { written: 0, fieldSets: 0, fieldDeletes: 0, verifiedEqual: 0 };
  // ---- reads: THE ACTIVATION BARRIER [r66 — the flip txn and this chunk serialize on the config doc] ----
  if (configRef) {
    const cfg = await txn.get(configRef);
    if (cfg.exists && (cfg.data().firstEnabledAt || cfg.data().enabled === true)) throw new Error("FLIP_DURING_RUN");
  }
  // ---- reads: tombstones (lock + epoch) ----
  const epochNow = {};
  for (const q of tombstoneQueries) {
    const snap = await txn.get(q);
    for (const d of snap.docs) {
      const v = d.data();
      if (v.resetInProgress) throw new Error("RESET_LOCKED");
      const cur = epochNow[d.id] || { resetEpoch: 0, resetAt: null };
      epochNow[d.id] = {
        resetEpoch: Math.max(cur.resetEpoch, v.resetEpoch ?? 0),
        resetAt: Math.max(cur.resetAt ?? 0, v.resetAt?.toMillis?.() ?? 0) || null,
      };
    }
  }
  for (const [listId, snapVal] of Object.entries(expectedEpochByList || {})) {
    const now = epochNow[listId] || { resetEpoch: 0, resetAt: null };
    if (now.resetEpoch > (snapVal.resetEpoch ?? 0) || (now.resetAt ?? 0) > (snapVal.resetAt ?? 0))
      throw new Error("EPOCH_DRIFT");
  }
  // ---- reads: targets ----
  const refs = chunk.map(p => targetRef(p.wordId));
  const docs = await txn.getAll(...refs);
  // ---- writes: re-diff against txn-read state ----
  for (let j = 0; j < chunk.length; j++) {
    const p = chunk[j]; const doc = docs[j];
    const cur = doc.exists ? doc.data() : null;
    const sets = {}; const deletes = [];
    const expected = { ...p.sets };
    for (const f of p.deletes) expected[f] = null;
    for (const [f, expMs] of Object.entries(expected)) {
      const { v: act, corrupt } = readCurrent(cur, f);
      if (!corrupt && act === expMs) continue;
      if (expMs === null) { if (doc.exists) deletes.push(f); }
      else sets[f] = f === "reviewFailCount" ? expMs : Timestamp.fromMillis(expMs);
    }
    if (!Object.keys(sets).length && !deletes.length) { out.verifiedEqual++; continue; }
    const update = { ...sets };
    for (const f of deletes) update[f] = FieldValue.delete();
    out.fieldSets += Object.keys(sets).length; out.fieldDeletes += deletes.length;
    if (doc.exists) txn.update(doc.ref ?? refs[j], update);
    else txn.set(doc.ref ?? refs[j], sets);
    out.written++;
  }
  return out;
}

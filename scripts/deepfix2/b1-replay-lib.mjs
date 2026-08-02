// b1-replay-lib.mjs — THE ONE REPLAY LAW (shared by B1/B3/B4 so implementations can never drift) [r57 closure].
// Faithful extraction of B1 v5's per-student computation: eligibility fence → duplicate law → replay →
// labels + legacyResting census + mutationRisk + epoch snapshot. Laws: R2-35 stored>=92 · B1-Q1 uniform
// types · B1-Q2 review-type clock, null⇒not-written · r48 fail-closed fence · whole-group dup exclusion ·
// teacher-edit preOverride law · watermark per-attempt boundary · real tombstones.
// [r62p] reviewRestingUntil is LIVE-ONLY (r59-A9 FINAL): wordsOut = FIVE fields; the legacyResting census is
// informational transient-sizing only — it never enters expected state and no consumer writes rru from it.
import { createHash } from "node:crypto";

export const THRESHOLD = 92;
export const EXCL_KEYS = ["missingCoreField","postWatermark","unknownType","ungraded","badScore","badTotal","badRows","dupWordIdInRows","rowsGtTotal","scoreRowsDisagree","dupConflictGroup","preEpoch","editedNoOrganicScore"];

// counters: an object with bump(reason, classId, sigKey) — the caller owns aggregation.
export async function computeStudentLabels(db, uid, watermark, counters) {
  const bump = counters?.bump || (() => {});
  const note = counters?.note || (() => {});
  // ---- epoch snapshot (real tombstones) ----
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
  const snap = await db.collection("attempts").where("studentId", "==", uid).get();
  // ---- pass 1: fence + grouping (challenge scan FIRST, pre-fence) ----
  const groups = new Map();
  const mut = { pendingChallenges: 0, adjudicatedTotal: 0, adjudicatedAtOrAfterWatermark: 0, challengeTsUnknown: 0, challengedAttemptIds: [], challengedAttemptIdsTruncated: false, _digestRows: [] };
  for (const d of snap.docs) {
    const a = d.data(); note("attemptsSeen");
    if (Array.isArray(a.answers)) for (const r of a.answers) {
      if (!r || !r.challengeStatus) continue;
      if (r.challengeStatus === "pending") mut.pendingChallenges++;
      else {
        mut.adjudicatedTotal++;
        const rt = r.challengeReviewedAt?.toMillis?.() ?? (typeof r.challengeReviewedAt === "string" ? Date.parse(r.challengeReviewedAt) : typeof r.challengeReviewedAt === "number" ? r.challengeReviewedAt : NaN);
        if (Number.isFinite(rt)) { if (rt >= watermark) mut.adjudicatedAtOrAfterWatermark++; }
        else mut.challengeTsUnknown++;
        // r65 [Codex A2]: the r64 word-level exemption census is DELETED — under the adjudication law
        // (fc/lf grading-time, lc/lp effective) an accept changes only fields the live txn stamps ≥ flip
        // (timestamp-exempt on their own) or fc via the through-cutoff replay; no word skip exists.
      }
      if (!mut.challengedAttemptIds.includes(d.id)) {
        if (mut.challengedAttemptIds.length < 200) mut.challengedAttemptIds.push(d.id);
        else mut.challengedAttemptIdsTruncated = true;
      }
      // A1: per-row adjudication facts feed the CHALLENGE DIGEST (order-insensitive; detects in-place
      // adjudications of OLD attempts that submittedAt can never reveal)
      mut._digestRows.push(`${d.id}|${r.wordId ?? "?"}|${r.challengeStatus}|${r.challengeReviewedAt?.toMillis?.() ?? String(r.challengeReviewedAt ?? "")}`);
    }
    const classId = typeof a.classId === "string" ? a.classId : null;
    if (typeof a.submittedAt?.toMillis !== "function" || typeof a.listId !== "string" || !a.listId || !classId) { bump("missingCoreField", classId); continue; }
    const t = a.submittedAt.toMillis();
    if (typeof t !== "number" || !Number.isFinite(t)) { bump("missingCoreField", classId); continue; }
    if (t >= watermark) { bump("postWatermark", classId, `${classId}|${a.listId}`); continue; }
    const sType = a.sessionType ?? a.type ?? null;
    if (sType !== "new" && sType !== "review" && sType !== "retest") { bump("unknownType", classId, `${classId}|${a.listId}|${sType}`); continue; }
    // A9 exact synthetic shape: the ONLY manualOverride exception is the known CS anchor
    // (graded:true, sessionType 'new', EMPTY answers) — anything else with manualOverride is NOT exempt
    const syntheticAnchor = a.manualOverride === true && a.graded === true && sType === "new" && Array.isArray(a.answers) && a.answers.length === 0;
    if (a.graded !== true && !syntheticAnchor) { bump("ungraded", classId, `${classId}|${a.listId}|${sType}`); continue; }
    if (!Array.isArray(a.answers)) { bump("badRows", classId, `${classId}|${a.listId}|${sType}`); continue; }
    const edited = a.teacherEdited === true;
    const effScoreRaw = edited ? (a.preOverride && typeof a.preOverride.score === "number" ? a.preOverride.score : null) : (a.score ?? a.scorePercent);
    if (edited) note("teacherEditedSeen");
    const epoch = epochByList[a.listId];
    if (epoch?.resetAt && t < epoch.resetAt) { bump("preEpoch", classId, `${classId}|${a.listId}`); continue; }
    const s = effScoreRaw;
    if (edited && s === null) { bump("editedNoOrganicScore", classId, `${classId}|${a.listId}`); continue; }
    const sigKey = `${classId}|${a.listId}|${sType}`;
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 100) { bump("badScore", classId, sigKey); continue; }
    const tq = a.totalQuestions;
    if (!Number.isInteger(tq) || tq <= 0 || tq > 500) { bump("badTotal", classId, sigKey); continue; }
    const rows = [];
    let rowsOk = true, dupRow = false; const seenW = new Set();
    for (const r of a.answers) {
      if (!r || typeof r.wordId !== "string" || !r.wordId || typeof r.isCorrect !== "boolean") { rowsOk = false; break; }
      if (seenW.has(r.wordId)) { rowsOk = false; dupRow = true; break; }
      seenW.add(r.wordId);
      // r66 THE ADJUDICATION-REALITY LAW [Codex r65 A1 — the PRODUCTION accept writers mutate isCorrect in
      // place (foundation.js:2600, db.js:2912), so grading-time truth must be RECOVERED, not assumed]:
      //  - gradedIsCorrect (the dark-build preimage field, H6 §6b) is the grading truth when present;
      //  - LEGACY accepted rows (no preimage): reconstructed as GRADED-WRONG [RATIFIED R2-49, David
      //    2026-08-02 — an accept flipped it, so pre-accept was wrong in ~all cases; counted census];
      //  - closed status enum: pending|accepted|rejected; anything else = counted + treated as rejected;
      //  - okEff (acceptance minting) applies AS-OF the replay boundary: only when challengeReviewedAt is
      //    KNOWN and < watermark (a post-boundary accept must not be visible in a boundary replay);
      //  - accepted mint TIME = challengeReviewedAt (the live txn's stamp time), not the attempt time.
      const st = r.challengeStatus;
      const statusKnown = st === undefined || st === null || st === "pending" || st === "accepted" || st === "rejected";
      if (!statusKnown) note("challengeStatusUnknownEnum");
      const accepted = st === "accepted";
      let gradedOk;
      if (typeof r.gradedIsCorrect === "boolean") gradedOk = r.gradedIsCorrect;
      else if (accepted) { gradedOk = false; note("legacyAcceptedReconstructed"); }
      else gradedOk = r.isCorrect;
      const rvAt = r.challengeReviewedAt?.toMillis?.() ?? (typeof r.challengeReviewedAt === "string" ? Date.parse(r.challengeReviewedAt) : typeof r.challengeReviewedAt === "number" ? r.challengeReviewedAt : NaN); // r67: one parse chain (was NaN for strings here vs Date.parse in the census scan)
      const acceptedEffective = accepted && Number.isFinite(rvAt) && rvAt < watermark;
      if (accepted && !Number.isFinite(rvAt)) note("acceptedNoTimestamp");
      rows.push({ wordId: r.wordId, ok: gradedOk, okEff: gradedOk || acceptedEffective, adjOk: accepted, adjEff: acceptedEffective, mintT: acceptedEffective && !gradedOk ? rvAt : null, adjState: `${st ?? ""}|${Number.isFinite(rvAt) ? rvAt : ""}` });
    }
    if (!rowsOk) { bump(dupRow ? "dupWordIdInRows" : "badRows", classId, sigKey); continue; }
    if (rows.length > tq) { bump("rowsGtTotal", classId, sigKey); continue; }
    // r66: the stored score was RECOMPUTED by the accept writers from EFFECTIVE rows — the fence must
    // compare like with like or every score-correcting acceptance excludes its whole attempt [Codex A1]
    const correctEff = rows.filter(r => r.ok || r.adjOk === true).length; // r67: exact boolean, not a prefix match
    if (rows.length === tq && Math.abs((correctEff / tq) * 100 - s) > 2) { bump("scoreRowsDisagree", classId, sigKey); continue; }
    const sig = `${classId}|${a.listId}|${a.dayNumber ?? a.studyDay}|${sType}|${t}`;
    const content = createHash("sha256").update(s + "|" + tq + "|" + [...rows].sort((x, y) => x.wordId < y.wordId ? -1 : 1).map(r => r.wordId + ":" + r.ok + ":" + (r.adjState ?? "")).join(",")).digest("hex"); // r66: adjudication facts bind duplicate identity
    // r60: the mutation digest covers EVERY replay input — an in-place edit to score/rows/type/total/
    // teacherEdited/preOverride on an OLD attempt changes it, not only challenge metadata
    mut._digestRows.push(`R|${d.id}|${sig}|${content}|${a.teacherEdited === true ? "TE:" + (a.preOverride?.score ?? "") : ""}`);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push({ t, classId, listId: a.listId, type: sType, rows, stored: s, tq, content, sig, synthetic: syntheticAnchor, edited }); // r68: rides to the as-of pin
  }
  for (const g of groups.values()) for (const a of g) if (!epochByList[a.listId]) epochByList[a.listId] = { resetEpoch: 0, resetAt: null };
  // ---- pass 2: duplicate law ----
  const atts = [];
  const local = { identicalDupsDropped: 0, blankUndercount: 0, syntheticAnchorBlanks: 0, eligible: 0 };
  for (const [, g] of groups) {
    const contents = new Set(g.map(x => x.content));
    if (contents.size > 1) { g.forEach(x => bump("dupConflictGroup", x.classId, x.sig)); continue; }
    if (g.length > 1) local.identicalDupsDropped += g.length - 1;
    const a = g[0];
    local.eligible++;
    if (a.rows.length < a.tq) { if (a.synthetic) local.syntheticAnchorBlanks += a.tq - a.rows.length; else local.blankUndercount += a.tq - a.rows.length; }
    atts.push(a);
  }
  atts.sort((x, y) => x.t - y.t);
  // ---- pass 3: replay ----
  const words = new Map();
  for (const a of atts) {
    // r67 [Codex r66 A2 — the reproduced sibling-proof false green]: the STORED score is CURRENT truth
    // (post-adjudication recompute); proof at a historical boundary must use the score AS OF that boundary.
    // When any row's acceptance is post-boundary (adjOk ∧ ¬adjEff), reconstruct: the writers compute
    // round(effectiveCorrect/denominator*100), so the as-of score is deterministic from as-of-effective rows.
    const hasPostBoundaryAccept = a.rows.some(r => r.adjOk === true && r.adjEff !== true);
    // r68 [asof NEW-7]: a teacher-edited attempt's comparator is preOverride.score — boundary-INVARIANT by
    // construction (accepts recompute a.score, never preOverride) — so reconstruction never applies to it
    // (the B1-Q3 letter forbids row-recompute substitution for edited attempts).
    const asOfScore = (hasPostBoundaryAccept && !a.edited)
      ? Math.round((a.rows.filter(r => r.ok || r.adjEff === true).length / a.tq) * 100)
      : a.stored;
    const passing = asOfScore >= THRESHOLD;
    for (const r of a.rows) {
      const k = a.listId + "|" + r.wordId;
      let w = words.get(k);
      if (!w) { w = { fc: 0, lf: null, lc: null, lp: null, rlt: null }; words.set(k, w); }
      // r66: fc/lf from GRADING-TIME truth (ok); lc/lp from EFFECTIVE truth; an acceptance's mint is
      // stamped at challengeReviewedAt (mintT), matching the live accept txn — never at the attempt time
      if (!r.ok) { w.fc++; w.lf = a.t; }
      if (r.okEff ?? r.ok) { const mt = r.mintT ?? a.t; if (w.lc === null || mt > w.lc) w.lc = mt; if (passing && (w.lp === null || mt > w.lp)) w.lp = mt; }
      if (a.type === "review") w.rlt = a.t;
    }
  }
  // ---- legacy-resting census (INFORMATIONAL ONLY [r59-A9/r60 #5]: rru is LIVE-ONLY and appears NOWHERE in
  // the expected state; this census merely sizes the launch transient for the report) ----
  const legacyRestingCensus = { inWindow: 0, expiredUncounted: 0, expiredCountFailed: 0 };
  {
    const cutoff = new Date(watermark - 21 * 86400e3);
    const msnap = await db.collection("users").doc(uid).collection("study_states").where("masteredAt", ">", cutoff).get();
    legacyRestingCensus.inWindow = msnap.size;
    try { legacyRestingCensus.expiredUncounted += (await db.collection("users").doc(uid).collection("study_states").where("masteredAt", "<=", cutoff).count().get()).data().count; }
    catch { legacyRestingCensus.expiredCountFailed++; }
  }
  // ---- canonical output ----
  const wordsOut = {};
  for (const [k, w] of [...words.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1))
    wordsOut[k] = { fc: w.fc, lf: w.lf, lc: w.lc, lp: w.lp, rlt: w.rlt }; // FIVE fields — rru retired [r60]
  const challengeDigest = createHash("sha256").update(mut._digestRows.sort().join("\n")).digest("hex");
  delete mut._digestRows;
  const digest = createHash("sha256").update(JSON.stringify(wordsOut)).digest("hex");
  // A8: cross-list wordId collision census (study_states docId = wordId — two lists sharing a wordId for one
  // student would collapse onto ONE target doc; consumers must abort on divergent expectations)
  const byWordId = new Map();
  for (const k of Object.keys(wordsOut)) { const wid = k.split("|")[1]; if (!byWordId.has(wid)) byWordId.set(wid, []); byWordId.get(wid).push(k); }
  const wordIdCollisions = [...byWordId.entries()].filter(([, ks]) => ks.length > 1)
    .filter(([, ks]) => { const vals = ks.map(k => JSON.stringify(wordsOut[k])); return new Set(vals).size > 1; })
    .map(([wid, ks]) => ({ wordId: wid, keys: ks }));
  return { epochByList, mutationRisk: mut, wordsOut, legacyRestingCensus, local, digest, challengeDigest, wordIdCollisions };
}

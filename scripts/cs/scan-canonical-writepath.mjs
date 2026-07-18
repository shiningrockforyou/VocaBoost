/**
 * CS — post-P4 canonical-emptiness + write-path telemetry probe (READ-ONLY).
 * Resolves Fable round-2 residuals on the P4/D3 cutover:
 *  (1) users/<uid>/list_progress must stay EMPTY while LIST_PROGRESS_CANONICAL=false (the resolver ran 9x — did it write canonical?);
 *  (2) csd_twi_reconciled writer attribution — server (writtenBy=cloud-function, foundation.js:1875) vs legacy client (progressService.js:290);
 *  (3) has the forced-pathway WRITE/hold-csd path executed since cutover? (review_recorded / complete_session_no_evidence / etc.)
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/scan-canonical-writepath.mjs [ISO-cutoff]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const cutoffMs = Date.parse(process.argv[2] || '2026-07-18T08:46:00Z');
const TS = ms => admin.firestore.Timestamp.fromMillis(ms);

const cs = await db.collection('classes').get();
const roster26 = new Set();
cs.forEach(d => { const c = d.data(); if (/26SM/i.test(c.name||'')) (c.studentIds||[]).forEach(u => roster26.add(u)); });

// (1) canonical list_progress across all users (one collectionGroup query)
let lpTotal = 0, lp26 = 0; const lp26Users = {}, lpSamplePaths = [];
try {
  const lp = await db.collectionGroup('list_progress').get();
  lpTotal = lp.size;
  lp.forEach(d => { const uid = d.ref.parent.parent?.id; if (lpSamplePaths.length < 4) lpSamplePaths.push(d.ref.path);
    if (uid && roster26.has(uid)) { lp26++; lp26Users[uid] = (lp26Users[uid]||0)+1; } });
} catch (e) { lpTotal = `ERROR: ${e.message}`; }

// (2)+(3) system_logs since cutoff — writer attribution + write-path events
const snap = await db.collection('system_logs').where('timestamp','>=',TS(cutoffMs)).get();
const disc = x => x.writtenBy || x.source || x.emittedBy || x.origin || (x.details && (x.details.writtenBy||x.details.source)) || '(no-writer-field)';
const csdtwi = { n:0, byWriter:{}, sampleKeys:null };
const writePath = { review_recorded:0, complete_session_no_evidence:0, reset_progress_server:0, challenge_day_advance:0,
                    list_progress_quarantined:0, list_progress_quarantine_candidate:0, anchor_rejected:0, reviewonly_derivation_mismatch:0, review_marker_write_failed:0,
                    day_guard_rejected_session_cleared:0, day_guard_session_clear_FAILED:0 };
snap.forEach(d => { const x = d.data(); const ty = x.type;
  if (ty === 'csd_twi_reconciled') { csdtwi.n++; if (!csdtwi.sampleKeys) csdtwi.sampleKeys = Object.keys(x); const w = disc(x); csdtwi.byWriter[w] = (csdtwi.byWriter[w]||0)+1; }
  if (ty in writePath) writePath[ty]++; });

const out = {
  at: new Date().toISOString(), cutoff: new Date(cutoffMs).toISOString(), roster26: roster26.size,
  canonical_list_progress: { total_global: lpTotal, count_26SM: lp26, per26User: lp26Users, samplePaths: lpSamplePaths,
    VERDICT: lp26 === 0 ? 'PASS — zero canonical 26SM list_progress docs (LIST_PROGRESS_CANONICAL=false honored)' : `REVIEW — ${lp26} canonical 26SM docs present` },
  csd_twi_reconciled_since_cutoff: csdtwi,
  write_path_events_since_cutoff: writePath,
  interpretation: {
    canonical_empty_26SM: lp26 === 0,
    forced_pathway_hold_exercised: writePath.review_recorded > 0,
    any_completeSession_write_evidence: (writePath.review_recorded + writePath.complete_session_no_evidence + writePath.challenge_day_advance + writePath.reset_progress_server) > 0,
    note: 'A successful completeSession advance emits NO system_logs event, so absence of write-path events does NOT prove completions are failing — it means the write/hold-csd path is unexercised OR silently succeeding; the 6-assertion behavioral smoke remains the only certification.'
  }
};
console.log(JSON.stringify(out, null, 2));
writeFileSync('/app/audit/playwright/findings/deepfix_canonical_writepath_postcutover.json', JSON.stringify(out, null, 2));
console.log('\nwrote audit/playwright/findings/deepfix_canonical_writepath_postcutover.json');
process.exit(0);

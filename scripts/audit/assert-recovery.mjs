/**
 * scripts/audit/assert-recovery.mjs — D3.5 recovery-verdict engine (READ-ONLY on sandbox).
 *
 * After a seeded sandbox student is DRIVEN (WinClaude prod-UI tier-3, or the emulator callable tier-1/2), this reads
 * their state back and emits a per-scenario verdict: PASS | FAIL | INVALID_PRECONDITION (D3.5 verdict handling).
 *   - PASS  : the deployed fix recovered the documented broken state as specified.
 *   - FAIL  : a "fixed"-family scenario did NOT recover → regression → STOP + escalate (David).
 *   - INVALID_PRECONDITION : the seed didn't match the broken state, the drive didn't reach the action, or the
 *                            active flag/threshold ≠ the scenario contract → neither pass nor fail; re-seed.
 * For every fixed-family scenario it also requires a SERVER-PATH PROOF (M7): a server-only `system_logs` type, so a
 * green UI that silently ran a legacy path can't read as PASS.
 *
 *   NODE_PATH=/app/node_modules node scripts/audit/assert-recovery.mjs --roster=<a2_clone_roster.json> [--since=<ISO>]
 */
import { readFileSync, writeFileSync } from 'fs';
import admin from 'firebase-admin';
const KEY = process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();
const rosterPath = (process.argv.find(a => a.startsWith('--roster=')) || '').split('=')[1] || '/app/audit/playwright/findings/a2_clone_roster.json';
const sinceMs = Date.parse((process.argv.find(a => a.startsWith('--since=')) || '').split('=')[1] || '') || 0;
if (!sinceMs) console.warn('⚠️  assert-recovery: no --since window → server-path proof counts ALL logs incl. STALE (prior rounds). Pass --since=<ISO run start> to require FRESH proof this round.');

// server-only system_logs types (a client cannot emit these) — the M7 server-path proof set.
const SERVER_ONLY_TYPES = new Set(['resolve_list_progress', 'csd_twi_reconciled', 'review_recorded',
  'day_guard_rejected_session_cleared', 'reset_progress_server', 'complete_session_no_evidence', 'challenge_day_advance']);

async function progressOf(uid, classId, listId) {
  const d = await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get();
  return d.exists ? d.data() : null;
}
async function canonicalCount(uid) {
  const s = await db.collection('users').doc(uid).collection('list_progress').get();
  return s.size;
}
async function serverLogsFor(uid, since) {
  // Query by userId ONLY (no composite index needed). Do NOT add a Firestore
  // .where('timestamp','>=') here: the composite (userId+timestamp) needs an index that isn't
  // deployed, and the FAILED_PRECONDITION was being swallowed to [] — so with --since EVERY
  // scenario silently lost its server-proof (false negatives), while without --since sinceMs=0
  // counted STALE prior-round logs as proof (false positives). Scope by time in JS instead.
  const s = await db.collection('system_logs').where('userId', '==', uid).get().catch(() => ({ docs: [] }));
  return s.docs.map(d => d.data()).filter(x => {
    const ms = x.timestamp?.toMillis ? x.timestamp.toMillis() : (x.timestamp?._seconds != null ? x.timestamp._seconds * 1000 : null);
    return ms == null ? !since : ms >= since;   // with a --since window set, drop stale/untimestamped logs
  });
}

/** Per-family verdict. Returns {verdict, why, checks}. */
async function judge(entry, opts) {
  const { uid, sandboxClassId: classId, listId, family, expect } = entry;
  const prog = await progressOf(uid, classId, listId);
  if (!prog) return { verdict: 'INVALID_PRECONDITION', why: 'no class_progress read back — seed/drive did not persist', checks: {} };

  const logs = await serverLogsFor(uid, sinceMs);
  const serverProof = logs.some(l => SERVER_ONLY_TYPES.has(l.type));   // M7
  const canonical = await canonicalCount(uid);                          // must stay 0 (LIST_PROGRESS_CANONICAL=false)
  const c = { csd: prog.currentStudyDay, twi: prog.totalWordsIntroduced, reviewMode: prog.reviewMode ?? null,
              interventionLevel: prog.interventionLevel, serverProof, canonicalDocs: canonical, serverLogTypes: [...new Set(logs.map(l => l.type))] };

  // universal invariant: canonical must be empty pre-P5 — EXCEPT the canonical-anomaly scenario (F8),
  // which seeds a canonical doc on purpose to test read-only detection (its own judge bounds it).
  if (canonical > 0 && family !== 'canonical-anomaly') return { verdict: 'FAIL', why: `canonical list_progress = ${canonical} while LIST_PROGRESS_CANONICAL=false`, checks: c };

  switch (family) {
    case 'throttle-deadlock': { // A1: escaped (interv dropped, day re-allocates) after 2 good reviews — NOT frozen
      if (c.interventionLevel == null) return { verdict: 'INVALID_PRECONDITION', why: 'no interventionLevel', checks: c };
      const escaped = c.interventionLevel < 0.5 || c.reviewMode === false;
      return { verdict: escaped ? (serverProof ? 'PASS' : 'INVALID_PRECONDITION') : 'FAIL',
               why: escaped ? (serverProof ? 'throttle escaped + server-path proof' : 'escaped but NO server-path proof (may be legacy path)') : 'still throttle-held (interv≥0.5, reviewMode not cleared) — #11 deadlock recurred', checks: c };
    }
    case 'skip-hold': {         // A2: a skipped review HELD — csd/twi did NOT advance; no runaway
      const held = c.csd === entry.seededCsd && c.twi === entry.seededTwi;
      return { verdict: held ? (serverProof ? 'PASS' : 'INVALID_PRECONDITION') : 'FAIL',
               why: held ? 'skip held (csd/twi flat)' : `RUNAWAY: csd advanced ${entry.seededCsd}→${c.csd} on a skipped review`, checks: c };
    }
    case 'off-by-one': {        // A3: PR-1 advances csd "on COMPLETION, not on bare load" (change_action_log 2026-07-18).
      // So on a bare-load read-back csd===seededCsd is EXPECTED (student is un-stuck / renders progressable, but the
      // counter only ticks when they complete their next day) → INVALID_PRECONDITION (needs a completion drive to verify).
      if (c.csd === (entry.seededCsd + 1)) return { verdict: serverProof ? 'PASS' : 'INVALID_PRECONDITION', why: 'off-by-one reconciled to the completed day (csd advanced)', checks: c };
      if (c.csd < entry.seededCsd) return { verdict: 'FAIL', why: `csd DEMOTED ${entry.seededCsd}→${c.csd}`, checks: c };
      return { verdict: 'INVALID_PRECONDITION', why: `csd=${c.csd} (un-stuck but not yet advanced — off-by-one advances ON COMPLETION not load; drive one completion to verify csd→${entry.seededCsd + 1})`, checks: c };
    }
    case 'list-end': {          // A6: engaged review at list-end ADVANCES csd, twi stays capped, no deadlock error
      const advanced = c.csd > entry.seededCsd;
      const twiCapped = c.twi === entry.seededTwi;   // no new words at list-end
      return { verdict: (advanced && twiCapped) ? (serverProof ? 'PASS' : 'INVALID_PRECONDITION') : 'FAIL',
               why: (advanced && twiCapped) ? 'list-end engaged review advanced csd, twi capped' : `csd ${entry.seededCsd}→${c.csd}, twi ${entry.seededTwi}→${c.twi} (expected csd+ , twi flat)`, checks: c };
    }
    case 'lost-save': {         // A12 (최도훈): impossible session (day N+1 review-study, newPass=false, no day-N+1 anchor).
      // Minimal bar: NO false advance (csd must not move without a valid anchor), NO demotion, NO duplicate anchor;
      // recovery = student can retake the missing new test → csd advances EXACTLY once with EXACTLY one anchor.
      const targetDay = entry.seededCsd + 1;
      const anchors = await db.collection('attempts').where('studentId', '==', uid)
        .where('sessionType', '==', 'new').where('passed', '==', true).get();
      const dayAnchors = anchors.docs.map(d => d.data()).filter(a => (a.studyDay ?? a.day) === targetDay);
      c.dayAnchors = dayAnchors.length;
      if (c.csd < entry.seededCsd) return { verdict: 'FAIL', why: `csd DEMOTED ${entry.seededCsd}→${c.csd}`, checks: c };
      if (c.csd > entry.seededCsd && dayAnchors.length === 0)
        return { verdict: 'FAIL', why: `FALSE ADVANCE: csd=${c.csd} with NO day-${targetDay} anchor (advance without evidence)`, checks: c };
      if (dayAnchors.length > 1) return { verdict: 'FAIL', why: `DUPLICATE day-${targetDay} anchors (${dayAnchors.length}) — double-write`, checks: c };
      if (c.csd === entry.seededCsd + 1 && dayAnchors.length === 1)
        return { verdict: serverProof ? 'PASS' : 'INVALID_PRECONDITION', why: 'lost-save recovered: retook the missing new test, advanced exactly once with one anchor', checks: c };
      return { verdict: 'INVALID_PRECONDITION', why: `stable pre-drive (csd=${c.csd}, day-${targetDay} anchors=${dayAnchors.length}) — drive the day-${targetDay} new test to verify recovery`, checks: c };
    }
    case 'runaway-inflated': {  // live_oyk: pre-fix runaway left csd inflated (12) vs real anchor (4). Deployed design:
      // PR-3 HOLDS (no further advance on skip/empty), resolver NEVER demotes → csd stays 12 (inflation does NOT
      // self-heal → the CS repair remains necessary — that demonstration is the point of this scenario).
      if (c.csd > entry.seededCsd) return { verdict: 'FAIL', why: `RUNAWAY RECURRED: csd ${entry.seededCsd}→${c.csd} (PR-3 hold failed)`, checks: c };
      if (c.csd < entry.seededCsd) return { verdict: 'FAIL', why: `UNEXPECTED DEMOTION csd ${entry.seededCsd}→${c.csd} (resolver must never demote)`, checks: c };
      const heldNow = c.reviewMode === true || (c.interventionLevel ?? 0) >= 0.5;
      return { verdict: heldNow ? (serverProof ? 'PASS' : 'INVALID_PRECONDITION') : 'INVALID_PRECONDITION',
               why: heldNow ? 'inflation frozen: csd unchanged + review-HELD (bleeding stopped; CS repair still needed for the inflation — as designed)' : `csd unchanged but not observed held (reviewMode=${c.reviewMode}) — drive a skip to verify the hold`, checks: c };
    }
    case 'normal-progress': {   // live_lhs: post-correction student must progress NORMALLY — completing the day advances EXACTLY once.
      if (c.csd === entry.seededCsd + 1) return { verdict: serverProof ? 'PASS' : 'INVALID_PRECONDITION', why: 'completed the day → advanced exactly once (normal progression restored)', checks: c };
      if (c.csd > entry.seededCsd + 1) return { verdict: 'FAIL', why: `over-advanced ${entry.seededCsd}→${c.csd} (re-runaway)`, checks: c };
      if (c.csd < entry.seededCsd) return { verdict: 'FAIL', why: `demoted ${entry.seededCsd}→${c.csd}`, checks: c };
      return { verdict: 'INVALID_PRECONDITION', why: `csd=${c.csd} (pre-drive stable) — drive one full completion to verify`, checks: c };
    }
    case 'canonical-anomaly': {  // F8: a users/{uid}/list_progress/{listId} canonical doc exists while
      // LIST_PROGRESS_CANONICAL=false. Read-only design: the resolver DETECTS it (logs resolve/quarantine),
      // does NOT crash, does NOT proliferate canonical (count stays at the seeded 1), reads back a coherent
      // csd. This de-risks the one-way P5 cutover. Drive = simply load the student (detection fires on read).
      if (canonical > 1) return { verdict: 'FAIL', why: `canonical PROLIFERATED to ${canonical} — read-only mode must never WRITE canonical`, checks: c };
      const detected = c.serverLogTypes.some(t => ['resolve_list_progress', 'list_progress_quarantine_candidate', 'csd_twi_reconciled'].includes(t));
      const coherent = typeof c.csd === 'number' && c.csd >= entry.seededCsd;   // no corruption / no demotion
      return { verdict: (detected && coherent) ? 'PASS' : 'INVALID_PRECONDITION',
               why: (detected && coherent) ? 'canonical anomaly detected + handled read-only (coherent csd, no proliferation) — P5 de-risked'
                                           : `awaiting drive: detected=${detected} coherent=${coherent} — load the student so the resolver logs the anomaly`, checks: c };
    }
    case 'readonly-safe': {  // F1: an EXTREME/inconsistent csd (e.g. 30) loaded in P4 read-only mode must render
      // SAFELY — no crash, no force-demotion, no write-advance — with the anomaly FLAGGED (quarantine/resolve log).
      // A bare authenticated load IS the whole test (the resolver fires on read); csd must stay put either way.
      if (c.csd < entry.seededCsd) return { verdict: 'FAIL', why: `DEMOTED ${entry.seededCsd}→${c.csd} — read-only mode must never write csd down`, checks: c };
      if (c.csd > entry.seededCsd) return { verdict: 'FAIL', why: `ADVANCED ${entry.seededCsd}→${c.csd} on a bare load — read-only violated`, checks: c };
      const flagged = c.serverLogTypes.some(t => ['resolve_list_progress', 'list_progress_quarantine_candidate'].includes(t));
      return { verdict: flagged ? 'PASS' : 'INVALID_PRECONDITION',
               why: flagged ? 'extreme csd rendered read-only-safe (no demote, no write-advance, anomaly flagged) — P4 read-only holds'
                            : 'csd stable but no resolve/quarantine log yet — load the student to fire the resolver', checks: c };
    }
    default:
      return { verdict: 'INVALID_PRECONDITION', why: `no judge for family "${family}" — add one`, checks: c };
  }
}

async function main() {
  const roster = JSON.parse(readFileSync(rosterPath, 'utf8')).roster || [];
  const results = [];
  for (const e of roster) {
    const r = await judge(e, {});
    results.push({ tag: e.tag, family: e.family, email: e.email, ...r });
    console.log(`  [${e.tag}] ${e.family}: ${r.verdict} — ${r.why}`);
  }
  const summary = { at: new Date().toISOString(), rosterPath,
    pass: results.filter(r => r.verdict === 'PASS').length,
    fail: results.filter(r => r.verdict === 'FAIL').length,
    invalid: results.filter(r => r.verdict === 'INVALID_PRECONDITION').length, results };
  writeFileSync('/app/audit/playwright/findings/a2_recovery_verdicts.json', JSON.stringify(summary, null, 2));
  console.log(`\n${summary.pass} PASS · ${summary.fail} FAIL · ${summary.invalid} INVALID_PRECONDITION → a2_recovery_verdicts.json`);
  if (summary.fail > 0) console.log('⛔ FAIL on a fixed-family scenario → STOP + escalate to David (regression while cutover is still reversible).');
  process.exit(0);
}
main().catch(e => { console.error('ASSERT ERROR:', e.message); process.exit(1); });

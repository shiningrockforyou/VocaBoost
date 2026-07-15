/**
 * lsr_deepfix_cert.mjs — the PROGRAM certification consolidator (deepfix Task 5, final piece).
 * ============================================================================================
 * Consolidates all SIX deepfix matrices' per-run finding-JSONs into ONE fail-closed program
 * certification for `audit/deepfix/task2/FIX_PLAN.md` (P0–P10), per AUDIT_DESIGN task4 §2
 * (fail-closed certification + artifact binding), §5 (the coverage map — nothing unaudited),
 * and §6 (the NOT-re-executed ledger).
 *
 * It reads, for a single <runId>:
 *     findings/deepfix_static_<runId>.json   (M-STATIC  — lsr_deepfix_static.mjs)
 *     findings/deepfix_ui_<runId>.json       (M-UI      — lsr_deepfix_ui.mjs)
 *     findings/deepfix_wb_<runId>.json       (M-WB      — lsr_deepfix_whitebox.mjs)
 *     findings/deepfix_mig_<runId>.json      (M-MIG     — lsr_deepfix_migrate_audit.mjs)
 *     findings/deepfix_call_<runId>.json     (M-CALL    — lsr_deepfix_callable.mjs)
 *     findings/deepfix_rules_<runId>.json    (M-RULES   — lsr_deepfix_rules.mjs)
 * and produces  findings/DEEPFIX_AUDIT_CERT_<runId>.{md,json}.
 *
 * The six matrices write DIFFERENT native schemas (this consolidator NORMALIZES them):
 *   • M-STATIC / M-MIG :  { runId, git:{head,short,dirty}, target|migrationVersion,
 *                            summary:{pass,fail,invalid,[deferred,]skip}, verdict, assertions:[{id,verdict,…}] }
 *   • M-CALL   / M-RULES: { runId, git:{head,short,dirty}, rulesSha256, flagSet:{…},
 *                            emulator:{…}, summary:{pass,fail,invalid,skip}, verdict, results:[{id,verdict,…}] }
 *   • M-UI     / M-WB   : { runId, gitHead, gitDirty, base, buildId, fatals:[…],
 *                            cleanCount, verdict, results:[{id,verdict,confirmed,…}] }
 *
 * FAIL-CLOSED (AUDIT_DESIGN §2): the program certifies IFF, on the SAME bound deployment/runId family
 *   1. ALL SIX matrices present for the runId (a missing matrix ⇒ INVALID — subset runs cannot certify).
 *   2. Every matrix ALL-CLEAN (zero FAIL, zero INVALID, zero fatal anomaly, self-bound to the runId).
 *   3. Deployment/flag binding coherent (§2.2): same git HEAD across matrices; M-CALL/M-RULES agree on
 *      sha256(firestore.rules) + the flag-set AND ran flag-ON; M-STATIC's target == shipped (end-state).
 *   4. §5 coverage: every FIX_PLAN phase P0–P10 has its scenario IDs present across the matrices —
 *      nothing unaudited silently (an uncovered canonical scenario ⇒ INVALID).
 *   5. SKIP/DEFERRED accounting (≠ PASS): every not-executed leg must be on the DOCUMENTED ledger;
 *      an UNEXPECTED skip/deferral (not on the ledger) ⇒ INVALID.
 *   6. §6 ledger: the transition-window / live-ops / mechanism-dependent items are enumerated as
 *      NOT-re-executed-by-design (requiring the bound gate artifacts).
 * CERTIFIED iff 1–4 hold and 5's skips are all on the ledger. Nonzero exit if NOT-CERTIFIED.
 *
 * Design lineage: the fail-closed SELF-BINDING cert pattern of `lsr_fleet_manifest.mjs` (a copied/misnamed
 * clean artifact can't be counted for the wrong slot — here the internal runId must equal the requested
 * runId), extended for the multi-matrix / multi-schema program.  This module DOES NOT import or modify any
 * vocaBoost source; it only reads the matrices' finding-JSONs (or, in --self-check, synthetic in-memory sets).
 *
 * CLI:
 *   node audit/playwright/lsr_deepfix_cert.mjs <runId> [--self-check] [--findings=<dir>]
 *     <runId>          the run family to consolidate (all six files share it).
 *     --self-check     SELF-VALIDATION (runnable in this WSL): runs the cert logic against SYNTHETIC
 *                      in-memory matrix-finding sets (an all-clean set ⇒ CERTIFIED; sets with a FAIL, a
 *                      missing matrix, binding mismatches, and off-ledger skips ⇒ NOT-CERTIFIED for the
 *                      right reason each). Exit 0 iff every synthetic expectation held. Writes NOTHING.
 *     --findings=<dir> override the findings dir (default: the sibling ./findings).
 *
 * The REAL program cert runs at Codex's Task-6 after all six matrices produce their <runId> findings.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── args ───────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const SELF_CHECK = argv.includes('--self-check');
const getArg = (k, d) => { const h = argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };
const FINDINGS = resolve(getArg('findings', resolve(HERE, 'findings')));
const RUN_ID = argv.find((a) => !a.startsWith('--'));

// ════════════════════════════════════════════════════════════════════════════════════════════════
// STATIC CONFIG — the six matrices, the §5 coverage map, the DEFERRED ledger, the §6 ledger.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// key = filename slug `deepfix_<key>_<runId>.json`; results = which array holds the per-scenario verdicts.
const MATRICES = [
  { key: 'static', label: 'M-STATIC', module: 'lsr_deepfix_static.mjs', resultsField: 'assertions' },
  { key: 'ui', label: 'M-UI', module: 'lsr_deepfix_ui.mjs', resultsField: 'results' },
  { key: 'wb', label: 'M-WB', module: 'lsr_deepfix_whitebox.mjs', resultsField: 'results' },
  { key: 'mig', label: 'M-MIG', module: 'lsr_deepfix_migrate_audit.mjs', resultsField: 'assertions' },
  { key: 'call', label: 'M-CALL', module: 'lsr_deepfix_callable.mjs', resultsField: 'results' },
  { key: 'rules', label: 'M-RULES', module: 'lsr_deepfix_rules.mjs', resultsField: 'results' },
];

// §5 coverage map: every FIX_PLAN phase → the canonical scenario IDs that must be present across the
// matrices (AUDIT_DESIGN §5 + §1). Sub-scenario ids (CS-4a/b/c, CS-6f/v, OV-3c/p, DG-4b, RET-2:*, …)
// cover their canonical parent via familyId()/baseId() matching below.
const PHASES = [
  { phase: 'P0', name: 'FND-0 deploy-safety substrate', scenarios: ['DG-1', 'DG-2', 'DG-3', 'DG-4'] },
  { phase: 'P1', name: 'RO review-only completion (S1–S10)', scenarios: ['RA1', 'RA2', 'RA3', 'RA5', 'RA5b', 'RA6', 'RA7', 'RA8', 'RA9', 'RO-S1', 'RO-S9', 'RO-S10', 'W-RA3g', 'W-RA4', 'W-RA4b'] },
  { phase: 'P2', name: 'RS read/render truth surfaces', scenarios: ['RS-1', 'RS-2', 'RS-3', 'RS-4'] },
  { phase: 'P3', name: 'FND-1 server surface', scenarios: ['CS-1', 'CS-2', 'CS-3', 'CS-4', 'CS-5', 'CS-6', 'CS-7', 'CS-8', 'CS-9', 'CS-10', 'CS-11', 'DG-2'] },
  { phase: 'P4', name: 'FND-2 client cutover', scenarios: ['CUT-1', 'CUT-2', 'CUT-3', 'CUT-4', 'CUT-5', 'CUT-6', 'CUT-7', 'CUT-8', 'DG-3'] },
  { phase: 'P5', name: 'FND-3 data migration', scenarios: ['MIG-1', 'MIG-2', 'MIG-3', 'MIG-4', 'MIG-5', 'MIG-6', 'MIG-7', 'MIG-8', 'MIG-9', 'MIG-10'] },
  { phase: 'P6', name: 'FND-4 cutoff rules matrix', scenarios: ['RUL-1', 'RUL-2', 'RUL-3', 'RUL-4', 'RUL-5', 'RUL-6', 'RUL-7', 'RUL-8', 'RUL-9', 'CUT-2', 'CUT-6', 'CS-6'] },
  { phase: 'P7', name: 'FND-5 retirement', scenarios: ['RET-1', 'RET-2', 'RET-3', 'RET-4'] },
  { phase: 'P8', name: 'CONT-A continuation', scenarios: ['CA-1', 'CA-2', 'CA-3', 'CA-4', 'CA-5', 'CA-6'] },
  { phase: 'P9', name: 'CYC cycling', scenarios: ['CY-1', 'CY-2', 'CY-3', 'CY-4', 'CY-5', 'CY-6', 'CY-7'] },
  { phase: 'P10', name: 'OVR override + challenge redesign', scenarios: ['OV-1', 'OV-2', 'OV-3', 'OV-4', 'OV-5', 'OV-6'] },
];

// The flag-ON end-state server flags M-CALL/M-RULES REQUIRE (mirrors lsr_deepfix_callable.mjs REQUIRED):
// they certify the flag-ON program, so their recorded flagSet must show these true (§2.2 binding).
const REQUIRED_FLAG_ON = [
  'SERVER_COMPLETE_SESSION_ENABLED', 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED',
  'SERVER_RESET_PROGRESS_ENABLED', 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED',
  'LIST_PROGRESS_CANONICAL', 'ANCHOR_VALIDATION_ENFORCE',
  'SERVER_REVIEW_CHALLENGE_ENABLED', 'SERVER_OVERRIDE_ENABLED',
];

// The DOCUMENTED deferral ledger (AUDIT_DESIGN §6 + the task's enumerated deferrals). A SKIP/DEFERRED
// leg is EXPECTED (does not block cert) IFF its base/family id is listed for its matrix. Anything else
// that is skipped/deferred is an UNEXPECTED skip ⇒ INVALID (fail-closed; "SKIP ≠ PASS").
const DEFERRED_LEDGER = {
  'M-STATIC': {
    ids: ['DG-2', 'DG-3', 'DG-4b', 'CUT-1b'],
    reason: 'deployed-probe / built-bundle legs — no live network or local dist/ in M-STATIC (§6.1/§1.A). '
      + 'Codex supplies the deployed exports.version (DG-2) + hosting build-stamp (DG-3) + bundle greps (DG-4b/CUT-1b) at Task-6.',
  },
  'M-CALL': {
    ids: ['CS-7', 'CS-10', 'CY-3'],
    reason: 'CS-7/CS-10 are secret-backed (GRADE_TOKEN_SECRET / ANTHROPIC_API_KEY; the grading-job recovery suite '
      + 'runs against the deployed functions, not the emulator — CS-10 note). CY-3 is gated on CYCLING_ENABLED(server) '
      + 'in the loaded flag-set (§1.J parameterized). NOTE: at the true end-state these should EXECUTE, not defer.',
  },
  'M-RULES': { ids: [], reason: 'no design-documented deferrals — every RUL-*/OV-6 arm executes under the emulator.' },
  'M-UI': { ids: [], reason: 'no design-documented deferrals — every attempted E2E scenario must PASS (an INVALID is a setup failure and blocks).' },
  'M-WB': { ids: [], reason: 'no design-documented deferrals — the crafted-precondition white-box scenarios must PASS.' },
  'M-MIG': {
    ids: ['MIG-6', 'MIG-7', 'MIG-9-commit', 'MIG-10-commit', 'RET-3', 'MIG-TID', 'MIG-9-backup', 'MIG-10b'],
    reason: 'write-guarded --commit/--catchup legs (MIG-6/7/9c/10c/RET-3) + the opt-in P10c teacherIds --dry (MIG-TID) '
      + '+ status legs (--dry --backup shared dir MIG-9-backup; F6-3 sweep/census retarget MIG-10b) — Codex Task-6 '
      + 'authorized-commit (§1.F/§1.H/§6). IMPORTANT: the DRY oracles MIG-1..5/MIG-8/MIG-9/MIG-10a are NOT on this '
      + 'ledger — they MUST PASS in the full-dry run. A --dry-only M-MIG leaves MIG-1..5/9 DEFERRED ⇒ P5 unaudited ⇒ NOT-CERTIFIED.',
  },
};

// §6 — the honest NOT-re-executed ledger (enumerated, requirement 6). Verified-as-artifact / live-ops /
// mechanism-dependent; NOT re-executed by this audit by design (missing gate artifact = INVALID, never PASS).
const NOT_REEXECUTED_LEDGER = [
  { ref: '§6.1', klass: 'transition-window', item: 'P4 "resolver wrote ZERO canonical docs before P5"', requires: 'the P4-era gate manifest; end-state substitute = MIG-9 single-writer trace + CS-8 straggler path' },
  { ref: '§6.2', klass: 'transition-window', item: 'P3 resolver READ-ONLY mode behavior', requires: 'end-state corollary (canonical-first + straggler hydrate) certified by CS-8' },
  { ref: '§6.3', klass: 'transition-window', item: 'P6 14-day no-legacy-write window + build-version census [C8-1] + 26SM quarantine=0 [C7-2]; P7 7-day zero-denial window', requires: 'dated live-window artifacts' },
  { ref: '§6.4', klass: 'procedural', item: 'P0/P5/P6 authorization chain (David scoped commit + CS-event SUPPORT_RUNBOOK entries)', requires: 'procedural sign-off artifacts' },
  { ref: '§6.5', klass: 'live-ops', item: 'F-4 H/P/B before/after motion per phase (the program metric)', requires: 'live 26SM census via the MIG-10-audited toolchain — FORBIDDEN to this audit; mechanism certified' },
  { ref: '§6.6', klass: 'live-ops', item: 'M4 shadow false-reject ≈ 0 over ≥14 days of live traffic (P3)', requires: 'a soak artifact; the shadow/enforce mechanism is certified by CS-6' },
  { ref: '§6.7', klass: 'live-ops', item: 'P1/P3 G5 watch-window signals (permission-denied thresholds, rollback clock)', requires: 'live monitoring dashboards' },
  { ref: '§6.8', klass: 'live-ops', item: 'population drains (183-wall P1, 63-pending P8, F-6 permafail→0 P10, 531 impossible_phase→0 P4)', requires: 'live census; the per-student mechanism is certified by the sandbox personas' },
  { ref: '§6.9', klass: 'mechanism-dependent', item: 'RUL-8 teacher-provisioning ALLOW arm (David decision 10)', requires: 'concretized at implementation review; the DENY arm is fully audited (RUL-8)' },
  { ref: '§6.10', klass: 'procedural', item: 'P0 "never bare firebase deploy" standing rule', requires: 'DG-2/DG-3 provenance equality after every recorded deploy' },
];

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ID matching helpers — canonical scenario ↔ emitted matrix id (sub-scenario aware).
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** Strip a `:flag` suffix (DG-1:GRADE_… → DG-1; RET-2:client_… → RET-2). */
const baseId = (id) => String(id).split(':')[0];
/** Collapse a trailing lowercase-letter sub-scenario suffix that follows a digit
 *  (CS-4a→CS-4, CS-6f→CS-6, CS-11m→CS-11, OV-3c→OV-3, OV-6w→OV-6, DG-4b→DG-4, MIG-10a→MIG-10, RA5b→RA5,
 *   W-RA4b→W-RA4, CS-1e→CS-1). Ids with no such suffix (RO-S10, MIG-9-commit, RS-1) are unchanged. */
const familyId = (id) => baseId(id).replace(/(\d)[a-z]+$/, '$1');
/** Does a matrix result id `rid` cover canonical scenario `cid`? Exact base OR collapsed family. */
const idCovers = (rid, cid) => baseId(rid) === cid || familyId(rid) === cid;
/** Is a base/family id listed on a matrix's deferral ledger? */
const onLedger = (label, rid) => {
  const set = DEFERRED_LEDGER[label]?.ids || [];
  return set.includes(baseId(rid)) || set.includes(familyId(rid));
};

// verdict roll-up precedence for the coverage table (FAIL dominates; a single PASS audits the scenario).
const PRIO = { FAIL: 5, INVALID: 4, PASS: 3, DEFERRED: 2, SKIP: 1, UNCOVERED: 0 };
const rollup = (verdicts) => (verdicts.length ? verdicts.reduce((a, v) => (PRIO[v] > PRIO[a] ? v : a)) : 'UNCOVERED');

// ════════════════════════════════════════════════════════════════════════════════════════════════
// NORMALIZER — heterogeneous native schema → one common shape.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function normalizeMatrix(spec, raw, requestedRunId, opts = {}) {
  const out = {
    key: spec.key, label: spec.label, module: spec.module,
    present: false, path: opts.path || null, parseError: null,
    runId: null, runIdOk: false,
    gitHead: null, gitDirty: null,
    rulesSha: null, flagSet: null, staticTarget: null, migrationVersion: null, emulator: null,
    base: null, buildId: null,
    results: [], counts: { pass: 0, fail: 0, invalid: 0, skip: 0, deferred: 0, other: 0 },
    fatals: 0, selfVerdict: null, clean: false,
  };
  if (raw == null) return out; // missing
  out.present = true;
  if (typeof raw !== 'object') { out.parseError = 'not an object'; return out; }

  out.runId = raw.runId ?? null;
  out.runIdOk = out.runId === requestedRunId;
  out.gitHead = raw.git?.head ?? raw.gitHead ?? null;
  out.gitDirty = raw.git?.dirty ?? raw.gitDirty ?? null;
  out.rulesSha = raw.rulesSha256 ?? null;
  out.flagSet = raw.flagSet ?? null;
  out.staticTarget = raw.target ?? null;
  out.migrationVersion = raw.migrationVersion ?? null;
  out.emulator = raw.emulator ?? null;
  out.base = raw.base ?? null;
  out.buildId = raw.buildId ?? null;
  out.selfVerdict = raw.verdict ?? null;
  out.fatals = Array.isArray(raw.fatals) ? raw.fatals.length : 0;

  const arr = raw[spec.resultsField];
  if (!Array.isArray(arr)) { out.parseError = `missing/invalid '${spec.resultsField}[]'`; return out; }
  for (const r of arr) {
    const id = r?.id;
    const verdict = r?.verdict;
    if (id == null || verdict == null) { out.parseError = 'result row missing id/verdict'; continue; }
    out.results.push({ id, base: baseId(id), family: familyId(id), verdict });
    const v = String(verdict).toUpperCase();
    if (v === 'PASS') out.counts.pass++;
    else if (v === 'FAIL') out.counts.fail++;
    else if (v === 'INVALID') out.counts.invalid++;
    else if (v === 'SKIP') out.counts.skip++;
    else if (v === 'DEFERRED') out.counts.deferred++;
    else out.counts.other++;
  }
  // ALL-CLEAN (§2.3): present, self-bound to the runId, zero FAIL, zero INVALID, zero fatal, no parse error,
  // no unknown verdict. SKIP/DEFERRED are accounted separately (§2 requirement 5), not clean-breaking here.
  out.clean = out.present && out.runIdOk && !out.parseError
    && out.counts.fail === 0 && out.counts.invalid === 0 && out.counts.other === 0 && out.fatals === 0;
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CORE — evaluate the program certification (PURE: real path + --self-check both call this).
//   rawByKey: { static, ui, wb, mig, call, rules } → the native-schema object (or undefined if missing).
// ════════════════════════════════════════════════════════════════════════════════════════════════
function evaluateCert(runId, rawByKey, meta = {}) {
  const reasons = []; // {code, matrix?, detail}
  const addReason = (code, detail, matrix) => reasons.push({ code, detail, ...(matrix ? { matrix } : {}) });

  const mats = MATRICES.map((spec) => normalizeMatrix(spec, rawByKey[spec.key], runId, { path: meta.paths?.[spec.key] }));
  const byKey = Object.fromEntries(mats.map((m) => [m.key, m]));

  // ── 1. all six present (+ self-bound to the runId) — subset can't certify ──────────────────────
  for (const m of mats) {
    if (!m.present) { addReason('MISSING_MATRIX', `${m.label} (deepfix_${m.key}_${runId}.json) is ABSENT — a subset cannot certify (§2.1).`, m.label); continue; }
    if (m.parseError) { addReason('PARSE_ERROR', `${m.label}: ${m.parseError}.`, m.label); }
    if (!m.runIdOk) { addReason('RUNID_MISMATCH', `${m.label} internal runId=${JSON.stringify(m.runId)} ≠ requested ${JSON.stringify(runId)} (self-binding: a copied/misnamed artifact can't be counted for this slot).`, m.label); }
  }

  // ── 2. every matrix ALL-CLEAN (zero FAIL/INVALID/fatal) ────────────────────────────────────────
  for (const m of mats) {
    if (!m.present) continue;
    if (!m.clean) {
      addReason('MATRIX_NOT_CLEAN',
        `${m.label} NOT-CLEAN — fail=${m.counts.fail} invalid=${m.counts.invalid} fatal=${m.fatals} unknownVerdict=${m.counts.other}`
        + `${m.runIdOk ? '' : ' runId-unbound'}${m.parseError ? ` parseError=${m.parseError}` : ''} (self verdict: ${m.selfVerdict}).`, m.label);
    }
  }

  // ── 3. deployment / flag binding coherence (§2.2) ──────────────────────────────────────────────
  const binding = { gitHeads: {}, gitHead: null, gitHeadCoherent: true, rulesShas: {}, rulesSha: null, rulesShaCoherent: true, flagOn: {}, flagSetMismatches: [], flagSetCoherent: true, staticTarget: byKey.static?.staticTarget ?? null, staticTargetOk: true };
  // (a) git HEAD equal across all present matrices
  const heads = mats.filter((m) => m.present && m.gitHead && m.gitHead !== 'unknown');
  for (const m of heads) binding.gitHeads[m.label] = m.gitHead;
  const uniqHeads = [...new Set(heads.map((m) => m.gitHead))];
  binding.gitHead = uniqHeads[0] ?? null;
  if (uniqHeads.length > 1) {
    binding.gitHeadCoherent = false;
    addReason('BINDING_GIT_HEAD', `matrices ran against DIFFERENT git HEADs: ${Object.entries(binding.gitHeads).map(([k, v]) => `${k}=${String(v).slice(0, 10)}`).join(', ')} (§2.2 — the audit must prove WHAT it tested).`);
  }
  // (b) firestore.rules sha256 agreement (M-CALL / M-RULES both record it)
  const shaMats = mats.filter((m) => m.present && m.rulesSha);
  for (const m of shaMats) binding.rulesShas[m.label] = m.rulesSha;
  const uniqSha = [...new Set(shaMats.map((m) => m.rulesSha))];
  binding.rulesSha = uniqSha[0] ?? null;
  if (uniqSha.length > 1) {
    binding.rulesShaCoherent = false;
    addReason('BINDING_RULES_SHA', `M-CALL/M-RULES bound DIFFERENT sha256(firestore.rules): ${Object.entries(binding.rulesShas).map(([k, v]) => `${k}=${String(v).slice(0, 12)}`).join(', ')}.`);
  }
  // (c) flag-set mutual consistency + flag-ON (M-CALL / M-RULES)
  const flagMats = mats.filter((m) => m.present && m.flagSet);
  if (flagMats.length >= 2) {
    const [a, b] = flagMats;
    const keys = [...new Set([...Object.keys(a.flagSet), ...Object.keys(b.flagSet)])];
    for (const k of keys) {
      if (k in a.flagSet && k in b.flagSet && a.flagSet[k] !== b.flagSet[k]) {
        binding.flagSetMismatches.push(`${k}: ${a.label}=${a.flagSet[k]} vs ${b.label}=${b.flagSet[k]}`);
      }
    }
    if (binding.flagSetMismatches.length) {
      binding.flagSetCoherent = false;
      addReason('BINDING_FLAGSET', `M-CALL/M-RULES recorded INCONSISTENT flag-sets: ${binding.flagSetMismatches.slice(0, 8).join('; ')}.`);
    }
  }
  for (const m of flagMats) {
    const off = REQUIRED_FLAG_ON.filter((k) => m.flagSet[k] !== true);
    binding.flagOn[m.label] = off.length === 0 ? 'flag-ON' : `OFF: ${off.join(', ')}`;
    if (off.length) addReason('BINDING_FLAG_OFF', `${m.label} did NOT run the flag-ON end-state — OFF flags: ${off.join(', ')} (a dark/flag-off probe run cannot certify the shipped program).`, m.label);
  }
  // (d) M-STATIC target must be the shipped end-state (a baseline static run can't co-certify a flag-ON program)
  if (byKey.static?.present) {
    if (binding.staticTarget !== 'shipped') {
      binding.staticTargetOk = false;
      addReason('BINDING_STATIC_TARGET', `M-STATIC target=${JSON.stringify(binding.staticTarget)} ≠ 'shipped' — the program certifies the SHIPPED end-state; a baseline static run is incoherent with the flag-ON matrices (§2.2).`);
    }
  }

  // ── 4. §5 coverage map — every canonical scenario present across the matrices ───────────────────
  const allResults = mats.flatMap((m) => (m.present ? m.results.map((r) => ({ ...r, label: m.label })) : []));
  const coverage = PHASES.map((ph) => {
    const scen = ph.scenarios.map((cid) => {
      const hits = allResults.filter((r) => idCovers(r.id, cid));
      const verdict = rollup(hits.map((h) => String(h.verdict).toUpperCase()));
      return { id: cid, verdict, coveredBy: hits.map((h) => `${h.label}:${h.id}=${h.verdict}`) };
    });
    const covered = scen.filter((s) => s.verdict !== 'UNCOVERED');
    const uncovered = scen.filter((s) => s.verdict === 'UNCOVERED').map((s) => s.id);
    // phase verdict for display (fail-closed): worst-of; zero-covered ⇒ INVALID.
    let pv = 'PASS';
    if (covered.length === 0) pv = 'INVALID';
    else if (scen.some((s) => s.verdict === 'FAIL')) pv = 'FAIL';
    else if (scen.some((s) => s.verdict === 'INVALID')) pv = 'INVALID';
    else if (uncovered.length) pv = 'INVALID';
    else if (scen.every((s) => s.verdict === 'PASS')) pv = 'PASS';
    else pv = 'PASS-with-deferrals';
    return { phase: ph.phase, name: ph.name, verdict: pv, coveredCount: covered.length, total: scen.length, uncovered, scenarios: scen };
  });
  const uncoveredAll = coverage.flatMap((c) => c.uncovered.map((id) => `${c.phase}:${id}`));
  if (uncoveredAll.length) addReason('COVERAGE_UNAUDITED', `${uncoveredAll.length} canonical scenario(s) have NO covering verdict in any matrix (nothing unaudited silently — §5): ${uncoveredAll.join(', ')}.`);

  // ── 5. SKIP / DEFERRED accounting (≠ PASS): every not-executed leg must be on the ledger ─────────
  const observedDeferrals = [];
  const unexpectedDeferrals = [];
  for (const m of mats) {
    if (!m.present) continue;
    for (const r of m.results) {
      const v = String(r.verdict).toUpperCase();
      if (v !== 'SKIP' && v !== 'DEFERRED') continue;
      const rec = { matrix: m.label, id: r.id, verdict: v, expected: onLedger(m.label, r.id) };
      observedDeferrals.push(rec);
      if (!rec.expected) unexpectedDeferrals.push(rec);
    }
  }
  if (unexpectedDeferrals.length) {
    addReason('UNEXPECTED_SKIP', `${unexpectedDeferrals.length} UNEXPECTED skip/deferral not on the documented ledger (SKIP ≠ PASS — §2 req 5): `
      + unexpectedDeferrals.map((d) => `${d.matrix}:${d.id}(${d.verdict})`).join(', ') + '.');
  }

  // ── verdict ────────────────────────────────────────────────────────────────────────────────────
  const certified = reasons.length === 0;
  return {
    tool: 'lsr_deepfix_cert.mjs',
    runId,
    generatedAt: new Date().toISOString(),
    verdict: certified ? 'CERTIFIED' : 'NOT-CERTIFIED',
    reasons,
    reasonCodes: [...new Set(reasons.map((r) => r.code))],
    matrices: mats.map((m) => ({
      key: m.key, label: m.label, module: m.module, present: m.present, path: m.path,
      runId: m.runId, runIdOk: m.runIdOk, clean: m.clean, selfVerdict: m.selfVerdict,
      gitHead: m.gitHead, gitDirty: m.gitDirty, counts: m.counts, fatals: m.fatals,
      rulesSha: m.rulesSha, staticTarget: m.staticTarget, migrationVersion: m.migrationVersion,
      emulator: m.emulator ? { project: m.emulator.project } : null, parseError: m.parseError,
    })),
    binding,
    coverage,
    deferredLedger: { documented: DEFERRED_LEDGER, observed: observedDeferrals, unexpected: unexpectedDeferrals },
    notReExecutedLedger: NOT_REEXECUTED_LEDGER,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// RENDER — the consolidated DEEPFIX_AUDIT_CERT_<runId>.md
// ════════════════════════════════════════════════════════════════════════════════════════════════
function icon(v) {
  return ({ PASS: '✅', CLEAN: '✅', CERTIFIED: '✅', FAIL: '❌', INVALID: '⛔', 'NOT-CERTIFIED': '❌', DEFERRED: '🕓', SKIP: '⏭️', UNCOVERED: '⬜', 'PASS-with-deferrals': '🟡' }[v] || '•');
}
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function renderMd(cert) {
  const L = [];
  L.push(`# DEEPFIX PROGRAM AUDIT CERTIFICATION — \`${cert.runId}\``);
  L.push('');
  L.push(`> Consolidates the six deepfix matrices (M-STATIC · M-UI · M-WB · M-MIG · M-CALL · M-RULES) into ONE`);
  L.push(`> fail-closed program certification of FIX_PLAN P0–P10 (AUDIT_DESIGN task4 §2/§5/§6). INVALID ≠ PASS;`);
  L.push(`> a subset cannot certify.`);
  L.push('');
  L.push(`## VERDICT: ${icon(cert.verdict)} **${cert.verdict}**`);
  L.push('');
  L.push(`- **runId:** \`${cert.runId}\``);
  L.push(`- **generated:** ${cert.generatedAt}`);
  L.push(`- **bound git HEAD:** \`${cert.binding.gitHead || '(incoherent/absent)'}\``);
  L.push(`- **bound sha256(firestore.rules):** \`${cert.binding.rulesSha || '(absent)'}\``);
  L.push(`- **M-STATIC target:** \`${cert.binding.staticTarget || '(absent)'}\``);
  L.push('');
  if (cert.reasons.length) {
    L.push(`### ❌ Blocking reasons (${cert.reasons.length})`);
    L.push('');
    for (const r of cert.reasons) L.push(`- **[${r.code}]**${r.matrix ? ` _(${r.matrix})_` : ''} ${esc(r.detail)}`);
    L.push('');
  } else {
    L.push(`### ✅ All certification conditions hold`);
    L.push(`All six matrices present + ALL-CLEAN on the same bound deployment/runId family; §5 coverage complete; every SKIP/DEFERRED is on the documented ledger. (The §6 NOT-re-executed items below are verified-as-artifact by design — Codex must confirm the bound gate artifacts exist.)`);
    L.push('');
  }

  // Per-matrix counts
  L.push(`## Per-matrix summary`);
  L.push('');
  L.push(`| | Matrix | present | runId-bound | clean | pass | fail | invalid | skip | deferred | fatal | self-verdict |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const m of cert.matrices) {
    L.push(`| ${m.present ? (m.clean ? '✅' : '❌') : '⬜'} | ${m.label} | ${m.present} | ${m.present ? m.runIdOk : '—'} | ${m.present ? m.clean : '—'} | ${m.counts.pass} | ${m.counts.fail} | ${m.counts.invalid} | ${m.counts.skip} | ${m.counts.deferred} | ${m.fatals} | ${esc(m.selfVerdict) || '—'} |`);
  }
  L.push('');

  // Deployment binding
  L.push(`## Deployment / flag binding (§2.2)`);
  L.push('');
  L.push(`- **git HEAD coherent:** ${cert.binding.gitHeadCoherent ? '✅' : '❌'} ${Object.entries(cert.binding.gitHeads).map(([k, v]) => `${k}=\`${String(v).slice(0, 10)}\``).join(', ') || '(none recorded)'}`);
  L.push(`- **firestore.rules sha coherent:** ${cert.binding.rulesShaCoherent ? '✅' : '❌'} ${Object.entries(cert.binding.rulesShas).map(([k, v]) => `${k}=\`${String(v).slice(0, 12)}\``).join(', ') || '(none recorded)'}`);
  L.push(`- **flag-set coherent:** ${cert.binding.flagSetCoherent ? '✅' : '❌'}${cert.binding.flagSetMismatches.length ? ` — mismatches: ${esc(cert.binding.flagSetMismatches.join('; '))}` : ''}`);
  L.push(`- **flag-ON end-state:** ${Object.entries(cert.binding.flagOn).map(([k, v]) => `${k}=${v}`).join(', ') || '(no flag-recording matrix)'}`);
  L.push(`- **M-STATIC target == shipped:** ${cert.binding.staticTargetOk ? '✅' : '❌'} (\`${cert.binding.staticTarget}\`)`);
  L.push('');
  L.push(`> Deferred provenance (flag): the deployed \`exports.version\` sha (DG-2) + hosting build-stamp sha (DG-3) of §2.2(a)/(b)`);
  L.push(`> are SKIP in M-STATIC (no live network) and are NOT present in any finding-JSON at HEAD — Codex must bind them at Task-6.`);
  L.push('');

  // §5 coverage map
  L.push(`## §5 coverage map (FIX_PLAN phase → scenarios → verdict)`);
  L.push('');
  L.push(`| | Phase | Scope | covered | scenarios (verdict) |`);
  L.push(`|---|---|---|---|---|`);
  for (const c of cert.coverage) {
    const cells = c.scenarios.map((s) => `${s.id}${s.verdict === 'PASS' ? '' : `·${s.verdict}`}`).join(', ');
    L.push(`| ${icon(c.verdict)} | **${c.phase}** ${esc(c.name)} | ${c.total} | ${c.coveredCount}/${c.total} | ${esc(cells)} |`);
  }
  L.push('');

  // DEFERRED ledger
  L.push(`## DEFERRED / SKIP ledger (SKIP ≠ PASS)`);
  L.push('');
  L.push(`Observed not-executed legs (${cert.deferredLedger.observed.length}); UNEXPECTED off-ledger (${cert.deferredLedger.unexpected.length}):`);
  L.push('');
  L.push(`| | Matrix | Scenario | Verdict | On documented ledger? |`);
  L.push(`|---|---|---|---|---|`);
  for (const d of cert.deferredLedger.observed) L.push(`| ${d.expected ? '🕓' : '⛔'} | ${d.matrix} | ${esc(d.id)} | ${d.verdict} | ${d.expected ? 'yes' : '**NO — UNEXPECTED**'} |`);
  if (!cert.deferredLedger.observed.length) L.push(`| — | — | (none) | — | — |`);
  L.push('');
  L.push(`**Documented ledger (what is legitimately NOT executed here):**`);
  for (const [label, entry] of Object.entries(cert.deferredLedger.documented)) {
    if (!entry.ids.length) continue;
    L.push(`- **${label}** — \`${entry.ids.join('`, `')}\`: ${esc(entry.reason)}`);
  }
  L.push('');

  // §6 not-re-executed ledger
  L.push(`## §6 NOT-re-executed ledger (verified-as-artifact / live-ops / mechanism — by design)`);
  L.push('');
  L.push(`These FIX_PLAN criteria are NOT re-executed by this audit; the program certification requires the`);
  L.push(`bound gate artifacts to EXIST (missing artifact = INVALID, never PASS — §6). This cert ENUMERATES`);
  L.push(`them; the artifacts themselves live outside the finding-JSON inputs (Codex/David confirm at Task-6).`);
  L.push('');
  L.push(`| Ref | Class | Item | Requires |`);
  L.push(`|---|---|---|---|`);
  for (const n of cert.notReExecutedLedger) L.push(`| ${n.ref} | ${n.klass} | ${esc(n.item)} | ${esc(n.requires)} |`);
  L.push('');
  L.push(`---`);
  L.push(`_Program CERTIFIED iff: (1) all six matrices present, (2) each ALL-CLEAN, (3) binding coherent, (4) §5`);
  L.push(`coverage complete — and (5) every SKIP/DEFERRED is on the ledger. Nonzero exit if NOT-CERTIFIED._`);
  return L.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// REAL PATH — load the six finding-JSONs for <runId> and consolidate.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function loadRealRaws(runId) {
  const rawByKey = {}; const paths = {};
  for (const spec of MATRICES) {
    const p = resolve(FINDINGS, `deepfix_${spec.key}_${runId}.json`);
    paths[spec.key] = p;
    if (!existsSync(p)) { rawByKey[spec.key] = undefined; continue; }
    try { rawByKey[spec.key] = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { rawByKey[spec.key] = { __parseError: String(e.message) }; }
  }
  return { rawByKey, paths };
}

function runReal(runId) {
  const { rawByKey, paths } = loadRealRaws(runId);
  const cert = evaluateCert(runId, rawByKey, { paths });
  if (!existsSync(FINDINGS)) mkdirSync(FINDINGS, { recursive: true });
  const jsonPath = resolve(FINDINGS, `DEEPFIX_AUDIT_CERT_${runId}.json`);
  const mdPath = resolve(FINDINGS, `DEEPFIX_AUDIT_CERT_${runId}.md`);
  writeFileSync(jsonPath, JSON.stringify(cert, null, 2));
  writeFileSync(mdPath, renderMd(cert));

  console.log(`\n=== DEEPFIX PROGRAM CERT (${runId}) ===`);
  for (const m of cert.matrices) console.log(`  ${m.present ? (m.clean ? '✅' : '❌') : '⬜'} ${m.label.padEnd(9)} present=${m.present} clean=${m.present ? m.clean : '-'} pass=${m.counts.pass} fail=${m.counts.fail} invalid=${m.counts.invalid} skip=${m.counts.skip} deferred=${m.counts.deferred} fatal=${m.fatals}`);
  console.log(`\n§5 coverage:`);
  for (const c of cert.coverage) console.log(`  ${icon(c.verdict)} ${c.phase.padEnd(4)} ${String(c.coveredCount + '/' + c.total).padEnd(6)} ${c.name}${c.uncovered.length ? `  UNCOVERED: ${c.uncovered.join(', ')}` : ''}`);
  if (cert.reasons.length) {
    console.log(`\n❌ ${cert.reasons.length} blocking reason(s):`);
    for (const r of cert.reasons) console.log(`   [${r.code}]${r.matrix ? ` (${r.matrix})` : ''} ${r.detail}`);
  }
  console.log(`\nartifacts:\n  ${jsonPath}\n  ${mdPath}`);
  console.log(`\n${cert.verdict === 'CERTIFIED' ? '✅ PROGRAM CERTIFIED' : '❌ PROGRAM NOT-CERTIFIED'} — runId=${runId}`);
  process.exit(cert.verdict === 'CERTIFIED' ? 0 : 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// SELF-CHECK — synthetic in-memory matrix-finding sets prove the cert logic (no live run needed).
//   Clean set ⇒ CERTIFIED. Each injected fault ⇒ NOT-CERTIFIED for the RIGHT reason code.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const HEAD0 = 'a967f544e0f3d4bce72861ad82a34d8e2ec27206';
const RULESHA0 = 'deadbeefcafef00d1234567890abcdef1234567890abcdef1234567890abcdef';
const FLAGSET_ON = Object.fromEntries([
  ...REQUIRED_FLAG_ON, 'SERVER_PROGRESS_WRITE', 'SERVER_RESET_PROGRESS', 'SERVER_CHALLENGE_WRITE',
  'SERVER_REVIEW_MARKER', 'SERVER_OVERRIDE', 'TEACHER_IDS_READ', 'CYCLING_ENABLED_SERVER',
  'CYCLING_ENABLED_CLIENT', 'CONTINUATION_LINKS', 'GRADE_TOKEN_ENFORCED',
].map((k) => [k, true]));

// What each matrix emits for a CLEAN, fully-covered, flag-ON, shipped program (native schema).
// Verdicts: PASS everywhere except the DOCUMENTED ledger legs (SKIP/DEFERRED).
const CLEAN_EMIT = {
  static: [['DG-1', 'PASS'], ['DG-2', 'SKIP'], ['DG-3', 'SKIP'], ['DG-4', 'PASS'], ['DG-4b', 'SKIP'],
    ['CUT-1', 'PASS'], ['CUT-1b', 'SKIP'], ['RET-1', 'PASS'], ['RET-2:dup_resume_branch', 'PASS'], ['RET-4', 'PASS']],
  ui: 'RA1 RA2 RA3 RA5 RA5b RA6 RA7 RA8 RA9 RO-S1 RO-S9 RO-S10 RS-1 RS-2 RS-3 RS-4 CUT-2 CUT-3 CUT-4 CUT-7 CUT-8 CA-1 CA-2 CA-3 CA-4 CA-5 CA-6 CY-1 CY-2 CY-3 CY-4 CY-5 CY-6 CY-7 OV-1 OV-4 OV-5'.split(' ').map((id) => [id, 'PASS']),
  wb: [['W-RA3g', 'PASS'], ['W-RA4', 'PASS'], ['W-RA4b', 'PASS'], ['CS-11', 'PASS'], ['CUT-5', 'PASS'], ['CUT-6', 'PASS']],
  call: [['CS-1', 'PASS'], ['CS-1e', 'PASS'], ['CS-2', 'PASS'], ['CS-3', 'PASS'], ['CS-4a', 'PASS'], ['CS-4b', 'PASS'], ['CS-4c', 'PASS'],
    ['CS-5', 'PASS'], ['CS-6f', 'PASS'], ['CS-6v', 'PASS'], ['CS-7', 'SKIP'], ['CS-8a', 'PASS'], ['CS-8b', 'PASS'], ['CS-8c', 'PASS'],
    ['CS-9', 'PASS'], ['CS-10', 'SKIP'], ['CS-11m', 'PASS'], ['CS-11a', 'PASS'], ['OV-1', 'PASS'], ['OV-2', 'PASS'],
    ['OV-3c', 'PASS'], ['OV-3p', 'PASS'], ['CY-3', 'PASS']],
  rules: [['RUL-1', 'PASS'], ['RUL-2', 'PASS'], ['RUL-3', 'PASS'], ['RUL-4', 'PASS'], ['RUL-5', 'PASS'], ['RUL-6', 'PASS'],
    ['RUL-7', 'PASS'], ['RUL-8', 'PASS'], ['RUL-9', 'PASS'], ['OV-6w', 'PASS'], ['OV-6r', 'PASS']],
  mig: [['SELF-EVAL', 'PASS'], ['MIG-1', 'PASS'], ['MIG-2', 'PASS'], ['MIG-3', 'PASS'], ['MIG-4', 'PASS'], ['MIG-5', 'PASS'],
    ['MIG-8', 'PASS'], ['MIG-9', 'PASS'], ['MIG-9-backup', 'PASS'], ['MIG-10a', 'PASS'], ['MIG-10b', 'DEFERRED'],
    ['MIG-6', 'DEFERRED'], ['MIG-7', 'DEFERRED'], ['MIG-9-commit', 'DEFERRED'], ['MIG-10-commit', 'DEFERRED'], ['RET-3', 'DEFERRED'], ['MIG-TID', 'SKIP']],
};

function buildRaw(key, emit, { runId, gitHead = HEAD0, rulesSha = RULESHA0, flagSet = FLAGSET_ON, target = 'shipped', fatals = [] } = {}) {
  const results = emit.map(([id, verdict]) => ({ id, verdict }));
  const common = { runId, verdict: 'CLEAN' };
  if (key === 'static') return { ...common, matrix: 'M-STATIC', git: { head: gitHead, short: gitHead.slice(0, 7), dirty: false }, target, assertions: results };
  if (key === 'mig') return { ...common, matrix: 'M-MIG', git: { head: gitHead, short: gitHead.slice(0, 7), dirty: false }, migrationVersion: 'P5-FND-3-v1', verdict: 'DRY_CLEAN', assertions: results };
  if (key === 'call' || key === 'rules') return { ...common, matrix: `M-${key.toUpperCase()}`, git: { head: gitHead, short: gitHead.slice(0, 7), dirty: true }, rulesSha256: rulesSha, flagSet, emulator: { project: 'demo-vocaboost' }, results };
  // ui / wb
  return { runId, matrix: key === 'ui' ? 'M-UI' : 'M-WB', gitHead, gitDirty: false, base: 'http://localhost:5173', buildId: 'build0', fatals, results, cleanCount: results.filter((r) => r.verdict === 'PASS').length, verdict: 'PASS' };
}

function buildCleanSet(runId, overrides = {}) {
  const raws = {};
  for (const spec of MATRICES) raws[spec.key] = buildRaw(spec.key, CLEAN_EMIT[spec.key], { runId, ...(overrides[spec.key] || {}) });
  return raws;
}
/** Replace a single scenario's verdict inside a synthetic raw (mutates a fresh copy). */
function mutateVerdict(raws, key, scenarioId, verdict) {
  const spec = MATRICES.find((m) => m.key === key);
  const field = spec.resultsField;
  const clone = JSON.parse(JSON.stringify(raws));
  const row = clone[key][field].find((r) => r.id === scenarioId);
  if (!row) throw new Error(`self-check bug: ${key} has no scenario ${scenarioId}`);
  row.verdict = verdict;
  return clone;
}

function selfCheck() {
  const RID = 'selfcheck';
  const cases = [];

  // Case 0 — the all-clean set ⇒ CERTIFIED, zero reasons.
  cases.push({
    name: 'all-clean ⇒ CERTIFIED',
    raws: buildCleanSet(RID),
    expectVerdict: 'CERTIFIED',
    expectCodes: [], // exactly none
  });

  // Case 1 — a FAIL in M-CALL ⇒ NOT-CERTIFIED (MATRIX_NOT_CLEAN).
  cases.push({
    name: 'FAIL injected (M-CALL CS-1) ⇒ MATRIX_NOT_CLEAN',
    raws: mutateVerdict(buildCleanSet(RID), 'call', 'CS-1', 'FAIL'),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['MATRIX_NOT_CLEAN'],
  });

  // Case 2 — a missing matrix (drop M-RULES) ⇒ NOT-CERTIFIED (MISSING_MATRIX) + coverage falls out.
  {
    const raws = buildCleanSet(RID); delete raws.rules;
    cases.push({ name: 'missing matrix (M-RULES absent) ⇒ MISSING_MATRIX', raws, expectVerdict: 'NOT-CERTIFIED', expectCodes: ['MISSING_MATRIX'] });
  }

  // Case 3 — binding mismatch: M-STATIC ran a DIFFERENT git HEAD ⇒ BINDING_GIT_HEAD.
  cases.push({
    name: 'binding: git HEAD mismatch (M-STATIC) ⇒ BINDING_GIT_HEAD',
    raws: buildCleanSet(RID, { static: { gitHead: 'ffffffffffffffffffffffffffffffffffffffff' } }),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['BINDING_GIT_HEAD'],
  });

  // Case 3b — binding mismatch: M-CALL vs M-RULES bound different firestore.rules sha ⇒ BINDING_RULES_SHA.
  cases.push({
    name: 'binding: rules sha mismatch (M-RULES) ⇒ BINDING_RULES_SHA',
    raws: buildCleanSet(RID, { rules: { rulesSha: '0000000000000000000000000000000000000000000000000000000000000000' } }),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['BINDING_RULES_SHA'],
  });

  // Case 3c — binding mismatch: M-STATIC ran the BASELINE (flag-off) target ⇒ BINDING_STATIC_TARGET.
  cases.push({
    name: 'binding: M-STATIC target=baseline ⇒ BINDING_STATIC_TARGET',
    raws: buildCleanSet(RID, { static: { target: 'baseline' } }),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['BINDING_STATIC_TARGET'],
  });

  // Case 3d — binding mismatch: M-CALL ran flag-OFF (a required flag false) ⇒ BINDING_FLAG_OFF + BINDING_FLAGSET.
  {
    const off = { ...FLAGSET_ON, ANCHOR_VALIDATION_ENFORCE: false };
    cases.push({
      name: 'binding: M-CALL flag-OFF ⇒ BINDING_FLAG_OFF',
      raws: buildCleanSet(RID, { call: { flagSet: off } }),
      expectVerdict: 'NOT-CERTIFIED', expectCodes: ['BINDING_FLAG_OFF'],
    });
  }

  // Case 4 — an OFF-LEDGER skip (M-UI CA-1 SKIP; CA-1 not on any ledger) ⇒ UNEXPECTED_SKIP.
  cases.push({
    name: 'off-ledger skip (M-UI CA-1 SKIP) ⇒ UNEXPECTED_SKIP',
    raws: mutateVerdict(buildCleanSet(RID), 'ui', 'CA-1', 'SKIP'),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['UNEXPECTED_SKIP'],
  });

  // Case 4b — a --dry-only M-MIG (MIG-1 DEFERRED, off-ledger) ⇒ UNEXPECTED_SKIP (P5 unaudited).
  cases.push({
    name: '--dry-only M-MIG (MIG-1 DEFERRED, off-ledger) ⇒ UNEXPECTED_SKIP',
    raws: mutateVerdict(buildCleanSet(RID), 'mig', 'MIG-1', 'DEFERRED'),
    expectVerdict: 'NOT-CERTIFIED', expectCodes: ['UNEXPECTED_SKIP'],
  });

  // Case 5 — runId self-binding: a matrix carrying the WRONG internal runId ⇒ RUNID_MISMATCH (+ not-clean).
  {
    const raws = buildCleanSet(RID); raws.wb.runId = 'someOtherRun';
    cases.push({ name: 'wrong internal runId (M-WB) ⇒ RUNID_MISMATCH', raws, expectVerdict: 'NOT-CERTIFIED', expectCodes: ['RUNID_MISMATCH'] });
  }

  // Case 6 — coverage hole: strip P8 entirely (drop all CA-* from M-UI) ⇒ COVERAGE_UNAUDITED.
  {
    const raws = buildCleanSet(RID);
    raws.ui.results = raws.ui.results.filter((r) => !/^CA-/.test(r.id));
    cases.push({ name: 'coverage hole (drop P8 CA-*) ⇒ COVERAGE_UNAUDITED', raws, expectVerdict: 'NOT-CERTIFIED', expectCodes: ['COVERAGE_UNAUDITED'] });
  }

  // Case 7 — the KITCHEN-SINK set (FAIL + missing + binding + off-ledger skip) ⇒ NOT-CERTIFIED, all codes.
  {
    let raws = buildCleanSet(RID, { static: { gitHead: 'ffffffffffffffffffffffffffffffffffffffff' } });
    raws = mutateVerdict(raws, 'call', 'CS-2', 'FAIL');
    raws = mutateVerdict(raws, 'ui', 'RO-S1', 'SKIP');
    delete raws.wb;
    cases.push({
      name: 'kitchen-sink (FAIL + missing + binding + off-ledger skip) ⇒ NOT-CERTIFIED, multi-code',
      raws, expectVerdict: 'NOT-CERTIFIED',
      expectCodes: ['MATRIX_NOT_CLEAN', 'MISSING_MATRIX', 'BINDING_GIT_HEAD', 'UNEXPECTED_SKIP'],
    });
  }

  // Run + assert.
  console.log(`\n=== lsr_deepfix_cert.mjs — SELF-CHECK (synthetic matrix-finding sets) ===\n`);
  let failed = 0;
  for (const c of cases) {
    const cert = evaluateCert(RID, c.raws);
    const codes = cert.reasonCodes;
    const verdictOk = cert.verdict === c.expectVerdict;
    // every expected code present; for the all-clean case, expect EXACTLY zero reasons.
    const codesOk = c.expectCodes.length === 0
      ? codes.length === 0
      : c.expectCodes.every((code) => codes.includes(code));
    const ok = verdictOk && codesOk;
    if (!ok) failed++;
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}`);
    console.log(`       → verdict=${cert.verdict}${verdictOk ? '' : ` (EXPECTED ${c.expectVerdict})`}  codes=[${codes.join(', ') || '—'}]`);
    if (!codesOk) console.log(`       → EXPECTED codes ⊇ [${c.expectCodes.join(', ') || '(none)'}]`);
  }
  const total = cases.length;
  console.log(`\n${failed === 0 ? '✅ SELF-CHECK PASS' : '❌ SELF-CHECK FAIL'} — ${total - failed}/${total} cases behaved as specified.`);
  console.log(`(clean synthetic ⇒ CERTIFIED; each injected fault ⇒ NOT-CERTIFIED for its own reason code.)`);
  process.exit(failed === 0 ? 0 : 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════════════════════
if (SELF_CHECK) {
  selfCheck();
} else {
  if (!RUN_ID) {
    console.error('usage: node audit/playwright/lsr_deepfix_cert.mjs <runId> [--self-check] [--findings=<dir>]');
    process.exit(2);
  }
  runReal(RUN_ID);
}

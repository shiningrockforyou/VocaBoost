/**
 * lsr_deepfix_emu.mjs — shared EMULATOR plumbing for the two flag-on probe
 * matrices M-CALL (`lsr_deepfix_callable.mjs`) and M-RULES (`lsr_deepfix_rules.mjs`).
 *
 * Built to Codex's CONFIRMED execution model (docs/plans/loop/codex_reviews/
 * codex_deepfix_task6_emulator_probe_001.md):
 *   • The matrix is invoked as the CHILD of
 *       firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost \
 *         "node <matrix>.mjs <runId>"
 *     so `emulators:exec` has already set FIRESTORE_EMULATOR_HOST /
 *     FIREBASE_AUTH_EMULATOR_HOST and the functions emulator is live on :5001.
 *   • SEED with the Admin SDK (points at the emulator via those env vars) — NOT the
 *     Web SDK (Codex: it hung + timed out in the Node shell).
 *   • M-RULES: create Auth-emulator users via REST (accounts:signUp) → ID token → hit
 *     Firestore REST with `Authorization: Bearer <token>` → assert EXACT status codes.
 *   • M-CALL: POST the functions-emulator callables with the callable-protocol JSON
 *     ({data:{...}}) + a bearer token → assert response / side-effect oracles.
 *
 * FAIL-CLOSED, EMULATOR-ONLY (AUDIT_DESIGN §2 / §4.1):
 *   • REFUSES to run unless FIRESTORE_EMULATOR_HOST is set — a probe must NEVER hit prod.
 *     (INVALID + nonzero exit if unset, or if the project is not the demo emulator project.)
 *   • Sandbox-identity guard: only /^lsr_.*@vocaboost\.test$/ emails, `25WT`-prefixed
 *     classIds, `lsrlist_`-prefixed listIds. Any non-sandbox target hard-throws.
 *   • `demo-vocaboost` project — emulator-only; no serviceAccountKey, no prod credentials.
 *
 * This module is imported (not run directly). It has NO browser / Playwright dep.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import admin from 'firebase-admin';

// ── Paths ──
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
export const FINDINGS = resolve(HERE, 'findings');

// ── The demo emulator project (NEVER a prod project id) ──
export const EMU_PROJECT = 'demo-vocaboost';
export const REGION = process.env.CF_REGION || 'us-central1';

// ── Sandbox-identity discipline (AUDIT_DESIGN §2 / §4.1 — the NEW-module guards) ──
export const IDENTITY_REGEX = /^lsr_.*@vocaboost\.test$/;
// NOTE: classId/listId must be UNDERSCORE-FREE (like prod Firestore auto-ids): the app's
// testId is `vocaboost_test_<classId>_<listId>_<phase>` and both the gradebook parse
// (`/^vocaboost_test_[^_]+_([^_]+)_/`) and the challenge/override day-advance
// (`testId.split('_')`) tokenise on `_`. An underscore inside an id would corrupt those parses.
export const SANDBOX_CLASS_PREFIX = '25WT';
export const SANDBOX_LIST_PREFIX = 'lsrlist';
/** Alphanumeric-only slug for an id component (strips `_`/`.`/`-` so testId parses stay clean). */
export const cleanId = (s) => String(s).replace(/[^A-Za-z0-9]/g, '');
export const SANDBOX_PASSWORD = process.env.LSR_AUDIT_PW || 'AuditPass2026!';

/** Assert an email is a sandbox emulator identity or hard-throw (INVALID). */
export function assertSandboxEmail(email) {
  if (typeof email !== 'string' || !IDENTITY_REGEX.test(email)) {
    throw new Error(`SANDBOX GUARD: refusing non-sandbox identity "${email}" (must match ${IDENTITY_REGEX})`);
  }
  return email;
}

/**
 * Assert a write/probe target is sandbox-shaped BEFORE any request is sent
 * (§4.1: "assert every request path's {uid, classId, listId} against the sandbox
 * triple BEFORE sending"). classId/listId are optional per call.
 */
export function assertSandboxTarget({ classId, listId } = {}) {
  if (classId != null && !String(classId).startsWith(SANDBOX_CLASS_PREFIX)) {
    throw new Error(`SANDBOX GUARD: classId "${classId}" is not ${SANDBOX_CLASS_PREFIX}-prefixed`);
  }
  if (listId != null && !String(listId).startsWith(SANDBOX_LIST_PREFIX)) {
    throw new Error(`SANDBOX GUARD: listId "${listId}" is not ${SANDBOX_LIST_PREFIX}-prefixed`);
  }
  return true;
}

// ── Emulator-presence guard (fail-closed: unset host ⇒ INVALID, refuse prod) ──
/**
 * Returns {ok, reason, project, firestoreHost, authHost, cfHost}. When !ok the caller
 * must record the run INVALID and exit nonzero (NEVER proceed against prod).
 */
export function detectEmulator() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  const cfHost = process.env.CF_EMULATOR_HOST || '127.0.0.1:5001';
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    EMU_PROJECT;
  if (!firestoreHost) {
    return {
      ok: false,
      reason:
        'FIRESTORE_EMULATOR_HOST is UNSET — this matrix runs ONLY under ' +
        '`firebase emulators:exec` against the demo emulator. Refusing to run (never prod).',
      project, firestoreHost, authHost, cfHost,
    };
  }
  if (!authHost) {
    return {
      ok: false,
      reason:
        'FIREBASE_AUTH_EMULATOR_HOST is UNSET — the Auth emulator is required for ' +
        'sandbox ID-token minting. Refusing to run.',
      project, firestoreHost, authHost, cfHost,
    };
  }
  // Guard against a real project id sneaking in (defence-in-depth; emulators:exec uses demo-*).
  if (project !== EMU_PROJECT && !/^demo-/.test(project)) {
    return {
      ok: false,
      reason: `Project "${project}" is not the demo emulator project (expected ${EMU_PROJECT} or demo-*). Refusing to run.`,
      project, firestoreHost, authHost, cfHost,
    };
  }
  return { ok: true, reason: 'emulator detected', project, firestoreHost, authHost, cfHost };
}

// ── Admin SDK (routes at the emulator via FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST) ──
let _adminApp = null;
export function adminApp(project = EMU_PROJECT) {
  if (!_adminApp) _adminApp = admin.initializeApp({ projectId: project });
  return _adminApp;
}
export function adb(project = EMU_PROJECT) {
  adminApp(project);
  return admin.firestore();
}
export function aauth(project = EMU_PROJECT) {
  adminApp(project);
  return admin.auth();
}

// ── Auth-emulator REST (Codex's confirmed path) ──
function authBase() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  return `http://${host}/identitytoolkit.googleapis.com/v1`;
}

/** Create a sandbox Auth-emulator user; returns {uid, idToken, refreshToken, email}. */
export async function signUp(email, password = SANDBOX_PASSWORD) {
  assertSandboxEmail(email);
  const resp = await fetch(`${authBase()}/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`auth signUp failed (${resp.status}): ${JSON.stringify(json)}`);
  return { uid: json.localId, idToken: json.idToken, refreshToken: json.refreshToken, email };
}

/** Sign in an existing sandbox user; the emulator mints a token carrying CURRENT custom claims. */
export async function signIn(email, password = SANDBOX_PASSWORD) {
  assertSandboxEmail(email);
  const resp = await fetch(`${authBase()}/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`auth signIn failed (${resp.status}): ${JSON.stringify(json)}`);
  return { uid: json.localId, idToken: json.idToken, refreshToken: json.refreshToken, email };
}

/**
 * Mint a sandbox TEACHER identity: signUp → set the {role:'teacher'} custom claim via the
 * Admin SDK (the rules `isTeacher()` reads request.auth.token.role — the P10d claim model)
 * → re-signIn so the fresh ID token carries the claim. Returns {uid, idToken, email}.
 */
export async function makeTeacher(email, password = SANDBOX_PASSWORD) {
  const u = await signUp(email, password);
  await aauth().setCustomUserClaims(u.uid, { role: 'teacher' });
  const re = await signIn(email, password); // token now carries token.role === 'teacher'
  return { uid: re.uid, idToken: re.idToken, email };
}

/** Mint a sandbox STUDENT identity (no custom claim). Returns {uid, idToken, email}. */
export async function makeStudent(email, password = SANDBOX_PASSWORD) {
  return signUp(email, password);
}

// ── Firestore REST (client-identity allow/deny — the rules engine sees these) ──
function fsBase(project) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  return `http://${host}/v1/projects/${project}/databases/(default)/documents`;
}

/** Minimal typed-value encoder for the Firestore REST body (only the shapes probes use). */
export function toFields(obj) {
  const enc = (v) => {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    return { stringValue: String(v) };
  };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]));
}

/** REST GET a doc AS a client identity. Returns {status}. */
export async function restGet(project, path, idToken) {
  const resp = await fetch(`${fsBase(project)}/${path}`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  return { status: resp.status };
}

/** REST CREATE (POST ?documentId=) a doc AS a client identity. Returns {status}. */
export async function restCreate(project, collectionPath, docId, data, idToken) {
  const resp = await fetch(`${fsBase(project)}/${collectionPath}?documentId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return { status: resp.status };
}

/** REST PATCH (update) specific fields AS a client identity. Returns {status}. */
export async function restUpdate(project, path, data, idToken) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const resp = await fetch(`${fsBase(project)}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return { status: resp.status };
}

/** REST DELETE a doc AS a client identity. Returns {status}. */
export async function restDelete(project, path, idToken) {
  const resp = await fetch(`${fsBase(project)}/${path}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${idToken}` },
  });
  return { status: resp.status };
}

// ── Functions-emulator callable invocation (callable-protocol JSON + bearer) ──
/**
 * Invoke a callable on the functions emulator. Returns
 * {httpStatus, ok, result, errorStatus, errorMessage, raw}.
 * onCall maps thrown HttpsError codes to HTTP status + an error.status string
 * (e.g. failed-precondition→400/FAILED_PRECONDITION, permission-denied→403/PERMISSION_DENIED).
 */
export async function callFn(name, data, idToken, project = EMU_PROJECT) {
  const cfHost = process.env.CF_EMULATOR_HOST || '127.0.0.1:5001';
  const url = `http://${cfHost}/${project}/${REGION}/${name}`;
  const headers = { 'content-type': 'application/json' };
  if (idToken) headers.authorization = `Bearer ${idToken}`;
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data: data || {} }) });
  const text = await resp.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON body */ }
  return {
    httpStatus: resp.status,
    ok: resp.ok,
    result: parsed?.result ?? null,
    errorStatus: parsed?.error?.status ?? null,
    errorMessage: parsed?.error?.message ?? null,
    raw: text.slice(0, 400),
  };
}

// ── system_logs oracle (Admin read; server events are writtenBy:'cloud-function') ──
/** Count system_logs of `type` matching an optional predicate, since a cutoff ms. */
export async function countLogs(type, sinceMs = 0, predicate = null) {
  const snap = await adb().collection('system_logs').where('type', '==', type).get();
  let n = 0;
  const rows = [];
  for (const d of snap.docs) {
    const data = d.data();
    const ts = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
    if (sinceMs && ts && ts < sinceMs) continue;
    if (predicate && !predicate(data)) continue;
    n++; rows.push(data);
  }
  return { count: n, rows };
}

// ── Git-state binding (AUDIT_DESIGN §2.1) ──
export function gitState() {
  const sh = (c) => { try { return execSync(c, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return ''; } };
  const head = sh('git rev-parse HEAD') || 'unknown';
  const short = sh('git rev-parse --short HEAD') || 'unknown';
  const dirtyRows = sh('git status --porcelain').split('\n').filter(Boolean);
  return { head, short, dirty: dirtyRows.length > 0, dirtyCount: dirtyRows.length, dirtyRows };
}

/** sha256 of a repo file (for the firestore.rules binding — §2.2c).
 *  PORTABLE (WSL + native Windows): hash with Node's crypto instead of shelling to
 *  `sha256sum`, which is ABSENT under the Windows `emulators:exec` cmd.exe child — the
 *  r16 null-sha gap (M-CALL/M-RULES recorded rulesSha256=null on David's box). */
export function sha256File(rel) {
  try {
    const abs = resolve(REPO, rel);
    if (!existsSync(abs)) return null;
    return createHash('sha256').update(readFileSync(abs)).digest('hex');
  } catch { return null; }
}

// ── The flag-set the emulator ACTUALLY loaded (binds the manifest; proves flag-ON) ──
function readBool(text, name) {
  if (text == null) return null;
  const m = text.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(true|false)\\b`));
  return m ? m[1] === 'true' : null;
}
/** Read every flag relevant to the flag-on end-state from the three source files. */
export function readFlagState() {
  const ff = existsSync(resolve(REPO, 'src/config/featureFlags.js')) ? readFileSync(resolve(REPO, 'src/config/featureFlags.js'), 'utf8') : null;
  const fnd = existsSync(resolve(REPO, 'functions/foundation.js')) ? readFileSync(resolve(REPO, 'functions/foundation.js'), 'utf8') : null;
  const idx = existsSync(resolve(REPO, 'functions/index.js')) ? readFileSync(resolve(REPO, 'functions/index.js'), 'utf8') : null;
  return {
    // server FOUNDATION_FLAGS (functions/foundation.js)
    SERVER_COMPLETE_SESSION_ENABLED: readBool(fnd, 'SERVER_COMPLETE_SESSION_ENABLED'),
    SERVER_RESOLVE_LIST_PROGRESS_ENABLED: readBool(fnd, 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED'),
    SERVER_RESET_PROGRESS_ENABLED: readBool(fnd, 'SERVER_RESET_PROGRESS_ENABLED'),
    SERVER_ADVANCE_FOR_CHALLENGE_ENABLED: readBool(fnd, 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED'),
    LIST_PROGRESS_CANONICAL: readBool(fnd, 'LIST_PROGRESS_CANONICAL'),
    ANCHOR_VALIDATION_SHADOW: readBool(fnd, 'ANCHOR_VALIDATION_SHADOW'),
    ANCHOR_VALIDATION_ENFORCE: readBool(fnd, 'ANCHOR_VALIDATION_ENFORCE'),
    CYCLING_ENABLED_SERVER: readBool(fnd, 'CYCLING_ENABLED'),
    SERVER_REVIEW_CHALLENGE_ENABLED: readBool(fnd, 'SERVER_REVIEW_CHALLENGE_ENABLED'),
    SERVER_OVERRIDE_ENABLED: readBool(fnd, 'SERVER_OVERRIDE_ENABLED'),
    TEACHER_IDS_WRITE_ENABLED: readBool(fnd, 'TEACHER_IDS_WRITE_ENABLED'),
    // client featureFlags.js
    SERVER_PROGRESS_WRITE: readBool(ff, 'SERVER_PROGRESS_WRITE'),
    SERVER_RESET_PROGRESS: readBool(ff, 'SERVER_RESET_PROGRESS'),
    SERVER_CHALLENGE_WRITE: readBool(ff, 'SERVER_CHALLENGE_WRITE'),
    SERVER_REVIEW_MARKER: readBool(ff, 'SERVER_REVIEW_MARKER'),
    SERVER_OVERRIDE: readBool(ff, 'SERVER_OVERRIDE'),
    TEACHER_IDS_READ: readBool(ff, 'TEACHER_IDS_READ'),
    CYCLING_ENABLED_CLIENT: readBool(ff, 'CYCLING_ENABLED'),
    CONTINUATION_LINKS: readBool(ff, 'CONTINUATION_LINKS'),
    // functions/index.js
    GRADE_TOKEN_ENFORCED: readBool(idx, 'GRADE_TOKEN_ENFORCED'),
  };
}

// ── A tiny scenario runner + fail-closed manifest writer (matches lsr_deepfix_static.mjs) ──
export class Matrix {
  constructor({ matrix, runId, emu }) {
    this.matrix = matrix; // 'call' | 'rules'
    this.runId = runId;
    this.emu = emu;
    this.git = gitState();
    this.flags = readFlagState();
    this.startedAt = new Date().toISOString();
    this.results = []; // {id, scenario, expected, actual, verdict, evidence, triple}
  }

  record(r) {
    const verdict = r.verdict;
    if (!['PASS', 'FAIL', 'INVALID', 'SKIP'].includes(verdict)) throw new Error(`bad verdict ${verdict}`);
    this.results.push(r);
    const icon = { PASS: 'PASS ', FAIL: 'FAIL ', INVALID: 'INVAL', SKIP: 'SKIP ' }[verdict];
    console.log(`  [${icon}] ${String(r.id).padEnd(8)} ${r.scenario}`);
    if (verdict !== 'PASS' && verdict !== 'SKIP') console.log(`           ↳ ${r.evidence || ''}`);
    return r;
  }

  /** Run one scenario fn (async) → PASS/FAIL/INVALID captured; a throw ⇒ FAIL with the message. */
  async run(id, scenario, fn) {
    try {
      const out = await fn();
      // fn returns {verdict, expected, actual, evidence, triple?}
      return this.record({ id, scenario, ...out });
    } catch (err) {
      return this.record({
        id, scenario, expected: 'no throw',
        actual: `threw: ${err.message}`, verdict: 'FAIL',
        evidence: (err.stack || String(err)).split('\n').slice(0, 3).join(' | '),
      });
    }
  }

  finish() {
    const summary = {
      pass: this.results.filter((r) => r.verdict === 'PASS').length,
      fail: this.results.filter((r) => r.verdict === 'FAIL').length,
      invalid: this.results.filter((r) => r.verdict === 'INVALID').length,
      skip: this.results.filter((r) => r.verdict === 'SKIP').length,
    };
    // CLEAN iff every ATTEMPTED (non-SKIP) scenario is PASS and there are zero INVALID.
    const clean = summary.fail === 0 && summary.invalid === 0;
    const manifest = {
      matrix: `M-${this.matrix.toUpperCase()}`,
      runId: this.runId,
      emulator: this.emu, // {project, firestoreHost, authHost, cfHost}
      git: this.git,
      rulesSha256: sha256File('firestore.rules'),
      flagSet: this.flags,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      summary,
      verdict: clean ? 'CLEAN' : 'NOT_CLEAN',
      results: this.results,
    };
    if (!existsSync(FINDINGS)) mkdirSync(FINDINGS, { recursive: true });
    const jsonPath = resolve(FINDINGS, `deepfix_${this.matrix}_${this.runId}.json`);
    const mdPath = resolve(FINDINGS, `deepfix_${this.matrix}_${this.runId}.md`);
    writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));

    const icon = (v) => (v === 'PASS' ? 'PASS' : v === 'FAIL' ? 'FAIL' : v === 'INVALID' ? 'INVALID' : 'SKIP');
    const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const md = [
      `# M-${this.matrix.toUpperCase()} — deepfix flag-on emulator probe`,
      ``,
      `- **runId:** \`${this.runId}\``,
      `- **emulator:** project=\`${this.emu.project}\` firestore=\`${this.emu.firestoreHost}\` auth=\`${this.emu.authHost}\` functions=\`${this.emu.cfHost}\``,
      `- **git:** \`${this.git.short}\` (HEAD \`${this.git.head}\`) dirty=${this.git.dirty} (${this.git.dirtyCount} paths)`,
      `- **firestore.rules sha256:** \`${manifest.rulesSha256}\``,
      `- **run:** ${this.startedAt}`,
      ``,
      `**FLAG-SET (as the emulator loaded it):**`,
      '```json',
      JSON.stringify(this.flags, null, 2),
      '```',
      ``,
      `**FINAL: ${clean ? 'CLEAN' : 'NOT_CLEAN'}** pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} skip=${summary.skip}`,
      ``,
      `| | ID | Scenario | Expected | Actual | Verdict |`,
      `|---|---|---|---|---|---|`,
      ...this.results.map((r) => `| ${icon(r.verdict)} | ${esc(r.id)} | ${esc(r.scenario)} | ${esc(r.expected)} | ${esc(r.actual)} | **${r.verdict}** |`),
      ``,
      `## Evidence`,
      ...this.results.map((r) => `- **${r.id}** (${r.verdict}): ${esc(r.evidence)}`),
      ``,
    ].join('\n');
    writeFileSync(mdPath, md);

    console.log(`\nartifacts:\n  ${jsonPath}\n  ${mdPath}`);
    console.log(`\nFINAL: ${clean ? 'CLEAN' : 'NOT_CLEAN'} pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} skip=${summary.skip}`);
    return { clean, manifest };
  }
}

// ── Small assertion helpers for scenario bodies ──
export function pass(expected, actual, evidence = '') {
  return { verdict: 'PASS', expected, actual, evidence };
}
export function fail(expected, actual, evidence = '') {
  return { verdict: 'FAIL', expected, actual, evidence };
}
export function skip(expected, reason) {
  return { verdict: 'SKIP', expected, actual: 'skipped', evidence: reason };
}
export function expect(cond, expected, actual, evidence = '') {
  return cond ? pass(expected, actual, evidence) : fail(expected, actual, evidence);
}

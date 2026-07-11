/**
 * Run L — DRIVER smoke (Admin-free, sacrificial). Validates the measured-interaction primitives
 * the fixture/--pre smoke structurally CANNOT (they never drive a session): a fresh teacher-made
 * typed class → student joins → studies a full Day-1 → passed-results card → visible day 1→2, AND
 * the enter-session-only → Quit→Leave exit flow. Purely a pre-check; no binding/verdict/certification.
 * Run this BEFORE committing to a full measured Run L, so driver breakage is caught cheaply.
 *
 *   LSR_BUILD_ID=… LSR_AUDIT_PW=… NODE_PATH=/app/node_modules node audit/playwright/lsr_runL_driversmoke.mjs
 */
import { readFileSync } from 'fs';
const AUD = '/app/audit/playwright';
const { makeFindings, launch, newAuditPage, login, goDashboard, driveNewWordsToTest, driveTest, readVisibleProgress, switchClass, selectList, enterSessionOnly, leaveSessionViaQuit } = await import('./lsr_ui.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');
const { joinClass } = await import('./lsr_ui.mjs');

const CASES = JSON.parse(readFileSync(`${AUD}/lsr_runL_cases.json`, 'utf8'));
const LIST = CASES.list;
const CLEAN = JSON.parse(readFileSync(`${AUD}/lsr_clean_accounts.json`, 'utf8')).clean;
const stamp = Date.now().toString(36);
const TEACHER = 'lsr_teacher_01@vocaboost.test';
const F = makeFindings(`RUNLDRVSMOKE_${stamp}`);
if (!CLEAN.length) { console.error('no clean sacrificial account — run lsr_preflight.mjs'); process.exit(2); }
const SAC = CLEAN[CLEAN.length - 1]; // use the LAST clean account so the fixture's first-N stay untouched

const results = {};
const browser = await launch();
try {
  // Teacher makes a fresh typed class + assigns the list.
  const { page: tp } = await newAuditPage(browser, F, 'drvsmoke-teacher');
  await login(tp, TEACHER, F);
  const className = `25WT RUNLSMOKE ${stamp}`;
  await createClass(tp, className, F);
  await assignList(tp, className, LIST.title, { pace: 80, thr: 92, mode: 'typed', testSize: 30 }, F);
  const code = await readJoinCode(tp, className, F);
  await tp.context().close();
  results.classMade = !!code;

  // Student joins + studies a full Day-1.
  const { page } = await newAuditPage(browser, F, 'drvsmoke-stu');
  await login(page, SAC, F);
  results.joined = await joinClass(page, code, className, F, 'drvsmoke');
  await goDashboard(page);
  const before = await readVisibleProgress(page).catch(() => ({}));
  results.dayBefore = before.day ?? null; // expect 1 (proves the fresh class dashboard is studyable)
  const t = await driveNewWordsToTest(page, F, 'drvsmoke');
  results.testReached = t.reached; // the thing the real run FAILED on for the split-brain class
  if (t.reached) { const { outcome } = await driveTest(page, F, 'drvsmoke'); results.outcome = outcome; }
  await goDashboard(page);
  const after = await readVisibleProgress(page).catch(() => ({}));
  results.dayAfter = after.day ?? null; // expect 2

  // Enter-only → Quit→Leave exit (the L2 interaction that cascaded).
  await switchClass(page, className, F);
  await selectList(page, LIST.title, F, 'drvsmoke');
  const e = await enterSessionOnly(page, F, 'drvsmoke-enter');
  results.entered = e.entered;
  results.leftViaQuit = await leaveSessionViaQuit(page, F, 'drvsmoke');
  await page.context().close();
} catch (e) { F.add('scenario-error', `driversmoke: ${String(e).slice(0, 160)}`); }
await browser.close();

const pass = results.classMade && results.joined && results.dayBefore === 1 && results.testReached && results.outcome === 'results' && results.dayAfter === 2 && results.entered && results.leftViaQuit;
console.log('\n=== DRIVER SMOKE ===');
console.log(JSON.stringify(results, null, 2));
console.log(pass ? '\n✅ driver primitives OK — full measured Run L is justified' : '\n❌ driver primitives BROKEN — fix before a full run (see findings)');
process.exit(pass ? 0 : 1);

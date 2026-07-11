/**
 * Run L — fixture builder (Admin-FREE, forward-only). Creates FRESH per-run classes via the
 * teacher UI (isolation — avoids the drift/split-brain of the reused persona classes, e.g. the
 * `assignedLists:[]` bug that broke L1-T/R) and joins the personas.
 *   - L1-T/M/R: a fresh preflight-clean account joins a fresh teacher-created typed/MCQ class.
 *   - L2: keeps classA = the persona's EXISTING historical anchor class (has the day≥2 winning
 *     anchor); joins a FRESH classB (same list) so B is genuinely empty.
 * Writes the bound `runL_fixture_<runId>.json`.
 *
 *   LSR_BUILD_ID=… LSR_AUDIT_PW=… NODE_PATH=/app/node_modules node audit/playwright/lsr_runL_fixture.mjs <runId>
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';

const runId = process.argv[2];
if (!runId) { console.error('usage: lsr_runL_fixture.mjs <runId>'); process.exit(2); }
const AUD = '/app/audit/playwright';
// Delete any prior fixture FIRST — before any fallible step — so a failure can't leave a stale one.
try { rmSync(`${AUD}/findings/runL_fixture_${runId}.json`); } catch { /* absent */ }
const BUILD_ID = process.env.LSR_BUILD_ID;
if (!BUILD_ID) { console.error('LSR_BUILD_ID is REQUIRED (owner-supplied deployed build id/commit)'); process.exit(2); }
const { makeFindings, launch, newAuditPage, login, joinClass } = await import('./lsr_ui.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');

const CASES = JSON.parse(readFileSync(`${AUD}/lsr_runL_cases.json`, 'utf8'));
const LIST = CASES.list;
const TEACHER = 'lsr_teacher_01@vocaboost.test';
const OPTS = { pace: 80, thr: 92, testSize: 30 };
const CLEAN = existsSync(`${AUD}/lsr_clean_accounts.json`) ? JSON.parse(readFileSync(`${AUD}/lsr_clean_accounts.json`, 'utf8')).clean : [];
const emailOf = (u) => (u.includes('@') ? u : `${u}@vocaboost.test`);

// Allocate fresh clean accounts to the L1 cases; the pinned persona to L2.
const freshCases = CASES.cases.filter((c) => c.role === 'fresh');
if (CLEAN.length < freshCases.length) { console.error(`need ${freshCases.length} preflight-clean accounts, have ${CLEAN.length}`); process.exit(2); }
const alloc = {};
freshCases.forEach((c, i) => { alloc[c.id] = CLEAN[i]; });
const l2 = CASES.cases.find((c) => c.id === 'L2');
if (l2) alloc.L2 = emailOf(l2.classA_preferUid);

const F = makeFindings(`RUNLFIX_${runId}`);
const fixture = { runId, buildId: BUILD_ID, list: LIST, at: new Date().toISOString(), cases: {} };

console.log(`\n▶ Run L fixture builder (${runId}) — fresh teacher-created classes, forward-only\n`);
const browser = await launch();
let ok = true;

// 1) Teacher creates the fresh per-run classes (one per L1 case + L2-B) and assigns the list.
const { page: tp } = await newAuditPage(browser, F, 'fix-teacher');
const tok = await login(tp, TEACHER, F);
if (!tok) { F.add('fixture-fail', 'teacher login failed'); ok = false; }
const freshClasses = {}; // caseId → { className, code, mode }
async function makeClass(tag, mode) {
  const className = `25WT RUNL ${tag} ${runId}`;
  await createClass(tp, className, F);
  await assignList(tp, className, LIST.title, { ...OPTS, mode }, F);
  const code = await readJoinCode(tp, className, F);
  if (!code) { F.add('fixture-fail', `[${tag}] no join code for fresh class`); ok = false; }
  return { className, code, mode };
}
if (tok) {
  for (const c of freshCases) freshClasses[c.id] = await makeClass(c.id, c.mode);
  freshClasses.L2B = await makeClass('L2B', l2?.mode || 'typed');
}
await tp.context().close().catch(() => {});

// 2) Students join their fresh classes (L2's persona joins the fresh classB; classA stays historical).
for (const c of CASES.cases) {
  const email = alloc[c.id];
  const target = c.role === 'fresh' ? freshClasses[c.id] : freshClasses.L2B;
  const rec = { role: c.role, mode: c.mode, listId: LIST.id, email,
    class: c.role === 'fresh' ? (target?.className || null) : null,
    classB: c.role === 'collision' ? (target?.className || null) : null,
    joinTarget: target?.className || null, joined: false };
  if (!tok || !target?.code) { F.add('fixture-fail', `[${c.id}] no fresh class/code`); ok = false; fixture.cases[c.id] = rec; continue; }
  const { page } = await newAuditPage(browser, F, `fix-${c.id}`);
  try {
    const li = await login(page, email, F);
    if (!li) { F.add('fixture-fail', `[${c.id}] login failed ${email}`); ok = false; }
    else { rec.joined = await joinClass(page, target.code, target.className, F, c.id); if (!rec.joined) ok = false; }
  } catch (e) { F.add('fixture-fail', `[${c.id}] ${String(e).slice(0, 140)}`); ok = false; }
  fixture.cases[c.id] = rec;
  console.log(`  ${rec.joined ? '✅' : '❌'} ${c.id} (${email}) → join "${target.className}" = ${rec.joined}`);
  await page.context().close().catch(() => {});
}
await browser.close();

fixture.ok = ok;
writeFileSync(`${AUD}/findings/runL_fixture_${runId}.json`, JSON.stringify(fixture, null, 2));
console.log(`\n${ok ? '✅' : '❌'} fixture → findings/runL_fixture_${runId}.json`);
console.log(`NEXT: lsr_runL_verify.mjs --pre ${runId}`);
process.exit(ok ? 0 : 1);

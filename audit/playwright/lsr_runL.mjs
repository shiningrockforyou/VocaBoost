/**
 * B_LIST_PROGRESS_PHASE1_UI — Run L (flag-OFF regression). Policy-bound (see batch doc).
 * Order: PRE-GATE (node-side deploy verification, no browser) → [operator ran
 * lsr_snapshot.mjs --pre and the Admin process EXITED] → browser cases → close →
 * [operator runs lsr_snapshot.mjs --post].
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_runL.mjs
 *
 * Personas come from lsr_personas.json (operator confirms from the --pre
 * classification): { "P_L1": "email", "P_L2": "email" }  — forward-only, no resets.
 * L2 requires P_L2 to already be dual-enrolled; if absent it is reported skipped.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  BASE, AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard,
  switchClass, driveNewWordsToTest, driveReviewToTest, readTestRows, carefulAnswers,
  fillSubmitAndObserve, assertVerdictCoherent, shot, runMeta,
  answerMcqVisible, submitMcqAndObserve,
} from './lsr_ui.mjs';

const runId = `L_${new Date().toISOString().slice(0, 10)}`;
const F = makeFindings(runId);
const R = { run: 'L', startedAt: new Date().toISOString(), cases: {}, pass: true };
const caseResult = (name, ok, note, detail = {}) => {
  R.cases[name] = { ok, note, ...detail };
  if (ok === false) R.pass = false;
  console.log(`${ok === false ? '❌' : ok === 'skip' ? '⏸' : '✅'} ${name} — ${note}`);
  F.add(ok === false ? 'CASE-FAIL' : ok === 'skip' ? 'CASE-SKIP' : 'CASE-PASS', `${name} — ${note}`);
};

// ---- PRE-GATE: deploy verification (node-side, before any browser; policy §3 record) ----
let headSha = null; try { headSha = execSync('git -C /app rev-parse HEAD').toString().trim(); } catch { /* */ }
const projectId = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8')).project_id;
let ver = null;
try {
  const res = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/version`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: {} }) });
  ver = (await res.json())?.result || null;
} catch (e) { F.add('pre-gate', `version callable unreachable: ${String(e).slice(0, 120)}`); }
let bundleFresh = false;
try {
  const html = await (await fetch(BASE)).text();
  const srcs = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  for (const s of srcs) { const js = await (await fetch(BASE + s)).text(); if (js.includes('day_guard_rejected_session_cleared')) { bundleFresh = true; break; } }
} catch (e) { F.add('pre-gate', `bundle fetch failed: ${String(e).slice(0, 120)}`); }
caseResult('PRE-GATE', !!ver && bundleFresh, `prod sha=${String(ver?.sha).slice(0, 7)} head=${String(headSha).slice(0, 7)} bundleFresh=${bundleFresh}`, { flags: ver?.flags });
if (!bundleFresh) { console.log('ABORT: deployed bundle lacks Phase-1 markers — Netlify not live yet.'); writeFileSync(`${AUD}/findings/lsr_report_${runId}.json`, JSON.stringify(R, null, 2)); process.exit(1); }

const personaPath = `${AUD}/lsr_personas.json`;
if (!existsSync(personaPath)) { console.error(`missing ${personaPath} — run lsr_snapshot.mjs --pre and confirm persona assignments first`); process.exit(2); }
const P = JSON.parse(readFileSync(personaPath, 'utf8'));

const browser = await launch();
R.meta = await runMeta(browser, {
  buildSha: ver?.sha ?? null, flag: 'LIST_SCOPED_RECON=false (Run L)', bundleFresh,
  viewport: '1440x900', personas: Object.fromEntries(Object.entries(P).filter(([k]) => k.startsWith('P_'))),
});

// ---- Persona login preflight (policy §5: confirm each persona can log in via UI) ------
for (const [key, email] of Object.entries(P)) {
  if (!key.startsWith('P_') || !email || key.endsWith('_classB')) continue;
  const { page } = await newAuditPage(browser, F, `preflight-${key}`);
  const ok = await login(page, email, F);
  F.step('preflight', `${key} (${email}) login ${ok ? 'OK' : 'FAILED'}`);
  if (!ok) caseResult(`PRE-${key}`, false, `persona cannot log in — reassign before running cases`);
  await page.context().close();
}

// ---- L1: normal single-class completion (P-L1), typed; + EXT-1/2/3/7 woven in --------
{
  const { page } = await newAuditPage(browser, F, 'L1');
  const ok = await login(page, P.P_L1, F);
  await shot(page, `lsr_${runId}_L1_dashboard`);
  if (!ok) caseResult('L1', false, 'login failed');
  else {
    const t = await driveNewWordsToTest(page, F, 'L1');
    if (!t.reached) caseResult('L1', false, 'typed test not reached');
    else {
      const rows = await readTestRows(page);
      const { outcome } = await fillSubmitAndObserve(page, carefulAnswers(rows), F, 'L1');
      const verdict = await assertVerdictCoherent(page, F, 'L1');
      await shot(page, `lsr_${runId}_L1_result`);
      // EXT-3: mid-test reload/recovery on the NEXT phase if review offered.
      await goDashboard(page);
      const rv = await driveReviewToTest(page, F, 'L1-review');
      if (rv.reached) {
        await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000); // EXT-3: recovery path
        const back = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false)
          || await driveReviewToTest(page, F, 'L1-review-resume').then((r) => r.reached);
        if (!back) F.add('BUG', '[L1] EXT-3: could not resume review test after mid-test reload');
        else {
          const rrows = await readTestRows(page);
          const r2 = await fillSubmitAndObserve(page, carefulAnswers(rrows), F, 'L1-review');
          if (r2.outcome === 'grading-failed') F.add('BUG', '[L1] EXT-3 VIOLATION: Grading Failed after recovery (06-22 malform class)');
        }
      }
      caseResult('L1', outcome === 'results' || outcome === 'retake-gate', `outcome=${outcome} score=${verdict.scorePct}% words=${rows.length}`, { outcome, verdict });
    }
  }
  await page.context().close();
}

// ---- L2: flag-off dual-class behavior unchanged (P-L2) + EXT-8 observational ---------
{
  if (!P.P_L2) caseResult('L2', 'skip', 'no dual-enrolled persona available (see --pre classification)');
  else {
    const { page } = await newAuditPage(browser, F, 'L2');
    const ok = await login(page, P.P_L2, F);
    if (!ok) caseResult('L2', false, 'login failed');
    else {
      await shot(page, `lsr_${runId}_L2_A`);
      const dayTextA = await page.getByText(/day \d+/i).first().innerText().catch(() => null);
      const swB = P.P_L2_classB ? await switchClass(page, P.P_L2_classB, F) : false;
      await shot(page, `lsr_${runId}_L2_B`);
      const dayTextB = await page.getByText(/day \d+/i).first().innerText().catch(() => null);
      // Flag OFF: no cross-class carry may occur from mere viewing; values must equal the
      // pre-snapshot state (asserted numerically in the --post diff; here: visible sanity).
      const missingIndexErr = await page.getByText(/index|failed-precondition/i).first().isVisible().catch(() => false);
      if (missingIndexErr) F.add('BUG', '[L2] visible index/query error on dual-class dashboard');
      caseResult('L2', !missingIndexErr, `A="${dayTextA}" B="${dayTextB}" switched=${swB} (numeric no-carry assertion in --post diff)`);
    }
    await page.context().close();
  }
}

// ---- L1-M: MCQ submission remains usable (policy §6 L1 pass condition) ---------------
{
  if (!P.P_L1_MCQ) caseResult('L1-M', 'skip', 'no MCQ-mode persona configured (P_L1_MCQ) — L1 MCQ pass condition unverified');
  else {
    const { page } = await newAuditPage(browser, F, 'L1-M');
    const ok = await login(page, P.P_L1_MCQ, F);
    if (!ok) caseResult('L1-M', false, 'login failed');
    else {
      F.step('L1-M', 'start new words → study → skip to MCQ test');
      const t = await driveNewWordsToTest(page, F, 'L1-M'); // reaches the test page; MCQ has no typed inputs
      const mcq = await answerMcqVisible(page, F, 'L1-M');
      const { outcome } = await submitMcqAndObserve(page, F, 'L1-M');
      await shot(page, `lsr_${runId}_L1M_result`);
      caseResult('L1-M', outcome === 'results' || outcome === 'retake-gate',
        `outcome=${outcome} questions=${mcq.questions} (typedReach=${t.reached})`);
    }
    await page.context().close();
  }
}

R.meta.endedAt = new Date().toISOString();
await browser.close();
writeFileSync(`${AUD}/findings/lsr_report_${runId}.json`, JSON.stringify(R, null, 2));
console.log(`\n${R.pass ? '✅ RUN L UI-PASS (pending --post diff)' : '❌ RUN L FAIL'} — findings: ${F.path}`);
console.log('NEXT: run lsr_snapshot.mjs --post (EXT-4/5/6 + no-carry + zero-new-logs assertions live there).');
process.exit(R.pass ? 0 : 1);

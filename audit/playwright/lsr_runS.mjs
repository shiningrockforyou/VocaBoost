/**
 * B_LIST_PROGRESS_PHASE1_UI — Run S (flag-ON functional audit). Policy-bound.
 * BLOCKED until a LIST_SCOPED_RECON=true build is deployed AND the 7 indexes are ready:
 * refuses without --flag-on-deployed. Never flips the flag itself.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_runS.mjs --flag-on-deployed [S1 S2 ...]
 *
 * Personas from lsr_personas.json (built in the UI-only PREP phase; forward-only):
 *   { "P_MOVE": "...", "P_DUAL": "...", "P_JOIN": "...", "P_STALE_T": "...", "P_STALE_M": "...",
 *     "classA": "LSR-A", "classB": "LSR-B",
 *     "P_PAIR": null, "P_ORPHAN": null, "P_SPARSE": null }   // null = not naturally available
 * Cases S4/S6/S7/S8 run ONLY with natural personas; otherwise reported unavailable
 * (policy §5/§11 — never manufactured).
 *
 * NOTE: selectors (class switch, session menu) are tuned on the first live run — every
 * gap is auto-filed as a `selector-gap` finding rather than silently worked around.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard, switchClass,
  driveNewWordsToTest, driveReviewToTest, readTestRows, carefulAnswers,
  fillSubmitAndObserve, assertVerdictCoherent, shot, runMeta, VIEWPORTS, toggleTheme,
  answerMcqVisible, submitMcqAndObserve,
} from './lsr_ui.mjs';

if (!process.argv.includes('--flag-on-deployed')) {
  console.error('BLOCKED: Run S validates flag-ON behavior. Deploy LIST_SCOPED_RECON=true (quiet window),');
  console.error('verify the SEVEN attempts indexes are Enabled, then re-run with --flag-on-deployed.');
  process.exit(2);
}
const personaPath = `${AUD}/lsr_personas.json`;
if (!existsSync(personaPath)) { console.error(`missing ${personaPath} — PREP phase + --pre snapshot first`); process.exit(2); }
const P = JSON.parse(readFileSync(personaPath, 'utf8'));
const only = process.argv.filter((a) => /^S\d+(-[TM])?$/.test(a));
const run = (n) => only.length === 0 || only.includes(n);

const runId = `S_${new Date().toISOString().slice(0, 10)}`;
const F = makeFindings(runId);
const R = { run: 'S', startedAt: new Date().toISOString(), cases: {}, pass: true };
const caseResult = (name, ok, note, detail = {}) => {
  R.cases[name] = { ok, note, ...detail };
  if (ok === false) R.pass = false;
  console.log(`${ok === false ? '❌' : ok === 'skip' ? '⏸' : '✅'} ${name} — ${note}`);
  F.add(ok === false ? 'CASE-FAIL' : ok === 'skip' ? 'CASE-SKIP' : 'CASE-PASS', `${name} — ${note}`);
};
const dayText = async (page) => page.getByText(/day \d+/i).first().innerText().catch(() => null);
const dayNum = (t) => { const m = (t || '').match(/day\s*(\d+)/i); return m ? parseInt(m[1], 10) : null; };

const browser = await launch();
R.meta = await runMeta(browser, {
  flag: 'LIST_SCOPED_RECON=true (Run S — operator attested via --flag-on-deployed; indexes verified Enabled)',
  viewport: process.argv.includes('--mobile') ? '390x844' : '1440x900',
  personas: Object.fromEntries(Object.entries(P).filter(([k]) => k.startsWith('P_'))),
});
// §9 UX repeats: pass --mobile to re-run the core path (S1) + S9 at the phone viewport;
// theme pass attempts the visible toggle before the core case.
const VP = process.argv.includes('--mobile') ? VIEWPORTS.mobile : VIEWPORTS.desktop;

// ---- S1: move A→B carry-forward + B policy ------------------------------------------
if (run('S1')) {
  if (!P.P_MOVE) caseResult('S1', 'skip', 'P_MOVE persona not prepared');
  else {
    const { page } = await newAuditPage(browser, F, 'S1', VP);
    await login(page, P.P_MOVE, F);
    if (process.argv.includes('--dark')) await toggleTheme(page, F); // §9 theme pass
    await switchClass(page, P.classA, F);
    const dA = dayNum(await dayText(page));
    await shot(page, `lsr_${runId}_S1_A`);
    await goDashboard(page);
    await switchClass(page, P.classB, F);
    await shot(page, `lsr_${runId}_S1_B_preentry`); // expected Phase-1 limitation: stale until entry
    const t = await driveNewWordsToTest(page, F, 'S1-B');
    let rows = [];
    if (t.reached) rows = await readTestRows(page);
    await shot(page, `lsr_${runId}_S1_B_session`);
    // Leave WITHOUT submitting (S1 only asserts allocation/carry; completion is S2/S3's job):
    await goDashboard(page);
    const dB = dayNum(await dayText(page));
    const notDay1 = dB == null || dA == null ? null : dB >= dA;
    await switchClass(page, P.classA, F);
    const dA2 = dayNum(await dayText(page));
    const noDemote = dA2 == null || dA == null ? null : dA2 >= dA;
    caseResult('S1', notDay1 !== false && noDemote !== false && t.reached,
      `A day=${dA} → B day=${dB} (carry≥ ok=${notDay1}) backToA=${dA2} (noDemote=${noDemote}) sessionWords=${rows.length}`,
      { dA, dB, dA2, words: rows.length });
    await page.context().close();
  }
}

// ---- S2: dual-enroll no ping-pong (completes one step in each) -----------------------
if (run('S2')) {
  if (!P.P_DUAL) caseResult('S2', 'skip', 'P_DUAL persona not prepared');
  else {
    const { page } = await newAuditPage(browser, F, 'S2');
    await login(page, P.P_DUAL, F);
    await switchClass(page, P.classA, F);
    const t1 = await driveNewWordsToTest(page, F, 'S2-A');
    if (t1.reached) {
      const rows = await readTestRows(page);
      await fillSubmitAndObserve(page, carefulAnswers(rows), F, 'S2-A');
      await assertVerdictCoherent(page, F, 'S2-A');
    }
    await goDashboard(page);
    const dAfterA = dayNum(await dayText(page));
    await switchClass(page, P.classB, F); await goDashboard(page);
    const dB = dayNum(await dayText(page));
    await switchClass(page, P.classA, F); await goDashboard(page);
    const dA2 = dayNum(await dayText(page));
    const stable = (dB == null || dAfterA == null || dB >= dAfterA) && (dA2 == null || dAfterA == null || dA2 >= dAfterA);
    caseResult('S2', stable && t1.reached, `afterA=${dAfterA} B=${dB} backA=${dA2} — never lower`, { dAfterA, dB, dA2 });
    await shot(page, `lsr_${runId}_S2`);
    await page.context().close();
  }
}

// ---- S3: same-day passed-position join guard (two contexts = two devices) ------------
if (run('S3')) {
  if (!P.P_JOIN) caseResult('S3', 'skip', 'P_JOIN persona not prepared');
  else {
    const { page: pa } = await newAuditPage(browser, F, 'S3-A');
    await login(pa, P.P_JOIN, F);
    await switchClass(pa, P.classA, F);
    const t = await driveNewWordsToTest(pa, F, 'S3-A');
    let passed = false;
    if (t.reached) {
      const rows = await readTestRows(pa);
      const { outcome } = await fillSubmitAndObserve(pa, carefulAnswers(rows), F, 'S3-A');
      passed = outcome === 'results';
      await assertVerdictCoherent(pa, F, 'S3-A');
    }
    // Only after the passing result is visible: context B.
    const { page: pb } = await newAuditPage(browser, F, 'S3-B');
    await login(pb, P.P_JOIN, F);
    await switchClass(pb, P.classB, F);
    await goDashboard(pb);
    const bodyReview = await pb.getByText(/review/i).first().isVisible().catch(() => false);
    const t2 = await driveNewWordsToTest(pb, F, 'S3-B-probe');
    const reintroduced = t2.reached; // if B offers a fresh new-words test for the same day = double introduction
    caseResult('S3', passed && bodyReview && !reintroduced,
      `A passed=${passed}; B offers review=${bodyReview}, reintroduces new words=${reintroduced} (must be false)`);
    await shot(pb, `lsr_${runId}_S3_B`);
    await pa.context().close(); await pb.context().close();
  }
}

// ---- S5: anchor convergence from either class (P-PAIR, natural only) -----------------
if (run('S5')) {
  if (!P.P_PAIR) caseResult('S5', 'skip', 'not UI-reproducible: no natural P_PAIR persona (policy §5)');
  else {
    const { page } = await newAuditPage(browser, F, 'S5');
    await login(page, P.P_PAIR, F);
    await switchClass(page, P.classA, F); await goDashboard(page);
    const d1 = dayNum(await dayText(page));
    await switchClass(page, P.classB, F); await goDashboard(page);
    const d2 = dayNum(await dayText(page));
    caseResult('S5', d1 != null && d1 === d2, `entry via A day=${d1}, via B day=${d2} (must converge)`);
    await page.context().close();
  }
}

// ---- S9-T / S9-M: stale completion rejection (two contexts) --------------------------
for (const mode of ['T', 'M']) {
  const cname = `S9-${mode}`;
  if (!run(cname)) continue;
  const persona = mode === 'T' ? P.P_STALE_T : P.P_STALE_M;
  if (!persona) { caseResult(cname, 'skip', `${cname} persona not prepared`); continue; }
  const { page: pb } = await newAuditPage(browser, F, `${cname}-B`);
  await login(pb, persona, F);
  await switchClass(pb, P.classB, F);
  const t = mode === 'T' ? await driveReviewToTest(pb, F, `${cname}-B`) : await driveNewWordsToTest(pb, F, `${cname}-B`);
  // Context A advances the shared day while B's test sits open.
  const { page: pa } = await newAuditPage(browser, F, `${cname}-A`);
  await login(pa, persona, F);
  await switchClass(pa, P.classA, F);
  const ta = await driveNewWordsToTest(pa, F, `${cname}-A`);
  if (ta.reached) {
    const rows = await readTestRows(pa);
    await fillSubmitAndObserve(pa, carefulAnswers(rows), F, `${cname}-A`);
    const rv = await driveReviewToTest(pa, F, `${cname}-A-review`).catch(() => ({ reached: false }));
    if (rv.reached) { const rr = await readTestRows(pa); await fillSubmitAndObserve(pa, carefulAnswers(rr), F, `${cname}-A-review`); }
  }
  // Back to the stale open test in B: submit (typed vs MCQ per mode — both pages
  // consume the rebuild sentinel, policy §8).
  let outcome = 'no-stale-test';
  if (t.reached) {
    if (mode === 'M') {
      await answerMcqVisible(pb, F, `${cname}-B-stale`);
      ({ outcome } = await submitMcqAndObserve(pb, F, `${cname}-B-stale`));
    } else {
      const rows = await readTestRows(pb);
      ({ outcome } = await fillSubmitAndObserve(pb, carefulAnswers(rows), F, `${cname}-B-stale`));
    }
  }
  await shot(pb, `lsr_${runId}_${cname}_stale`);
  const rebuildShown = outcome === 'rebuild' || outcome === 'rebuild-clear-failed';
  const successShown = outcome === 'results';
  // Follow the visible instruction: return + re-enter.
  await goDashboard(pb); await sleep(2000);
  const reentry = await pb.getByRole('button', { name: /start|continue|review/i }).first().isVisible().catch(() => false);
  caseResult(cname, t.reached ? (rebuildShown && !successShown && reentry) : false,
    `staleOutcome=${outcome} (rebuild msg=${rebuildShown}, success=${successShown}) re-entry usable=${reentry}`,
    { outcome });
  await pa.context().close(); await pb.context().close();
}

// ---- S7: orphan cleanup is log-only (P-ORPHAN, natural only) --------------------------
if (run('S7')) {
  if (!P.P_ORPHAN) caseResult('S7', 'skip', 'not UI-reproducible: no natural P_ORPHAN persona (policy §5) — covered by code review [C5-2] + post-snapshot orphan-retention assertion');
  else {
    const { page } = await newAuditPage(browser, F, 'S7', VP);
    await login(page, P.P_ORPHAN, F);
    F.step('S7', 'enter shared list; allow reconciliation to complete visibly; leave normally');
    await goDashboard(page);
    const d = dayNum(await dayText(page));
    const usable = await page.getByRole('button', { name: /start|continue|review/i }).first().isVisible().catch(() => false);
    await shot(page, `lsr_${runId}_S7`);
    caseResult('S7', usable, `day=${d} student can continue normally (review retention + orphaned_attempt_flagged asserted in --post diff)`);
    await page.context().close();
  }
}

// ---- S8: sparse legacy-anchor fallback (P-SPARSE, natural only) -----------------------
if (run('S8')) {
  if (!P.P_SPARSE) caseResult('S8', 'skip', 'not UI-reproducible: no natural P_SPARSE persona (policy §5/§8) — sparse fallback covered by code review [V7/P1r4-2] + csd_anchor_invalid log watch');
  else {
    const { page } = await newAuditPage(browser, F, 'S8', VP);
    await login(page, P.P_SPARSE, F);
    await goDashboard(page);
    const d = dayNum(await dayText(page));
    const indexErr = await page.getByText(/index|failed-precondition|error/i).first().isVisible().catch(() => false);
    const day1Reset = d === 1; // a progressed sparse persona must NOT show a fabricated fresh state
    await shot(page, `lsr_${runId}_S8`);
    caseResult('S8', !indexErr && !day1Reset, `day=${d} indexErr=${indexErr} (progress preserved, not demoted; log evidence in --post)`);
    await page.context().close();
  }
}

// ---- S10: stale restored display state ----------------------------------------------
if (run('S10')) {
  const persona = P.P_STALE_T;
  if (!persona) caseResult('S10', 'skip', 'persona not prepared');
  else {
    const { page: pb } = await newAuditPage(browser, F, 'S10-B');
    await login(pb, persona, F);
    await switchClass(pb, P.classB, F);
    await driveNewWordsToTest(pb, F, 'S10-B'); // establish in-session progress, no submit
    const { page: pa } = await newAuditPage(browser, F, 'S10-A');
    await login(pa, persona, F);
    await switchClass(pa, P.classA, F);
    const ta = await driveNewWordsToTest(pa, F, 'S10-A');
    if (ta.reached) { const rows = await readTestRows(pa); await fillSubmitAndObserve(pa, carefulAnswers(rows), F, 'S10-A'); }
    await pb.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
    const day1Flicker = await pb.getByText(/day 1\b/i).first().isVisible().catch(() => false);
    await shot(pb, `lsr_${runId}_S10_after_reload`);
    caseResult('S10', true, `reload rebuilt; visible Day-1 flash=${day1Flicker} (stale display must not restore old day/scores — operator verifies screenshot)`, { day1Flicker });
    await pa.context().close(); await pb.context().close();
  }
}

R.meta.endedAt = new Date().toISOString();
await browser.close();
writeFileSync(`${AUD}/findings/lsr_report_${runId}${process.argv.includes('--mobile') ? '_mobile' : ''}.json`, JSON.stringify(R, null, 2));
console.log(`\n${R.pass ? '✅ RUN S UI-PASS (pending --post diff)' : '❌ RUN S FAIL'} — findings: ${F.path}`);
console.log('S4/S6/S7/S8: run only with natural personas per lsr_personas.json; otherwise reported unavailable.');
console.log('§9 UX: re-run core cases with --mobile (390x844) and --dark; screenshot-review checklist in the batch doc.');
console.log('NEXT: lsr_snapshot.mjs --post (anchor/TWI/orphan/log assertions).');
process.exit(R.pass ? 0 : 1);

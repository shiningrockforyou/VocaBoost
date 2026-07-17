// PR-1 flag-ON dev-E2E — round 31, SINGLE-PASS per account (no re-navigation).
// Reuses lsr_ui.mjs primitives (login/readTestRows/carefulAnswersFrom/fillSubmitAndObserve) so the review
// can actually be COMPLETED (leg b). Screenshots DURING the one continuous drive. Sandbox only.
//   usage: node pr1_e2e_r31.mjs <ON|OFF> <email>
const UI = await import('../../playwright/lsr_ui.mjs');   // triggers base guard (localhost) + reads PASS
const { BASE, PASS, login, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, makeFindings } = UI;
const { chromium } = await import('playwright');
const FIND = 'C:/Users/dmchw/vocaboost/audit/playwright/findings';

const MODE = process.argv[2];            // ON | OFF
const email = process.argv[3];
if (!email) { console.error('usage: node pr1_e2e_r31.mjs <ON|OFF> <email>'); process.exit(2); }
const acct = email.split('@')[0];
const F = makeFindings ? makeFindings() : { add: (...a) => console.log('  F:', ...a) };
const rec = { email, mode: MODE, steps: [] };
const sig = async (p) => { const t = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); return {
  noTestContent: /no test content|no content|nothing to (study|review)/i.test(t),
  playable: /question|type the|your answer|submit (test|answers)/i.test(t),
  dayComplete: /day .* complete|great job|completed day/i.test(t),
  reEntry: /resume day|retry review test|move on to the next/i.test(t) }; };
const shotp = async (p, n) => { const f = `${FIND}/pr1_r31_${acct}_${MODE}_${n}.png`; await p.screenshot({ path: f, fullPage: true }).catch(() => {}); return f; };

const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  rec.loggedIn = await login(p, email, F);
  await p.waitForTimeout(1500);
  // 1) trigger the day/re-entry gate
  const startRe = /start new words|start session|continue|resume|begin|study now|start your day/i;
  const sb = p.getByRole('button', { name: startRe }).or(p.getByRole('link', { name: startRe })).first();
  rec.startLabel = await sb.isVisible().catch(() => false) ? (await sb.innerText().catch(() => '')).trim() : null;
  if (rec.startLabel) { await sb.click().catch(() => {}); }
  // TIMING FIX: wait (up to 15s) for the re-entry modal to actually render before checking/clicking Retry.
  await p.getByRole('button', { name: /retry review test/i }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  rec.steps.push({ step: '1-reentry', shot: await shotp(p, '1reentry'), sig: await sig(p), url: p.url() });
  // 2) click Retry Review Test (the re-entry guard's retake) → does a PLAYABLE review render or the "No Test Content" trap?
  const retry = p.getByRole('button', { name: /retry review test|retake/i }).first();
  rec.retryVisible = await retry.isVisible().catch(() => false);
  if (rec.retryVisible) {
    await retry.click().catch(() => {});
    await p.waitForTimeout(2500);
    await p.getByText(/no test content|question|type the|your answer|submit/i).first().waitFor({ timeout: 12000 }).catch(() => {});
    await p.waitForTimeout(2500);
  }
  let rows = [];
  try { rows = await readTestRows(p); } catch (e) { rec.readRowsErr = String(e).slice(0, 120); }
  rec.reviewRowCount = rows.length;
  rec.steps.push({ step: '2-review', shot: await shotp(p, '2review'), sig: await sig(p), url: p.url(), rows: rows.length });
  // 3) FLAG-ON only: complete the review (leg b) → assert advance
  if (MODE === 'ON' && rows.length > 0) {
    try {
      const answers = carefulAnswersFrom(rows, null);
      const obs = await fillSubmitAndObserve(p, answers, F, `${acct}-review`);
      rec.submitOutcome = obs?.outcome || obs || 'submitted';
    } catch (e) { rec.submitErr = String(e).slice(0, 160); }
    await p.waitForTimeout(3000);
    rec.steps.push({ step: '3-afterSubmit', shot: await shotp(p, '3submit'), sig: await sig(p), url: p.url() });
    // advance signal: back to dashboard / "day complete" / "move on" gone
    const bodyTxt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    rec.advancedSignal = /great job|day .* complete|completed day|back to dashboard|next day/i.test(bodyTxt);
  }
  await b.close();
} catch (e) { rec.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
console.log(JSON.stringify(rec, null, 2));
console.log('[pr1_e2e_r31] done ' + email + ' (' + MODE + ')');

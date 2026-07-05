/**
 * B_LIST_PROGRESS_PHASE1_UI — compliant Playwright primitives.
 * POLICY-BOUND: docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md
 *   - semantic locators + visible controls ONLY
 *   - NO page.evaluate / waitForFunction / injected JS / storage access / interception
 *   - NO Admin SDK anywhere in this module (snapshots live in lsr_snapshot.mjs, run
 *     strictly before/after browser scenarios)
 * Findings protocol: every anomaly is collected and written to the findings file —
 * including out-of-scope ones (batch doc, MANDATORY FINDINGS PROTOCOL).
 */
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';

export const BASE = 'https://vocaboostone.netlify.app';
export const PASS = 'AuditPass2026!';
export const AUD = '/app/audit/playwright';
export const SEEDED = JSON.parse(readFileSync(`${AUD}/seeded_accounts.json`, 'utf8')).accounts || [];
export const WM = existsSync(`${AUD}/wordmap.json`)
  ? JSON.parse(readFileSync(`${AUD}/wordmap.json`, 'utf8'))
  : JSON.parse(readFileSync('/app/dsg-edits/srv_validate/wordmap.json', 'utf8')); // read-only reference data
export const norm = (w) => (w || '').toLowerCase().trim();
export const bareWord = (w) => (w || '').split(/[\r\n]/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim(); // first line strips '(old English)'-style annotations
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- findings collector (ANY AND ALL anomalies) ----------
export function makeFindings(runId) {
  const path = `${AUD}/findings/B_LIST_PROGRESS_PHASE1_${runId}.md`;
  if (!existsSync(path)) {
    writeFileSync(path, `# Findings — B_LIST_PROGRESS_PHASE1 (${runId})\n\n**Run date:** ${new Date().toISOString()}\n**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md\n\n## Raw anomaly log (triage EVERY entry — none dropped without written justification)\n\n`);
  }
  const raw = [];
  const add = (kind, detail) => {
    const line = `- [${new Date().toISOString()}] **${kind}** — ${detail}`;
    raw.push({ kind, detail });
    appendFileSync(path, line + '\n');
  };
  // Per-case visible-action step log (policy §4.5: "a short step log containing only
  // visible user actions and visible assertions").
  const step = (caseLabel, action) => appendFileSync(path, `  - STEP [${caseLabel}] ${action}\n`);
  return { path, raw, add, step };
}

// Run metadata block (policy §3: URL, build id, flag value, index readiness,
// browser/version, viewport, times, personas — recorded in the audit report).
export async function runMeta(browser, extra = {}) {
  return {
    deploymentUrl: BASE,
    browser: `chromium ${browser.version()}`,
    startedAt: new Date().toISOString(),
    ...extra,
  };
}

// ---------- browser ----------
export async function launch() { return chromium.launch({ headless: true }); }

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },        // policy §9
  mobile: { width: 390, height: 844 },          // supported phone viewport (iPhone-class)
};

export async function newAuditPage(browser, findings, label, viewport = VIEWPORTS.desktop, video = false) {
  const ctx = await browser.newContext({
    viewport,
    ...(video ? { recordVideo: { dir: `${AUD}/findings/video` } } : {}),
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') findings.add('console-error', `[${label}] ${m.text().slice(0, 250)}`); });
  page.on('pageerror', (e) => findings.add('page-error', `[${label}] ${String(e).slice(0, 250)}`));
  // Native confirm()/alert() dialogs (e.g. unassign-list confirm, ClassDetail.jsx:389):
  // accepting is the ordinary user affirmative — record each occurrence as a step.
  page.on('dialog', async (d) => { findings.add('native-dialog', `[${label}] ${d.type()}: ${d.message().slice(0, 150)} — accepted`); await d.accept().catch(() => {}); });
  page.on('requestfailed', (r) => {
    if (!/analytics|gtag|favicon/.test(r.url())) findings.add('request-failed', `[${label}] ${r.method()} ${r.url().slice(0, 150)} — ${r.failure()?.errorText}`);
  });
  return { ctx, page };
}

// Login via the visible UI. BASE is the public entry; if a visible login link exists we
// click it, otherwise the unauthenticated app lands on/offers the login form directly
// (/login is the public auth entry, not an internal session route — documented reading
// of the policy's deep-link rule).
export async function login(page, email, findings) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const emailBox = page.locator('input[type="email"]').first();
  if (!(await emailBox.isVisible().catch(() => false))) {
    const link = page.getByRole('link', { name: /log ?in|sign ?in/i }).or(page.getByRole('button', { name: /log ?in|sign ?in/i })).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); // public auth entry
    }
    await sleep(1200);
  }
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASS);
  const submit = page.getByRole('button', { name: /log ?in|sign ?in|submit/i }).first();
  if (await submit.isVisible().catch(() => false)) await submit.click();
  else await page.locator('input[type="password"]').first().press('Enter');
  const ok = await page.getByText(/Welcome,/).first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  if (!ok) findings.add('login-failed', `${email} — Welcome banner not visible in 25s`);
  await sleep(1200);
  return ok;
}

// Dismiss any open modal via its visible close control (✕ / Cancel / Close) or the
// ordinary Escape key — both are permitted visible-UI interactions.
export async function dismissModal(page) {
  for (let i = 0; i < 3; i++) {
    const closeBtn = page.getByRole('button', { name: /^(✕|×|x|close|cancel|닫기|취소)$/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click().catch(() => {}); await sleep(600); continue; }
    break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
}

export async function goDashboard(page) {
  // Visible navigation: prefer an in-app Dashboard/Home link; fall back to browser back-to-root.
  await dismissModal(page);
  const nav = page.getByRole('link', { name: /dashboard|home/i }).or(page.getByRole('button', { name: /dashboard|home/i })).first();
  const clicked = await nav.click({ timeout: 5000 }).then(() => true).catch(() => false);
  if (!clicked) await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
}

// Switch the active class via the visible class selector. Best-effort semantic
// locators; tune on first live run and record the working variant here.
export async function switchClass(page, className, findings) {
  await dismissModal(page);
  const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  // The class control is a FocusControl (Dashboard.jsx:227): a "Class:" trigger button
  // (dropdown mode, >1 class) OR plain "Class: <name>" label text (single class).
  const trigger = page.getByRole('button', { name: /Class:/ }).first();
  if (!(await trigger.isVisible().catch(() => false))) {
    // Label mode (single class): success iff it already shows the target.
    const onTarget = await page.getByText(escRe(`Class: ${className}`)).first().isVisible().catch(() => false)
      || await page.getByText(escRe(className)).first().isVisible().catch(() => false);
    if (onTarget) return true;
    findings.add('selector-gap', `class switch: no Class control and not already on "${className}"`);
    return false;
  }
  const cur = await trigger.innerText().catch(() => '');
  if (cur.includes(className)) return true; // already active
  await trigger.click({ timeout: 4000 }).catch(() => {});
  await sleep(700);
  // Dropdown option buttons carry the class name; the trigger also matches, so take the
  // last matching button (options render after the trigger in the DOM).
  const opt = page.getByRole('button', { name: escRe(className) }).last();
  const clicked = await opt.click({ timeout: 4000 }).then(() => true).catch(() => false);
  await sleep(1500);
  if (!clicked) { findings.add('selector-gap', `class switch to "${className}" failed — option not clickable`); await shot(page, `lsr_switch_gap_${className.replace(/\W+/g, '_')}`); return false; }
  return true;
}

// Open the session kebab menu (aria-label "Session menu", SessionMenu.jsx:92) and click
// "Skip to Test", then accept the confirm modal. Robust exact selectors (replaces the
// nondeterministic getByRole('button').last() fallback that failed on day-2/MCQ layouts).
export async function skipToTest(page, findings, label) {
  const menuBtn = page.getByRole('button', { name: 'Session menu' }).first();
  const menuReady = await menuBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!menuReady) { findings.add('selector-gap', `[${label}] Session-menu button not visible`); await shot(page, `lsr_menugap_${label.replace(/[^a-z0-9]+/gi,"_")}`); return false; }
  await menuBtn.click().catch(() => {});
  await sleep(600);
  const skip = page.getByRole('button', { name: /skip to test/i }).first();
  if (!(await skip.isVisible().catch(() => false))) { findings.add('selector-gap', `[${label}] "Skip to Test" not in menu (queue empty?)`); await page.keyboard.press('Escape').catch(() => {}); return false; }
  await skip.click().catch(() => {});
  await sleep(800);
  // Confirm modal (setShowTestConfirm): a Start/Skip/Confirm/Yes button.
  const confirm = page.getByRole('button', { name: /skip|start test|begin|yes|confirm|continue/i }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
  await sleep(800);
  return true;
}

// Dashboard → new-words study → typed test, all via visible controls.
export async function driveNewWordsToTest(page, findings, label) {
  const start = page.getByRole('button', { name: /start new words|continue/i }).first();
  if (!(await start.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] no Start-New-Words/Continue button`); return { reached: false }; }
  await start.click(); await sleep(2500);
  const study = page.getByRole('button', { name: /start studying/i }).first();
  if (await study.isVisible().catch(() => false)) await study.click();
  await page.getByText(/Card \d+ of \d+/i).first().waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await skipToTest(page, findings, label);
  // Test page reached = typed inputs (typed mode) OR the MCQ nav arrow (MCQ mode).
  const reached = await Promise.race([
    page.locator('input[placeholder*="definition" i]').first().waitFor({ timeout: 15000 }).then(() => true),
    page.getByRole('button', { name: /Next question|Previous question/ }).first().waitFor({ timeout: 15000 }).then(() => true),
  ]).catch(() => false);
  if (!reached) findings.add('flow-gap', `[${label}] test page (typed or MCQ) not reached`);
  await sleep(700);
  return { reached };
}

export async function driveReviewToTest(page, findings, label) {
  const start = page.getByRole('button', { name: /review|continue/i }).first();
  if (!(await start.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] no Review/Continue button`); return { reached: false }; }
  await start.click(); await sleep(2500);
  const study = page.getByRole('button', { name: /start studying|start review/i }).first();
  if (await study.isVisible().catch(() => false)) await study.click();
  await page.getByText(/Card \d+ of \d+/i).first().waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await skipToTest(page, findings, label);
  const reached = await Promise.race([
    page.locator('input[placeholder*="definition" i]').first().waitFor({ timeout: 15000 }).then(() => true),
    page.getByRole('button', { name: /Next question|Previous question/ }).first().waitFor({ timeout: 15000 }).then(() => true),
  ]).catch(() => false);
  await sleep(700);
  return { reached };
}

// Read the typed-test rows via locator traversal (visible text only — no evaluate).
export async function readTestRows(page) {
  const inputs = page.locator('input[placeholder*="definition" i]');
  const n = await inputs.count();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const word = await inputs.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 2000 }).catch(() => '');
    rows.push({ idx: i, word: word.trim() });
  }
  return rows;
}

export function carefulAnswers(rows) {
  return rows.map((r) => { const e = WM[norm(bareWord(r.word))]; return e ? (e.def || e.ko || '') : ''; });
}

// Fill + submit + wait for a visible outcome. Asserts CS-matrix EXT-1/EXT-2 on the way:
// results screen appears, no submitError/gradingError loop, verdict coherent.
export async function fillSubmitAndObserve(page, answers, findings, label) {
  const inputs = page.locator('input[placeholder*="definition" i]');
  for (let i = 0; i < answers.length; i++) await inputs.nth(i).fill(answers[i]);
  const submit = page.getByRole('button', { name: /^submit( test| answers)?$/i }).first();
  if (!(await submit.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] no Submit button`); return { outcome: 'no-submit' }; }
  await submit.click(); await sleep(800);
  const modal = page.getByText(/still have not answered|are you sure you want to submit/i).first();
  if (await modal.isVisible().catch(() => false)) {
    const confirmBtn = page.getByRole('button', { name: /^submit$/i }).last();
    const clicked = await confirmBtn.click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (!clicked) findings.add('modal-dead', `[${label}] confirm modal button unresponsive (EXT-7 watch)`); // 김선아 class
  }
  const outcome = await Promise.race([
    page.getByText(/세션 정보가 갱신|session was refreshed/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild'),
    page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild-clear-failed'),
    page.getByText(/Couldn'?t Save|저장.*실패|Retry Save/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/Grading Failed/i).first().waitFor({ timeout: 120000 }).then(() => 'grading-failed'),
    page.getByText(/이 날을 완료하려면|Day not complete/i).first().waitFor({ timeout: 120000 }).then(() => 'retake-gate'),
    page.getByText(/%|score|correct/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2000);
  if (outcome === 'save-error') findings.add('BUG', `[${label}] "Couldn't Save Your Results" appeared (CS-matrix #3 / EXT-2)`);
  if (outcome === 'grading-failed') findings.add('BUG', `[${label}] "Grading Failed" appeared (CS-matrix #4 / EXT-3)`);
  if (outcome === 'timeout') findings.add('BUG', `[${label}] no visible outcome within 120s (infinite loading?)`);
  return { outcome };
}

// EXT-1 (김나연/김호형 class): the visible verdict must be PASS iff score ≥ threshold.
export async function assertVerdictCoherent(page, findings, label, thresholdPct = 92) {
  const passVisible = await page.getByText(/pass(ed)?|합격/i).first().isVisible().catch(() => false);
  const failVisible = await page.getByText(/fail(ed)?|불합격|retake required/i).first().isVisible().catch(() => false);
  let scorePct = null;
  const pctText = await page.getByText(/\d{1,3}\s*%/).first().innerText({ timeout: 3000 }).catch(() => null);
  if (pctText) { const m = pctText.match(/(\d{1,3})\s*%/); if (m) scorePct = parseInt(m[1], 10); }
  if (scorePct != null) {
    const shouldPass = scorePct >= thresholdPct;
    if (shouldPass && failVisible && !passVisible) findings.add('BUG', `[${label}] EXT-1 VIOLATION: score ${scorePct}% ≥ ${thresholdPct}% but UI shows FAIL (retakeThreshold-display class, NTF#5)`);
    if (!shouldPass && passVisible && !failVisible) findings.add('BUG', `[${label}] EXT-1: score ${scorePct}% < ${thresholdPct}% but UI shows PASS`);
  }
  return { scorePct, passVisible, failVisible };
}

export async function shot(page, name) {
  await page.screenshot({ path: `${AUD}/findings/${name}.png`, fullPage: true }).catch(() => {});
}

// ---------- enrollment / abandon (realistic mid-run conditions) ----------
// Join a class by code through the visible UI. Idempotent-ish: if already a member,
// the join either no-ops or errors visibly (recorded, not fatal).
export async function joinClass(page, code, className, findings, label) {
  if (!code) { findings.add('prep-issue', `[${label}] no join code for "${className}"`); return false; }
  await goDashboard(page);
  // Inline dashboard join form (Dashboard.jsx:1665/1701): input placeholder "ABC123",
  // maxLength 6, submit button "Join Class". No modal to open.
  const codeInput = page.getByPlaceholder('ABC123').first();
  if (!(await codeInput.isVisible().catch(() => false))) {
    findings.add('selector-gap', `[${label}] join code input (ABC123) not visible`);
    await shot(page, `lsr_join_gap_${label}`);
    return false;
  }
  await codeInput.fill(code);
  const submit = page.getByRole('button', { name: /^join class$/i }).first();
  if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
  else await codeInput.press('Enter');
  await sleep(3000);
  await dismissModal(page);
  const joined = await page.getByText(new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first().isVisible().catch(() => false);
  findings.step(label, `join "${className}" via ${code} → ${joined ? 'visible' : 'unverified'}`);
  return joined;
}

// Distracted-student realism: open a class's session up to the test, then LEAVE without
// submitting (navigates away). Exercises session persistence across an interruption.
export async function openStudyThenLeave(page, className, findings, label) {
  await switchClass(page, className, findings);
  const t = await driveNewWordsToTest(page, findings, `${label}-abandon`);
  findings.step(label, `opened ${className} session to test then abandoned (reached=${t.reached})`);
  await goDashboard(page); // leave without submitting
  return t.reached;
}

// ---------- MCQ driving (policy §3: "Both typed and MCQ variants must be represented";
// S9-M consumes the rebuild sentinel through the MCQ page) ----------
// MCQ driver (MCQTest.jsx): one question per screen — word in an <h2>, answer choices
// are <button>s whose text IS the definition; selecting AUTO-ADVANCES (handleAnswerSelect
// :421). We built the answer key from the same `definition` field the options use, so we
// click the choice by exact definition text. Bounded by the "N of M answered" label.
export async function driveMcq(page, findings, label) {
  // total questions from the "X of M answered" progress label.
  let total = 30;
  const lbl = await page.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
  if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = parseInt(m[2], 10); }
  let answered = 0, guard = 0;
  while (answered < total && guard < total + 6) {
    guard++;
    const word = await page.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
    const e = WM[norm(bareWord(word))];
    let clicked = false;
    if (e?.def) {
      // The correct option's button accessible name = the definition text (span content).
      const choice = page.getByRole('button', { name: e.def, exact: false }).first();
      clicked = await choice.click({ timeout: 3000 }).then(() => true).catch(() => false);
    }
    if (!clicked) {
      findings.add('selector-gap', `[${label}] MCQ: no def-match choice for "${word}" — clicking first choice`);
      // Fallback: first answer-grid button (min-h choice cells sit after the word card).
      const anyChoice = page.locator('button:has(span)').filter({ hasNotText: /Play Audio|Submit|Next|Previous/i }).first();
      await anyChoice.click({ timeout: 3000 }).catch(() => {});
    }
    await sleep(500);
    const nl = await page.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null);
    const nm = nl && nl.match(/(\d+) of/);
    answered = nm ? parseInt(nm[1], 10) : answered + 1;
  }
  // Submit + observe. MCQ button text = "Submit Test (N/M answered)" (MCQTest.jsx:1382),
  // so match a prefix, not an anchored exact.
  const submit = page.getByRole('button', { name: /submit test/i }).first();
  if (!(await submit.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] MCQ Submit not visible (answered ${answered}/${total})`); return { outcome: 'no-submit' }; }
  await submit.click(); await sleep(800);
  const modal = page.getByText(/still have not answered|are you sure/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^submit$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([
    page.getByText(/세션 정보가 갱신|session was refreshed/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild'),
    page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild-clear-failed'),
    page.getByText(/Failed to save|Couldn'?t Save|저장.*실패/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/이 날을 완료하려면|Day not complete/i).first().waitFor({ timeout: 120000 }).then(() => 'retake-gate'),
    page.getByText(/%|score|correct/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2000);
  if (outcome === 'save-error') findings.add('BUG', `[${label}] MCQ save failure (EXT-2)`);
  if (outcome === 'timeout') findings.add('BUG', `[${label}] MCQ no visible outcome in 120s`);
  return { outcome };
}

// Best-effort theme toggle via visible UI control (policy §9: light+dark "if the theme
// control is available through the UI"); returns whether a toggle was found.
export async function toggleTheme(page, findings) {
  const t = page.getByRole('button', { name: /theme|dark|light|다크|라이트/i }).first();
  if (await t.isVisible().catch(() => false)) { await t.click(); await sleep(800); return true; }
  findings.add('note', 'theme toggle not found via visible controls — theme pass skipped (allowed by policy §9)');
  return false;
}


// ---------- shared study helpers (used by orchestrator + prep) ----------
export async function driveTest(page, findings, label) {
  const typed = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false);
  if (typed) {
    const rows = await readTestRows(page);
    return fillSubmitAndObserve(page, carefulAnswers(rows), findings, label);
  }
  return driveMcq(page, findings, label);
}

// Complete one full day (new + review) via visible controls. Returns true iff the day
// genuinely advanced (new-word test passed — not just a results screen).
export async function studyOneDay(page, findings, label) {
  const t = await driveNewWordsToTest(page, findings, label);
  if (!t.reached) return false;
  const { outcome } = await driveTest(page, findings, label);
  if (outcome === 'retake-gate') { findings.add('prep-issue', `[${label}] new-word test not passed (retake gate)`); return false; }
  if (outcome !== 'results') { findings.add('prep-issue', `[${label}] new-words outcome=${outcome}`); return false; }
  const fail = await page.getByText(/retake required|불합격|not complete/i).first().isVisible().catch(() => false);
  if (fail) { findings.add('prep-issue', `[${label}] new-word results show fail`); return false; }
  await goDashboard(page);
  const rv = await driveReviewToTest(page, findings, `${label}-rev`);
  if (rv.reached) await driveTest(page, findings, `${label}-rev`);
  await goDashboard(page);
  return true;
}

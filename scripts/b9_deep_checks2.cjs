/**
 * B9 Deep Checks Part 2 — More targeted investigations
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/screenshots_b9');
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';

const findings = {};

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

async function nav(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text: text.substring(0, 300), url: page.url() });
  });

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Logged in. URL:', page.url());

  // ============================================================
  // CHECK 1: T-10 Class Manager — click the class buttons properly
  // ============================================================
  console.log('\n=== CHECK 1: T-10 Class Buttons ===');
  await nav(page, `${BASE_URL}/ap/teacher/classes`);
  await screenshot(page, 'CHECK1_T10_initial');

  // Get all buttons
  const buttons = await page.locator('button').all();
  console.log(`Total buttons: ${buttons.length}`);
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent().catch(() => '');
    const disabled = await buttons[i].isDisabled().catch(() => false);
    console.log(`  Button ${i}: "${text?.trim().substring(0,60)}" disabled=${disabled}`);
  }

  // Click the Calculus class button (index 1, or by text)
  try {
    const calcBtn = await page.locator('button:has-text("AP Calculus AB Period 3")').first();
    await calcBtn.click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'CHECK1_T10_calc_selected');
    const afterText = await page.evaluate(() => document.body.innerText);
    console.log('After clicking Calc class:', afterText.substring(0, 600));
    findings.T10_classDetail = afterText.substring(0, 600);

    // Check for student management features
    const addStudentInputs = await page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="student" i]').count();
    const removeButtons = await page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="remove" i]').count();
    const studentRows = await page.locator('li, tr, [class*="student" i]').count();
    console.log(`Student add inputs: ${addStudentInputs}, remove buttons: ${removeButtons}, student rows: ${studentRows}`);
    findings.T10_studentManagement = { addStudentInputs, removeButtons, studentRows, bodyText: afterText.substring(0, 600) };
  } catch (e) {
    console.log(`Failed to click class: ${e.message}`);
  }

  // Test New Class button interaction
  await page.evaluate(() => window.scrollTo(0, 0));
  const newClassBtn = await page.locator('button:has-text("New Class")').first();
  if (await newClassBtn.isVisible().catch(() => false)) {
    await newClassBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'CHECK1_T10_new_class_form');
    const formText = await page.evaluate(() => document.body.innerText);
    console.log('New class form text:', formText.substring(0, 400));

    // Check what inputs are in the form
    const nameInput = await page.locator('input[placeholder*="name" i], input[placeholder*="class" i]').count();
    const periodInput = await page.locator('input[placeholder*="period" i]').count();
    const allFormInputs = await page.locator('form input, [class*="form"] input').all();
    console.log(`Name inputs: ${nameInput}, period inputs: ${periodInput}, form inputs: ${allFormInputs.length}`);
    for (const inp of allFormInputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      const type = await inp.getAttribute('type').catch(() => '');
      console.log(`  Form input: type=${type}, placeholder="${ph}"`);
    }
    findings.T10_newClassForm = { nameInput, periodInput, formText: formText.substring(0, 400) };

    // Try filling in the form
    const textInputs = await page.locator('input[type="text"]').all();
    if (textInputs.length > 0) {
      await textInputs[0].fill('AP Government Period 2');
      await page.waitForTimeout(200);
      await screenshot(page, 'CHECK1_T10_form_filled');
    }
    // Cancel
    const cancelBtn = await page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // ============================================================
  // CHECK 2: T-12 — Test if reorder works (using non-disabled btn)
  // ============================================================
  console.log('\n=== CHECK 2: T-12 Test Editor Reorder ===');
  await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/edit`);
  await screenshot(page, 'CHECK2_T12_initial');

  // Find all up/down buttons and check which are enabled
  const allUpBtns = await page.locator('button[title="Move up"]').all();
  const allDownBtns = await page.locator('button[title="Move down"]').all();
  console.log(`All 'Move up' btns: ${allUpBtns.length}, all 'Move down' btns: ${allDownBtns.length}`);

  const enabledUpBtns = [];
  for (let i = 0; i < allUpBtns.length; i++) {
    const disabled = await allUpBtns[i].isDisabled().catch(() => true);
    console.log(`  Up btn ${i}: disabled=${disabled}`);
    if (!disabled) enabledUpBtns.push(i);
  }
  console.log(`Enabled up btns: ${enabledUpBtns.join(', ')}`);
  findings.T12_enabledUpBtns = enabledUpBtns;

  // Click an enabled up button (e.g. the first non-disabled one, which would be the 2nd item)
  if (enabledUpBtns.length > 0) {
    const idx = enabledUpBtns[0];
    const textBefore = await page.evaluate(() => document.body.innerText);
    await allUpBtns[idx].click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    const textAfter = await page.evaluate(() => document.body.innerText);
    const changed = textBefore !== textAfter;
    console.log(`Reorder (up btn ${idx}): content changed = ${changed}`);
    await screenshot(page, 'CHECK2_T12_after_reorder');
    findings.T12_reorderWorks = changed;
  }

  // Check for Add Questions button
  const addQuestionsBtns = await page.locator('button:has-text("Add Questions"), a:has-text("Add Questions"), button:has-text("+ Add")').all();
  console.log(`Add Questions buttons: ${addQuestionsBtns.length}`);
  for (const btn of addQuestionsBtns) {
    const text = await btn.textContent().catch(() => '');
    console.log(`  Add questions btn text: "${text?.trim()}"`);
  }

  // ============================================================
  // CHECK 3: T-15 — FRQ mode visibility for micro test (which has FRQ)
  // ============================================================
  console.log('\n=== CHECK 3: T-15 FRQ Mode ===');
  await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/assign`);
  await screenshot(page, 'CHECK3_T15_assign');

  // Get the max attempts current default
  const maxAttemptsSel = await page.locator('select').first();
  const maxAttemptsVal = await maxAttemptsSel.inputValue().catch(() => 'N/A');
  console.log(`Max attempts select value: "${maxAttemptsVal}"`);

  const fullBodyText = await page.evaluate(() => document.body.innerText);
  console.log('Full assign page text:', fullBodyText);

  const hasFrqMode = fullBodyText.toLowerCase().includes('frq mode') ||
                     fullBodyText.toLowerCase().includes('handwritten') ||
                     fullBodyText.toLowerCase().includes('typed') ||
                     fullBodyText.toLowerCase().includes('submission type');
  console.log(`FRQ mode present: ${hasFrqMode}`);
  findings.T15_frqMode = { hasFrqMode, maxAttemptsDefault: maxAttemptsVal, fullText: fullBodyText };

  // ============================================================
  // CHECK 4: T-14 — Question bank filter verification and correct URL for question edit
  // ============================================================
  console.log('\n=== CHECK 4: T-14 Question Bank Edit Navigation ===');
  await nav(page, `${BASE_URL}/ap/teacher/questions`);
  await screenshot(page, 'CHECK4_T14_initial');

  // Get all edit link hrefs
  const allEditLinks = await page.locator('a[href*="/question/"]').all();
  const allHrefs = [];
  for (let i = 0; i < Math.min(allEditLinks.length, 5); i++) {
    const href = await allEditLinks[i].getAttribute('href').catch(() => '');
    const text = await allEditLinks[i].textContent().catch(() => '');
    allHrefs.push({ href, text: text?.trim() });
  }
  console.log('Edit links:', JSON.stringify(allHrefs));
  findings.T14_editLinks = allHrefs;

  // Try navigating to an existing question (not /new)
  const existingEditLink = allHrefs.find(l => l.href && l.href.includes('/edit'));
  if (existingEditLink) {
    console.log(`\nNavigating to: ${existingEditLink.href}`);
    await nav(page, `${BASE_URL}${existingEditLink.href}`);
    await screenshot(page, 'CHECK4_T14_question_editor');
    console.log(`Question editor URL: ${page.url()}`);
    const editorText = await page.evaluate(() => document.body.innerText);
    console.log('Question editor content:', editorText.substring(0, 400));
    findings.T14_questionEditorNav = { url: page.url(), textSnippet: editorText.substring(0, 400) };
  }

  // Go back and check preview
  await nav(page, `${BASE_URL}/ap/teacher/questions`);
  const previewBtn = await page.locator('button:has-text("Preview")').first();
  if (await previewBtn.isVisible().catch(() => false)) {
    await previewBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'CHECK4_T14_preview');
    const modalText = await page.evaluate(() => document.body.innerText);
    console.log('Preview modal text:', modalText.substring(0, 400));
    findings.T14_previewModal = modalText.substring(0, 400);
  }

  // ============================================================
  // CHECK 5: Console errors - get full messages
  // ============================================================
  // Navigate to question bank again to capture full console error
  await nav(page, `${BASE_URL}/ap/teacher/questions`);
  await page.waitForTimeout(2000);

  // Filter only errors
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warning');
  console.log(`\nTotal console messages: errors=${errors.length}, warnings=${warnings.length}`);
  errors.forEach((e, i) => console.log(`  Error ${i}: ${e.text}`));

  findings.consoleErrors = errors;
  findings.consoleWarnings = warnings.slice(0, 10);

  const outPath = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/b9_deep_checks2.json');
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`\nDeep check 2 results saved to: ${outPath}`);

  await browser.close();
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });

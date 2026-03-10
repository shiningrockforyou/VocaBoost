/**
 * B9 Deep Checks — Investigate specific issues found in the initial audit
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
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      consoleMessages.push({ type, text: text.substring(0, 300), url: page.url() });
    }
  });

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Logged in. URL:', page.url());

  // ============================================================
  // DEEP CHECK 1: T-10 Class Manager — Student management
  // Issue: clicked class failed, need to investigate UI structure
  // ============================================================
  console.log('\n=== DEEP CHECK 1: T-10 Class Student Management ===');
  await nav(page, `${BASE_URL}/ap/teacher/classes`);
  await screenshot(page, 'DC1_T10_class_manager');

  // Get snapshot of the DOM
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Full body text:', bodyText.substring(0, 1000));

  // Get all clickable elements
  const clickableEls = await page.locator('button, a, li, [role="button"]').all();
  console.log(`Clickable elements: ${clickableEls.length}`);
  for (let i = 0; i < Math.min(clickableEls.length, 20); i++) {
    const el = clickableEls[i];
    const tag = await el.evaluate(e => e.tagName).catch(() => '?');
    const text = await el.textContent().catch(() => '');
    const className = await el.getAttribute('class').catch(() => '');
    console.log(`  [${i}] ${tag}: text="${text?.trim().substring(0, 60)}", class="${className?.substring(0, 60)}"`);
  }

  // Try clicking the Calculus class item (different selector)
  const classItems = await page.locator('li, div[class*="class" i], [class*="item" i]').all();
  console.log(`\nClass item candidates: ${classItems.length}`);
  for (let i = 0; i < classItems.length; i++) {
    const text = await classItems[i].textContent().catch(() => '');
    if (text.includes('Period') || text.includes('Economics') || text.includes('Calculus')) {
      console.log(`  Found class item ${i}: "${text?.trim().substring(0, 80)}"`);
      try {
        await classItems[i].click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        await screenshot(page, 'DC1_T10_after_click');
        const afterText = await page.evaluate(() => document.body.innerText);
        console.log('  After click text:', afterText.substring(0, 500));
        findings.T10_clickedClass = { text: text?.trim().substring(0, 60), afterText: afterText.substring(0, 300) };
        break;
      } catch (e) {
        console.log(`  Click failed: ${e.message}`);
      }
    }
  }

  // Check if there's a select/detail panel
  const studentList = await page.locator('text=student, [class*="student" i]').count();
  const emailInput = await page.locator('input[type="email"]').count();
  const removeButtons = await page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="remove" i]').count();
  console.log(`Student list elements: ${studentList}, email inputs: ${emailInput}, remove buttons: ${removeButtons}`);

  // Try the "+ New Class" button
  const newClassBtn = await page.locator('button:has-text("New Class"), button:has-text("+ New Class")').first();
  if (await newClassBtn.isVisible().catch(() => false)) {
    console.log('\nNew Class button found, clicking...');
    await newClassBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'DC1_T10_new_class_clicked');
    const afterNewClass = await page.evaluate(() => document.body.innerText);
    console.log('After New Class click:', afterNewClass.substring(0, 400));
    findings.T10_newClassClicked = afterNewClass.substring(0, 400);
  }

  // ============================================================
  // DEEP CHECK 2: T-14 Question Bank — Edit link goes to /question/new
  // Issue: first edit link is /ap/teacher/question/new, not an existing question
  // ============================================================
  console.log('\n=== DEEP CHECK 2: T-14 Question Bank Edit Links ===');
  await nav(page, `${BASE_URL}/ap/teacher/questions`);
  await screenshot(page, 'DC2_T14_question_bank');

  // Get all edit links
  const editLinks = await page.locator('a[href*="/question/"]').all();
  console.log(`Total question edit links: ${editLinks.length}`);
  const hrefs = [];
  for (let i = 0; i < Math.min(editLinks.length, 10); i++) {
    const href = await editLinks[i].getAttribute('href').catch(() => '');
    hrefs.push(href);
    console.log(`  Link ${i}: ${href}`);
  }
  findings.T14_editLinkHrefs = hrefs;

  // Check the structure of question rows
  console.log('\nQuestion row structure:');
  const questionRows = await page.locator('tr, [class*="question-row" i], [class*="QuestionRow" i]').all();
  console.log(`Question rows: ${questionRows.length}`);

  // Get a sample row's HTML
  if (questionRows.length > 1) {
    const rowHTML = await questionRows[1].innerHTML().catch(() => '');
    console.log('Sample row HTML:', rowHTML.substring(0, 400));
    findings.T14_sampleRowHTML = rowHTML.substring(0, 400);
  }

  // Check the console errors for full message
  console.log('\nFull console errors so far:');
  consoleMessages.forEach((m, i) => console.log(`  [${i}] [${m.type}] ${m.text}`));

  // ============================================================
  // DEEP CHECK 3: T-15 — Max attempts default value
  // ============================================================
  console.log('\n=== DEEP CHECK 3: T-15 Max Attempts Default ===');
  await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/assign`);
  await screenshot(page, 'DC3_T15_assign_page');

  // Get all select elements and their current values
  const allSelects = await page.locator('select').all();
  for (let i = 0; i < allSelects.length; i++) {
    const name = await allSelects[i].getAttribute('name').catch(() => '');
    const val = await allSelects[i].inputValue().catch(() => '');
    const options = await allSelects[i].locator('option').allTextContents();
    console.log(`  Select ${i}: name="${name}", currentValue="${val}", options=${JSON.stringify(options)}`);
    findings[`T15_select${i}`] = { name, val, options };
  }

  // Also check for FRQ mode — Micro test has FRQ, so it should appear
  const frqModeSection = await page.locator('text=FRQ, text=Handwritten, text=Typed').count();
  console.log(`FRQ mode elements: ${frqModeSection}`);
  const fullBodyText = await page.evaluate(() => document.body.innerText);
  console.log('Full assign page text:', fullBodyText);
  findings.T15_fullBodyText = fullBodyText;

  // ============================================================
  // DEEP CHECK 4: T-12 — Test editor question reorder verification
  // ============================================================
  console.log('\n=== DEEP CHECK 4: T-12 Test Editor — Question reorder ===');
  await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/edit`);
  await screenshot(page, 'DC4_T12_editor');

  const fullEditorText = await page.evaluate(() => document.body.innerText);
  console.log('Editor text (first 1500 chars):', fullEditorText.substring(0, 1500));
  findings.T12_editorText = fullEditorText.substring(0, 1500);

  // Count question items
  const questionItems = await page.locator('[class*="question" i], [class*="Question" i]').all();
  console.log(`Question item elements: ${questionItems.length}`);

  // Get up/down button details
  const upBtns = await page.locator('button:has-text("▲"), button:has-text("^")').all();
  const downBtns = await page.locator('button:has-text("▼"), button:has-text("v")').all();
  console.log(`Up buttons: ${upBtns.length}, Down buttons: ${downBtns.length}`);

  // Try clicking the up button on the second question
  if (upBtns.length >= 2) {
    console.log('Attempting to click up button on second question...');
    // Get text before
    const textBefore = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    await upBtns[1].click();
    await page.waitForTimeout(500);
    const textAfter = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const changed = textBefore !== textAfter;
    console.log(`  Reorder changed content: ${changed}`);
    findings.T12_reorderWorks = changed;
    await screenshot(page, 'DC4_T12_after_reorder');
  }

  // Check for Add Questions button
  const addQuestionsBtn = await page.locator('button:has-text("Add Questions"), a:has-text("Add Questions"), button:has-text("+ Add")').count();
  console.log(`Add Questions buttons: ${addQuestionsBtn}`);
  findings.T12_addQuestionsBtn = addQuestionsBtn;

  // ============================================================
  // DEEP CHECK 5: T-10 — class detail/student management
  // Navigate back and try different approach
  // ============================================================
  console.log('\n=== DEEP CHECK 5: T-10 Class Detail with Full Snapshot ===');
  await nav(page, `${BASE_URL}/ap/teacher/classes`);

  // Get full DOM snapshot via evaluate
  const snapshot = await page.evaluate(() => {
    const getAllElements = (el, depth = 0) => {
      if (depth > 5) return '';
      const tag = el.tagName || '';
      const text = (el.textContent || '').trim().substring(0, 50);
      const className = el.className || '';
      const onClick = el.onclick ? 'has-onclick' : '';
      let result = `${'  '.repeat(depth)}${tag}(class="${className.substring(0,40)}", onclick=${onClick}): "${text}"\n`;
      for (const child of el.children) {
        result += getAllElements(child, depth + 1);
      }
      return result;
    };
    const main = document.querySelector('main') || document.body;
    return getAllElements(main).substring(0, 5000);
  });
  console.log('DOM snapshot:', snapshot.substring(0, 3000));
  findings.T10_domSnapshot = snapshot.substring(0, 3000);

  // Try using page.click with a text-based approach
  try {
    await page.click('text=AP Calculus AB Period 3', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'DC5_T10_calc_clicked');
    const afterText = await page.evaluate(() => document.body.innerText);
    console.log('After clicking Calc class:', afterText.substring(0, 500));
    findings.T10_calcClickResult = afterText.substring(0, 500);
  } catch (e) {
    console.log(`Click on Calc class failed: ${e.message}`);
    // Try with a different selector
    try {
      await page.click('li:has-text("AP Calculus")', { timeout: 3000 });
      await page.waitForTimeout(2000);
      await screenshot(page, 'DC5_T10_calc_li_clicked');
      const afterText = await page.evaluate(() => document.body.innerText);
      console.log('After li click:', afterText.substring(0, 500));
    } catch (e2) {
      console.log(`li click also failed: ${e2.message}`);
    }
  }

  // ============================================================
  // DEEP CHECK 6: T-14 — question bank with no table rows (tbody tr=0)
  // Filter test to verify filtered rows
  // ============================================================
  console.log('\n=== DEEP CHECK 6: T-14 Question Bank Layout ===');
  await nav(page, `${BASE_URL}/ap/teacher/questions`);
  await screenshot(page, 'DC6_T14_layout');

  // Check what structure is used (not table?)
  const tableCount = await page.locator('table').count();
  const divRows = await page.locator('[class*="row" i], [class*="item" i], [class*="card" i]').count();
  console.log(`Table elements: ${tableCount}, div rows: ${divRows}`);

  // Get the full structure of the question list
  const listHTML = await page.evaluate(() => {
    const listEl = document.querySelector('main') || document.querySelector('#root');
    return listEl ? listEl.innerHTML.substring(0, 3000) : 'no main';
  });
  console.log('Question bank HTML structure:', listHTML.substring(0, 2000));
  findings.T14_htmlStructure = listHTML.substring(0, 2000);

  // Count actual question items regardless of structure
  const allRows = await page.locator('table tbody tr, [role="row"], .question-row, [class*="QuestionRow"]').count();
  const allVisibleItems = await page.locator(':text("MCQ"), :text("FRQ"), :text("Multiple Choice")').count();
  console.log(`Rows by various selectors: ${allRows}`);
  console.log(`Visible MCQ/FRQ items: ${allVisibleItems}`);

  // Check for the filter functionality
  console.log('\nTesting filter:');
  const subjectSelect = await page.locator('select').first();
  const subjectOptions = await subjectSelect.locator('option').allTextContents();
  console.log(`Subject options: ${JSON.stringify(subjectOptions.slice(0, 6))}`);

  // Select Microeconomics
  await subjectSelect.selectOption({ label: 'AP Microeconomics' });
  await page.waitForTimeout(2000);
  await screenshot(page, 'DC6_T14_filtered_micro');
  const afterFilterText = await page.evaluate(() => document.body.innerText);
  const microQuestionCount = (afterFilterText.match(/MCQ|FRQ|Multiple Choice/g) || []).length;
  console.log(`After filtering to Micro: question mentions = ${microQuestionCount}`);
  findings.T14_filterWorked = microQuestionCount > 0;

  // Test preview button
  const previewBtns = await page.locator('button:has-text("Preview")').all();
  if (previewBtns.length > 0) {
    await previewBtns[0].click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'DC6_T14_preview_modal');
    const previewText = await page.evaluate(() => document.body.innerText);
    const modalVisible = previewText.includes('Preview') || await page.locator('[role="dialog"], .modal, [class*="modal" i]').isVisible().catch(() => false);
    console.log(`Preview modal visible: ${modalVisible}`);
    findings.T14_previewModal = { visible: modalVisible, textSnippet: previewText.substring(0, 200) };
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Summary
  findings.consoleErrors = consoleMessages;
  const outPath = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/b9_deep_checks.json');
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`\nDeep check results saved to: ${outPath}`);

  await browser.close();
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });

/**
 * B11 Audit - Phase 2: Detailed responsive checks and source investigation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const BASE_URL = 'http://localhost:5173';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASS = 'Teacher123!';

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASS);
  await page.press('input[type="password"]', 'Enter');
  await page.waitForTimeout(3000);
  if (page.url().includes('/login')) throw new Error('Login failed');
  console.log('Logged in as teacher');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const report = {};

  try {
    await login(page);

    // ---- Gradebook: check if table has horizontal scroll container ----
    await page.goto(`${BASE_URL}/ap/gradebook`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    const gradebookTableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const result = [];
      tables.forEach(t => {
        const parent = t.parentElement;
        const grandparent = t.parentElement?.parentElement;
        const tStyle = window.getComputedStyle(t);
        const pStyle = parent ? window.getComputedStyle(parent) : null;
        const gpStyle = grandparent ? window.getComputedStyle(grandparent) : null;

        result.push({
          tableWidth: t.scrollWidth,
          tableClientWidth: t.clientWidth,
          parentOverflow: pStyle ? pStyle.overflowX : null,
          grandparentOverflow: gpStyle ? gpStyle.overflowX : null,
          parentTag: parent?.tagName,
          grandparentTag: grandparent?.tagName,
          parentClasses: parent ? Array.from(parent.classList).join(' ') : '',
          // Check if Grade button is visible in viewport
          headers: Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim()),
        });
      });
      return result;
    });
    report.gradebookTable = gradebookTableInfo;
    console.log('\nGradebook table info (mobile 375px):');
    console.log(JSON.stringify(gradebookTableInfo, null, 2));

    // Check if Action column header is visible
    const gradebookActionVisible = await page.evaluate(() => {
      const ths = document.querySelectorAll('th');
      for (const th of ths) {
        if (th.textContent.trim() === 'Action') {
          const rect = th.getBoundingClientRect();
          return { exists: true, visible: rect.right <= window.innerWidth && rect.left >= 0, rect: { left: rect.left, right: rect.right } };
        }
      }
      return { exists: false };
    });
    report.gradebookActionColumnVisible = gradebookActionVisible;
    console.log('\nGradebook Action column visibility:', gradebookActionVisible);

    // Check Grade button visibility
    const gradeButtonVisible = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim() === 'Grade') {
          const rect = btn.getBoundingClientRect();
          return { exists: true, visible: rect.right <= window.innerWidth && rect.left >= 0, rect: { left: rect.left, right: rect.right, width: rect.width } };
        }
      }
      return { exists: false };
    });
    report.gradeButtonVisible = gradeButtonVisible;
    console.log('Grade button visibility:', gradeButtonVisible);

    // ---- Report Card MCQ Table ----
    await page.goto(`${BASE_URL}/ap/results/result_micro_student1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    const reportCardTableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const result = [];
      tables.forEach(t => {
        const parent = t.parentElement;
        const pStyle = parent ? window.getComputedStyle(parent) : null;
        result.push({
          tableScrollWidth: t.scrollWidth,
          tableClientWidth: t.clientWidth,
          parentOverflow: pStyle ? pStyle.overflowX : null,
          parentClasses: parent ? Array.from(parent.classList).join(' ') : '',
          headers: Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim()),
        });
      });
      return result;
    });
    report.reportCardTable = reportCardTableInfo;
    console.log('\nReport Card table info (mobile 375px):');
    console.log(JSON.stringify(reportCardTableInfo, null, 2));

    // ---- Source code checks for specific color classes ----
    // Check if "Your Answer" and "Result" are visible
    const reportCardAnswerColVisible = await page.evaluate(() => {
      const ths = document.querySelectorAll('th');
      const result = {};
      for (const th of ths) {
        const text = th.textContent.trim();
        if (text === 'Your Answer' || text === 'Result') {
          const rect = th.getBoundingClientRect();
          result[text] = { exists: true, visible: rect.right <= window.innerWidth && rect.left >= 0, rect: { left: rect.left, right: rect.right, viewWidth: window.innerWidth } };
        }
      }
      return result;
    });
    report.reportCardColumnVisibility = reportCardAnswerColVisible;
    console.log('\nReport Card column visibility (mobile 375px):', reportCardAnswerColVisible);

    // Take a screenshot of the table area specifically
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b11_x02_mobile_375_Report_Card_table_scroll.png'), fullPage: true });

    // Check if table container has horizontal scroll
    const tableScrollContainer = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      for (const t of tables) {
        const parent = t.parentElement;
        const pStyle = window.getComputedStyle(parent);
        return {
          parentTag: parent.tagName,
          parentClasses: Array.from(parent.classList).join(' '),
          parentOverflowX: pStyle.overflowX,
          parentScrollWidth: parent.scrollWidth,
          parentClientWidth: parent.clientWidth,
          canScroll: parent.scrollWidth > parent.clientWidth,
        };
      }
      return null;
    });
    report.tableScrollContainer = tableScrollContainer;
    console.log('\nTable scroll container info:', tableScrollContainer);

  } catch (err) {
    console.error('Error:', err.message);
    report.error = err.message;
  } finally {
    await browser.close();
  }

  const outputPath = path.join(SCREENSHOTS_DIR, 'b11_results2.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log('\nResults written to:', outputPath);
}

main().catch(console.error);

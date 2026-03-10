/**
 * B11 Audit Phase 3: Analytics page token check + confirmation of responsive
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const BASE_URL = 'http://localhost:5173';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASS = 'Teacher123!';

const SCAN_CONFIG = {
  rawBg: ['bg-white', 'bg-gray-', 'bg-slate-', 'bg-green-', 'bg-red-'],
  rawText: ['text-gray-', 'text-slate-', 'text-green-', 'text-red-'],
  rawBorder: ['border-gray-', 'border-slate-', 'border-green-', 'border-red-'],
  rawRadiusExact: ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl'],
  exceptions: ['bg-white/20', 'bg-black/']
};

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASS);
  await page.press('input[type="password"]', 'Enter');
  await page.waitForTimeout(3000);
  if (page.url().includes('/login')) throw new Error('Login failed');
  console.log('Logged in');
}

async function checkDesignTokens(page) {
  return page.evaluate((config) => {
    const { rawBg, rawText, rawBorder, rawRadiusExact, exceptions } = config;
    const allElements = document.querySelectorAll('*');
    const violationsList = [];

    allElements.forEach(el => {
      const classes = Array.from(el.classList);
      classes.forEach(cls => {
        const isException = exceptions.some(ex => cls.startsWith(ex));
        if (isException) return;

        let violation = null;
        for (const p of rawBg) { if (cls === p || cls.startsWith(p)) { violation = { type: 'bg', class: cls, tag: el.tagName.toLowerCase(), html: el.outerHTML.substring(0, 100) }; break; } }
        if (!violation) for (const p of rawText) { if (cls.startsWith(p)) { violation = { type: 'text', class: cls, tag: el.tagName.toLowerCase(), html: el.outerHTML.substring(0, 100) }; break; } }
        if (!violation) for (const p of rawBorder) { if (cls.startsWith(p)) { violation = { type: 'border', class: cls, tag: el.tagName.toLowerCase(), html: el.outerHTML.substring(0, 100) }; break; } }
        if (!violation && rawRadiusExact.includes(cls)) { violation = { type: 'radius', class: cls, tag: el.tagName.toLowerCase(), html: el.outerHTML.substring(0, 100) }; }

        if (violation) violationsList.push(violation);
      });
    });

    const seen = new Set();
    return violationsList.filter(v => {
      if (seen.has(v.class)) return false;
      seen.add(v.class);
      return true;
    });
  }, SCAN_CONFIG);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const results = {};

  try {
    await login(page);

    // Check analytics page after it loads data
    console.log('\n--- Analytics page token check ---');
    await page.goto(`${BASE_URL}/ap/teacher/analytics/test_micro_full_1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(4000); // Let Firebase data load

    const analyticsViolations = await checkDesignTokens(page);
    console.log(`Analytics violations: ${analyticsViolations.length}`);
    analyticsViolations.forEach(v => console.log(`  [${v.type}] "${v.class}" on <${v.tag}>`));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b11_analytics_desktop.png'), fullPage: true });
    results.analytics = analyticsViolations;

    // Check the student profile page if accessible
    console.log('\n--- Student profile check ---');
    await page.goto(`${BASE_URL}/ap/teacher/analytics/test_micro_full_1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Try to navigate to student result
    const studentLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/student/"], button');
      return Array.from(links).slice(0, 5).map(l => l.textContent.trim() + ' | ' + (l.href || 'button'));
    });
    console.log('Student navigation elements found:', studentLinks);

    // ---- Check gradebook mobile more carefully ----
    console.log('\n--- Gradebook horizontal scroll check (mobile 375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/ap/gradebook`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    // Check if there's a horizontal scroll indicator (fade shadow or similar)
    const scrollIndicatorCheck = await page.evaluate(() => {
      const container = document.querySelector('.overflow-x-auto');
      if (!container) return { found: false };
      const styles = window.getComputedStyle(container);
      const parentStyles = container.parentElement ? window.getComputedStyle(container.parentElement) : null;
      return {
        found: true,
        containerClasses: Array.from(container.classList).join(' '),
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        hasScrollShadow: container.classList.contains('scroll-shadow') || false,
        parentClasses: container.parentElement ? Array.from(container.parentElement.classList).join(' ') : '',
      };
    });
    console.log('Gradebook scroll container:', scrollIndicatorCheck);
    results.gradebookScrollContainer = scrollIndicatorCheck;

    // Screenshot to see if there's any visual scroll indicator
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b11_gradebook_mobile_detail.png'), fullPage: true });

    // Check if user can actually see a scrollbar or has any indication to scroll
    const hasScrollIndicator = await page.evaluate(() => {
      const overflow_containers = document.querySelectorAll('.overflow-x-auto');
      const indicators = [];
      overflow_containers.forEach(c => {
        indicators.push({
          canScroll: c.scrollWidth > c.clientWidth,
          hasAfterPseudo: false, // Can't easily check pseudo-elements
          hasSiblingIndicator: !!c.nextElementSibling,
        });
      });
      return indicators;
    });
    console.log('Scroll indicators:', JSON.stringify(hasScrollIndicator));

    // Check Report Card at tablet 768 - verify "Your Answer" and "Result" are visible
    console.log('\n--- Report Card 768px table visibility ---');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/ap/results/result_micro_student1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    const reportCard768ColVisibility = await page.evaluate(() => {
      const ths = document.querySelectorAll('th');
      const result = {};
      for (const th of ths) {
        const text = th.textContent.trim();
        if (['Your Answer', 'Result', 'Q#', 'Domain', 'Topic', 'Correct'].includes(text)) {
          const rect = th.getBoundingClientRect();
          result[text] = { visible: rect.right <= window.innerWidth && rect.left >= 0 };
        }
      }
      return result;
    });
    console.log('Report Card column visibility at 768px:', reportCard768ColVisibility);
    results.reportCard768 = reportCard768ColVisibility;

  } catch (err) {
    console.error('Error:', err.message);
    results.error = err.message;
  } finally {
    await browser.close();
  }

  const outputPath = path.join(SCREENSHOTS_DIR, 'b11_results3.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log('\nResults written to:', outputPath);
}

main().catch(console.error);

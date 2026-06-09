/**
 * TA-ROSTER Deep Inspection
 * Detailed per-class overflow score examination and final data collection.
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SITE = 'https://vocaboostone.netlify.app';
const TEACHER_EMAIL = 'ta@vocaboost.com';
const TEACHER_PASSWORD = 'VocaTA2026!';
const SCREENSHOT_DIR = '/app/audit/playwright/findings/screenshots/TA-ROSTER';
const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome';

const ALLOWED_CLASSES = [
  { id: 'GNktwcqI18vyAps3iJDf', name: '25WT 2차 TOP ONLINE' },
  { id: 'LVjBTFuYE8FbPG34pVAt', name: '25WT 2차 CORE OFFLINE' },
  { id: 'OMMwcLz3FlOiKBYjBMla', name: '25WT 2차 CORE ONLINE' },
  { id: 'k8tzOiiwotBbtJS3uTiv', name: '25WT 2차 TOP OFFLINE' },
];

let screenshotIndex = 300;

async function screenshot(page, label) {
  const filename = `${String(screenshotIndex++).padStart(3, '0')}_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  const fullPath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`Screenshot: ${fullPath}`);
  return fullPath;
}

async function login(page) {
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) await loginLink.click();
  else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL);
  await page.getByLabel(/password/i).first().fill(TEACHER_PASSWORD);
  await page.getByLabel(/password/i).first().press('Enter');
  try {
    await page.waitForURL(/\/(dashboard|classes|$)/, { timeout: 15000 });
  } catch {
    await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|classes|$)/, { timeout: 15000 }).catch(() => {});
  }
}

async function gotoStudentsTab(page, classId) {
  await page.goto(`${SITE}/classes/${classId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const studentsTab = page.locator('button, a, [role="tab"]').filter({ hasText: /^Students$/i });
  if (await studentsTab.count() > 0) {
    await studentsTab.first().click();
    await page.waitForTimeout(2500);
  } else {
    const link = page.getByText('Students').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForTimeout(2500);
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
  });

  const report = {};

  try {
    for (const cls of ALLOWED_CLASSES) {
      console.log(`\n=== Deep inspect: ${cls.name} ===`);

      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();

      try {
        await login(page);
        await gotoStudentsTab(page, cls.id);

        // Wait for table to fully load
        await page.waitForTimeout(1500);

        const ss = await screenshot(page, `deep_${cls.id}`);

        // Get complete student table data
        const fullTableData = await page.evaluate(() => {
          // Get all table rows
          const rows = document.querySelectorAll('tbody tr');
          return Array.from(rows).map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            return cells.map(td => td.innerText.trim());
          });
        });

        console.log(`Total student rows: ${fullTableData.length}`);

        // Extract all percentage values and find overflow
        const allPcts = await page.evaluate(() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const results = [];
          let node;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            const matches = [...t.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
            for (const m of matches) {
              const val = parseFloat(m[1]);
              if (val > 0) {
                // Get meaningful context
                let context = t;
                const parent = node.parentElement;
                const grandParent = parent?.parentElement;
                const greatGrand = grandParent?.parentElement;
                // Walk up to find row context
                let row = parent;
                while (row && row.tagName !== 'TR' && row !== document.body) {
                  row = row.parentElement;
                }
                results.push({
                  val,
                  text: m[0],
                  textContext: context.substring(0, 100),
                  rowText: row ? row.innerText?.trim().substring(0, 200) : null,
                  parentClass: String(parent?.className || '').substring(0, 80),
                });
              }
            }
          }
          return results;
        });

        const overflows = allPcts.filter(p => p.val > 100);
        const normal = allPcts.filter(p => p.val >= 0 && p.val <= 100);

        report[cls.id] = {
          name: cls.name,
          studentCount: fullTableData.length,
          overflowScores: overflows,
          normalScores: normal.length,
          sampleNormalScores: normal.slice(0, 5).map(p => p.text),
          sampleRows: fullTableData.slice(0, 5),
          screenshot: ss,
        };

        if (overflows.length > 0) {
          console.log(`[BLOCKER] ${overflows.length} overflow score(s):`);
          for (const o of overflows) {
            console.log(`  ${o.text} — row: ${o.rowText?.substring(0, 150)}`);
          }
        } else {
          console.log(`No overflow scores. Normal scores: ${normal.length}`);
          normal.slice(0, 5).forEach(p => console.log('  ', p.text, '—', p.textContext));
        }

        // Also check the full page text for any large numbers that look like scores
        const largeNums = await page.evaluate(() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const results = [];
          let node;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            // Look for standalone large numbers that could be scores rendered as integers
            const matches = [...t.matchAll(/\b((?:9[0-9]{2,}|[1-9]\d{3,}))\b/g)];
            for (const m of matches) {
              const val = parseInt(m[1]);
              // Skip if it's clearly a word count (e.g., 3381) or date
              if (val >= 200 && val <= 100000 && !t.includes('words') && !t.includes('/3')) {
                const parent = node.parentElement;
                let row = parent;
                while (row && row.tagName !== 'TR' && row !== document.body) {
                  row = row.parentElement;
                }
                results.push({
                  val,
                  text: m[0],
                  context: t.substring(0, 100),
                  rowText: row ? row.innerText?.trim().substring(0, 200) : null,
                });
              }
            }
          }
          return results.slice(0, 20);
        });

        if (largeNums.length > 0) {
          console.log('Large numbers found (possible score bugs):', largeNums.slice(0, 5));
        }

      } finally {
        await ctx.close();
      }
    }

    // Additional check: look at k8tzOiiwotBbtJS3uTiv (TOP OFFLINE) more carefully
    // It had 0 student rows in v3 - may have loaded slowly
    console.log('\n=== Extra check: TOP OFFLINE loading ===');
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await ctx2.newPage();
    try {
      await login(page2);
      await page2.goto(`${SITE}/classes/k8tzOiiwotBbtJS3uTiv`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page2.waitForTimeout(3000);

      // Click Students tab
      const studentsTab = page2.locator('button, a, [role="tab"]').filter({ hasText: /^Students$/i });
      if (await studentsTab.count() > 0) {
        await studentsTab.first().click();
        await page2.waitForTimeout(4000); // extra wait for large class
      }

      const ss = await screenshot(page2, 'deep_TOP_OFFLINE_wait');

      const rowCount = await page2.evaluate(() => document.querySelectorAll('tbody tr').length);
      console.log('TOP OFFLINE row count after longer wait:', rowCount);

      const pcts = await page2.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const results = [];
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          const matches = [...t.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
          for (const m of matches) {
            results.push({ val: parseFloat(m[1]), text: m[0], context: t.substring(0, 100) });
          }
        }
        return results.filter(p => p.val > 100);
      });

      console.log('TOP OFFLINE overflow scores:', pcts.length);
      if (pcts.length > 0) {
        pcts.forEach(p => console.log('  ', p.text, '—', p.context));
      }

      report['k8tzOiiwotBbtJS3uTiv_recheck'] = {
        rowCount,
        overflowScores: pcts,
        screenshot: ss,
      };

    } finally {
      await ctx2.close();
    }

    // Check mobile overflow in detail
    console.log('\n=== Mobile overflow check ===');
    const ctx3 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page3 = await ctx3.newPage();
    try {
      await login(page3);
      await gotoStudentsTab(page3, ALLOWED_CLASSES[0].id);
      const ss = await screenshot(page3, 'mobile_overflow_detail');

      const overflowDetail = await page3.evaluate(() => {
        const body = document.body;
        const overflowEls = [];

        // Find elements that extend beyond viewport
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 5 || rect.left < -5) {
            overflowEls.push({
              tag: el.tagName,
              cls: String(el.className || '').substring(0, 80),
              text: (el.innerText || '').trim().substring(0, 40),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }
        return {
          windowWidth: window.innerWidth,
          bodyScrollWidth: body.scrollWidth,
          overflowElements: overflowEls.slice(0, 10),
        };
      });

      console.log('Mobile overflow detail:', JSON.stringify(overflowDetail, null, 2));
      report['mobile_overflow'] = overflowDetail;

    } finally {
      await ctx3.close();
    }

  } finally {
    await browser.close();
  }

  writeFileSync('/app/e2e/audit/_tmp/ta_roster_deep_report.json', JSON.stringify(report, null, 2));
  console.log('\nDeep report written.');
  return report;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

/**
 * B11 Gradebook Fade Check - verify scroll affordance is actually visible at 375px
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/b11_fresh');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.keyboard.press('Enter');
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });

  // Navigate to Gradebook
  await page.goto(`${BASE_URL}/ap/gradebook`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Take viewport screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x02_gradebook_375_viewport.png') });
  // Take full page screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x02_gradebook_375_full.png'), fullPage: true });

  // Check fade element
  const fadeInfo = await page.evaluate(() => {
    // Find the fade div
    const fadeEls = Array.from(document.querySelectorAll('[class*="gradient"]'));
    const results = [];
    for (const el of fadeEls) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      results.push({
        classes: Array.from(el.classList).join(' '),
        rect: { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents
      });
    }
    return results;
  });

  console.log('Fade elements found:', JSON.stringify(fadeInfo, null, 2));

  // Also check the relative container
  const containerInfo = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.relative'));
    const results = [];
    for (const c of containers) {
      const overflowEl = c.querySelector('[class*="overflow-x"]');
      if (overflowEl) {
        const rect = c.getBoundingClientRect();
        const children = Array.from(c.children).map(ch => ({
          tag: ch.tagName,
          classes: Array.from(ch.classList).slice(0, 5).join(' '),
          rect: { width: Math.round(ch.getBoundingClientRect().width) }
        }));
        results.push({
          containerClasses: Array.from(c.classList).slice(0, 5).join(' '),
          containerRect: { width: Math.round(rect.width), height: Math.round(rect.height) },
          children
        });
      }
    }
    return results;
  });

  console.log('\nRelative containers with overflow children:', JSON.stringify(containerInfo, null, 2));

  // Check if Grade button is visible in viewport
  const gradeButtonInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.filter(b => b.textContent.trim() === 'Grade' || b.textContent.trim() === 'View').map(b => {
      const rect = b.getBoundingClientRect();
      return {
        text: b.textContent.trim(),
        rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
        inViewport: rect.left >= 0 && rect.right <= window.innerWidth,
        viewportWidth: window.innerWidth
      };
    });
  });

  console.log('\nGrade/View buttons:', JSON.stringify(gradeButtonInfo, null, 2));

  await browser.close();
}

main().catch(console.error);

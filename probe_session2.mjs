/**
 * Probe 2: Try clicking "I know this word" directly and check mastery count
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  serviceWorkers: 'block',
});

const page = await context.newPage();

page.on('console', msg => {
  if (msg.type() !== 'log' || msg.text().includes('error') || msg.text().includes('Error')) {
    console.log('CONSOLE:', msg.type(), msg.text().slice(0, 200));
  }
});

try {
  // Login
  await page.goto('https://vocaboostone.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill('audit_phone_01_top@vocaboost.test');
  await page.getByLabel(/password/i).first().fill('AuditPass2026!');
  await page.getByLabel(/password/i).first().press('Enter');

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Start session
  const startBtn = page.getByRole('button', { name: /start session/i }).first();
  await startBtn.scrollIntoViewIfNeeded();
  await startBtn.click();
  await page.waitForTimeout(2000);

  // Handle intro modal
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudyingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startStudyingBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(2000);

  // Get initial state
  let bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('Initial state:', bodyText.slice(0, 200));

  // Try clicking "I know this word" 3 times and check counter
  for (let i = 0; i < 5; i++) {
    const iKnowBtn = page.getByRole('button', { name: /i know this word/i }).first();
    const isVisible = await iKnowBtn.isVisible().catch(() => false);
    const box = await iKnowBtn.boundingBox().catch(() => null);
    console.log(`[${i}] "I know this word" visible=${isVisible} box=${JSON.stringify(box)}`);

    if (isVisible) {
      await iKnowBtn.click();
      await page.waitForTimeout(500);
      bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      const masteredMatch = bodyText.match(/(\d+) of (\d+) mastered/);
      const cardMatch = bodyText.match(/Card (\d+) of (\d+)/);
      console.log(`  After click: mastered=${masteredMatch?.[0]} card=${cardMatch?.[0]}`);
    } else {
      console.log('  Button not visible, checking all buttons...');
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const aria = await btn.getAttribute('aria-label').catch(() => '');
        const vis = await btn.isVisible().catch(() => false);
        console.log(`    btn aria="${aria}" vis=${vis}`);
      }
      break;
    }
  }

  // Check if "Skip to Test" is available in session menu
  const menuBtn = page.getByRole('button', { name: /session menu/i }).first();
  if (await menuBtn.isVisible().catch(() => false)) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/app/findings/day1/D1-05_evidence/probe2_menu.png', fullPage: false });

    const menuText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    console.log('Menu text:', menuText.slice(0, 500));

    // Look for skip to test
    const skipBtn = page.getByText(/skip to test|jump to test/i).first();
    if (await skipBtn.isVisible().catch(() => false)) {
      console.log('Found Skip to Test in menu!');
    }

    // Close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '/app/findings/day1/D1-05_evidence/probe2_after.png', fullPage: false });

} finally {
  await context.close();
  await browser.close();
}

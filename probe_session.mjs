/**
 * Probe session page to understand button layout
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

try {
  // Login
  await page.goto('https://vocaboostone.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();
  else await page.evaluate(() => {
    history.pushState({}, '', '/login');
    dispatchEvent(new PopStateEvent('popstate'));
  });

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill('audit_phone_01_top@vocaboost.test');
  await page.getByLabel(/password/i).first().fill('AuditPass2026!');
  await page.getByLabel(/password/i).first().press('Enter');

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
  console.log('Logged in. URL:', page.url());
  await page.waitForTimeout(2000);

  // Find and click Start Session
  const startBtn = page.getByRole('button', { name: /start session/i }).first();
  if (await startBtn.isVisible().catch(() => false)) {
    const box = await startBtn.boundingBox();
    console.log('Start button box:', JSON.stringify(box));
    await startBtn.scrollIntoViewIfNeeded();
    await startBtn.click();
  }
  await page.waitForTimeout(2000);
  console.log('URL after start:', page.url());

  // Handle intro modal
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudyingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found intro modal, clicking Start Studying');
    await startStudyingBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(2000);

  // Enumerate all buttons
  const allBtns = await page.locator('button').all();
  console.log('\nTotal buttons:', allBtns.length);
  for (const btn of allBtns) {
    const txt = await btn.textContent().catch(() => '');
    const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
    const box = await btn.boundingBox().catch(() => null);
    const isVisible = await btn.isVisible().catch(() => false);
    console.log(`Button: text="${txt.trim().slice(0,40)}" aria="${ariaLabel}" visible=${isVisible} box=${JSON.stringify(box)}`);
  }

  // Get body text
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('\nBody text:', bodyText.slice(0, 500));

  // Screenshot
  await page.screenshot({ path: '/app/findings/day1/D1-05_evidence/probe_session.png', fullPage: false });
  console.log('Screenshot saved');

  // Try clicking the "I know" / checkmark button specifically
  // Look for svgs or buttons with specific class
  const btnsHtml = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.map(b => ({
      text: b.textContent?.trim().slice(0, 40),
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className?.slice(0, 80),
      type: b.getAttribute('type'),
    }));
  });
  console.log('\nButtons detail:');
  btnsHtml.forEach((b, i) => console.log(`  [${i}]`, JSON.stringify(b)));

} finally {
  await context.close();
  await browser.close();
}

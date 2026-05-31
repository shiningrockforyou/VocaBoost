import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();

// Login
const email = 'audit_perfectionist_01_core@vocaboost.test';
const pass = 'AuditPass2026!';

await page.goto('https://vocaboostone.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);

const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
if (await loginLink.isVisible().catch(() => false)) await loginLink.click();
else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });

await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
await page.getByLabel(/email/i).first().fill(email);
await page.getByLabel(/password/i).first().fill(pass);
await page.getByLabel(/password/i).first().press('Enter');
await page.waitForURL(/\/(dashboard|home|$)/, { timeout: 20000 });
console.log('Logged in:', page.url());

// Click start session
await page.waitForTimeout(2000);
const startBtn = page.getByRole('button', { name: /start/i }).first();
if (await startBtn.isVisible().catch(() => false)) { await startBtn.click(); await page.waitForTimeout(2000); }

// Dismiss modal if present
const modal = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
if (modal) {
  const mBtn = page.locator('.fixed.inset-0').locator('button').first();
  if (await mBtn.isVisible().catch(() => false)) { await mBtn.click(); await page.waitForTimeout(800); }
}

// Get all button info
const btnInfo = await page.evaluate(() => {
  return [...document.querySelectorAll('button')].map(b => {
    const r = b.getBoundingClientRect();
    return {
      text: b.textContent?.trim()?.slice(0, 50),
      ariaLabel: b.getAttribute('aria-label'),
      ariaDescribedby: b.getAttribute('aria-describedby'),
      title: b.getAttribute('title'),
      class: b.className?.slice(0, 80),
      visible: r.width > 0 && r.height > 0,
      disabled: b.disabled,
    };
  });
});

console.log('BUTTONS:', JSON.stringify(btnInfo.filter(b => b.visible), null, 2));

// Get page structure
const pageSnap = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log('PAGE TEXT:', pageSnap);

// Click Next card a few times and see if a new button appears after all mastered
const nextCardBtn = page.locator('[aria-label="Next card"]').first();
for (let i = 0; i < 5; i++) {
  if (await nextCardBtn.isVisible().catch(() => false)) {
    await nextCardBtn.click();
    await page.waitForTimeout(300);
  }
}

// After cycling, check for new buttons
const btnInfo2 = await page.evaluate(() => {
  return [...document.querySelectorAll('button')].filter(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map(b => ({
    text: b.textContent?.trim()?.slice(0, 50),
    ariaLabel: b.getAttribute('aria-label'),
    title: b.getAttribute('title'),
  }));
});
console.log('BUTTONS AFTER 5 CLICKS:', JSON.stringify(btnInfo2, null, 2));

// Get a page screenshot for visual inspection
await page.screenshot({ path: '/tmp/diag_session.png', fullPage: true });
console.log('Screenshot: /tmp/diag_session.png');

await browser.close();

/**
 * B09 — Explore session flow to find actual test page
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B09';
mkdirSync(EVIDENCE_DIR, { recursive: true });

async function screenshot(page, name) {
  const path = `${EVIDENCE_DIR}/${name}.png`;
  try { await page.screenshot({ path, fullPage: true }); } catch(e) {}
  return path;
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByLabel(/password/i).first().press('Enter');
  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  } catch (e) {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Track all navigations
  const navLog = [];
  page.on('request', req => {
    if (req.resourceType() === 'document') {
      navLog.push({ type: 'request', url: req.url(), method: req.method() });
    }
  });
  page.on('response', res => {
    if (res.request().resourceType() === 'document') {
      navLog.push({ type: 'response', url: res.url(), status: res.status() });
    }
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('[explore] navigated to:', frame.url());
    }
  });

  try {
    await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
    await page.waitForTimeout(1000);
    const dashUrl = page.url();
    console.log('[explore] Dashboard URL:', dashUrl);
    await screenshot(page, 'B09_explore_03_dashboard');

    // Click Start Session
    const startBtn = page.getByRole('button', { name: 'Start Session' });
    if (await startBtn.count() > 0) {
      await startBtn.first().click();
      await page.waitForTimeout(3000);
    }

    const afterStartUrl = page.url();
    console.log('[explore] After Start Session:', afterStartUrl);
    await screenshot(page, 'B09_explore_04_after_start');

    // What's on this page?
    const bodyText = await page.locator('body').textContent().catch(() => '');
    console.log('[explore] Body text (first 600):', bodyText.slice(0, 600));

    // List all buttons on this page
    const btns = await page.locator('button').all();
    console.log('[explore] Buttons on session page:');
    for (const b of btns) {
      const txt = await b.textContent().catch(() => '');
      console.log('  btn:', txt?.trim().slice(0, 60));
    }

    // Look for "Start Test" or "Begin" buttons
    const startTestBtn = page.getByRole('button', { name: /start.*test|begin.*test|start.*flashcard|continue/i }).first();
    if (await startTestBtn.count() > 0) {
      console.log('[explore] Found start test button, clicking...');
      await startTestBtn.click();
      await page.waitForTimeout(3000);
      console.log('[explore] After start test:', page.url());
      await screenshot(page, 'B09_explore_05_on_test');
    }

    // Check for flashcard section
    const flashcard = page.locator('[class*="flashcard"], [class*="Flashcard"], [class*="card"]').first();
    if (await flashcard.count() > 0) {
      console.log('[explore] Found flashcard-like element');
    }

    // Full page structure analysis
    const allText = await page.locator('body').textContent().catch(() => '');
    console.log('[explore] Full page text:', allText.slice(0, 1000));

    // Links on current page
    const links = await page.locator('a').all();
    for (const l of links.slice(0, 10)) {
      const href = await l.getAttribute('href').catch(() => '');
      const txt = await l.textContent().catch(() => '');
      console.log('[explore] link:', href, '|', txt?.trim().slice(0, 50));
    }

    // Navigation log
    console.log('[explore] Nav log:', JSON.stringify(navLog, null, 2));

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('[explore] FATAL:', e); process.exit(1); });

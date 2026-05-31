/**
 * B24 — UI exploration: find the join class flow
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B24';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const CLASSSWITCHER_01 = {
  email: 'audit_classswitcher_01_core@vocaboost.test',
  password: 'AuditPass2026!'
};

async function loginAs(page, account) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
}

async function screenshot(page, name) {
  const path = join(EVIDENCE_DIR, name + '.png');
  await page.screenshot({ path, fullPage: true });
  console.log('[SS]', name);
  return path;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await loginAs(page, CLASSSWITCHER_01);
  await page.waitForTimeout(2000);
  await screenshot(page, 'B24_explore_01_dashboard');

  // Get full page HTML to understand structure
  const html = await page.content();
  writeFileSync(join(EVIDENCE_DIR, 'B24_dashboard_html.txt'), html.substring(0, 50000));
  console.log('Dashboard HTML saved (first 50k chars)');

  // Get all buttons and links text
  const buttons = await page.evaluate(() => {
    return [...document.querySelectorAll('button, a, [role="button"]')]
      .map(el => ({ tag: el.tagName, text: el.textContent?.trim().substring(0, 80), class: el.className?.substring(0, 60) }))
      .filter(el => el.text?.length > 0)
      .slice(0, 50);
  });
  console.log('Interactive elements:');
  buttons.forEach(b => console.log(' -', b.tag, '|', b.text, '|', b.class));

  // Get all inputs
  const inputs = await page.evaluate(() => {
    return [...document.querySelectorAll('input, textarea')]
      .map(el => ({ type: el.type, placeholder: el.placeholder, name: el.name, id: el.id }));
  });
  console.log('Inputs on page:', inputs);

  // Look for "join" button
  const allJoinEls = await page.evaluate(() => {
    return [...document.querySelectorAll('*')]
      .filter(el => /join/i.test(el.textContent) && el.children.length === 0)
      .map(el => ({ tag: el.tagName, text: el.textContent?.trim().substring(0, 50), class: el.className?.substring(0, 60) }))
      .slice(0, 20);
  });
  console.log('Elements with "join" text:', allJoinEls);

  // Try clicking each join-like element and see what happens
  const joinBtns = page.locator('button, a, [role="button"]').filter({ hasText: /join/i });
  const count = await joinBtns.count();
  console.log('Join buttons count:', count);
  for (let i = 0; i < count; i++) {
    const btn = joinBtns.nth(i);
    const text = await btn.textContent();
    console.log(`Join btn ${i}: "${text?.trim()}"`);
  }

  if (count > 0) {
    const firstJoin = joinBtns.first();
    console.log('Clicking first join button...');
    await firstJoin.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'B24_explore_02_after_join_click');

    const htmlAfter = await page.content();
    writeFileSync(join(EVIDENCE_DIR, 'B24_after_join_click_html.txt'), htmlAfter.substring(0, 50000));

    // Get inputs after click
    const inputsAfter = await page.evaluate(() => {
      return [...document.querySelectorAll('input, textarea')]
        .map(el => ({ type: el.type, placeholder: el.placeholder, name: el.name, id: el.id, ariaLabel: el.getAttribute('aria-label') }));
    });
    console.log('Inputs AFTER join click:', JSON.stringify(inputsAfter, null, 2));

    // Get visible elements
    const visibleEls = await page.evaluate(() => {
      return [...document.querySelectorAll('input, [placeholder], [aria-label]')]
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map(el => ({ tag: el.tagName, placeholder: el.placeholder, ariaLabel: el.getAttribute('aria-label'), type: el.type }))
        .slice(0, 20);
    });
    console.log('Visible form elements after click:', JSON.stringify(visibleEls, null, 2));

    // Check for modal dialogs
    const modals = await page.evaluate(() => {
      return [...document.querySelectorAll('[role="dialog"], [role="modal"], .modal, [class*="modal"], [class*="dialog"]')]
        .map(el => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          class: el.className?.substring(0, 60),
          text: el.textContent?.substring(0, 200),
          visible: el.style.display !== 'none' && el.style.visibility !== 'hidden'
        }));
    });
    console.log('Modals/dialogs:', JSON.stringify(modals, null, 2));
  }

  await ctx.close();
} catch (e) {
  console.error('Error:', e.message);
} finally {
  if (browser) await browser.close();
}

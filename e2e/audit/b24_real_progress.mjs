/**
 * B24 — Real progress transfer test
 * We need a student with real app-format (classId_listId) progress docs.
 * Use careful_core who has doc ID=LVjBTFuYE8FbPG34pVAt with CSD=7 (app's real data).
 * But wait — careful_core also has the wrong-format seeded doc AND the correct format doc.
 *
 * Strategy: Use the careful_core student who has a REAL class_progress doc
 * (doc id = LVjBTFuYE8FbPG34pVAt, CSD=7) and see if their CORE progress
 * is preserved when the dashboard is loaded.
 *
 * Key question: The app queries getProgressDocId = classId_listId format.
 * careful_core's real doc is LVjBTFuYE8FbPG34pVAt (classId only, CSD=7).
 * The dashboard should show Day 8 (CSD+1) if it reads this doc.
 * OR it shows Day 1 if it reads classId_listId format (CSD=0).
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B24';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const CAREFUL_CORE = { email: 'audit_careful_01_core@vocaboost.test', password: 'AuditPass2026!' };

async function loginAs(page, account) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
  await page.waitForTimeout(2000);
}

async function ss(page, name) {
  const p = join(EVIDENCE_DIR, name + '.png');
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await loginAs(page, CAREFUL_CORE);
  await ss(page, 'B24_CAREFUL_CORE_dashboard');

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('=== CAREFUL CORE DASHBOARD ===');
  console.log(pageText);

  // Look for day display specifically for CORE class
  const dayInfo = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return;
      if (/Day\s*\d+/i.test(el.textContent)) {
        let node = el;
        let context = '';
        for (let i = 0; i < 15; i++) {
          node = node.parentElement;
          if (!node) break;
          const text = node.textContent?.substring(0, 400);
          if (/CORE|TOP/i.test(text)) { context = text.substring(0, 300); break; }
        }
        result.push({ day: el.textContent.trim(), context });
      }
    });
    return result.slice(0, 10);
  });
  console.log('\nDay info with context:', JSON.stringify(dayInfo, null, 2));

  await ctx.close();
} catch (e) {
  console.error('Error:', e.message);
} finally {
  if (browser) await browser.close();
}

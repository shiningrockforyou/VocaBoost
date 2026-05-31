/**
 * B24 — Deep dashboard inspection for multi-class display
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B24';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const SWITCHER01 = { email: 'audit_classswitcher_01_core@vocaboost.test', password: 'AuditPass2026!' };

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

  await loginAs(page, SWITCHER01);
  await ss(page, 'B24_DEEP_01_dashboard');

  // Get full HTML
  const html = await page.content();
  writeFileSync(join(EVIDENCE_DIR, 'B24_dashboard_post_join.html'), html);

  // Get all text content of the page organized by structure
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('=== PAGE TEXT ===');
  console.log(pageText);

  // Look for class indicators specifically
  const classSection = await page.evaluate(() => {
    const result = [];
    // Find elements containing class names
    const classNames = ['25WT 2차 CORE', '25WT 2차 TOP', 'CORE', 'TOP'];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return; // leaf nodes only
      for (const name of classNames) {
        if (el.textContent.includes(name)) {
          result.push({
            text: el.textContent.trim().substring(0, 100),
            parent: el.parentElement?.textContent?.trim().substring(0, 150),
            grandparent: el.parentElement?.parentElement?.textContent?.trim().substring(0, 200)
          });
          break;
        }
      }
    });
    return result.slice(0, 20);
  });
  console.log('\n=== CLASS REFERENCES ===');
  classSection.forEach(c => console.log(' TEXT:', c.text, '\n  PARENT:', c.parent?.substring(0, 100)));

  // Check what class cards exist
  const cards = await page.evaluate(() => {
    return [...document.querySelectorAll('[class*="card"], [class*="course"], [class*="class-item"]')]
      .map(el => ({
        class: el.className?.substring(0, 80),
        text: el.textContent?.substring(0, 200)
      })).slice(0, 20);
  });
  console.log('\n=== POTENTIAL CARD ELEMENTS ===');
  cards.forEach(c => console.log(' class:', c.class, '| text:', c.text?.substring(0, 80)));

  // Check for section headers / tabs
  const headers = await page.evaluate(() => {
    return [...document.querySelectorAll('h1, h2, h3, h4, [role="tab"], [role="tabpanel"]')]
      .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.substring(0, 100) }));
  });
  console.log('\n=== HEADERS/TABS ===');
  headers.forEach(h => console.log(' ', h.tag, h.role, '|', h.text));

  // Look for select dropdowns (class selector)
  const selects = await page.evaluate(() => {
    return [...document.querySelectorAll('select, [role="listbox"], [role="combobox"]')]
      .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.substring(0, 200) }));
  });
  console.log('\n=== SELECTS/DROPDOWNS ===');
  selects.forEach(s => console.log(' ', s.tag, '|', s.text?.substring(0, 100)));

  // Check "Studying:" label value
  const studyingContext = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(el =>
      el.children.length === 0 && el.textContent.includes('Studying:')
    );
    return els.map(el => ({
      text: el.textContent.trim(),
      parentText: el.parentElement?.textContent?.trim().substring(0, 300)
    }));
  });
  console.log('\n=== STUDYING: labels ===');
  studyingContext.forEach(s => console.log(' ', s.text, '| parent:', s.parentText?.substring(0, 200)));

  // Find where TOP and CORE appear in relation to day numbers
  const dayWithContext = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length > 0) return;
      if (/Day\s*\d+/i.test(el.textContent)) {
        // Walk up to find class context
        let node = el;
        let classContext = '';
        for (let i = 0; i < 15; i++) {
          node = node.parentElement;
          if (!node) break;
          if (/CORE|TOP/i.test(node.textContent)) {
            classContext = node.textContent.substring(0, 300);
            break;
          }
        }
        result.push({ day: el.textContent.trim(), classContext: classContext.substring(0, 200) });
      }
    });
    return result.slice(0, 15);
  });
  console.log('\n=== DAY WITH CLASS CONTEXT ===');
  dayWithContext.forEach(d => console.log(' Day:', d.day, '| Class:', d.classContext.substring(0, 100)));

  await ctx.close();
} catch (e) {
  console.error('Error:', e.message, e.stack);
} finally {
  if (browser) await browser.close();
}

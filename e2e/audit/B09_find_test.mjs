/**
 * B09 — Find path to typed test by skipping flashcard phase
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B09';
mkdirSync(EVIDENCE_DIR, { recursive: true });

async function screenshot(page, name) {
  const path = `${EVIDENCE_DIR}/${name}.png`;
  try { await page.screenshot({ path, fullPage: true }); } catch(e) {}
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

  try {
    await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');

    // Click Start Session
    const startBtn = page.getByRole('button', { name: 'Start Session' });
    await startBtn.first().click();
    await page.waitForTimeout(2000);

    // Step 1 of 3 — flashcards. Try to advance without going through all 80 cards.
    // Look for: "Start Studying" → advances to flashcard view
    // Then we need "I Know This" / "Got it" buttons or skip mechanism

    // First, click "Start Studying" to enter the flashcard phase
    const startStudying = page.getByRole('button', { name: 'Start Studying' });
    if (await startStudying.count() > 0) {
      await startStudying.click();
      await page.waitForTimeout(1000);
      console.log('[find] After Start Studying:', page.url());
      await screenshot(page, 'B09_find_01_after_start_studying');
    }

    const bodyText = await page.locator('body').textContent().catch(() => '');
    console.log('[find] Page after start studying (first 800):', bodyText.slice(0, 800));

    // List buttons
    const btns = await page.locator('button').all();
    console.log('[find] Buttons:');
    for (const b of btns) {
      const txt = await b.textContent().catch(() => '');
      console.log('  btn:', txt?.trim().slice(0, 60));
    }

    // Look for skip/advance/already-know buttons
    const knowBtn = page.getByRole('button', { name: /know|know it|i know|correct|got it|mastered|pass|skip|next|→/i }).first();
    if (await knowBtn.count() > 0) {
      console.log('[find] Found know/skip button, clicking it...');
      await knowBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, 'B09_find_02_after_know_click');
      const bodyAfter = await page.locator('body').textContent().catch(() => '');
      console.log('[find] After know click:', bodyAfter.slice(0, 400));
    }

    // Check what Step we're on now
    const stepText = await page.getByText(/Step \d of \d/).first().textContent().catch(() => '');
    console.log('[find] Current step:', stepText);

    // Try to force-navigate to the test page (Step 2)
    // Get all routes the app has registered by inspecting the router
    const routes = await page.evaluate(() => {
      // Try to find React Router routes
      try {
        const root = document.getElementById('root');
        return root ? root.innerHTML.slice(0, 200) : 'no root';
      } catch(e) { return e.message; }
    });
    console.log('[find] React root snippet:', routes);

    // Try to use pushState to navigate to test directly
    // The test URL format appears to be /typedtest/<classId>/<listId>
    const testUrl = `${BASE_URL}/typedtest/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR?type=new`;
    console.log('[find] Attempting SPA navigation to typed test...');

    // Navigate back to root first to have SPA loaded
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Then use pushState to navigate
    await page.evaluate((url) => {
      const path = url.replace('https://vocaboostone.netlify.app', '');
      history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }, testUrl);
    await page.waitForTimeout(2000);

    console.log('[find] URL after pushState:', page.url());
    await screenshot(page, 'B09_find_03_after_pushstate');
    const bodyPush = await page.locator('body').textContent().catch(() => '');
    console.log('[find] Body after pushState:', bodyPush.slice(0, 400));

    // The real question: does the /session/ URL already include both flashcard and test?
    // Let's look at the current URL structure from the session page more carefully
    // Navigate back to session
    await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
    const startBtn2 = page.getByRole('button', { name: 'Start Session' });
    await startBtn2.first().click();
    await page.waitForTimeout(2000);

    const sessionUrl = page.url();
    console.log('[find] Session URL:', sessionUrl);

    // Can we check the React component tree to understand routing?
    const appState = await page.evaluate(() => {
      try {
        // Check React DevTools fiber
        const r = document.getElementById('root');
        if (!r) return 'no root';
        // Get all data-testids
        return Array.from(document.querySelectorAll('[data-testid]')).map(e => e.dataset.testid).join(', ');
      } catch(e) { return e.message; }
    });
    console.log('[find] TestIDs:', appState);

    // Check localStorage for any state that controls step progression
    const ls = await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        out[k] = localStorage.getItem(k);
      }
      return out;
    });
    console.log('[find] localStorage:', JSON.stringify(ls, null, 2));

    // Check the window.__REACT_QUERY_STATE__ or similar
    const windowKeys = await page.evaluate(() => Object.keys(window).filter(k => !['document','window','console','location','history'].includes(k) && !k.startsWith('webkit')).slice(0, 30));
    console.log('[find] Window keys:', windowKeys);

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('[find] FATAL:', e); process.exit(1); });

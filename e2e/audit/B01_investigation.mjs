/**
 * B01 Investigation — Deep-dive on S07, S08, S10
 * Probes the actual DOM to understand navigation, sign-out flow, and refresh behavior.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B01';
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json';
const seeded = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'));

function getAccount(personaId) {
  const candidates = seeded.accounts.filter(a => a.personaId === personaId);
  if (!candidates.length) throw new Error(`No account for ${personaId}`);
  return candidates[0];
}

async function screenshot(page, label) {
  const p = `${EVIDENCE_DIR}/${label}.png`;
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function gotoLogin(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) {
    await loginLink.click();
    await page.waitForTimeout(1500);
  } else {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(1500);
  }
}

async function fillAndLogin(page, email, password) {
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByLabel(/password/i).first().press('Enter');
  // Wait for either dashboard or any button submit
  await page.waitForTimeout(3000);
  const url = page.url();
  if (url.includes('/login')) {
    // Try clicking Continue button
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(3000); }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ============================================================
  // INVESTIGATION 1: S10 — Why is auth state lost after refresh?
  // ============================================================
  console.log('\n=== INVESTIGATION 1: S10 Auth Persistence ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

    const account = getAccount('careful');
    await gotoLogin(page);
    await fillAndLogin(page, account.email, account.password);

    const urlAfterLogin = page.url();
    console.log('URL after login:', urlAfterLogin);

    // Capture IndexedDB state to confirm Firebase auth token is stored
    const indexedDBState = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            resolve({ found: false, stores: [...db.objectStoreNames] });
            return;
          }
          const tx = db.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const items = getAllReq.result.map(item => ({
              key: item.fbase_key,
              hasToken: !!(item.value && (item.value.stsTokenManager || item.value.uid)),
              uid: item.value?.uid,
              email: item.value?.email,
            }));
            resolve({ found: true, items });
          };
        };
        req.onerror = () => resolve({ found: false, error: 'could not open DB' });
      });
    });

    console.log('IndexedDB state pre-refresh:', JSON.stringify(indexedDBState, null, 2));
    await screenshot(page, 'B01_S10_INV_01_before_refresh');

    // Capture localStorage too
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys pre-refresh:', localStorageKeys);

    // Now refresh
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    const urlAfterRefresh = page.url();
    console.log('URL after refresh:', urlAfterRefresh);
    await screenshot(page, 'B01_S10_INV_02_after_refresh');

    // Check IndexedDB again post-refresh
    const indexedDBStatePost = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            resolve({ found: false, stores: [...db.objectStoreNames] });
            return;
          }
          const tx = db.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const items = getAllReq.result.map(item => ({
              key: item.fbase_key,
              hasToken: !!(item.value && (item.value.stsTokenManager || item.value.uid)),
              uid: item.value?.uid,
              email: item.value?.email,
            }));
            resolve({ found: true, items });
          };
        };
        req.onerror = () => resolve({ found: false, error: 'could not open DB' });
      });
    });

    console.log('IndexedDB state post-refresh:', JSON.stringify(indexedDBStatePost, null, 2));

    // Body content check
    const bodyText = await page.locator('body').innerText();
    console.log('Body text snippet post-refresh:', bodyText.slice(0, 300));

    // Check for loading spinner/state
    const hasSpinner = await page.locator('[class*="spin"], [class*="load"], svg[class*="animate"]').count();
    console.log('Loading spinners visible:', hasSpinner);

    // Check if there's any React hydration happening
    await page.waitForTimeout(5000); // extra wait for React init
    const urlAfterWait = page.url();
    const bodyAfterWait = await page.locator('body').innerText();
    console.log('URL after 5s wait:', urlAfterWait);
    console.log('Body snippet after 5s wait:', bodyAfterWait.slice(0, 300));
    await screenshot(page, 'B01_S10_INV_03_after_5s_wait');

    // Filter relevant console errors
    const errors = consoleLogs.filter(l => l.type === 'error');
    const warns = consoleLogs.filter(l => l.type === 'warning');
    console.log('Console errors:', errors.slice(0, 10));
    console.log('Console warnings:', warns.slice(0, 5));

    // Write console log
    writeFileSync(`${EVIDENCE_DIR}/B01_S10_console.json`, JSON.stringify({ errors, warns, all: consoleLogs.slice(0, 50) }, null, 2));

    await context.close();
  }

  // ============================================================
  // INVESTIGATION 2: S08 — Sign out button location
  // ============================================================
  console.log('\n=== INVESTIGATION 2: S08 Sign-out Flow ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    const account = getAccount('careful');
    await gotoLogin(page);
    await fillAndLogin(page, account.email, account.password);

    console.log('URL after login:', page.url());
    await page.waitForTimeout(3000);

    // Dump all buttons and links
    const allButtons = await page.evaluate(() => {
      return [...document.querySelectorAll('button, a[role="button"], [type="button"]')]
        .map(el => ({
          tag: el.tagName,
          text: el.innerText?.trim().slice(0, 50),
          ariaLabel: el.getAttribute('aria-label'),
          href: el.getAttribute('href'),
        }));
    });
    console.log('All buttons/links on dashboard:', JSON.stringify(allButtons, null, 2));

    await screenshot(page, 'B01_S08_INV_01_dashboard');

    // Snapshot accessible tree to find sign-out (accessibility API may vary)
    let snapshotStr = '{}';
    try {
      const snapshot = await page.accessibility?.snapshot?.();
      if (snapshot) {
        snapshotStr = JSON.stringify(snapshot, null, 2);
        console.log('Accessibility snapshot obtained');
      }
    } catch (e) {
      console.log('Accessibility snapshot not available:', e.message);
    }
    writeFileSync(`${EVIDENCE_DIR}/B01_S08_accessibility_snapshot.json`, snapshotStr);

    // Look for any navigation / header elements
    const navContent = await page.evaluate(() => {
      const nav = document.querySelector('nav, header, [role="navigation"]');
      return nav ? nav.innerText : 'No nav found';
    });
    console.log('Nav/header text:', navContent?.slice(0, 500));

    // Look for any dropdown menus, user avatar, etc.
    const possibleMenuItems = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="menu"], [class*="dropdown"], [class*="avatar"], [class*="user"], [class*="account"]')]
        .map(el => ({
          class: el.className,
          text: el.innerText?.trim().slice(0, 30),
          tag: el.tagName,
        })).slice(0, 20);
    });
    console.log('Possible menu/user elements:', JSON.stringify(possibleMenuItems, null, 2));

    // Check all clickable elements in potential user menu areas
    await context.close();
  }

  // ============================================================
  // INVESTIGATION 3: S07 — Password reset / Forgot Password link
  // ============================================================
  console.log('\n=== INVESTIGATION 3: S07 Password Reset ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await gotoLogin(page);
    await page.waitForTimeout(2000);

    // Dump all interactive elements on login page
    const loginElements = await page.evaluate(() => {
      return [...document.querySelectorAll('a, button')]
        .map(el => ({
          tag: el.tagName,
          text: el.innerText?.trim().slice(0, 60),
          href: el.getAttribute('href'),
          ariaLabel: el.getAttribute('aria-label'),
        }));
    });
    console.log('All links/buttons on login page:', JSON.stringify(loginElements, null, 2));

    await screenshot(page, 'B01_S07_INV_login_page');

    const bodyText = await page.locator('body').innerText();
    console.log('Full login page text:', bodyText.slice(0, 1000));

    await context.close();
  }

  // ============================================================
  // INVESTIGATION 4: S06 — Long input layout overflow check
  // ============================================================
  console.log('\n=== INVESTIGATION 4: S06 Long Input Layout ===');
  {
    // Check signup form structure
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const signupLink = page.getByRole('link', { name: /sign\s?up|register|create|new/i }).first();
    if (await signupLink.count()) {
      await signupLink.click();
    } else {
      await page.evaluate(() => {
        window.history.pushState({}, '', '/signup');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    }
    await page.waitForTimeout(1500);

    const signupElements = await page.evaluate(() => {
      return [...document.querySelectorAll('input, textarea, select, button')]
        .map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type'),
          placeholder: el.getAttribute('placeholder'),
          maxLength: el.getAttribute('maxlength'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
        }));
    });
    console.log('Signup form elements:', JSON.stringify(signupElements, null, 2));

    // Fill with long inputs and check overflow
    const emailField = page.getByLabel(/email/i).first();
    if (await emailField.count()) {
      const longEmail = 'a'.repeat(85) + '@vocaboost.test';
      const longName = 'B'.repeat(200);
      await emailField.fill(longEmail);
      const nameField = page.getByLabel(/name|display/i).first();
      if (await nameField.count()) await nameField.fill(longName);
      await page.getByLabel(/password/i).first().fill('AuditPass2026!');

      await screenshot(page, 'B01_S06_INV_long_inputs_filled');

      // Check exact overflow measurements
      const overflowDetails = await page.evaluate(() => {
        const overflows = [...document.querySelectorAll('*')].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.right > window.innerWidth + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY';
        });
        return overflows.map(el => ({
          tag: el.tagName,
          className: el.className?.slice(0, 50),
          right: Math.round(el.getBoundingClientRect().right),
          windowWidth: window.innerWidth,
          overflow: Math.round(el.getBoundingClientRect().right - window.innerWidth),
        }));
      });
      console.log('Overflow elements:', JSON.stringify(overflowDetails, null, 2));
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== Investigation complete ===');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

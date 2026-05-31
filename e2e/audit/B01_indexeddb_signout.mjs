/**
 * B01 — IndexedDB sign-out verification
 * Confirms that signing out clears Firebase auth state from IndexedDB.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B01';
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json';
const seeded = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'));

function getAccount(personaId) {
  return seeded.accounts.filter(a => a.personaId === personaId)[0];
}
async function ss(page, label) {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${label}.png`, fullPage: true });
}
async function gotoLogin(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) { await loginLink.click(); await page.waitForTimeout(1500); }
  else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(1500);
  }
}
async function getIndexedDBAuthState(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
          resolve({ found: false, items: [] });
          return;
        }
        const tx = db.transaction('firebaseLocalStorage', 'readonly');
        const store = tx.objectStore('firebaseLocalStorage');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          resolve({
            found: true,
            items: getAllReq.result.map(item => ({
              key: item.fbase_key,
              hasToken: !!(item.value?.stsTokenManager),
              uid: item.value?.uid,
              email: item.value?.email,
            }))
          });
        };
      };
      req.onerror = () => resolve({ found: false, items: [], error: 'open failed' });
    });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = getAccount('careful');
  const results = {};

  try {
    // Login
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await page.getByLabel(/email/i).first().fill(account.email);
    await page.getByLabel(/password/i).first().fill(account.password);
    await page.getByLabel(/password/i).first().press('Enter');
    await page.waitForTimeout(3000);
    await ss(page, 'B01_IDB_01_logged_in');

    // Capture IndexedDB BEFORE sign-out
    const idbBefore = await getIndexedDBAuthState(page);
    console.log('IndexedDB BEFORE sign-out:', JSON.stringify(idbBefore, null, 2));
    const hadToken = idbBefore.items.some(i => i.hasToken || i.uid);

    // Sign out via User menu
    await page.getByRole('button', { name: /user menu/i }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /sign\s?out/i }).first().click();
    await page.waitForTimeout(3000);
    await ss(page, 'B01_IDB_02_after_signout');

    const urlAfterSignout = page.url();
    console.log('URL after sign-out:', urlAfterSignout);

    // Capture IndexedDB AFTER sign-out
    const idbAfter = await getIndexedDBAuthState(page);
    console.log('IndexedDB AFTER sign-out:', JSON.stringify(idbAfter, null, 2));
    const stillHasToken = idbAfter.items.some(i => i.hasToken || i.uid);

    // CRITICAL: Token should be gone after sign-out
    if (!hadToken) {
      results.indexeddb_signout = { result: 'PARTIAL', note: 'No auth token found in IndexedDB even before sign-out — could not verify' };
    } else if (stillHasToken) {
      results.indexeddb_signout = {
        result: 'FAIL',
        severity: 'HIGH',
        note: 'Firebase auth token persists in IndexedDB after sign-out — session not properly cleared. User could be re-authenticated from stale token.',
        idbBefore,
        idbAfter
      };
    } else {
      results.indexeddb_signout = {
        result: 'PASS',
        note: 'Firebase auth token removed from IndexedDB after sign-out. Session fully cleared.',
        idbBefore,
        idbAfter
      };
    }
    console.log('IndexedDB sign-out result:', results.indexeddb_signout.result, results.indexeddb_signout.note);

    // Also verify: after sign-out + navigation to root, still shows login
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await ss(page, 'B01_IDB_03_root_after_signout');
    const rootBody = await page.locator('body').innerText();
    const rootUrl = page.url();
    const rootShowsLogin = /log\s?in|sign\s?in|welcome back|email.*password/i.test(rootBody);
    const rootShowsAuth = /welcome.*audit|start session|today'?s session/i.test(rootBody);
    console.log('Root after sign-out URL:', rootUrl);
    console.log('Root shows login prompt:', rootShowsLogin);
    console.log('Root shows authenticated content:', rootShowsAuth);

    if (rootShowsAuth) {
      results.root_after_signout = { result: 'FAIL', severity: 'BLOCKER', note: 'Root shows authenticated content after sign-out' };
    } else if (rootShowsLogin) {
      results.root_after_signout = { result: 'PASS', note: 'Root redirects to login prompt after sign-out' };
    } else {
      results.root_after_signout = { result: 'PARTIAL', note: `Unclear root state: ${rootBody.slice(0, 100)}` };
    }
    console.log('Root after sign-out result:', results.root_after_signout.result);

  } finally {
    await browser.close();
  }

  writeFileSync(`${EVIDENCE_DIR}/B01_indexeddb_results.json`, JSON.stringify(results, null, 2));
  console.log('\n=== Final IndexedDB verification results ===');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

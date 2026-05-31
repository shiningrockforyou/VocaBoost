/**
 * B01 Recheck — S08 Sign-out (via User menu), S10 re-verify, S12 sign-out
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B01';
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json';
const seeded = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'));

function getAccount(personaId) {
  const c = seeded.accounts.filter(a => a.personaId === personaId);
  if (!c.length) throw new Error(`No account for ${personaId}`);
  return c[0];
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
async function login(page, email, password) {
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForTimeout(3000);
  if (page.url().includes('/login')) {
    const btn = page.getByRole('button', { name: /continue/i }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(3000); }
  }
}

const results = {};

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ===== S10 RE-VERIFY =====
  console.log('\n=== S10 RE-VERIFY: Auth persistence across refresh ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const account = getAccount('careful');
    await gotoLogin(page);
    await login(page, account.email, account.password);
    await page.waitForTimeout(2000);
    await ss(page, 'B01_S10_RECHECK_01_before_refresh');
    const urlBefore = page.url();
    const bodyBefore = await page.locator('body').innerText();
    const hasAuthBefore = /welcome|sign\s?out|my class|today'?s session|study/i.test(bodyBefore);
    console.log('URL before refresh:', urlBefore);
    console.log('Has auth content before:', hasAuthBefore);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await ss(page, 'B01_S10_RECHECK_02_after_refresh');
    const urlAfter = page.url();
    const bodyAfter = await page.locator('body').innerText();
    const hasAuthAfter = /welcome|sign\s?out|start session|study|dashboard/i.test(bodyAfter);
    console.log('URL after refresh:', urlAfter);
    console.log('Has auth content after:', hasAuthAfter);
    console.log('Body after refresh (first 400 chars):', bodyAfter.slice(0, 400));

    if (!hasAuthBefore) {
      results.S10 = { result: 'PARTIAL', note: 'Could not confirm initial login success' };
    } else if (hasAuthAfter && !urlAfter.includes('/login')) {
      results.S10 = { result: 'PASS', note: 'Auth state persisted across refresh. Dashboard content fully loaded.' };
    } else if (urlAfter.includes('/login')) {
      results.S10 = { result: 'FAIL', severity: 'HIGH', note: 'Auth state lost after refresh — kicked to /login' };
    } else {
      results.S10 = { result: 'PARTIAL', note: `Unclear: url=${urlAfter}, hasAuthContent=${hasAuthAfter}` };
    }
    console.log('S10 result:', results.S10);
    await context.close();
  }

  // ===== S08 RE-VERIFY: Sign-out via User menu =====
  console.log('\n=== S08 RE-VERIFY: Sign-out via User menu button ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const account = getAccount('careful');
    await gotoLogin(page);
    await login(page, account.email, account.password);
    await page.waitForTimeout(2000);
    await ss(page, 'B01_S08_RECHECK_01_dashboard');

    // Click the "User menu" button (aria-label="User menu")
    const userMenuBtn = page.getByRole('button', { name: /user menu/i });
    if (await userMenuBtn.count()) {
      await userMenuBtn.click();
      await page.waitForTimeout(1000);
      await ss(page, 'B01_S08_RECHECK_02_usermenu_open');

      // Check what appeared
      const menuItems = await page.evaluate(() => {
        return [...document.querySelectorAll('button, a, [role="menuitem"]')]
          .map(el => ({ tag: el.tagName, text: el.innerText?.trim(), ariaLabel: el.getAttribute('aria-label') }))
          .filter(el => el.text);
      });
      console.log('Menu items after user menu click:', JSON.stringify(menuItems, null, 2));

      // Find sign-out in the opened menu — use first() to avoid strict mode issues
      const signOutItem = page.getByRole('button', { name: /sign\s?out|log\s?out/i }).first();

      if (await signOutItem.count()) {
        await signOutItem.click();
        await page.waitForTimeout(3000);
        await ss(page, 'B01_S08_RECHECK_03_after_signout');

        const bodyAfter = await page.locator('body').innerText();
        const urlAfter = page.url();
        const hasAuthContent = /welcome.*audit|start session|my class|today'?s session/i.test(bodyAfter);
        const hasLoginPrompt = /log\s?in|sign\s?in|email.*password|create one|welcome back/i.test(bodyAfter);
        console.log('URL after sign-out:', urlAfter);
        console.log('Has auth content:', hasAuthContent);
        console.log('Has login prompt:', hasLoginPrompt);
        console.log('Body:', bodyAfter.slice(0, 400));

        if (hasAuthContent && !hasLoginPrompt) {
          results.S08 = {
            result: 'FAIL',
            severity: 'BLOCKER',
            note: 'Authenticated content visible after sign-out — session not cleared'
          };
        } else if (hasLoginPrompt || urlAfter.includes('/login')) {
          results.S08 = { result: 'PASS', note: 'Sign-out works via User menu. Login prompt shown after.' };
        } else {
          results.S08 = { result: 'PARTIAL', note: 'Signed out but unclear landing state' };
        }

        // Now verify that navigating back to '/' doesn't restore auth
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        await ss(page, 'B01_S08_RECHECK_04_root_after_signout');
        const bodyAtRoot = await page.locator('body').innerText();
        const rootHasAuth = /welcome.*audit|start session|today'?s session/i.test(bodyAtRoot);
        console.log('Root after sign-out has auth content:', rootHasAuth);
        console.log('Root body:', bodyAtRoot.slice(0, 400));

        if (rootHasAuth) {
          results.S08 = {
            result: 'FAIL',
            severity: 'BLOCKER',
            note: 'After sign-out, navigating to "/" restores authenticated content (IndexedDB not cleared)'
          };
        }
      } else {
        results.S08 = { result: 'PARTIAL', note: 'User menu opened but no sign-out item found' };
        console.log('Could not find sign-out in user menu');
      }
    } else {
      results.S08 = { result: 'PARTIAL', note: 'No "User menu" button found on dashboard' };
      console.log('User menu button not found');
    }
    console.log('S08 result:', results.S08);
    await context.close();
  }

  // ===== S09 EXTENDED: Verify logged-out access to various protected routes =====
  console.log('\n=== S09 EXTENDED: Logged-out protected route access ===');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const routesChecked = {};

    // After sign-out, try navigating via SPA routing to protected areas
    // First get to root without being logged in
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check root state for a fresh (no prior auth) context
    const rootBody = await page.locator('body').innerText();
    const rootUrl = page.url();
    const freshContextHasAuth = /welcome.*audit|start session|today'?s session/i.test(rootBody);
    console.log('Fresh context root URL:', rootUrl);
    console.log('Fresh context has auth content:', freshContextHasAuth);

    routesChecked.root_fresh = { hasAuth: freshContextHasAuth, url: rootUrl };

    // Try SPA client-side navigation to /dashboard
    await page.evaluate(() => { history.pushState({}, '', '/dashboard'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(2000);
    const dashboardSpaBody = await page.locator('body').innerText();
    const dashboardSpaUrl = page.url();
    const spaNavHasAuth = /welcome.*audit|start session|today'?s session/i.test(dashboardSpaBody);
    const spaNavRedirected = dashboardSpaUrl.includes('/login') || /log\s?in|sign\s?in/i.test(dashboardSpaBody);
    console.log('SPA nav to /dashboard URL:', dashboardSpaUrl);
    console.log('SPA nav has auth content:', spaNavHasAuth);
    console.log('SPA nav redirected to login:', spaNavRedirected);
    await ss(page, 'B01_S09_EXT_spa_dashboard_anon');

    routesChecked.dashboard_spa_anon = { hasAuth: spaNavHasAuth, redirectedToLogin: spaNavRedirected };

    if (spaNavHasAuth) {
      results.S09_ext = {
        result: 'FAIL',
        severity: 'BLOCKER',
        note: 'Logged-out SPA navigation to /dashboard shows authenticated content'
      };
    } else {
      results.S09_ext = {
        result: 'PASS',
        note: 'Logged-out user sees no authenticated content when navigating to /dashboard via SPA'
      };
    }
    console.log('S09 ext result:', results.S09_ext);
    console.log('Routes checked:', JSON.stringify(routesChecked, null, 2));
    await context.close();
  }

  await browser.close();

  // Write recheck results
  writeFileSync(`${EVIDENCE_DIR}/B01_recheck_results.json`, JSON.stringify(results, null, 2));
  console.log('\n=== RECHECK RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

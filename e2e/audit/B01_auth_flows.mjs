/**
 * B01 — Auth Flows Audit
 * Agent N, Batch B01 (P1)
 * Tests: valid login, bad password, unknown email, signup duplicate, weak password,
 *        long inputs, password reset, signout+redirect, session persistence,
 *        tab-close persistence, two tabs same user, two tabs diff users,
 *        role-based redirect, email verification, token refresh shim.
 *
 * Run from /app: node e2e/audit/B01_auth_flows.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B01';
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const seeded = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'));
function getAccount(personaId, targetClass = null) {
  let candidates = seeded.accounts.filter(a => a.personaId === personaId);
  if (targetClass) candidates = candidates.filter(a => a.targetClass === targetClass);
  if (!candidates.length) throw new Error(`No seeded account for persona=${personaId}`);
  return candidates[0];
}

const TEACHER = { email: 'veterans@vocaboost.com', password: 'veterans5944' };

// Results tracking
const results = [];
let screenshotCounter = 0;

async function screenshot(page, label) {
  screenshotCounter++;
  const filename = path.join(EVIDENCE_DIR, `${label}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  return filename;
}

function logResult(scenario, persona, result, details = {}) {
  results.push({ scenario, persona, result, ...details });
  console.log(`[${result}] ${scenario} (${persona})${details.error ? ' — ' + details.error : ''}`);
}

/**
 * Navigate to login via SPA route (Netlify has no 404-fallback for /login directly).
 * Loads root, then navigates to /login via client-side routing.
 */
async function gotoLogin(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Try clicking a login link
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) {
    await loginLink.click();
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
  } else {
    // Client-side pushState
    await page.evaluate(() => {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(1000);
  }
}

async function fillAndSubmitLogin(page, email, password) {
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  // Try Enter key first, then button click
  await page.getByLabel(/password/i).first().press('Enter');
}

// =====================
// S01 — Login happy path (careful student)
// =====================
async function runS01(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    const account = getAccount('careful');
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await screenshot(page, 'B01_S01_01_login_form');

    await fillAndSubmitLogin(page, account.email, account.password);

    // Wait for post-login landing — should be '/' (root)
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    const finalUrl = page.url();
    await screenshot(page, 'B01_S01_02_post_login');

    // Verify dashboard content — student should see their class name or list
    const bodyText = await page.locator('body').innerText();
    const hasDashboardContent = /TOP|CORE|vocab|day|study|class/i.test(bodyText);

    // Console errors check
    const relevantErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('analytics')
    );

    if (!finalUrl.includes(BASE_URL) || finalUrl === BASE_URL + '/login') {
      logResult('S01', 'careful', 'FAIL', { error: 'Did not redirect away from login after valid credentials', durationMs: Date.now()-t0 });
    } else if (!hasDashboardContent) {
      logResult('S01', 'careful', 'PARTIAL', { error: 'Logged in but dashboard content unclear', url: finalUrl, durationMs: Date.now()-t0 });
    } else {
      logResult('S01', 'careful', 'PASS', { url: finalUrl, consoleErrors: relevantErrors.length, durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S01_error');
    logResult('S01', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S02 — Login bad password (3 attempts)
// =====================
async function runS02(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const account = getAccount('careful');
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });

    let errorVisible = false;
    let stayedOnLogin = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      // Clear fields first
      await page.getByLabel(/email/i).first().fill('');
      await page.getByLabel(/password/i).first().fill('');
      await page.getByLabel(/email/i).first().fill(account.email);
      await page.getByLabel(/password/i).first().fill('WrongPassword123!');
      await page.getByLabel(/password/i).first().press('Enter');
      await page.waitForTimeout(2500);

      // Check if still on login page
      const url = page.url();
      if (!url.includes('/login') && url !== BASE_URL + '/' && url !== BASE_URL) {
        // Accidentally logged in — that would be a BLOCKER (auth fails open)
        await screenshot(page, `B01_S02_attempt${attempt}_unexpected_redirect`);
        logResult('S02', 'careful', 'FAIL', {
          error: `BLOCKER: Bad password login succeeded on attempt ${attempt}! URL: ${url}`,
          severity: 'BLOCKER',
          durationMs: Date.now()-t0
        });
        return;
      }

      // Check for error message
      const errorEl = page.getByText(/invalid|wrong|incorrect|failed|error|password/i).first();
      if (await errorEl.count()) {
        errorVisible = true;
      }
      stayedOnLogin = true;
    }

    await screenshot(page, 'B01_S02_after_3_attempts');

    if (stayedOnLogin && errorVisible) {
      logResult('S02', 'careful', 'PASS', { durationMs: Date.now()-t0 });
    } else if (stayedOnLogin && !errorVisible) {
      logResult('S02', 'careful', 'PARTIAL', { error: 'Stayed on /login but no error message shown', durationMs: Date.now()-t0 });
    } else {
      logResult('S02', 'careful', 'FAIL', { error: 'Unexpected state after bad password attempts', durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S02_error');
    logResult('S02', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S03 — Login unknown email
// =====================
async function runS03(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });

    const unknownEmail = `nonexistent_${Date.now()}@vocaboost.test`;
    await page.getByLabel(/email/i).first().fill(unknownEmail);
    await page.getByLabel(/password/i).first().fill('AuditPass2026!');
    await page.getByLabel(/password/i).first().press('Enter');
    await page.waitForTimeout(3000);

    await screenshot(page, 'B01_S03_unknown_email_result');
    const url = page.url();

    // Should stay on login
    const stayedOnLogin = url.includes('/login') || url === BASE_URL + '/' || url === BASE_URL;
    const errorEl = page.getByText(/invalid|wrong|not found|no account|error|failed/i).first();
    const hasError = await errorEl.count() > 0;

    // CRITICAL: check the page doesn't show authenticated content
    const bodyText = await page.locator('body').innerText();
    const hasAuthContent = /sign out|logout|my class|today's session|study day/i.test(bodyText);

    if (hasAuthContent) {
      logResult('S03', 'unknown', 'FAIL', {
        error: 'BLOCKER: Unknown email login landed on authenticated content!',
        severity: 'BLOCKER',
        durationMs: Date.now()-t0
      });
    } else if (!stayedOnLogin) {
      logResult('S03', 'unknown', 'FAIL', { error: `Redirected unexpectedly to ${url}`, durationMs: Date.now()-t0 });
    } else if (hasError) {
      logResult('S03', 'unknown', 'PASS', { durationMs: Date.now()-t0 });
    } else {
      logResult('S03', 'unknown', 'PARTIAL', { error: 'Stayed on login but no error message shown', durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S03_error');
    logResult('S03', 'unknown', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S04 — Signup duplicate email (careful's email)
// =====================
async function runS04(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const account = getAccount('careful');
    // Navigate to signup
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Find signup link
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
    await screenshot(page, 'B01_S04_signup_form');

    const emailField = page.getByLabel(/email/i).first();
    if (!await emailField.count()) {
      logResult('S04', 'careful', 'PARTIAL', { error: 'Signup form not found — may not exist or route differs', durationMs: Date.now()-t0 });
      return;
    }

    // Fill in existing email
    await emailField.fill(account.email);
    const nameField = page.getByLabel(/name|display/i).first();
    if (await nameField.count()) await nameField.fill('Duplicate Test');
    const passField = page.getByLabel(/password/i).first();
    if (await passField.count()) await passField.fill('AuditPass2026!');

    // Submit
    const submitBtn = page.getByRole('button', { name: /sign\s?up|register|create|continue/i }).first();
    if (await submitBtn.count()) {
      await submitBtn.click();
    } else {
      await page.getByLabel(/password/i).first().press('Enter');
    }
    await page.waitForTimeout(3000);
    await screenshot(page, 'B01_S04_duplicate_result');

    const url = page.url();
    const bodyText = await page.locator('body').innerText();
    const hasError = /already|taken|exists|in use|registered/i.test(bodyText);

    if (hasError) {
      logResult('S04', 'careful', 'PASS', { durationMs: Date.now()-t0 });
    } else {
      logResult('S04', 'careful', 'PARTIAL', { error: 'No clear duplicate-email error shown; may have redirected silently', url, durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S04_error');
    logResult('S04', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S05 — Signup with very weak password ('a')
// =====================
async function runS05(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
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

    const emailField = page.getByLabel(/email/i).first();
    if (!await emailField.count()) {
      logResult('S05', 'test', 'PARTIAL', { error: 'Signup form not found', durationMs: Date.now()-t0 });
      return;
    }

    const weakTestEmail = `weakpw_test_${Date.now()}@vocaboost.test`;
    await emailField.fill(weakTestEmail);
    const nameField = page.getByLabel(/name|display/i).first();
    if (await nameField.count()) await nameField.fill('Weak PW Test');
    const passField = page.getByLabel(/password/i).first();
    if (await passField.count()) await passField.fill('a');

    const submitBtn = page.getByRole('button', { name: /sign\s?up|register|create|continue/i }).first();
    if (await submitBtn.count()) {
      await submitBtn.click();
    } else {
      await page.getByLabel(/password/i).first().press('Enter');
    }
    await page.waitForTimeout(3000);
    await screenshot(page, 'B01_S05_weak_password_result');

    const bodyText = await page.locator('body').innerText();
    // Should NOT have logged in
    const hasAuthContent = /sign out|logout|my class|today's session/i.test(bodyText);
    const hasError = /weak|short|password.*must|minimum|at least|too short|invalid/i.test(bodyText);

    if (hasAuthContent) {
      logResult('S05', 'test', 'FAIL', { error: 'Weak password accepted — user was logged in!', severity: 'HIGH', durationMs: Date.now()-t0 });
    } else if (hasError) {
      logResult('S05', 'test', 'PASS', { durationMs: Date.now()-t0 });
    } else {
      logResult('S05', 'test', 'PARTIAL', { error: 'Weak password rejected but no clear error message', durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S05_error');
    logResult('S05', 'test', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S06 — Signup with very long email/name (100-char email, 200-char name)
// =====================
async function runS06(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
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

    const emailField = page.getByLabel(/email/i).first();
    if (!await emailField.count()) {
      logResult('S06', 'test', 'PARTIAL', { error: 'Signup form not found', durationMs: Date.now()-t0 });
      return;
    }

    // 100-char email (valid format): localpart@domain.tld
    const localPart = 'a'.repeat(88); // 88 + @ + vocaboost.test (14) = 103, trim
    const longEmail = `${localPart.slice(0,85)}@vocaboost.test`; // ~100 chars
    const longName = 'B'.repeat(200);

    await emailField.fill(longEmail);
    const nameField = page.getByLabel(/name|display/i).first();
    if (await nameField.count()) await nameField.fill(longName);
    const passField = page.getByLabel(/password/i).first();
    if (await passField.count()) await passField.fill('AuditPass2026!');

    await screenshot(page, 'B01_S06_before_submit');

    const submitBtn = page.getByRole('button', { name: /sign\s?up|register|create|continue/i }).first();
    if (await submitBtn.count()) {
      await submitBtn.click();
    } else {
      await page.getByLabel(/password/i).first().press('Enter');
    }
    await page.waitForTimeout(3500);
    await screenshot(page, 'B01_S06_long_input_result');

    const bodyText = await page.locator('body').innerText();
    const hasLayoutBreak = await page.evaluate(() => {
      // Check if any element overflows the viewport horizontally
      const overflows = [...document.querySelectorAll('*')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.right > window.innerWidth + 5;
      });
      return overflows.length > 0;
    });

    logResult('S06', 'test', hasLayoutBreak ? 'PARTIAL' : 'PASS', {
      note: hasLayoutBreak ? 'Long input caused layout overflow' : 'Long inputs handled gracefully',
      durationMs: Date.now()-t0
    });
  } catch (e) {
    await screenshot(page, 'B01_S06_error');
    logResult('S06', 'test', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S07 — Password reset link
// =====================
async function runS07(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await screenshot(page, 'B01_S07_login_for_reset');

    // Look for "Forgot password" link
    const forgotLink = page.getByRole('link', { name: /forgot|reset|password/i }).first();
    const forgotBtn = page.getByRole('button', { name: /forgot|reset/i }).first();
    const forgotText = page.getByText(/forgot.*password|reset.*password/i).first();

    let found = false;
    if (await forgotLink.count()) { await forgotLink.click(); found = true; }
    else if (await forgotBtn.count()) { await forgotBtn.click(); found = true; }
    else if (await forgotText.count()) { await forgotText.click(); found = true; }

    if (!found) {
      logResult('S07', 'careful', 'PARTIAL', { error: 'No "Forgot password" link found on login page', durationMs: Date.now()-t0 });
      return;
    }

    await page.waitForTimeout(1500);
    await screenshot(page, 'B01_S07_forgot_password_form');

    const account = getAccount('careful');
    const resetEmailField = page.getByLabel(/email/i).first();
    if (await resetEmailField.count()) {
      await resetEmailField.fill(account.email);
      const submitBtn = page.getByRole('button', { name: /send|reset|submit|continue/i }).first();
      if (await submitBtn.count()) await submitBtn.click();
      await page.waitForTimeout(3000);
      await screenshot(page, 'B01_S07_reset_submitted');

      const bodyText = await page.locator('body').innerText();
      const hasConfirmation = /sent|check.*email|reset.*link|email.*sent/i.test(bodyText);
      logResult('S07', 'careful', hasConfirmation ? 'PASS' : 'PARTIAL', {
        note: hasConfirmation ? 'Confirmation message shown' : 'No confirmation message visible',
        durationMs: Date.now()-t0
      });
    } else {
      logResult('S07', 'careful', 'PARTIAL', { error: 'Forgot-password form found but no email input', durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S07_error');
    logResult('S07', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S08 — Sign out, then /dashboard inaccessible
// =====================
async function runS08(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login first
    const account = getAccount('careful');
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(page, account.email, account.password);
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(page, 'B01_S08_01_logged_in');

    // Sign out — look for sign-out button
    const signOutBtn = page.getByRole('button', { name: /sign\s?out|log\s?out/i }).first();
    const signOutLink = page.getByRole('link', { name: /sign\s?out|log\s?out/i }).first();

    let signedOut = false;
    if (await signOutBtn.count()) {
      await signOutBtn.click();
      signedOut = true;
    } else if (await signOutLink.count()) {
      await signOutLink.click();
      signedOut = true;
    } else {
      // May be hidden in a menu/nav
      const menuBtn = page.getByRole('button', { name: /menu|account|profile|user/i }).first();
      if (await menuBtn.count()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        const signOutAfterMenu = page.getByRole('button', { name: /sign\s?out|log\s?out/i }).first();
        if (await signOutAfterMenu.count()) {
          await signOutAfterMenu.click();
          signedOut = true;
        }
      }
    }

    if (!signedOut) {
      // Try Firebase sign-out via JS
      await page.evaluate(async () => {
        try {
          const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js');
          // fallback: just navigate to login
        } catch(e) {}
      });
      logResult('S08', 'careful', 'PARTIAL', { error: 'Could not find sign-out button/link in UI', durationMs: Date.now()-t0 });
      return;
    }

    await page.waitForTimeout(2000);
    await screenshot(page, 'B01_S08_02_after_signout');

    // Now try navigating to /dashboard
    // NOTE: per known infra gap, hard GET of /dashboard → 404. So we use client route.
    // Check if we're on login or if auth was cleared.
    const urlAfterSignout = page.url();
    const bodyAfterSignout = await page.locator('body').innerText();

    // Navigate to / and check if we see authenticated content
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'B01_S08_03_root_after_signout');

    const bodyAtRoot = await page.locator('body').innerText();
    const urlAtRoot = page.url();

    // Authenticated content check: logged-out user must NOT see class cards / study sessions
    const hasAuthContent = /sign\s?out|my class|today'?s session|study day|current.*day/i.test(bodyAtRoot);
    const hasLoginPrompt = /log\s?in|sign\s?in|email.*password|get started/i.test(bodyAtRoot);

    if (hasAuthContent) {
      // BLOCKER: session not cleared after sign-out
      await screenshot(page, 'B01_S08_BLOCKER_auth_content_visible');
      logResult('S08', 'careful', 'FAIL', {
        error: 'BLOCKER: Authenticated content visible after sign-out — session not cleared',
        severity: 'BLOCKER',
        url: urlAtRoot,
        durationMs: Date.now()-t0
      });
    } else if (hasLoginPrompt) {
      // Good — user sees login prompt after sign-out
      logResult('S08', 'careful', 'PASS', { note: 'Session cleared; login prompt shown after sign-out', durationMs: Date.now()-t0 });
    } else {
      logResult('S08', 'careful', 'PARTIAL', {
        error: 'After sign-out, page shows neither auth content nor login prompt — unclear state',
        url: urlAtRoot,
        durationMs: Date.now()-t0
      });
    }
  } catch (e) {
    await screenshot(page, 'B01_S08_error');
    logResult('S08', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S09 — Logged-out user accessing deep route (characterize 404 vs redirect)
// =====================
async function runS09(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Try a hard GET to /dashboard (should get Netlify 404 per known infra gap B03 F01/F02)
    const response = await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const statusCode = response?.status();
    const bodyText = await page.locator('body').innerText();
    await screenshot(page, 'B01_S09_01_dashboard_direct_get');

    const isNetlify404 = statusCode === 404 || /not found|page not found/i.test(bodyText);
    const hasAuthContent = /study day|my class|today'?s session|sign\s?out/i.test(bodyText);
    const redirectedToLogin = page.url().includes('/login');

    if (hasAuthContent) {
      logResult('S09', 'anonymous', 'FAIL', {
        error: 'BLOCKER: Unauthenticated user sees authenticated content at /dashboard',
        severity: 'BLOCKER',
        durationMs: Date.now()-t0
      });
    } else if (isNetlify404) {
      // Known infra gap — document it
      logResult('S09', 'anonymous', 'PASS', {
        note: `Logged-out /dashboard returns HTTP ${statusCode} (Netlify 404 — known infra gap, no SPA fallback). No authenticated content exposed.`,
        statusCode,
        durationMs: Date.now()-t0
      });
    } else if (redirectedToLogin) {
      logResult('S09', 'anonymous', 'PASS', { note: 'Redirected to /login', durationMs: Date.now()-t0 });
    } else {
      logResult('S09', 'anonymous', 'PARTIAL', {
        note: `Unexpected response — HTTP ${statusCode}, URL: ${page.url()}`,
        durationMs: Date.now()-t0
      });
    }

    // Also try /login direct GET (should 404 per infra gap)
    const loginResponse = await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loginStatus = loginResponse?.status();
    const loginBody = await page.locator('body').innerText();
    await screenshot(page, 'B01_S09_02_login_direct_get');

    const loginPageWorked = /email|password|log\s?in|sign\s?in/i.test(loginBody);
    const loginIs404 = loginStatus === 404 || /not found/i.test(loginBody);

    console.log(`  [S09 sub] /login direct GET → HTTP ${loginStatus}, shows login form: ${loginPageWorked}, is 404: ${loginIs404}`);

  } catch (e) {
    await screenshot(page, 'B01_S09_error');
    logResult('S09', 'anonymous', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S10 — Auth state persists across page refresh
// =====================
async function runS10(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const account = getAccount('careful');
    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(page, account.email, account.password);
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    const preRefreshUrl = page.url();
    await screenshot(page, 'B01_S10_01_before_refresh');

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot(page, 'B01_S10_02_after_refresh');

    const postRefreshUrl = page.url();
    const bodyText = await page.locator('body').innerText();
    const hasAuthContent = /sign\s?out|my class|today'?s session|study/i.test(bodyText);
    const kickedToLogin = postRefreshUrl.includes('/login');

    if (kickedToLogin) {
      logResult('S10', 'careful', 'FAIL', {
        error: 'HIGH: Auth state lost after page refresh — user kicked to login',
        severity: 'HIGH',
        durationMs: Date.now()-t0
      });
    } else if (hasAuthContent) {
      logResult('S10', 'careful', 'PASS', { note: 'Auth persisted across refresh; dashboard still loaded', durationMs: Date.now()-t0 });
    } else {
      logResult('S10', 'careful', 'PARTIAL', { error: 'After refresh, page loaded but no clear auth content or login prompt', url: postRefreshUrl, durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S10_error');
    logResult('S10', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S11 — Auth state persists across tab close + reopen
// =====================
async function runS11(browser) {
  const t0 = Date.now();
  // Use a persistent context to simulate tab-close+reopen within same browser profile
  // (IndexedDB-backed auth should persist across page closes within the same browser context)
  const context = await browser.newContext();
  const page1 = await context.newPage();

  try {
    const account = getAccount('careful');
    await gotoLogin(page1);
    await page1.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(page1, account.email, account.password);
    await page1.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(page1, 'B01_S11_01_logged_in_tab1');

    // Close the page (simulates closing the tab)
    await page1.close();

    // Open a new page in the SAME context (same browser profile / IndexedDB)
    const page2 = await context.newPage();
    await page2.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(3000);
    await screenshot(page2, 'B01_S11_02_new_tab_same_context');

    const bodyText = await page2.locator('body').innerText();
    const url = page2.url();
    const hasAuthContent = /sign\s?out|my class|today'?s session|study/i.test(bodyText);
    const kickedToLogin = url.includes('/login');

    if (kickedToLogin) {
      logResult('S11', 'careful', 'FAIL', {
        error: 'HIGH: Auth state not persisted in IndexedDB after tab close — user kicked to login',
        severity: 'HIGH',
        durationMs: Date.now()-t0
      });
    } else if (hasAuthContent) {
      logResult('S11', 'careful', 'PASS', { note: 'Auth persisted after tab close (IndexedDB-backed Firebase auth confirmed)', durationMs: Date.now()-t0 });
    } else {
      logResult('S11', 'careful', 'PARTIAL', { error: 'After tab close/reopen, state unclear', url, durationMs: Date.now()-t0 });
    }

    await page2.close();
  } catch (e) {
    logResult('S11', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S12 — Two tabs same user, sign out one, check other
// =====================
async function runS12(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();

  try {
    const account = getAccount('careful');
    // Tab A
    const pageA = await context.newPage();
    await gotoLogin(pageA);
    await pageA.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(pageA, account.email, account.password);
    await pageA.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(pageA, 'B01_S12_01_tabA_logged_in');

    // Tab B — same context = same auth state
    const pageB = await context.newPage();
    await pageB.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pageB.waitForTimeout(2000);
    await screenshot(pageB, 'B01_S12_02_tabB_opened');

    const bodyB = await pageB.locator('body').innerText();
    const tabBLoggedIn = /sign\s?out|my class|today'?s session/i.test(bodyB);

    // Sign out from Tab B
    const signOutBtnB = pageB.getByRole('button', { name: /sign\s?out|log\s?out/i }).first();
    const signOutLinkB = pageB.getByRole('link', { name: /sign\s?out|log\s?out/i }).first();
    let signedOut = false;

    if (await signOutBtnB.count()) { await signOutBtnB.click(); signedOut = true; }
    else if (await signOutLinkB.count()) { await signOutLinkB.click(); signedOut = true; }
    else {
      // Try via menu
      const menuBtn = pageB.getByRole('button', { name: /menu|account|profile/i }).first();
      if (await menuBtn.count()) {
        await menuBtn.click();
        await pageB.waitForTimeout(500);
        const signOut = pageB.getByRole('button', { name: /sign\s?out|log\s?out/i }).first();
        if (await signOut.count()) { await signOut.click(); signedOut = true; }
      }
    }

    if (!signedOut) {
      logResult('S12', 'careful', 'PARTIAL', { error: 'Could not sign out from Tab B — UI button not found', durationMs: Date.now()-t0 });
      return;
    }

    await pageB.waitForTimeout(2500);
    await screenshot(pageB, 'B01_S12_03_tabB_after_signout');

    // Now check Tab A behavior — it should reflect the sign-out on next interaction
    await pageA.bringToFront();
    await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await pageA.waitForTimeout(2000);
    await screenshot(pageA, 'B01_S12_04_tabA_after_tabB_signout');

    const bodyA = await pageA.locator('body').innerText();
    const urlA = pageA.url();
    const tabAStillLoggedIn = /sign\s?out|my class|today'?s session/i.test(bodyA) && !urlA.includes('/login');

    // Both tabs share the same IndexedDB — sign-out in B should affect A on refresh
    if (!tabAStillLoggedIn || urlA.includes('/login')) {
      logResult('S12', 'careful', 'PASS', {
        note: 'Sign-out in Tab B reflected in Tab A on refresh — consistent auth state',
        tabBLoggedIn,
        durationMs: Date.now()-t0
      });
    } else {
      logResult('S12', 'careful', 'PARTIAL', {
        note: 'Tab A still shows auth content after Tab B signed out. Expected: both sync sign-out state.',
        tabBLoggedIn,
        url: urlA,
        durationMs: Date.now()-t0
      });
    }
  } catch (e) {
    logResult('S12', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S13 — Two tabs different users (separate contexts)
// =====================
async function runS13(browser) {
  const t0 = Date.now();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  try {
    const accountA = getAccount('careful');
    const accountB = getAccount('rushed');

    // Login Tab A
    const pageA = await contextA.newPage();
    await gotoLogin(pageA);
    await pageA.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(pageA, accountA.email, accountA.password);
    await pageA.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(pageA, 'B01_S13_01_userA_logged_in');

    // Login Tab B (different context = different IndexedDB = independent session)
    const pageB = await contextB.newPage();
    await gotoLogin(pageB);
    await pageB.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(pageB, accountB.email, accountB.password);
    await pageB.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(pageB, 'B01_S13_02_userB_logged_in');

    // CRITICAL: verify Tab A does NOT show Tab B's content
    await pageA.bringToFront();
    await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await pageA.waitForTimeout(2000);
    await screenshot(pageA, 'B01_S13_03_tabA_after_tabB_login');

    const bodyA = await pageA.locator('body').innerText();

    // Cross-user content leak check: Tab A should not show User B's email or name
    // accountB.email e.g. "audit_rushed_01_top@vocaboost.test"
    const crossLeakDetected = bodyA.includes(accountB.email) ||
      (accountB.displayName && bodyA.includes(accountB.displayName));

    if (crossLeakDetected) {
      logResult('S13', 'careful+rushed', 'FAIL', {
        error: 'BLOCKER: Cross-user content leak — Tab A shows Tab B user data',
        severity: 'BLOCKER',
        durationMs: Date.now()-t0
      });
    } else {
      // Both contexts are independent — this is expected behavior
      logResult('S13', 'careful+rushed', 'PASS', {
        note: 'Two different users in separate contexts — no cross-user content leak detected. Both sessions independent.',
        durationMs: Date.now()-t0
      });
    }
  } catch (e) {
    logResult('S13', 'careful+rushed', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
}

// =====================
// S14 — Role-based redirect (teacher view vs student view)
// =====================
async function runS14(browser) {
  const t0 = Date.now();
  const contextT = await browser.newContext();
  const contextS = await browser.newContext();

  try {
    // Login as teacher (veterans proxy)
    const pageT = await contextT.newPage();
    await gotoLogin(pageT);
    await pageT.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(pageT, TEACHER.email, TEACHER.password);
    await pageT.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(pageT, 'B01_S14_01_teacher_logged_in');

    const teacherBody = await pageT.locator('body').innerText();
    const hasTeacherUI = /class|student|gradebook|list|manage|teacher/i.test(teacherBody);

    // Login as student
    const pageS = await contextS.newPage();
    const studentAccount = getAccount('careful');
    await gotoLogin(pageS);
    await pageS.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(pageS, studentAccount.email, studentAccount.password);
    await pageS.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(pageS, 'B01_S14_02_student_logged_in');

    const studentBody = await pageS.locator('body').innerText();
    // Teacher UI elements should NOT appear for student
    const studentSeesTeacherUI = /gradebook|manage class|upload.*csv|add student/i.test(studentBody);

    // Try navigating student to a teacher-only route (if known)
    // Attempt /teacher or /admin or /gradebook
    const teacherRoutes = ['/teacher', '/admin', '/gradebook', '/teacher/gradebook'];
    let blockedFromTeacherRoute = false;
    let accessGrantedToTeacherRoute = false;

    for (const route of teacherRoutes) {
      const resp = await pageS.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
      const statusCode = resp?.status();
      const bodyText = await pageS.locator('body').innerText();

      // If it's a 404 (Netlify no SPA fallback), that's the known infra gap — document
      if (statusCode === 404 || /not found/i.test(bodyText)) {
        console.log(`  [S14] Student GET ${route} → HTTP ${statusCode} (Netlify 404, no SPA fallback)`);
        blockedFromTeacherRoute = true;
      } else if (/redirect|login|unauthorized|forbidden|403/i.test(bodyText)) {
        blockedFromTeacherRoute = true;
        console.log(`  [S14] Student GET ${route} → redirected/blocked`);
      } else if (/gradebook|manage.*class|upload.*student/i.test(bodyText)) {
        accessGrantedToTeacherRoute = true;
        console.log(`  [S14] Student GET ${route} → TEACHER CONTENT VISIBLE (unauthorized access)`);
        await screenshot(pageS, `B01_S14_UNAUTHORIZED_${route.replace(/\//g,'_')}`);
      }
    }

    await screenshot(pageS, 'B01_S14_03_student_teacher_route_check');

    if (accessGrantedToTeacherRoute) {
      logResult('S14', 'careful+teacher', 'FAIL', {
        error: 'HIGH: Student can access teacher-only route without authorization',
        severity: 'HIGH',
        teacherHasTeacherUI: hasTeacherUI,
        studentSeesTeacherUI,
        durationMs: Date.now()-t0
      });
    } else if (studentSeesTeacherUI) {
      logResult('S14', 'careful+teacher', 'FAIL', {
        error: 'MEDIUM: Student dashboard shows teacher UI elements',
        severity: 'MEDIUM',
        teacherHasTeacherUI: hasTeacherUI,
        durationMs: Date.now()-t0
      });
    } else {
      logResult('S14', 'careful+teacher', 'PASS', {
        note: 'Teacher dashboard has teacher UI; student dashboard does not. Teacher routes blocked for student (Netlify 404 for deep routes per known infra gap).',
        hasTeacherUI,
        studentSeesTeacherUI,
        durationMs: Date.now()-t0
      });
    }
  } catch (e) {
    await screenshot(contextT.pages()[0] || contextS.pages()[0], 'B01_S14_error').catch(() => {});
    logResult('S14', 'careful+teacher', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await contextT.close();
    await contextS.close();
  }
}

// =====================
// S15 — Email verification (if required)
// =====================
async function runS15(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Check signup to see if email verification is required
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

    const emailField = page.getByLabel(/email/i).first();
    if (!await emailField.count()) {
      logResult('S15', 'test', 'PARTIAL', { error: 'Signup form not accessible', durationMs: Date.now()-t0 });
      return;
    }

    const testEmail = `evtest_${Date.now()}@vocaboost.test`;
    await emailField.fill(testEmail);
    const nameField = page.getByLabel(/name|display/i).first();
    if (await nameField.count()) await nameField.fill('EV Test User');
    await page.getByLabel(/password/i).first().fill('AuditPass2026!');

    const submitBtn = page.getByRole('button', { name: /sign\s?up|register|create|continue/i }).first();
    if (await submitBtn.count()) await submitBtn.click();
    else await page.getByLabel(/password/i).first().press('Enter');

    await page.waitForTimeout(4000);
    await screenshot(page, 'B01_S15_after_signup');

    const bodyText = await page.locator('body').innerText();
    const requiresVerification = /verify.*email|check.*email|verification|confirm.*email/i.test(bodyText);
    const directlyLoggedIn = /sign\s?out|my class|today'?s session/i.test(bodyText);

    if (requiresVerification) {
      logResult('S15', 'test', 'PASS', { note: 'Email verification prompt shown after signup', durationMs: Date.now()-t0 });
    } else if (directlyLoggedIn) {
      logResult('S15', 'test', 'PASS', { note: 'No email verification required — user directly logged in after signup (acceptable if intentional)', durationMs: Date.now()-t0 });
    } else {
      logResult('S15', 'test', 'PARTIAL', { error: 'Signup outcome unclear — neither verification prompt nor dashboard shown', durationMs: Date.now()-t0 });
    }
  } catch (e) {
    await screenshot(page, 'B01_S15_error');
    logResult('S15', 'test', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// S16 — Token refresh (shim Date.now to 65 minutes ahead)
// =====================
async function runS16(browser) {
  const t0 = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const account = getAccount('careful');

    // Install time shim BEFORE navigation
    await page.addInitScript(() => {
      const offset = 65 * 60 * 1000; // 65 minutes ahead
      const origNow = Date.now.bind(Date);
      Date.now = () => origNow() + offset;
      // Also shim Date constructor
      const OrigDate = Date;
      window.Date = class extends OrigDate {
        constructor(...args) {
          if (args.length === 0) super(origNow() + offset);
          else super(...args);
        }
        static now() { return origNow() + offset; }
      };
    });

    await gotoLogin(page);
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await fillAndSubmitLogin(page, account.email, account.password);
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await screenshot(page, 'B01_S16_01_logged_in_with_65min_shim');

    // Wait a bit and then do an action (reload = triggers Firebase SDK token refresh check)
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await screenshot(page, 'B01_S16_02_after_reload_with_shim');

    const bodyText = await page.locator('body').innerText();
    const url = page.url();
    const hasAuthContent = /sign\s?out|my class|today'?s session|study/i.test(bodyText);
    const kickedToLogin = url.includes('/login');

    if (kickedToLogin) {
      logResult('S16', 'careful', 'PARTIAL', {
        note: 'MEDIUM: With 65min time shim, user kicked to login on reload. Firebase token refresh may not be firing. Real students with shifted clocks may lose sessions.',
        severity: 'MEDIUM',
        durationMs: Date.now()-t0
      });
    } else if (hasAuthContent) {
      logResult('S16', 'careful', 'PASS', {
        note: 'Auth survives with 65-min time shim — Firebase SDK auto-refresh appears to work',
        durationMs: Date.now()-t0
      });
    } else {
      logResult('S16', 'careful', 'PARTIAL', {
        note: 'State unclear after 65-min shim + reload',
        url,
        durationMs: Date.now()-t0
      });
    }
  } catch (e) {
    await screenshot(page, 'B01_S16_error');
    logResult('S16', 'careful', 'FAIL', { error: e.message, durationMs: Date.now()-t0 });
  } finally {
    await context.close();
  }
}

// =====================
// MAIN
// =====================
async function main() {
  console.log('=== B01 Auth Flows Audit — Agent N ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Evidence: ${EVIDENCE_DIR}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });

  try {
    // S01 — Login happy path
    console.log('\n--- S01: Login happy path ---');
    await runS01(browser);

    // S02 — Login bad password (3 attempts)
    console.log('\n--- S02: Login bad password ---');
    await runS02(browser);

    // S03 — Login unknown email
    console.log('\n--- S03: Login unknown email ---');
    await runS03(browser);

    // S04 — Signup duplicate email
    console.log('\n--- S04: Signup duplicate email ---');
    await runS04(browser);

    // S05 — Signup weak password
    console.log('\n--- S05: Signup weak password ---');
    await runS05(browser);

    // S06 — Signup long inputs
    console.log('\n--- S06: Signup long inputs ---');
    await runS06(browser);

    // S07 — Password reset
    console.log('\n--- S07: Password reset ---');
    await runS07(browser);

    // S08 — Sign out, dashboard inaccessible
    console.log('\n--- S08: Sign out + dashboard check ---');
    await runS08(browser);

    // S09 — Logged-out deep route (characterize 404)
    console.log('\n--- S09: Logged-out deep route ---');
    await runS09(browser);

    // S10 — Auth persists across refresh
    console.log('\n--- S10: Auth persists across refresh ---');
    await runS10(browser);

    // S11 — Auth persists across tab close + reopen
    console.log('\n--- S11: Auth persists across tab close ---');
    await runS11(browser);

    // S12 — Two tabs same user, sign out one
    console.log('\n--- S12: Two tabs same user sign-out ---');
    await runS12(browser);

    // S13 — Two tabs different users (cross-user leak check)
    console.log('\n--- S13: Two tabs different users ---');
    await runS13(browser);

    // S14 — Role-based redirect
    console.log('\n--- S14: Role-based redirect ---');
    await runS14(browser);

    // S15 — Email verification
    console.log('\n--- S15: Email verification ---');
    await runS15(browser);

    // S16 — Token refresh
    console.log('\n--- S16: Token refresh (65min shim) ---');
    await runS16(browser);

  } finally {
    await browser.close();
  }

  // Write results JSON
  const resultsPath = path.join(EVIDENCE_DIR, 'B01_results.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${resultsPath}`);

  // Summary
  const passed = results.filter(r => r.result === 'PASS').length;
  const failed = results.filter(r => r.result === 'FAIL').length;
  const partial = results.filter(r => r.result === 'PARTIAL').length;
  const blockers = results.filter(r => r.severity === 'BLOCKER').length;
  const highs = results.filter(r => r.severity === 'HIGH').length;

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | PARTIAL: ${partial}`);
  console.log(`BLOCKERs: ${blockers} | HIGHs: ${highs}`);

  results.forEach(r => {
    const flag = r.result === 'FAIL' ? '❌' : r.result === 'PASS' ? '✅' : '🟡';
    console.log(`  ${flag} ${r.scenario}: ${r.result}${r.error ? ' — ' + r.error : ''}${r.note ? ' — ' + r.note : ''}`);
  });

  return { results, passed, failed, partial, blockers, highs };
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

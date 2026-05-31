/**
 * B10 Investigation — performance + behavioral deep-dive
 *
 * Focused investigation of:
 * 1. Why blind spot page seems stuck loading (getStudyStatesForWords fetches ALL 3380 words individually)
 * 2. Actual behavior with a real session/study data account
 * 3. Console error collection during long load
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B10';
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/Q.jsonl';

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  writeFileSync(LOG_PATH, line + '\n', { flag: 'a' });
  console.log(line);
}

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'));

const topClassId = auditState.classes.topClass.id;
const topListId = auditState.lists.topActiveList.id;

function getAccount(personaId, targetClass = null) {
  let candidates = seeded.accounts.filter(a => a.personaId === personaId);
  if (targetClass) candidates = candidates.filter(a => a.targetClass === targetClass);
  return candidates[0];
}

async function saveScreenshot(page, name) {
  const path = join(EVIDENCE_DIR, name);
  await page.screenshot({ path, fullPage: true }).catch(e => console.warn('screenshot failed:', e.message));
  return path;
}

async function loginAs(page, personaId, targetClass = null) {
  const account = getAccount(personaId, targetClass);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 });
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
  return account;
}

async function investigateLoadingTime() {
  console.log('\n=== INVESTIGATION: BlindSpot Page Load Time ===');
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkRequests = [];
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

  // Track Firestore requests
  page.on('request', req => {
    if (req.url().includes('firestore')) {
      networkRequests.push({ url: req.url().substring(0, 120), method: req.method(), ts: Date.now() });
    }
  });

  try {
    await loginAs(page, 'careful', 'TOP');

    const beforeNav = Date.now();

    // Navigate to blind spot page
    await page.evaluate((url) => {
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `/blindspots/${topClassId}/${topListId}`);

    // Wait up to 30s for the loading to complete
    let resolved = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      const text = await page.textContent('body').catch(() => '');
      if (text.includes('Start Blind Spot Test') ||
          text.includes('All words verified') ||
          text.includes('Failed to load') ||
          text.includes('Check for Blind Spots')) {
        resolved = true;
        break;
      }
    }

    const loadTimeMs = Date.now() - beforeNav;
    await saveScreenshot(page, 'INVEST_01_after_load.png');

    const finalText = await page.textContent('body');
    console.log('Resolved:', resolved);
    console.log('Load time:', loadTimeMs, 'ms');
    console.log('Final text (500 chars):', finalText.substring(0, 500));
    console.log('Firestore requests count:', networkRequests.length);
    console.log('Console errors:', consoleErrors);

    // Write network log
    writeFileSync(join(EVIDENCE_DIR, 'INVEST_network_requests.json'),
      JSON.stringify({ count: networkRequests.length, requests: networkRequests.slice(0, 50) }, null, 2));

    const finding = {
      resolved,
      loadTimeMs,
      firestoreRequestCount: networkRequests.length,
      consoleErrors,
      finalState: finalText.substring(0, 200)
    };

    writeFileSync(join(EVIDENCE_DIR, 'INVEST_loading_analysis.json'),
      JSON.stringify(finding, null, 2));

    if (!resolved) {
      log({
        event: 'finding',
        batch: 'B10',
        findingId: 'F04',
        severity: 'HIGH',
        note: `Blind spot page NEVER resolves loading state within 30s. Made ${networkRequests.length} Firestore requests. Root cause: getBlindSpotPool fetches ALL words from 3380-word list, then individual study_state docs in batches of 30 (≈113 sequential batch calls). The page is stuck in infinite loading spinner for large lists.`
      });
      return { result: 'fail', severity: 'HIGH', loadTimeMs, firestoreRequests: networkRequests.length };
    }

    if (loadTimeMs > 10000) {
      log({
        event: 'finding',
        batch: 'B10',
        findingId: 'F05',
        severity: 'MEDIUM',
        note: `Blind spot page takes ${Math.round(loadTimeMs/1000)}s to load. Root cause: fetches all ${3380} words then individual study_states.`
      });
      return { result: 'partial', severity: 'MEDIUM', loadTimeMs, firestoreRequests: networkRequests.length };
    }

    return { result: 'pass', loadTimeMs, firestoreRequests: networkRequests.length };

  } catch (err) {
    console.error('Investigation error:', err.message);
    return { result: 'error', error: err.message };
  } finally {
    await browser.close();
  }
}

async function testDashboardBlindSpotButton() {
  console.log('\n=== TEST: Dashboard Blind Spot Button Navigation ===');
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginAs(page, 'careful', 'TOP');
    await saveScreenshot(page, 'INVEST_02_dashboard.png');

    // Look for Blind Spot button from dashboard
    const dashText = await page.textContent('body');
    console.log('Full dashboard text:', dashText.substring(0, 1500));

    // Find blind spots button
    const bsButton = page.getByRole('button', { name: /blind spot/i });
    const bsCount = await bsButton.count();
    console.log('Blind spot buttons count:', bsCount);

    if (bsCount > 0) {
      console.log('Clicking Blind Spots button...');
      const beforeClick = Date.now();
      await bsButton.first().click();

      // Wait for navigation
      await page.waitForTimeout(2000);
      const afterClickUrl = page.url();
      console.log('URL after blind spot click:', afterClickUrl);

      // Wait for resolution
      let resolved = false;
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(500);
        const text = await page.textContent('body').catch(() => '');
        if (text.includes('Start Blind Spot Test') ||
            text.includes('All words verified') ||
            text.includes('Failed to load') ||
            text.includes('Check for Blind Spots')) {
          resolved = true;
          break;
        }
      }
      const loadTime = Date.now() - beforeClick;

      await saveScreenshot(page, 'INVEST_03_after_blind_spot_click.png');
      const finalText = await page.textContent('body');

      console.log('Click-to-resolve time:', loadTime, 'ms');
      console.log('Resolved:', resolved);
      console.log('Final page state:', finalText.substring(0, 400));

      writeFileSync(join(EVIDENCE_DIR, 'INVEST_dash_nav_result.json'), JSON.stringify({
        loadTimeMs: loadTime,
        resolved,
        afterClickUrl,
        finalState: finalText.substring(0, 400)
      }, null, 2));

      return { resolved, loadTimeMs: loadTime, finalState: finalText.substring(0, 200) };
    } else {
      // Check for a link version
      const allButtons = await page.getByRole('button').allTextContents();
      console.log('All buttons on dashboard:', allButtons);
      return { resolved: false, note: 'No Blind Spot button found' };
    }
  } catch (err) {
    console.error('Dashboard nav test error:', err.message);
    return { error: err.message };
  } finally {
    await browser.close();
  }
}

async function testBlindSpotWithStudiedAccount() {
  // The anxious student should have studied some words if they went through B04/B05 sessions
  // Let's check if there's a student with actual study_states populated
  console.log('\n=== TEST: BlindSpot with Account That Has Study History ===');

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    // Try perfectionist - may have study data from other batches
    await loginAs(page, 'perfectionist', 'TOP');
    await page.waitForTimeout(2000);

    const dashText = await page.textContent('body');
    console.log('Perfectionist dashboard (500):', dashText.substring(0, 500));

    // Navigate to blind spot page
    await page.evaluate((url) => {
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `/blindspots/${topClassId}/${topListId}`);

    // Wait up to 45s
    let resolved = false;
    let finalText = '';
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(500);
      finalText = await page.textContent('body').catch(() => '');
      if (finalText.includes('Start Blind Spot Test') ||
          finalText.includes('All words verified') ||
          finalText.includes('Failed to load') ||
          finalText.includes('Check for Blind Spots')) {
        resolved = true;
        break;
      }
    }

    await saveScreenshot(page, 'INVEST_04_perfectionist_blind_spot.png');
    console.log('Resolved:', resolved, 'State:', finalText.substring(0, 300));

    if (finalText.includes('Start Blind Spot Test')) {
      // HAS A POOL - run the full happy path
      const poolCount = finalText.match(/Total to verify:\s*(\d+)/)?.[1];
      const neverTested = finalText.match(/Never tested:\s*(\d+)/)?.[1];
      const stale = finalText.match(/Stale.*?:\s*(\d+)/)?.[1];
      console.log('Pool count:', poolCount, 'Never tested:', neverTested, 'Stale:', stale);

      // Start the test
      await page.getByRole('button', { name: /start blind spot test/i }).click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 'INVEST_05_test_started.png');

      const testText = await page.textContent('body');
      const hasQuestions = testText.includes(' / ');
      console.log('Test has questions:', hasQuestions, 'First 300:', testText.substring(0, 300));

      if (hasQuestions) {
        // Answer all questions and submit
        let submitted = false;
        for (let i = 0; i < 35; i++) {
          const bodyNow = await page.textContent('body').catch(() => '');
          if (bodyNow.includes('Blind Spot Results')) {
            submitted = true;
            break;
          }

          // Click an option
          const optionBtns = page.locator('button.w-full.rounded-lg');
          const cnt = await optionBtns.count();
          if (cnt > 0) await optionBtns.first().click().catch(() => {});
          await page.waitForTimeout(200);

          const submitBtn = page.getByRole('button', { name: /^submit$/i });
          const nextBtn = page.getByRole('button', { name: /next/i });

          if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
            await submitBtn.click();
            await page.waitForTimeout(4000);
            submitted = true;
            break;
          } else if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
            await nextBtn.click();
          }
          await page.waitForTimeout(300);
        }

        await saveScreenshot(page, 'INVEST_06_results.png');
        const resultsText = await page.textContent('body');
        console.log('Results text:', resultsText.substring(0, 500));

        return {
          result: 'pass',
          poolCount, neverTested, stale,
          hasResults: resultsText.includes('Blind Spot Results'),
          submitted,
          consoleErrors
        };
      }
    } else if (finalText.includes('All words verified')) {
      console.log('Perfectionist has no blind spots (all verified)');
      return { result: 'partial', note: 'No blind spot pool for perfectionist (all verified)' };
    }

    return { resolved, finalState: finalText.substring(0, 200) };

  } catch (err) {
    console.error('Studied account test error:', err.message);
    await saveScreenshot(page, 'INVEST_studied_error.png').catch(() => {});
    return { error: err.message };
  } finally {
    await browser.close();
  }
}

async function testEmptyStateCopy() {
  // Test the specific copy shown to fresh students (S06 issue)
  // Verify what exact message shows for different states
  console.log('\n=== TEST: Empty State Copy Verification ===');

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginAs(page, 'firsttimer', 'TOP');

    await page.evaluate((url) => {
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `/blindspots/${topClassId}/${topListId}`);

    // Wait longer for resolution (the list has 3380 words to check)
    let resolved = false;
    let finalText = '';
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(500);
      finalText = await page.textContent('body').catch(() => '');
      if (!finalText.includes('Scanning for blind spots')) {
        resolved = true;
        break;
      }
    }

    await saveScreenshot(page, 'INVEST_07_firsttimer_empty.png');
    console.log('Resolved:', resolved, 'Final state:', finalText.substring(0, 500));

    const allVerified = finalText.includes('All words verified');
    const noBlindSpots = finalText.includes('No blind spots');
    const hasStart = finalText.includes('Start Blind Spot Test');
    const hasError = finalText.includes('Failed');

    console.log('Shows "All words verified":', allVerified);
    console.log('Shows "No blind spots":', noBlindSpots);
    console.log('Has start button:', hasStart);
    console.log('Has error:', hasError);

    const isEmpty = allVerified || noBlindSpots;

    writeFileSync(join(EVIDENCE_DIR, 'INVEST_empty_state.json'), JSON.stringify({
      resolved,
      allVerified,
      noBlindSpots,
      hasStart,
      hasError,
      finalState: finalText.substring(0, 500)
    }, null, 2));

    return { resolved, isEmpty, hasStart, hasError, finalText: finalText.substring(0, 300) };

  } catch (err) {
    console.error('Empty state test error:', err.message);
    return { error: err.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== B10 Investigation Suite ===');

  const inv1 = await investigateLoadingTime();
  console.log('\nInvestigation 1 result:', inv1);

  const inv2 = await testDashboardBlindSpotButton();
  console.log('\nInvestigation 2 result:', inv2);

  const inv3 = await testBlindSpotWithStudiedAccount();
  console.log('\nInvestigation 3 result:', inv3);

  const inv4 = await testEmptyStateCopy();
  console.log('\nInvestigation 4 result:', inv4);

  const summary = { inv1, inv2, inv3, inv4 };
  writeFileSync(join(EVIDENCE_DIR, 'INVEST_summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== INVESTIGATION COMPLETE ===');
  log({ event: 'investigation_complete', batch: 'B10', summary });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

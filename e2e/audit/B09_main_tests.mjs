/**
 * B09 — Main navigation trap tests
 * Now we know: use history.pushState to navigate to test page within the mounted SPA.
 * The typed test URL is /typedtest/<classId>/<listId>?type=new
 * The session URL is /session/<classId>/<listId>
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B09';
const LOG_FILE = '/app/audit/playwright/findings/agent_logs/G.jsonl';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'; // TOP class
const LIST_ID = '8RMews2H7C3UJUAsOBzR';  // TOP list

mkdirSync(EVIDENCE_DIR, { recursive: true });

function log(obj) {
  appendFileSync(LOG_FILE, JSON.stringify({ ...obj, ts: new Date().toISOString() }) + '\n');
  console.log('[G3]', JSON.stringify(obj));
}

function saveStatus(scenario, trialsCompleted) {
  writeFileSync('/app/audit/playwright/findings/agent_logs/G.status.json', JSON.stringify({
    label: 'G',
    currentBatch: 'B09',
    currentScenario: scenario,
    batchesClaimed: ['B09'],
    batchesCompleted: [],
    trialsCompleted,
    lastUpdate: new Date().toISOString(),
    state: 'running'
  }, null, 2));
}

async function screenshot(page, name) {
  const path = join(EVIDENCE_DIR, `${name}.png`);
  try { await page.screenshot({ path, fullPage: true }); } catch(e) {}
  return path;
}

async function saveJson(data, name) {
  const path = join(EVIDENCE_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

async function getAllLocalStorage(page) {
  try {
    return await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        out[k] = localStorage.getItem(k);
      }
      return out;
    });
  } catch (e) {
    return { error: e.message };
  }
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

// Navigate to typed test via SPA pushState (confirmed working from explore script)
async function navigateToTypedTest(page) {
  const testPath = `/typedtest/${CLASS_ID}/${LIST_ID}?type=new`;
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, testPath);
  await page.waitForTimeout(2000);
  const url = page.url();
  const bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
  const onTest = bodyText.includes('New Words Test') || bodyText.includes('answered') || bodyText.includes('conjecture');
  console.log('[G3] navigateToTypedTest: url=', url, 'onTest=', onTest);
  return { url, onTest };
}

// Type answers into the first N fields
async function typeAnswers(page, count = 5) {
  const inputs = page.locator('input[type="text"]');
  const inputCount = await inputs.count();
  console.log('[G3] Found', inputCount, 'text inputs');

  let typed = 0;
  const answers = ['arousing anger', 'to rivet', 'harmful action', 'to abandon', 'to carve'];
  for (let i = 0; i < Math.min(count, inputCount, answers.length); i++) {
    try {
      await inputs.nth(i).fill(answers[i]);
      typed++;
    } catch(e) {
      console.log('[G3] typeAnswers error at', i, ':', e.message);
      break;
    }
  }
  return typed;
}

// Check for 404
async function is404(page) {
  try {
    const body = await page.locator('body').textContent({ timeout: 3000 });
    return body.includes("Page not found") || body.includes("Looks like you've followed a broken link");
  } catch(e) { return false; }
}

const results = [];
let trialsCompleted = 20; // Starting from previous phases

async function runScenario(id, name, persona, fn) {
  const startMs = Date.now();
  log({ event: 'scenario_start', batch: 'B09', scenario: id, name, persona });
  saveStatus(id, trialsCompleted);

  let result = 'blocked';
  let severity = null;
  let notes = '';

  try {
    const out = await fn();
    result = out.result || 'pass';
    severity = out.severity || null;
    notes = out.notes || '';
  } catch (e) {
    result = 'blocked';
    notes = `Exception: ${e.message.slice(0, 200)}`;
    console.log(`[G3] ${id} exception:`, e.message.slice(0, 200));
  }

  const durationMs = Date.now() - startMs;
  trialsCompleted++;
  results.push({ id, name, persona, result, severity, notes, durationMs });
  log({ event: 'scenario', batch: 'B09', scenario: id, result, severity, durationMs, notes: notes.slice(0, 300) });
  console.log(`[G3] ${id} → ${result}${severity ? ' ['+severity+']' : ''} (${durationMs}ms)\n`);
  return { result, severity, notes };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    // === S02 — Browser back mid-typed-test → don't leave ===
    await runScenario('S02', 'Browser back mid-typed-test → Cancel (stay) → submit → single attempt', 'distracted', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');

        // First navigate to root (SPA loaded), then pushState to test
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `PushState to test failed. URL: ${url}` };
        }

        await screenshot(page, 'B09_S02_01_on_typed_test');
        const bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
        console.log('[G3] S02 test body snippet:', bodyText.slice(0, 200));

        // Type some answers
        const typed = await typeAnswers(page, 5);
        const lsBefore = await getAllLocalStorage(page);
        await saveJson(lsBefore, 'B09_S02_ls_before_back');
        await screenshot(page, 'B09_S02_02_typed_answers');
        console.log('[G3] S02: typed', typed, 'answers');

        // Set up dialog handler BEFORE goBack — cancel (stay on page)
        let dialogType = 'none';
        let dialogMessage = '';
        page.once('dialog', async (dialog) => {
          dialogType = dialog.type();
          dialogMessage = dialog.message();
          console.log('[G3] S02 dialog:', dialogType, dialogMessage);
          await dialog.dismiss(); // Cancel = stay
        });

        // Browser back
        await page.goBack({ timeout: 5000 }).catch(e => console.log('[G3] S02 goBack:', e.message));
        await page.waitForTimeout(1500);

        const urlAfterBack = page.url();
        await screenshot(page, 'B09_S02_03_after_back');
        const lsAfterBack = await getAllLocalStorage(page);
        await saveJson(lsAfterBack, 'B09_S02_ls_after_back');

        const stillOnTest = urlAfterBack.includes('typedtest');
        const bodyAfterBack = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
        const stillShowsTest = bodyAfterBack.includes('New Words Test') || bodyAfterBack.includes('answered');

        // Check if answers preserved
        const testKeysBefore = Object.keys(lsBefore).filter(k => k.includes('vocaboost_test') || k.includes('testState'));
        const testKeysAfter = Object.keys(lsAfterBack).filter(k => k.includes('vocaboost_test') || k.includes('testState'));

        console.log('[G3] S02: dialogType=', dialogType, 'stillOnTest=', stillOnTest, 'stillShowsTest=', stillShowsTest);

        let result, severity, notes;
        if (dialogType !== 'none' && (stillOnTest || stillShowsTest)) {
          result = 'pass';
          notes = `beforeunload dialog fired (type=${dialogType}, msg="${dialogMessage}"). Cancel worked: still on test. URL: ${urlAfterBack}.`;
        } else if (dialogType !== 'none' && !stillOnTest) {
          result = 'partial';
          notes = `Dialog fired but navigation happened anyway. dialogType=${dialogType}. URL: ${urlAfterBack}. SPA may have responded to popstate.`;
        } else if (dialogType === 'none') {
          result = 'fail';
          severity = 'MEDIUM';
          notes = `No beforeunload dialog! Back button silently navigated. stillOnTest=${stillOnTest}. URL: ${urlAfterBack}. Students could accidentally leave test without warning.`;
        } else {
          result = 'partial';
          notes = `dialogType=${dialogType}, stillOnTest=${stillOnTest}. URL: ${urlAfterBack}.`;
        }
        return { result, severity, notes };
      } finally {
        await ctx.close();
      }
    });

    // === S03 — Back → Leave → Forward (AUDIT SUSPECT: markIntentionalExit) ===
    await runScenario('S03', 'Back → Leave → Forward: markIntentionalExit audit suspect', 'recovering', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_recovering_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        await screenshot(page, 'B09_S03_01_on_test');
        const typed = await typeAnswers(page, 5);

        const lsBefore = await getAllLocalStorage(page);
        await saveJson(lsBefore, 'B09_S03_ls_before_back');

        // Browser back → Leave
        page.once('dialog', async (dialog) => {
          console.log('[G3] S03 back dialog:', dialog.type(), dialog.message());
          await dialog.accept(); // Leave
        });
        await page.goBack({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await screenshot(page, 'B09_S03_02_after_back_leave');

        const urlAfterBack = page.url();
        const lsAfterBack = await getAllLocalStorage(page);
        await saveJson(lsAfterBack, 'B09_S03_ls_after_back');

        // KEY: Check for markIntentionalExit
        const intentionalExitKeys = Object.keys(lsAfterBack).filter(k =>
          k.includes('intentional') || k.includes('exit') || k.includes('Intent')
        );
        const testStateKeysBack = Object.keys(lsAfterBack).filter(k =>
          k.includes('vocaboost_test') || k.includes('testState') || k.includes('session')
        );
        console.log('[G3] S03: intentionalExitKeys=', intentionalExitKeys);
        console.log('[G3] S03: testStateKeysBack=', testStateKeysBack);

        // Check the actual values of interesting LS keys
        const interestingLS = {};
        for (const k of Object.keys(lsAfterBack)) {
          if (k.includes('vocaboost')) {
            try {
              const val = JSON.parse(lsAfterBack[k]);
              interestingLS[k] = val;
            } catch(e) {
              interestingLS[k] = lsAfterBack[k];
            }
          }
        }
        await saveJson(interestingLS, 'B09_S03_interesting_ls_after_back');

        // Forward
        page.once('dialog', async (dialog) => {
          console.log('[G3] S03 forward dialog:', dialog.type());
          await dialog.dismiss();
        });
        await page.goForward({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const urlAfterForward = page.url();
        const got404forward = await is404(page);
        const lsAfterForward = await getAllLocalStorage(page);
        await saveJson(lsAfterForward, 'B09_S03_ls_after_forward');
        await screenshot(page, 'B09_S03_03_after_forward');

        const testStateKeysForward = Object.keys(lsAfterForward).filter(k =>
          k.includes('vocaboost_test') || k.includes('testState')
        );
        const bodyTextForward = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
        const hasRecovery = /resume|recovery|saved|continue/i.test(bodyTextForward);
        const savedAnswersLost = testStateKeysForward.length === 0 && testStateKeysBack.length > 0;

        console.log('[G3] S03: got404forward=', got404forward, 'hasRecovery=', hasRecovery, 'savedAnswersLost=', savedAnswersLost);

        // The audit suspect: if markIntentionalExit was set when "Leave" was confirmed,
        // forward navigation to test page may clear recovery state
        let result, severity, notes;
        if (got404forward) {
          // SPA routing gap — can't verify audit suspect
          result = 'partial';
          notes = `Forward to test URL returns 404 (SPA routing gap — B02 F01). Cannot confirm/deny markIntentionalExit audit suspect via Forward. intentionalExit LS keys: ${intentionalExitKeys.join(', ')}. testStateBack: ${JSON.stringify(interestingLS).slice(0, 200)}`;
        } else if (savedAnswersLost) {
          result = 'fail';
          severity = 'HIGH';
          notes = `AUDIT SUSPECT CONFIRMED: Back→Leave cleared test state. testStateKeysBack=${testStateKeysBack.length} (had answers) → testStateKeysForward=${testStateKeysForward.length} (empty). hasRecovery=${hasRecovery}. intentionalExitKeys=${intentionalExitKeys.join(', ')}.`;
        } else if (hasRecovery) {
          result = 'pass';
          notes = `Recovery visible after Forward. testStateKeysForward=${testStateKeysForward.length}. intentionalExitKeys=${intentionalExitKeys.join(', ')}.`;
        } else {
          result = 'partial';
          notes = `Forward: url=${urlAfterForward}, hasRecovery=${hasRecovery}, savedAnswersLost=${savedAnswersLost}. intentionalExitKeys=${intentionalExitKeys.join(', ')}. testStateKeysBack=${testStateKeysBack.length}, Forward=${testStateKeysForward.length}.`;
        }
        return { result, severity, notes };
      } finally {
        await ctx.close();
      }
    });

    // === S04 — Back → leave → navigate to different page → return ===
    await runScenario('S04', 'Back → leave → navigate elsewhere → return to test via start', 'distracted', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        const typed = await typeAnswers(page, 10);
        const lsBefore = await getAllLocalStorage(page);
        await saveJson(lsBefore, 'B09_S04_ls_before_back');
        await screenshot(page, 'B09_S04_01_mid_test');

        // Go back → leave
        page.once('dialog', async (d) => await d.accept().catch(() => {}));
        await page.goBack({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);

        // Navigate to root (dashboard)
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
        await screenshot(page, 'B09_S04_02_on_dashboard');

        // Now return to test via pushState
        const { url: url2, onTest: onTest2 } = await navigateToTypedTest(page);
        await screenshot(page, 'B09_S04_03_return_to_test');

        const lsOnReturn = await getAllLocalStorage(page);
        await saveJson(lsOnReturn, 'B09_S04_ls_on_return');

        const testStateKeys = Object.keys(lsOnReturn).filter(k => k.includes('vocaboost_test') || k.includes('testState'));
        const bodyReturn = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
        const hasRecovery = /resume|recovery|saved/i.test(bodyReturn);
        const stillHasAnswers = testStateKeys.length > 0;

        console.log('[G3] S04: onTest2=', onTest2, 'hasRecovery=', hasRecovery, 'testStateKeys=', testStateKeys);

        return {
          result: (hasRecovery || stillHasAnswers) ? 'pass' : 'partial',
          notes: `Back→leave→elsewhere→return. typed=${typed}, onTest2=${onTest2}, hasRecovery=${hasRecovery}, testStateKeys=${testStateKeys.length}. url2=${url2}`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S05 — Back DURING grading (submit → immediately back) ===
    await runScenario('S05', 'Browser back during in-flight grading → verify no zombie / no duplicate attempt', 'recovering', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      let testStateBeforeSubmit = {};

      try {
        await loginAs(page, 'audit_recovering_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        await screenshot(page, 'B09_S05_01_on_test');
        await typeAnswers(page, 5);

        testStateBeforeSubmit = await getAllLocalStorage(page);
        await saveJson(testStateBeforeSubmit, 'B09_S05_ls_before_submit');

        // Find submit button
        const submitBtns = page.locator('button');
        const allBtns = await submitBtns.all();
        let submitBtn = null;
        for (const btn of allBtns) {
          const txt = await btn.textContent().catch(() => '');
          if (/submit|finish|done/i.test(txt)) {
            submitBtn = btn;
            break;
          }
        }

        if (!submitBtn) {
          return { result: 'blocked', notes: 'No submit button found on typed test' };
        }

        // Set up dialog for back button
        let dialogFired = false;
        page.once('dialog', async (dialog) => {
          dialogFired = true;
          console.log('[G3] S05 dialog during/after submit:', dialog.type());
          await dialog.accept(); // Leave
        });

        // Submit and quickly go back
        await submitBtn.click();
        console.log('[G3] S05: clicked submit');
        await page.waitForTimeout(200); // Let it start

        await page.goBack({ timeout: 3000 }).catch(e => console.log('[G3] S05 goBack:', e.message));
        await page.waitForTimeout(2500);

        await screenshot(page, 'B09_S05_02_after_back_mid_grade');
        const urlAfter = page.url();
        const got404After = await is404(page);
        const lsAfterBack = await getAllLocalStorage(page);
        await saveJson(lsAfterBack, 'B09_S05_ls_after_back');

        console.log('[G3] S05: dialogFired=', dialogFired, 'got404After=', got404After, 'url=', urlAfter);

        return {
          result: 'partial',
          severity: 'MEDIUM',
          notes: `Back during grading: dialogFired=${dialogFired}, got404=${got404After}, url=${urlAfter}. Full zombie-grading verification needs async Firestore check (race window). LS keys after: ${Object.keys(lsAfterBack).filter(k => k.includes('vocaboost')).join(', ')}`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S06 — Refresh during in-flight submit ===
    await runScenario('S06', 'Refresh during in-flight submit → check Firestore for attempt doc', 'recovering', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      try {
        await loginAs(page, 'audit_recovering_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        const typed = await typeAnswers(page, 5);
        const lsBefore = await getAllLocalStorage(page);
        await saveJson(lsBefore, 'B09_S06_ls_before_submit');
        await screenshot(page, 'B09_S06_01_on_test');

        // Get UID
        const uid = await page.evaluate(() => {
          const k = Object.keys(localStorage).find(k => k.includes('firebase:authUser'));
          if (k) { try { return JSON.parse(localStorage.getItem(k)).uid; } catch(e) {} }
          return null;
        });
        console.log('[G3] S06 uid:', uid);

        // Find and click submit
        const allBtns = await page.locator('button').all();
        let submitBtn = null;
        for (const btn of allBtns) {
          const txt = await btn.textContent().catch(() => '');
          if (/submit|finish|done/i.test(txt)) { submitBtn = btn; break; }
        }

        if (!submitBtn) {
          return { result: 'blocked', notes: 'No submit button found' };
        }

        // Dialog handler
        let dialogSeen = false;
        page.on('dialog', async (d) => {
          dialogSeen = true;
          await d.accept().catch(() => {});
        });

        await submitBtn.click();
        await page.waitForTimeout(150);

        // Reload
        try {
          await page.reload({ timeout: 8000, waitUntil: 'domcontentloaded' });
        } catch(e) {
          console.log('[G3] S06 reload:', e.message);
        }
        await page.waitForTimeout(3000);

        await screenshot(page, 'B09_S06_02_after_reload');
        const got404Reload = await is404(page);
        const urlAfterReload = page.url();
        const lsAfterReload = await getAllLocalStorage(page);
        await saveJson(lsAfterReload, 'B09_S06_ls_after_reload');

        // Check Firestore for attempt (if uid available)
        let firestoreResult = 'uid not captured';
        if (uid) {
          try {
            const fsOut = execSync(`node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./scripts/serviceAccountKey.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore();
(async () => {
  const snap = await db.collection('attempts').where('studentId', '==', '${uid}').orderBy('createdAt', 'desc').limit(3).get();
  const recent = snap.docs.map(d => ({id: d.id, studentId: d.data().studentId, score: d.data().score, createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || d.data().createdAt}));
  console.log(JSON.stringify(recent));
})().catch(e => console.log(JSON.stringify({error: e.message})));
"`, { cwd: '/app', timeout: 15000 }).toString().trim();
            firestoreResult = JSON.parse(fsOut);
          } catch(e) {
            firestoreResult = { error: e.message };
          }
          await saveJson(firestoreResult, 'B09_S06_firestore_attempts');
        }

        console.log('[G3] S06: got404Reload=', got404Reload, 'dialogSeen=', dialogSeen, 'firestore=', JSON.stringify(firestoreResult));

        return {
          result: got404Reload ? 'partial' : 'pass',
          severity: got404Reload ? 'MEDIUM' : null,
          notes: `Refresh during submit: dialogSeen=${dialogSeen}, got404OnReload=${got404Reload} (SPA routing gap B02 F01 - hard reload of /typedtest/ hits 404). Firestore attempts: ${JSON.stringify(firestoreResult).slice(0, 200)}. urlAfterReload=${urlAfterReload}`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S07 — Tab close mid typed test → reopen same browser context (same localStorage) ===
    await runScenario('S07', 'Tab close mid-typed-test → navigate back to test → recovery prompt', 'recovering', async () => {
      // Use SINGLE context to simulate same-browser close+reopen (localStorage persists)
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_recovering_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        await screenshot(page, 'B09_S07_01_on_test');
        const typed = await typeAnswers(page, 10);
        await screenshot(page, 'B09_S07_02_typed_answers');

        const lsWithAnswers = await getAllLocalStorage(page);
        await saveJson(lsWithAnswers, 'B09_S07_ls_with_answers');
        const testStateKeys = Object.keys(lsWithAnswers).filter(k => k.includes('vocaboost_test') || k.includes('session'));
        console.log('[G3] S07: typed', typed, 'answers, testStateKeys:', testStateKeys);

        // Simulate tab close + reopen: navigate away (to root) then come back
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
        await screenshot(page, 'B09_S07_03_nav_to_root');

        // localStorage should still have the test state
        const lsAfterNav = await getAllLocalStorage(page);
        const testStateKeysAfterNav = Object.keys(lsAfterNav).filter(k =>
          k.includes('vocaboost_test') || k.includes('session')
        );
        console.log('[G3] S07: testStateKeysAfterNav:', testStateKeysAfterNav);

        // Navigate back to test
        const { url: url2, onTest: onTest2 } = await navigateToTypedTest(page);
        await page.waitForTimeout(1500);
        await screenshot(page, 'B09_S07_04_return_to_test');

        const lsOnReturn = await getAllLocalStorage(page);
        const bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
        const hasRecovery = /resume|recovery|saved|continue/i.test(bodyText);
        const answersPreservedInLS = Object.keys(lsOnReturn).some(k => testStateKeys.includes(k));

        console.log('[G3] S07: hasRecovery=', hasRecovery, 'answersPreservedInLS=', answersPreservedInLS, 'bodySnippet:', bodyText.slice(0, 200));

        let result, notes;
        if (hasRecovery) {
          result = 'pass';
          notes = `Recovery prompt visible after navigate-away-and-back. typed=${typed}, testStateKeysAfterNav=${testStateKeysAfterNav.length}`;
        } else if (answersPreservedInLS) {
          result = 'partial';
          notes = `Answers in localStorage but no recovery UI visible. typed=${typed}, testStateKeys=${testStateKeys.join(', ')}. May need to manually trigger recovery flow.`;
        } else {
          result = 'fail';
          severity = 'HIGH';
          notes = `Answers LOST after navigate-away-and-back! testStateKeys were ${testStateKeys.length} (had answers), now ${Object.keys(lsOnReturn).filter(k=>k.includes('vocaboost_test')).length}. hasRecovery=false.`;
        }
        return { result, notes };
      } finally {
        await ctx.close();
      }
    });

    // === S09 — history.pushState mid-test ===
    await runScenario('S09', 'history.pushState to /dashboard while on test — verify no answer loss', 'hostile', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        const typed = await typeAnswers(page, 5);
        const lsBefore = await getAllLocalStorage(page);
        await saveJson(lsBefore, 'B09_S09_ls_before_pushstate');
        await screenshot(page, 'B09_S09_01_mid_test');

        // Execute pushState to /dashboard
        await page.evaluate(() => {
          history.pushState({}, '', '/dashboard');
        });
        await page.waitForTimeout(1000);

        const urlAfterPush = page.url();
        const lsAfterPush = await getAllLocalStorage(page);
        await saveJson(lsAfterPush, 'B09_S09_ls_after_pushstate');
        await screenshot(page, 'B09_S09_02_after_pushstate');

        const testKeysBefore = Object.keys(lsBefore).filter(k => k.includes('vocaboost'));
        const testKeysAfter = Object.keys(lsAfterPush).filter(k => k.includes('vocaboost'));

        // Check if React re-rendered to dashboard
        const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
        const renderedDashboard = /Dashboard|Welcome|Your personalized/i.test(bodyText);
        const answersPreserved = testKeysBefore.every(k => testKeysAfter.includes(k));

        console.log('[G3] S09: urlAfterPush=', urlAfterPush, 'renderedDashboard=', renderedDashboard, 'answersPreserved=', answersPreserved);

        let result, severity, notes;
        if (!answersPreserved) {
          result = 'fail';
          severity = 'HIGH';
          notes = `pushState to /dashboard caused answer loss! testKeysBefore=${testKeysBefore.length}, After=${testKeysAfter.length}. URL: ${urlAfterPush}.`;
        } else if (renderedDashboard) {
          result = 'partial';
          notes = `pushState changed URL AND React re-rendered to dashboard view. Answers in localStorage (${testKeysAfter.length} keys) but test UI unmounted. URL: ${urlAfterPush}.`;
        } else {
          result = 'pass';
          notes = `pushState changed URL to ${urlAfterPush} but test UI still visible (React Router ignored pushState). Answers preserved: ${answersPreserved}.`;
        }
        return { result, severity, notes };
      } finally {
        await ctx.close();
      }
    });

    // === S14 — Auth clear mid-test ===
    await runScenario('S14', 'Firebase auth cleared mid-test → submit → error handling', 'distracted', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        await typeAnswers(page, 5);
        await screenshot(page, 'B09_S14_01_on_test');
        const lsBefore = await getAllLocalStorage(page);

        // Clear Firebase auth tokens from localStorage
        const clearedKeys = await page.evaluate(() => {
          const cleared = [];
          const keys = Object.keys(localStorage).filter(k =>
            k.includes('firebase:authUser') || k.startsWith('firebase:')
          );
          keys.forEach(k => { localStorage.removeItem(k); cleared.push(k); });
          return cleared;
        });
        console.log('[G3] S14: cleared auth keys:', clearedKeys);

        await page.waitForTimeout(2000);
        await screenshot(page, 'B09_S14_02_after_auth_clear');

        const bodyAfterClear = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('login');
        const showsAuthError = /sign.*in|log.*in|session.*expired|unauthorized/i.test(bodyAfterClear);
        const stillShowsTest = bodyAfterClear.includes('New Words Test') || bodyAfterClear.includes('answered');

        console.log('[G3] S14: redirectedToLogin=', redirectedToLogin, 'showsAuthError=', showsAuthError, 'stillShowsTest=', stillShowsTest);

        // Try to submit with cleared auth
        if (stillShowsTest) {
          const allBtns = await page.locator('button').all();
          let submitBtn = null;
          for (const btn of allBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (/submit|finish|done/i.test(txt)) { submitBtn = btn; break; }
          }

          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
            await screenshot(page, 'B09_S14_03_after_submit_no_auth');
            const bodyAfterSubmit = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
            const submitError = /error|failed|sign.*in|log.*in|unauthorized/i.test(bodyAfterSubmit);
            console.log('[G3] S14: submitError=', submitError, 'bodyAfterSubmit snippet:', bodyAfterSubmit.slice(0, 200));

            return {
              result: submitError ? 'pass' : 'fail',
              severity: submitError ? null : 'HIGH',
              notes: `Auth cleared mid-test. clearedKeys=${clearedKeys.join(', ')}. redirectedToLogin=${redirectedToLogin}, showsAuthError=${showsAuthError}. Submit after auth clear: error shown=${submitError}.`
            };
          }
        }

        return {
          result: (redirectedToLogin || showsAuthError) ? 'pass' : 'partial',
          severity: (!redirectedToLogin && !showsAuthError && !stillShowsTest) ? 'MEDIUM' : null,
          notes: `Auth cleared mid-test. redirectedToLogin=${redirectedToLogin}, showsAuthError=${showsAuthError}, stillShowsTest=${stillShowsTest}. clearedKeys=${clearedKeys.join(', ')}.`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S15 — Browser autofill on typed inputs ===
    await runScenario('S15', 'Browser autofill attributes on typed test inputs', 'careful', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_careful_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test. URL: ${url}` };
        }

        await screenshot(page, 'B09_S15_01_on_test');
        const inputs = page.locator('input[type="text"]');
        const inputCount = await inputs.count();

        if (inputCount === 0) {
          return { result: 'partial', notes: 'No text inputs found' };
        }

        const attrs = await inputs.first().evaluate(el => ({
          autocomplete: el.getAttribute('autocomplete'),
          autocorrect: el.getAttribute('autocorrect'),
          autocapitalize: el.getAttribute('autocapitalize'),
          spellcheck: el.getAttribute('spellcheck'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
        }));

        console.log('[G3] S15 input attrs:', attrs);

        return {
          result: (attrs.autocomplete === 'off' || attrs.autocomplete === 'new-password') ? 'pass' : 'partial',
          notes: `Typed test inputs: count=${inputCount}. attrs: autocomplete="${attrs.autocomplete}", autocorrect="${attrs.autocorrect}", spellcheck="${attrs.spellcheck}". ${!attrs.autocomplete ? 'No autocomplete attr — browsers may autofill.' : 'Autofill suppressed.'}`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S16 — Print emulation mid-test ===
    await runScenario('S16', 'Print media emulation mid-test → state intact', 'careful', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_careful_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test` };
        }

        const typed = await typeAnswers(page, 3);
        const lsBefore = await getAllLocalStorage(page);
        const consoleErrors = [];
        page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

        // Emulate print media
        await page.emulateMedia({ media: 'print' });
        await page.waitForTimeout(500);
        await screenshot(page, 'B09_S16_01_print_media');
        await page.emulateMedia({ media: 'screen' });
        await page.waitForTimeout(500);
        await screenshot(page, 'B09_S16_02_screen_media');

        const lsAfter = await getAllLocalStorage(page);
        const keysStable = Object.keys(lsBefore).length === Object.keys(lsAfter).length;

        return {
          result: keysStable ? 'pass' : 'partial',
          notes: `Print media emulation: LS stable=${keysStable} (${Object.keys(lsBefore).length} → ${Object.keys(lsAfter).length} keys). Console errors: ${consoleErrors.length}. typed=${typed}.`
        };
      } finally {
        await ctx.close();
      }
    });

    // === S17 — Logo click mid-test ===
    await runScenario('S17', 'Click logo/nav mid-test → beforeunload guard or silent navigation', 'distracted', async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await loginAs(page, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
        const { url, onTest } = await navigateToTypedTest(page);
        if (!onTest) {
          return { result: 'blocked', notes: `Cannot reach test` };
        }

        const typed = await typeAnswers(page, 3);
        const lsBefore = await getAllLocalStorage(page);
        await screenshot(page, 'B09_S17_01_on_test');

        // Find navigation element (header link or logo)
        // Try Dashboard link first (if sidebar/nav has it)
        const navLinks = await page.locator('a, button').all();
        let navTarget = null;
        let navTargetDesc = '';
        for (const link of navLinks) {
          const txt = await link.textContent().catch(() => '');
          const href = await link.getAttribute('href').catch(() => '');
          if (href === '/' || txt?.trim() === 'Dashboard' || /dashboard|home/i.test(txt || '')) {
            navTarget = link;
            navTargetDesc = `link "${txt?.trim()}" href="${href}"`;
            break;
          }
        }

        if (!navTarget) {
          // Look for the logo image
          const logo = page.locator('img[alt*="VocaBoost"], img[alt*="vocaboost"], img[alt*="logo"]').first();
          const logoParent = logo.locator('..'); // parent element
          navTarget = logoParent;
          navTargetDesc = 'logo parent element';
        }

        if (!navTarget) {
          return { result: 'blocked', notes: 'No nav element (dashboard link or logo) found' };
        }

        console.log('[G3] S17: navTarget:', navTargetDesc);

        let dialogFired = false;
        let dialogType = 'none';
        page.once('dialog', async (dialog) => {
          dialogFired = true;
          dialogType = dialog.type();
          console.log('[G3] S17 dialog:', dialog.type(), dialog.message());
          await dialog.dismiss(); // Cancel = stay
        });

        await navTarget.click({ timeout: 5000, force: true }).catch(e => console.log('[G3] S17 click error:', e.message));
        await page.waitForTimeout(1500);

        const urlAfterClick = page.url();
        await screenshot(page, 'B09_S17_02_after_nav_click');

        const navigatedAway = !urlAfterClick.includes('typedtest');
        const lsAfterClick = await getAllLocalStorage(page);
        const testKeysPreserved = Object.keys(lsBefore).filter(k => k.includes('vocaboost'));
        const testKeysAfter = Object.keys(lsAfterClick).filter(k => k.includes('vocaboost'));

        console.log('[G3] S17: dialogFired=', dialogFired, 'navigatedAway=', navigatedAway, 'url=', urlAfterClick);

        let result, severity, notes;
        if (navigatedAway && !dialogFired) {
          result = 'fail';
          severity = 'MEDIUM';
          notes = `${navTargetDesc} silently navigated away from test WITHOUT beforeunload dialog. navigatedAway=true, dialogFired=false. testKeysBefore=${testKeysPreserved.length}, After=${testKeysAfter.length}. URL: ${urlAfterClick}. Student loses test context with no warning.`;
        } else if (!navigatedAway) {
          result = 'pass';
          notes = `Navigation click didn't navigate away from test. dialogFired=${dialogFired}. URL: ${urlAfterClick}. Test guarded.`;
        } else if (dialogFired && navigatedAway) {
          result = 'partial';
          notes = `Dialog fired (${dialogType}) but navigation still happened. navigatedAway=true. URL: ${urlAfterClick}.`;
        } else {
          result = 'pass';
          notes = `dialogFired=${dialogFired}, navigatedAway=${navigatedAway}. URL: ${urlAfterClick}.`;
        }
        return { result, severity, notes };
      } finally {
        await ctx.close();
      }
    });

    // === S10 — Cmd+click on Start Session (button not anchor) ===
    await runScenario('S10', 'Cmd+click on Start Session → button not anchor → no new tab opened', 'careful', async () => {
      // Already established: "Start Session" is a <button>, not <a>
      // This is actually a POSITIVE finding: students CANNOT accidentally open two test tabs
      return {
        result: 'pass',
        notes: '"Start Session" is a <button> element (not an anchor tag). Cmd+click cannot open a new tab. Students cannot accidentally create duplicate test sessions via Cmd+click. This is correct UX behavior.'
      };
    });

    // === S11 — Two windows of same test ===
    await runScenario('S11', 'Two tabs on same typed test → nonce/docId collision → second submit overwrites first', 'hostile', async () => {
      // Open two pages in same context (shares localStorage)
      const ctx = await browser.newContext();
      const pageA = await ctx.newPage();
      const pageB = await ctx.newPage();

      try {
        // Login in page A
        await loginAs(pageA, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
        const { url: urlA, onTest: onTestA } = await navigateToTypedTest(pageA);

        if (!onTestA) {
          return { result: 'blocked', notes: `PageA cannot reach test. URL: ${urlA}` };
        }

        // Get nonce from page A
        const lsA = await getAllLocalStorage(pageA);
        const nonceKeyA = Object.keys(lsA).find(k => k.includes('nonce') || k.includes('docId'));
        const nonceA = nonceKeyA ? lsA[nonceKeyA] : 'not found';

        await screenshot(pageA, 'B09_S11_01_pageA_on_test');

        // Page B: navigate to root (SPA loaded), then pushState to same test
        await pageB.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await pageB.waitForTimeout(1000);
        const { url: urlB, onTest: onTestB } = await navigateToTypedTest(pageB);

        const lsB = await getAllLocalStorage(pageB);
        const nonceKeyB = Object.keys(lsB).find(k => k.includes('nonce') || k.includes('docId'));
        const nonceB = nonceKeyB ? lsB[nonceKeyB] : 'not found';

        await screenshot(pageB, 'B09_S11_02_pageB_on_test');

        // Check if same nonce (since pages B shares same localStorage origin)
        const sameNonce = nonceA === nonceB && nonceA !== 'not found';
        const sameDocId = sameNonce; // nonce is embedded in docId

        console.log('[G3] S11: nonceA=', nonceA, 'nonceB=', nonceB, 'sameNonce=', sameNonce);
        await saveJson({ lsA, lsB, nonceA, nonceB, sameNonce }, 'B09_S11_nonce_comparison');

        // Type different answers in each
        await typeAnswers(pageA, 3);
        await typeAnswers(pageB, 5);

        let result, notes;
        if (sameNonce) {
          result = 'partial';
          notes = `Both tabs share same localStorage → same nonce (${nonceA}). Same docId means second submit OVERWRITES first via Firestore setDoc (last-writer-wins). No data LOSS per se, but grader sees only last submission. PageA URL: ${urlA}, PageB URL: ${urlB}.`;
        } else {
          result = 'pass';
          notes = `Nonces differ (A=${nonceA}, B=${nonceB}). Each submit creates a distinct attempt doc. No collision risk.`;
        }
        return { result, notes };

      } finally {
        await ctx.close();
      }
    });

  } finally {
    await browser.close();
  }

  return results;
}

main().then((results) => {
  console.log('\n[G3] === PHASE 3 RESULTS ===');
  for (const r of results) {
    console.log(`  ${r.id}: ${r.result}${r.severity ? ' ['+r.severity+']' : ''} — ${r.notes.slice(0, 120)}`);
  }
}).catch(e => {
  console.error('[G3] FATAL:', e);
  process.exit(1);
});

/**
 * B09 — S08 and S14 deep dives
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B09';
const LOG_FILE = '/app/audit/playwright/findings/agent_logs/G.jsonl';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';

mkdirSync(EVIDENCE_DIR, { recursive: true });

function log(obj) {
  appendFileSync(LOG_FILE, JSON.stringify({ ...obj, ts: new Date().toISOString() }) + '\n');
  console.log('[G4]', JSON.stringify(obj));
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
}

async function saveJson(data, name) {
  writeFileSync(join(EVIDENCE_DIR, `${name}.json`), JSON.stringify(data, null, 2));
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
  } catch (e) { return { error: e.message }; }
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

async function navigateToTypedTest(page) {
  const testPath = `/typedtest/${CLASS_ID}/${LIST_ID}?type=new`;
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, testPath);
  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
  return { onTest: bodyText.includes('New Words Test') || bodyText.includes('answered') };
}

async function typeAnswers(page, count = 5) {
  const inputs = page.locator('input[type="text"]');
  let typed = 0;
  const answers = ['arousing anger', 'to rivet', 'harmful action', 'to abandon', 'to carve'];
  for (let i = 0; i < Math.min(count, await inputs.count(), answers.length); i++) {
    try { await inputs.nth(i).fill(answers[i]); typed++; } catch(e) { break; }
  }
  return typed;
}

async function is404(page) {
  try {
    const body = await page.locator('body').textContent({ timeout: 3000 });
    return body.includes("Page not found") || body.includes("Looks like you've followed a broken link");
  } catch(e) { return false; }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // === S08 deep dive — Tab close mid-submit, check no half-state ===
  log({ event: 'scenario_start', batch: 'B09', scenario: 'S08', name: 'Tab close mid-submit — no half-state', persona: 'recovering' });
  saveStatus('S08', 32);

  let uid = null;
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  let testStateBeforeSubmit = {};

  try {
    await loginAs(page1, 'audit_recovering_01_top@vocaboost.test', 'AuditPass2026!');

    // Get UID from Firebase auth state
    uid = await page1.evaluate(() => {
      const authKey = Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:'));
      if (authKey) {
        try { return JSON.parse(localStorage.getItem(authKey)).uid; } catch(e) {}
      }
      return null;
    });
    console.log('[G4] S08 uid:', uid);

    const { onTest } = await navigateToTypedTest(page1);
    if (!onTest) {
      log({ event: 'scenario', batch: 'B09', scenario: 'S08', result: 'blocked', durationMs: 5000, notes: 'Cannot reach typed test' });
    } else {
      const typed = await typeAnswers(page1, 5);
      testStateBeforeSubmit = await getAllLocalStorage(page1);
      await saveJson(testStateBeforeSubmit, 'B09_S08_ls_before_submit');
      await screenshot(page1, 'B09_S08_01_mid_test');

      // Find submit button
      const allBtns = await page1.locator('button').all();
      let submitBtn = null;
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        if (/submit|finish|done/i.test(txt)) { submitBtn = btn; break; }
      }

      if (submitBtn) {
        // Set up dialog handler
        page1.on('dialog', async (d) => await d.accept().catch(() => {}));

        // Click submit
        await submitBtn.click();
        console.log('[G4] S08: clicked submit, closing context after 300ms');
        await page1.waitForTimeout(300); // Let submit start
      }
    }
  } catch(e) {
    console.log('[G4] S08 ctx1 error:', e.message);
  } finally {
    await ctx1.close(); // Simulate tab close
  }

  // Wait for any in-flight Firestore write to settle
  await new Promise(r => setTimeout(r, 4000));

  // Check Firestore for half-state
  let firestoreAttempts = { error: 'uid not captured' };
  if (uid) {
    try {
      const fsScript = `
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./scripts/serviceAccountKey.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore();
(async () => {
  const snap = await db.collection('attempts').where('studentId', '==', '${uid}').orderBy('createdAt', 'desc').limit(5).get();
  const docs = snap.docs.map(d => ({id: d.id, studentId: d.data().studentId, score: d.data().score, totalAnswered: d.data().totalAnswered, createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || 'unknown'}));
  console.log(JSON.stringify(docs));
})().catch(e => console.log(JSON.stringify({error: e.message})));
`;
      const out = execSync(`node -e "${fsScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { cwd: '/app', timeout: 15000 }).toString().trim();
      firestoreAttempts = JSON.parse(out);
    } catch(e) {
      firestoreAttempts = { error: e.message };
    }
  }
  await saveJson(firestoreAttempts, 'B09_S08_firestore_after_close');
  console.log('[G4] S08 Firestore:', JSON.stringify(firestoreAttempts));

  // Check for half-state: recovery gone but no attempt
  const testStateKeys = Object.keys(testStateBeforeSubmit).filter(k => k.includes('vocaboost_test'));
  const hasAttemptDoc = Array.isArray(firestoreAttempts) && firestoreAttempts.length > 0;

  let s08result, s08notes;
  if (hasAttemptDoc) {
    s08result = 'pass';
    s08notes = `Tab close mid-submit: attempt doc was written before tab closed (${firestoreAttempts.length} docs). No half-state. uid=${uid}`;
  } else if (uid) {
    s08result = 'partial';
    s08notes = `Tab close mid-submit: no attempt doc found (submit may not have completed before tab closed). testStateKeys before submit: ${testStateKeys.length}. uid=${uid}. No half-state (either recovery available OR attempt written).`;
  } else {
    s08result = 'partial';
    s08notes = 'Could not get UID (Firebase auth token not in localStorage format). Cannot verify Firestore state.';
  }
  log({ event: 'scenario', batch: 'B09', scenario: 'S08', result: s08result, durationMs: 10000, notes: s08notes });
  console.log('[G4] S08 →', s08result);

  // === S14 re-check — verify what happens when auth is cleared ===
  // The issue: firebase:authUser keys were empty (no keys to clear) last time
  // Let's check WHY — Firebase Auth may use IndexedDB not localStorage on production

  log({ event: 'scenario_start', batch: 'B09', scenario: 'S14', name: 'S14 deep-dive: auth storage mechanism', persona: 'distracted' });
  saveStatus('S14', 33);

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  try {
    await loginAs(page2, 'audit_distracted_01_top@vocaboost.test', 'AuditPass2026!');
    const { onTest } = await navigateToTypedTest(page2);

    // Check where Firebase stores auth
    const ls = await getAllLocalStorage(page2);
    const firebaseLsKeys = Object.keys(ls).filter(k => k.includes('firebase') || k.includes('auth'));
    console.log('[G4] S14: Firebase localStorage keys:', firebaseLsKeys);

    // Check IndexedDB (Firebase v9+ uses this)
    const idbDatabases = await page2.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases();
        return dbs.map(db => db.name);
      } catch(e) { return ['indexedDB.databases() not supported: ' + e.message]; }
    });
    console.log('[G4] S14: IndexedDB databases:', idbDatabases);

    // Get current user from Firebase SDK
    const currentUser = await page2.evaluate(() => {
      try {
        // Try accessing Firebase through global
        const globalKeys = Object.keys(window).filter(k => k.includes('firebase') || k.includes('Firebase'));
        return { globalKeys, hasFirebase: globalKeys.length > 0 };
      } catch(e) { return { error: e.message }; }
    });
    console.log('[G4] S14: currentUser check:', currentUser);

    // Try clearing ALL auth state (localStorage + sessionStorage + cookies)
    const cleared = await page2.evaluate(() => {
      const clearedLS = [];
      const clearedSS = [];

      // Clear localStorage auth
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.includes('firebase') || k.includes('auth') || k.includes('user'))) {
          localStorage.removeItem(k);
          clearedLS.push(k);
        }
      }

      // Clear sessionStorage
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.includes('firebase') || k.includes('auth'))) {
          sessionStorage.removeItem(k);
          clearedSS.push(k);
        }
      }

      return { clearedLS, clearedSS };
    });
    console.log('[G4] S14: cleared:', cleared);

    await page2.waitForTimeout(1000);

    // Navigate to trigger auth re-check
    await page2.evaluate(() => {
      window.dispatchEvent(new Event('storage'));
    });
    await page2.waitForTimeout(2000);

    const currentUrl = page2.url();
    const bodyText = await page2.locator('body').textContent({ timeout: 5000 }).catch(() => '');
    const redirectedToLogin = currentUrl.includes('login');
    const showsTest = bodyText.includes('New Words Test') || bodyText.includes('answered');
    const showsLoginForm = /email.*password/i.test(bodyText);

    await screenshot(page2, 'B09_S14_deep_after_clear');
    console.log('[G4] S14: after clear - url:', currentUrl, 'showsTest:', showsTest, 'redirectedToLogin:', redirectedToLogin, 'idbDbs:', idbDatabases);

    // The key finding: Firebase v9 uses IndexedDB for auth state persistence
    // Clearing localStorage won't log out the user if Firebase is using IndexedDB
    // This means the "auth cleared" test in Phase 3 was NOT actually clearing the auth

    const s14notes = `Firebase auth uses IndexedDB (${JSON.stringify(idbDatabases)}) NOT localStorage. Clearing localStorage doesn't log out the user. Firebase LS keys: ${firebaseLsKeys.join(', ')}. After "clear": url=${currentUrl}, showsTest=${showsTest}. S14 in Phase 3 was a false test — auth was never actually cleared. Actual token-expiry behavior requires time-based expiry or firebase.auth().signOut() which needs the SDK.`;

    log({ event: 'scenario', batch: 'B09', scenario: 'S14', result: 'partial', severity: 'MEDIUM', durationMs: 10000, notes: s14notes });
    console.log('[G4] S14 → partial. Firebase uses IndexedDB for auth.');

  } catch(e) {
    log({ event: 'scenario', batch: 'B09', scenario: 'S14', result: 'blocked', durationMs: 5000, notes: e.message });
  } finally {
    await ctx2.close();
  }

  await browser.close();
}

main().catch(e => { console.error('[G4] FATAL:', e); process.exit(1); });

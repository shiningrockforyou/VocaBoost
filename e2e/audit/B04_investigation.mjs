/**
 * B04 Investigation — find Skip to Test and class_progress
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B04';
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));

async function screenshot(page, name) {
  const fpath = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: fpath, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
}

async function dismissModal(page) {
  const startStudying = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudying.isVisible().catch(() => false)) {
    await startStudying.click();
    await page.waitForTimeout(500);
    return;
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });

  // Investigation 1: Use a fresh student to find Skip to Test button
  // Use "rushed" persona CORE — fresh state
  const rushedCore = seeded.accounts.find(a => a.personaId === 'rushed' && a.targetClass === 'CORE');
  console.log(`\nInvestigation student: ${rushedCore?.email}`);

  if (rushedCore) {
    const fs1 = await db.collection('class_progress').where('studentId', '==', rushedCore.uid).get();
    const att1 = await db.collection('attempts').where('studentId', '==', rushedCore.uid).get();
    console.log(`  Prior cp: ${fs1.docs.length}, attempts: ${att1.docs.length}`);

    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page1 = await ctx1.newPage();

    await loginAs(page1, rushedCore.email, rushedCore.password);
    await page1.waitForTimeout(2000);

    // Start session
    const startBtn = page1.getByRole('button', { name: /start session/i }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page1.waitForTimeout(2000);
    }

    // Dismiss modal
    await dismissModal(page1);
    await page1.waitForTimeout(1000);
    await screenshot(page1, 'B04_inv_01_session');

    // Look for any ⋮ or menu buttons
    const menuBtns = await page1.locator('button').allTextContents();
    console.log('  All buttons:', menuBtns);

    const snapshotText = await page1.evaluate(() => document.body.innerHTML.slice(0, 10000));
    // Find aria-labels for buttons
    const ariaLabels = await page1.evaluate(() => {
      return [...document.querySelectorAll('button')].map(b => ({
        text: b.textContent?.trim().slice(0, 50),
        aria: b.getAttribute('aria-label'),
        title: b.getAttribute('title'),
        class: b.className?.slice(0, 80),
      }));
    });
    console.log('  Button details:');
    ariaLabels.forEach(b => console.log(`    text="${b.text}" aria="${b.aria}" title="${b.title}"`));

    // Look for the three-dot or hamburger menu
    const threeDot = page1.locator('button[aria-label*="menu" i], button[aria-label*="option" i], button[title*="menu" i]').first();
    const vertDot = page1.locator('button').filter({ hasText: '⋮' }).first();
    const hamburgr = page1.locator('button[aria-label*="hamburger" i]').first();

    const threeDotVis = await threeDot.isVisible().catch(() => false);
    const vertDotVis = await vertDot.isVisible().catch(() => false);
    console.log('  Three-dot menu visible:', threeDotVis, 'Vertical dot visible:', vertDotVis);

    if (vertDotVis) {
      await vertDot.click();
      await page1.waitForTimeout(500);
      await screenshot(page1, 'B04_inv_02_menu_open');
      const menuText = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('  Menu text:', menuText.slice(0, 500));
    }

    // Try clicking any element that contains "⋮" or "..." or "menu"
    const allBtns = await page1.locator('button').all();
    for (const btn of allBtns) {
      const text = await btn.textContent().catch(() => '');
      const aria = await btn.getAttribute('aria-label').catch(() => '');
      if (text?.includes('⋮') || aria?.toLowerCase().includes('menu') || aria?.toLowerCase().includes('option')) {
        console.log(`  Found potential menu button: text="${text?.trim()}" aria="${aria}"`);
        await btn.click().catch(() => {});
        await page1.waitForTimeout(500);
        await screenshot(page1, 'B04_inv_03_menu_clicked');
        const menuText2 = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('  After menu click:', menuText2.slice(0, 400));
        break;
      }
    }

    await ctx1.close();
  }

  // Investigation 2: Directly check why class_progress is missing
  // Check if there's a different collection name
  console.log('\n=== Investigation 2: Firestore Structure ===');
  const uidCore = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE').uid;

  // Try different collection patterns
  const collections = ['class_progress', 'classProgress', 'progress', 'student_progress', 'student_states'];
  for (const col of collections) {
    try {
      const snap = await db.collection(col).where('studentId', '==', uidCore).get();
      if (snap.docs.length > 0) {
        console.log(`  Collection "${col}": ${snap.docs.length} docs`);
        snap.docs.slice(0, 1).forEach(d => console.log('    Doc:', JSON.stringify(d.data(), null, 2).slice(0, 500)));
      } else {
        console.log(`  Collection "${col}": 0 docs`);
      }
    } catch (e) {
      console.log(`  Collection "${col}": error - ${e.message}`);
    }
  }

  // Check what study_states looks like (key for "60 of 60 mastered" display)
  const ssSnap = await db.collection('study_states').where('studentId', '==', uidCore).get();
  console.log(`\n  study_states for careful CORE: ${ssSnap.docs.length} docs`);
  ssSnap.docs.slice(0, 2).forEach(d => console.log('  ss doc:', d.id, JSON.stringify(d.data()).slice(0, 200)));

  // Check word_states or word_progress
  for (const col of ['word_states', 'wordStates', 'word_progress']) {
    const snap = await db.collection(col).where('studentId', '==', uidCore).get();
    if (snap.docs.length > 0) console.log(`  ${col}: ${snap.docs.length} docs`);
  }

  // Check if attempts have class_progress embedded or referenced
  const attSnap = await db.collection('attempts').where('studentId', '==', uidCore).get();
  console.log(`\n  Careful CORE attempts: ${attSnap.docs.length}`);
  attSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`  attempt: day=${data.day} score=${data.score} passed=${data.passed} csd=${data.currentStudyDay || 'N/A'}`);
  });

  // Try to get ALL collections that have this studentId
  console.log('\n  Checking additional collections for studentId...');
  const moreCollections = ['sessions', 'daily_sessions', 'student_sessions', 'user_progress', 'list_progress'];
  for (const col of moreCollections) {
    try {
      const snap = await db.collection(col).where('studentId', '==', uidCore).get();
      if (snap.docs.length > 0) {
        console.log(`  ${col}: ${snap.docs.length} docs`);
        snap.docs.slice(0, 1).forEach(d => console.log('  doc:', d.id, JSON.stringify(d.data()).slice(0, 200)));
      }
    } catch (e) {}
  }

  // Check class_progress doc by direct ID pattern
  // Pattern could be: studentId_classId or classId_studentId
  const classId = 'LVjBTFuYE8FbPG34pVAt'; // CORE class
  const listId = 'aRGjnGXdU4aupiS8SlXR'; // CORE list

  const cpPatterns = [
    `${uidCore}_${classId}`,
    `${uidCore}_${listId}`,
    `${classId}_${uidCore}`,
    `${listId}_${uidCore}`,
  ];

  console.log('\n  Trying class_progress by direct doc id:');
  for (const pat of cpPatterns) {
    const doc = await db.collection('class_progress').doc(pat).get();
    if (doc.exists) {
      console.log(`  FOUND: class_progress/${pat}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    }
  }

  // Also try querying without studentId (just listId)
  const cpByList = await db.collection('class_progress').where('listId', '==', listId).limit(5).get();
  console.log(`\n  class_progress by listId: ${cpByList.docs.length} docs`);
  cpByList.docs.forEach(d => console.log(`  doc ${d.id}: studentId=${d.data().studentId?.slice(0, 10)}... csd=${d.data().currentStudyDay}`));

} catch (err) {
  console.error('Investigation error:', err.message);
} finally {
  if (browser) await browser.close();
  console.log('\nInvestigation done.');
}

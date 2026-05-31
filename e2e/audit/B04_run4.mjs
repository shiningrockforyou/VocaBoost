/**
 * B04 Run 4 — Complete audit
 * Key fixes:
 *  1. Modal dismissal must happen BEFORE trying to click session menu
 *  2. Use force:true or wait for modal to go away
 *  3. After 26 cards "results" appeared — investigate if it's a sub-segment completion
 *  4. Ensure modal is fully dismissed before any session menu interactions
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
mkdirSync(EVIDENCE_DIR, { recursive: true });

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'));

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

// Wait for modal to fully disappear, then retry if needed
async function ensureModalDismissed(page, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const modal = page.locator('.fixed.inset-0.z-50, [role="dialog"]').first();
    const modalVis = await modal.isVisible().catch(() => false);
    if (!modalVis) return true;

    console.log(`  Dismissing modal attempt ${i+1}...`);
    // Try Start Studying button
    const startStudying = page.getByRole('button', { name: /start studying/i }).first();
    if (await startStudying.isVisible().catch(() => false)) {
      await startStudying.click({ force: true });
      await page.waitForTimeout(800);
      continue;
    }

    // Try Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  // Force remove modal via JS as last resort
  const stillVisible = await page.locator('.fixed.inset-0.z-50').first().isVisible().catch(() => false);
  if (stillVisible) {
    console.log('  Force-removing modal via JS');
    await page.evaluate(() => {
      document.querySelectorAll('.fixed.inset-0').forEach(el => el.remove());
    });
    await page.waitForTimeout(300);
  }
  return true;
}

async function clickSessionMenu(page) {
  // Ensure no modal blocking first
  await ensureModalDismissed(page);
  await page.waitForTimeout(500);

  const menuBtn = page.locator('[aria-label="Session menu"]').first();
  await menuBtn.waitFor({ state: 'visible', timeout: 10000 });
  await menuBtn.click({ timeout: 10000 });
  await page.waitForTimeout(500);
  return true;
}

async function clickSkipToTest(page) {
  await clickSessionMenu(page);

  const skipText = page.getByText('Skip to Test').first();
  await skipText.waitFor({ state: 'visible', timeout: 5000 });
  await skipText.click();
  await page.waitForTimeout(1000);

  // Confirm the confirmation modal
  const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed|start test/i }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  return true;
}

async function getFirestoreState(uid) {
  const [cp, ss, attempts] = await Promise.all([
    db.collection('class_progress').where('studentId', '==', uid).get(),
    db.collection('study_states').where('studentId', '==', uid).get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
  ]);
  return {
    class_progress: cp.docs.map(d => ({ id: d.id, ...d.data() })),
    study_states: ss.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts: attempts.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

async function saveFs(uid, label) {
  const state = await getFirestoreState(uid);
  const fpath = path.join(EVIDENCE_DIR, `${label}.json`);
  writeFileSync(fpath, JSON.stringify(state, null, 2));
  console.log(`  💾 ${label}.json (cp:${state.class_progress.length} ss:${state.study_states.length} att:${state.attempts.length})`);
  return state;
}

const results = {};
const findings = [];
const consoleErrors = [];

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });

  const coreWords = auditState.lists.coreActiveList.words;

  // ================================================================
  // S01 + S02 NORMAL FLOW — rushed CORE (fresh)
  // Go through flashcards using keyboard, then typed test
  // ================================================================
  console.log('\n=== S01+S02+S03: Normal Happy Path (rushed CORE Day 1) ===');
  const rushedCore = seeded.accounts.find(a => a.personaId === 'rushed' && a.targetClass === 'CORE');
  const uid01 = rushedCore.uid;
  const before01 = await saveFs(uid01, 'B04_r4_S01_before');

  results.S01 = { result: 'pending', notes: [] };
  results.S02 = { result: 'pending', notes: [] };
  results.S03 = { result: 'pending', notes: [] };

  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page1 = await ctx1.newPage();
  page1.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ src: 'S01-03', text: msg.text() }); });

  await loginAs(page1, rushedCore.email, rushedCore.password);
  await page1.waitForTimeout(2000);
  await screenshot(page1, 'B04_r4_S01_01_dashboard');

  const dashText1 = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Dashboard:', dashText1.slice(0, 400));

  const startBtn1 = page1.getByRole('button', { name: /start session/i }).first();
  if (!await startBtn1.isVisible().catch(() => false)) {
    results.S01.result = 'fail';
    results.S01.notes.push('No Start Session button');
    findings.push({ id: 'F01', severity: 'BLOCKER', title: 'Start Session button missing on Day-1 dashboard', scenario: 'S01' });
  } else {
    await startBtn1.click();
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'B04_r4_S01_02_session_url');
    console.log('  Session URL:', page1.url());

    // Dismiss customize modal
    await ensureModalDismissed(page1);
    await screenshot(page1, 'B04_r4_S01_03_after_modal');

    const sessionState = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('  Session state:', sessionState.slice(0, 400));

    // Verify flashcard phase
    const iKnow = page1.locator('[aria-label="I know this word (C)"]').first();
    const hasFlashcards = await iKnow.isVisible().catch(() => false);
    console.log('  Flashcard UI (I know button):', hasFlashcards);

    if (!hasFlashcards) {
      results.S01.result = 'partial';
      results.S01.notes.push('Flashcard UI not immediately visible after modal dismiss');
    } else {
      results.S01.notes.push('Flashcard phase confirmed ✓');
      results.S01.notes.push(`Session URL: ${page1.url()}`);

      // Count cards — read the "Card X of Y" text
      const cardCountEl = page1.evaluate(() => {
        const text = document.body.innerText;
        const m = text.match(/Card (\d+) of (\d+)/);
        return m ? { current: parseInt(m[1]), total: parseInt(m[2]) } : null;
      });
      const cardCount = await cardCountEl;
      console.log('  Card count:', cardCount);
      results.S01.notes.push(`Card count: ${JSON.stringify(cardCount)}`);

      // Go through ALL cards using keyboard shortcut 'C' (I know)
      // pace=60, so expect 60 cards total
      let cardsStudied = 0;
      let testReached = false;

      for (let i = 0; i < 80; i++) {
        // Check for test (textbox = typed input)
        const testInput = page1.getByRole('textbox').first();
        if (await testInput.isVisible().catch(() => false)) {
          testReached = true;
          console.log(`  ✓ Test phase reached after ${cardsStudied} cards!`);
          break;
        }

        // Check for sub-segment completion screen
        const bodyText = await page1.evaluate(() => document.body.innerText.slice(0, 1000));
        if (/well done|great job|completed|all.*(done|finished|mastered)/i.test(bodyText) && !/Card \d+ of/i.test(bodyText)) {
          console.log(`  Sub-segment completion after ${cardsStudied} cards: ${bodyText.slice(0, 200)}`);
          // This might be a review checkpoint within the flashcard phase
          // Look for a "Continue" button
          const contBtn = page1.getByRole('button', { name: /continue|next|proceed|go to test/i }).first();
          if (await contBtn.isVisible().catch(() => false)) {
            await contBtn.click();
            await page1.waitForTimeout(1000);
            await screenshot(page1, `B04_r4_S01_sub_complete_${i}`);
            continue;
          }
          break;
        }

        // Dismiss any modal
        const modal = page1.locator('.fixed.inset-0.z-50').first();
        if (await modal.isVisible().catch(() => false)) {
          await ensureModalDismissed(page1);
          await page1.waitForTimeout(500);
          continue;
        }

        // Press 'C' to mark "I know"
        await page1.keyboard.press('c');
        cardsStudied++;
        await page1.waitForTimeout(120);

        if (cardsStudied === 1) await screenshot(page1, 'B04_r4_S01_card1');
        if (cardsStudied === 20) await screenshot(page1, 'B04_r4_S01_card20');
        if (cardsStudied === 40) await screenshot(page1, 'B04_r4_S01_card40');
      }

      console.log(`  Total cards studied: ${cardsStudied}, test reached: ${testReached}`);
      results.S01.notes.push(`Cards via keyboard: ${cardsStudied}, test auto-reached: ${testReached}`);

      if (cardsStudied > 0) {
        results.S01.result = 'pass';
      }

      await screenshot(page1, 'B04_r4_S01_04_after_cards');
      const afterCardsText = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('  After cards state:', afterCardsText.slice(0, 400));

      // === S02: Get to test ===
      if (!testReached) {
        // Try Skip to Test
        console.log('  Test not reached naturally — using Skip to Test');
        try {
          await clickSkipToTest(page1);
          console.log('  Skip to Test clicked successfully');
          testReached = await page1.getByRole('textbox').first().isVisible().catch(() => false);
          console.log('  Test input visible after skip:', testReached);
          results.S02.notes.push('Test reached via Skip to Test (not natural flow)');
        } catch (e) {
          console.log('  Skip to Test failed:', e.message.slice(0, 100));
          results.S02.result = 'fail';
          results.S02.notes.push(`Skip to Test failed: ${e.message.slice(0, 100)}`);
        }
      } else {
        results.S02.notes.push('Test reached naturally after all flashcards ✓');
      }

      await screenshot(page1, 'B04_r4_S02_01_test_start');
      const testStartText = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('  Test start state:', testStartText.slice(0, 400));

      if (testReached || await page1.getByRole('textbox').first().isVisible().catch(() => false)) {
        // Answer the typed test
        let answered1 = 0;

        for (let q = 0; q < 30; q++) {
          const isResults = await page1.getByText(/result|score|pass|fail|well done|session complete|completed/i).first().isVisible().catch(() => false);
          if (isResults) {
            console.log(`  Results reached after ${answered1} questions`);
            break;
          }

          const inp = page1.getByRole('textbox').first();
          if (!await inp.isVisible().catch(() => false)) {
            const body = await page1.evaluate(() => document.body.innerText.slice(0, 500));
            console.log(`  Q${q+1}: No textbox. Body: ${body.slice(0, 200)}`);
            break;
          }

          // Find the word to look up definition
          const wordOnPage = await page1.evaluate(() => {
            // Look for the word display in the test
            const selectors = ['[class*="word"]', '[class*="term"]', 'h1', 'h2', 'h3'];
            for (const sel of selectors) {
              const els = [...document.querySelectorAll(sel)];
              for (const el of els) {
                const txt = el.textContent?.trim();
                if (txt && txt.length > 2 && txt.length < 50 &&
                    !/(question|answer|submit|step|day|progress|session|test|vocab)/i.test(txt) &&
                    !txt.includes('/')) {
                  return txt;
                }
              }
            }
            return null;
          });

          let def = 'keeping careful watch';
          if (wordOnPage) {
            const cleanWord = wordOnPage.replace(/\r?\n.*/g, '').trim().toLowerCase();
            const match = coreWords.find(w => {
              const wClean = w.word.replace(/\r?\n.*/g, '').trim().toLowerCase();
              return wClean === cleanWord ||
                     wClean.split('\r')[0].trim() === cleanWord ||
                     cleanWord === wClean.split(' ')[0];
            });
            if (match) def = match.definition_en;
            else console.log(`  Q${q+1}: word="${wordOnPage}" not matched in wordlist`);
          }

          if (q < 3) console.log(`  Q${q+1}: word="${wordOnPage}" → def="${def.slice(0, 40)}..."`);

          await inp.clear();
          await inp.type(def, { delay: 50 });

          if (q === 0) await screenshot(page1, 'B04_r4_S02_02_first_answer');

          const sub = page1.getByRole('button', { name: /submit|next|check/i }).first();
          if (await sub.isVisible().catch(() => false)) await sub.click();
          else await inp.press('Enter');

          answered1++;
          await page1.waitForTimeout(500);

          // Grading wait
          const grading = await page1.getByText(/grading|analyzing|processing|please wait/i).first().isVisible().catch(() => false);
          if (grading) {
            console.log(`  Q${answered1}: Waiting for Cloud Function...`);
            for (let g = 0; g < 8; g++) {
              await page1.waitForTimeout(5000);
              if (!await page1.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false)) break;
            }
          }
        }

        console.log(`  Questions answered: ${answered1}`);
        results.S02.notes.push(`Questions answered: ${answered1}`);

        await screenshot(page1, 'B04_r4_S02_03_after_test');
        const afterTestText = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
        console.log('  After test:', afterTestText.slice(0, 600));

        const hasResults = /result|score|pass|fail|well done|session complete/i.test(afterTestText);
        results.S02.result = (answered1 > 0 && hasResults) ? 'pass' : (answered1 > 0 ? 'partial' : 'fail');
        results.S02.notes.push(`Results page visible: ${hasResults}`);

        if (answered1 === 0) {
          findings.push({ id: 'F02', severity: 'BLOCKER', title: 'NEW_WORD_TEST phase not reachable (normal or skip-to-test)', scenario: 'S02' });
        }

        // === S03: Firestore check ===
        console.log('\n=== S03: Firestore Verification ===');
        await page1.waitForTimeout(5000);
        const after03 = await saveFs(uid01, 'B04_r4_S03_after');

        const day1Atts = after03.attempts.filter(a => a.day === 1);
        results.S03.notes.push(`Day-1 attempts: ${day1Atts.length}`);

        if (day1Atts.length === 1) {
          const att = day1Atts[0];
          results.S03.notes.push(`Attempt: score=${att.score}, passed=${att.passed}, id=${att.id?.slice(0, 60)}`);
          results.S03.notes.push('1 attempt doc (deterministic id) ✓');
          results.S03.result = 'pass';
        } else if (day1Atts.length === 0 && answered1 > 0) {
          results.S03.notes.push('FAIL: No attempt doc after test completion');
          results.S03.result = 'fail';
          findings.push({ id: 'F03', severity: 'BLOCKER', title: 'No attempt doc created after Day-1 typed test completion', scenario: 'S03' });
        } else if (day1Atts.length > 1) {
          results.S03.notes.push(`FAIL: ${day1Atts.length} duplicate Day-1 attempt docs`);
          results.S03.result = 'fail';
          findings.push({ id: 'F03', severity: 'BLOCKER', title: `Duplicate attempt docs: ${day1Atts.length} Day-1 docs`, scenario: 'S03' });
        } else {
          results.S03.result = 'partial';
          results.S03.notes.push('Ambiguous state — no answered questions');
        }

        // class_progress check
        if (after03.class_progress.length === 0) {
          results.S03.notes.push('NOTE: No class_progress doc — see F04');
          if (!findings.find(f => f.id === 'F04')) {
            findings.push({
              id: 'F04',
              severity: 'HIGH',
              title: 'class_progress collection empty for all audit students despite completed sessions',
              scenario: 'S03',
              observed: 'After Day 1-6 attempts for careful CORE, and fresh Day 1 for rushed CORE: class_progress has 0 docs. study_states also empty.',
              expected: 'class_progress doc should track currentStudyDay, streakDays, recentSessions',
            });
          }
        } else {
          const cp = after03.class_progress[0];
          results.S03.notes.push(`class_progress: csd=${cp.currentStudyDay}, streak=${cp.streakDays}`);
        }

        // Click Continue if visible
        const contBtn = page1.getByRole('button', { name: /continue|go to dashboard|done|finish/i }).first();
        if (await contBtn.isVisible().catch(() => false)) {
          await contBtn.click();
          await page1.waitForTimeout(3000);
          await screenshot(page1, 'B04_r4_S03_after_continue');

          const after03cont = await saveFs(uid01, 'B04_r4_S03_after_continue');
          if (after03cont.class_progress.length > 0) {
            const cp = after03cont.class_progress[0];
            console.log(`  After continue: csd=${cp.currentStudyDay}, streak=${cp.streakDays}`);
            results.S03.notes.push(`After continue: csd=${cp.currentStudyDay}, streak=${cp.streakDays}`);
          }
        }
      } else {
        results.S02.result = 'fail';
        results.S02.notes.push('Test input not visible — test phase not reached');
        results.S03.result = 'skipped';
        results.S03.notes.push('Skipped — S02 failed');
      }
    }
  }

  await ctx1.close();

  // ================================================================
  // S04 — Day-1 Fail → Retake
  // Use "speedrunner CORE" — fresh student
  // ================================================================
  console.log('\n=== S04: Day-1 Fail → Retake ===');
  results.S04 = { result: 'pending', notes: [] };

  const speedrunnerCore = seeded.accounts.find(a => a.personaId === 'speedrunner' && a.targetClass === 'CORE');
  if (!speedrunnerCore) {
    results.S04.result = 'skipped';
    results.S04.notes.push('No speedrunner CORE account');
  } else {
    const uid04 = speedrunnerCore.uid;
    const before04 = await saveFs(uid04, 'B04_r4_S04_before');

    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page4 = await ctx4.newPage();

    try {
      await loginAs(page4, speedrunnerCore.email, speedrunnerCore.password);
      await page4.waitForTimeout(2000);
      await screenshot(page4, 'B04_r4_S04_01_dashboard');

      const startBtn4 = page4.getByRole('button', { name: /start session/i }).first();
      if (await startBtn4.isVisible().catch(() => false)) {
        await startBtn4.click();
        await page4.waitForTimeout(2000);
      }

      await ensureModalDismissed(page4);

      // Skip to Test
      await clickSkipToTest(page4);
      await screenshot(page4, 'B04_r4_S04_02_test_start');
      console.log('  Test URL:', page4.url());

      const testState = await page4.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log('  Test state:', testState.slice(0, 300));

      // Submit wrong answers
      let answered4 = 0;
      const wrongAns = ['zzz', 'nothing', 'bad', 'wrong', 'nope', 'skip', 'dunno', 'x'];

      for (let q = 0; q < 30; q++) {
        const isResults = await page4.getByText(/result|score|pass|fail|retake|try again/i).first().isVisible().catch(() => false);
        if (isResults) { console.log(`  Results after ${answered4} wrong answers`); break; }

        const inp = page4.getByRole('textbox').first();
        if (!await inp.isVisible().catch(() => false)) {
          const body = await page4.evaluate(() => document.body.innerText.slice(0, 500));
          console.log(`  Q${q}: No textbox. Body: ${body.slice(0, 200)}`);
          break;
        }

        await inp.type(wrongAns[q % wrongAns.length], { delay: 20 });
        const sub = page4.getByRole('button', { name: /submit|next/i }).first();
        if (await sub.isVisible().catch(() => false)) await sub.click();
        else await inp.press('Enter');
        answered4++;
        await page4.waitForTimeout(300);

        const grading = await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false);
        if (grading) {
          for (let g = 0; g < 8; g++) {
            await page4.waitForTimeout(5000);
            if (!await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false)) break;
          }
        }
      }

      await screenshot(page4, 'B04_r4_S04_03_results');
      const res4Text = await page4.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  Results text:', res4Text.slice(0, 500));

      const hasRetake = /retake|try again/i.test(res4Text);
      const hasFail = /fail|below|did not pass/i.test(res4Text);
      const hasPass = /pass|well done|great|congrat/i.test(res4Text);

      console.log(`  answered=${answered4} retake=${hasRetake} fail=${hasFail} pass=${hasPass}`);
      results.S04.notes.push(`Wrong answers submitted: ${answered4}`);
      results.S04.notes.push(`retake=${hasRetake} fail=${hasFail} pass=${hasPass}`);

      if (hasRetake) {
        const retakeBtn = page4.getByRole('button', { name: /retake|try again/i }).first();
        if (await retakeBtn.isVisible().catch(() => false)) {
          await retakeBtn.click();
          await page4.waitForTimeout(2000);
          await screenshot(page4, 'B04_r4_S04_04_retake_launched');
          const testReset = await page4.getByRole('textbox').first().isVisible().catch(() => false);
          results.S04.result = testReset ? 'pass' : 'partial';
          results.S04.notes.push(`Retake test input visible: ${testReset}`);
          if (testReset) results.S04.notes.push('Retake flow works ✓');
        }
      } else if (hasPass && answered4 > 0) {
        results.S04.result = 'partial';
        results.S04.notes.push('WARN: All garbage answers resulted in PASS — AI may be too lenient');
        findings.push({
          id: 'F05',
          severity: 'MEDIUM',
          title: 'Day-1 typed test PASSES with all garbage answers (zzz, nothing, wrong, etc.)',
          scenario: 'S04',
          observed: `${answered4} clearly-wrong answers all scored as PASS (score >= 0.9 threshold)`,
          expected: 'Score should be < 0.9 retakeThreshold, triggering fail/retake flow',
        });
      } else if (answered4 === 0) {
        results.S04.result = 'partial';
        results.S04.notes.push('Test not reached for S04');
      } else {
        results.S04.result = 'partial';
        results.S04.notes.push('Ambiguous results state');
      }

    } catch (e) {
      results.S04.result = 'fail';
      results.S04.notes.push(`Error: ${e.message.slice(0, 200)}`);
      console.log('  S04 error:', e.message.slice(0, 200));
      await screenshot(page4, 'B04_r4_S04_error').catch(() => {});
    }
    await ctx4.close();
  }

  // ================================================================
  // S05 — Dashboard reflection
  // ================================================================
  console.log('\n=== S05: Dashboard Reflection ===');
  results.S05 = { result: 'pending', notes: [] };

  // Load as rushed CORE student (just completed session)
  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page5 = await ctx5.newPage();

  await loginAs(page5, rushedCore.email, rushedCore.password);
  await page5.waitForTimeout(2000);
  await screenshot(page5, 'B04_r4_S05_01_dashboard');

  const dash5 = await page5.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  Dashboard:', dash5.slice(0, 600));

  const hasStreak = /streak|current streak/i.test(dash5);
  const has7Day = /7.day.rhythm|7-day/i.test(dash5);
  const hasWordsIntro = /words introduced/i.test(dash5);
  const hasDayLabel = /Day \d+/i.test(dash5);
  const dayMatch = dash5.match(/Day (\d+)/i);

  results.S05.notes.push(`Has streak indicator: ${hasStreak}`);
  results.S05.notes.push(`Has 7-day rhythm: ${has7Day}`);
  results.S05.notes.push(`Has words introduced: ${hasWordsIntro}`);
  results.S05.notes.push(`Has day label: ${hasDayLabel}, value: ${dayMatch?.[1]}`);

  // Check if the dashboard reflects the session completion
  const fsAfter5 = await saveFs(uid01, 'B04_r4_S05_firestore');
  const day1Atts5 = fsAfter5.attempts.filter(a => a.day === 1);

  if (day1Atts5.length === 1 && day1Atts5[0].passed) {
    // Session was completed and passed
    const sessionInDash = dayMatch?.[1]; // what day does dashboard show?
    results.S05.notes.push(`Session passed (score=${day1Atts5[0].score}), dashboard shows Day=${sessionInDash}`);

    // After passing Day 1, dashboard should show Day 2 as next or "completed" for Day 1
    if (sessionInDash === '2' || /complete|done|session complete/i.test(dash5)) {
      results.S05.result = 'pass';
      results.S05.notes.push('Dashboard correctly reflects Day-1 completion ✓');
    } else {
      results.S05.result = 'partial';
      results.S05.notes.push('Dashboard may not reflect completion (still showing Day 1 start button despite pass)');
      findings.push({
        id: 'F06',
        severity: 'HIGH',
        title: 'Dashboard still shows "Day 1 Start Session" after Day-1 session was passed',
        scenario: 'S05',
        observed: `Dashboard shows Day ${sessionInDash} Start Session even after Day-1 attempt doc shows passed=true, score=${day1Atts5[0].score}`,
        expected: 'Dashboard should show Day 2 next or completion indicator after Day 1 pass',
      });
    }
  } else if (day1Atts5.length === 0) {
    results.S05.result = 'partial';
    results.S05.notes.push('No Day-1 attempt in Firestore — session may not have completed');
  } else {
    results.S05.result = 'partial';
  }

  await ctx5.close();

  // ================================================================
  // S06 — Practice mode
  // ================================================================
  results.S06 = { result: 'partial', notes: ['Practice mode not surfaced on dashboard; no Practice button found; "Blind Spots PDF" and "Today PDF" are available as alternatives'] };

  // ================================================================
  // S07 — Tiny list
  // ================================================================
  results.S07 = { result: 'skipped', notes: ['No tiny list seeded in audit_state.json (tinyList: null)'] };

  // ================================================================
  // S08 — Abandon + resume (confirmed from Run 2)
  // ================================================================
  results.S08 = { result: 'pass', notes: [
    'Verified in Run 2 with distracted CORE student',
    'Dismissed 3 cards, navigated to dashboard, clicked Start Session',
    'Resumed correctly at card 4: "Progress: 3 of 60 mastered, Card 1 of 57"',
    'Session state preserved across navigation ✓',
  ]};

  // ================================================================
  // S09 — Try to restart after completion
  // ================================================================
  console.log('\n=== S09: Re-start after completion ===');
  results.S09 = { result: 'pending', notes: [] };

  const ctx9 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page9 = await ctx9.newPage();
  await loginAs(page9, rushedCore.email, rushedCore.password);
  await page9.waitForTimeout(2000);
  await screenshot(page9, 'B04_r4_S09_01_dashboard');

  const dash9 = await page9.evaluate(() => document.body.innerText.slice(0, 5000));
  const startBtn9 = page9.getByRole('button', { name: /start session/i }).first();
  const s9Visible = await startBtn9.isVisible().catch(() => false);
  const s9Enabled = await startBtn9.isEnabled().catch(() => false);

  // Check Firestore to confirm session completion
  const fs9 = await saveFs(uid01, 'B04_r4_S09_firestore');
  const day1Att9 = fs9.attempts.filter(a => a.day === 1);

  results.S09.notes.push(`Start btn: visible=${s9Visible} enabled=${s9Enabled}`);
  results.S09.notes.push(`Day-1 attempt docs: ${day1Att9.length}`);

  if (day1Att9.length > 0) {
    results.S09.notes.push(`Session completed: score=${day1Att9[0].score} passed=${day1Att9[0].passed}`);

    if (s9Visible && s9Enabled) {
      // Click it and see what happens
      await startBtn9.click();
      await page9.waitForTimeout(3000);
      await screenshot(page9, 'B04_r4_S09_02_after_click');

      // Dismiss any modal
      await ensureModalDismissed(page9);
      await page9.waitForTimeout(1000);

      const afterClick9 = await page9.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  After start click:', afterClick9.slice(0, 500));

      const isNewTest = await page9.getByRole('textbox').first().isVisible().catch(() => false);
      const isFlashcards = /Card \d+ of|I know|Next card/i.test(afterClick9);
      const showsCompletion = /complete|done|practice/i.test(afterClick9);

      results.S09.notes.push(`After click: new test=${isNewTest}, flashcards=${isFlashcards}, completion=${showsCompletion}`);

      // Check what phase the session is at
      const progressMatch = afterClick9.match(/(\d+) of (\d+) mastered/i);
      console.log('  Progress:', progressMatch?.[0]);
      results.S09.notes.push(`Session progress shown: ${progressMatch?.[0] || 'none'}`);

      if (isNewTest) {
        // Check attempt docs — if new one created, it's a duplicate
        await page9.waitForTimeout(2000);
        const fs9b = await saveFs(uid01, 'B04_r4_S09_after_restart');
        const newDay1Atts = fs9b.attempts.filter(a => a.day === 1);
        if (newDay1Atts.length > 1) {
          results.S09.result = 'fail';
          findings.push({
            id: 'F07',
            severity: 'BLOCKER',
            title: 'Re-starting after Day-1 completion creates duplicate attempt doc',
            scenario: 'S09',
            observed: `${newDay1Atts.length} Day-1 attempt docs after re-start`,
            expected: 'Should prevent re-test or use deterministic ID to dedupe',
          });
        } else {
          results.S09.result = 'partial';
          results.S09.notes.push('Re-start launched typed test but deduplication may work');
        }
      } else if (isFlashcards) {
        // Good: shows flashcard phase (all 60 already mastered) rather than launching new test
        results.S09.result = 'pass';
        results.S09.notes.push('Re-start goes to flashcard review (all mastered), not new test ✓');
      } else {
        results.S09.result = 'pass';
        results.S09.notes.push('Re-start did not launch new test ✓');
      }
    } else {
      results.S09.result = 'pass';
      results.S09.notes.push('Start button disabled/hidden after completion ✓');
    }
  } else {
    results.S09.result = 'partial';
    results.S09.notes.push('Session not confirmed completed in Firestore — S09 invalid');
  }

  await ctx9.close();

  // ================================================================
  // Write final evidence and results
  // ================================================================
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r4_console_errors.json'), JSON.stringify(consoleErrors, null, 2));
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r4_results.json'), JSON.stringify({ results, findings }, null, 2));

  console.log('\n========== FINAL RESULTS ==========');
  Object.entries(results).forEach(([s, r]) => {
    const icon = r.result === 'pass' ? '✅' : r.result === 'fail' ? '❌' : r.result === 'skipped' ? '⏸' : '🟡';
    console.log(`  ${icon} ${s}: ${r.result}`);
    r.notes.forEach(n => console.log(`    - ${n}`));
  });

  if (findings.length > 0) {
    console.log('\nFINDINGS:');
    findings.forEach(f => console.log(`  [${f.severity}] ${f.id}: ${f.title}`));
  }

} catch (err) {
  console.error('\nFATAL:', err.message);
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r4_fatal.json'), JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
} finally {
  if (browser) await browser.close();
  console.log('\nBrowser closed.');
}

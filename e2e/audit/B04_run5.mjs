/**
 * B04 Run 5 — Final focused test
 * Key observations from prior runs:
 *  1. After all flashcards: "All cards reviewed! You're ready. Take Test" button appears
 *  2. Typed test is at /typedtest/ URL, shows ALL words at once (not one-by-one)
 *     → submit button may be at BOTTOM after all answers filled
 *  3. Session menu changes in "all reviewed" state — no longer shows "Skip to Test"
 *  4. S04: speedrunner CORE — test page, need to scroll and fill all answers then submit
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
const coreWords = auditState.lists.coreActiveList.words;

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
    await startStudying.click({ force: true });
    await page.waitForTimeout(600);
    return true;
  }
  const modal = page.locator('.fixed.inset-0.z-50').first();
  if (await modal.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  return false;
}

async function getFirestoreState(uid) {
  const [cp, ss, att] = await Promise.all([
    db.collection('class_progress').where('studentId', '==', uid).get(),
    db.collection('study_states').where('studentId', '==', uid).get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
  ]);
  return {
    class_progress: cp.docs.map(d => ({ id: d.id, ...d.data() })),
    study_states: ss.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts: att.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

async function saveFs(uid, label) {
  const state = await getFirestoreState(uid);
  writeFileSync(path.join(EVIDENCE_DIR, `${label}.json`), JSON.stringify(state, null, 2));
  console.log(`  💾 ${label}.json (cp:${state.class_progress.length} ss:${state.study_states.length} att:${state.attempts.length})`);
  return state;
}

// Fill ALL textboxes on a typed test page (all-at-once format)
// Returns number of answers filled
async function fillTypedTestAllAtOnce(page, wordList, answerMode = 'correct') {
  await page.waitForTimeout(1000);

  // Get all question items on the page
  const questionItems = await page.locator('[data-question-index], li, .question-item').all();

  // Actually, let's find all textboxes on the page
  const allInputs = await page.locator('input[type="text"], textarea').all();
  console.log(`  Found ${allInputs.length} answer inputs`);

  if (allInputs.length === 0) {
    // Check page structure
    const body = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('  Test page body:', body.slice(0, 500));
    return 0;
  }

  // Get word labels for each input (they should be labeled by the word)
  let filled = 0;
  for (let i = 0; i < allInputs.length; i++) {
    const inp = allInputs[i];
    if (!await inp.isVisible().catch(() => false)) continue;

    // Find the associated word label
    const wordLabel = await inp.evaluate(el => {
      // Try to find closest label/word display
      const parent = el.closest('li, div, section, article');
      if (!parent) return null;
      const texts = parent.querySelectorAll('span, h3, h4, div, p');
      for (const t of texts) {
        const txt = t.textContent?.trim();
        if (txt && txt.length > 1 && txt.length < 60 &&
            !/(n\.|v\.|adj\.|adv\.|type|answer|question|submit)/i.test(txt)) {
          return txt;
        }
      }
      return null;
    });

    let answer = 'friendship';
    if (answerMode === 'correct' && wordLabel) {
      const cleanWord = wordLabel.replace(/\r?\n.*/g, '').trim().toLowerCase();
      const match = wordList.find(w => {
        const wClean = w.word.replace(/\r?\n.*/g, '').trim().toLowerCase();
        return wClean === cleanWord || wClean.split('\r')[0].trim() === cleanWord ||
               cleanWord === wClean.split(' ')[0];
      });
      if (match) answer = match.definition_en;
      if (i < 3) console.log(`  Input ${i}: word="${wordLabel}" → "${answer.slice(0, 40)}..."`);
    } else if (answerMode === 'wrong') {
      answer = ['zzz', 'nothing', 'bad answer', 'wrong', 'nope'][i % 5];
      if (i < 3) console.log(`  Input ${i}: wrong="${answer}"`);
    }

    await inp.scrollIntoViewIfNeeded();
    await inp.clear();
    await inp.type(answer, { delay: 30 });
    filled++;
  }

  console.log(`  Filled ${filled} answers`);
  return filled;
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

  // ================================================================
  // S01+S02+S03 NORMAL FLOW using "Take Test" button
  // ================================================================
  console.log('\n=== S01+S02+S03: Normal Happy Path ===');
  const rushedCore = seeded.accounts.find(a => a.personaId === 'rushed' && a.targetClass === 'CORE');
  const uid01 = rushedCore.uid;
  const before01 = await saveFs(uid01, 'B04_r5_S01_before');
  console.log(`  Student: ${rushedCore.email}, att=${before01.attempts.length}`);

  results.S01 = { result: 'pending', notes: [] };
  results.S02 = { result: 'pending', notes: [] };
  results.S03 = { result: 'pending', notes: [] };

  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page1 = await ctx1.newPage();
  page1.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ src: 'S01-03', text: msg.text() }); });

  await loginAs(page1, rushedCore.email, rushedCore.password);
  await page1.waitForTimeout(2000);
  await screenshot(page1, 'B04_r5_S01_dashboard');

  const startBtn1 = page1.getByRole('button', { name: /start session/i }).first();
  if (!await startBtn1.isVisible().catch(() => false)) {
    results.S01.result = 'fail';
    results.S01.notes.push('No Start Session button on Day-1 dashboard');
    findings.push({ id: 'F01', severity: 'BLOCKER', title: 'Start Session button missing', scenario: 'S01' });
  } else {
    await startBtn1.click();
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'B04_r5_S01_session_start');
    console.log('  Session URL:', page1.url());

    // Dismiss customize modal
    await dismissModal(page1);
    await page1.waitForTimeout(1000);

    // Verify flashcard phase
    const iKnow1 = page1.locator('[aria-label="I know this word (C)"]').first();
    const hasCards = await iKnow1.isVisible().catch(() => false);
    console.log('  I Know button visible:', hasCards);

    if (!hasCards) {
      const body = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('  After modal:', body.slice(0, 400));
      results.S01.result = 'partial';
      results.S01.notes.push('Flashcard UI not visible after modal dismiss');
    } else {
      results.S01.notes.push('Flashcard phase confirmed: I Know button visible ✓');
      results.S01.notes.push(`Session URL: ${page1.url()}`);

      // Go through cards using keyboard
      let cardsStudied = 0;
      let takeTestVisible = false;

      for (let i = 0; i < 90; i++) {
        // Check for "Take Test" button (appears after all cards reviewed)
        const takeTest = page1.getByRole('button', { name: /take test/i }).first();
        if (await takeTest.isVisible().catch(() => false)) {
          takeTestVisible = true;
          console.log(`  "Take Test" button appeared after ${cardsStudied} cards`);
          break;
        }

        // Check if test already started
        const url = page1.url();
        if (url.includes('/typedtest/')) {
          console.log(`  Test URL detected after ${cardsStudied} cards`);
          break;
        }

        // Dismiss any overlay
        const modal = page1.locator('.fixed.inset-0.z-50').first();
        if (await modal.isVisible().catch(() => false)) {
          await dismissModal(page1);
          await page1.waitForTimeout(400);
          continue;
        }

        // Press C = I Know
        await page1.keyboard.press('c');
        cardsStudied++;
        await page1.waitForTimeout(120);

        if (cardsStudied === 1) await screenshot(page1, 'B04_r5_S01_card1');
        if (cardsStudied === 30) await screenshot(page1, 'B04_r5_S01_card30');
        if (cardsStudied === 60) await screenshot(page1, 'B04_r5_S01_card60');
      }

      console.log(`  Cards studied: ${cardsStudied}, Take Test visible: ${takeTestVisible}`);
      results.S01.notes.push(`Cards studied: ${cardsStudied}`);
      results.S01.notes.push(`"Take Test" button appeared: ${takeTestVisible}`);

      await screenshot(page1, 'B04_r5_S01_after_cards');
      const afterCardsText = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('  After cards state:', afterCardsText.slice(0, 400));

      results.S01.result = cardsStudied > 0 ? 'pass' : 'partial';

      if (takeTestVisible) {
        // Click Take Test — this is the NORMAL FLOW (S01→S02 transition)
        const takeTestBtn = page1.getByRole('button', { name: /take test/i }).first();
        await takeTestBtn.click();
        await page1.waitForTimeout(3000);
        await screenshot(page1, 'B04_r5_S02_test_start');

        console.log('  After Take Test URL:', page1.url());
        results.S01.notes.push('Clicked "Take Test" — moved to test phase ✓');
      } else {
        // Try navigating directly to typedtest URL
        const sessionUrl = page1.url();
        const matches = sessionUrl.match(/\/session\/([^\/]+)\/([^\/]+)/);
        if (matches) {
          const classId = matches[1];
          const listId = matches[2];
          const testUrl = `${BASE_URL}/typedtest/${classId}/${listId}`;
          console.log(`  Navigating to test: ${testUrl}`);
          await page1.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page1.waitForTimeout(2000);
          await screenshot(page1, 'B04_r5_S02_direct_nav');
        }
      }

      // === S02: Fill typed test ===
      console.log('\n=== S02: Fill Typed Test ===');
      const testUrl1 = page1.url();
      const isTypedTestUrl = testUrl1.includes('/typedtest/');
      console.log('  On typed test URL:', isTypedTestUrl, testUrl1);

      if (isTypedTestUrl) {
        await page1.waitForTimeout(2000);
        const testText = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
        console.log('  Test page:', testText.slice(0, 600));

        // Check for all-at-once inputs
        const allInputs = await page1.locator('input[type="text"], textarea').count();
        console.log(`  Answer inputs found: ${allInputs}`);

        if (allInputs > 0) {
          const filled = await fillTypedTestAllAtOnce(page1, coreWords, 'correct');
          results.S02.notes.push(`Filled ${filled} answers`);
          await screenshot(page1, 'B04_r5_S02_filled');

          if (filled > 0) {
            // Find and click Submit at the bottom of the page
            await page1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page1.waitForTimeout(1000);
            await screenshot(page1, 'B04_r5_S02_bottom');

            // Look for Submit button
            const submitArea = await page1.evaluate(() => document.body.innerText.slice(-1000));
            console.log('  Bottom of page:', submitArea);

            const submitBtn = page1.getByRole('button', { name: /submit|finish test|complete|done/i }).first();
            const submitVis = await submitBtn.isVisible().catch(() => false);
            console.log('  Submit button visible:', submitVis);

            if (!submitVis) {
              // Try any button in the lower portion
              const allBtns = await page1.locator('button').all();
              for (const btn of allBtns) {
                const txt = await btn.textContent().catch(() => '');
                if (/submit|finish|complete|done|save/i.test(txt)) {
                  console.log(`  Found submit-like button: "${txt.trim()}"`);
                  await btn.scrollIntoViewIfNeeded();
                  await btn.click().catch(() => {});
                  break;
                }
              }
            } else {
              await submitBtn.scrollIntoViewIfNeeded();
              await submitBtn.click();
            }

            await page1.waitForTimeout(5000); // wait for grading

            // Check for grading in progress
            for (let g = 0; g < 12; g++) {
              const grading = await page1.getByText(/grading|analyzing|processing|please wait/i).first().isVisible().catch(() => false);
              if (!grading) break;
              console.log(`  Grading in progress... (${g+1})`);
              await page1.waitForTimeout(5000);
            }

            await screenshot(page1, 'B04_r5_S02_after_submit');
            const afterSubmit = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
            console.log('  After submit:', afterSubmit.slice(0, 600));

            const hasResults = /result|score|pass|fail|well done|session complete/i.test(afterSubmit);
            results.S02.result = hasResults ? 'pass' : 'partial';
            results.S02.notes.push(`Results visible after submit: ${hasResults}`);
            results.S02.notes.push(`After submit URL: ${page1.url()}`);

            // === S03: Firestore ===
            console.log('\n=== S03: Firestore Verification ===');
            await page1.waitForTimeout(5000);
            const after03 = await saveFs(uid01, 'B04_r5_S03_after');

            const day1Atts = after03.attempts.filter(a => a.day === 1);
            results.S03.notes.push(`Day-1 attempt docs: ${day1Atts.length}`);

            if (day1Atts.length === 1) {
              const att = day1Atts[0];
              results.S03.notes.push(`score=${att.score} passed=${att.passed} id=${att.id?.slice(0, 60)}`);
              results.S03.notes.push('Deterministic attempt doc ✓');
              results.S03.result = 'pass';

              if (att.score >= 90) results.S03.notes.push(`Score ${att.score}% ≥ 90% threshold ✓`);
            } else if (day1Atts.length === 0 && filled > 0) {
              results.S03.result = 'fail';
              results.S03.notes.push('No attempt doc created');
              findings.push({ id: 'F03', severity: 'BLOCKER', title: 'No attempt doc created after test submission', scenario: 'S03' });
            } else if (day1Atts.length > 1) {
              results.S03.result = 'fail';
              results.S03.notes.push(`${day1Atts.length} attempt docs — duplicate!`);
              findings.push({ id: 'F03', severity: 'BLOCKER', title: `${day1Atts.length} duplicate Day-1 attempt docs`, scenario: 'S03' });
            } else {
              results.S03.result = 'partial';
            }

            // class_progress
            if (after03.class_progress.length === 0) {
              results.S03.notes.push('NOTE: class_progress empty');
              if (!findings.find(f => f.id === 'F04')) {
                findings.push({
                  id: 'F04',
                  severity: 'HIGH',
                  title: 'class_progress never populated despite sessions completing',
                  scenario: 'S03',
                  observed: 'All students (careful CORE with 12 attempts days 1-6; rushed CORE fresh) have 0 class_progress docs',
                  expected: 'class_progress should have currentStudyDay, streakDays, recentSessions after Day-1 pass',
                });
              }
            } else {
              const cp = after03.class_progress[0];
              results.S03.notes.push(`class_progress: csd=${cp.currentStudyDay} streak=${cp.streakDays}`);
            }

            // Click Continue
            const contBtn = page1.getByRole('button', { name: /continue|go to dashboard|done|finish/i }).first();
            if (await contBtn.isVisible().catch(() => false)) {
              await contBtn.click();
              await page1.waitForTimeout(3000);
              await screenshot(page1, 'B04_r5_S03_after_continue');
              const after03b = await saveFs(uid01, 'B04_r5_S03_after_continue');
              if (after03b.class_progress.length > 0) {
                const cp = after03b.class_progress[0];
                results.S03.notes.push(`After continue: csd=${cp.currentStudyDay} streak=${cp.streakDays}`);
              }
            }
          } else {
            results.S02.result = 'fail';
            results.S02.notes.push('No inputs filled — test format different than expected');
            findings.push({ id: 'F02', severity: 'BLOCKER', title: 'Typed test inputs not fillable', scenario: 'S02' });
            results.S03.result = 'skipped';
          }
        } else {
          // No textbox inputs — maybe MCQ or different format
          const testBodyText = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
          results.S02.result = 'fail';
          results.S02.notes.push(`No text inputs on typed test page. Body: ${testBodyText.slice(0, 200)}`);
          results.S03.result = 'skipped';
        }
      } else {
        results.S02.result = 'fail';
        results.S02.notes.push(`Not on typed test URL: ${testUrl1}`);
        results.S03.result = 'skipped';
      }
    }
  }

  await ctx1.close();

  // ================================================================
  // S04 — Day-1 Fail → Retake via speedrunner CORE
  // ================================================================
  console.log('\n=== S04: Fail → Retake ===');
  results.S04 = { result: 'pending', notes: [] };

  const speedrunnerCore = seeded.accounts.find(a => a.personaId === 'speedrunner' && a.targetClass === 'CORE');
  if (!speedrunnerCore) {
    results.S04.result = 'skipped';
    results.S04.notes.push('No speedrunner CORE account');
  } else {
    const uid04 = speedrunnerCore.uid;
    const before04 = await saveFs(uid04, 'B04_r5_S04_before');
    console.log(`  S04: ${speedrunnerCore.email}, att=${before04.attempts.length}`);

    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page4 = await ctx4.newPage();

    try {
      await loginAs(page4, speedrunnerCore.email, speedrunnerCore.password);
      await page4.waitForTimeout(2000);

      const startBtn4 = page4.getByRole('button', { name: /start session/i }).first();
      if (await startBtn4.isVisible().catch(() => false)) {
        await startBtn4.click();
        await page4.waitForTimeout(2000);
      }

      await dismissModal(page4);
      await page4.waitForTimeout(1000);

      // Open session menu → Skip to Test
      const menuBtn = page4.locator('[aria-label="Session menu"]').first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
        await page4.waitForTimeout(500);
        await screenshot(page4, 'B04_r5_S04_menu_open');

        const skipItem = page4.getByText('Skip to Test').first();
        if (await skipItem.isVisible().catch(() => false)) {
          await skipItem.click();
          await page4.waitForTimeout(1000);

          // Confirm
          const confirmBtn = page4.getByRole('button', { name: /confirm|yes|skip|proceed|start test/i }).first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await page4.waitForTimeout(3000);
          }
        } else {
          await page4.keyboard.press('Escape');
          console.log('  "Skip to Test" not in menu');
        }
      }

      console.log('  After skip, URL:', page4.url());
      await screenshot(page4, 'B04_r5_S04_test_start');

      const testUrl4 = page4.url();
      const testText4 = await page4.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  Test state:', testText4.slice(0, 500));

      if (testUrl4.includes('/typedtest/') || testUrl4.includes('test')) {
        const allInputs4 = await page4.locator('input[type="text"], textarea').count();
        console.log(`  Answer inputs: ${allInputs4}`);

        if (allInputs4 > 0) {
          // Fill with wrong answers
          const filled4 = await fillTypedTestAllAtOnce(page4, coreWords, 'wrong');
          results.S04.notes.push(`Wrong answers filled: ${filled4}`);

          // Submit
          await page4.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page4.waitForTimeout(500);
          await screenshot(page4, 'B04_r5_S04_filled_wrong');

          const submitBtn4 = page4.getByRole('button', { name: /submit|finish test|complete|done/i }).first();
          if (await submitBtn4.isVisible().catch(() => false)) {
            await submitBtn4.click();
          } else {
            // Try any button at bottom
            const allBtns4 = await page4.locator('button').all();
            for (const btn of allBtns4) {
              const txt = await btn.textContent().catch(() => '');
              if (/submit|finish|complete/i.test(txt)) {
                await btn.scrollIntoViewIfNeeded();
                await btn.click().catch(() => {});
                break;
              }
            }
          }

          // Wait for grading
          for (let g = 0; g < 12; g++) {
            const grading = await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false);
            if (!grading) break;
            await page4.waitForTimeout(5000);
          }

          await screenshot(page4, 'B04_r5_S04_results');
          const res4Text = await page4.evaluate(() => document.body.innerText.slice(0, 3000));
          console.log('  Results after wrong answers:', res4Text.slice(0, 500));

          const hasRetake = /retake|try again/i.test(res4Text);
          const hasPass = /pass|well done|great/i.test(res4Text);
          const hasFail = /fail|below|did not pass/i.test(res4Text);

          results.S04.notes.push(`retake=${hasRetake} fail=${hasFail} pass=${hasPass}`);

          if (hasRetake) {
            const retakeBtn4 = page4.getByRole('button', { name: /retake|try again/i }).first();
            if (await retakeBtn4.isVisible().catch(() => false)) {
              await retakeBtn4.click();
              await page4.waitForTimeout(2000);
              await screenshot(page4, 'B04_r5_S04_retake_started');
              const retakeText = await page4.evaluate(() => document.body.innerText.slice(0, 1000));
              const testReset = retakeText.includes('typedtest') || await page4.locator('input[type="text"]').first().isVisible().catch(() => false);
              results.S04.result = testReset ? 'pass' : 'partial';
              results.S04.notes.push(`Retake launched: ${testReset} ✓`);
            }
          } else if (hasPass && filled4 > 0) {
            results.S04.result = 'partial';
            results.S04.notes.push('WARN: Garbage answers resulted in PASS — AI grader too lenient');
            findings.push({
              id: 'F05',
              severity: 'MEDIUM',
              title: 'Day-1 typed test passes with all-garbage answers (AI grader too lenient for nonsense)',
              scenario: 'S04',
              observed: `${filled4} answers like "zzz", "nothing", "bad answer" → PASS`,
              expected: 'Score < 0.9 retakeThreshold should trigger fail/retake',
            });
          } else if (filled4 === 0) {
            results.S04.result = 'partial';
            results.S04.notes.push('No answers filled — test input format unknown');
          } else {
            results.S04.result = 'partial';
            results.S04.notes.push(`Ambiguous results: ${res4Text.slice(0, 200)}`);
          }
        } else {
          results.S04.result = 'partial';
          results.S04.notes.push(`No inputs on test page. URL: ${testUrl4}`);
        }
      } else {
        results.S04.result = 'partial';
        results.S04.notes.push(`Not on test page. URL: ${testUrl4}`);
      }
    } catch (e) {
      results.S04.result = 'fail';
      results.S04.notes.push(`Error: ${e.message.slice(0, 200)}`);
      console.log('  S04 error:', e.message.slice(0, 200));
    }
    await ctx4.close();
  }

  // ================================================================
  // S05 — Dashboard reflection (careful CORE — many attempts)
  // ================================================================
  console.log('\n=== S05: Dashboard Reflection ===');
  results.S05 = { result: 'pending', notes: [] };

  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page5 = await ctx5.newPage();
  const carefulCore = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE');

  await loginAs(page5, carefulCore.email, carefulCore.password);
  await page5.waitForTimeout(2000);
  await screenshot(page5, 'B04_r5_S05_dashboard');

  const dash5 = await page5.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  Dashboard:', dash5.slice(0, 600));

  // Key dashboard metrics
  const hasWeeklyGoal = /weekly.?goals/i.test(dash5);
  const hasStreak = /current streak|streak/i.test(dash5);
  const has7DayRhythm = /7.day.rhythm/i.test(dash5);
  const hasWordsIntro = /words introduced/i.test(dash5);
  const hasMasteryRate = /mastery rate/i.test(dash5);
  const dayShown = dash5.match(/Day (\d+)/i)?.[1];

  results.S05.notes.push(`Weekly goals: ${hasWeeklyGoal}`);
  results.S05.notes.push(`Streak indicator: ${hasStreak}`);
  results.S05.notes.push(`7-day rhythm: ${has7DayRhythm}`);
  results.S05.notes.push(`Words introduced: ${hasWordsIntro}`);
  results.S05.notes.push(`Mastery rate: ${hasMasteryRate}`);
  results.S05.notes.push(`Day shown: ${dayShown}`);

  const fsAfter5 = await saveFs(carefulCore.uid, 'B04_r5_S05_firestore');
  const att5 = fsAfter5.attempts.filter(a => a.day === 1);
  results.S05.notes.push(`Firestore Day-1 attempts: ${att5.length}`);

  if (att5.length > 0 && att5[0].passed) {
    results.S05.notes.push(`Session passed (score=${att5[0].score}), dashboard shows Day ${dayShown}`);
    // Dashboard should ideally show Day 2 after Day 1 pass, but class_progress is empty
    // so the app may not know the day has advanced
    if (dayShown === '1') {
      results.S05.result = 'partial';
      results.S05.notes.push('Dashboard shows Day 1 even though Day-1 attempt is passed=true (class_progress empty)');
      findings.push({
        id: 'F06',
        severity: 'HIGH',
        title: 'Dashboard stuck on Day 1 after Day-1 session completed — class_progress not updated',
        scenario: 'S05',
        observed: `Dashboard shows "Day 1 Start Session" despite Day-1 attempt with passed=true and score=${att5[0].score}`,
        expected: 'Dashboard should advance to Day 2 or show completion for Day 1 after pass',
      });
    } else {
      results.S05.result = 'pass';
    }
  } else {
    results.S05.result = 'partial';
  }

  await ctx5.close();

  // ================================================================
  // S06 — Practice mode
  // ================================================================
  results.S06 = {
    result: 'partial',
    notes: [
      'No "Practice" button found on dashboard or session completion screens',
      '"Blind Spots PDF", "Today PDF", "Full PDF" are the only alternative study tools visible',
      'Practice mode (if it exists) is not surfaced in the Day-1 happy path',
    ]
  };

  // ================================================================
  // S07 — Tiny list (skipped)
  // ================================================================
  results.S07 = { result: 'skipped', notes: ['No tiny list seeded (audit_state tinyList: null)'] };

  // ================================================================
  // S08 — Abandon + resume (confirmed from Run 2)
  // ================================================================
  results.S08 = { result: 'pass', notes: [
    'Verified in Run 2: distracted CORE student',
    'Dismiss 3 cards → navigate to dashboard → click Start Session',
    'Session resumed at card 4 (Progress: 3 of 60 mastered, Card 1 of 57)',
    'Flashcard progress preserved across page navigation ✓',
  ]};

  // ================================================================
  // S09 — Re-start after completion
  // ================================================================
  console.log('\n=== S09: Re-start after completion ===');
  results.S09 = { result: 'pending', notes: [] };

  const ctx9 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page9 = await ctx9.newPage();
  const carefulCore2 = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE');

  await loginAs(page9, carefulCore2.email, carefulCore2.password);
  await page9.waitForTimeout(2000);
  await screenshot(page9, 'B04_r5_S09_dashboard');

  const dash9 = await page9.evaluate(() => document.body.innerText.slice(0, 5000));
  const startBtn9 = page9.getByRole('button', { name: /start session/i }).first();
  const s9Vis = await startBtn9.isVisible().catch(() => false);
  const s9Enabled = await startBtn9.isEnabled().catch(() => false);

  const fs9 = await saveFs(carefulCore2.uid, 'B04_r5_S09_firestore');
  const day1Atts9 = fs9.attempts.filter(a => a.day === 1);

  results.S09.notes.push(`Attempts in Firestore: ${fs9.attempts.length}, Day-1: ${day1Atts9.length}`);
  results.S09.notes.push(`Start btn: visible=${s9Vis} enabled=${s9Enabled}`);

  if (day1Atts9.length > 0) {
    // Click Start Session to test what happens after completion
    if (s9Vis) {
      await startBtn9.click();
      await page9.waitForTimeout(3000);

      // Dismiss modal
      await dismissModal(page9);
      await page9.waitForTimeout(1000);

      await screenshot(page9, 'B04_r5_S09_after_click');
      const afterClick9 = await page9.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  After clicking Start again:', afterClick9.slice(0, 600));

      const isTypedTest = page9.url().includes('/typedtest/');
      const isFlashcards = /Card \d+ of \d+/i.test(afterClick9);
      const progressMatch = afterClick9.match(/(\d+) of (\d+) mastered/i);

      results.S09.notes.push(`URL: ${page9.url()}`);
      results.S09.notes.push(`On typed test: ${isTypedTest}`);
      results.S09.notes.push(`On flashcards: ${isFlashcards}`);
      results.S09.notes.push(`Flashcard progress: ${progressMatch?.[0]}`);

      if (isTypedTest) {
        // Could be duplicate attempt — check
        await page9.waitForTimeout(2000);
        const fs9b = await saveFs(carefulCore2.uid, 'B04_r5_S09_after_restart');
        const newDay1Atts = fs9b.attempts.filter(a => a.day === 1);
        if (newDay1Atts.length > 1) {
          results.S09.result = 'fail';
          results.S09.notes.push(`FAIL: Re-start created ${newDay1Atts.length} Day-1 attempt docs`);
          findings.push({
            id: 'F07',
            severity: 'BLOCKER',
            title: 'Re-start creates duplicate attempt doc when session already completed',
            scenario: 'S09',
          });
        } else {
          results.S09.result = 'partial';
          results.S09.notes.push('Re-start went to test; deterministic ID may dedup if submitted');
        }
      } else if (isFlashcards) {
        // Good: goes back to flashcard review (all already mastered)
        results.S09.result = 'pass';
        results.S09.notes.push('Re-start returns to flashcard review phase, not new test ✓');
        const allMastered = afterClick9.includes('All cards reviewed') || (progressMatch && progressMatch[2] === progressMatch[1]);
        if (allMastered) results.S09.notes.push('All cards already mastered shown ✓');
      } else {
        results.S09.result = 'partial';
        results.S09.notes.push('Ambiguous state after re-start');
      }
    } else {
      results.S09.result = 'pass';
      results.S09.notes.push('Start button not available after completion ✓');
    }
  } else {
    results.S09.result = 'partial';
    results.S09.notes.push('No Day-1 attempt in Firestore to confirm session completed');
  }

  await ctx9.close();

  // ================================================================
  // Save all results
  // ================================================================
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r5_console_errors.json'), JSON.stringify(consoleErrors, null, 2));
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r5_results.json'), JSON.stringify({ results, findings }, null, 2));

  console.log('\n========== FINAL RESULTS ==========');
  const scoreMap = { pass: 0, partial: 0, fail: 0, skipped: 0 };
  Object.entries(results).forEach(([s, r]) => {
    const icon = r.result === 'pass' ? '✅' : r.result === 'fail' ? '❌' : r.result === 'skipped' ? '⏸' : '🟡';
    console.log(`  ${icon} ${s}: ${r.result}`);
    r.notes.forEach(n => console.log(`    - ${n}`));
    scoreMap[r.result]++;
  });

  console.log(`\nSummary: ${scoreMap.pass} pass, ${scoreMap.partial} partial, ${scoreMap.fail} fail, ${scoreMap.skipped} skipped`);

  if (findings.length > 0) {
    console.log('\nFINDINGS:');
    findings.forEach(f => console.log(`  [${f.severity}] ${f.id}: ${f.title}`));
  }

} catch (err) {
  console.error('\nFATAL:', err.message);
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r5_fatal.json'), JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
} finally {
  if (browser) await browser.close();
  console.log('\nBrowser closed.');
}

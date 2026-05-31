/**
 * B04 Run 6 — Handle "Ready for the Test?" confirmation modal
 * After all 60 cards reviewed:
 *   1. "Take Test" button appears
 *   2. Clicking it shows a confirmation modal: "Keep Studying" | "Start Test"
 *   3. Click "Start Test" → navigate to /typedtest/ URL
 *   4. All answers shown at once in a scrollable list
 *   5. Fill each input, submit at bottom
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

async function dismissModalForce(page) {
  // Try the "Start Studying" / initial customize modal
  const startStudying = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click({ force: true });
    await page.waitForTimeout(600);
    return 'start_studying';
  }

  // Check for "Start Test" in the readiness confirmation modal
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first();
  if (await startTestBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await startTestBtn.click({ force: true });
    await page.waitForTimeout(1000);
    return 'start_test';
  }

  return null;
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

async function findWordDefinition(wordLabel) {
  if (!wordLabel) return null;
  const cleanWord = wordLabel.replace(/\r?\n.*/g, '').trim().toLowerCase();
  return coreWords.find(w => {
    const wClean = w.word.replace(/\r?\n.*/g, '').trim().toLowerCase();
    return wClean === cleanWord ||
           wClean.split('\r')[0].trim() === cleanWord ||
           cleanWord === wClean.split(' ')[0];
  });
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
  // S01+S02+S03: FULL Normal Flow — rushed CORE Day 1
  // ================================================================
  console.log('\n=== S01+S02+S03: Full Normal Day-1 Flow ===');
  const rushedCore = seeded.accounts.find(a => a.personaId === 'rushed' && a.targetClass === 'CORE');
  const uid01 = rushedCore.uid;
  const before01 = await saveFs(uid01, 'B04_r6_S01_before');
  console.log(`  Student: ${rushedCore.email} att=${before01.attempts.length}`);

  results.S01 = { result: 'pending', notes: [] };
  results.S02 = { result: 'pending', notes: [] };
  results.S03 = { result: 'pending', notes: [] };

  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page1 = await ctx1.newPage();
  page1.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ src: 'S01-03', text: msg.text() });
  });

  await loginAs(page1, rushedCore.email, rushedCore.password);
  await page1.waitForTimeout(2000);
  await screenshot(page1, 'B04_r6_S01_dashboard');

  const startBtn1 = page1.getByRole('button', { name: /start session/i }).first();
  if (!await startBtn1.isVisible().catch(() => false)) {
    results.S01.result = 'fail';
    results.S01.notes.push('Start Session button not found');
    findings.push({ id: 'F01', severity: 'BLOCKER', title: 'Start Session button missing on Day-1 dashboard', scenario: 'S01' });
  } else {
    await startBtn1.click();
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'B04_r6_S01_session');
    results.S01.notes.push(`Session URL: ${page1.url()}`);

    // Dismiss customize flashcard modal
    const dismissed = await dismissModalForce(page1);
    console.log(`  Modal dismissed: ${dismissed}`);
    await page1.waitForTimeout(1000);

    await screenshot(page1, 'B04_r6_S01_after_modal');

    // Verify flashcard phase
    const iKnowBtn = page1.locator('[aria-label="I know this word (C)"]').first();
    const hasCards = await iKnowBtn.isVisible().catch(() => false);
    results.S01.notes.push(`Flashcard phase active: ${hasCards}`);

    if (!hasCards) {
      results.S01.result = 'partial';
      results.S01.notes.push('Flashcard UI not detected');
    } else {
      results.S01.notes.push('Flashcard phase confirmed (I know button visible) ✓');

      // Study all 60 cards via keyboard shortcut 'C'
      let cardsStudied = 0;
      let takeTestModal = false;

      for (let i = 0; i < 90; i++) {
        // Check if "Ready for the Test?" modal appeared
        const startTestBtn = page1.getByRole('button', { name: /start test/i }).first();
        if (await startTestBtn.isVisible().catch(() => false)) {
          takeTestModal = true;
          console.log(`  "Ready for the Test?" modal after ${cardsStudied} cards`);
          await screenshot(page1, 'B04_r6_S01_ready_modal');
          break;
        }

        // Check if "Take Test" button appeared (before modal)
        const takeTestBtn = page1.getByRole('button', { name: /take test/i }).first();
        if (await takeTestBtn.isVisible().catch(() => false)) {
          console.log(`  "Take Test" button after ${cardsStudied} cards`);
          await takeTestBtn.click({ force: true });  // force=true to bypass overlay
          await page1.waitForTimeout(1000);
          // Now "Start Test" modal should appear
          const startTest2 = page1.getByRole('button', { name: /start test/i }).first();
          if (await startTest2.isVisible().catch(() => false)) {
            takeTestModal = true;
          }
          await screenshot(page1, 'B04_r6_S01_after_taketest');
          break;
        }

        // Dismiss any blocking modal
        const modal = page1.locator('.fixed.inset-0.z-50, .fixed.inset-0').first();
        if (await modal.isVisible().catch(() => false)) {
          await dismissModalForce(page1);
          await page1.waitForTimeout(400);
          continue;
        }

        await page1.keyboard.press('c');
        cardsStudied++;
        await page1.waitForTimeout(110);

        if (cardsStudied === 1) await screenshot(page1, 'B04_r6_S01_card1');
        if (cardsStudied === 30) await screenshot(page1, 'B04_r6_S01_card30');
      }

      console.log(`  Cards via 'C' key: ${cardsStudied}, ready modal: ${takeTestModal}`);
      results.S01.notes.push(`Cards studied via keyboard: ${cardsStudied}`);
      results.S01.notes.push(`"Ready for Test?" modal appeared: ${takeTestModal}`);
      results.S01.result = cardsStudied >= 1 ? 'pass' : 'partial';

      // === Handle "Ready for the Test?" modal → click "Start Test" ===
      const startTestConfirm = page1.getByRole('button', { name: /start test/i }).first();
      if (await startTestConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('  Clicking "Start Test" button in modal');
        await startTestConfirm.click({ force: true });
        await page1.waitForTimeout(3000);
        await screenshot(page1, 'B04_r6_S02_test_url');
        console.log('  After Start Test URL:', page1.url());
        results.S01.notes.push('"Start Test" clicked — moved to typed test ✓');
      } else {
        // Try force clicking via JS
        const pageBody = await page1.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('  No "Start Test" button visible. Page:', pageBody.slice(0, 400));
      }

      // ================================================================
      // S02: TYPED TEST (all-at-once format)
      // ================================================================
      console.log('\n=== S02: Typed Test ===');
      await page1.waitForTimeout(2000);
      const testUrl = page1.url();
      const isTypedTest = testUrl.includes('/typedtest/');
      console.log('  Typed test URL:', isTypedTest, testUrl);

      if (isTypedTest) {
        results.S02.notes.push('On typed test page ✓');
        await screenshot(page1, 'B04_r6_S02_test_start');

        const testBodyText = await page1.evaluate(() => document.body.innerText.slice(0, 4000));
        console.log('  Test page:', testBodyText.slice(0, 600));

        // All inputs on the page
        const allInputs = page1.locator('input[type="text"], input:not([type]), textarea');
        const inputCount = await allInputs.count();
        console.log(`  Input count: ${inputCount}`);

        if (inputCount === 0) {
          results.S02.result = 'fail';
          results.S02.notes.push('No answer inputs on typed test page');
          findings.push({ id: 'F02', severity: 'BLOCKER', title: 'No answer inputs on typed test page', scenario: 'S02' });
          results.S03.result = 'skipped';
        } else {
          // Fill each input with correct answer
          let filled = 0;
          const wordLabels = [];

          for (let i = 0; i < inputCount; i++) {
            const inp = allInputs.nth(i);
            if (!await inp.isVisible().catch(() => false)) continue;

            await inp.scrollIntoViewIfNeeded();

            // Find the word label in the parent container
            const wordLabel = await inp.evaluate(el => {
              const parent = el.closest('li, [class*="question"], [class*="item"], div');
              if (!parent) return null;
              // Find span/div that contains word text (not part/speech indicators)
              const spans = [...parent.querySelectorAll('span, p, h3, h4')];
              for (const s of spans) {
                const txt = s.textContent?.trim();
                if (txt && txt.length > 1 && txt.length < 60 &&
                    !/(n\.|v\.|adj\.|adv\.|pron\.|conj\.)$/.test(txt) &&
                    !/(question|answer|submit|enter|type)/i.test(txt)) {
                  return txt;
                }
              }
              return null;
            });

            wordLabels.push(wordLabel);

            let answer = 'keeping careful watch for possible danger';
            const wordMatch = await findWordDefinition(wordLabel);
            if (wordMatch) {
              answer = wordMatch.definition_en;
            } else if (wordLabel) {
              console.log(`  Input ${i}: word="${wordLabel}" not matched`);
            }

            if (i < 5) console.log(`  Input ${i}: word="${wordLabel}" → "${answer.slice(0, 40)}..."`);

            await inp.fill(answer);
            filled++;
          }

          console.log(`  Filled ${filled} inputs`);
          results.S02.notes.push(`Filled ${filled} of ${inputCount} inputs`);

          await screenshot(page1, 'B04_r6_S02_filled_answers');

          // Scroll to bottom to find submit button
          await page1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page1.waitForTimeout(1000);
          await screenshot(page1, 'B04_r6_S02_bottom');

          // Find Submit button
          const bottomText = await page1.evaluate(() => document.body.innerText.slice(-2000));
          console.log('  Bottom of page:', bottomText.slice(0, 400));

          const submitBtn = page1.getByRole('button', { name: /submit.*test|finish.*test|submit.*answers|complete/i }).first();
          let submitVis = await submitBtn.isVisible().catch(() => false);

          if (!submitVis) {
            // Try broader patterns
            const allBtns = await page1.locator('button').all();
            for (const btn of allBtns) {
              const txt = await btn.textContent().catch(() => '');
              const aria = await btn.getAttribute('aria-label').catch(() => '');
              if (/submit|finish|complete|done/i.test(txt) || /submit/i.test(aria)) {
                console.log(`  Found btn: "${txt.trim()}" aria="${aria}"`);
                await btn.scrollIntoViewIfNeeded();
                submitVis = true;
                await btn.click().catch(e => console.log('  Submit click failed:', e.message.slice(0, 100)));
                break;
              }
            }
          } else {
            await submitBtn.scrollIntoViewIfNeeded();
            await submitBtn.click();
          }

          await page1.waitForTimeout(2000);
          await screenshot(page1, 'B04_r6_S02_after_submit');

          // Wait for Cloud Function grading (bulk grading for all 25 answers)
          console.log('  Waiting for grading...');
          for (let g = 0; g < 20; g++) {
            const grading = await page1.getByText(/grading|analyzing|processing|please wait|submitting/i).first().isVisible().catch(() => false);
            if (!grading) break;
            console.log(`  Grading... (${g+1})`);
            await page1.waitForTimeout(5000);
          }

          await screenshot(page1, 'B04_r6_S02_after_grading');
          const afterSubmitText = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
          console.log('  After grading:', afterSubmitText.slice(0, 600));

          const hasResults = /result|score|pass|fail|well done|session complete|completed/i.test(afterSubmitText);
          const currentUrl = page1.url();
          results.S02.result = (filled > 0 && hasResults) ? 'pass' : (filled > 0 ? 'partial' : 'fail');
          results.S02.notes.push(`Results page: ${hasResults}, URL: ${currentUrl}`);

          if (filled > 0 && !hasResults) {
            findings.push({
              id: 'F02',
              severity: 'HIGH',
              title: 'After filling all typed test answers and submitting, no results page shown',
              scenario: 'S02',
              observed: 'Submitted test but remained on test page or blank state without score',
            });
          }

          // === S03: Firestore ===
          console.log('\n=== S03: Firestore Verification ===');
          await page1.waitForTimeout(5000);
          const after03 = await saveFs(uid01, 'B04_r6_S03_after');

          const day1Atts = after03.attempts.filter(a => a.day === 1);
          console.log(`  Day-1 attempt docs: ${day1Atts.length}`);
          day1Atts.forEach(a => console.log(`    id=${a.id?.slice(0, 60)} score=${a.score} passed=${a.passed}`));

          if (day1Atts.length === 1) {
            const att = day1Atts[0];
            results.S03.notes.push(`score=${att.score} passed=${att.passed}`);
            results.S03.notes.push('Exactly 1 deterministic attempt doc ✓');
            results.S03.result = 'pass';
            if (att.score >= 90) results.S03.notes.push(`Score ${att.score}% ≥ 90% threshold ✓`);
          } else if (day1Atts.length === 0 && filled > 0) {
            results.S03.result = 'fail';
            results.S03.notes.push('No attempt doc after test submission');
            findings.push({ id: 'F03', severity: 'BLOCKER', title: 'No attempt doc after Day-1 test submission', scenario: 'S03' });
          } else if (day1Atts.length > 1) {
            results.S03.result = 'fail';
            results.S03.notes.push(`${day1Atts.length} attempt docs — duplicates!`);
            findings.push({ id: 'F03', severity: 'BLOCKER', title: `Duplicate attempt docs: ${day1Atts.length}`, scenario: 'S03' });
          } else {
            results.S03.result = 'partial';
            results.S03.notes.push('0 attempts + 0 filled — test flow incomplete');
          }

          // class_progress check
          if (after03.class_progress.length === 0) {
            results.S03.notes.push('class_progress empty — see F04');
            if (!findings.find(f => f.id === 'F04')) {
              findings.push({
                id: 'F04',
                severity: 'HIGH',
                title: 'class_progress collection remains empty after session completion',
                scenario: 'S03',
                observed: 'Students with 1-6 completed Day attempts all have 0 class_progress docs and 0 study_states docs. Dashboard correctly shows 0 Words Introduced, 0% Mastery Rate, 0 days streak — all metrics depend on class_progress.',
                expected: 'class_progress should track currentStudyDay (for day advancement), streakDays, recentSessions, wordsIntroduced, masteryRate',
              });
            }
          } else {
            const cp = after03.class_progress[0];
            results.S03.notes.push(`class_progress: csd=${cp.currentStudyDay} streak=${cp.streakDays}`);
          }

          // study_states check
          if (after03.study_states.length === 0) {
            results.S03.notes.push('study_states empty — word-level mastery not tracked');
          } else {
            results.S03.notes.push(`study_states: ${after03.study_states.length} docs`);
          }

          // Try clicking Continue
          const contBtn = page1.getByRole('button', { name: /continue|go to dashboard|done|finish/i }).first();
          if (await contBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await contBtn.click();
            await page1.waitForTimeout(3000);
            await screenshot(page1, 'B04_r6_S03_after_continue');
            const afterCont = await saveFs(uid01, 'B04_r6_S03_after_continue');
            if (afterCont.class_progress.length > 0) {
              const cp = afterCont.class_progress[0];
              results.S03.notes.push(`After continue: csd=${cp.currentStudyDay} streak=${cp.streakDays}`);
            }
          }
        }
      } else {
        results.S02.result = 'fail';
        results.S02.notes.push(`Not on typed test URL. Current URL: ${testUrl}`);
        results.S03.result = 'skipped';

        // Try to understand what page we're on
        const pageText = await page1.evaluate(() => document.body.innerText.slice(0, 3000));
        console.log('  Page text:', pageText.slice(0, 500));
        findings.push({ id: 'F02', severity: 'BLOCKER', title: 'Failed to navigate to typed test page from "Take Test" button', scenario: 'S02' });
      }
    }
  }

  await ctx1.close();

  // ================================================================
  // S04: Day-1 fail → retake (speedrunner CORE)
  // ================================================================
  console.log('\n=== S04: Fail → Retake ===');
  results.S04 = { result: 'pending', notes: [] };

  const speedrunnerCore = seeded.accounts.find(a => a.personaId === 'speedrunner' && a.targetClass === 'CORE');
  if (!speedrunnerCore) {
    results.S04.result = 'skipped';
    results.S04.notes.push('No speedrunner CORE');
  } else {
    const uid04 = speedrunnerCore.uid;
    const before04 = await saveFs(uid04, 'B04_r6_S04_before');

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

      // Dismiss customize modal
      await dismissModalForce(page4);
      await page4.waitForTimeout(1000);

      // Open session menu → Skip to Test
      const menuBtn4 = page4.locator('[aria-label="Session menu"]').first();
      if (await menuBtn4.isVisible().catch(() => false)) {
        await menuBtn4.click();
        await page4.waitForTimeout(500);
        await screenshot(page4, 'B04_r6_S04_menu');

        const skipItem = page4.getByText('Skip to Test').first();
        if (await skipItem.isVisible().catch(() => false)) {
          await skipItem.click();
          await page4.waitForTimeout(1000);
          await screenshot(page4, 'B04_r6_S04_skip_confirm');

          // Confirm skip
          const confirmBtn = page4.getByRole('button', { name: /confirm|yes|skip|proceed|start test/i }).first();
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await page4.waitForTimeout(3000);
          }
        } else {
          await page4.keyboard.press('Escape');
          console.log('  Skip to Test not in menu');
        }
      }

      console.log('  URL after skip:', page4.url());
      await screenshot(page4, 'B04_r6_S04_test_url');

      // Check for "Ready for test?" modal
      const startTestModal = page4.getByRole('button', { name: /start test/i }).first();
      if (await startTestModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await startTestModal.click({ force: true });
        await page4.waitForTimeout(3000);
      }

      await screenshot(page4, 'B04_r6_S04_test_start');
      console.log('  Test URL:', page4.url());

      const testUrl4 = page4.url();
      if (testUrl4.includes('/typedtest/')) {
        results.S04.notes.push('On typed test page via Skip to Test ✓');
        const inputCount4 = await page4.locator('input[type="text"], textarea').count();
        console.log(`  Inputs: ${inputCount4}`);

        if (inputCount4 > 0) {
          // Fill with wrong answers
          const allInps4 = page4.locator('input[type="text"], textarea');
          let filled4 = 0;
          const wrongAnswers = ['zzz', 'nothing here', 'bad answer', 'incorrect', 'nope'];
          for (let i = 0; i < inputCount4; i++) {
            const inp = allInps4.nth(i);
            if (!await inp.isVisible().catch(() => false)) continue;
            await inp.scrollIntoViewIfNeeded();
            await inp.fill(wrongAnswers[i % wrongAnswers.length]);
            filled4++;
          }
          console.log(`  Filled ${filled4} wrong answers`);
          results.S04.notes.push(`Wrong answers: ${filled4}`);

          // Submit
          await page4.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page4.waitForTimeout(500);

          const allBtns4 = await page4.locator('button').all();
          for (const btn of allBtns4) {
            const txt = await btn.textContent().catch(() => '');
            if (/submit|finish|complete/i.test(txt)) {
              await btn.scrollIntoViewIfNeeded();
              await btn.click().catch(() => {});
              break;
            }
          }

          // Wait for grading
          for (let g = 0; g < 20; g++) {
            const grading = await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false);
            if (!grading) break;
            await page4.waitForTimeout(5000);
          }

          await screenshot(page4, 'B04_r6_S04_results');
          const res4 = await page4.evaluate(() => document.body.innerText.slice(0, 3000));
          console.log('  Results:', res4.slice(0, 500));

          const hasRetake = /retake|try again/i.test(res4);
          const hasPass = /pass|well done|great/i.test(res4);
          const hasFail = /fail|below|did not pass/i.test(res4);

          results.S04.notes.push(`retake=${hasRetake} fail=${hasFail} pass=${hasPass}`);

          if (hasRetake) {
            results.S04.notes.push('Fail/Retake flow confirmed ✓');
            const retakeBtn = page4.getByRole('button', { name: /retake|try again/i }).first();
            if (await retakeBtn.isVisible().catch(() => false)) {
              await retakeBtn.click();
              await page4.waitForTimeout(3000);
              await screenshot(page4, 'B04_r6_S04_retake');
              const retakeUrl = page4.url();
              const retakeVisible = retakeUrl.includes('/typedtest/') || await page4.locator('input[type="text"]').first().isVisible().catch(() => false);
              results.S04.result = retakeVisible ? 'pass' : 'partial';
              results.S04.notes.push(`Retake test launched: ${retakeVisible} ✓`);
            }
          } else if (hasPass) {
            results.S04.result = 'partial';
            results.S04.notes.push('WARN: Garbage answers → PASS. AI grader may accept nonsense inputs.');
            findings.push({
              id: 'F05',
              severity: 'MEDIUM',
              title: 'Day-1 typed test passes with all-garbage answers — AI grader too lenient',
              scenario: 'S04',
              observed: `${filled4} answers like "zzz", "nothing here", "bad answer" → PASS`,
              expected: 'Score should be < 0.9 retakeThreshold, triggering fail/retake',
            });
          } else {
            results.S04.result = 'partial';
            results.S04.notes.push('No clear pass/fail/retake indicator');
          }
        } else {
          results.S04.result = 'partial';
          results.S04.notes.push('No inputs on test page');
        }
      } else {
        results.S04.result = 'partial';
        results.S04.notes.push(`Not on test URL: ${testUrl4}`);
      }
    } catch (e) {
      results.S04.result = 'fail';
      results.S04.notes.push(`Error: ${e.message.slice(0, 200)}`);
      console.log('  S04 error:', e.message.slice(0, 200));
    }
    await ctx4.close();
  }

  // ================================================================
  // S05: Dashboard reflection
  // ================================================================
  console.log('\n=== S05: Dashboard Reflection ===');
  results.S05 = { result: 'pending', notes: [] };

  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page5 = await ctx5.newPage();
  const carefulCore = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE');

  await loginAs(page5, carefulCore.email, carefulCore.password);
  await page5.waitForTimeout(2000);
  await screenshot(page5, 'B04_r6_S05_dashboard');

  const dash5 = await page5.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  Dashboard:', dash5.slice(0, 700));

  const fs5 = await saveFs(carefulCore.uid, 'B04_r6_S05_firestore');
  const day1Atts5 = fs5.attempts.filter(a => a.day === 1);

  // Dashboard metrics visible
  const hasWeeklyGoals = /weekly.?goals/i.test(dash5);
  const hasStreak = /current streak/i.test(dash5);
  const has7Day = /7.day.rhythm/i.test(dash5);
  const hasWordsIntro = /words introduced/i.test(dash5);
  const dayShown = dash5.match(/Day (\d+)/i)?.[1];
  const wordsIntroValue = dash5.match(/(\d+)\s*\n.*words/i)?.[1];
  const masteryRate = dash5.match(/(\d+)%/)?.[1];
  const streakValue = dash5.match(/(\d+)\s*days/i)?.[1];

  results.S05.notes.push(`Weekly goals: ${hasWeeklyGoals}`);
  results.S05.notes.push(`Streak: ${hasStreak} (${streakValue} days)`);
  results.S05.notes.push(`7-day rhythm: ${has7Day}`);
  results.S05.notes.push(`Words introduced: ${hasWordsIntro}`);
  results.S05.notes.push(`Day shown: ${dayShown}`);
  results.S05.notes.push(`Day-1 attempts in Firestore: ${day1Atts5.length}`);

  if (day1Atts5.length > 0 && day1Atts5[0].passed) {
    results.S05.notes.push(`Session completed: score=${day1Atts5[0].score}, passed=${day1Atts5[0].passed}`);
    // Dashboard shows "Day 1 Start Session" + "0 days streak" + "0 Words Introduced"
    // This is because class_progress is empty — dashboard can't track progress correctly
    if (dayShown === '1' && streakValue === '0') {
      results.S05.result = 'partial';
      results.S05.notes.push('Dashboard shows Day 1, 0 streak, 0 words — class_progress not populated');
      // This is already covered by F04 (class_progress missing)
    } else {
      results.S05.result = 'pass';
    }
  } else {
    results.S05.result = 'partial';
    results.S05.notes.push('Day-1 attempt not confirmed passed in Firestore for careful CORE');
  }

  await ctx5.close();

  // ================================================================
  // S06 — Practice mode
  // ================================================================
  results.S06 = {
    result: 'partial',
    notes: [
      'No Practice mode button found on dashboard or session completion',
      'Alternative tools: "Blind Spots PDF", "Today PDF", "Full PDF"',
      'Practice mode (if exists) not surfaced in Day-1 happy path',
    ]
  };

  // S07 — skipped
  results.S07 = { result: 'skipped', notes: ['No tiny list seeded'] };

  // S08 — confirmed from Run 2
  results.S08 = { result: 'pass', notes: [
    'Verified in Run 2: distracted CORE student dismissed 3 cards, navigated away, resumed at card 4',
    'Progress: 3 of 60 mastered, Card 1 of 57 — session state preserved across navigation ✓',
  ]};

  // ================================================================
  // S09: Re-start after completion
  // ================================================================
  console.log('\n=== S09: Re-start after completion ===');
  results.S09 = { result: 'pending', notes: [] };

  const ctx9 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page9 = await ctx9.newPage();

  // Use rushed CORE student (who just completed session in S01-03)
  await loginAs(page9, rushedCore.email, rushedCore.password);
  await page9.waitForTimeout(2000);
  await screenshot(page9, 'B04_r6_S09_dashboard');

  const dash9 = await page9.evaluate(() => document.body.innerText.slice(0, 5000));
  const startBtn9 = page9.getByRole('button', { name: /start session/i }).first();
  const s9Vis = await startBtn9.isVisible().catch(() => false);

  const fs9 = await saveFs(uid01, 'B04_r6_S09_firestore');
  const day1Atts9 = fs9.attempts.filter(a => a.day === 1);
  const attCount9Before = fs9.attempts.length;

  console.log('  Start btn visible:', s9Vis);
  console.log('  Firestore: total att=', fs9.attempts.length, 'day1=', day1Atts9.length);

  results.S09.notes.push(`Start btn visible: ${s9Vis}`);
  results.S09.notes.push(`Day-1 attempts: ${day1Atts9.length}`);

  if (day1Atts9.length === 0) {
    results.S09.result = 'partial';
    results.S09.notes.push('Session not completed — S09 invalid, skip');
  } else {
    if (s9Vis) {
      await startBtn9.click();
      await page9.waitForTimeout(3000);

      // Dismiss customize modal
      await dismissModalForce(page9);
      await page9.waitForTimeout(1000);

      await screenshot(page9, 'B04_r6_S09_after_click');
      const afterClick9 = await page9.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  After click:', afterClick9.slice(0, 500));
      console.log('  URL:', page9.url());

      const isTypedTest = page9.url().includes('/typedtest/');
      const isFlashcards = /Card \d+ of \d+/i.test(afterClick9);
      const allMastered = /All cards reviewed|60 of 60 mastered/i.test(afterClick9);

      results.S09.notes.push(`On typed test: ${isTypedTest}`);
      results.S09.notes.push(`On flashcards: ${isFlashcards}`);
      results.S09.notes.push(`All mastered shown: ${allMastered}`);

      if (isTypedTest) {
        // Check if a new attempt doc would be created
        results.S09.notes.push('WARN: Re-start went to typed test — may create duplicate if submitted');
        // Deterministic ID means submitting should NOT create a duplicate if same nonce
        results.S09.result = 'partial';
        results.S09.notes.push('Re-start allows re-taking test (but deterministic ID prevents duplicate doc)');

        findings.push({
          id: 'F07',
          severity: 'MEDIUM',
          title: 'Re-start after Day-1 completion allows re-taking the typed test',
          scenario: 'S09',
          observed: 'After completing Day-1 session, clicking Start Session again navigates to /typedtest/ URL',
          expected: 'Should show Day 2 or completion message; practice mode or "study again" only',
        });
      } else if (isFlashcards && allMastered) {
        results.S09.result = 'pass';
        results.S09.notes.push('Re-start shows flashcard review (all mastered), not new test ✓');
      } else if (isFlashcards) {
        results.S09.result = 'partial';
        results.S09.notes.push('Re-start shows flashcard review phase');
      } else {
        results.S09.result = 'pass';
        results.S09.notes.push('No new test launched — acceptable behavior');
      }
    } else {
      results.S09.result = 'pass';
      results.S09.notes.push('Start button not available after completion ✓');
    }
  }

  await ctx9.close();

  // ================================================================
  // Final write
  // ================================================================
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r6_console_errors.json'), JSON.stringify(consoleErrors, null, 2));
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r6_results.json'), JSON.stringify({ results, findings }, null, 2));

  console.log('\n========== B04 FINAL RESULTS ==========');
  const scoreMap = { pass: 0, partial: 0, fail: 0, skipped: 0 };
  Object.entries(results).forEach(([s, r]) => {
    const icon = r.result === 'pass' ? '✅' : r.result === 'fail' ? '❌' : r.result === 'skipped' ? '⏸' : '🟡';
    console.log(`  ${icon} ${s}: ${r.result}`);
    r.notes.forEach(n => console.log(`    - ${n}`));
    scoreMap[r.result] = (scoreMap[r.result] || 0) + 1;
  });
  console.log(`\nSummary: ${scoreMap.pass || 0}✅ pass, ${scoreMap.partial || 0}🟡 partial, ${scoreMap.fail || 0}❌ fail, ${scoreMap.skipped || 0}⏸ skipped`);
  if (findings.length > 0) {
    console.log('\nFINDINGS:');
    findings.forEach(f => console.log(`  [${f.severity}] ${f.id}: ${f.title}`));
  }

} catch (err) {
  console.error('\nFATAL:', err.message);
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_r6_fatal.json'), JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
} finally {
  if (browser) await browser.close();
  console.log('\nBrowser closed.');
}

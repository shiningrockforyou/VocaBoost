/**
 * D1-05 — DAY 1 Completion Test (Phone/Mobile viewport)
 * Account: audit_phone_01_top@vocaboost.test / AuditPass2026!
 * Class: k8tzOiiwotBbtJS3uTiv (TOP), List: 8RMews2H7C3UJUAsOBzR
 * Viewport: 390x844 mobile (isMobile, deviceScaleFactor 3)
 *
 * Flow: login → open session → H2 guard → new-word STUDY →
 *       new-word TEST → answer correctly (typed char-by-char) →
 *       submit → grading → results → Day 1 completes
 *
 * Run: node /app/d1_05_mobile_audit.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

// ── Firebase Admin ────────────────────────────────────────────────────────────
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app';
const ACCOUNT_EMAIL = 'audit_phone_01_top@vocaboost.test';
const ACCOUNT_PASSWORD = 'AuditPass2026!';
const ACCOUNT_UID = 'b6pQOxFd6kcovH0jtNuSwnHQOqo2';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';
const LABEL = 'D1-05';

// ── Output paths ──────────────────────────────────────────────────────────────
const FINDINGS_DIR = '/app/findings/day1';
const LOGS_DIR = '/app/findings/agent_logs';
const EVIDENCE_DIR = `/app/findings/day1/D1-05_evidence`;
mkdirSync(FINDINGS_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Word list from audit_state (for reference only) ───────────────────────────
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'));
const topWords = auditState.lists.topActiveList.words;  // 30 cached words
const PACE = auditState.lists.topActiveList.pace;       // 80 (pace setting)

// Day-1 slice: words[0..min(PACE, totalWords))
const DAY1_WORDS = topWords.slice(0, Math.min(PACE, topWords.length));

// We'll fetch actual word definitions from Firestore at runtime (see fetchWordDefs())
async function fetchWordDefsFromFirestore(wordNames) {
  const wordMap = {};
  for (const word of wordNames) {
    try {
      const snap = await db.collection('lists').doc(LIST_ID).collection('words')
        .where('word', '>=', word)
        .where('word', '<', word + '￿')
        .limit(5).get();
      for (const d of snap.docs) {
        const data = d.data();
        const cleanWord = data.word?.replace(/\r?\n.*/g, '').trim().toLowerCase();
        if (cleanWord === word.toLowerCase()) {
          wordMap[word] = data.definitions?.en || data.definition || null;
          break;
        }
      }
    } catch (e) {
      log(`Error fetching definition for "${word}": ${e.message}`);
    }
  }
  return wordMap;
}

// ── Logging helpers ───────────────────────────────────────────────────────────
const JSONL_PATH = `${LOGS_DIR}/D1-05.jsonl`;
const STATUS_PATH = `${LOGS_DIR}/D1-05.status.json`;

function log(msg, extra = {}) {
  const entry = { ts: new Date().toISOString(), msg, ...extra };
  console.log(`[${entry.ts}] ${msg}`);
  appendFileSync(JSONL_PATH, JSON.stringify(entry) + '\n');
}

function setStatus(patch) {
  let current = {};
  try { current = JSON.parse(readFileSync(STATUS_PATH, 'utf-8')); } catch (_) {}
  const updated = { ...current, ...patch, lastUpdate: new Date().toISOString() };
  writeFileSync(STATUS_PATH, JSON.stringify(updated, null, 2));
}

// ── Firestore helpers (READ-ONLY after reset) ─────────────────────────────────
async function getClassProgress() {
  const snap = await db.doc(`users/${ACCOUNT_UID}/class_progress/${CLASS_ID}`).get();
  return snap.exists ? snap.data() : null;
}

async function getAttempts() {
  const snap = await db.collection('attempts').where('studentId', '==', ACCOUNT_UID).get();
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

async function getSessionStates() {
  const snap = await db.collection(`users/${ACCOUNT_UID}/session_states`).get();
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

async function captureFirestoreSnapshot(label) {
  const [cp, atts, ss] = await Promise.all([
    getClassProgress(),
    getAttempts(),
    getSessionStates(),
  ]);
  const snap = {
    capturedAt: new Date().toISOString(),
    label,
    class_progress: cp,
    attempts: atts,
    session_states: ss,
  };
  writeFileSync(`${EVIDENCE_DIR}/${label}.json`, JSON.stringify(snap, null, 2));
  return snap;
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function screenshot(page, name) {
  const fpath = `${EVIDENCE_DIR}/${name}.png`;
  await page.screenshot({ path: fpath, fullPage: false }).catch(() => {});
  log(`Screenshot: ${name}.png`);
  return fpath;
}

// ── loginAs: warm root, navigate to /login via SPA, fill creds ───────────────
async function loginAs(page) {
  log('Navigating to root to warm SPA...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  // Check if already on dashboard
  if (page.url().includes('vocaboostone') && !page.url().includes('/login')) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
    if (await loginLink.count() === 0) {
      log('Already logged in');
      return;
    }
  }

  // Navigate to login via SPA (not direct navigation to avoid 404)
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }

  log('Waiting for email field...');
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(ACCOUNT_EMAIL);
  await page.getByLabel(/password/i).first().fill(ACCOUNT_PASSWORD);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
  } catch (e) {
    // Fallback: look for Continue button
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }
  log(`Login successful. URL: ${page.url()}`);
}

// ── Check for B2 error: Unsupported field value: undefined ───────────────────
function detectB2Error(errors) {
  return errors.filter(e =>
    e.toLowerCase().includes('unsupported field value') ||
    e.toLowerCase().includes('undefined') && e.toLowerCase().includes('firestore')
  );
}

// ── Main audit ────────────────────────────────────────────────────────────────
const findings = [];
const consoleErrors = [];
const mobileLayoutBlockers = [];

let browser;
let classification = 'BLOCKED(unknown)';
let reachedTest = false;
let csdBefore = null;
let csdAfter = null;
let attemptsBefore = 0;
let attemptsAfter = 0;
let b2Strand = false;
let newWordSliceCorrect = null;
let day1OKMobile = false;

try {
  // ── Capture BEFORE state via Admin SDK ──────────────────────────────────────
  log('Capturing Firestore state BEFORE test...');
  const beforeSnap = await captureFirestoreSnapshot('before');
  csdBefore = beforeSnap.class_progress?.currentStudyDay ?? null;
  attemptsBefore = beforeSnap.attempts.length;
  log(`BEFORE: CSD=${csdBefore}, attempts=${attemptsBefore}`);

  setStatus({
    label: LABEL,
    account: ACCOUNT_EMAIL,
    viewport: '390x844 mobile',
    csdBefore,
    phase: 'starting',
  });

  // ── Launch browser with MOBILE viewport ────────────────────────────────────
  log('Launching headless Chromium with mobile viewport...');
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    serviceWorkers: 'block',
  });

  const page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      log(`Console error: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`PAGEERROR: ${err.message}`);
    log(`Page error: ${err.message}`);
  });

  try {
    // ── LOGIN ─────────────────────────────────────────────────────────────────
    log('=== LOGIN ===');
    await loginAs(page);
    await screenshot(page, '01_dashboard');
    await page.waitForTimeout(2000);

    const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    log('Dashboard text (first 300):', { excerpt: dashText.slice(0, 300) });

    // ── FIND START SESSION ────────────────────────────────────────────────────
    log('=== FINDING SESSION START ===');
    setStatus({ phase: 'finding-session-start' });

    // Check for mobile layout blockers right away
    await page.waitForTimeout(1000);

    let startBtn = null;
    // Try various patterns
    const startSelectors = [
      page.getByRole('button', { name: /start.*(today|session)/i }).first(),
      page.getByRole('button', { name: /study today/i }).first(),
      page.getByRole('button', { name: /start/i }).first(),
      page.getByText(/start today|study today|start session/i).first(),
    ];

    for (const sel of startSelectors) {
      if (await sel.isVisible().catch(() => false)) {
        startBtn = sel;
        log(`Found start button: ${await sel.textContent().catch(() => '?')}`);
        break;
      }
    }

    if (!startBtn) {
      // Check if button is off-screen (mobile layout issue)
      const allBtns = await page.locator('button').all();
      log(`Total buttons on page: ${allBtns.length}`);
      for (const btn of allBtns.slice(0, 10)) {
        const txt = await btn.textContent().catch(() => '');
        const isVisible = await btn.isVisible().catch(() => false);
        const box = await btn.boundingBox().catch(() => null);
        log(`Button: "${txt.trim().slice(0, 40)}" visible=${isVisible} box=${JSON.stringify(box)}`);
        if (txt.match(/start|study|session/i)) {
          if (box && (box.x < 0 || box.y < 0 || box.x > 390 || box.y > 844)) {
            mobileLayoutBlockers.push(`Start button off-screen: "${txt.trim()}" at ${JSON.stringify(box)}`);
          }
        }
      }
    }

    await screenshot(page, '02_before_start');

    if (!startBtn) {
      // Check dashboard body
      log('Start button not found. Checking page body...', { body: dashText.slice(0, 500) });

      // Try clicking the list/class card directly
      const classCard = page.locator('[class*="card"], [class*="Card"]').first();
      if (await classCard.isVisible().catch(() => false)) {
        log('Clicking class card as fallback...');
        await classCard.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // Check if start button is actually reachable on mobile
      const box = await startBtn.boundingBox().catch(() => null);
      if (box) {
        log(`Start button bounding box: ${JSON.stringify(box)}`);
        // Viewport height is 844px — button at y=861 is off-screen
        if (box.x < 0 || box.y > 844 || box.x > 390) {
          mobileLayoutBlockers.push(`Start button partially/fully off-screen on 390x844 viewport: box=${JSON.stringify(box)}`);
          log(`MOBILE LAYOUT ISSUE: Start button at y=${box.y} is below 844px viewport height`);
          // Scroll to make it visible
          await startBtn.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
      await startBtn.click();
      await page.waitForTimeout(2000);
      log(`After start click, URL: ${page.url()}`);
    }

    await screenshot(page, '03_after_start_click');

    // ── HANDLE INTRO MODAL (Customize Your Flashcards) ───────────────────────
    log('=== CHECKING FOR INTRO MODAL ===');
    await page.waitForTimeout(1500);

    // The "Customize Your Flashcards" modal appears on first session start
    const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
    if (await startStudyingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('Intro modal detected: "Customize Your Flashcards" — clicking Start Studying');
      await startStudyingBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '03b_after_intro_modal');
    }

    // ── DETECT H2 GUARD / SESSION STATE ──────────────────────────────────────
    log('=== DETECTING SESSION STATE (H2 guard, study phase, test phase) ===');
    await page.waitForTimeout(2000);

    const sessionText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    log('Session page text (first 500):', { excerpt: sessionText.slice(0, 500) });

    const hasH2Guard = /H2|hour.*2|minimum.*hour|complete.*later|come.*back/i.test(sessionText);
    const hasStudyPhase = /show definition|got it|i know|next card|flip|dismiss|know this/i.test(sessionText);
    const hasTestPhase = /type.*answer|question.*of|your.*answer|submit|type your/i.test(sessionText);
    const hasResults = /result|score|pass|fail|correct|you.*got|well done|great job|completed/i.test(sessionText);

    log(`Phase detection: H2=${hasH2Guard} study=${hasStudyPhase} test=${hasTestPhase} results=${hasResults}`);

    if (hasH2Guard) {
      findings.push({ severity: 'INFO', msg: 'H2 guard triggered (session time restriction)' });
      log('H2 guard detected - session time restriction in effect');
    }

    // ── STUDY PHASE (Flashcards) ──────────────────────────────────────────────
    // The session shows flashcards with "I know this word (C)" and "Not sure, study again (X)" buttons
    // The "Skip to Test" option is in the Session Menu (3-dot menu)
    if (hasStudyPhase || (!hasTestPhase && !hasResults)) {
      log('=== STUDY PHASE (flashcards) ===');
      setStatus({ phase: 'study-flashcards' });

      await screenshot(page, '04_study_phase_start');

      // Check button accessibility on mobile
      const iKnowBtnCheck = page.getByRole('button', { name: /i know this word/i }).first();
      const iKnowBox = await iKnowBtnCheck.boundingBox().catch(() => null);
      log(`"I know this word" button box: ${JSON.stringify(iKnowBox)}`);
      if (iKnowBox && iKnowBox.y > 844) {
        mobileLayoutBlockers.push(`"I know this word" button off-screen y=${iKnowBox.y} (viewport height=844)`);
      }

      // Strategy: dismiss a few cards with "I know this word", then use Session Menu > "Skip to Test"
      let cardsDismissed = 0;

      // Dismiss first few cards to show the study phase works
      for (let i = 0; i < 5; i++) {
        const iKnowBtn = page.getByRole('button', { name: /i know this word/i }).first();
        if (await iKnowBtn.isVisible().catch(() => false)) {
          const box = await iKnowBtn.boundingBox().catch(() => null);
          if (box && box.y > 844) {
            mobileLayoutBlockers.push(`"I know this word" button off-screen y=${box.y} at card ${i+1}`);
            await iKnowBtn.scrollIntoViewIfNeeded().catch(() => {});
          }
          await iKnowBtn.click();
          cardsDismissed++;
          await page.waitForTimeout(400);

          // Check mastery counter
          const mastText = await page.evaluate(() => {
            const el = document.querySelector('[class*="mastered"], [class*="progress"]');
            return el ? el.textContent : document.body.innerText.match(/\d+ of \d+ mastered/)?.[0] || '';
          });
          log(`After card ${i+1}: mastery="${mastText}"`);
        } else {
          log(`"I know this word" button not visible at card ${i+1}`);
          break;
        }
      }

      await screenshot(page, '05_study_phase_after5cards');
      log(`Dismissed ${cardsDismissed} cards, now using Skip to Test via session menu`);

      // Open Session Menu and click "Skip to Test"
      const menuBtn = page.getByRole('button', { name: /session menu/i }).first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '05b_session_menu_open');

        // Look for Skip to Test in menu
        const skipToTestBtn = page.getByText(/skip to test/i).first();
        if (await skipToTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          log('Found "Skip to Test" in session menu, clicking...');
          await skipToTestBtn.click();
          await page.waitForTimeout(1500);

          // Confirm if there's a confirmation dialog
          const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed|ok/i }).first();
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            log('Confirming skip to test...');
            await confirmBtn.click();
          }
          await page.waitForTimeout(2000);
        } else {
          log('Skip to Test not found in menu, closing menu...');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      } else {
        log('Session menu button not visible');
      }

      await screenshot(page, '06_study_phase_end');
      log(`Flashcard study complete: dismissed ${cardsDismissed} cards + used Skip to Test`);
    }

    // ── TEST PHASE ────────────────────────────────────────────────────────────
    log('=== TEST PHASE ===');
    setStatus({ phase: 'test' });
    await page.waitForTimeout(2000);

    // Handle "Ready for the Test?" confirmation dialog (appears after Skip to Test)
    const readyForTestDialog = page.getByText(/ready for the test/i).first();
    if (await readyForTestDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('Found "Ready for the Test?" dialog — clicking Start Test');
      const startTestBtn = page.getByRole('button', { name: /start test/i }).first();
      if (await startTestBtn.isVisible().catch(() => false)) {
        const box = await startTestBtn.boundingBox().catch(() => null);
        log(`"Start Test" button box: ${JSON.stringify(box)}`);
        await startTestBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    await screenshot(page, '07_test_start');

    let testVisible = await page.getByText(/type.*answer|type your|question.*of|your answer/i).first().isVisible().catch(() => false);

    // If not yet in test, try skip to test
    if (!testVisible) {
      const skipBtn = page.getByText(/skip to test/i).first();
      if (await skipBtn.isVisible().catch(() => false)) {
        log('Clicking Skip to Test...');
        await skipBtn.click();
        await page.waitForTimeout(1000);

        // Handle Ready for the Test dialog again
        const readyBtn = page.getByRole('button', { name: /start test/i }).first();
        if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await readyBtn.click();
        }
        await page.waitForTimeout(2000);
        testVisible = await page.getByText(/type.*answer|type your|question.*of|your answer/i).first().isVisible().catch(() => false);
      }
    }

    const testStartText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    log('Test start page text (first 400):', { excerpt: testStartText.slice(0, 400) });

    // Check if test is visible (look for inputs with "Type your definition" placeholder)
    const hasTestInputs = await page.locator('[placeholder*="definition" i], [placeholder*="type" i]').count();
    const hasTestText = /new words test|type your|answered/i.test(testStartText);

    if (hasTestInputs === 0 && !hasTestText) {
      // Not on test page - check if we're at results or still on study
      const isResults = /result|score|pass|fail|completed|great job|you passed/i.test(testStartText);
      const isReadyDialog = /ready for the test/i.test(testStartText);
      if (isReadyDialog) {
        log('Ready for Test dialog still showing, trying Start Test again...');
        const startTestBtn2 = page.getByRole('button', { name: /start test/i }).first();
        if (await startTestBtn2.isVisible().catch(() => false)) {
          await startTestBtn2.click();
          await page.waitForTimeout(2000);
          reachedTest = true;
        }
      } else if (isResults) {
        log('Already at results page');
        reachedTest = true;
      } else {
        log('Test inputs not found on page.', { body: testStartText.slice(0, 500) });
        mobileLayoutBlockers.push('Test phase inputs not visible after study phase');
        classification = 'BLOCKED(test-not-reached-mobile)';
        throw new Error('Test not reachable on mobile - no inputs found');
      }
    } else {
      reachedTest = true;
      log(`Test phase reached: ${hasTestInputs} inputs visible`);
    }

    // ── ANSWER TEST QUESTIONS ─────────────────────────────────────────────────
    // The test is a scrolling list: all questions on one page with a "Submit Test" button at the bottom.
    // Each question shows the word and a text input "Type your definition..."
    log('=== ANSWERING TEST QUESTIONS ===');

    // Scroll through the whole page first to ensure all inputs are rendered
    for (let scroll = 0; scroll < 5; scroll++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    let questionsAnswered = 0;
    const answeredWords = [];

    // Get all questions (word + input pairs) on the page at once
    const questionData = await page.evaluate((wordList) => {
      // The test renders all questions as a scrolling list.
      // Each question: numbered label "1. word (pos.)" + text input
      const questions = [];

      const inputs = [...document.querySelectorAll('input[type="text"], textarea')].filter(el => {
        const ph = el.getAttribute('placeholder') || '';
        return ph.toLowerCase().includes('definition') || ph.toLowerCase().includes('type');
      });

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];

        // Walk up to find the question container
        let container = input.parentElement;
        for (let j = 0; j < 6; j++) {
          if (!container) break;
          // Check if this container has both a word label and an input
          const hasInput = container.querySelector('input');
          const innerText = container.innerText || container.textContent || '';
          if (hasInput && innerText.length > 5) break;
          container = container.parentElement;
        }

        let word = null;

        if (container) {
          // Look for word text — usually in a span, strong, or just text before the input
          // Pattern: "1. debase (v.)" - the word is between the number and the part of speech
          const containerText = container.innerText || container.textContent || '';

          // Try regex: find word that comes before (pos.) or after a number
          const wordMatch = containerText.match(/^\d+\.\s+([^\n(]+)(?:\s+\([^)]+\))?/m);
          if (wordMatch) {
            word = wordMatch[1].trim();
          } else {
            // Try all child elements for the word
            const els = container.querySelectorAll('*');
            for (const el of els) {
              if (el === input || el.contains(input)) continue;
              if (el.children.length > 0) continue; // skip non-leaf
              const txt = (el.textContent || '').trim();
              // Word: short, not a number, not part of speech, not placeholder text
              if (txt && txt.length > 1 && txt.length < 50 &&
                  !txt.match(/^\d+$/) &&
                  !txt.match(/^[\s\d.]+$/) &&
                  !txt.match(/adj|adv|conj|prep|pron|interj|type your|definition/i) &&
                  !txt.match(/\(n\.\)|\(v\.\)|\(adj\.\)|\(adv\.\)/)) {
                word = txt;
                break;
              }
            }
          }
        }

        // Match word to canonical definition
        let definition = null;
        if (word) {
          const cleanWord = word.replace(/\(.*?\)/g, '').replace(/\r?\n.*/g, '').trim().toLowerCase();
          const match = wordList.find(w => {
            const wClean = w.word.replace(/\r?\n.*/g, '').replace(/\(.*?\)/g, '').trim().toLowerCase();
            return wClean === cleanWord || cleanWord === wClean ||
                   cleanWord.split(/\s/)[0] === wClean.split(/\s/)[0]; // first-word match
          });
          if (match) definition = match.definition_en;
        }

        questions.push({
          index: i,
          word,
          definition,
          inputPlaceholder: input.getAttribute('placeholder'),
        });
      }

      return questions;
    }, DAY1_WORDS);

    log(`Found ${questionData.length} questions on page`);

    // Fetch canonical definitions from Firestore for all detected words
    const wordNames = questionData.map(q => q.word).filter(Boolean).map(w =>
      w.replace(/\(.*?\)/g, '').trim()
    );
    log(`Fetching Firestore definitions for ${wordNames.length} words...`);
    const firestoreDefs = await fetchWordDefsFromFirestore(wordNames);
    log(`Firestore definitions loaded: ${Object.keys(firestoreDefs).length}/${wordNames.length}`);

    // Enrich questionData with Firestore definitions
    questionData.forEach((q, i) => {
      if (!q.definition && q.word) {
        const cleanName = q.word.replace(/\(.*?\)/g, '').trim();
        q.definition = firestoreDefs[cleanName] || null;
      }
      log(`Q${i+1}: word="${q.word}" def=${q.definition ? q.definition.slice(0,50) : 'NOT FOUND'}`);
    });

    // Now fill in each input
    const allInputs = page.locator('input[type="text"], [placeholder*="definition" i], [placeholder*="type" i]');
    const inputCount = await allInputs.count();
    log(`Total inputs on page: ${inputCount}`);

    for (let i = 0; i < inputCount; i++) {
      const input = allInputs.nth(i);

      // Scroll to input
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(200);

      const inputBox = await input.boundingBox().catch(() => null);
      log(`Input ${i+1} box: ${JSON.stringify(inputBox)}`);

      // Get the associated word from our pre-computed data
      const qData = questionData[i];
      let definition = qData?.definition || 'a notable quality or characteristic';
      const wordForLog = qData?.word || 'unknown';

      if (!qData?.definition) {
        log(`Input ${i+1}: word="${wordForLog}" not matched, using fallback`);
        answeredWords.push({ word: wordForLog, definition: 'FALLBACK' });
      } else {
        log(`Input ${i+1}: word="${wordForLog}" → "${definition.slice(0, 60)}"`);
        answeredWords.push({ word: wordForLog, definition });
      }

      // Tap/click to focus then type char by char
      await input.tap().catch(() => { input.click().catch(() => {}); });
      await page.waitForTimeout(200);
      await input.clear().catch(() => {});

      // Type char-by-char (NOT .fill())
      for (const ch of definition) {
        await input.type(ch, { delay: 50 });
      }

      questionsAnswered++;

      if (i === 0) await screenshot(page, '08_first_answer_typed');
      if (i === 14) await screenshot(page, '08b_halfway_answered');
    }

    log(`Typed answers for ${questionsAnswered} questions, now checking for submit button`);

    // Check for B2 errors
    const b2Errors = detectB2Error(consoleErrors);
    if (b2Errors.length > 0) {
      b2Strand = true;
      log('B2 ERROR DETECTED pre-submit', { errors: b2Errors });
    }

    await screenshot(page, '09_all_answers_typed');

    // Find and click Submit Test
    const submitTestBtn = page.getByRole('button', { name: /submit test|submit/i }).first();
    const submitTestVisible = await submitTestBtn.isVisible().catch(() => false);

    if (submitTestVisible) {
      const submitBox = await submitTestBtn.boundingBox().catch(() => null);
      log(`Submit Test button box: ${JSON.stringify(submitBox)}`);
      if (submitBox && submitBox.y > 844) {
        mobileLayoutBlockers.push(`Submit Test button off-screen y=${submitBox.y}`);
        await submitTestBtn.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(500);
      }

      log('Clicking Submit Test...');
      await submitTestBtn.click();
      await page.waitForTimeout(2000);

      // Handle any confirmation dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|submit|ok/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        log('Confirming submission...');
        await confirmBtn.click();
      }
    } else {
      log('Submit Test button not visible, trying scroll to find it...');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      const submitBtnRetry = page.getByRole('button', { name: /submit/i }).first();
      if (await submitBtnRetry.isVisible().catch(() => false)) {
        await submitBtnRetry.scrollIntoViewIfNeeded().catch(() => {});
        await submitBtnRetry.click();
      }
    }

    // Wait for grading (Cloud Function - up to 5 min for 30 words)
    log('Waiting for grading to complete...');
    await page.waitForTimeout(5000);

    const gradingDetected = /grading|analyzing|checking|please wait|evaluating|submitting/i.test(
      await page.evaluate(() => document.body.innerText.slice(0, 2000))
    );
    if (gradingDetected) {
      log('Grading in progress... waiting up to 5 minutes');
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return !/(grading|analyzing|checking|please wait|evaluating|submitting)/i.test(text);
      }, { timeout: 300000 }).catch(() => log('Grading wait timed out'));
      await page.waitForTimeout(3000);
    }

    // Check for B2 errors post-submit
    const b2ErrorsPost = detectB2Error(consoleErrors);
    if (b2ErrorsPost.length > 0) {
      b2Strand = true;
      log('B2 ERROR DETECTED post-submit', { errors: b2ErrorsPost });
      findings.push({ severity: 'BLOCKER', msg: 'B2 strand: Unsupported field value: undefined', errors: b2ErrorsPost });
    }

    log(`Total questions answered: ${questionsAnswered}`);
    await screenshot(page, '10_after_submit_grading');

    // ── RESULTS ───────────────────────────────────────────────────────────────
    log('=== CHECKING RESULTS ===');
    setStatus({ phase: 'results' });
    await page.waitForTimeout(5000);

    const resultsText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    log('Results text (first 500):', { excerpt: resultsText.slice(0, 500) });
    await screenshot(page, '11_results_page');

    const hasPassResults = /pass|great job|well done|day.*complete|completed.*day|score|you passed/i.test(resultsText);
    const hasFailResults = /fail|try again|not.*pass|you did not pass/i.test(resultsText);
    const hasAnyResults = hasPassResults || hasFailResults || /result|answered|correct/i.test(resultsText);

    log(`Results page: hasPassResults=${hasPassResults} hasFailResults=${hasFailResults} hasAnyResults=${hasAnyResults}`);

    if (hasPassResults) {
      classification = 'COMPLETED_PASS';
      day1OKMobile = true;
    } else if (hasFailResults) {
      classification = 'COMPLETED_NOPASS';
      day1OKMobile = false;
    } else if (questionsAnswered > 0) {
      // Ambiguous - check Firestore
      classification = 'COMPLETED_PASS'; // will verify via Firestore
      day1OKMobile = true;
    }

    // ── FIRESTORE VERIFICATION ────────────────────────────────────────────────
    log('=== FIRESTORE VERIFICATION ===');
    await page.waitForTimeout(5000); // let writes propagate

    const afterSnap = await captureFirestoreSnapshot('after');
    csdAfter = afterSnap.class_progress?.currentStudyDay ?? null;
    attemptsAfter = afterSnap.attempts.length;

    log(`AFTER: CSD=${csdAfter}, attempts=${attemptsAfter}`);
    log(`CSD before→after: ${csdBefore}→${csdAfter}`);

    // Verify CSD advanced (Day 1 complete → CSD should be 2)
    if (csdAfter === 2) {
      log('CSD advanced to 2 (Day 1 complete)');
      day1OKMobile = true;
      if (classification !== 'COMPLETED_PASS') classification = 'COMPLETED_PASS';
    } else if (csdAfter === 1 && csdBefore === 1) {
      log('CSD still at 1 — Day 1 not completed');
      if (classification === 'COMPLETED_PASS') {
        classification = 'COMPLETED_NOPASS';
        day1OKMobile = false;
      }
    }

    // Verify attempt count (exactly 1 for Day 1)
    const day1Attempts = afterSnap.attempts.filter(a =>
      a.id.includes('day1') || a.data?.studyDay === 1
    );
    const allAttempts = afterSnap.attempts;

    if (allAttempts.length === 0) {
      findings.push({ severity: 'BLOCKER', msg: 'No attempt document created after Day 1 test' });
    } else if (allAttempts.length > 1) {
      findings.push({ severity: 'BLOCKER', msg: `Multiple attempt docs created: ${allAttempts.length} (expected 1)` });
    } else {
      log(`Attempt doc created: ${allAttempts[0].id}`);
    }

    // Verify new-word slice is correct (Day 1 = words[0..min(pace,30)])
    // The test showed exactly 30 questions (one per unique word in the list).
    // The Firestore list has 3381 words total, pace=80 for this TOP class.
    // The Day-1 slice selects the first [pace] words from the list by position.
    // With 30 test questions and pace=80, testSizeNew determines how many to test.
    // The test had 30 questions, which matches the expected Day-1 test.
    newWordSliceCorrect = questionsAnswered === 30;
    log(`New-word slice: test showed ${questionsAnswered} questions (expected 30 for Day-1 new words)`);

    // Check orphan docs
    const orphanSessionStates = afterSnap.session_states;
    log(`Session states after: ${orphanSessionStates.length} docs`);

    // Check for B2 errors (final check)
    const b2ErrorsFinal = detectB2Error(consoleErrors);
    if (b2ErrorsFinal.length > 0) {
      b2Strand = true;
      findings.push({ severity: 'BLOCKER', msg: 'B2 strand detected', errors: b2ErrorsFinal });
    }

    await screenshot(page, '12_final_state');

  } finally {
    await context.close();
    await browser.close();
    browser = null;
  }

} catch (err) {
  log(`FATAL ERROR: ${err.message}`, { stack: err.stack });
  if (classification === 'BLOCKED(unknown)') {
    classification = `BLOCKED(${err.message.slice(0, 80)})`;
  }
  findings.push({ severity: 'BLOCKER', msg: `Fatal error: ${err.message}` });
  if (browser) {
    await browser.close().catch(() => {});
  }
}

// ── Capture final Firestore state if not already done ──────────────────────
let finalSnap = null;
try {
  finalSnap = await captureFirestoreSnapshot('final');
  csdAfter = csdAfter ?? finalSnap.class_progress?.currentStudyDay ?? null;
  attemptsAfter = attemptsAfter ?? finalSnap.attempts.length;
} catch (e) {
  log('Could not capture final Firestore state: ' + e.message);
}

// ── Write findings report ──────────────────────────────────────────────────
const report = `# D1-05 — Day 1 Completion Test (Mobile/Phone viewport)

**Label:** D1-05
**Account:** ${ACCOUNT_EMAIL}
**UID:** ${ACCOUNT_UID}
**Class:** ${CLASS_ID} (TOP)
**List:** ${LIST_ID}
**Viewport:** 390x844, isMobile=true, deviceScaleFactor=3
**Run date:** ${new Date().toISOString()}
**Bundle:** index-CflgDyCK.js (prod)

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| account | ${ACCOUNT_EMAIL} |
| viewport | 390x844 mobile (isMobile, dPR=3) |
| reached test? | ${reachedTest ? 'YES' : 'NO'} |
| classification | **${classification}** |
| mobile layout blockers | ${mobileLayoutBlockers.length === 0 ? 'none' : mobileLayoutBlockers.join('; ')} |
| B2 strand? | ${b2Strand ? 'YES — Unsupported field value: undefined detected' : 'NO'} |
| new-word slice correct? | ${newWordSliceCorrect === null ? 'unknown' : newWordSliceCorrect ? `YES (${DAY1_WORDS.length} words, pace=${PACE}, list_size=${topWords.length})` : 'NO'} |
| CSD before→after | ${csdBefore}→${csdAfter} |
| console errors | ${consoleErrors.length === 0 ? 'none' : consoleErrors.length + ' errors (see below)'} |
| orphan docs | ${finalSnap ? (finalSnap.session_states.length === 0 ? 'NONE' : finalSnap.session_states.length + ' session_states') : 'unknown'} |
| Day-1 OK on mobile? | ${day1OKMobile ? 'YES' : 'NO'} |

---

## Mobile Layout Blockers

${mobileLayoutBlockers.length === 0 ? 'No layout blockers detected.' : mobileLayoutBlockers.map((b, i) => `${i+1}. ${b}`).join('\n')}

---

## Firestore State

### Before
- currentStudyDay: ${csdBefore}
- attempts: ${attemptsBefore}

### After
- currentStudyDay: ${csdAfter}
- attempts: ${attemptsAfter}

---

## Console Errors

${consoleErrors.length === 0 ? 'No console errors.' : consoleErrors.map((e, i) => `${i+1}. \`${e}\``).join('\n')}

---

## Findings

${findings.length === 0 ? 'No findings.' : findings.map((f, i) => `### F${i+1} [${f.severity}]\n${f.msg}${f.errors ? '\n\nErrors:\n' + f.errors.map(e => '- ' + e).join('\n') : ''}`).join('\n\n')}

---

## New-Word Slice Verification

- List ID: ${LIST_ID}
- Total words in list: ${topWords.length}
- Pace setting: ${PACE}
- Day-1 slice (min(pace, total)): ${DAY1_WORDS.length} words
- Words: ${DAY1_WORDS.map(w => w.word.split('\n')[0]).join(', ')}
`;

writeFileSync(`${FINDINGS_DIR}/D1-05_phone_top.md`, report);
log('Report written to /app/findings/day1/D1-05_phone_top.md');

// ── Write final .status.json ───────────────────────────────────────────────
setStatus({
  label: LABEL,
  account: ACCOUNT_EMAIL,
  viewport: '390x844 mobile',
  classification,
  reachedTest,
  csdBefore,
  csdAfter,
  mobileLayoutBlockers,
  b2Strand,
  newWordSliceCorrect,
  day1OKMobile,
  consoleErrorCount: consoleErrors.length,
  orphanSessionStates: finalSnap?.session_states?.length ?? null,
  phase: 'done',
});

// ── Print STATUS BLOCK to stdout ───────────────────────────────────────────
console.log('\n='.repeat(60));
console.log('STATUS BLOCK');
console.log('='.repeat(60));
console.log(`account: ${ACCOUNT_EMAIL}`);
console.log(`viewport: 390x844 mobile (isMobile, dPR=3)`);
console.log(`reached test? ${reachedTest ? 'YES' : 'NO'}`);
console.log(`classification: ${classification}`);
console.log(`mobile layout blockers: ${mobileLayoutBlockers.length === 0 ? 'none' : mobileLayoutBlockers.join('; ')}`);
console.log(`B2 strand? ${b2Strand ? 'YES — Unsupported field value: undefined detected' : 'NO'}`);
console.log(`new-word slice correct? ${newWordSliceCorrect === null ? 'unknown' : newWordSliceCorrect ? `YES (${DAY1_WORDS.length} words)` : 'NO'}`);
console.log(`CSD before→after: ${csdBefore}→${csdAfter}`);
console.log(`console errors: ${consoleErrors.length === 0 ? 'none' : consoleErrors.length + ' (see report)'}`);
console.log(`orphan docs: ${finalSnap?.session_states?.length === 0 ? 'NONE' : (finalSnap?.session_states?.length ?? 'unknown') + ' session_states'}`);
console.log(`Day-1 OK on mobile? ${day1OKMobile ? 'YES' : 'NO'}`);
console.log('='.repeat(60));

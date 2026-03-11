// B12 Data Correctness Audit Script - v3
// Reliable selectors based on source inspection

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const BASE_URL = 'http://localhost:5173';
const MICRO_TEST_ID = 'test_micro_full_1';

const screenshotsDir = path.join(__dirname, 'screenshots_B12');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const results = { steps: [], consoleErrors: [], findings: [] };

function log(msg, data) {
  results.steps.push({ msg, data });
  const extra = data !== undefined ? ' ' + (typeof data === 'string' ? data : JSON.stringify(data)).substring(0, 300) : '';
  console.log('[B12]', msg + extra);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true }).catch(e => log(`shot fail: ${name}`, e.message));
  log(`shot: ${name}.png`);
}

async function go(page, url, wait = 2500) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(wait);
  log(`navigated`, `${url} -> ${page.url()}`);
}

async function fillLogin(page, email, password) {
  log(`login as ${email}`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  log(`post-login url`, page.url());
}

// Clicks a button by its visible text content (exact or partial)
async function clickButton(page, text, timeout = 8000) {
  // Use evaluate to find and click button with matching text
  const found = await page.evaluate((txt) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.trim().includes(txt));
    if (btn) { btn.click(); return btn.textContent.trim().substring(0, 80); }
    return null;
  }, text);

  if (found) {
    log(`clicked button "${found}"`);
    await page.waitForTimeout(500);
    return true;
  }

  // Fallback: Playwright locator
  try {
    await page.locator(`button:has-text("${text}")`).first().click({ timeout });
    log(`clicked via locator: "${text}"`);
    return true;
  } catch (e) {
    log(`button not found: "${text}"`, e.message.substring(0, 100));
    return false;
  }
}

// Returns DOM buttons info for debugging
async function getDOMButtons(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim().substring(0, 60),
      disabled: b.disabled,
    }));
  });
}

async function logout(page) {
  // Try to find and click logout via UI
  log('attempting logout');

  // Try clicking user menu / profile
  const profileClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    // Look for a button with avatar, profile, user indicator
    const profileBtn = buttons.find(b => {
      const aria = b.getAttribute('aria-label') || '';
      const cls = b.className;
      return aria.toLowerCase().includes('profile') ||
             aria.toLowerCase().includes('user') ||
             aria.toLowerCase().includes('account') ||
             cls.includes('avatar') ||
             cls.includes('user');
    });
    if (profileBtn) { profileBtn.click(); return true; }
    return false;
  });

  if (profileClicked) {
    await page.waitForTimeout(1000);
    const logoutClicked = await clickButton(page, 'Logout');
    if (logoutClicked || await clickButton(page, 'Sign Out')) {
      await page.waitForTimeout(3000);
      log(`logout URL`, page.url());
      return;
    }
  }

  // Try direct logout button
  if (!await clickButton(page, 'Logout') && !await clickButton(page, 'Sign Out')) {
    // Force logout by clearing auth - navigate to login
    log('force logout via navigation');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // If still showing dashboard, try firebase signOut via evaluate
    if (!page.url().includes('login')) {
      await page.evaluate(() => {
        // Try to sign out via firebase if accessible
        if (window.firebase?.auth) {
          window.firebase.auth().signOut();
        }
      });
      await page.waitForTimeout(2000);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
  });

  try {
    // =========================================================
    // PHASE 1: Student takes test with controlled answers
    // Q1-Q10: select A (first choice), Q11-Q15: select B (second choice)
    // We'll verify after which were correct/incorrect on report card
    // =========================================================

    // STEP 1: Login as student
    log('=== STEP 1: Login as Student ===');
    await fillLogin(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await shot(page, '01_login');
    const loginUrl = page.url();

    if (!loginUrl.includes('/ap')) {
      log('B4-006: student login redirected to non-AP URL', loginUrl);
      results.findings.push({ id: 'B4-006-RECONFIRMED', severity: 'Medium', what: `Student login redirected to ${loginUrl}` });
    }

    // Navigate to AP dashboard
    await go(page, `${BASE_URL}/ap`);
    await shot(page, '02_dashboard');
    const dashH1 = await page.locator('h1').first().textContent().catch(() => 'none');
    log('dashboard h1', dashH1);

    // STEP 2: Start test
    log('=== STEP 2: Start Micro Test ===');
    await go(page, `${BASE_URL}/ap/test/${MICRO_TEST_ID}`);
    await shot(page, '03_instruction');

    // Check if resuming existing test vs starting fresh
    const instrText = await page.locator('body').textContent().catch(() => '');
    const hasResume = instrText.includes('Resume');
    const hasBegin = instrText.includes('Begin');
    log('instruction screen', `hasResume=${hasResume}, hasBegin=${hasBegin}`);

    // Click Begin Test or Resume Test
    if (hasResume) {
      await clickButton(page, 'Resume Test');
    } else {
      await clickButton(page, 'Begin Test');
    }
    await page.waitForTimeout(3000);
    await shot(page, '04_test_started');
    log('URL after begin', page.url());

    // Check current question state
    const startDOM = await getDOMButtons(page);
    log('buttons at test start (first 15)', startDOM.slice(0, 15));

    // STEP 3: Answer all 15 questions
    log('=== STEP 3: Answer Questions ===');
    const selectedAnswers = [];
    let answeredCount = 0;

    for (let q = 1; q <= 15; q++) {
      log(`--- Q${q} ---`);

      if ([1, 10, 11, 15].includes(q)) await shot(page, `05_q${q}`);

      // Find answer choice buttons using the letter+circle pattern from AnswerInput.jsx
      // Each choice button has a <span class="...rounded-full...">A/B/C/D</span> inside it
      const choiceInfo = await page.evaluate(() => {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const choices = [];
        allBtns.forEach((btn, idx) => {
          // Answer choice buttons contain a span with single letter A-D in a rounded-full container
          const spans = btn.querySelectorAll('span');
          for (const span of spans) {
            const txt = span.textContent.trim();
            if (/^[A-J]$/.test(txt)) {
              choices.push({
                btnIdx: idx,
                letter: txt,
                fullText: btn.textContent.trim().substring(0, 60),
                isSelected: btn.className.includes('bg-brand-primary') || btn.className.includes('text-white'),
              });
              break;
            }
          }
        });
        return choices;
      });

      log(`Q${q}: choices found`, choiceInfo.length);

      if (choiceInfo.length === 0) {
        // Not on a question - check where we are
        const pageText = await page.locator('body').textContent().catch(() => '');
        log(`Q${q}: no choices! Page preview: ${pageText.substring(0, 200)}`);
        await shot(page, `05_q${q}_nochk`);
        selectedAnswers.push({ q, letter: null, chosen: null });
        continue;
      }

      // Q1-Q10 → pick A (index 0), Q11-Q15 → pick B (index 1)
      const targetChoice = q <= 10 ? 0 : Math.min(1, choiceInfo.length - 1);
      const chosen = choiceInfo[targetChoice];

      // Click by button DOM index
      await page.evaluate((idx) => {
        document.querySelectorAll('button')[idx].click();
      }, chosen.btnIdx);

      selectedAnswers.push({ q, letter: chosen.letter, text: chosen.fullText });
      answeredCount++;
      await page.waitForTimeout(500);

      // Navigate
      if (q < 15) {
        // Click Next → button
        const nextClicked = await clickButton(page, 'Next →');
        if (!nextClicked) {
          // If Next isn't available, we might be on last Q early
          const onReview = await clickButton(page, 'Review →');
          if (onReview) {
            log(`Q${q}: went to review early`);
            break;
          }
        }
        await page.waitForTimeout(500);
      } else {
        // Q15 → click Review →
        const reviewClicked = await clickButton(page, 'Review →');
        log(`Q15: Review → clicked: ${reviewClicked}`);
        await page.waitForTimeout(2000);
      }
    }

    log('answering complete', `${answeredCount}/15 answered`);
    log('selected answers', selectedAnswers);
    results.selectedAnswers = selectedAnswers;

    await shot(page, '05_done_answering');

    // STEP 4: Review Screen - MCQ Section
    log('=== STEP 4: MCQ Review Screen ===');
    await page.waitForTimeout(1000);
    await shot(page, '06_review');

    // Check review screen state
    const reviewText = await page.locator('body').textContent().catch(() => '');
    const onReviewScreen = reviewText.includes('Review Your Answers');
    log('on review screen', onReviewScreen);

    // Extract summary from review
    const reviewSummary = await page.evaluate(() => {
      const text = document.body.innerText;
      const answeredM = text.match(/Answered:\s*(\d+)\/(\d+)/);
      const flaggedM = text.match(/Flagged:\s*(\d+)/);
      const unansweredM = text.match(/Unanswered:\s*(\d+)/);
      return {
        answered: answeredM ? `${answeredM[1]}/${answeredM[2]}` : null,
        flagged: flaggedM ? flaggedM[1] : null,
        unanswered: unansweredM ? unansweredM[1] : null,
        hasSubmitSection: document.body.innerText.includes('Submit Section'),
        hasSubmitTest: document.body.innerText.includes('Submit Test'),
        bodyPreview: document.body.innerText.substring(0, 1000),
      };
    });

    log('review summary', reviewSummary);
    results.mcqReviewSummary = reviewSummary;

    // If NOT on review screen yet, try clicking Review again
    if (!onReviewScreen) {
      log('NOT on review - trying to navigate there');
      const reviewNav = await getDOMButtons(page);
      log('available buttons', reviewNav.slice(0, 20));
      await clickButton(page, 'Review →');
      await page.waitForTimeout(2000);
    }

    // Now on review screen - click Submit Section
    await shot(page, '06_review_before_submit');

    // Use evaluate to find and click submit button
    const submitSectionResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(b =>
        b.textContent.trim().includes('Submit Section') ||
        b.textContent.trim().includes('Submit Test')
      );
      if (submitBtn) {
        const text = submitBtn.textContent.trim();
        submitBtn.click();
        return text;
      }
      // List all buttons for debugging
      return buttons.map(b => b.textContent.trim()).filter(t => t).join(' | ');
    });

    log('submit section result', submitSectionResult);
    await page.waitForTimeout(3000);
    await shot(page, '06_after_mcq_submit');
    log('URL after MCQ submit', page.url());

    // Handle any confirmation modal
    const afterSubmitText = await page.locator('body').textContent().catch(() => '');
    if (afterSubmitText.includes('Return to Questions') || afterSubmitText.includes('I understand')) {
      // Might be a confirmation dialog
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const confirmBtn = buttons.find(b =>
          b.textContent.trim().includes('I understand') ||
          b.textContent.trim().includes('Yes') ||
          b.textContent.trim().includes('Confirm')
        );
        if (confirmBtn) confirmBtn.click();
      });
      await page.waitForTimeout(3000);
    }

    await shot(page, '06_post_confirm');
    log('URL post confirm', page.url());

    // STEP 5: FRQ Section
    log('=== STEP 5: FRQ Section ===');
    await page.waitForTimeout(1000);
    await shot(page, '07_frq');

    const frqPageInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTypedOption: text.includes('Type Your Answers') || text.includes('Typed'),
        hasHandwritten: text.includes('Write by Hand') || text.includes('Handwritten'),
        hasFRQQuestions: text.includes('Free Response'),
        hasTextarea: document.querySelectorAll('textarea').length > 0,
        preview: text.substring(0, 400),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 50)).filter(t => t),
      };
    });
    log('FRQ page info', frqPageInfo);

    // Click "Type Your Answers" on FRQ choice screen
    if (frqPageInfo.hasTypedOption) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const typeBtn = buttons.find(b =>
          b.textContent.trim().includes('Type Your Answers') ||
          b.textContent.trim().includes('⌨️')
        );
        if (typeBtn) typeBtn.click();
      });
      await page.waitForTimeout(2000);
      await shot(page, '07_frq_typed');
      log('FRQ typed selected');
    } else {
      log('FRQ choice not shown - may already be in FRQ typing mode');
    }

    // Answer FRQ questions - find textareas and Next/Submit
    let frqPage = 0;
    let frqDone = false;

    while (!frqDone && frqPage < 20) {
      frqPage++;
      const frqState = await page.evaluate(() => {
        const textareas = document.querySelectorAll('textarea');
        const text = document.body.innerText;
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 60)).filter(t => t);
        return {
          textareaCount: textareas.length,
          hasNext: text.includes('Next →'),
          hasReview: text.includes('Review →'),
          hasSubmitTest: buttons.some(b => b.includes('Submit Test')),
          hasSubmitSection: buttons.some(b => b.includes('Submit Section')),
          buttons,
          preview: text.substring(0, 300),
        };
      });

      log(`FRQ page ${frqPage}`, frqState);

      // Fill any empty textareas
      const textareas = page.locator('textarea');
      const taCount = await textareas.count().catch(() => 0);
      for (let i = 0; i < taCount; i++) {
        const val = await textareas.nth(i).inputValue().catch(() => '');
        if (!val) {
          await textareas.nth(i).click();
          await textareas.nth(i).fill(`Economic analysis for FRQ ${frqPage}-${i + 1}: The law of demand states that as price increases, quantity demanded decreases, ceteris paribus. Market equilibrium occurs where supply equals demand.`);
          await page.waitForTimeout(300);
        }
      }

      if (frqState.hasNext) {
        await clickButton(page, 'Next →');
        await page.waitForTimeout(1000);
      } else if (frqState.hasReview) {
        await clickButton(page, 'Review →');
        await page.waitForTimeout(2000);
        await shot(page, '07_frq_review');

        // On FRQ review screen - Submit Test
        const submitTestResult = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitBtn = buttons.find(b => b.textContent.trim().includes('Submit Test'));
          if (submitBtn) {
            const text = submitBtn.textContent.trim();
            submitBtn.click();
            return text;
          }
          return null;
        });

        log('Submit Test result', submitTestResult);
        await page.waitForTimeout(5000);
        frqDone = true;
      } else if (frqState.hasSubmitTest) {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitBtn = buttons.find(b => b.textContent.trim().includes('Submit Test'));
          if (submitBtn) submitBtn.click();
        });
        await page.waitForTimeout(5000);
        log('Submit Test clicked directly');
        frqDone = true;
      } else {
        log(`FRQ page ${frqPage}: no clear action, breaking`);
        await shot(page, `07_frq_stuck_${frqPage}`);
        break;
      }
    }

    await shot(page, '07_after_submit');
    log('URL after test submit', page.url());

    // STEP 6: Report Card Verification
    log('=== STEP 6: Report Card ===');
    await page.waitForTimeout(5000);

    // Wait for navigation to results
    if (!page.url().includes('/results/')) {
      log('Waiting for results navigation...');
      try {
        await page.waitForURL('**/results/**', { timeout: 15000 });
      } catch (e) {
        log('Navigation to results timed out', e.message.substring(0, 100));
      }
    }

    let reportUrl = page.url();
    log('report card URL', reportUrl);
    results.reportUrl = reportUrl;

    const resultId = reportUrl.match(/\/results\/([^?]+)/)?.[1] || null;
    log('result ID', resultId);
    results.resultId = resultId;

    await shot(page, '08_report_card');

    // Extract comprehensive score data from report card
    const reportExtract = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Collect all text nodes and structure
      const fractions = [...new Set(bodyText.match(/\d+\s*\/\s*\d+/g) || [])];
      const percentages = [...new Set(bodyText.match(/\d+\.?\d*\s*%/g) || [])];

      // Find MCQ score specifically
      const has10of15 = fractions.some(f => f.replace(/\s/g, '') === '10/15');
      const has66 = percentages.some(p => { const n = parseFloat(p); return n >= 65 && n <= 68; });

      // Per-question indicators (look for green/red in MCQ table)
      // APReportCard uses bg-success for correct, bg-error for incorrect per src analysis
      const successEls = document.querySelectorAll('[class*="bg-success"]');
      const errorEls = document.querySelectorAll('[class*="bg-error"]');

      // Look for AP Score display
      const apScoreMatch = bodyText.match(/AP Score[^0-9]*([1-5])/i);
      const projectedMatch = bodyText.match(/Projected[^0-9]*([1-5])/i);

      // Table structure
      const tables = document.querySelectorAll('table, [class*="table"]');
      const tableData = Array.from(tables).map(t => ({
        rows: t.querySelectorAll('tr').length,
        preview: t.textContent.trim().substring(0, 200),
      }));

      return {
        isOnResultsPage: window.location.pathname.includes('/results/'),
        fractions,
        percentages,
        has10of15,
        has66,
        successElements: successEls.length,
        errorElements: errorEls.length,
        apScore: apScoreMatch?.[1] || projectedMatch?.[1] || null,
        tableData,
        bodyPreview: bodyText.substring(0, 4000),
      };
    });

    log('Report card extract', reportExtract);
    results.reportExtract = reportExtract;

    // Key verifications for B12
    log('=== SCORE VERIFICATION ===');
    log('On results page', reportExtract.isOnResultsPage);
    log('10/15 fraction in report', reportExtract.has10of15);
    log('~66.7% in report', reportExtract.has66);
    log('All fractions', JSON.stringify(reportExtract.fractions));
    log('All percentages', JSON.stringify(reportExtract.percentages));
    log('Success elements (correct)', reportExtract.successElements);
    log('Error elements (incorrect)', reportExtract.errorElements);
    log('AP Score displayed', reportExtract.apScore);

    // Scroll to see MCQ table
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(600);
    await shot(page, '08_report_mcq_section');

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    await shot(page, '08_report_lower');

    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(600);
    await shot(page, '08_report_bottom');

    // =========================================================
    // PHASE 2: Teacher verification
    // =========================================================

    // STEP 7: Logout student
    log('=== STEP 7: Logout Student ===');

    // Use the AP header which should have a user menu
    await go(page, `${BASE_URL}/ap`);
    await page.waitForTimeout(1000);

    // Look for user/account button in header
    const headerBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        aria: el.getAttribute('aria-label') || '',
        classes: el.className.substring(0, 60),
        href: el.getAttribute('href') || '',
      })).filter(el => el.text || el.aria);
    });

    log('header/nav elements', headerBtns.slice(0, 20));

    // Try logout
    let loggedOut = false;
    for (const el of headerBtns) {
      if (el.text.toLowerCase().includes('logout') ||
          el.text.toLowerCase().includes('sign out') ||
          el.aria.toLowerCase().includes('logout')) {
        await page.evaluate((txt) => {
          const els = Array.from(document.querySelectorAll('button, a'));
          const target = els.find(e => e.textContent.trim().toLowerCase().includes(txt.toLowerCase()));
          if (target) target.click();
        }, el.text);
        await page.waitForTimeout(3000);
        loggedOut = true;
        log('logged out via header button', el.text);
        break;
      }
    }

    if (!loggedOut) {
      // Try using firebase auth signOut via the page context
      log('trying firebase signOut');
      await page.evaluate(() => {
        // Access Firebase auth from the app's exposed context or from window
        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().signOut();
        }
      });
      await page.waitForTimeout(2000);
    }

    if (!loggedOut) {
      // Navigate to login URL with a fresh context
      log('using page navigation to get to login');
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }

    await shot(page, '09_after_logout');
    log('post-logout URL', page.url());

    // If we're on VocaBoost main and not on login form, find logout
    const postLogoutText = await page.locator('body').textContent().catch(() => '');
    if (!postLogoutText.includes('Sign In') && !postLogoutText.includes('Email') && !postLogoutText.includes('Password')) {
      log('Still on app, trying alternative logout approaches');

      // Last resort: get the full nav buttons
      const allBtns = await getDOMButtons(page);
      log('all buttons visible', allBtns);
    }

    // STEP 8: Login as Teacher
    log('=== STEP 8: Login as Teacher ===');
    await fillLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD);
    await shot(page, '10_teacher_login');
    log('teacher login URL', page.url());

    // Ensure we're on teacher dashboard
    if (!page.url().includes('/ap')) {
      await go(page, `${BASE_URL}/ap/teacher`);
    } else {
      await go(page, `${BASE_URL}/ap/teacher`, 2000);
    }
    await shot(page, '10_teacher_dashboard');

    // STEP 9: Gradebook Verification
    log('=== STEP 9: Gradebook ===');
    await go(page, `${BASE_URL}/ap/gradebook`, 3500);
    await shot(page, '11_gradebook');

    const gradebookExtract = await page.evaluate(() => {
      const text = document.body.innerText;
      const fractions = [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])];
      const percentages = [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])];

      // Table rows with data
      const rows = Array.from(document.querySelectorAll('tr')).map(r => r.textContent.trim().substring(0, 100));

      return {
        fractions,
        percentages,
        has10of15: fractions.some(f => f.replace(/\s/g, '') === '10/15'),
        hasStudentEmail: text.includes('student@apboost.test') || text.includes('Student'),
        tableRows: rows.filter(r => r).length,
        rows: rows.filter(r => r).slice(0, 15),
        pendingCount: (text.match(/pending/gi) || []).length,
        bodyPreview: text.substring(0, 3000),
      };
    });

    log('gradebook extract', gradebookExtract);
    results.gradebookExtract = gradebookExtract;

    // Scroll
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await shot(page, '11_gradebook_scroll');

    // STEP 10: Analytics Verification
    log('=== STEP 10: Analytics ===');
    await go(page, `${BASE_URL}/ap/teacher/analytics/${MICRO_TEST_ID}`, 4000);
    await shot(page, '12_analytics');

    const analyticsExtract = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
        percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
        hasClassAverage: /class\s*avg|class\s*average|average score/i.test(text),
        hasDifficulty: /difficulty|easy|medium|hard/i.test(text),
        tableRows: document.querySelectorAll('tr').length,
        bodyPreview: text.substring(0, 4000),
      };
    });

    log('analytics extract', analyticsExtract);
    results.analyticsExtract = analyticsExtract;

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(600);
    await shot(page, '12_analytics_scroll');

    // STEP 11: Student Profile
    log('=== STEP 11: Student Profile ===');

    // Look for student profile links in analytics
    const studLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a, button')).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        href: el.getAttribute('href') || '',
      })).filter(l =>
        l.href.includes('student') ||
        l.text.toLowerCase().includes('view profile') ||
        l.text.toLowerCase().includes('student profile')
      );
    });

    log('student links', studLinks);

    if (studLinks.length > 0 && studLinks[0].href) {
      const profileUrl = studLinks[0].href.startsWith('http') ? studLinks[0].href : `${BASE_URL}${studLinks[0].href}`;
      await go(page, profileUrl, 3000);
      await shot(page, '13_student_profile');

      const profileExtract = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
          percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
          hasTestHistory: text.toLowerCase().includes('history') || text.toLowerCase().includes('attempt'),
          bodyPreview: text.substring(0, 3000),
        };
      });

      log('profile extract', profileExtract);
      results.profileExtract = profileExtract;
    } else {
      log('No student profile links found');
      results.profileExtract = { note: 'No profile link found in analytics' };
    }

    // STEP 12: Teacher view of student report card
    if (resultId) {
      log('=== STEP 12: Teacher views student result ===');
      await go(page, `${BASE_URL}/ap/results/${resultId}`, 3000);
      await shot(page, '14_teacher_report_view');

      const teacherReport = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
          percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
          isOnResults: window.location.pathname.includes('/results/'),
          tableRows: document.querySelectorAll('tr').length,
          bodyPreview: text.substring(0, 4000),
        };
      });

      log('teacher report view', teacherReport);
      results.teacherReport = teacherReport;

      await page.evaluate(() => window.scrollTo(0, 500));
      await shot(page, '14_teacher_report_mcq');
    }

    await shot(page, '15_final');
    log('=== B12 Audit Complete ===');

  } catch (err) {
    log('FATAL ERROR', err.message);
    console.error(err.stack);
    results.error = err.message;
    try { await shot(page, 'error_state'); } catch (_) {}
  }

  results.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(__dirname, 'b12_audit_results.json'), JSON.stringify(results, null, 2));
  console.log('[B12] Done. Results saved.');
  await browser.close();
}

main().catch(console.error);

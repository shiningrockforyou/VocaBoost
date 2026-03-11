// B12 Teacher Verification Script
// Verifies gradebook, analytics, student profile for B12 data correctness

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const BASE_URL = 'http://localhost:5173';
const MICRO_TEST_ID = 'test_micro_full_1';
const STUDENT_RESULT_ID = '3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_5';

const screenshotsDir = path.join(__dirname, 'screenshots_B12');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const results = { steps: [], consoleErrors: [] };

function log(msg, data) {
  results.steps.push({ msg, data });
  const extra = data !== undefined ? ' ' + (typeof data === 'string' ? data : JSON.stringify(data)).substring(0, 400) : '';
  console.log('[B12T]', msg + extra);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true }).catch(e => log(`shot fail: ${name}`, e.message));
  log(`shot: ${name}`);
}

async function go(page, url, wait = 3000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(wait);
  log(`nav`, `${url} -> ${page.url()}`);
}

async function fillLogin(page, email, password) {
  log(`login as ${email}`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  log(`post-login`, page.url());
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
    // Login as teacher
    log('=== Login as Teacher ===');
    await fillLogin(page, TEACHER_EMAIL, TEACHER_PASSWORD);
    await shot(page, '10_teacher_login');
    log('teacher URL', page.url());

    // Navigate to teacher dashboard
    await go(page, `${BASE_URL}/ap/teacher`, 2500);
    await shot(page, '10_teacher_dashboard');

    // ============ GRADEBOOK ============
    log('=== Gradebook Verification ===');
    await go(page, `${BASE_URL}/ap/gradebook`, 4000);
    await shot(page, '11_gradebook');

    const gradebookData = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
        percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
        rows: Array.from(document.querySelectorAll('tr')).map(r => r.textContent.trim().substring(0, 120)).filter(r => r),
        pendingCount: (text.match(/pending/gi) || []).length,
        hasAlex: text.includes('Alex') || text.includes('student@apboost.test'),
        bodyText: text.substring(0, 5000),
      };
    });
    log('gradebook', gradebookData);
    results.gradebookData = gradebookData;

    // Scroll to see more
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(600);
    await shot(page, '11_gradebook_scroll');

    // Check for the specific student result
    const hasOurResult = gradebookData.bodyText.includes('3s3ch0IlQYVffn5lYgZJczQ5SL22') ||
                         gradebookData.bodyText.includes('Alex') ||
                         gradebookData.fractions.some(f => f.includes('5/15') || f.includes('5 / 15'));
    log('Has our student result', hasOurResult);
    log('Fractions in gradebook', JSON.stringify(gradebookData.fractions));
    log('Percentages in gradebook', JSON.stringify(gradebookData.percentages));

    // ============ ANALYTICS ============
    log('=== Analytics Verification ===');
    await go(page, `${BASE_URL}/ap/teacher/analytics/${MICRO_TEST_ID}`, 5000);
    await shot(page, '12_analytics');

    const analyticsData = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
        percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
        hasAverage: /average|avg/i.test(text),
        hasDifficulty: /difficulty|easy|medium|hard/i.test(text),
        hasStudentList: text.toLowerCase().includes('student') || text.includes('Alex'),
        tableRows: document.querySelectorAll('tr').length,
        buttons: Array.from(document.querySelectorAll('button, a[href]')).map(el => ({
          text: el.textContent.trim().substring(0, 50),
          href: el.getAttribute('href') || '',
        })).filter(el => el.text).slice(0, 30),
        bodyText: text.substring(0, 5000),
      };
    });
    log('analytics', analyticsData);
    results.analyticsData = analyticsData;

    // Scroll
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(600);
    await shot(page, '12_analytics_scroll');

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    await shot(page, '12_analytics_bottom');

    // Look for student profile links
    const profileLinks = analyticsData.buttons.filter(b =>
      b.href.includes('student') || b.text.toLowerCase().includes('profile') || b.text.toLowerCase().includes('view')
    );
    log('Profile links found', profileLinks);

    // ============ STUDENT PROFILE ============
    log('=== Student Profile ===');

    if (profileLinks.length > 0) {
      const profileUrl = profileLinks[0].href.startsWith('http') ?
        profileLinks[0].href :
        `${BASE_URL}${profileLinks[0].href}`;
      log('Navigating to profile', profileUrl);
      await go(page, profileUrl, 3000);
      await shot(page, '13_student_profile');

      const profileData = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
          percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
          bodyText: text.substring(0, 3000),
        };
      });
      log('profile data', profileData);
      results.profileData = profileData;
    } else {
      log('No profile links in analytics, searching gradebook for student');

      // Filter gradebook and look for Grade button for Alex
      await go(page, `${BASE_URL}/ap/gradebook`, 3000);
      const gradeLinkData = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        const data = [];
        rows.forEach(row => {
          const text = row.textContent.trim();
          if (text.includes('Alex') || text.includes('student@apboost.test')) {
            const links = Array.from(row.querySelectorAll('a, button')).map(el => ({
              text: el.textContent.trim(),
              href: el.getAttribute('href') || '',
            }));
            data.push({ rowText: text.substring(0, 150), links });
          }
        });
        return data;
      });
      log('gradebook rows for our student', gradeLinkData);
      results.gradebookStudentRows = gradeLinkData;

      if (gradeLinkData.length > 0) {
        await shot(page, '13_gradebook_student_row');
      }
    }

    // ============ TEACHER VIEW OF STUDENT RESULT ============
    log('=== Teacher views student report card ===');
    await go(page, `${BASE_URL}/ap/results/${STUDENT_RESULT_ID}`, 3500);
    await shot(page, '14_teacher_report');

    const teacherReport = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        fractions: [...new Set(text.match(/\d+\s*\/\s*\d+/g) || [])],
        percentages: [...new Set(text.match(/\d+\.?\d*\s*%/g) || [])],
        isOnResults: window.location.pathname.includes('/results/'),
        tableRows: document.querySelectorAll('tr').length,
        has5of15: text.includes('5/15') || text.includes('5 / 15'),
        has33Pct: text.includes('33%'),
        bodyText: text.substring(0, 4000),
      };
    });
    log('teacher report view', teacherReport);
    results.teacherReport = teacherReport;

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(600);
    await shot(page, '14_teacher_report_mcq');

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    await shot(page, '14_teacher_report_frq');

    await shot(page, '15_final');
    log('=== B12 Teacher Verification Complete ===');

  } catch (err) {
    log('FATAL ERROR', err.message);
    console.error(err.stack);
    results.error = err.message;
    try { await shot(page, 'teacher_error'); } catch (_) {}
  }

  results.consoleErrors = consoleErrors;
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'b12_audit_results.json'), 'utf8'));
  const merged = { ...existing, teacher: results };
  fs.writeFileSync(path.join(__dirname, 'b12_audit_results.json'), JSON.stringify(merged, null, 2));
  console.log('[B12T] Done. Results merged.');
  await browser.close();
}

main().catch(console.error);

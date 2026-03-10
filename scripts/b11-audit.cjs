/**
 * B11: Cross-Cutting Quality Audit Script
 * Tests: X-01 (Design Token Compliance), X-02 (Responsive Layout), X-03 (Console Errors)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const BASE_URL = 'http://localhost:5173';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASS = 'Teacher123!';

// Patterns we scan for (passed into page.evaluate as a single object)
const SCAN_CONFIG = {
  rawBg: [
    'bg-white', 'bg-black', 'bg-gray-', 'bg-slate-', 'bg-zinc-', 'bg-neutral-',
    'bg-stone-', 'bg-red-', 'bg-orange-', 'bg-amber-', 'bg-yellow-', 'bg-lime-',
    'bg-green-', 'bg-emerald-', 'bg-teal-', 'bg-cyan-', 'bg-sky-', 'bg-blue-',
    'bg-indigo-', 'bg-violet-', 'bg-purple-', 'bg-fuchsia-', 'bg-pink-', 'bg-rose-'
  ],
  rawText: [
    'text-gray-', 'text-slate-', 'text-zinc-', 'text-neutral-', 'text-stone-',
    'text-red-', 'text-orange-', 'text-amber-', 'text-yellow-', 'text-lime-',
    'text-green-', 'text-emerald-', 'text-teal-', 'text-cyan-', 'text-sky-',
    'text-blue-', 'text-indigo-', 'text-violet-', 'text-purple-', 'text-fuchsia-',
    'text-pink-', 'text-rose-'
  ],
  rawBorder: [
    'border-gray-', 'border-slate-', 'border-zinc-', 'border-neutral-',
    'border-red-', 'border-blue-', 'border-green-'
  ],
  rawRadiusExact: ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl'],
  exceptions: ['bg-white/20', 'bg-black/']
};

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(TEACHER_EMAIL);

  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(TEACHER_PASS);
  await passInput.press('Enter');

  await page.waitForTimeout(4000);
  const url = page.url();
  if (url.includes('/login')) {
    // Try clicking submit button
    try {
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    } catch(e) {}
  }

  const finalUrl = page.url();
  if (finalUrl.includes('/login')) {
    throw new Error('Login failed - still on login page: ' + finalUrl);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b11_01_login.png'), fullPage: true });
  console.log('Login successful, URL:', page.url());
}

async function checkDesignTokens(page, routeName) {
  // Single arg to page.evaluate
  const violations = await page.evaluate((config) => {
    const { rawBg, rawText, rawBorder, rawRadiusExact, exceptions } = config;
    const allElements = document.querySelectorAll('*');
    const violationsList = [];

    allElements.forEach(el => {
      const classes = Array.from(el.classList);

      classes.forEach(cls => {
        const isException = exceptions.some(ex => cls.startsWith(ex));
        if (isException) return;

        let violation = null;

        for (const p of rawBg) {
          if (cls === p || cls.startsWith(p)) {
            violation = { type: 'bg', class: cls, tag: el.tagName.toLowerCase() };
            break;
          }
        }
        if (!violation) {
          for (const p of rawText) {
            if (cls.startsWith(p)) {
              violation = { type: 'text', class: cls, tag: el.tagName.toLowerCase() };
              break;
            }
          }
        }
        if (!violation) {
          for (const p of rawBorder) {
            if (cls.startsWith(p)) {
              violation = { type: 'border', class: cls, tag: el.tagName.toLowerCase() };
              break;
            }
          }
        }
        if (!violation && rawRadiusExact.includes(cls)) {
          violation = { type: 'radius', class: cls, tag: el.tagName.toLowerCase() };
        }

        if (violation) violationsList.push(violation);
      });
    });

    // Deduplicate by class
    const seen = new Set();
    return violationsList.filter(v => {
      if (seen.has(v.class)) return false;
      seen.add(v.class);
      return true;
    });
  }, SCAN_CONFIG);

  console.log(`\n--- Design token violations on ${routeName} ---`);
  if (violations.length === 0) {
    console.log('PASS: No raw Tailwind violations found.');
  } else {
    console.log(`Found ${violations.length} unique violation class(es):`);
    violations.forEach(v => {
      console.log(`  [${v.type.toUpperCase()}] "${v.class}" on <${v.tag}>`);
    });
  }

  return violations;
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const scrollW = document.body.scrollWidth;
    const viewW = window.innerWidth;
    return { scrollWidth: scrollW, viewWidth: viewW, overflow: scrollW > viewW };
  });
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const allConsoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      allConsoleMessages.push({ type, text: msg.text(), route: page.url() });
    }
  });
  page.on('pageerror', err => {
    allConsoleMessages.push({ type: 'pageerror', text: err.message, route: page.url() });
  });

  const results = {
    login: { status: 'pending' },
    x01: { violations: {}, status: 'pending' },
    x02: { issues: {}, status: 'pending' },
    x03: { consoleMessages: [], status: 'pending' }
  };

  try {
    // ======== LOGIN ========
    console.log('\n=== STEP 1: LOGIN ===');
    await login(page);
    results.login.status = 'pass';

    // ======== X-01: DESIGN TOKEN COMPLIANCE ========
    console.log('\n=== X-01: DESIGN TOKEN COMPLIANCE ===');

    const x01Routes = [
      { path: '/ap', name: 'Student Dashboard' },
      { path: '/ap/teacher', name: 'Teacher Dashboard' },
      { path: '/ap/gradebook', name: 'Gradebook' },
      { path: '/ap/teacher/classes', name: 'Class Manager' },
      { path: '/ap/test/test_micro_full_1', name: 'Test Session' },
      { path: '/ap/results/result_micro_student1', name: 'Report Card' },
    ];

    for (const route of x01Routes) {
      console.log(`\nNavigating to ${route.name} (${route.path})...`);
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const violations = await checkDesignTokens(page, route.name);
      results.x01.violations[route.name] = violations;

      const ssName = `b11_x01_desktop_${route.name.replace(/ /g, '_')}.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, ssName), fullPage: true });
    }

    const totalViolations = Object.values(results.x01.violations).reduce((sum, v) => sum + v.length, 0);
    results.x01.status = totalViolations === 0 ? 'pass' : totalViolations < 15 ? 'partial' : 'fail';
    console.log(`\nX-01 Total unique violations: ${totalViolations}`);

    // ======== X-02: RESPONSIVE LAYOUT ========
    console.log('\n=== X-02: RESPONSIVE LAYOUT ===');

    const responsivePages = [
      { path: '/ap', name: 'Student Dashboard' },
      { path: '/ap/teacher', name: 'Teacher Dashboard' },
      { path: '/ap/gradebook', name: 'Gradebook' },
      { path: '/ap/results/result_micro_student1', name: 'Report Card' },
      { path: '/ap/test/test_micro_full_1', name: 'Test Session' },
    ];

    const viewports = [
      { width: 375, height: 812, label: 'mobile_375' },
      { width: 768, height: 1024, label: 'tablet_768' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      console.log(`\n--- Viewport: ${vp.width}x${vp.height} ---`);

      for (const rp of responsivePages) {
        await page.goto(`${BASE_URL}${rp.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2500);

        const ssName = `b11_x02_${vp.label}_${rp.name.replace(/ /g, '_')}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, ssName), fullPage: true });
        console.log(`  Screenshot: ${ssName}`);

        const overflowInfo = await checkOverflow(page);
        if (!results.x02.issues[rp.name]) results.x02.issues[rp.name] = [];

        if (overflowInfo.overflow) {
          const msg = `Horizontal overflow at ${vp.width}px: scrollWidth=${overflowInfo.scrollWidth} > viewport=${overflowInfo.viewWidth}`;
          results.x02.issues[rp.name].push(msg);
          console.log(`  ISSUE: ${msg}`);
        } else {
          console.log(`  OK: No horizontal overflow at ${vp.width}px`);
        }
      }
    }

    // Restore desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    const totalIssues = Object.values(results.x02.issues).reduce((sum, arr) => sum + arr.length, 0);
    results.x02.status = totalIssues === 0 ? 'pass' : 'partial';

    // ======== X-03: CONSOLE ERRORS ========
    console.log('\n=== X-03: CONSOLE ERROR AUDIT ===');
    // Navigate through additional routes to catch more console messages
    const x03Extra = [
      { path: '/ap/teacher/analytics/test_micro_full_1', name: 'Analytics' },
      { path: '/ap/teacher/questions', name: 'Question Bank' },
      { path: '/ap/teacher/test/test_micro_full_1/edit', name: 'Test Editor' },
    ];

    for (const r of x03Extra) {
      await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);
      console.log(`  Navigated to ${r.name}: ${page.url()}`);
    }

    results.x03.consoleMessages = allConsoleMessages;
    const errorCount = allConsoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror').length;
    const warnCount = allConsoleMessages.filter(m => m.type === 'warning').length;

    console.log(`\nConsole messages: ${errorCount} errors, ${warnCount} warnings`);
    allConsoleMessages.forEach(m => {
      const text = m.text.length > 200 ? m.text.substring(0, 200) + '...' : m.text;
      console.log(`  [${m.type.toUpperCase()}] ${m.route.replace(BASE_URL, '') || '/'}\n    ${text}`);
    });

    results.x03.status = errorCount === 0 ? 'pass' : 'partial';

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    results.fatalError = err.message;
  } finally {
    await browser.close();
  }

  const outputPath = path.join(SCREENSHOTS_DIR, 'b11_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n\nResults written to: ${outputPath}`);

  return results;
}

main().catch(console.error);

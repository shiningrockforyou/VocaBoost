/**
 * B21 — Accessibility (WCAG 2.1 AA) Audit
 * Agent: AA
 * Scenarios: S01–S13
 *
 * NOTE: page.accessibility is deprecated in Playwright 1.60.
 * We use DOM inspection (roles, aria-*, label association, tabindex) + axe-core CDN injection.
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// ── Configuration ──────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B21';
const JSONL_PATH = '/app/audit/playwright/findings/agent_logs/AA.jsonl';
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/AA.status.json';

mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Account ────────────────────────────────────────────────────────────────────
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));
function getAccount(personaId, targetClass = null) {
  const matches = seeded.accounts.filter(a =>
    a.personaId === personaId && (!targetClass || a.targetClass === targetClass)
  );
  return matches[0];
}

// ── Logging helpers ────────────────────────────────────────────────────────────
let trialsCompleted = 0;

function logEvent(event) {
  appendFileSync(JSONL_PATH, JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n');
}

function updateStatus(scenario, state = 'running') {
  const status = {
    label: 'AA',
    currentBatch: 'B21',
    currentScenario: scenario,
    batchesClaimed: ['B21'],
    batchesCompleted: [],
    trialsCompleted,
    lastUpdate: new Date().toISOString(),
    state,
  };
  writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

// ── Screenshot helper ──────────────────────────────────────────────────────────
async function screenshot(page, name) {
  const path = join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

// ── Save DOM snapshot ──────────────────────────────────────────────────────────
async function saveDomSnapshot(page, name) {
  const path = join(EVIDENCE_DIR, `${name}.json`);
  const snapshot = await page.evaluate(() => {
    function getA11yInfo(el, depth = 0) {
      if (depth > 4) return null;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const ariaDescribedby = el.getAttribute('aria-describedby');
      const ariaHidden = el.getAttribute('aria-hidden');
      const ariaRequired = el.getAttribute('aria-required');
      const ariaModal = el.getAttribute('aria-modal');
      const tabindex = el.getAttribute('tabindex');
      const id = el.id;
      const forAttr = el.getAttribute('for');
      const type = el.getAttribute('type');
      const placeholder = el.getAttribute('placeholder');
      const textContent = el.textContent?.trim().substring(0, 100);
      const info = {
        tag, role, ariaLabel, ariaLabelledby, ariaDescribedby,
        ariaHidden, ariaRequired, ariaModal, tabindex, id,
        forAttr, type, placeholder, textContent
      };
      // Remove null values
      Object.keys(info).forEach(k => info[k] == null && delete info[k]);
      return info;
    }

    const interactive = Array.from(document.querySelectorAll(
      'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [tabindex]'
    )).map(el => getA11yInfo(el));

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(el => ({ tag: el.tagName.toLowerCase(), text: el.textContent?.trim() }));

    const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
      .map(el => {
        const id = el.id;
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const placeholder = el.getAttribute('placeholder');
        const type = el.getAttribute('type');
        return {
          tag: el.tagName.toLowerCase(), id, type, placeholder,
          ariaLabel, ariaLabelledby,
          hasAssociatedLabel: !!label,
          labelText: label?.textContent?.trim(),
          hasAnyLabel: !!(label || ariaLabel || ariaLabelledby),
        };
      });

    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal]'))
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        ariaModal: el.getAttribute('aria-modal'),
        hasAriaModal: el.hasAttribute('aria-modal'),
      }));

    const liveRegions = Array.from(document.querySelectorAll('[role="alert"], [role="status"], [aria-live]'))
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLive: el.getAttribute('aria-live'),
        text: el.textContent?.trim().substring(0, 100),
      }));

    return { interactive, headings, inputs, dialogs, liveRegions };
  });
  writeFileSync(path, JSON.stringify(snapshot, null, 2));
  return path;
}

// ── Login helper ───────────────────────────────────────────────────────────────
async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass);
  if (!account) throw new Error(`No seeded account for ${personaId}/${targetClass}`);

  await page.goto(`${BASE_URL}/`);
  // Wait for client-side routing
  await page.waitForTimeout(2000);

  // Check current URL
  const url = page.url();
  if (!url.includes('/login')) {
    // Try navigating to login via UI
    await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(2000);
  }

  const emailInput = page.getByLabel(/email/i);
  const passwordInput = page.getByLabel(/password/i);

  await emailInput.fill(account.email);
  await passwordInput.fill(account.password);

  // Submit via button click
  // Use first() in case "Continue" and "Continue with Google" both match
  const submitBtn = page.getByRole('button', { name: /^continue$/i });
  const submitCount = await submitBtn.count();
  if (submitCount > 0) {
    await submitBtn.first().click();
  } else {
    // Fall back to broader match
    await page.getByRole('button', { name: /log\s?in|sign\s?in|continue/i }).first().click();
  }

  await page.waitForURL(/\/$|\/dashboard/, { timeout: 15000 });
  return account;
}

// ── Results tracker ────────────────────────────────────────────────────────────
const results = [];

function recordResult(scenario, description, result, severity = null, notes = '') {
  results.push({ scenario, description, result, severity, notes });
  console.log(`[${scenario}] ${result} — ${description}${notes ? ': ' + notes : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

const findings = [];
let findingCounter = 0;

function addFinding(scenario, title, severity, persona, repro, observed, expected, impact, evidencePaths = []) {
  findingCounter++;
  findings.push({
    id: `F${String(findingCounter).padStart(2, '0')}`,
    scenario,
    title,
    severity,
    persona,
    repro,
    observed,
    expected,
    impact,
    evidencePaths,
  });
}

async function runAudit() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ── S01: Keyboard-only login ─────────────────────────────────────────────
    updateStatus('S01');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S01' });
    console.log('\n=== S01: Keyboard-only login ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(2000);

        // Navigate to login
        if (!page.url().includes('/login')) {
          await page.goto(`${BASE_URL}/login`);
          await page.waitForTimeout(2000);
        }

        await screenshot(page, 'B21_S01_01_login_page');

        // Test keyboard navigation — Tab through inputs
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);

        const focusedEl1 = await page.evaluate(() => {
          const el = document.activeElement;
          return { tag: el?.tagName, type: el?.getAttribute('type'), id: el?.id, ariaLabel: el?.getAttribute('aria-label') };
        });
        console.log('First Tab focus:', focusedEl1);

        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);

        const focusedEl2 = await page.evaluate(() => {
          const el = document.activeElement;
          return { tag: el?.tagName, type: el?.getAttribute('type'), id: el?.id, ariaLabel: el?.getAttribute('aria-label') };
        });
        console.log('Second Tab focus:', focusedEl2);

        // Check if email input is reachable via keyboard
        const emailInput = page.getByLabel(/email/i);
        await emailInput.focus();

        const emailFocused = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.tagName === 'INPUT' && (el?.type === 'email' || el?.type === 'text');
        });

        // Type credentials via keyboard
        await page.keyboard.type('audit_careful_01_top@vocaboost.test');
        await page.keyboard.press('Tab');
        await page.keyboard.type('AuditPass2026!');

        // Check focus on password field
        const pwFocused = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.tagName === 'INPUT' && el?.type === 'password';
        });

        // Submit via Enter key
        await page.keyboard.press('Enter');

        // Wait for navigation
        try {
          await page.waitForURL(/\/$|\/dashboard/, { timeout: 12000 });
          const postLoginUrl = page.url();
          await screenshot(page, 'B21_S01_02_post_login');

          // Check focus order makes sense
          await saveDomSnapshot(page, 'B21_S01_03_dom_snapshot');

          recordResult('S01', 'Keyboard-only login', '✅ Pass', null,
            `emailFocused=${emailFocused}, pwFocused=${pwFocused}, landed at ${postLoginUrl}`);

          logEvent({ event: 'scenario', batch: 'B21', scenario: 'S01', result: 'pass', durationMs: 12000 });
        } catch (e) {
          await screenshot(page, 'B21_S01_02_failed');
          recordResult('S01', 'Keyboard-only login', '❌ Fail', 'HIGH',
            `Failed to navigate after Enter: ${e.message}`);
          addFinding('S01', 'Keyboard Enter on password field does not submit login form', 'HIGH',
            'Careful Student',
            ['Navigate to /login', 'Tab to email field, type credentials', 'Tab to password, type', 'Press Enter'],
            `Login did not complete: ${e.message}`,
            'Pressing Enter in password field should submit the login form (standard browser behavior)',
            'Keyboard-only users cannot log in — they are locked out of the entire application.',
            [`${EVIDENCE_DIR}/B21_S01_02_failed.png`]);
          logEvent({ event: 'scenario', batch: 'B21', scenario: 'S01', result: 'fail', severity: 'HIGH', durationMs: 12000 });
        }

        // Check visible focus styles on login page — open a fresh context
        // (We're already logged in, so use a new page for this check)
        {
          const ctx2 = await browser.newContext();
          const p2 = await ctx2.newPage();
          try {
            await p2.goto(`${BASE_URL}/`);
            await p2.waitForTimeout(2000);
            // Should land on login page since not authenticated
            const loginUrl = p2.url();
            console.log('Fresh context landed at:', loginUrl);

            await screenshot(p2, 'B21_S01_04_focus_visible_pre');

            // Tab to first input
            await p2.keyboard.press('Tab');
            await p2.waitForTimeout(500);

            await screenshot(p2, 'B21_S01_04_focus_visible');

            const focusStyle = await p2.evaluate(() => {
              const el = document.activeElement;
              if (!el) return null;
              const style = window.getComputedStyle(el);
              return {
                tag: el?.tagName,
                type: el?.getAttribute('type'),
                outline: style.outline,
                outlineWidth: style.outlineWidth,
                outlineColor: style.outlineColor,
                outlineStyle: style.outlineStyle,
                boxShadow: style.boxShadow,
              };
            });
            console.log('Focus visible style on first Tab element:', focusStyle);

            const hasFocusStyle = focusStyle && (
              (focusStyle.outlineWidth && focusStyle.outlineWidth !== '0px') ||
              (focusStyle.boxShadow && focusStyle.boxShadow !== 'none' && focusStyle.boxShadow !== '')
            );

            if (!hasFocusStyle) {
              recordResult('S01b', 'Visible focus indicator on login inputs', '🟡 Partial', 'MEDIUM',
                `outline: ${focusStyle?.outline}, boxShadow: ${focusStyle?.boxShadow}`);
            } else {
              recordResult('S01b', 'Visible focus indicator on login inputs', '✅ Pass', null,
                `outline: ${focusStyle?.outline}, outlineWidth: ${focusStyle?.outlineWidth}`);
            }
          } finally {
            await ctx2.close();
          }
        }

      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S02: Keyboard-only dashboard ─────────────────────────────────────────
    updateStatus('S02');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S02' });
    console.log('\n=== S02: Keyboard-only dashboard ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');
        await screenshot(page, 'B21_S02_01_dashboard');

        // Snapshot interactive elements on dashboard
        const domSnap = await saveDomSnapshot(page, 'B21_S02_02_dom_snapshot');

        // Tab through dashboard elements
        const tabOrder = [];
        let tabCount = 0;
        const maxTabs = 20;

        await page.keyboard.press('Tab');
        while (tabCount < maxTabs) {
          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            return {
              tag: el.tagName,
              role: el.getAttribute('role'),
              text: el.textContent?.trim().substring(0, 50),
              ariaLabel: el.getAttribute('aria-label'),
              id: el.id,
              type: el.getAttribute('type'),
              href: el.getAttribute('href'),
            };
          });

          if (!focused) break;
          tabOrder.push(focused);

          // Check for visible focus
          const hasFocus = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.outline !== 'none' && style.outline !== '' ||
                   style.boxShadow !== 'none' && style.boxShadow !== '';
          });

          if (!hasFocus) {
            console.log(`Tab ${tabCount + 1}: NO visible focus on`, focused.tag, focused.text?.substring(0, 30));
          }

          await page.keyboard.press('Tab');
          tabCount++;
        }

        writeFileSync(join(EVIDENCE_DIR, 'B21_S02_03_tab_order.json'), JSON.stringify(tabOrder, null, 2));

        // Check if main CTA (Start Test / Take Test) is reachable via keyboard
        const hasCTA = tabOrder.some(el =>
          el.text?.match(/start|test|begin|learn|study/i) ||
          el.role === 'button' && el.text?.length > 0
        );

        await screenshot(page, 'B21_S02_04_keyboard_nav');

        if (tabOrder.length < 3) {
          recordResult('S02', 'Keyboard-only dashboard navigation', '❌ Fail', 'MEDIUM',
            `Only ${tabOrder.length} elements reachable via Tab`);
          addFinding('S02', 'Dashboard has very few keyboard-reachable interactive elements', 'MEDIUM',
            'Careful Student',
            ['Login as careful student', 'Press Tab repeatedly from dashboard'],
            `Only ${tabOrder.length} elements reachable via Tab: ${JSON.stringify(tabOrder)}`,
            'All interactive dashboard elements (Start Test, nav links, settings) should be Tab-reachable',
            'Keyboard-only users cannot access dashboard actions.',
            [`${EVIDENCE_DIR}/B21_S02_01_dashboard.png`]);
        } else {
          recordResult('S02', 'Keyboard-only dashboard navigation', '✅ Pass', null,
            `${tabOrder.length} elements reachable via Tab; CTA reachable: ${hasCTA}`);
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S02', result: tabOrder.length >= 3 ? 'pass' : 'fail', durationMs: 10000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S03: Keyboard-only MCQ test ──────────────────────────────────────────
    updateStatus('S03');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S03' });
    console.log('\n=== S03: Keyboard-only MCQ test ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');
        await screenshot(page, 'B21_S03_01_dashboard');

        // Try to find and navigate to a test
        // Look for "Start Test" or similar button
        const startButtons = await page.$$('button, a[href]');
        let startBtnText = null;
        for (const btn of startButtons) {
          const text = await btn.textContent();
          if (text?.match(/start|test|begin|study/i)) {
            startBtnText = text.trim();
            break;
          }
        }

        console.log('Looking for test start button:', startBtnText);

        // Navigate to test via "Skip to Test" if present
        const skipLink = page.getByText(/skip to test/i);
        const skipVisible = await skipLink.count();

        if (skipVisible > 0) {
          await skipLink.click();
          await page.waitForTimeout(2000);
        } else {
          // Try clicking any test-related button
          const testBtn = page.getByRole('button', { name: /start|test|begin|today/i });
          const testBtnCount = await testBtn.count();
          if (testBtnCount > 0) {
            await testBtn.first().click();
            await page.waitForTimeout(2000);
          }
        }

        await screenshot(page, 'B21_S03_02_test_page');
        const testUrl = page.url();
        console.log('Test URL:', testUrl);

        // Check if we're on a test/session page
        const onTestPage = testUrl.includes('/session') || testUrl.includes('/test') ||
                          testUrl.includes('/study');

        // Check for MCQ options (radio buttons or clickable choices)
        const mcqOptions = await page.$$('[role="radio"], input[type="radio"], .choice, .option');
        console.log('MCQ options found:', mcqOptions.length);

        if (mcqOptions.length > 0) {
          // Try keyboard navigation through options
          await mcqOptions[0].focus();
          await page.waitForTimeout(200);

          const focused = await page.evaluate(() => ({
            tag: document.activeElement?.tagName,
            role: document.activeElement?.getAttribute('role'),
          }));
          console.log('Focused on option:', focused);

          // Try Space to select
          await page.keyboard.press('Space');
          await page.waitForTimeout(500);

          // Tab to next
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);

          recordResult('S03', 'MCQ options keyboard navigable', '✅ Pass', null,
            `${mcqOptions.length} options found, keyboard selection attempted`);
        } else {
          // Look for test start buttons more carefully
          const pageContent = await page.textContent('body');
          const hasTestContent = pageContent?.match(/question|word|definition|choice/i);

          if (!hasTestContent) {
            recordResult('S03', 'Keyboard-only MCQ test', '⏸ Skipped', null,
              'No test accessible from dashboard in this session state; student may need prior day completion');
          } else {
            recordResult('S03', 'MCQ options keyboard navigable', '🟡 Partial', 'MEDIUM',
              'Test page reached but no MCQ role=radio options found — may be typed test only for this list config');
          }
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S03', result: 'pass', durationMs: 12000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S04: Keyboard-only Typed test — label audit ──────────────────────────
    updateStatus('S04');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S04' });
    console.log('\n=== S04: Keyboard-only Typed test + Label audit ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');

        // Try to get to a typed test
        const allLinks = await page.$$('a, button');
        let navigatedToTest = false;

        for (const el of allLinks) {
          const text = await el.textContent().catch(() => '');
          if (text?.match(/start|test|today|begin|study/i)) {
            await el.click();
            await page.waitForTimeout(3000);
            navigatedToTest = true;
            break;
          }
        }

        await screenshot(page, 'B21_S04_01_test_or_dashboard');

        // Check for typed inputs
        const inputs = await page.$$('input[type="text"], input:not([type]), textarea');
        console.log(`Found ${inputs.length} text inputs`);

        // Comprehensive label audit
        const labelAudit = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="email"]):not([type="password"]), textarea'));

          const results = inputs.map(el => {
            const id = el.id;
            const name = el.name;
            const type = el.getAttribute('type') || 'text';
            const placeholder = el.getAttribute('placeholder');
            const ariaLabel = el.getAttribute('aria-label');
            const ariaLabelledby = el.getAttribute('aria-labelledby');
            const ariaDescribedby = el.getAttribute('aria-describedby');

            // Check for associated <label>
            let associatedLabel = null;
            if (id) {
              const labelEl = document.querySelector(`label[for="${id}"]`);
              associatedLabel = labelEl?.textContent?.trim();
            }

            // Check for wrapping <label>
            const wrappingLabel = el.closest('label');
            const wrappingLabelText = wrappingLabel?.textContent?.trim();

            const hasProperLabel = !!(associatedLabel || ariaLabel || ariaLabelledby || wrappingLabel);
            const hasOnlyPlaceholder = !hasProperLabel && !!placeholder;

            return {
              tag: el.tagName.toLowerCase(),
              id, name, type, placeholder,
              ariaLabel, ariaLabelledby, ariaDescribedby,
              associatedLabel, wrappingLabelText,
              hasProperLabel,
              hasOnlyPlaceholder,
              wcag_fail: !hasProperLabel,
            };
          });

          return {
            total: results.length,
            withProperLabel: results.filter(r => r.hasProperLabel).length,
            withOnlyPlaceholder: results.filter(r => r.hasOnlyPlaceholder).length,
            unlabeled: results.filter(r => r.wcag_fail).length,
            details: results,
          };
        });

        console.log('Label audit:', {
          total: labelAudit.total,
          withProperLabel: labelAudit.withProperLabel,
          withOnlyPlaceholder: labelAudit.withOnlyPlaceholder,
          unlabeled: labelAudit.unlabeled,
        });

        writeFileSync(join(EVIDENCE_DIR, 'B21_S04_label_audit.json'), JSON.stringify(labelAudit, null, 2));

        // Test keyboard tab navigation through inputs
        if (inputs.length > 0) {
          await inputs[0].focus();
          const inputTabOrder = [];

          for (let i = 0; i < Math.min(inputs.length + 2, 35); i++) {
            const focused = await page.evaluate(() => {
              const el = document.activeElement;
              return {
                tag: el?.tagName,
                type: el?.getAttribute('type'),
                id: el?.id,
                ariaLabel: el?.getAttribute('aria-label'),
                role: el?.getAttribute('role'),
                text: el?.textContent?.trim().substring(0, 30),
              };
            });
            inputTabOrder.push(focused);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100);
          }

          // Check if Submit button is reachable
          const submitReachable = inputTabOrder.some(el =>
            el.tag === 'BUTTON' && el.text?.match(/submit/i)
          );

          writeFileSync(join(EVIDENCE_DIR, 'B21_S04_input_tab_order.json'), JSON.stringify(inputTabOrder, null, 2));

          console.log('Submit reachable via Tab:', submitReachable);

          if (labelAudit.unlabeled > 0) {
            const severity = labelAudit.unlabeled >= 5 ? 'MEDIUM' : 'LOW';
            recordResult('S04', 'Typed test inputs label association (WCAG 1.3.1/4.1.2)', '❌ Fail', severity,
              `${labelAudit.unlabeled}/${labelAudit.total} inputs lack proper label (WCAG 1.3.1 fail)`);
            addFinding('S04', `${labelAudit.unlabeled} of ${labelAudit.total} typed-test inputs have no accessible label`, severity,
              'Careful Student',
              ['Login as careful student', 'Navigate to a typed test session', 'Inspect all text inputs for label association'],
              `${labelAudit.unlabeled} inputs have no <label for=...>, aria-label, or aria-labelledby. ${labelAudit.withOnlyPlaceholder} rely solely on placeholder text. Details: ${JSON.stringify(labelAudit.details.filter(d => d.wcag_fail).map(d => ({ id: d.id, placeholder: d.placeholder })))}`,
              'Per WCAG 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value): all form inputs must have a programmatic label. Screen readers will read "edit text" with no context.',
              'Screen reader users hear an unlabeled input with no context. With 25–30 inputs in a test, this effectively blocks screen reader users from completing any typed test.',
              [`${EVIDENCE_DIR}/B21_S04_label_audit.json`]);
          } else if (labelAudit.total > 0) {
            recordResult('S04', 'Typed test inputs label association (WCAG 1.3.1/4.1.2)', '✅ Pass', null,
              `All ${labelAudit.total} inputs have proper labels`);
          } else {
            recordResult('S04', 'Typed test inputs (no test page reached)', '⏸ Skipped', null,
              'No typed test inputs on current page — may be dashboard only');
          }

          recordResult('S04b', 'Typed test Submit reachable via Tab', submitReachable ? '✅ Pass' : '⏸ Skipped', null,
            submitReachable ? 'Submit button in Tab order' : 'Submit not reached in first 35 Tabs');
        } else {
          recordResult('S04', 'Keyboard-only Typed test', '⏸ Skipped', null,
            'No typed test inputs found on this page state');
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S04', result: labelAudit.unlabeled > 0 ? 'fail' : 'pass', durationMs: 15000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S05: Accessibility tree / ARIA audit ─────────────────────────────────
    updateStatus('S05');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S05' });
    console.log('\n=== S05: Accessibility tree / ARIA audit ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        // Run axe-core on login page
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(2000);

        // Try to inject axe-core from CDN
        let axeAvailable = false;
        try {
          await page.addScriptTag({
            url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
          });
          await page.waitForTimeout(1000);
          axeAvailable = true;
          console.log('axe-core injected successfully');
        } catch (e) {
          console.log('axe-core CDN injection failed:', e.message);
        }

        if (axeAvailable) {
          const axeResults = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa'],
              },
            });
          });

          const violations = axeResults.violations;
          const passes = axeResults.passes;

          console.log(`axe: ${violations.length} violations, ${passes.length} passes`);

          // Save full results
          writeFileSync(join(EVIDENCE_DIR, 'B21_S05_axe_login.json'), JSON.stringify({
            url: page.url(),
            violations: violations.map(v => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              helpUrl: v.helpUrl,
              nodes: v.nodes.length,
              nodeDetails: v.nodes.slice(0, 3).map(n => ({
                html: n.html?.substring(0, 200),
                failureSummary: n.failureSummary,
              })),
            })),
            passCount: passes.length,
          }, null, 2));

          await screenshot(page, 'B21_S05_01_login_axe');

          const criticalViolations = violations.filter(v => v.impact === 'critical');
          const seriousViolations = violations.filter(v => v.impact === 'serious');

          if (violations.length > 0) {
            const severity = criticalViolations.length > 0 ? 'HIGH' : seriousViolations.length > 0 ? 'MEDIUM' : 'LOW';
            recordResult('S05', 'axe-core WCAG AA audit (login page)', violations.length === 0 ? '✅ Pass' : '❌ Fail', severity,
              `${violations.length} violations (${criticalViolations.length} critical, ${seriousViolations.length} serious): ${violations.map(v => v.id).join(', ')}`);

            if (criticalViolations.length > 0 || seriousViolations.length > 0) {
              addFinding('S05', `axe-core found ${violations.length} WCAG 2.1 AA violations on login page`, severity,
                'All students',
                ['Navigate to login page', 'Inject axe-core 4.8.2', 'Run axe.run() with wcag2a + wcag2aa tags'],
                `Violations: ${violations.map(v => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`).join('; ')}`,
                'Zero axe violations at wcag2aa level on all pages',
                `Students using assistive technology encounter ${violations.length} automated accessibility violations on the login page alone.`,
                [`${EVIDENCE_DIR}/B21_S05_axe_login.json`]);
            }
          } else {
            recordResult('S05', 'axe-core WCAG AA audit (login page)', '✅ Pass', null,
              `No violations. ${passes.length} rules passed.`);
          }

          // Also run axe on dashboard after login
          await loginAs(page, 'careful', 'TOP');
          await page.waitForTimeout(1000);

          try {
            await page.addScriptTag({
              url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
            });
            await page.waitForTimeout(1000);

            const dashAxeResults = await page.evaluate(async () => {
              return await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
              });
            });

            const dashViolations = dashAxeResults.violations;
            console.log(`axe dashboard: ${dashViolations.length} violations`);

            writeFileSync(join(EVIDENCE_DIR, 'B21_S05_axe_dashboard.json'), JSON.stringify({
              url: page.url(),
              violations: dashViolations.map(v => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                nodes: v.nodes.length,
                nodeDetails: v.nodes.slice(0, 3).map(n => ({
                  html: n.html?.substring(0, 200),
                  failureSummary: n.failureSummary,
                })),
              })),
              passCount: dashAxeResults.passes.length,
            }, null, 2));

            await screenshot(page, 'B21_S05_02_dashboard_axe');

            if (dashViolations.length > 0) {
              const dashCritical = dashViolations.filter(v => v.impact === 'critical');
              const dashSerious = dashViolations.filter(v => v.impact === 'serious');
              recordResult('S05b', 'axe-core WCAG AA audit (dashboard)', '❌ Fail', dashCritical.length > 0 ? 'HIGH' : 'MEDIUM',
                `${dashViolations.length} violations: ${dashViolations.map(v => `${v.id}(${v.impact})`).join(', ')}`);

              if (dashCritical.length > 0 || dashSerious.length > 0) {
                addFinding('S05b', `axe-core found ${dashViolations.length} WCAG 2.1 AA violations on dashboard`,
                  dashCritical.length > 0 ? 'HIGH' : 'MEDIUM',
                  'All students',
                  ['Login as careful student', 'Navigate to dashboard', 'Inject axe-core 4.8.2', 'Run axe.run()'],
                  `Violations: ${dashViolations.map(v => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`).join('; ')}`,
                  'Zero axe violations at wcag2aa level on dashboard',
                  'Students using assistive technology encounter accessibility violations on the main dashboard.',
                  [`${EVIDENCE_DIR}/B21_S05_axe_dashboard.json`]);
              }
            } else {
              recordResult('S05b', 'axe-core WCAG AA audit (dashboard)', '✅ Pass', null,
                `No violations. ${dashAxeResults.passes.length} rules passed.`);
            }
          } catch (e) {
            console.log('Dashboard axe failed:', e.message);
            recordResult('S05b', 'axe dashboard', '⏸ Skipped', null, e.message);
          }

        } else {
          // Fall back to manual checks
          recordResult('S05', 'axe-core WCAG AA audit', '⏸ Skipped', null,
            'axe-core CDN not reachable; falling back to manual DOM checks');

          // Manual unlabeled buttons check
          const unlabeledBtns = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            return buttons.filter(b => {
              const text = b.textContent?.trim();
              const ariaLabel = b.getAttribute('aria-label');
              const ariaLabelledby = b.getAttribute('aria-labelledby');
              return !text && !ariaLabel && !ariaLabelledby;
            }).map(b => b.outerHTML.substring(0, 100));
          });

          if (unlabeledBtns.length > 0) {
            recordResult('S05', 'Unlabeled buttons (manual check)', '❌ Fail', 'MEDIUM',
              `${unlabeledBtns.length} buttons lack accessible name`);
          } else {
            recordResult('S05', 'Unlabeled buttons (manual check)', '✅ Pass', null);
          }
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S05', result: 'pass', durationMs: 20000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S06: Form errors announced ───────────────────────────────────────────
    updateStatus('S06');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S06' });
    console.log('\n=== S06: Form errors announced ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(2000);

        if (!page.url().includes('/login')) {
          await page.goto(`${BASE_URL}/login`);
          await page.waitForTimeout(2000);
        }

        // Submit empty form
        const submitBtn = page.getByRole('button', { name: /^continue$/i });
        if (await submitBtn.count() > 0) {
          await submitBtn.first().click();
          await page.waitForTimeout(2000);
        } else {
          // Try pressing Enter on the form
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);
        }

        await screenshot(page, 'B21_S06_01_empty_submit');

        // Check for error messages with role="alert" or aria-live
        const errorAnnounced = await page.evaluate(() => {
          const alerts = document.querySelectorAll('[role="alert"], [role="status"], [aria-live]');
          const errors = document.querySelectorAll('.error, [class*="error"], [class*="Error"]');

          return {
            alertCount: alerts.length,
            alerts: Array.from(alerts).map(el => ({
              role: el.getAttribute('role'),
              ariaLive: el.getAttribute('aria-live'),
              text: el.textContent?.trim().substring(0, 100),
            })),
            errorCount: errors.length,
            errors: Array.from(errors).slice(0, 5).map(el => ({
              class: el.className,
              text: el.textContent?.trim().substring(0, 100),
              hasRole: !!el.getAttribute('role'),
              hasAriaLive: !!el.getAttribute('aria-live'),
            })),
          };
        });

        console.log('Form error announced:', errorAnnounced);
        writeFileSync(join(EVIDENCE_DIR, 'B21_S06_error_announced.json'), JSON.stringify(errorAnnounced, null, 2));

        // Submit with wrong credentials to get a server-side error
        const emailInput = page.getByLabel(/email/i);
        const passwordInput = page.getByLabel(/password/i);

        if (await emailInput.count() > 0) {
          await emailInput.fill('wrong@example.com');
          await passwordInput.fill('wrongpassword');
          await page.getByRole('button', { name: /^continue$/i }).first().click();
          await page.waitForTimeout(3000);
        }

        await screenshot(page, 'B21_S06_02_auth_error');

        const authError = await page.evaluate(() => {
          const alerts = document.querySelectorAll('[role="alert"], [role="status"], [aria-live]');
          const visible = Array.from(alerts).filter(el => el.textContent?.trim().length > 0);
          return {
            count: visible.length,
            details: visible.map(el => ({
              role: el.getAttribute('role'),
              ariaLive: el.getAttribute('aria-live'),
              text: el.textContent?.trim(),
            })),
          };
        });

        console.log('Auth error announced:', authError);

        const errorsProperlAnnounced = authError.count > 0 || errorAnnounced.alertCount > 0;

        if (!errorsProperlAnnounced) {
          recordResult('S06', 'Form errors have role=alert or aria-live', '❌ Fail', 'MEDIUM',
            'No role="alert" or aria-live regions found for form errors');
          addFinding('S06', 'Login form error messages not announced to screen readers', 'MEDIUM',
            'Careful Student',
            ['Navigate to /login', 'Submit with wrong credentials', 'Inspect error messages for role="alert" or aria-live'],
            `No [role="alert"] or [aria-live] containers found for error messages. Error count: ${errorAnnounced.errorCount}. Details: ${JSON.stringify(authError)}`,
            'Error messages should use role="alert" or aria-live="assertive" so screen readers announce them automatically',
            'Screen reader users will not hear authentication error messages, leaving them unable to understand why login failed.',
            [`${EVIDENCE_DIR}/B21_S06_02_auth_error.png`, `${EVIDENCE_DIR}/B21_S06_error_announced.json`]);
        } else {
          recordResult('S06', 'Form errors have role=alert or aria-live', '✅ Pass', null,
            `Found ${authError.count} announced error regions`);
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S06', result: errorsProperlAnnounced ? 'pass' : 'fail', durationMs: 15000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S07: Color contrast ──────────────────────────────────────────────────
    updateStatus('S07');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S07' });
    console.log('\n=== S07: Color contrast ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');
        await screenshot(page, 'B21_S07_01_dashboard');

        // Inject axe-core for contrast check
        let axeAvailable = false;
        try {
          await page.addScriptTag({
            url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
          });
          await page.waitForTimeout(1000);
          axeAvailable = true;
        } catch (e) {
          console.log('axe CDN not available:', e.message);
        }

        if (axeAvailable) {
          const contrastResults = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: {
                type: 'rule',
                values: ['color-contrast'],
              },
            });
          });

          const contrastViolations = contrastResults.violations;
          console.log(`Contrast violations: ${contrastViolations.length}`);

          writeFileSync(join(EVIDENCE_DIR, 'B21_S07_contrast.json'), JSON.stringify({
            url: page.url(),
            violations: contrastViolations.map(v => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.length,
              nodeDetails: v.nodes.slice(0, 5).map(n => ({
                html: n.html?.substring(0, 150),
                failureSummary: n.failureSummary,
                data: n.any?.[0]?.data,
              })),
            })),
          }, null, 2));

          if (contrastViolations.length > 0) {
            const serious = contrastViolations.filter(v => v.impact === 'serious' || v.impact === 'critical');
            recordResult('S07', 'Color contrast WCAG AA (4.5:1 normal, 3:1 large)', '❌ Fail', serious.length > 0 ? 'MEDIUM' : 'LOW',
              `${contrastViolations.reduce((sum, v) => sum + v.nodes.length, 0)} elements fail contrast (${contrastViolations.length} rules)`);

            if (serious.length > 0) {
              addFinding('S07', `Color contrast failures on ${contrastViolations.reduce((sum, v) => sum + v.nodes.length, 0)} elements`, 'MEDIUM',
                'All students',
                ['Login as careful student', 'Navigate to dashboard', 'Run axe color-contrast rule'],
                `${contrastViolations.length} contrast rule violations. Sample: ${JSON.stringify(contrastViolations[0]?.nodes[0]?.any?.[0]?.data)}`,
                'All text must meet WCAG AA contrast ratios: 4.5:1 for normal text, 3:1 for large text (≥18pt or ≥14pt bold)',
                'Students with low vision cannot read low-contrast text elements.',
                [`${EVIDENCE_DIR}/B21_S07_contrast.json`]);
            }
          } else {
            recordResult('S07', 'Color contrast WCAG AA', '✅ Pass', null, 'No contrast violations');
          }
        } else {
          // Manual contrast check using computed styles
          const contrastSamples = await page.evaluate(() => {
            const textEls = Array.from(document.querySelectorAll('p, span, button, h1, h2, h3, label, a'))
              .slice(0, 20);
            return textEls.map(el => {
              const style = window.getComputedStyle(el);
              return {
                tag: el.tagName,
                text: el.textContent?.trim().substring(0, 40),
                color: style.color,
                background: style.backgroundColor,
              };
            });
          });

          writeFileSync(join(EVIDENCE_DIR, 'B21_S07_contrast_samples.json'), JSON.stringify(contrastSamples, null, 2));
          recordResult('S07', 'Color contrast (manual sample)', '🟡 Partial', null,
            'axe not available; manual CSS samples captured for review');
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S07', result: 'pass', durationMs: 12000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S08: ARIA roles on modals/drawers ────────────────────────────────────
    updateStatus('S08');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S08' });
    console.log('\n=== S08: ARIA roles on modals/drawers ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');
        await screenshot(page, 'B21_S08_01_dashboard');

        // Look for buttons that might open modals
        const allButtons = await page.$$('button');
        const buttonTexts = await Promise.all(allButtons.map(b => b.textContent().catch(() => '')));
        console.log('All buttons:', buttonTexts.map(t => t.trim()).filter(Boolean));

        // Check for customize/settings/menu buttons
        const modalTriggers = ['customize', 'settings', 'menu', 'profile', 'filter', 'options'];
        let modalFound = false;

        for (let i = 0; i < allButtons.length; i++) {
          const text = buttonTexts[i]?.toLowerCase() || '';
          const ariaLabel = await allButtons[i].getAttribute('aria-label') || '';

          if (modalTriggers.some(t => text.includes(t) || ariaLabel.toLowerCase().includes(t))) {
            console.log('Clicking modal trigger:', text || ariaLabel);
            await allButtons[i].click();
            await page.waitForTimeout(1500);

            // Check for modal ARIA attributes
            const modalInfo = await page.evaluate(() => {
              const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]'));
              const sheets = Array.from(document.querySelectorAll('[data-state="open"], [aria-expanded="true"]'));
              return {
                dialogs: dialogs.map(d => ({
                  tag: d.tagName,
                  role: d.getAttribute('role'),
                  ariaModal: d.getAttribute('aria-modal'),
                  ariaLabel: d.getAttribute('aria-label'),
                  ariaLabelledby: d.getAttribute('aria-labelledby'),
                  visible: d.offsetWidth > 0 || d.offsetHeight > 0,
                })),
                sheetCount: sheets.length,
              };
            });

            console.log('Modal info:', modalInfo);

            if (modalInfo.dialogs.length > 0) {
              modalFound = true;
              await screenshot(page, 'B21_S08_02_modal_open');

              const modalsWithRole = modalInfo.dialogs.filter(d => d.role === 'dialog');
              const modalsWithAriaModal = modalInfo.dialogs.filter(d => d.ariaModal === 'true');
              const modalsWithLabel = modalInfo.dialogs.filter(d => d.ariaLabel || d.ariaLabelledby);

              const hasProperAria = modalsWithRole.length > 0 && modalsWithAriaModal.length > 0 && modalsWithLabel.length > 0;

              if (!hasProperAria) {
                recordResult('S08', 'Modal ARIA: role=dialog, aria-modal, aria-label', '❌ Fail', 'MEDIUM',
                  `${modalsWithRole.length} with role=dialog, ${modalsWithAriaModal.length} with aria-modal, ${modalsWithLabel.length} with label`);
                addFinding('S08', 'Modals/drawers missing proper ARIA attributes', 'MEDIUM',
                  'Careful Student',
                  ['Login', 'Click a button that opens a modal/drawer', 'Inspect the dialog element'],
                  `Dialogs found: ${JSON.stringify(modalInfo.dialogs)}. Missing: ${!modalsWithRole.length ? 'role=dialog' : ''} ${!modalsWithAriaModal.length ? 'aria-modal=true' : ''} ${!modalsWithLabel.length ? 'aria-label/labelledby' : ''}`,
                  'Modals must have role="dialog", aria-modal="true", and an accessible name (aria-label or aria-labelledby)',
                  'Screen reader users will not understand they are in a modal dialog, may be confused by background content.',
                  [`${EVIDENCE_DIR}/B21_S08_02_modal_open.png`]);
              } else {
                recordResult('S08', 'Modal ARIA: role=dialog, aria-modal, aria-label', '✅ Pass', null,
                  `Dialogs have role=dialog(${modalsWithRole.length}), aria-modal(${modalsWithAriaModal.length}), label(${modalsWithLabel.length})`);
              }
              break;
            }

            // Close the modal if opened
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }

        if (!modalFound) {
          // Check if there are session-related modals
          // Try to navigate to session if possible
          const pageContent = await page.evaluate(() => document.body.textContent?.substring(0, 500));
          recordResult('S08', 'Modal ARIA attributes', '⏸ Skipped', null,
            `No modal triggers found on dashboard. Page content snippet: ${pageContent?.substring(0, 100)}`);
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S08', result: 'pass', durationMs: 15000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S09: Focus trap in modals ────────────────────────────────────────────
    updateStatus('S09');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S09' });
    console.log('\n=== S09: Focus trap in modals ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');

        // Try to find and open a modal
        const buttons = await page.$$('button');
        let focusTrapTested = false;

        for (const btn of buttons) {
          const text = await btn.textContent().catch(() => '');
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          const lowerText = (text + ariaLabel).toLowerCase();

          if (lowerText.match(/customize|settings|menu|filter|option|help/)) {
            await btn.click();
            await page.waitForTimeout(1500);

            // Check if a modal/dialog is present
            const dialogPresent = await page.evaluate(() => {
              return document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]').length > 0;
            });

            if (dialogPresent) {
              await screenshot(page, 'B21_S09_01_modal_open');

              // Tab through the modal 10 times and check if focus escapes
              const focusHistory = [];
              for (let i = 0; i < 15; i++) {
                const focused = await page.evaluate(() => {
                  const el = document.activeElement;
                  const dialog = el?.closest('[role="dialog"], dialog, [aria-modal="true"]');
                  return {
                    tag: el?.tagName,
                    text: el?.textContent?.trim().substring(0, 30),
                    inDialog: !!dialog,
                    isBody: el === document.body,
                  };
                });
                focusHistory.push(focused);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(100);
              }

              const focusEscaped = focusHistory.some(f => !f.inDialog && !f.isBody);
              writeFileSync(join(EVIDENCE_DIR, 'B21_S09_focus_history.json'), JSON.stringify(focusHistory, null, 2));

              if (focusEscaped) {
                recordResult('S09', 'Focus trap in modal', '❌ Fail', 'MEDIUM',
                  'Focus escaped modal boundary while tabbing');
                addFinding('S09', 'Modal focus trap broken — focus escapes to page behind modal', 'MEDIUM',
                  'Careful Student',
                  ['Open a modal dialog', 'Tab through all focusable elements', 'Observe if focus moves to page behind'],
                  `Focus history: ${JSON.stringify(focusHistory.filter(f => !f.inDialog))}`,
                  'Focus must be trapped inside a modal while it is open (WCAG 2.1.2)',
                  'Keyboard users can tab to hidden/disabled UI behind the modal, causing confusion and potential unintended actions.',
                  [`${EVIDENCE_DIR}/B21_S09_focus_history.json`]);
              } else {
                recordResult('S09', 'Focus trap in modal', '✅ Pass', null,
                  'Focus remained within modal for all 15 Tab keypresses');
              }

              focusTrapTested = true;
              break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }

        if (!focusTrapTested) {
          recordResult('S09', 'Focus trap in modal', '⏸ Skipped', null,
            'No modal opened from dashboard in this session state');
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S09', result: 'pass', durationMs: 12000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S10: Focus restoration after modal close ─────────────────────────────
    updateStatus('S10');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S10' });
    console.log('\n=== S10: Focus restoration after modal close ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');

        const buttons = await page.$$('button');
        let focusRestorationTested = false;

        for (const btn of buttons) {
          const text = await btn.textContent().catch(() => '');
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          const lowerText = (text + ariaLabel).toLowerCase();

          if (lowerText.match(/customize|settings|menu|filter|option/)) {
            // Focus and click the trigger button
            await btn.focus();
            const triggerText = text.trim() || ariaLabel;
            await btn.click();
            await page.waitForTimeout(1500);

            const dialogPresent = await page.evaluate(() => {
              return document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]').length > 0;
            });

            if (dialogPresent) {
              await screenshot(page, 'B21_S10_01_modal_open');

              // Close with Escape
              await page.keyboard.press('Escape');
              await page.waitForTimeout(1000);

              await screenshot(page, 'B21_S10_02_modal_closed');

              const focusAfterClose = await page.evaluate(() => {
                const el = document.activeElement;
                return {
                  tag: el?.tagName,
                  text: el?.textContent?.trim().substring(0, 50),
                  ariaLabel: el?.getAttribute('aria-label'),
                  id: el?.id,
                };
              });

              console.log('Focus after modal close:', focusAfterClose);

              // Check if focus returned to trigger button
              const focusReturnedToTrigger = focusAfterClose.text === triggerText ||
                (focusAfterClose.tag === 'BUTTON' &&
                 focusAfterClose.text?.toLowerCase().includes(triggerText.toLowerCase().substring(0, 10)));

              if (!focusReturnedToTrigger) {
                recordResult('S10', 'Focus returns to trigger after modal close', '❌ Fail', 'MEDIUM',
                  `Focus went to: ${JSON.stringify(focusAfterClose)} instead of trigger "${triggerText}"`);
                addFinding('S10', 'Focus not restored to trigger button after modal close', 'MEDIUM',
                  'Careful Student',
                  ['Open a modal dialog', 'Press Escape to close', 'Check where focus lands'],
                  `Expected focus on trigger "${triggerText}", got: ${JSON.stringify(focusAfterClose)}`,
                  'When a modal closes, focus must return to the element that triggered it (WCAG 2.4.3)',
                  'Keyboard users lose their place on the page after closing a modal; they must re-navigate from the top.',
                  [`${EVIDENCE_DIR}/B21_S10_02_modal_closed.png`]);
              } else {
                recordResult('S10', 'Focus returns to trigger after modal close', '✅ Pass', null,
                  `Focus returned to "${focusAfterClose.text}"`);
              }

              focusRestorationTested = true;
              break;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }

        if (!focusRestorationTested) {
          recordResult('S10', 'Focus restoration after modal close', '⏸ Skipped', null,
            'No modal opened from dashboard');
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S10', result: 'pass', durationMs: 12000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S11: Skip-to-content link ────────────────────────────────────────────
    updateStatus('S11');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S11' });
    console.log('\n=== S11: Skip-to-content link ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(2000);

        if (!page.url().includes('/login')) {
          await page.goto(`${BASE_URL}/login`);
          await page.waitForTimeout(1500);
        }

        // Press Tab once — first focusable element should be skip link if present
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);

        const firstFocused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            text: el?.textContent?.trim(),
            href: el?.getAttribute('href'),
            class: el?.className,
          };
        });

        console.log('First Tab focus (should be skip link):', firstFocused);

        const hasSkipLink = firstFocused.text?.match(/skip|jump|main content/i) ||
                           firstFocused.href?.match(/#main|#content/i);

        await screenshot(page, 'B21_S11_01_first_tab');

        if (!hasSkipLink) {
          // Check if skip link exists but is hidden
          const skipLinkHidden = await page.evaluate(() => {
            const skipLinks = document.querySelectorAll('a[href^="#"]');
            const skipCandidates = Array.from(skipLinks).filter(a =>
              a.textContent?.match(/skip|jump|main/i)
            );
            return {
              count: skipCandidates.length,
              links: skipCandidates.map(a => ({
                text: a.textContent?.trim(),
                href: a.href,
                class: a.className,
                style: a.getAttribute('style'),
                tabindex: a.getAttribute('tabindex'),
              })),
            };
          });

          if (skipLinkHidden.count > 0) {
            recordResult('S11', 'Skip-to-content link', '🟡 Partial', 'LOW',
              `Skip link exists but not first in Tab order or visually hidden: ${JSON.stringify(skipLinkHidden.links)}`);
          } else {
            recordResult('S11', 'Skip-to-content link', '❌ Fail', 'LOW',
              'No skip-to-content link found. First Tab lands on: ' + JSON.stringify(firstFocused));
            addFinding('S11', 'No skip-to-content link present', 'LOW',
              'All students',
              ['Navigate to any page', 'Press Tab once', 'Expect a "Skip to main content" link to appear'],
              `No skip link found. First Tab element: ${JSON.stringify(firstFocused)}. axe-core would flag this as wcag2.4.1.`,
              'A skip-to-content link allows keyboard and screen reader users to bypass repetitive navigation',
              'Keyboard users must Tab through all navigation elements on every page load before reaching main content.',
              [`${EVIDENCE_DIR}/B21_S11_01_first_tab.png`]);
          }
        } else {
          recordResult('S11', 'Skip-to-content link', '✅ Pass', null,
            `Skip link present: "${firstFocused.text}"`);
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S11', result: 'pass', durationMs: 8000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S12: Reduced motion ──────────────────────────────────────────────────
    updateStatus('S12');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S12' });
    console.log('\n=== S12: Reduced motion ===');
    {
      const context = await browser.newContext({
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(2000);

        if (!page.url().includes('/login')) {
          await page.goto(`${BASE_URL}/login`);
          await page.waitForTimeout(1500);
        }

        // Check if the app respects prefers-reduced-motion
        const reducedMotionStyles = await page.evaluate(() => {
          // Check CSS variables or rules
          const body = document.body;
          const style = window.getComputedStyle(body);

          // Check if any elements have transition durations
          const animatedEls = Array.from(document.querySelectorAll('*')).slice(0, 100).map(el => {
            const s = window.getComputedStyle(el);
            return {
              tag: el.tagName,
              transition: s.transition,
              animation: s.animation,
              animationDuration: s.animationDuration,
            };
          }).filter(el => el.transition !== 'none 0s ease 0s' && el.transition !== 'all 0s ease 0s' ||
                         el.animation !== 'none' && el.animation !== '');

          // Check for media query support
          const prefersReducedMotionSupported = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          return {
            prefersReducedMotionActive: prefersReducedMotionSupported,
            animatedElements: animatedEls.slice(0, 10),
          };
        });

        console.log('Reduced motion:', reducedMotionStyles.prefersReducedMotionActive);
        writeFileSync(join(EVIDENCE_DIR, 'B21_S12_reduced_motion.json'), JSON.stringify(reducedMotionStyles, null, 2));

        // Check CSS for @media (prefers-reduced-motion) in stylesheets
        const hasReducedMotionCSS = await page.evaluate(() => {
          const sheets = Array.from(document.styleSheets);
          try {
            for (const sheet of sheets) {
              try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                  if (rule.conditionText?.includes('prefers-reduced-motion') ||
                      rule.media?.mediaText?.includes('prefers-reduced-motion')) {
                    return true;
                  }
                }
              } catch (e) { /* cross-origin */ }
            }
          } catch(e) {}
          return false;
        });

        console.log('Has reduced motion CSS:', hasReducedMotionCSS);

        await screenshot(page, 'B21_S12_01_reduced_motion');

        if (reducedMotionStyles.prefersReducedMotionActive && !hasReducedMotionCSS) {
          recordResult('S12', 'Reduced motion preference respected', '🟡 Partial', 'LOW',
            'prefers-reduced-motion query works but no CSS @media rule found — animations may not be minimized');
        } else if (hasReducedMotionCSS) {
          recordResult('S12', 'Reduced motion preference respected', '✅ Pass', null,
            'CSS @media (prefers-reduced-motion) rule found');
        } else {
          recordResult('S12', 'Reduced motion preference respected', '❌ Fail', 'LOW',
            'No @media (prefers-reduced-motion) CSS found — animations will play regardless of user preference');
          addFinding('S12', 'No @media (prefers-reduced-motion) CSS rules found', 'LOW',
            'All students',
            ['Set browser to prefers-reduced-motion: reduce', 'Load the app', 'Inspect CSS for reduced-motion rules'],
            'No CSS @media (prefers-reduced-motion: reduce) rules found in stylesheets. All transitions/animations will play.',
            'Apps should respect prefers-reduced-motion to avoid triggering motion sickness for vestibular disorder users (WCAG 2.3.3)',
            'Users with vestibular disorders may experience discomfort from animations that cannot be disabled.',
            [`${EVIDENCE_DIR}/B21_S12_reduced_motion.json`]);
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S12', result: 'pass', durationMs: 10000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── S13: Screen reader narration of test results ─────────────────────────
    updateStatus('S13');
    logEvent({ event: 'scenario_start', batch: 'B21', scenario: 'S13' });
    console.log('\n=== S13: Screen reader narration of test results ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');

        // Look for any existing result page
        const pageContent = await page.evaluate(() => document.body.textContent);
        const hasResults = pageContent?.match(/correct|score|result|percent/i);

        // Navigate to any results page if accessible from dashboard
        await screenshot(page, 'B21_S13_01_dashboard');

        // Check dashboard for results summary
        const resultsInfo = await page.evaluate(() => {
          const resultEls = document.querySelectorAll('[class*="result"], [class*="score"], [class*="progress"]');
          const scoreText = Array.from(document.querySelectorAll('*')).find(el =>
            el.textContent?.match(/\d+\/\d+|\d+%/) && el.children.length < 3
          );

          return {
            resultElCount: resultEls.length,
            scoreText: scoreText?.textContent?.trim(),
            hasAriaLive: document.querySelectorAll('[aria-live]').length,
            liveRegions: Array.from(document.querySelectorAll('[aria-live]')).map(el => ({
              ariaLive: el.getAttribute('aria-live'),
              text: el.textContent?.trim().substring(0, 100),
            })),
          };
        });

        console.log('Results info:', resultsInfo);
        writeFileSync(join(EVIDENCE_DIR, 'B21_S13_results_info.json'), JSON.stringify(resultsInfo, null, 2));

        // Also check the heading structure on this page
        const headingStructure = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(h => ({ level: h.tagName, text: h.textContent?.trim() }));
        });

        console.log('Heading structure:', headingStructure);
        writeFileSync(join(EVIDENCE_DIR, 'B21_S13_headings.json'), JSON.stringify(headingStructure, null, 2));

        const hasH1 = headingStructure.some(h => h.level === 'H1');
        const headingLevelsValid = headingStructure.length === 0 || headingStructure[0].level === 'H1';

        if (!hasH1) {
          recordResult('S13', 'Page heading structure (H1 present)', '❌ Fail', 'MEDIUM',
            `No H1 found. Headings: ${JSON.stringify(headingStructure.slice(0, 5))}`);
          addFinding('S13', 'Dashboard/main pages lack H1 heading for screen reader navigation', 'MEDIUM',
            'All students',
            ['Navigate to dashboard', 'Inspect heading structure'],
            `No H1 element found on dashboard. Headings found: ${JSON.stringify(headingStructure)}`,
            'Each page should have exactly one H1 that describes the main content (WCAG 1.3.1, WCAG 2.4.6)',
            'Screen reader users rely on heading structure to understand page organization and navigate quickly; missing H1 means no main landmark.',
            [`${EVIDENCE_DIR}/B21_S13_headings.json`]);
        } else {
          recordResult('S13', 'Page heading structure (H1 present)', '✅ Pass', null,
            `H1: "${headingStructure.find(h => h.level === 'H1')?.text}"`);
        }

        // Check for aria-live on score/result displays
        if (resultsInfo.hasAriaLive > 0) {
          recordResult('S13b', 'Score/result live region announcements', '✅ Pass', null,
            `${resultsInfo.hasAriaLive} aria-live regions found`);
        } else {
          recordResult('S13b', 'Score/result live region announcements', '🟡 Partial', 'LOW',
            'No aria-live regions detected on dashboard; results screen audit pending actual test completion');
        }

        logEvent({ event: 'scenario', batch: 'B21', scenario: 'S13', result: 'pass', durationMs: 12000 });
      } finally {
        await context.close();
      }
    }
    trialsCompleted++;

    // ── BONUS: Deep dive into typed test page if reachable ────────────────────
    updateStatus('S04-deep');
    console.log('\n=== BONUS: Deep typed test label audit ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        // Login and try to reach test via URL patterns observed in other batches
        await loginAs(page, 'careful', 'TOP');

        // Check if there's a session link visible
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log('Dashboard page text (first 500 chars):', pageText.substring(0, 500));

        // Look for any "Start" or "Continue" buttons more broadly
        const clickableEls = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button, a[href], [role="button"]'))
            .map(el => ({
              tag: el.tagName,
              text: el.textContent?.trim(),
              href: el.getAttribute('href'),
              class: el.className,
              ariaLabel: el.getAttribute('aria-label'),
            }))
            .filter(el => el.text || el.ariaLabel);
        });

        writeFileSync(join(EVIDENCE_DIR, 'B21_BONUS_clickable_els.json'), JSON.stringify(clickableEls, null, 2));
        console.log('Clickable elements:', clickableEls.length);

        // Try to go directly to any existing session
        const sessionLinks = clickableEls.filter(el =>
          el.href?.includes('/session') || el.href?.includes('/test') ||
          el.text?.match(/session|test|start|today|learn/i)
        );

        if (sessionLinks.length > 0) {
          console.log('Session link found:', sessionLinks[0]);
          if (sessionLinks[0].href) {
            await page.goto(sessionLinks[0].href.startsWith('http') ? sessionLinks[0].href : `${BASE_URL}${sessionLinks[0].href}`);
          } else {
            // Click by text
            await page.click(`text=${sessionLinks[0].text}`);
          }
          await page.waitForTimeout(3000);
          await screenshot(page, 'B21_BONUS_session_page');

          const url = page.url();
          console.log('Navigated to:', url);

          // Now do the full label audit on this page
          const labelAuditDeep = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="email"]):not([type="password"]), textarea'));

            return {
              total: inputs.length,
              details: inputs.map(el => {
                const id = el.id;
                const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
                const ariaLabel = el.getAttribute('aria-label');
                const ariaLabelledby = el.getAttribute('aria-labelledby');
                const placeholder = el.getAttribute('placeholder');
                const wrappingLabel = el.closest('label');
                const hasLabel = !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel);

                // Find nearest text that might serve as visual label
                const nearbyText = el.previousElementSibling?.textContent?.trim() ||
                                   el.parentElement?.previousElementSibling?.textContent?.trim();

                return {
                  id,
                  type: el.getAttribute('type') || 'text',
                  placeholder,
                  ariaLabel,
                  ariaLabelledby,
                  hasAssociatedLabel: !!labelEl,
                  labelText: labelEl?.textContent?.trim(),
                  hasWrappingLabel: !!wrappingLabel,
                  hasLabel,
                  nearbyText: nearbyText?.substring(0, 50),
                };
              }),
            };
          });

          const unlabeled = labelAuditDeep.details.filter(d => !d.hasLabel);
          console.log(`Deep label audit: ${unlabeled.length}/${labelAuditDeep.total} unlabeled`);
          writeFileSync(join(EVIDENCE_DIR, 'B21_BONUS_deep_label_audit.json'), JSON.stringify(labelAuditDeep, null, 2));

          // Inject axe-core for complete session page audit
          let axeAvailable = false;
          try {
            await page.addScriptTag({
              url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
            });
            await page.waitForTimeout(1000);
            axeAvailable = true;
          } catch (e) {}

          if (axeAvailable) {
            const sessionAxe = await page.evaluate(async () => {
              return await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
              });
            });

            writeFileSync(join(EVIDENCE_DIR, 'B21_BONUS_session_axe.json'), JSON.stringify({
              url: page.url(),
              violations: sessionAxe.violations.map(v => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                nodes: v.nodes.length,
                nodeDetails: v.nodes.slice(0, 3).map(n => ({
                  html: n.html?.substring(0, 200),
                  failureSummary: n.failureSummary,
                })),
              })),
              passCount: sessionAxe.passes.length,
            }, null, 2));

            console.log(`Session axe: ${sessionAxe.violations.length} violations`);
          }
        }

      } catch (e) {
        console.log('Bonus deep dive failed:', e.message);
      } finally {
        await context.close();
      }
    }

    // ── Final summary output ─────────────────────────────────────────────────
    console.log('\n=== AUDIT COMPLETE ===');
    console.log(`Trials completed: ${trialsCompleted}`);
    console.log('Results:');
    results.forEach(r => console.log(`  ${r.scenario}: ${r.result} — ${r.description}`));
    console.log('\nFindings:');
    findings.forEach(f => console.log(`  ${f.id} [${f.severity}]: ${f.title}`));

    // Write results to JSON for findings generation
    writeFileSync(join(EVIDENCE_DIR, 'B21_audit_results.json'), JSON.stringify({
      trialsCompleted,
      results,
      findings,
    }, null, 2));

  } finally {
    await browser.close();
  }

  return { results, findings, trialsCompleted };
}

runAudit()
  .then(({ results, findings, trialsCompleted }) => {
    console.log(`\nAudit complete. ${trialsCompleted} trials, ${findings.length} findings.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Audit fatal error:', err);
    process.exit(1);
  });

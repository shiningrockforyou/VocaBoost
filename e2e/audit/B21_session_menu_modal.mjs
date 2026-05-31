/**
 * B21 - Check session menu modal ARIA + flashcard interactive element nesting issue
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B21';

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));

function getAccount(personaId, targetClass = null) {
  return seeded.accounts.find(a =>
    a.personaId === personaId && (!targetClass || a.targetClass === targetClass)
  );
}

async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass);
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(2000);
  if (!page.url().includes('/login')) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(2000);
  }
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByRole('button', { name: /^continue$/i }).first().click();
  await page.waitForURL(/\/$|\/dashboard/, { timeout: 15000 });
  return account;
}

async function injectAxe(page) {
  try {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js' });
    await page.waitForTimeout(800);
    return true;
  } catch (e) { return false; }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginAs(page, 'careful', 'TOP');
    await page.click('button:text("Start Session")');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_01_flashcard_initial.png'), fullPage: true });

    // ── Test 1: Flashcard DIV[role="button"] nested issue ────────────────────
    console.log('=== Test 1: Nested interactive element (flashcard card) ===');
    const nestedInfo = await page.evaluate(() => {
      // Find the DIV with role="button" that is nested inside a button
      const nestedInteractive = [];
      document.querySelectorAll('[role="button"], button').forEach(outer => {
        outer.querySelectorAll('button, a, input, [role="button"], [role="link"]').forEach(inner => {
          if (inner !== outer) {
            nestedInteractive.push({
              outer: {
                tag: outer.tagName,
                role: outer.getAttribute('role'),
                text: outer.textContent?.trim().substring(0, 50),
                class: outer.className.substring(0, 100),
              },
              inner: {
                tag: inner.tagName,
                role: inner.getAttribute('role'),
                text: inner.textContent?.trim().substring(0, 50),
                class: inner.className.substring(0, 100),
              },
            });
          }
        });
      });
      return nestedInteractive;
    });
    console.log('Nested interactive elements:', JSON.stringify(nestedInfo, null, 2));
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_nested_interactive.json'), JSON.stringify(nestedInfo, null, 2));

    // ── Test 2: Session menu modal ────────────────────────────────────────────
    console.log('\n=== Test 2: Session menu modal ARIA ===');
    const sessionMenuBtn = page.getByRole('button', { name: 'Session menu' });
    if (await sessionMenuBtn.count() > 0) {
      // Get the trigger element reference for focus restoration test
      await sessionMenuBtn.focus();
      const triggerFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      console.log('Trigger focused:', triggerFocused);

      await sessionMenuBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_02_session_menu.png'), fullPage: true });

      const menuAriaInfo = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"], [data-radix-dialog-content]'));
        const menus = Array.from(document.querySelectorAll('[role="menu"], [role="listbox"]'));
        const popups = Array.from(document.querySelectorAll('[data-state="open"]'));
        const overlay = Array.from(document.querySelectorAll('[role="dialog"], [data-state="open"], [aria-modal]'));

        return {
          dialogs: dialogs.map(d => ({
            tag: d.tagName,
            role: d.getAttribute('role'),
            ariaModal: d.getAttribute('aria-modal'),
            ariaLabel: d.getAttribute('aria-label'),
            ariaLabelledby: d.getAttribute('aria-labelledby'),
            text: d.textContent?.trim().substring(0, 100),
            focusable: Array.from(d.querySelectorAll('button, a, input, select, [tabindex="0"]')).map(el => ({
              tag: el.tagName,
              text: el.textContent?.trim().substring(0, 30),
              ariaLabel: el.getAttribute('aria-label'),
            })),
          })),
          menus: menus.map(m => ({
            tag: m.tagName,
            role: m.getAttribute('role'),
            text: m.textContent?.trim().substring(0, 100),
          })),
          popupCount: popups.length,
          overlayCount: overlay.length,
        };
      });

      console.log('Session menu ARIA:', JSON.stringify(menuAriaInfo, null, 2));
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_session_menu_aria.json'), JSON.stringify(menuAriaInfo, null, 2));

      // Tab through the menu to check focus trap
      const focusHistory = [];
      for (let i = 0; i < 15; i++) {
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          const inDialog = !!el?.closest('[role="dialog"], dialog, [aria-modal="true"], [data-state="open"]');
          return {
            tag: el?.tagName,
            text: el?.textContent?.trim().substring(0, 30),
            ariaLabel: el?.getAttribute('aria-label'),
            inDialog,
            isBody: el === document.body,
          };
        });
        focusHistory.push(focused);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
      console.log('Focus history in menu:', focusHistory.map(f => `${f.tag}:${f.text || f.ariaLabel} (inDialog:${f.inDialog})`));

      const focusEscaped = focusHistory.some(f => !f.inDialog && !f.isBody && f.tag !== 'BODY');
      console.log('Focus escaped dialog:', focusEscaped);
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_focus_trap.json'), JSON.stringify({ focusEscaped, focusHistory }, null, 2));

      // Test Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_03_after_escape.png'), fullPage: true });

      const focusAfterClose = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          text: el?.textContent?.trim().substring(0, 50),
          ariaLabel: el?.getAttribute('aria-label'),
          id: el?.id,
        };
      });
      console.log('Focus after Escape:', focusAfterClose);
      const focusReturnedToTrigger = focusAfterClose.ariaLabel === 'Session menu';
      console.log('Focus returned to Session menu button:', focusReturnedToTrigger);
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_focus_restoration.json'), JSON.stringify({
        focusAfterClose,
        focusReturnedToTrigger,
        expectedAriaLabel: 'Session menu',
      }, null, 2));
    } else {
      console.log('Session menu button not found');
    }

    // ── Test 3: Login inputs - comprehensive label check ───────────────────
    console.log('\n=== Test 3: Login inputs - comprehensive label check ===');
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE_URL}/login`);
    await p2.waitForTimeout(2000);

    const loginInputs = await p2.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));

      // Full page structure for context
      const allEls = Array.from(document.querySelectorAll('*')).slice(0, 60).map(el => ({
        tag: el.tagName,
        class: el.className?.substring(0, 60),
        for: el.getAttribute('for'),
        id: el.id,
        text: el.textContent?.trim()?.substring(0, 40),
        type: el.getAttribute('type'),
      })).filter(el => el.tag.match(/LABEL|INPUT|P|SPAN|DIV|H1|H2|FORM|BUTTON/));

      return {
        inputs: inputs.map(el => {
          const id = el.id;
          const name = el.name;
          const type = el.getAttribute('type');
          const placeholder = el.getAttribute('placeholder');
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledby = el.getAttribute('aria-labelledby');
          const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
          const wrappingLabel = el.closest('label');

          return {
            id: id || '(none)', name, type, placeholder, ariaLabel, ariaLabelledby,
            hasId: !!id, hasAssociatedLabel: !!labelEl, labelText: labelEl?.textContent?.trim(),
            hasWrappingLabel: !!wrappingLabel, wrappingLabelText: wrappingLabel?.textContent?.trim(),
            WCAG_FAIL: !(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
          };
        }),
        allStructure: allEls.slice(0, 30),
      };
    });

    console.log('Login inputs:');
    loginInputs.inputs.forEach(i => {
      console.log(`  [${i.type}] id="${i.id}" placeholder="${i.placeholder}" ariaLabel="${i.ariaLabel}" WCAG_FAIL=${i.WCAG_FAIL}`);
      if (i.hasAssociatedLabel) console.log(`    Associated label: "${i.labelText}"`);
    });
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_login_inputs.json'), JSON.stringify(loginInputs, null, 2));

    // Run axe on login page
    const axeOk = await injectAxe(p2);
    if (axeOk) {
      const axeRes = await p2.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });
      console.log(`Login axe violations: ${axeRes.violations.length}`);
      axeRes.violations.forEach(v => {
        console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
        v.nodes.slice(0, 2).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 150)}`));
      });
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_login_axe_full.json'), JSON.stringify({
        url: p2.url(),
        violations: axeRes.violations.map(v => ({
          id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
          nodeDetails: v.nodes.map(n => ({
            html: n.html?.substring(0, 250),
            failureSummary: n.failureSummary,
            data: n.any?.[0]?.data,
          })),
        })),
        passCount: axeRes.passes.length,
      }, null, 2));
    }

    await ctx2.close();
    await context.close();

  } finally {
    await browser.close();
  }
  console.log('\nDone.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

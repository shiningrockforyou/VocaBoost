/**
 * B21 - Check modals (Customize Flashcards + Session menu) ARIA
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

  const findings = {};

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginAs(page, 'careful', 'TOP');
    await page.click('button:text("Start Session")');
    await page.waitForTimeout(3000);

    // Check what overlay is blocking
    const overlayInfo = await page.evaluate(() => {
      const overlays = document.querySelectorAll('.fixed, [style*="position: fixed"], [style*="z-index"]');
      const allFixed = Array.from(overlays).map(el => ({
        tag: el.tagName,
        class: el.className.substring(0, 100),
        role: el.getAttribute('role'),
        ariaModal: el.getAttribute('aria-modal'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        visible: el.offsetWidth > 0 && el.offsetHeight > 0,
        text: el.textContent?.trim().substring(0, 100),
      })).filter(el => el.visible);
      return allFixed;
    });
    console.log('Visible fixed elements:', JSON.stringify(overlayInfo.slice(0, 5), null, 2));

    // Check if there's a welcome/customize modal
    const hasModal = await page.evaluate(() => {
      const modals = document.querySelectorAll('[class*="fixed inset-0"]');
      return {
        count: modals.length,
        modals: Array.from(modals).slice(0, 3).map(m => ({
          class: m.className.substring(0, 100),
          role: m.getAttribute('role'),
          ariaModal: m.getAttribute('aria-modal'),
          ariaLabel: m.getAttribute('aria-label'),
          text: m.textContent?.trim().substring(0, 200),
        })),
      };
    });
    console.log('\nModals (fixed inset-0):', JSON.stringify(hasModal, null, 2));

    await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_overlay_initial.png'), fullPage: true });

    // ── AUDIT: Customize Flashcards modal ─────────────────────────────────────
    console.log('\n=== AUDIT: Customize Flashcards modal ARIA ===');
    const customizeModalAria = await page.evaluate(() => {
      // Find the customize modal
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog'));
      const fixedDivs = Array.from(document.querySelectorAll('div[class*="fixed inset-0"]'));

      return {
        dialogs: dialogs.map(d => ({
          tag: d.tagName, role: d.getAttribute('role'),
          ariaModal: d.getAttribute('aria-modal'), ariaLabel: d.getAttribute('aria-label'),
          ariaLabelledby: d.getAttribute('aria-labelledby'),
          text: d.textContent?.trim().substring(0, 200),
          focusable: Array.from(d.querySelectorAll('button, a, input, [tabindex="0"]')).map(el => ({
            tag: el.tagName, text: el.textContent?.trim().substring(0, 30), ariaLabel: el.getAttribute('aria-label'),
          })),
        })),
        fixedOverlays: fixedDivs.map(d => ({
          class: d.className.substring(0, 100),
          role: d.getAttribute('role'), ariaModal: d.getAttribute('aria-modal'),
          ariaLabel: d.getAttribute('aria-label'), ariaLabelledby: d.getAttribute('aria-labelledby'),
          text: d.textContent?.trim().substring(0, 200),
          childButtons: Array.from(d.querySelectorAll('button')).map(b => b.textContent?.trim()),
        })),
      };
    });
    console.log('Customize modal ARIA:', JSON.stringify(customizeModalAria, null, 2));
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_customize_aria.json'), JSON.stringify(customizeModalAria, null, 2));

    // Check the ARIA completeness of the modal
    const hasRoleDialog = customizeModalAria.dialogs.some(d => d.role === 'dialog');
    const hasAriaModal = customizeModalAria.dialogs.some(d => d.ariaModal === 'true');
    const hasLabel = customizeModalAria.dialogs.some(d => d.ariaLabel || d.ariaLabelledby);
    findings.customizeModal = { hasRoleDialog, hasAriaModal, hasLabel };

    // Also check if fixed overlay has role/aria attrs
    const overlayHasDialog = customizeModalAria.fixedOverlays.some(d => d.role === 'dialog' || d.ariaModal === 'true');
    findings.fixedOverlayHasDialog = overlayHasDialog;

    console.log(`\nCustomize modal ARIA completeness:
  - role="dialog": ${hasRoleDialog}
  - aria-modal="true": ${hasAriaModal}
  - accessible label: ${hasLabel}
  - fixed overlay has dialog role: ${overlayHasDialog}`);

    // ── Focus trap test in Customize modal ────────────────────────────────────
    console.log('\n=== Focus trap in Customize modal ===');
    // The modal is already open blocking the screen
    const focusHistory = [];
    // First, check where focus currently is
    const initialFocus = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30),
        ariaLabel: el?.getAttribute('aria-label'),
      };
    });
    console.log('Initial focus:', initialFocus);

    // Tab through 15 times
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(80);
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        const inOverlay = !!el?.closest('[class*="fixed inset-0"], [role="dialog"]');
        return {
          tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30),
          ariaLabel: el?.getAttribute('aria-label'), inOverlay,
          isBody: el === document.body,
        };
      });
      focusHistory.push(focused);
    }

    console.log('Focus history:', focusHistory.map(f => `${f.tag}:${f.text || f.ariaLabel}(inOverlay:${f.inOverlay})`));
    const focusEscaped = focusHistory.some(f => !f.inOverlay && !f.isBody);
    console.log('Focus escaped overlay:', focusEscaped);
    findings.customizeModalFocusTrap = !focusEscaped;
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_customize_focus_trap.json'), JSON.stringify({ focusEscaped, focusHistory }, null, 2));

    // ── Test Escape to close Customize modal ──────────────────────────────────
    console.log('\n=== Escape to close Customize modal ===');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    const afterEscape = await page.evaluate(() => {
      const modals = document.querySelectorAll('[class*="fixed inset-0"]');
      const el = document.activeElement;
      return {
        modalsVisible: Array.from(modals).filter(m => m.offsetWidth > 0 || m.offsetHeight > 0).length,
        focusedElement: {
          tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30),
          ariaLabel: el?.getAttribute('aria-label'),
        },
      };
    });
    console.log('After Escape:', afterEscape);
    findings.customizeModalEscapable = afterEscape.modalsVisible === 0;
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_after_escape.json'), JSON.stringify(afterEscape, null, 2));
    await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_after_escape.png'), fullPage: true });

    // ── Run axe on the modal itself ───────────────────────────────────────────
    // Re-open modal if needed
    await loginAs(page, 'careful', 'TOP');
    await page.click('button:text("Start Session")');
    await page.waitForTimeout(3000);

    const axeOk = await injectAxe(page);
    if (axeOk) {
      const axeRes = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });
      console.log(`\nFlashcard+modal page axe: ${axeRes.violations.length} violations`);
      axeRes.violations.forEach(v => {
        console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
        v.nodes.slice(0, 2).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 150)}`));
      });
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_flashcard_full_axe.json'), JSON.stringify({
        url: page.url(),
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
      findings.flashcardWithModalAxe = axeRes.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    }

    // ── Now dismiss modal and test Session menu ────────────────────────────────
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    const sessionMenuBtn = page.getByRole('button', { name: 'Session menu' });
    if (await sessionMenuBtn.count() > 0) {
      console.log('\n=== Session menu modal test ===');
      await sessionMenuBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_MODAL_session_menu.png'), fullPage: true });

      const sessionMenuAria = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]'));
        const fixedDivs = Array.from(document.querySelectorAll('div[class*="fixed"], div[class*="z-50"]'))
          .filter(d => d.offsetWidth > 0);

        return {
          dialogs: dialogs.map(d => ({
            tag: d.tagName, role: d.getAttribute('role'),
            ariaModal: d.getAttribute('aria-modal'), ariaLabel: d.getAttribute('aria-label'),
            ariaLabelledby: d.getAttribute('aria-labelledby'),
            text: d.textContent?.trim().substring(0, 200),
          })),
          fixedOverlays: fixedDivs.slice(0, 3).map(d => ({
            class: d.className.substring(0, 100),
            role: d.getAttribute('role'), ariaModal: d.getAttribute('aria-modal'),
            ariaLabel: d.getAttribute('aria-label'),
            text: d.textContent?.trim().substring(0, 100),
          })),
          currentFocus: (() => {
            const el = document.activeElement;
            return { tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30), ariaLabel: el?.getAttribute('aria-label') };
          })(),
        };
      });
      console.log('Session menu modal ARIA:', JSON.stringify(sessionMenuAria, null, 2));
      writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_session_menu_aria_full.json'), JSON.stringify(sessionMenuAria, null, 2));
      findings.sessionMenuModal = sessionMenuAria;

      // Tab trap test
      const sessionMenuFocusHistory = [];
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(80);
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          const inOverlay = !!el?.closest('[role="dialog"], [aria-modal="true"], [class*="z-50"]');
          return {
            tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30),
            ariaLabel: el?.getAttribute('aria-label'), inOverlay, isBody: el === document.body,
          };
        });
        sessionMenuFocusHistory.push(focused);
      }
      console.log('Session menu focus history:', sessionMenuFocusHistory.map(f => `${f.tag}:${f.text || f.ariaLabel}`));

      // Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const afterSessionMenuEscape = await page.evaluate(() => {
        const el = document.activeElement;
        return { tag: el?.tagName, text: el?.textContent?.trim(), ariaLabel: el?.getAttribute('aria-label') };
      });
      console.log('Focus after session menu Escape:', afterSessionMenuEscape);
      const sessionMenuFocusRestored = afterSessionMenuEscape.ariaLabel === 'Session menu';
      findings.sessionMenuFocusRestored = sessionMenuFocusRestored;
      console.log('Session menu focus restored to trigger:', sessionMenuFocusRestored);
    }

    // ── Final summary ─────────────────────────────────────────────────────────
    writeFileSync(join(EVIDENCE_DIR, 'B21_MODAL_consolidated_findings.json'), JSON.stringify(findings, null, 2));
    console.log('\n=== MODAL FINDINGS SUMMARY ===');
    console.log(JSON.stringify(findings, null, 2));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

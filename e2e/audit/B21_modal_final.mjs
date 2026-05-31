/**
 * B21 - Final modal audit + complete findings collector
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

async function loginFresh(browser, personaId, targetClass = 'TOP') {
  const context = await browser.newContext();
  const page = await context.newPage();
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
  return { context, page };
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

  const allFindings = {};

  try {
    // ── Test 1: Flashcard session + modal (fresh login, click Start Session) ──
    console.log('\n=== TEST 1: Flashcard session page with modal ===');
    {
      const { context, page } = await loginFresh(browser, 'careful', 'TOP');

      try {
        // Click the first Start Session button
        await page.locator('button').filter({ hasText: 'Start Session' }).first().click();
        await page.waitForTimeout(4000);

        const pageUrl = page.url();
        const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
        console.log('After Start Session, URL:', pageUrl);
        console.log('Page text:', pageText.substring(0, 150));

        if (pageText.includes('Class not found') || pageUrl === `${BASE_URL}/`) {
          console.log('ERROR: Got Class not found — student may have used up their session');
          // Try with a different persona account
        } else {
          await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_FINAL_01_session.png'), fullPage: true });

          // Check for the Customize Flashcards modal/section
          const customizeInfo = await page.evaluate(() => {
            // Look for the customize section in the DOM
            const allText = document.body.innerText;
            const hasCustomize = allText.includes('Customize Your Flashcards');

            // Find overlay/modal
            const fixedEls = Array.from(document.querySelectorAll('*')).filter(el => {
              const style = window.getComputedStyle(el);
              return style.position === 'fixed' && el.offsetWidth > 0 && el.offsetHeight > 0;
            });

            const dialogs = document.querySelectorAll('[role="dialog"], dialog, [aria-modal]');

            return {
              hasCustomize,
              fixedElCount: fixedEls.length,
              fixedEls: fixedEls.slice(0, 3).map(el => ({
                tag: el.tagName,
                class: el.className.substring(0, 80),
                role: el.getAttribute('role'),
                ariaModal: el.getAttribute('aria-modal'),
                ariaLabel: el.getAttribute('aria-label'),
                text: el.textContent?.trim().substring(0, 100),
              })),
              dialogCount: dialogs.length,
              dialogs: Array.from(dialogs).map(d => ({
                tag: d.tagName,
                role: d.getAttribute('role'),
                ariaModal: d.getAttribute('aria-modal'),
                ariaLabel: d.getAttribute('aria-label'),
                ariaLabelledby: d.getAttribute('aria-labelledby'),
                text: d.textContent?.trim().substring(0, 100),
              })),
            };
          });

          console.log('Customize/modal info:', JSON.stringify(customizeInfo, null, 2));
          writeFileSync(join(EVIDENCE_DIR, 'B21_FINAL_customize_info.json'), JSON.stringify(customizeInfo, null, 2));

          // Check if modal has proper ARIA
          if (customizeInfo.dialogCount > 0) {
            allFindings.customizeModal = {
              present: true,
              hasRoleDialog: customizeInfo.dialogs.some(d => d.role === 'dialog'),
              hasAriaModal: customizeInfo.dialogs.some(d => d.ariaModal === 'true'),
              hasLabel: customizeInfo.dialogs.some(d => d.ariaLabel || d.ariaLabelledby),
            };
          } else if (customizeInfo.fixedElCount > 0) {
            // The customize section is a fixed overlay without dialog role
            const hasDialog = customizeInfo.fixedEls.some(d => d.role === 'dialog' || d.ariaModal === 'true');
            allFindings.customizeModal = {
              present: customizeInfo.hasCustomize,
              hasRoleDialog: hasDialog,
              hasAriaModal: hasDialog,
              hasLabel: customizeInfo.fixedEls.some(d => d.ariaLabel),
              note: 'Fixed overlay without role=dialog',
            };
          } else {
            // No modal found - customize section may be inline
            allFindings.customizeModal = {
              present: customizeInfo.hasCustomize,
              isInline: true,
              note: 'Customize section appears to be inline, not a modal',
            };
          }

          // Check toggle buttons (Korean/Sample Sentence)
          const toggleButtons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).filter(b =>
              b.textContent?.match(/Korean Definition|Sample Sentence/)
            ).map(b => ({
              text: b.textContent?.trim(),
              ariaPressed: b.getAttribute('aria-pressed'),
              ariaChecked: b.getAttribute('aria-checked'),
              role: b.getAttribute('role') || 'button',
            }));
          });
          console.log('Toggle buttons ARIA:', toggleButtons);
          allFindings.toggleButtonsAriaPressed = toggleButtons.every(t => t.ariaPressed !== null);

          // Check Session menu button
          const sessionMenuInfo = await page.evaluate(() => {
            const btn = document.querySelector('[aria-label="Session menu"]');
            return btn ? {
              exists: true,
              tag: btn.tagName,
              ariaLabel: btn.getAttribute('aria-label'),
              ariaHaspopup: btn.getAttribute('aria-haspopup'),
              ariaExpanded: btn.getAttribute('aria-expanded'),
            } : { exists: false };
          });
          console.log('Session menu button:', sessionMenuInfo);
          allFindings.sessionMenuButton = sessionMenuInfo;

          // Click Session menu if customize modal is NOT blocking
          const isBlocked = await page.evaluate(() => {
            const fixedEls = Array.from(document.querySelectorAll('*')).filter(el => {
              const style = window.getComputedStyle(el);
              return style.position === 'fixed' && el.offsetWidth > 100;
            });
            return fixedEls.length > 1; // more than just the canvas/background
          });

          if (!isBlocked) {
            const sessionMenuBtn = page.locator('[aria-label="Session menu"]');
            if (await sessionMenuBtn.count() > 0) {
              await sessionMenuBtn.click();
              await page.waitForTimeout(1500);
              await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_FINAL_02_session_menu.png'), fullPage: true });

              const sessionMenuDialogs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal]')).map(d => ({
                  tag: d.tagName, role: d.getAttribute('role'),
                  ariaModal: d.getAttribute('aria-modal'), ariaLabel: d.getAttribute('aria-label'),
                  text: d.textContent?.trim().substring(0, 100),
                }));
              });
              console.log('Session menu dialog:', JSON.stringify(sessionMenuDialogs, null, 2));
              allFindings.sessionMenuDialog = sessionMenuDialogs;

              await page.keyboard.press('Escape');
              await page.waitForTimeout(800);
              const focusAfter = await page.evaluate(() => {
                const el = document.activeElement;
                return { tag: el?.tagName, ariaLabel: el?.getAttribute('aria-label') };
              });
              allFindings.sessionMenuFocusRestored = focusAfter.ariaLabel === 'Session menu';
              console.log('Session menu focus restored:', allFindings.sessionMenuFocusRestored);
            }
          } else {
            console.log('Session menu blocked by overlay');
            // Try to dismiss overlay first
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);

            const sessionMenuBtn = page.locator('[aria-label="Session menu"]');
            if (await sessionMenuBtn.count() > 0) {
              await sessionMenuBtn.click();
              await page.waitForTimeout(1500);
              await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_FINAL_02_session_menu.png'), fullPage: true });

              const sessionMenuDialogs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal]')).map(d => ({
                  tag: d.tagName, role: d.getAttribute('role'),
                  ariaModal: d.getAttribute('aria-modal'), ariaLabel: d.getAttribute('aria-label'),
                  text: d.textContent?.trim().substring(0, 100),
                }));
              });
              console.log('Session menu dialog:', JSON.stringify(sessionMenuDialogs, null, 2));
              allFindings.sessionMenuDialog = sessionMenuDialogs;

              await page.keyboard.press('Escape');
              await page.waitForTimeout(800);
              const focusAfter = await page.evaluate(() => {
                const el = document.activeElement;
                return { tag: el?.tagName, ariaLabel: el?.getAttribute('aria-label') };
              });
              allFindings.sessionMenuFocusRestored = focusAfter.ariaLabel === 'Session menu';
            }
          }

          // Run axe on the whole session page
          const axeOk = await injectAxe(page);
          if (axeOk) {
            const axeRes = await page.evaluate(async () => {
              return await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
              });
            });
            console.log(`\nSession page axe: ${axeRes.violations.length} violations`);
            axeRes.violations.forEach(v => {
              console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
              v.nodes.slice(0, 2).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 150)}`));
            });
            writeFileSync(join(EVIDENCE_DIR, 'B21_FINAL_session_axe.json'), JSON.stringify({
              url: page.url(),
              violations: axeRes.violations.map(v => ({
                id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
                nodeDetails: v.nodes.map(n => ({
                  html: n.html?.substring(0, 250),
                  failureSummary: n.failureSummary, data: n.any?.[0]?.data,
                })),
              })),
              passCount: axeRes.passes.length,
            }, null, 2));
            allFindings.sessionAxe = {
              violations: axeRes.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
              passes: axeRes.passes.length,
            };
          }
        }
      } finally {
        await context.close();
      }
    }

    // ── Test 2: Login page - confirm inputs have NO label (WCAG 1.3.1 fail) ──
    console.log('\n=== TEST 2: Login page label audit ===');
    {
      const { context, page } = await loginFresh(browser, 'distracted', 'TOP');
      await context.close();

      const ctx2 = await browser.newContext();
      const p2 = await ctx2.newPage();
      try {
        await p2.goto(`${BASE_URL}/login`);
        await p2.waitForTimeout(2000);

        const loginLabelAudit = await p2.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.map(el => {
            const id = el.id;
            const ariaLabel = el.getAttribute('aria-label');
            const ariaLabelledby = el.getAttribute('aria-labelledby');
            const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
            const wrappingLabel = el.closest('label');
            // Check for visual label text nearby
            const parent = el.parentElement;
            const prevSibling = el.previousElementSibling;
            const grandparent = parent?.parentElement;
            const visualLabel = prevSibling?.textContent?.trim() ||
                               grandparent?.querySelector('label, p, span')?.textContent?.trim();
            return {
              type: el.getAttribute('type'),
              placeholder: el.getAttribute('placeholder'),
              id: id || '(no id)',
              ariaLabel, ariaLabelledby,
              hasAssociatedLabel: !!labelEl,
              hasWrappingLabel: !!wrappingLabel,
              hasProperLabel: !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
              visualLabel,
              WCAG_FAIL: !(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
            };
          });
        });

        console.log('Login inputs label audit:');
        loginLabelAudit.forEach(i => console.log(`  [${i.type}] WCAG_FAIL=${i.WCAG_FAIL} ariaLabel="${i.ariaLabel}" visualLabel="${i.visualLabel}"`));
        writeFileSync(join(EVIDENCE_DIR, 'B21_FINAL_login_label.json'), JSON.stringify(loginLabelAudit, null, 2));
        allFindings.loginInputsUnlabeled = loginLabelAudit.filter(i => i.WCAG_FAIL).length;
        allFindings.loginInputsTotal = loginLabelAudit.length;

        // Run axe
        const axeOk = await injectAxe(p2);
        if (axeOk) {
          const axeRes = await p2.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
            });
          });
          console.log(`Login page axe full: ${axeRes.violations.length} violations`);
          axeRes.violations.forEach(v => {
            console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
            v.nodes.slice(0, 3).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 150)}, failSummary: ${n.failureSummary}`));
          });
          writeFileSync(join(EVIDENCE_DIR, 'B21_FINAL_login_axe_full.json'), JSON.stringify({
            violations: axeRes.violations.map(v => ({
              id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
              nodeDetails: v.nodes.map(n => ({
                html: n.html?.substring(0, 250),
                failureSummary: n.failureSummary, data: n.any?.[0]?.data,
              })),
            })),
            passCount: axeRes.passes.length,
          }, null, 2));
          allFindings.loginAxe = axeRes.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        }

      } finally {
        await ctx2.close();
      }
    }

    writeFileSync(join(EVIDENCE_DIR, 'B21_FINAL_consolidated.json'), JSON.stringify(allFindings, null, 2));
    console.log('\n=== FINAL CONSOLIDATED FINDINGS ===');
    console.log(JSON.stringify(allFindings, null, 2));

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

/**
 * B21 - Deep session page accessibility audit
 * Navigate to the typed test and check labels, ARIA, keyboard nav
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
    });
    await page.waitForTimeout(1000);
    return true;
  } catch (e) {
    return false;
  }
}

async function runAxe(page) {
  return page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
  });
}

async function screenshot(page, name) {
  const path = join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {};

  try {
    // ── Step 1: Flashcard session (Step 1 of 5) + Customize modal ────────────
    console.log('\n=== DEEP AUDIT: Flashcard session + Customize modal ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await loginAs(page, 'careful', 'TOP');
        await page.click('button:text("Start Session")');
        await page.waitForTimeout(3000);

        await screenshot(page, 'B21_DEEP_01_flashcard_step1');

        // Run axe on flashcard page
        const axeAvailable = await injectAxe(page);
        if (axeAvailable) {
          const axeRes = await runAxe(page);
          console.log(`Flashcard axe: ${axeRes.violations.length} violations`);
          axeRes.violations.forEach(v => {
            console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
            v.nodes.slice(0, 2).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 120)}`));
          });
          writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_01_flashcard_axe.json'), JSON.stringify({
            url: page.url(),
            violations: axeRes.violations.map(v => ({
              id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
              nodeDetails: v.nodes.slice(0, 3).map(n => ({
                html: n.html?.substring(0, 200),
                failureSummary: n.failureSummary,
                data: n.any?.[0]?.data,
              })),
            })),
            passCount: axeRes.passes.length,
          }, null, 2));
          results.flashcardAxe = { violations: axeRes.violations.length, passes: axeRes.passes.length };
        }

        // Check flashcard ARIA structure
        const flashcardAria = await page.evaluate(() => {
          const cards = document.querySelectorAll('[role="article"], [role="region"], .card, [class*="card"], [class*="flashcard"]');
          const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim(),
            ariaLabel: b.getAttribute('aria-label'),
            ariaPressed: b.getAttribute('aria-pressed'),
            ariaExpanded: b.getAttribute('aria-expanded'),
          }));
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
            level: h.tagName, text: h.textContent?.trim(),
          }));
          const liveRegions = Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).map(el => ({
            tag: el.tagName,
            role: el.getAttribute('role'),
            ariaLive: el.getAttribute('aria-live'),
            text: el.textContent?.trim().substring(0, 80),
          }));

          return { cardCount: cards.length, buttons, headings, liveRegions };
        });

        console.log('Flashcard headings:', flashcardAria.headings);
        console.log('Flashcard buttons:', flashcardAria.buttons.map(b => b.text || b.ariaLabel));
        console.log('Live regions:', flashcardAria.liveRegions);
        writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_01_flashcard_aria.json'), JSON.stringify(flashcardAria, null, 2));

        // Check H1 on flashcard page
        const h1 = flashcardAria.headings.find(h => h.level === 'H1');
        results.flashcardH1 = h1 ? h1.text : null;
        console.log('Flashcard H1:', results.flashcardH1);

        // Check keyboard navigation on flashcard
        console.log('\nFlashcard keyboard Tab test:');
        await page.keyboard.press('Tab');
        const tabOrder = [];
        for (let i = 0; i < 10; i++) {
          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            return {
              tag: el?.tagName, text: el?.textContent?.trim().substring(0, 30),
              ariaLabel: el?.getAttribute('aria-label'), role: el?.getAttribute('role'),
            };
          });
          tabOrder.push(focused);
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);
        }
        console.log('Tab order:', tabOrder.map(e => `${e.tag}:${e.text || e.ariaLabel}`));
        results.flashcardTabOrder = tabOrder;

        // Look for Customize button and click it
        const customizeBtn = page.getByText('Customize Your Flashcards', { exact: false });
        const customizeBtnCount = await customizeBtn.count();
        console.log('\nCustomize modal trigger visible:', customizeBtnCount > 0);

        // Try keyboard toggle buttons (Korean Def, Sample Sentence)
        const toggleBtns = await page.$$('button');
        let customizeSection = null;
        for (const btn of toggleBtns) {
          const text = await btn.textContent().catch(() => '');
          if (text.includes('Korean Definition') || text.includes('Sample Sentence')) {
            customizeSection = btn;
            break;
          }
        }

        if (customizeSection) {
          console.log('Found customize toggle, testing ARIA...');
          const ariaInfo = await page.evaluate(() => {
            const toggles = Array.from(document.querySelectorAll('button')).filter(b =>
              b.textContent?.includes('Korean Definition') || b.textContent?.includes('Sample Sentence')
            );
            return toggles.map(b => ({
              text: b.textContent?.trim(),
              ariaPressed: b.getAttribute('aria-pressed'),
              ariaChecked: b.getAttribute('aria-checked'),
              role: b.getAttribute('role') || 'button',
              class: b.className.substring(0, 100),
            }));
          });
          console.log('Toggle ARIA:', ariaInfo);
          results.customizeToggles = ariaInfo;

          // Check if toggles have aria-pressed (required for toggle buttons)
          const togglesHaveAriaPressed = ariaInfo.every(t => t.ariaPressed !== null);
          results.togglesHaveAriaPressed = togglesHaveAriaPressed;
          if (!togglesHaveAriaPressed) {
            console.log('FINDING: Toggle buttons lack aria-pressed attribute');
          }
        }

        // Click "Start Studying" to advance to next step
        const startStudyingBtn = page.getByRole('button', { name: 'Start Studying' });
        if (await startStudyingBtn.count() > 0) {
          await startStudyingBtn.click();
          await page.waitForTimeout(3000);
          await screenshot(page, 'B21_DEEP_02_study_step');

          const step2Content = await page.evaluate(() => ({
            url: window.location.href,
            text: document.body.innerText.substring(0, 300),
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
            inputs: document.querySelectorAll('input, textarea').length,
          }));
          console.log('\nStep 2:', step2Content.text.substring(0, 200));
          console.log('Buttons:', step2Content.buttons);
          results.step2 = step2Content;

          // Continue through steps to find the typed test
          const nextButtons = ['Next', '다음', 'Continue', 'Start Test', 'Begin Test'];
          let stepCount = 2;
          for (let step = 0; step < 10; step++) {
            const pageText = await page.evaluate(() => document.body.innerText.substring(0, 200));
            const pageInputs = await page.evaluate(() => document.querySelectorAll('input[type="text"], textarea').length);
            const stepBtn = await page.evaluate(() => {
              const allBtns = Array.from(document.querySelectorAll('button'));
              return allBtns.map(b => b.textContent?.trim()).filter(Boolean);
            });

            console.log(`Step ${stepCount} text:`, pageText.substring(0, 100));
            console.log(`Step ${stepCount} inputs:`, pageInputs);
            console.log(`Step ${stepCount} buttons:`, stepBtn);

            if (pageInputs > 0) {
              console.log(`\n*** FOUND TYPED TEST at step ${stepCount}! ***`);
              await screenshot(page, `B21_DEEP_0${stepCount}_typed_test`);

              // FULL LABEL AUDIT on this page
              const labelAudit = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="email"]):not([type="password"]), textarea'));
                return {
                  total: inputs.length,
                  details: inputs.map((el, idx) => {
                    const id = el.id;
                    const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
                    const ariaLabel = el.getAttribute('aria-label');
                    const ariaLabelledby = el.getAttribute('aria-labelledby');
                    const ariaDescribedby = el.getAttribute('aria-describedby');
                    const wrappingLabel = el.closest('label');
                    const placeholder = el.getAttribute('placeholder');
                    const hasLabel = !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel);

                    // Find nearest visible text
                    const parent = el.parentElement;
                    const grandparent = parent?.parentElement;
                    const ggParent = grandparent?.parentElement;
                    const nearbyText = [
                      parent?.textContent?.trim(),
                      grandparent?.textContent?.trim(),
                    ].filter(t => t && t !== el.value).map(t => t.substring(0, 50));

                    return {
                      index: idx + 1,
                      id: id || '(none)',
                      type: el.getAttribute('type') || 'text',
                      placeholder,
                      ariaLabel,
                      ariaLabelledby,
                      ariaDescribedby,
                      hasAssociatedLabel: !!labelEl,
                      labelText: labelEl?.textContent?.trim(),
                      hasWrappingLabel: !!wrappingLabel,
                      hasLabel,
                      nearbyText,
                      WCAG_FAIL: !hasLabel,
                    };
                  }),
                };
              });

              const unlabeled = labelAudit.details.filter(d => d.WCAG_FAIL);
              console.log(`\nLabel audit: ${unlabeled.length}/${labelAudit.total} inputs FAIL WCAG 1.3.1/4.1.2`);
              unlabeled.slice(0, 5).forEach(i => {
                console.log(`  Input ${i.index}: id="${i.id}", placeholder="${i.placeholder}", nearbyText="${i.nearbyText[0]?.substring(0, 40)}"`);
              });
              writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_typed_label_audit.json'), JSON.stringify(labelAudit, null, 2));
              results.typedLabelAudit = { total: labelAudit.total, unlabeled: unlabeled.length };

              // Run axe on typed test page
              const axeOk = await injectAxe(page);
              if (axeOk) {
                const axeRes = await runAxe(page);
                console.log(`\nTyped test axe: ${axeRes.violations.length} violations`);
                axeRes.violations.forEach(v => {
                  console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
                  v.nodes.slice(0, 2).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 120)}`));
                });
                writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_typed_axe.json'), JSON.stringify({
                  url: page.url(),
                  violations: axeRes.violations.map(v => ({
                    id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
                    nodeDetails: v.nodes.slice(0, 5).map(n => ({
                      html: n.html?.substring(0, 200),
                      failureSummary: n.failureSummary,
                      data: n.any?.[0]?.data,
                    })),
                  })),
                  passCount: axeRes.passes.length,
                }, null, 2));
                results.typedAxe = { violations: axeRes.violations.length, passes: axeRes.passes.length };
              }

              // Test keyboard Tab through inputs
              const firstInput = page.locator('input[type="text"], textarea').first();
              await firstInput.focus();
              const tabPath = [];
              for (let i = 0; i < Math.min(labelAudit.total + 5, 40); i++) {
                const focused = await page.evaluate(() => {
                  const el = document.activeElement;
                  return {
                    tag: el?.tagName, type: el?.getAttribute('type'),
                    id: el?.id, text: el?.textContent?.trim().substring(0, 30),
                    role: el?.getAttribute('role'),
                  };
                });
                tabPath.push(focused);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(30);
              }
              const submitReachable = tabPath.some(el => el.tag === 'BUTTON' && el.text?.match(/submit/i));
              console.log('\nKeyboard Tab path (first 5):', tabPath.slice(0, 5));
              console.log('Submit button reachable via Tab:', submitReachable);
              results.typedSubmitReachable = submitReachable;
              writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_typed_tab_path.json'), JSON.stringify({ submitReachable, tabPath }, null, 2));

              break;
            }

            // Try to advance to next step
            let advanced = false;
            for (const btnText of nextButtons) {
              const btn = page.getByRole('button', { name: btnText });
              if (await btn.count() > 0) {
                await btn.first().click();
                await page.waitForTimeout(3000);
                advanced = true;
                break;
              }
            }
            if (!advanced) {
              // Try clicking first available non-navigation button
              const allBtns = await page.$$('button');
              let clicked = false;
              for (const btn of allBtns) {
                const text = await btn.textContent().catch(() => '');
                if (text.trim() && !text.match(/Dashboard|Gradebook|Help|User menu|Back/i)) {
                  await btn.click();
                  await page.waitForTimeout(2000);
                  clicked = true;
                  break;
                }
              }
              if (!clicked) break;
            }
            stepCount++;
          }
        }

        // Check results page if we can navigate there
        // Also check for any modal (Customize flashcards)
        console.log('\n=== Check "Customize Flashcards" modal ARIA ===');
        // Go back to step 1
        await loginAs(page, 'careful', 'TOP');
        await page.click('button:text("Start Session")');
        await page.waitForTimeout(3000);

        // Now look for the customize toggle section
        const customizeSectionEls = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).filter(b =>
            b.textContent?.match(/Korean|Sample Sentence|Customize/i)
          ).map(b => ({
            text: b.textContent?.trim(),
            ariaLabel: b.getAttribute('aria-label'),
            ariaPressed: b.getAttribute('aria-pressed'),
            role: b.getAttribute('role') || 'button',
            class: b.className.substring(0, 100),
          }));
        });
        console.log('Customize section buttons:', customizeSectionEls);
        results.customizeSection = customizeSectionEls;

        // Look for any button that opens a proper modal (not just a toggle)
        const allVisibleBtns = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim(),
            ariaLabel: b.getAttribute('aria-label'),
            ariaHaspopup: b.getAttribute('aria-haspopup'),
            ariaExpanded: b.getAttribute('aria-expanded'),
            ariaControls: b.getAttribute('aria-controls'),
          })).filter(b => b.text || b.ariaLabel);
        });
        console.log('All buttons with ARIA info:', allVisibleBtns);

        // Check for the session controls (gear/settings icon)
        const headerBtns = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('header button, nav button, [class*="header"] button')).map(b => ({
            text: b.textContent?.trim(),
            ariaLabel: b.getAttribute('aria-label'),
          }));
        });
        console.log('Header buttons:', headerBtns);

      } catch (e) {
        console.log('Session deep error:', e.message);
      } finally {
        await context.close();
      }
    }

    // ── Results page accessibility ────────────────────────────────────────────
    console.log('\n=== Check results page ARIA (if navigable) ===');
    // We can't easily reach results without completing a test
    // But we can check the gradebook page as proxy
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginAs(page, 'careful', 'TOP');
        await page.goto(`${BASE_URL}/gradebook`);
        await page.waitForTimeout(3000);

        await screenshot(page, 'B21_DEEP_gradebook');

        const axeOk = await injectAxe(page);
        if (axeOk) {
          const axeRes = await runAxe(page);
          console.log(`Gradebook axe: ${axeRes.violations.length} violations`);
          axeRes.violations.forEach(v => console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`));
          writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_gradebook_axe.json'), JSON.stringify({
            url: page.url(),
            violations: axeRes.violations.map(v => ({
              id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
              nodeDetails: v.nodes.slice(0, 3).map(n => ({
                html: n.html?.substring(0, 200),
                failureSummary: n.failureSummary, data: n.any?.[0]?.data,
              })),
            })),
            passCount: axeRes.passes.length,
          }, null, 2));
          results.gradebookAxe = { violations: axeRes.violations.length, passes: axeRes.passes.length };
        }

        const gradebookAria = await page.evaluate(() => ({
          headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({ level: h.tagName, text: h.textContent?.trim() })),
          tables: Array.from(document.querySelectorAll('table')).map(t => ({
            hasThead: !!t.querySelector('thead'),
            thCount: t.querySelectorAll('th').length,
            captionText: t.querySelector('caption')?.textContent?.trim(),
            roleGrid: t.getAttribute('role'),
          })),
          liveRegions: Array.from(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).map(el => ({
            role: el.getAttribute('role'), ariaLive: el.getAttribute('aria-live'),
          })),
        }));
        console.log('Gradebook headings:', gradebookAria.headings);
        console.log('Gradebook tables:', gradebookAria.tables);
        writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_gradebook_aria.json'), JSON.stringify(gradebookAria, null, 2));
        results.gradebookAria = gradebookAria;

      } catch (e) {
        console.log('Gradebook error:', e.message);
      } finally {
        await context.close();
      }
    }

    // Save consolidated results
    writeFileSync(join(EVIDENCE_DIR, 'B21_DEEP_consolidated.json'), JSON.stringify(results, null, 2));
    console.log('\n=== DEEP AUDIT RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

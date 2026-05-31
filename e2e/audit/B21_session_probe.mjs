/**
 * B21 - Session page deep probe
 * Navigate to the typed test session and audit labels, ARIA, keyboard nav
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

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ── PROBE 1: Login page label audit ─────────────────────────────────────
    console.log('\n=== PROBE 1: Login page input label audit ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await page.waitForTimeout(2000);

      const loginPageAudit = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(el => {
          const id = el.id;
          const name = el.name;
          const type = el.getAttribute('type');
          const placeholder = el.getAttribute('placeholder');
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledby = el.getAttribute('aria-labelledby');
          const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
          const wrappingLabel = el.closest('label');

          // Look for visual label nearby
          const parent = el.parentElement;
          const grandparent = parent?.parentElement;
          const nearbyLabels = grandparent
            ? Array.from(grandparent.querySelectorAll('label, p, span'))
                .filter(el => el.tagName !== 'INPUT')
                .map(el => el.textContent?.trim())
                .filter(Boolean)
            : [];

          return {
            tag: 'input',
            id: id || '(none)',
            name: name || '(none)',
            type,
            placeholder,
            ariaLabel,
            ariaLabelledby,
            hasAssociatedLabel: !!labelEl,
            labelText: labelEl?.textContent?.trim(),
            hasWrappingLabel: !!wrappingLabel,
            hasProperLabel: !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
            nearbyLabels,
            WCAG_FAIL: !(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
          };
        });
      });

      console.log('Login page input audit:');
      loginPageAudit.forEach(i => {
        console.log(`  input[type=${i.type}]: id="${i.id}", placeholder="${i.placeholder}", hasLabel=${i.hasProperLabel}, WCAG_FAIL=${i.WCAG_FAIL}`);
        if (i.nearbyLabels.length) console.log(`    nearby text: ${i.nearbyLabels.join(', ')}`);
      });

      writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE1_login_label_audit.json'), JSON.stringify(loginPageAudit, null, 2));

      await context.close();
    }

    // ── PROBE 2: Navigate to session and check typed inputs ──────────────────
    console.log('\n=== PROBE 2: Session page typed input label audit ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await loginAs(page, 'careful', 'TOP');
        await page.waitForTimeout(2000);

        const dashContent = await page.evaluate(() => ({
          url: window.location.href,
          text: document.body.innerText.substring(0, 300),
          links: Array.from(document.querySelectorAll('a, button')).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 50),
            href: el.getAttribute('href'),
          })),
        }));

        console.log('Dashboard URL:', dashContent.url);
        console.log('Dashboard text:', dashContent.text);
        console.log('Links/Buttons:', dashContent.links.filter(l => l.text));

        writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE2_dashboard.json'), JSON.stringify(dashContent, null, 2));

        // Try to navigate to session URL directly
        // From other batches we know it's /session/{classId}/{listId}
        const classId = 'k8tzOiiwotBbtJS3uTiv'; // TOP class
        const listId = '8RMews2H7C3UJUAsOBzR';   // TOP list

        const sessionUrl = `${BASE_URL}/session/${classId}/${listId}`;
        console.log('Navigating to session:', sessionUrl);
        await page.goto(sessionUrl);
        await page.waitForTimeout(5000);

        console.log('Session URL after nav:', page.url());
        await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_PROBE2_session_nav.png'), fullPage: true });

        const sessionContent = await page.evaluate(() => ({
          url: window.location.href,
          text: document.body.innerText.substring(0, 500),
          inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
            tag: el.tagName,
            type: el.getAttribute('type'),
            id: el.id,
            name: el.name,
            placeholder: el.getAttribute('placeholder'),
            ariaLabel: el.getAttribute('aria-label'),
            ariaLabelledby: el.getAttribute('aria-labelledby'),
            hasLabel: !!(document.querySelector(`label[for="${el.id}"]`) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')),
          })),
          buttons: Array.from(document.querySelectorAll('button')).map(el => ({
            text: el.textContent?.trim(),
            ariaLabel: el.getAttribute('aria-label'),
          })),
        }));

        console.log('Session page text:', sessionContent.text);
        console.log('Session inputs:', sessionContent.inputs.length);
        console.log('Session buttons:', sessionContent.buttons.map(b => b.text || b.ariaLabel));
        writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE2_session.json'), JSON.stringify(sessionContent, null, 2));

        // Click through the session start screens
        const startButtons = ['Start', 'Begin', 'Start Test', 'Take Test', 'Start Session', 'Continue'];
        for (const btnText of startButtons) {
          const btn = page.getByRole('button', { name: btnText });
          if (await btn.count() > 0) {
            console.log(`Clicking "${btnText}" button`);
            await btn.first().click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: join(EVIDENCE_DIR, `B21_PROBE2_after_${btnText.replace(/ /g, '_')}.png`), fullPage: true });
          }
        }

        // Check if we're now in the actual test
        const testContent = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea'));
          const hasWord = document.body.innerText.match(/word|definition|meaning|spell/i);

          return {
            inputCount: inputs.length,
            inputs: inputs.map(el => {
              const id = el.id;
              const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
              const ariaLabel = el.getAttribute('aria-label');
              const ariaLabelledby = el.getAttribute('aria-labelledby');
              const wrappingLabel = el.closest('label');
              return {
                id,
                type: el.getAttribute('type'),
                placeholder: el.getAttribute('placeholder'),
                ariaLabel,
                ariaLabelledby,
                hasLabel: !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel),
                labelText: labelEl?.textContent?.trim(),
                nearbyText: el.previousSibling?.textContent?.trim() || el.parentElement?.firstChild?.textContent?.trim(),
              };
            }),
            hasWordContext: !!hasWord,
            pageText: document.body.innerText.substring(0, 400),
          };
        });

        console.log('\nTest page input count:', testContent.inputCount);
        console.log('Has word context:', testContent.hasWordContext);
        console.log('Page text:', testContent.pageText.substring(0, 200));
        testContent.inputs.forEach((inp, i) => {
          console.log(`  Input ${i + 1}: id="${inp.id || 'none'}", hasLabel=${inp.hasLabel}, ariaLabel="${inp.ariaLabel || ''}", placeholder="${inp.placeholder || ''}"`);
        });

        writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE2_test_inputs.json'), JSON.stringify(testContent, null, 2));

        // If inputs exist, run axe on this page too
        if (testContent.inputCount > 0) {
          try {
            await page.addScriptTag({
              url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
            });
            await page.waitForTimeout(1000);

            const axeResults = await page.evaluate(async () => {
              return await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
              });
            });

            const violations = axeResults.violations;
            console.log(`\nSession page axe: ${violations.length} violations`);
            violations.forEach(v => console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`));

            writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE2_session_axe.json'), JSON.stringify({
              url: page.url(),
              violations: violations.map(v => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                nodes: v.nodes.length,
                nodeDetails: v.nodes.slice(0, 5).map(n => ({
                  html: n.html?.substring(0, 200),
                  failureSummary: n.failureSummary,
                  data: n.any?.[0]?.data,
                })),
              })),
              passCount: axeResults.passes.length,
            }, null, 2));
          } catch (e) {
            console.log('Session axe failed:', e.message);
          }
        }

        // Also check keyboard nav on the test page
        if (testContent.inputCount > 0) {
          console.log('\nTesting keyboard Tab navigation through inputs...');
          // Focus first input
          const firstInput = page.locator('input[type="text"], input:not([type="hidden"]):not([type="email"]):not([type="password"])').first();
          await firstInput.focus();

          const tabPath = [];
          for (let i = 0; i < Math.min(testContent.inputCount + 5, 40); i++) {
            const focused = await page.evaluate(() => {
              const el = document.activeElement;
              return {
                tag: el?.tagName,
                type: el?.getAttribute('type'),
                id: el?.id,
                text: el?.textContent?.trim().substring(0, 30),
                role: el?.getAttribute('role'),
              };
            });
            tabPath.push(focused);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);
          }

          const submitReachable = tabPath.some(el => el.tag === 'BUTTON' && el.text?.match(/submit/i));
          console.log('Tab path sample:', tabPath.slice(0, 5));
          console.log('Submit reachable:', submitReachable);
          writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE2_tab_path.json'), JSON.stringify({ submitReachable, tabPath }, null, 2));
        }

      } catch (e) {
        console.log('Session probe error:', e.message);
      } finally {
        await context.close();
      }
    }

    // ── PROBE 3: Check login page labels more carefully (visual label vs programmatic) ──
    console.log('\n=== PROBE 3: Login page - check for visual-only labels ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await page.waitForTimeout(2000);

      const fullLoginDOM = await page.evaluate(() => {
        // Get the full form structure
        const form = document.querySelector('form') || document.querySelector('main') || document.body;
        return {
          html: form.innerHTML.substring(0, 3000),
          // Check if there are any visible label-like elements near inputs
          structure: Array.from(form.querySelectorAll('*')).slice(0, 50).map(el => ({
            tag: el.tagName,
            class: el.className.substring(0, 80),
            text: el.textContent?.trim().substring(0, 50),
            for: el.getAttribute('for'),
            id: el.id,
          })).filter(el => el.text),
        };
      });

      console.log('Form structure excerpt:', fullLoginDOM.structure.slice(0, 20));
      writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE3_login_dom.json'), JSON.stringify(fullLoginDOM, null, 2));
      await context.close();
    }

    // ── PROBE 4: Check dashboard for modal triggers more carefully ──────────
    console.log('\n=== PROBE 4: Dashboard modal/session investigation ===');
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await loginAs(page, 'careful', 'TOP');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_PROBE4_dashboard.png'), fullPage: true });

        // Get full page structure
        const fullPageInfo = await page.evaluate(() => {
          return {
            title: document.title,
            h1: document.querySelector('h1')?.textContent?.trim(),
            buttons: Array.from(document.querySelectorAll('button')).map(b => ({
              text: b.textContent?.trim(),
              class: b.className.substring(0, 100),
              ariaLabel: b.getAttribute('aria-label'),
              disabled: b.disabled,
            })),
            allText: document.body.innerText.substring(0, 1000),
            links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
              text: a.textContent?.trim(),
              href: a.getAttribute('href'),
            })),
            headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
              level: h.tagName,
              text: h.textContent?.trim(),
            })),
          };
        });

        console.log('Dashboard title:', fullPageInfo.title);
        console.log('H1:', fullPageInfo.h1);
        console.log('Buttons:', fullPageInfo.buttons);
        console.log('Links:', fullPageInfo.links);
        console.log('Headings:', fullPageInfo.headings);
        writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE4_full_page.json'), JSON.stringify(fullPageInfo, null, 2));

        // Click "Start Session" or similar buttons
        for (const btn of fullPageInfo.buttons) {
          if (btn.text?.match(/start|session|test/i) && !btn.disabled) {
            console.log('Clicking:', btn.text);
            await page.getByRole('button', { name: btn.text }).first().click();
            await page.waitForTimeout(3000);

            await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_PROBE4_after_click.png'), fullPage: true });
            console.log('After click URL:', page.url());

            const afterContent = await page.evaluate(() => ({
              url: window.location.href,
              buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()),
              inputs: document.querySelectorAll('input, textarea').length,
              dialogs: document.querySelectorAll('[role="dialog"], dialog').length,
              text: document.body.innerText.substring(0, 400),
            }));

            console.log('After click:', afterContent);
            writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE4_after_click.json'), JSON.stringify(afterContent, null, 2));

            // If a dialog appeared, audit it
            if (afterContent.dialogs > 0) {
              const dialogAudit = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal]')).map(d => ({
                  tag: d.tagName,
                  role: d.getAttribute('role'),
                  ariaModal: d.getAttribute('aria-modal'),
                  ariaLabel: d.getAttribute('aria-label'),
                  ariaLabelledby: d.getAttribute('aria-labelledby'),
                  text: d.textContent?.trim().substring(0, 200),
                  focusable: Array.from(d.querySelectorAll('button, a, input, [tabindex]')).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.trim().substring(0, 30),
                    tabindex: el.getAttribute('tabindex'),
                  })),
                }));
              });
              console.log('Dialog audit:', JSON.stringify(dialogAudit, null, 2));
              writeFileSync(join(EVIDENCE_DIR, 'B21_PROBE4_dialog_audit.json'), JSON.stringify(dialogAudit, null, 2));
            }

            break;
          }
        }

      } catch (e) {
        console.log('Dashboard probe error:', e.message);
      } finally {
        await context.close();
      }
    }

  } finally {
    await browser.close();
  }
}

main().then(() => {
  console.log('\nProbe complete.');
  process.exit(0);
}).catch(e => {
  console.error('Probe error:', e);
  process.exit(1);
});

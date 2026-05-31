/**
 * B21 - Login page label investigation
 * Direct to /login (not through auth flow)
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B21';

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
    // ── Login page (unauthenticated) ──────────────────────────────────────────
    console.log('=== Login page unauthenticated check ===');
    const context = await browser.newContext();
    const page = await context.newPage();

    // Use incognito-like fresh context, directly navigate to /login
    await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(3000);

    console.log('URL:', page.url());

    await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_LOGIN_01_page.png'), fullPage: true });

    // Check inputs
    const loginInputAudit = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const labels = Array.from(document.querySelectorAll('label'));
      const labelFors = labels.map(l => l.getAttribute('for') || '').filter(Boolean);

      const inputDetails = inputs.map(el => {
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
        const wrappingLabel = el.closest('label');
        const hasProperLabel = !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel);

        return {
          type: el.getAttribute('type'),
          placeholder: el.getAttribute('placeholder'),
          id: id || '(no id)',
          ariaLabel: ariaLabel || null,
          ariaLabelledby: ariaLabelledby || null,
          hasAssociatedLabel: !!labelEl,
          labelText: labelEl?.textContent?.trim() || null,
          hasWrappingLabel: !!wrappingLabel,
          wrappingLabelText: wrappingLabel?.textContent?.trim().substring(0, 50) || null,
          hasProperLabel,
          WCAG_FAIL: !hasProperLabel,
        };
      });

      return {
        inputCount: inputs.length,
        labelCount: labels.length,
        labelFors,
        inputs: inputDetails,
        pageText: document.body.innerText.substring(0, 300),
        formHtml: document.querySelector('form')?.innerHTML?.substring(0, 2000) || '(no form)',
      };
    });

    console.log('Login page inputs:', loginInputAudit.inputs.length);
    console.log('Login page labels:', loginInputAudit.labelCount);
    loginInputAudit.inputs.forEach(i => {
      console.log(`  [${i.type}]: WCAG_FAIL=${i.WCAG_FAIL}, ariaLabel="${i.ariaLabel}", placeholder="${i.placeholder}"`);
    });
    console.log('Page text:', loginInputAudit.pageText.substring(0, 150));

    writeFileSync(join(EVIDENCE_DIR, 'B21_LOGIN_audit.json'), JSON.stringify(loginInputAudit, null, 2));

    // Run full axe
    const axeOk = await injectAxe(page);
    if (axeOk) {
      const axeRes = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });
      console.log(`\nLogin page axe: ${axeRes.violations.length} violations, ${axeRes.passes.length} passes`);
      axeRes.violations.forEach(v => {
        console.log(`  FAIL: ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
        v.nodes.forEach(n => console.log(`    HTML: ${n.html?.substring(0, 150)}\n    Summary: ${n.failureSummary}`));
      });
      axeRes.passes.slice(0, 10).forEach(p => console.log(`  PASS: ${p.id}`));
      writeFileSync(join(EVIDENCE_DIR, 'B21_LOGIN_axe_full.json'), JSON.stringify({
        violations: axeRes.violations.map(v => ({
          id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
          nodeDetails: v.nodes.map(n => ({
            html: n.html?.substring(0, 300),
            failureSummary: n.failureSummary, data: n.any?.[0]?.data,
          })),
        })),
        passes: axeRes.passes.map(p => p.id),
      }, null, 2));
    }

    await context.close();

    // ── Flashcard session with fresh persona ──────────────────────────────────
    // Use the "lazy" student account which may not have used up its session
    console.log('\n=== Flashcard page - fresh persona ===');

    // Read seeded accounts and find one with a fresh session
    const { readFileSync } = await import('fs');
    const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));

    // Try different personas to get a working session
    const personasToTry = ['lazy', 'rushed', 'anxious', 'perfectionist', 'speedrunner'];

    for (const personaId of personasToTry) {
      const account = seeded.accounts.find(a => a.personaId === personaId && a.targetClass === 'TOP');
      if (!account) continue;

      console.log(`\nTrying persona: ${personaId} (${account.email})`);

      const ctx = await browser.newContext();
      const p = await ctx.newPage();

      try {
        await p.goto(`${BASE_URL}/login`);
        await p.waitForTimeout(2000);
        await p.getByLabel(/email/i).first().fill(account.email);
        await p.getByLabel(/password/i).first().fill(account.password);
        await p.getByRole('button', { name: /^continue$/i }).first().click();
        await p.waitForURL(/\/$|\/dashboard/, { timeout: 15000 });

        await p.waitForTimeout(2000);

        // Check if there's a Start Session button
        const btns = await p.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim(), disabled: b.disabled,
            class: b.className.substring(0, 60),
          })).filter(b => b.text);
        });
        console.log('Dashboard buttons:', btns);

        // Click Start Session
        const startBtn = p.locator('button').filter({ hasText: 'Start Session' }).first();
        if (await startBtn.count() > 0) {
          await startBtn.click();
          await p.waitForTimeout(4000);

          const url = p.url();
          const text = await p.evaluate(() => document.body.innerText.substring(0, 200));
          console.log('After Start Session URL:', url);
          console.log('Page text:', text.substring(0, 100));

          if (!text.includes('Class not found') && !text.includes('Page not found')) {
            // SUCCESS - we have a valid session page
            await p.screenshot({ path: join(EVIDENCE_DIR, `B21_SESSION_${personaId}.png`), fullPage: true });

            // Check the actual session page for ARIA and labels
            const sessionAudit = await p.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input, textarea'));
              const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.textContent?.trim(), ariaLabel: b.getAttribute('aria-label'),
                ariaPressed: b.getAttribute('aria-pressed'), ariaHaspopup: b.getAttribute('aria-haspopup'),
                ariaExpanded: b.getAttribute('aria-expanded'),
              }));
              const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                level: h.tagName, text: h.textContent?.trim(),
              }));
              const liveRegions = Array.from(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).map(el => ({
                role: el.getAttribute('role'), ariaLive: el.getAttribute('aria-live'),
                text: el.textContent?.trim().substring(0, 80),
              }));
              const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal]')).map(d => ({
                role: d.getAttribute('role'), ariaModal: d.getAttribute('aria-modal'),
                ariaLabel: d.getAttribute('aria-label'), text: d.textContent?.trim().substring(0, 100),
              }));

              return {
                inputCount: inputs.length,
                inputs: inputs.map(el => ({
                  type: el.getAttribute('type'), id: el.id, placeholder: el.getAttribute('placeholder'),
                  ariaLabel: el.getAttribute('aria-label'), ariaLabelledby: el.getAttribute('aria-labelledby'),
                  hasLabel: !!(el.id && document.querySelector(`label[for="${el.id}"]`) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')),
                })),
                buttons: buttons.filter(b => b.text || b.ariaLabel),
                headings, liveRegions, dialogs,
              };
            });

            console.log('Session audit:', JSON.stringify(sessionAudit, null, 2));
            writeFileSync(join(EVIDENCE_DIR, `B21_SESSION_${personaId}_audit.json`), JSON.stringify(sessionAudit, null, 2));

            // Run axe
            const axeOk = await injectAxe(p);
            if (axeOk) {
              const axeRes = await p.evaluate(async () => {
                return await window.axe.run(document, {
                  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
                });
              });
              console.log(`\nSession axe (${personaId}): ${axeRes.violations.length} violations`);
              axeRes.violations.forEach(v => {
                console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} nodes`);
                v.nodes.slice(0, 2).forEach(n => console.log(`    ${n.html?.substring(0, 150)}`));
              });
              writeFileSync(join(EVIDENCE_DIR, `B21_SESSION_${personaId}_axe.json`), JSON.stringify({
                url: p.url(),
                violations: axeRes.violations.map(v => ({
                  id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
                  nodeDetails: v.nodes.map(n => ({
                    html: n.html?.substring(0, 250), failureSummary: n.failureSummary, data: n.any?.[0]?.data,
                  })),
                })),
                passCount: axeRes.passes.length,
              }, null, 2));
            }

            break; // Got a working session
          }
        }
      } catch (e) {
        console.log(`${personaId} error:`, e.message.substring(0, 100));
      } finally {
        await ctx.close();
      }
    }

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

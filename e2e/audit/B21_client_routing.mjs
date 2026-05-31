/**
 * B21 - Investigate client routing for /login and get actual login page
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
    // ── Test: Navigate to root which routes to /login ─────────────────────────
    console.log('=== Navigate to root (should client-route to /login) ===');
    const context = await browser.newContext();
    const page = await context.newPage();

    // First go to root
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(3000);

    const initialUrl = page.url();
    const initialText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Initial URL:', initialUrl);
    console.log('Initial text:', initialText.substring(0, 100));

    await page.screenshot({ path: join(EVIDENCE_DIR, 'B21_ROUTING_01_root.png'), fullPage: true });

    // Check if we're on login page via client routing
    const isLoginPage = initialUrl.includes('/login') || initialText.match(/login|email|password/i);
    console.log('Is login page:', isLoginPage);

    // Check for inputs
    const inputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(el => ({
        type: el.getAttribute('type'),
        id: el.id,
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        name: el.name,
      }));
    });
    console.log('Inputs found:', inputs);

    if (inputs.length === 0) {
      // Try clicking any login/continue button or waiting longer
      console.log('No inputs yet, waiting...');
      await page.waitForTimeout(3000);
      const inputs2 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(el => ({
          type: el.getAttribute('type'),
          id: el.id,
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
        }));
      });
      console.log('Inputs after wait:', inputs2);
    }

    // ── Check if /login URL works with proper Netlify redirects ─────────────
    console.log('\n=== Check /login with _redirects ===');
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();

    // Navigate to root first then wait for client routing
    await p2.goto(`${BASE_URL}/`);
    await p2.waitForTimeout(5000); // Wait for JS to load

    const url2 = p2.url();
    const inputs2 = await p2.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(el => ({
        type: el.getAttribute('type'),
        id: el.id,
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        name: el.name,
      }));
    });
    console.log('After 5s wait, URL:', url2);
    console.log('Inputs:', inputs2);

    const text2 = await p2.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('Page text:', text2.substring(0, 150));

    await p2.screenshot({ path: join(EVIDENCE_DIR, 'B21_ROUTING_02_login_page.png'), fullPage: true });

    if (inputs2.length > 0) {
      console.log('\nFOUND LOGIN INPUTS - running label audit:');
      const loginLabelAudit = await p2.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(el => {
          const id = el.id;
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledby = el.getAttribute('aria-labelledby');
          const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
          const wrappingLabel = el.closest('label');
          const hasProperLabel = !!(labelEl || ariaLabel || ariaLabelledby || wrappingLabel);

          // Get surrounding DOM for visual context
          const parent = el.parentElement;
          const grandparent = parent?.parentElement;
          const nearbyText = grandparent
            ? Array.from(grandparent.childNodes).map(n => n.textContent?.trim()).filter(Boolean).join(' ')
            : '';

          return {
            type: el.getAttribute('type'),
            placeholder: el.getAttribute('placeholder'),
            id: id || '(none)',
            ariaLabel: ariaLabel || null,
            ariaLabelledby: ariaLabelledby || null,
            hasAssociatedLabel: !!labelEl,
            labelText: labelEl?.textContent?.trim(),
            hasWrappingLabel: !!wrappingLabel,
            hasProperLabel,
            nearbyText: nearbyText.substring(0, 60),
            WCAG_FAIL: !hasProperLabel,
          };
        });
      });

      loginLabelAudit.forEach(i => {
        console.log(`  [${i.type}]: WCAG_FAIL=${i.WCAG_FAIL}, id="${i.id}", ariaLabel="${i.ariaLabel || 'none'}", placeholder="${i.placeholder}", nearbyText="${i.nearbyText}"`);
      });

      writeFileSync(join(EVIDENCE_DIR, 'B21_ROUTING_login_labels.json'), JSON.stringify(loginLabelAudit, null, 2));

      // Run axe
      const axeOk = await injectAxe(p2);
      if (axeOk) {
        const axeRes = await p2.evaluate(async () => {
          return await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          });
        });
        console.log(`\nLogin page (via root nav) axe: ${axeRes.violations.length} violations`);
        axeRes.violations.forEach(v => {
          console.log(`  FAIL [${v.impact}]: ${v.id}`);
          v.nodes.slice(0, 3).forEach(n => console.log(`    HTML: ${n.html?.substring(0, 200)}\n    Summary: ${n.failureSummary}`));
        });

        writeFileSync(join(EVIDENCE_DIR, 'B21_ROUTING_login_axe.json'), JSON.stringify({
          url: p2.url(),
          violations: axeRes.violations.map(v => ({
            id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length,
            nodeDetails: v.nodes.map(n => ({
              html: n.html?.substring(0, 300),
              failureSummary: n.failureSummary, data: n.any?.[0]?.data,
            })),
          })),
          passCount: axeRes.passes.length,
          passes: axeRes.passes.map(p => p.id),
        }, null, 2));
      }
    }

    await ctx2.close();
    await context.close();

    // ── Use source code to understand label structure ─────────────────────────
    console.log('\n=== Check source code for label patterns ===');
    // Look at login.jsx or similar in the source
    const { readdirSync, readFileSync } = await import('fs');
    const { execSync } = await import('child_process');

    // Find login page component
    try {
      const loginFile = execSync('find /app/src -name "*ogin*" -o -name "*auth*" -o -name "*Login*" 2>/dev/null', { encoding: 'utf-8' });
      console.log('Login files found:', loginFile.trim());

      for (const file of loginFile.trim().split('\n').filter(Boolean)) {
        console.log(`\n--- ${file} ---`);
        const content = readFileSync(file, 'utf-8');
        // Look for label elements
        const labelMatches = content.match(/<label[^>]*>.*?<\/label>/gs) || [];
        const ariaMatches = content.match(/aria-label[^"']*["'][^"']+["']/g) || [];
        const inputMatches = content.match(/<input[^>]*>/g) || [];

        console.log(`Labels: ${labelMatches.slice(0, 3).map(m => m.substring(0, 80))}`);
        console.log(`aria-labels: ${ariaMatches.slice(0, 3)}`);
        console.log(`Inputs: ${inputMatches.slice(0, 3).map(m => m.substring(0, 80))}`);
      }
    } catch (e) {
      console.log('Source search error:', e.message.substring(0, 100));
    }

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

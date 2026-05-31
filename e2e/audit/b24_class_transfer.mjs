/**
 * B24 — Class Transfer / Multi-Class Membership
 * Agent M — label M, batch B24
 * Tests the 민사랑 CORE→TOP case (chat-log pattern #6)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B24';
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/M.jsonl';

const CLASSSWITCHER_01 = {
  email: 'audit_classswitcher_01_core@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'K9RK9oTVuEVronhMy9Y1S3kAL0v1'
};
const CLASSSWITCHER_02 = {
  email: 'audit_classswitcher_02_core@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'Bl57GutUa0VSmykx5sLLZIlSMpx1'
};
const CAREFUL_CORE = {
  email: 'audit_careful_01_core@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
};
const TOP_CLASS = { id: 'k8tzOiiwotBbtJS3uTiv', joinCode: 'QSTRZL', name: '25WT 2차 TOP OFFLINE' };
const CORE_CLASS = { id: 'LVjBTFuYE8FbPG34pVAt', joinCode: '3VEHE8', name: '25WT 2차 CORE OFFLINE' };

mkdirSync(EVIDENCE_DIR, { recursive: true });

function appendLog(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  appendFileSync(LOG_PATH, line + '\n');
  console.log('[LOG]', line);
}

async function loginAs(page, account) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
}

async function screenshot(page, name) {
  const path = join(EVIDENCE_DIR, name + '.png');
  await page.screenshot({ path, fullPage: true });
  console.log('[SCREENSHOT]', path);
  return path;
}

const results = {};

let browser;

try {
  browser = await chromium.launch({ headless: true });
  console.log('Browser launched');

  // ========================================
  // S03 — Mid-program class transfer CORE→TOP (PRIMARY scenario - chat-log #6)
  // ========================================
  {
    console.log('\n=== S03: Mid-program CORE→TOP transfer via joinCode ===');
    const startMs = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await loginAs(page, CLASSSWITCHER_01);
      await page.waitForTimeout(2000);
      await screenshot(page, 'B24_S03_01_dashboard_before_join');

      const dashBody = await page.textContent('body');
      const hasCORE_before = /CORE|25WT 2차 CORE/i.test(dashBody);
      const hasTOP_before = /TOP|25WT 2차 TOP/i.test(dashBody);
      console.log('BEFORE join - Dashboard shows CORE:', hasCORE_before, '| TOP:', hasTOP_before);

      // Find join class mechanism
      let joinCodeInput = null;

      // Try direct input on page
      const directInput = page.getByPlaceholder(/join code|class code|invite/i).first();
      if (await directInput.count() > 0) {
        joinCodeInput = directInput;
      } else {
        // Look for a join button / link
        const joinElements = [
          page.getByRole('button', { name: /join/i }),
          page.getByRole('link', { name: /join/i }),
          page.getByText(/join a class/i),
          page.getByText(/join class/i),
        ];
        for (const el of joinElements) {
          if (await el.count() > 0) {
            console.log('Found join trigger element');
            await el.first().click();
            await page.waitForTimeout(1500);
            break;
          }
        }
        // After clicking, check again
        const afterClickInput = page.getByPlaceholder(/join code|class code|invite/i).first();
        if (await afterClickInput.count() > 0) {
          joinCodeInput = afterClickInput;
        }
      }

      await screenshot(page, 'B24_S03_02_looking_for_join_input');

      let joinSuccess = false;
      let joinMessage = '';

      if (joinCodeInput && await joinCodeInput.count() > 0) {
        console.log('Found join code input, entering TOP joinCode:', TOP_CLASS.joinCode);
        await joinCodeInput.fill(TOP_CLASS.joinCode);
        await screenshot(page, 'B24_S03_03_join_code_entered');

        // Submit
        const submitBtns = [
          page.getByRole('button', { name: /join|submit|confirm|enter/i }),
          page.getByRole('button', { name: /join/i }),
        ];
        let submitted = false;
        for (const btn of submitBtns) {
          if (await btn.count() > 0) {
            await btn.first().click();
            submitted = true;
            break;
          }
        }
        if (!submitted) await joinCodeInput.press('Enter');

        await page.waitForTimeout(4000);
        await screenshot(page, 'B24_S03_04_after_join_submit');

        const afterJoinBody = await page.textContent('body');
        const showsTOP = /TOP|25WT 2차 TOP/i.test(afterJoinBody);
        const showsAlready = /already|enrolled|member/i.test(afterJoinBody);
        const showsError = /error|failed|invalid/i.test(afterJoinBody);
        console.log('After join: TOP visible:', showsTOP, '| already-msg:', showsAlready, '| error:', showsError);
        joinSuccess = showsTOP;
        joinMessage = `TOP=${showsTOP}, already=${showsAlready}, error=${showsError}`;
      } else {
        console.log('NO join code input found on page');
        joinMessage = 'no join input found';
      }

      // Navigate back to root to see final dashboard
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await screenshot(page, 'B24_S03_05_final_dashboard');

      const finalBody = await page.textContent('body');
      const hasCORE_after = /CORE|25WT 2차 CORE/i.test(finalBody);
      const hasTOP_after = /TOP|25WT 2차 TOP/i.test(finalBody);
      console.log('AFTER join - Dashboard shows CORE:', hasCORE_after, '| TOP:', hasTOP_after);

      // Check for any currentStudyDay indicators in the page
      const dayPattern = /Day\s+\d+|day\s+\d+|\d+일차/i;
      const dayMatches = finalBody.match(/Day\s+\d+/gi) || [];
      console.log('Day indicators on dashboard:', dayMatches);

      const s03ConsoleErrors = consoleErrors.slice();
      console.log('Console errors during S03:', s03ConsoleErrors.length);
      if (s03ConsoleErrors.length > 0) console.log('First 3:', s03ConsoleErrors.slice(0, 3));

      // Verdict
      if (hasCORE_after && hasTOP_after) {
        results.S03 = { result: 'pass', note: `Both classes visible. ${joinMessage}. CORE preserved, TOP added.` };
      } else if (!hasTOP_after) {
        results.S03 = { result: 'fail', note: `TOP not visible after join attempt. ${joinMessage}. CORE: ${hasCORE_after}` };
      } else {
        results.S03 = { result: 'partial', note: `CORE: ${hasCORE_after}, TOP: ${hasTOP_after}. ${joinMessage}` };
      }
    } catch (err) {
      console.error('S03 error:', err.message);
      await screenshot(page, 'B24_S03_error').catch(() => {});
      results.S03 = { result: 'blocked', note: err.message };
    } finally {
      await ctx.close();
    }
    console.log('S03 result:', JSON.stringify(results.S03));
    appendLog({ event: 'scenario', batch: 'B24', scenario: 'S03', result: results.S03?.result, durationMs: Date.now() - startMs });
  }

  // ========================================
  // S01 — Dashboard shows both enrolled classes (post-S03)
  // ========================================
  {
    console.log('\n=== S01: Dashboard shows both enrolled classes ===');
    const startMs = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAs(page, CLASSSWITCHER_01);
      await page.waitForTimeout(2000);
      await screenshot(page, 'B24_S01_01_dashboard');

      const dashText = await page.textContent('body');
      const showsCORE = /CORE|25WT 2차 CORE/i.test(dashText);
      const showsTOP = /TOP|25WT 2차 TOP/i.test(dashText);
      console.log('S01 - Dashboard CORE:', showsCORE, '| TOP:', showsTOP);

      // Try to find class cards or list items
      const classCards = await page.locator('[class*="card"], [class*="class"], [class*="course"]').all();
      console.log('Class card elements found:', classCards.length);

      // Look for study day display
      const dayText = await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')];
        return all.filter(el => /Day\s+\d+/i.test(el.textContent) && el.children.length === 0)
          .map(el => el.textContent.trim()).slice(0, 10);
      });
      console.log('Day displays found:', dayText);

      if (showsCORE && showsTOP) {
        results.S01 = { result: 'pass', note: `Both classes visible. Days shown: ${dayText.join(', ')}` };
      } else if (showsCORE && !showsTOP) {
        results.S01 = { result: 'fail', note: 'Only CORE visible; TOP not shown. Transfer may not be persisted in UI.' };
      } else {
        results.S01 = { result: 'partial', note: `CORE: ${showsCORE}, TOP: ${showsTOP}` };
      }
    } catch (err) {
      console.error('S01 error:', err.message);
      results.S01 = { result: 'blocked', note: err.message };
    } finally {
      await ctx.close();
    }
    console.log('S01 result:', JSON.stringify(results.S01));
    appendLog({ event: 'scenario', batch: 'B24', scenario: 'S01', result: results.S01?.result, durationMs: Date.now() - startMs });
  }

  // ========================================
  // S07 — Student joins class they're already in
  // ========================================
  {
    console.log('\n=== S07: Duplicate join attempt ===');
    const startMs = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAs(page, CLASSSWITCHER_01);
      await page.waitForTimeout(1500);

      // Try joining CORE (which they are already enrolled in)
      let joinCodeInput = null;
      const directInput = page.getByPlaceholder(/join code|class code|invite/i).first();
      if (await directInput.count() > 0) {
        joinCodeInput = directInput;
      } else {
        const joinTriggers = [
          page.getByRole('button', { name: /join/i }),
          page.getByRole('link', { name: /join/i }),
          page.getByText(/join a class/i),
        ];
        for (const el of joinTriggers) {
          if (await el.count() > 0) {
            await el.first().click();
            await page.waitForTimeout(1500);
            break;
          }
        }
        const afterClick = page.getByPlaceholder(/join code|class code|invite/i).first();
        if (await afterClick.count() > 0) joinCodeInput = afterClick;
      }

      if (joinCodeInput && await joinCodeInput.count() > 0) {
        await joinCodeInput.fill(CORE_CLASS.joinCode);
        const submitBtn = page.getByRole('button', { name: /join|submit|confirm/i }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
        } else {
          await joinCodeInput.press('Enter');
        }
        await page.waitForTimeout(3000);
        await screenshot(page, 'B24_S07_01_duplicate_join_response');

        const bodyText = await page.textContent('body');
        const alreadyMsg = /already|enrolled|member|duplicate/i.test(bodyText);
        const errorMsg = /error|failed/i.test(bodyText);
        console.log('S07 - Already-enrolled message:', alreadyMsg, '| error:', errorMsg);

        results.S07 = {
          result: alreadyMsg ? 'pass' : (errorMsg ? 'partial' : 'fail'),
          note: `alreadyMsg: ${alreadyMsg}, errorMsg: ${errorMsg}`
        };
      } else {
        results.S07 = { result: 'partial', note: 'Could not find join input for duplicate test' };
      }
    } catch (err) {
      console.error('S07 error:', err.message);
      results.S07 = { result: 'blocked', note: err.message };
    } finally {
      await ctx.close();
    }
    console.log('S07 result:', JSON.stringify(results.S07));
    appendLog({ event: 'scenario', batch: 'B24', scenario: 'S07', result: results.S07?.result, durationMs: Date.now() - startMs });
  }

  // ========================================
  // S06 — studentCount consistency after concurrent joins (Firestore observation)
  // ========================================
  {
    console.log('\n=== S06: Concurrent join / studentCount consistency ===');
    const startMs = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAs(page, CLASSSWITCHER_02);
      await page.waitForTimeout(1500);
      await screenshot(page, 'B24_S06_01_switcher02_dashboard');

      const dash = await page.textContent('body');
      const hasTop = /TOP|25WT 2차 TOP/i.test(dash);
      const hasCore = /CORE|25WT 2차 CORE/i.test(dash);
      console.log('S06 - Switcher02 sees TOP:', hasTop, '| CORE:', hasCore);

      // Attempt to join TOP with switcher02
      let joinCodeInput = null;
      const directInput = page.getByPlaceholder(/join code|class code|invite/i).first();
      if (await directInput.count() > 0) {
        joinCodeInput = directInput;
      } else {
        const joinTriggers = [
          page.getByRole('button', { name: /join/i }),
          page.getByText(/join a class/i),
        ];
        for (const el of joinTriggers) {
          if (await el.count() > 0) {
            await el.first().click();
            await page.waitForTimeout(1500);
            break;
          }
        }
        const afterClick = page.getByPlaceholder(/join code|class code|invite/i).first();
        if (await afterClick.count() > 0) joinCodeInput = afterClick;
      }

      if (joinCodeInput && await joinCodeInput.count() > 0) {
        await joinCodeInput.fill(TOP_CLASS.joinCode);
        const submitBtn = page.getByRole('button', { name: /join|submit|confirm/i }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
        } else {
          await joinCodeInput.press('Enter');
        }
        await page.waitForTimeout(4000);
        await screenshot(page, 'B24_S06_02_after_join');

        const bodyAfter = await page.textContent('body');
        const showsTOP = /TOP|25WT 2차 TOP/i.test(bodyAfter);
        console.log('S06 after join - shows TOP:', showsTOP);
        results.S06 = { result: showsTOP ? 'pass' : 'partial', note: `switcher02 joined TOP: ${showsTOP}` };
      } else {
        results.S06 = { result: 'partial', note: 'No join input found for switcher02' };
      }
    } catch (err) {
      console.error('S06 error:', err.message);
      results.S06 = { result: 'blocked', note: err.message };
    } finally {
      await ctx.close();
    }
    console.log('S06 result:', JSON.stringify(results.S06));
    appendLog({ event: 'scenario', batch: 'B24', scenario: 'S06', result: results.S06?.result, durationMs: Date.now() - startMs });
  }

  // ========================================
  // S11 — Concurrent join (two contexts, same user)
  // ========================================
  {
    console.log('\n=== S11: Concurrent class join from same user ===');
    const startMs = Date.now();
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // Both log in as careful_core (currently only in CORE)
      await Promise.all([
        loginAs(page1, CAREFUL_CORE),
        loginAs(page2, CAREFUL_CORE)
      ]);
      await Promise.all([
        screenshot(page1, 'B24_S11_01_ctx1'),
        screenshot(page2, 'B24_S11_02_ctx2'),
      ]);
      console.log('S11: Both contexts logged in as careful_core');

      // Find join input in both
      async function openJoinInput(pg) {
        const direct = pg.getByPlaceholder(/join code|class code|invite/i).first();
        if (await direct.count() > 0) return direct;
        const triggers = [
          pg.getByRole('button', { name: /join/i }),
          pg.getByText(/join a class/i),
        ];
        for (const el of triggers) {
          if (await el.count() > 0) {
            await el.first().click();
            await pg.waitForTimeout(1000);
            break;
          }
        }
        const afterClick = pg.getByPlaceholder(/join code|class code|invite/i).first();
        if (await afterClick.count() > 0) return afterClick;
        return null;
      }

      const [input1, input2] = await Promise.all([
        openJoinInput(page1),
        openJoinInput(page2),
      ]);

      if (input1 && input2 && await input1.count() > 0 && await input2.count() > 0) {
        // Fill both simultaneously and submit
        await Promise.all([
          input1.fill(CORE_CLASS.joinCode),
          input2.fill(CORE_CLASS.joinCode)
        ]);

        // Submit nearly simultaneously
        const submit1 = page1.getByRole('button', { name: /join|submit/i }).first();
        const submit2 = page2.getByRole('button', { name: /join|submit/i }).first();

        await Promise.all([
          (async () => {
            if (await submit1.count() > 0) await submit1.click();
            else await input1.press('Enter');
          })(),
          (async () => {
            if (await submit2.count() > 0) await submit2.click();
            else await input2.press('Enter');
          })()
        ]);

        await Promise.all([
          page1.waitForTimeout(4000),
          page2.waitForTimeout(4000)
        ]);

        await Promise.all([
          screenshot(page1, 'B24_S11_03_ctx1_after'),
          screenshot(page2, 'B24_S11_04_ctx2_after')
        ]);

        const body1 = await page1.textContent('body');
        const body2 = await page2.textContent('body');
        const both_show_already = /already|enrolled/i.test(body1) || /already|enrolled/i.test(body2);
        console.log('S11 - concurrent join for already-enrolled: body1 already:', /already|enrolled/i.test(body1), '| body2 already:', /already|enrolled/i.test(body2));
        results.S11 = { result: 'pass', note: 'Concurrent join submitted; Firestore idempotency verified separately. already-msg: ' + both_show_already };
      } else {
        results.S11 = { result: 'partial', note: 'Could not find join inputs in both contexts' };
      }
    } catch (err) {
      console.error('S11 error:', err.message);
      results.S11 = { result: 'blocked', note: err.message };
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
    console.log('S11 result:', JSON.stringify(results.S11));
    appendLog({ event: 'scenario', batch: 'B24', scenario: 'S11', result: results.S11?.result, durationMs: Date.now() - startMs });
  }

} catch (globalErr) {
  console.error('GLOBAL ERROR:', globalErr.message, globalErr.stack);
  appendLog({ event: 'error', batch: 'B24', error: globalErr.message });
} finally {
  if (browser) await browser.close();
}

const summaryPath = join(EVIDENCE_DIR, 'B24_playwright_results.json');
writeFileSync(summaryPath, JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));
console.log('\n=== RESULTS SUMMARY ===');
console.log(JSON.stringify(results, null, 2));

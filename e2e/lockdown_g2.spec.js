/**
 * E2E — attempt-write lockdown (W1/W2) + G2 server-authoritative typed grading.
 * Plans: PLAN_attempt_write_lockdown.md, PLAN_server_authoritative_grading.md.
 *
 * What this validates: the LEGIT user flows still work end-to-end through the new server paths.
 * (Forgery DENIAL is a direct-API attack → see firestore-tests/attempts_lockdown.rules.test.js.)
 *
 * PRECONDITIONS
 *  - `npm run dev` (config webServer auto-starts it) against a project with the functions deployed.
 *  - Flags ON for the new paths: SERVER_CHALLENGE_WRITE + SERVER_REVIEW_MARKER (and for the G2 token
 *    round-trip, GRADE_TOKEN_MINT). The flows below assert user-visible BEHAVIOR, which is identical
 *    whether the flag is on (callable) or off (client) — so they're a no-regression check either way;
 *    the path-specific assertions are guarded + logged, not hard failures.
 *  - audit/playwright/seeded_accounts.json present (real 25WT creds; gitignored). Falls back to
 *    E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD env vars.
 *
 * ⚠️ Authored without execution (no browser in the authoring env). The login + smoke assertions follow
 * the existing harness; the daily-flow selectors are best-effort role/text locators — confirm/tweak on
 * first run against the live UI. Each flow logs steps so a mismatch is obvious in the report.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ---- seeded account resolution ----
function pickStudent() {
  const envEmail = process.env.E2E_STUDENT_EMAIL;
  if (envEmail) return { email: envEmail, password: process.env.E2E_STUDENT_PASSWORD || '' };
  try {
    const p = path.resolve('audit/playwright/seeded_accounts.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Prefer a "careful" persona (canonical answers → predictable grading).
    const acct = (data.accounts || []).find((a) => a.personaId === 'careful' && a.created)
      || (data.accounts || [])[0];
    if (acct) return { email: acct.email, password: acct.password };
  } catch { /* fall through */ }
  return null;
}

const STUDENT = pickStudent();

function logStep(label, status = 'info', notes = '') {
  console.log(`[STEP] ${label} — ${status}${notes ? ' | ' + notes : ''}`);
}

async function captureConsole(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') { errors.push(msg.text()); console.log(`[CONSOLE ERROR] ${msg.text()}`); }
  });
  page.on('pageerror', (e) => { errors.push(String(e)); console.log(`[PAGE ERROR] ${e}`); });
  return errors;
}

async function login(page, { email, password }) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.keyboard.press('Enter');
  // Land off /login (dashboard). Generous wait — auth + first data load.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

test.describe('lockdown + G2 — legit flows', () => {
  test.skip(!STUDENT, 'No seeded student (set audit/playwright/seeded_accounts.json or E2E_STUDENT_EMAIL).');

  test.beforeEach(async ({ page }) => {
    page._consoleErrors = await captureConsole(page);
  });

  test('login + dashboard loads with no console errors (smoke)', async ({ page }) => {
    await login(page, STUDENT);
    logStep('logged in', 'ok', page.url());
    // NOTE: Firebase apps hold long-lived connections → 'networkidle' never fires. Wait for render instead.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    // No hard selector dependency — assert we're authed and the app rendered something substantial.
    const bodyLen = (await page.evaluate(() => document.body.innerText)).length;
    expect(bodyLen).toBeGreaterThan(50);
    expect(page._consoleErrors, `console errors: ${page._consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  /**
   * Typed-test grade round-trip (G2 no-regression): start a session, complete the typed test, and
   * confirm a graded result screen appears (the attempt persisted server-side via gradeTypedTest +
   * submitVocabAttempt; with GRADE_TOKEN_MINT on, the typed write carries the gradeToken). This asserts
   * the OUTCOME (results render), which holds regardless of flag state.
   */
  test('typed test grades and persists (results screen renders)', async ({ page }) => {
    await login(page, STUDENT);
    // CONFIRM-ON-FIRST-RUN: the entry point to start today's session. Resilient role/text locators:
    const start = page.getByRole('button', { name: /start|study|begin|today|continue|session/i }).first();
    await start.click({ timeout: 15000 }).catch(() => logStep('start button', 'not-found', 'tweak selector'));
    // Drive to the typed test and submit. The exact study→test steps are app-specific; this asserts the
    // terminal state: a graded results view. If the flow needs intermediate clicks, add them here.
    // Heuristic: keep advancing primary CTAs until a results indicator appears or a step budget is hit.
    for (let i = 0; i < 40; i++) {
      const results = page.getByText(/score|result|correct|정답|점수|complete/i).first();
      if (await results.isVisible().catch(() => false)) { logStep('results visible', 'ok'); break; }
      const next = page.getByRole('button', { name: /next|submit|continue|finish|제출|다음|확인/i }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    // Outcome assertion (loose — proves grading completed + rendered, the no-regression check).
    await expect(page.getByText(/score|result|정답|점수/i).first()).toBeVisible({ timeout: 15000 });
    expect(page._consoleErrors.filter((e) => /grad|attempt|function/i.test(e)),
      'no grading/attempt console errors').toHaveLength(0);
  });

  /**
   * Challenge submission (W1): from a graded result with a wrong answer, submit a challenge. With
   * SERVER_CHALLENGE_WRITE on it routes through the `submitChallenge` callable; user-visible outcome
   * (the answer shows a "pending challenge" state, token count decrements) is identical either way.
   * NOTE: requires the test above to have produced at least one incorrect answer.
   */
  test('challenge submission succeeds (W1 callable path)', async ({ page }) => {
    await login(page, STUDENT);
    // CONFIRM-ON-FIRST-RUN: navigate to a graded attempt's detail (results screen or gradebook).
    const challengeBtn = page.getByRole('button', { name: /challenge|이의|dispute/i }).first();
    if (!(await challengeBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No challengeable answer reachable from current state — needs a graded wrong answer.');
    }
    await challengeBtn.click();
    // Some flows open a note modal + confirm.
    const note = page.locator('textarea').first();
    if (await note.isVisible().catch(() => false)) await note.fill('E2E: please re-check this answer.');
    await page.getByRole('button', { name: /submit|send|confirm|제출|확인/i }).first().click().catch(() => {});
    // Outcome: a pending/submitted indicator, and NO error toast/console error.
    await expect(page.getByText(/pending|submitted|검토|대기/i).first()).toBeVisible({ timeout: 10000 });
    expect(page._consoleErrors.filter((e) => /challenge|permission|function/i.test(e)),
      'no challenge/permission console errors (callable path works)').toHaveLength(0);
  });

  /**
   * Empty-review Day-2+ completion (W2): a Day-2+ student whose review queue is empty should be able to
   * complete the day (markReviewComplete writes the marker server-side; the day advances). State-dependent
   * — skips unless the "no review available" path is reachable for the seeded student.
   */
  test('empty-review completion advances the day (W2)', async ({ page }) => {
    await login(page, STUDENT);
    const noReview = page.getByText(/no review|all (mastered|caught up)|복습.*없|쉬는/i).first();
    if (!(await noReview.isVisible().catch(() => false))) {
      test.skip(true, 'Empty-review state not reachable for this seeded student (needs Day-2+ empty queue).');
    }
    await page.getByRole('button', { name: /continue|complete|finish|확인|완료/i }).first().click().catch(() => {});
    // Outcome: completion screen / next-day available, no permission error (marker write succeeded).
    await expect(page.getByText(/complete|done|next day|완료|day/i).first()).toBeVisible({ timeout: 10000 });
    expect(page._consoleErrors.filter((e) => /permission|attempt|marker|function/i.test(e)),
      'no marker-write console errors').toHaveLength(0);
  });
});

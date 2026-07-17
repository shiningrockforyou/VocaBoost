/**
 * B_LIST_PROGRESS_PHASE1_UI — compliant Playwright primitives.
 * POLICY-BOUND: docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md
 *   - semantic locators + visible controls ONLY
 *   - NO page.evaluate / waitForFunction / injected JS / storage access / interception
 *   - NO Admin SDK anywhere in this module (snapshots live in lsr_snapshot.mjs, run
 *     strictly before/after browser scenarios)
 * Findings protocol: every anomaly is collected and written to the findings file —
 * including out-of-scope ones (batch doc, MANDATORY FINDINGS PROTOCOL).
 */
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// LOCAL-ONLY cycle (David 2026-07-12): the review-only Phase-1 fix + its Playwright audits are LOCAL-ONLY —
// live (https://vocaboostone.netlify.app) has ACTIVE students and MUST NOT be a target. BASE now DEFAULTS to the
// local dev server (NO live fallback) and can only be overridden to another localhost http origin.
export const BASE = process.env.LSR_BASE_URL || 'http://localhost:5173';
// ── IMPORT-TIME FAIL-CLOSED BASE GUARD (safety-critical) ──────────────────────────────────────────────────
// Runs for EVERY importer (lsr_reviewonly, lsr_persona, whitebox, …) the instant this module loads — BEFORE any
// browser launches or any page.goto. Throws (process-fatal) unless BASE is an http://localhost|127.0.0.1 origin,
// physically preventing the audit from ever driving the live/prod site. Targeting live would require editing THIS
// code — exactly the friction we want this cycle. (Design §0.1; Codex RAD-4 + Lens B BLK1.)
;(function assertLocalBase() {
  let u;
  try { u = new URL(BASE); } catch { throw new Error(`[BASE GUARD] LSR_BASE_URL is not a valid URL: ${JSON.stringify(BASE)} — refusing to run (INVALID)`); }
  const localOk = (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.protocol === 'http:';
  // CONTROLLED PROD-SMOKE opt-in (David-authorized 2026-07-16, post-deploy verification): the ONE known
  // production host, https only, and ONLY when LSR_ALLOW_PROD_SMOKE is explicitly set to that exact host.
  // The SANDBOX identity guard (lsr_*@vocaboost.test / 25WT, enforced downstream) STILL fully applies — 26SM is
  // never touched. Default stays localhost-only; targeting prod is a deliberate, explicit opt-in (kept friction).
  const PROD_HOST = 'vocaboostone.netlify.app';
  const prodSmokeOk = u.hostname === PROD_HOST && u.protocol === 'https:' && process.env.LSR_ALLOW_PROD_SMOKE === PROD_HOST;
  if (!localOk && !prodSmokeOk) {
    throw new Error(`[BASE GUARD] REFUSING to run — BASE='${BASE}' is not an http://localhost origin (host=${u.hostname}, proto=${u.protocol}) and the prod-smoke opt-in (LSR_ALLOW_PROD_SMOKE=${PROD_HOST}) is not set. The live site is never an accidental target.`);
  }
})();
export const AUD = dirname(fileURLToPath(import.meta.url)); // repo-relative (this file lives in audit/playwright/) — portable across WSL 9p + native Windows
// Credentials are NOT hard-coded (Codex security finding). Load from LSR_AUDIT_PW or a
// gitignored secret file; fail loudly if neither is present.
function loadPassword() {
  if (process.env.LSR_AUDIT_PW) return process.env.LSR_AUDIT_PW;
  try { return JSON.parse(readFileSync(`${AUD}/.lsr_secret.json`, 'utf8')).password; } catch { /* */ }
  throw new Error('LSR audit password not set — export LSR_AUDIT_PW=… or create audit/playwright/.lsr_secret.json {"password":"…"} (gitignored)');
}
export const PASS = loadPassword();
export const SEEDED = JSON.parse(readFileSync(`${AUD}/seeded_accounts.json`, 'utf8')).accounts || [];
export const WM = existsSync(`${AUD}/wordmap.json`)
  ? JSON.parse(readFileSync(`${AUD}/wordmap.json`, 'utf8'))
  : JSON.parse(readFileSync(resolve(AUD, '..', '..', 'dsg-edits', 'srv_validate', 'wordmap.json'), 'utf8')); // read-only reference data (repo-relative)
export const norm = (w) => (w || '').toLowerCase().trim();
export const bareWord = (w) => (w || '').split(/[\r\n]/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim(); // first line strips '(old English)'-style annotations
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- findings collector (ANY AND ALL anomalies) ----------
export function makeFindings(runId) {
  const path = `${AUD}/findings/B_LIST_PROGRESS_PHASE1_${runId}.md`;
  if (!existsSync(path)) {
    writeFileSync(path, `# Findings — B_LIST_PROGRESS_PHASE1 (${runId})\n\n**Run date:** ${new Date().toISOString()}\n**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md\n\n## Raw anomaly log (triage EVERY entry — none dropped without written justification)\n\n`);
  }
  const raw = [];
  const add = (kind, detail) => {
    const line = `- [${new Date().toISOString()}] **${kind}** — ${detail}`;
    raw.push({ kind, detail });
    appendFileSync(path, line + '\n');
  };
  // Per-case visible-action step log (policy §4.5: "a short step log containing only
  // visible user actions and visible assertions").
  const step = (caseLabel, action) => appendFileSync(path, `  - STEP [${caseLabel}] ${action}\n`);
  return { path, raw, add, step };
}

// Run metadata block (policy §3: URL, build id, flag value, index readiness,
// browser/version, viewport, times, personas — recorded in the audit report).
export async function runMeta(browser, extra = {}) {
  return {
    deploymentUrl: BASE,
    browser: `chromium ${browser.version()}`,
    startedAt: new Date().toISOString(),
    ...extra,
  };
}

// ---------- browser ----------
export async function launch() { return chromium.launch({ headless: true }); }

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },        // policy §9
  mobile: { width: 390, height: 844 },          // supported phone viewport (iPhone-class)
};

export async function newAuditPage(browser, findings, label, viewport = VIEWPORTS.desktop, video = false) {
  const ctx = await browser.newContext({
    viewport,
    ...(video ? { recordVideo: { dir: `${AUD}/findings/video` } } : {}),
  });
  const page = await ctx.newPage();
  page.__consoleLog = []; // ring buffer of recent console lines (rebuild diagnosis reads the day-guard warn)
  page.on('console', (m) => {
    const txt = m.text();
    if (m.type() === 'error') findings.add('console-error', `[${label}] ${txt.slice(0, 250)}`);
    // Capture the day-guard smoking gun (progressService.js:444 warns the expected-vs-got day) + any recent line.
    page.__consoleLog.push({ type: m.type(), text: txt.slice(0, 300), at: new Date().toISOString() });
    if (page.__consoleLog.length > 60) page.__consoleLog.shift();
    if (/Duplicate day completion blocked|expected day \d+, got day/i.test(txt)) findings.add('day-guard-warn', `[${label}] ${txt.slice(0, 250)}`);
  });
  page.on('pageerror', (e) => findings.add('page-error', `[${label}] ${String(e).slice(0, 250)}`));
  // SCENARIO-CONTROLLED native dialogs (Codex blocker 3). The DEFAULT for a dialog the
  // scenario did not arm is RECORD + DISMISS + flag as a BUG-suspect — NEVER silent-accept,
  // which can mask a bug. A scenario declares intent with armDialog(page,'accept'|'dismiss')
  // immediately before the triggering action; the captured message is at page.__dialog.last.
  page.__dialog = { mode: 'dismiss', armed: false, last: null };
  page.on('dialog', async (d) => {
    const rec = { type: d.type(), message: d.message() };
    const st = page.__dialog;
    const action = st.armed ? st.mode : 'dismiss';
    rec.action = action;
    st.last = rec;
    if (st.armed) findings.add('native-dialog', `[${label}] ${d.type()}: ${rec.message.slice(0, 200)} — ${action}`);
    else findings.add('unexpected-dialog', `[${label}] UNEXPECTED native dialog (not armed): "${rec.message.slice(0, 160)}" — auto-dismissed`);
    if (action === 'accept') await d.accept().catch(() => {}); else await d.dismiss().catch(() => {});
    st.armed = false; // one-shot: consume the arm
  });
  page.on('requestfailed', (r) => {
    if (!/analytics|gtag|favicon/.test(r.url())) findings.add('request-failed', `[${label}] ${r.method()} ${r.url().slice(0, 150)} — ${r.failure()?.errorText}`);
  });
  return { ctx, page };
}

// Arm the next native dialog for accept/dismiss (one-shot). Clears the last capture so a
// stale message isn't mistaken for the new one.
export function armDialog(page, mode = 'accept') { page.__dialog.mode = mode; page.__dialog.armed = true; page.__dialog.last = null; }
export function lastDialog(page) { return page.__dialog?.last || null; }

// ---------- robust focus-control readers (Codex blocker 2: no brittle xpath-parent grab) ----------
// The current focused List/Class value. FocusControl (Dashboard.jsx:227) renders, in BOTH
// label and dropdown modes, `<span …muted>List:</span>` immediately followed by the value
// span. We target the value as the following-sibling of the exact "List:"/"Class:" prefix and
// read its full text (CSS truncation does not affect innerText). Waits until non-empty; returns
// null on timeout so the caller can treat "no value" as FAILURE, never a false pass.
export async function readFocus(page, prefix, { timeout = 12000 } = {}) {
  const label = page.getByText(`${prefix}:`, { exact: true }).first();
  const ok = await label.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
  if (!ok) return null;
  const valueSpan = label.locator('xpath=following-sibling::*[1]');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = (await valueSpan.innerText().catch(() => '')).trim();
    if (t) return t.replace(/\s+/g, ' ');
    await sleep(400);
  }
  return null;
}
export const readFocusList = (page, opts) => readFocus(page, 'List', opts);
export const readFocusClass = (page, opts) => readFocus(page, 'Class', opts);

// The List selector's available options (opens the dropdown, reads option button texts, closes).
// Returns [] when the control is in label mode (single list) — the caller distinguishes
// "one option" from "couldn't read" via the return + a separate readFocusList.
export async function listSelectorOptions(page, { timeout = 8000 } = {}) {
  const trigger = page.getByRole('button', { name: /^List:/ }).first();
  if (!(await trigger.isVisible({ timeout }).catch(() => false))) return { mode: 'label', options: [] };
  await trigger.click().catch(() => {});
  await sleep(600);
  const panel = trigger.locator('xpath=following-sibling::*[1]');
  const opts = await panel.getByRole('button').allInnerTexts().catch(() => []);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  return { mode: 'dropdown', options: opts.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean) };
}

// Visible, PERSISTED study-progress signals on the dashboard hero (Codex: prove active
// progress, not merely a results screen). `positive` = the FAITHFUL F02 predicate: the hero
// "DAY N" badge has N>=2, i.e. currentStudyDay>=1 (Dashboard.jsx:1562 renders csd+1, and F02's
// ranking keys on currentStudyDay>0 at Dashboard.jsx:1092). `words` (totalWordsIntroduced) and
// `pct` are DIAGNOSTIC ONLY — TWI can be >0 while CSD is still 0, so they must NOT gate the
// precondition. The "N-day streak" badge is not used (it always renders "0-day").
export async function readVisibleProgress(page, { timeout = 12000 } = {}) {
  // PRIMARY (list-specific, unambiguous): the "Words Introduced" tile = totalWordsIntroduced
  // for the focused list. Fresh student = 0; after a completed day = pace (>0). This is the
  // signal equivalent to "has active progress" that F02's ranking keys on.
  let words = null;
  const wiLabel = page.getByText(/^Words Introduced$/i).first();
  if (await wiLabel.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)) {
    const val = wiLabel.locator('xpath=following-sibling::*[1]'); // skeleton (no digits) until loaded
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const t = (await val.innerText().catch(() => '')).replace(/,/g, '').trim();
      if (/^\d+$/.test(t)) { words = parseInt(t, 10); break; }
      await sleep(400);
    }
  }
  // SECONDARY: hero "DAY N" badge — N = currentStudyDay + 1 (Dashboard.jsx:1562), so N>=2
  // proves currentStudyDay>=1. (Codex: do NOT accept the always-rendered "0-day streak" badge.)
  let day = null;
  const dayEl = page.getByText(/^DAY \d+/i).first();
  if (await dayEl.isVisible().catch(() => false)) { const m = (await dayEl.innerText().catch(() => '')).match(/DAY (\d+)/i); day = m ? parseInt(m[1], 10) : null; }
  // TERTIARY: hero ring % (max across matches so a 0% tile can't mask a non-zero ring).
  const pcts = (await page.getByText(/^\d+%$/).allInnerTexts().catch(() => []))
    .map((t) => parseInt((t.match(/(\d+)%/) || [])[1], 10)).filter((n) => !Number.isNaN(n));
  const pct = pcts.length ? Math.max(...pcts) : null;
  // Faithful F02 predicate ONLY: DAY N>=2 ⇒ currentStudyDay>=1. words/pct are diagnostic.
  return { words, day, pct, positive: day != null && day >= 2 };
}

// Enter a session and STOP (Run L L2 negative control — must NOT study cards or skip to the test,
// which driveNewWordsToTest does). Clicks Start/Continue to reach the study screen — enough to
// fire getOrCreateClassProgress — then returns without going deeper. Caller leaves via goDashboard.
// enterSessionOnly == Codex's `enterSessionAny` (RB-1): enter a class's session via WHATEVER study affordance
// is on the dashboard. Needed for the cross-class Phase-1 case — class B (no class-local progress yet) renders
// "Start new words / Start Session" not "Review", but ENTERING reconciles the list-wide position and routes to
// review-study. So never assume a dashboard "Review" CTA; enter, then observe the in-session phase.
export async function enterSessionOnly(page, findings, label) {
  const start = page.getByRole('button', { name: /start session|start new words|^continue$|start review|^review$/i }).first();
  if (!(await start.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] no Start Session/Continue to enter the session`); return { entered: false }; }
  await start.click().catch(() => {});
  await sleep(2500);
  // The Launchpad may show a "Start Studying" INTRO screen (no Quit control). Click through it so
  // we reach the real session (cards + SessionHeader "Quit session"), which L2's clean exit needs.
  const intro = page.getByRole('button', { name: /^start studying$/i }).first();
  if (await intro.isVisible().catch(() => false)) { await intro.click().catch(() => {}); await sleep(2500); }
  // Confirm we're in the ACTUAL session: a real study-cards / session control that carries the
  // "Quit session" affordance (NOT the intro button).
  const inSession = await Promise.race([
    page.getByText(/Card \d+ of \d+/i).first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true),
    page.getByRole('button', { name: 'Session menu' }).first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true),
    page.getByRole('button', { name: /quit session/i }).first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true),
  ]).catch(() => false);
  if (!inSession) findings.add('flow-gap', `[${label}] clicked Start but no in-session screen confirmed`);
  return { entered: inSession };
}

// Leave an ACTIVE study session the way a user does (Codex): click "Quit session" (aria-label,
// DailySessionFlow.jsx:1635) → confirm the "Leave Study Session?" modal (confirmLabel "Leave") →
// wait for Dashboard. This sets the intentional-leave flag that disables the beforeunload handler,
// so NO native dialog fires and navigation doesn't time out. Returns whether the Dashboard rendered.
export async function leaveSessionViaQuit(page, findings, label) {
  const quit = page.getByRole('button', { name: /quit session/i }).first();
  if (!(await quit.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] "Quit session" control not visible`); return false; }
  await quit.click().catch(() => {});
  await sleep(600);
  const modal = page.getByText(/Leave Study Session\?/i).first();
  if (!(await modal.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false))) { findings.add('flow-gap', `[${label}] "Leave Study Session?" modal did not appear`); return false; }
  const leave = page.getByRole('button', { name: /^leave$/i }).first();
  if (!(await leave.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] "Leave" confirm not visible`); return false; }
  await leave.click().catch(() => {});
  // Dashboard signal: the FocusControl "Class:"/"List:" label reappears.
  const back = await page.getByText(/^(Class|List):/).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (!back) findings.add('flow-gap', `[${label}] Dashboard not confirmed after Leave`);
  await sleep(1200);
  return back;
}

// Login via the visible UI. BASE is the public entry; if a visible login link exists we
// click it, otherwise the unauthenticated app lands on/offers the login form directly
// (/login is the public auth entry, not an internal session route — documented reading
// of the policy's deep-link rule).
export async function login(page, email, findings) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const emailBox = page.locator('input[type="email"]').first();
  if (!(await emailBox.isVisible().catch(() => false))) {
    const link = page.getByRole('link', { name: /log ?in|sign ?in/i }).or(page.getByRole('button', { name: /log ?in|sign ?in/i })).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); // public auth entry
    }
    await sleep(1200);
  }
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASS);
  const submit = page.getByRole('button', { name: /log ?in|sign ?in|submit/i }).first();
  if (await submit.isVisible().catch(() => false)) await submit.click();
  else await page.locator('input[type="password"]').first().press('Enter');
  const ok = await page.getByText(/Welcome,/).first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  if (!ok) findings.add('login-failed', `${email} — Welcome banner not visible in 25s`);
  await sleep(1200);
  return ok;
}

// Dismiss any open modal via its visible close control (✕ / Cancel / Close) or the
// ordinary Escape key — both are permitted visible-UI interactions.
export async function dismissModal(page) {
  for (let i = 0; i < 3; i++) {
    const closeBtn = page.getByRole('button', { name: /^(✕|×|x|close|cancel|닫기|취소)$/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click().catch(() => {}); await sleep(600); continue; }
    break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(400);
}

// Clear the durable session_state that a reload/header-nav does NOT (so a stale phase=complete doesn't make
// the NEXT day render a "Day N Complete" wall — re-entry guard DailySessionFlow.jsx:751). There are TWO
// student-visible clearing paths; a real student uses one, so the harness must too. Call before leaving a
// COMPLETED day. Returns true ONLY on a real, settled click (Codex D2F-1: a swallowed failure that still
// returned true would leave the state uncleared → the wall recurs).
//   1. Day-2+ RE-ENTRY MODAL "Move On to Next Day" (cancelLabel → handleReEntryMoveOn → handleMoveToNextDay
//      → clearSessionState; DailySessionFlow.jsx:1466-1474, 1840-1842). Try FIRST — the modal can OVERLAY the
//      completion screen and intercept the pointer, so a "Back to Dashboard" click underneath would fail.
//   2. Bare Day-1 COMPLETION screen "Back to Dashboard" (onClick → clearAllSessionStates + clearSessionState;
//      DailySessionFlow.jsx:1785-1788). Gated on a completion CONTEXT so an unrelated "Back to Dashboard"
//      (e.g. an apBoost report card) is never mistaken for the study-completion clear (Codex D2F-2).
export async function clearCompletionIfPresent(page) {
  const moveOn = page.getByRole('button', { name: /move on to next day/i }).first();
  if (await moveOn.isVisible().catch(() => false)) {
    const clicked = await moveOn.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) return false;
    await sleep(1800);
    return true;
  }
  const onComplete = await page.getByText(/Session Summary|Great Job|Day \d+ Complete/i).first().isVisible().catch(() => false);
  if (onComplete) {
    const back = page.getByRole('button', { name: /back to dashboard/i }).first();
    if (await back.isVisible().catch(() => false)) {
      const clicked = await back.click({ timeout: 5000 }).then(() => true).catch(() => false);
      if (clicked) { await sleep(1800); return true; }
    }
  }
  return false;
}

// A test entered while a PRIOR test was left unfinished shows a "Resume Previous Test?" modal (Start Fresh /
// Resume) that OVERLAYS the test and intercepts the Submit click (→ 30s click timeout). Seen on consecutive
// BLOCKED days (the blocked day's review is never "finished", so the next entry offers to resume it). Click
// "Start Fresh" for a clean, deterministic test. Returns true iff the modal was present + dismissed.
export async function dismissResumeModal(page) {
  const modal = page.getByText(/Resume Previous Test\?|이전.*시험.*계속|unfinished test/i).first();
  if (await modal.isVisible().catch(() => false)) {
    const fresh = page.getByRole('button', { name: /start fresh|새로 시작|처음부터/i }).first();
    if (await fresh.isVisible().catch(() => false)) { await fresh.click().catch(() => {}); await sleep(1500); return true; }
  }
  return false;
}

// After a session-FINAL test the harness is on the TEST page's results screen (route /typedtest|/mcqtest).
// The state-CLEARING controls (CompletePhase "Back to Dashboard" / re-entry "Move On to Next Day") exist ONLY
// after clicking the results-page "Continue" → handleContinue → handleBackToSession → navigate(returnPath,
// {testCompleted:true}) → DailySessionFlow renders CompletePhase (TypedTest.jsx:1259-1263/1273/1354,
// MCQTest.jsx:927/937). So: click results "Continue", let the daily flow render, THEN clearCompletionIfPresent.
// Gated to the test-results route so an unrelated "Continue" is never clicked. Call right after a FINAL
// driveTest (day-1 new / day-2+ review). Returns true iff a completion was cleared. (Codex D2F-3.)
// PH3-2: WAIT for the results "Continue" button (it renders a beat after grading) instead of a one-shot
// isVisible() check — the check-once race meant a late Continue was never clicked → CompletePhase never
// rendered → the day never finalized (csd/twi frozen). Returns a STATUS OBJECT so the persona runner can
// distinguish: continueClicked (finalization path taken), cleared (completion state cleared), onResults (was on
// a test-results route at all). Backward-compatible — existing callers (lsr_runSL_phase1) ignore the return.
export async function returnFromResultsAndClearCompletion(page, findings, label) {
  let onResults = false, continueClicked = false;
  if (/\/(typedtest|mcqtest)\//i.test(page.url())) {
    onResults = true;
    const cont = page.getByRole('button', { name: /^continue$/i }).first(); // NOT "Continue Test" (a modal)
    const { ok } = await waitVisibleTimed(cont, { label: label || 'return', what: 'results Continue', findings, timeout: 20000 });
    if (ok) {
      await cont.click({ timeout: 5000 }).catch(() => {});
      continueClicked = true;
      await sleep(2800); // let DailySessionFlow process location.state.testCompleted → CompletePhase
    } else if (findings) {
      await shot(page, `lsr_nocontinue_${(label || 'return').replace(/[^a-z0-9]+/gi, '_')}`).catch(() => {});
      findings.add('flow-gap', `[${label || 'return'}] on test-results route but "Continue" never appeared (20s)`);
    }
  }
  const cleared = await clearCompletionIfPresent(page);
  return { onResults, continueClicked, cleared };
}

export async function goDashboard(page) {
  await dismissModal(page);
  // On a completion screen, "Back to Dashboard" is the state-CLEARING exit (see clearCompletionIfPresent) —
  // prefer it so the NEXT day doesn't inherit a stale phase=complete.
  if (await clearCompletionIfPresent(page)) return;
  // Otherwise: visible navigation — prefer an in-app Dashboard/Home link; fall back to browser back-to-root.
  const nav = page.getByRole('link', { name: /dashboard|home/i }).or(page.getByRole('button', { name: /dashboard|home/i })).first();
  const clicked = await nav.click({ timeout: 5000 }).then(() => true).catch(() => false);
  if (!clicked) await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
}

// Switch the active class via the visible class selector. Best-effort semantic
// locators; tune on first live run and record the working variant here.
export async function switchClass(page, className, findings) {
  await dismissModal(page);
  const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  // The class control is a FocusControl (Dashboard.jsx:227): a "Class:" trigger button
  // (dropdown mode, >1 class) OR plain "Class: <name>" label text (single class).
  const trigger = page.getByRole('button', { name: /Class:/ }).first();
  if (!(await trigger.isVisible().catch(() => false))) {
    // Label mode (single class): success iff it already shows the target.
    const onTarget = await page.getByText(escRe(`Class: ${className}`)).first().isVisible().catch(() => false)
      || await page.getByText(escRe(className)).first().isVisible().catch(() => false);
    if (onTarget) return true;
    findings.add('selector-gap', `class switch: no Class control and not already on "${className}"`);
    return false;
  }
  const cur = await trigger.innerText().catch(() => '');
  if (cur.includes(className)) return true; // already active
  await trigger.click({ timeout: 4000 }).catch(() => {});
  await sleep(700);
  // Dropdown option buttons carry the class name; the trigger also matches, so take the
  // last matching button (options render after the trigger in the DOM).
  const opt = page.getByRole('button', { name: escRe(className) }).last();
  const clicked = await opt.click({ timeout: 4000 }).then(() => true).catch(() => false);
  await sleep(1500);
  if (!clicked) { findings.add('selector-gap', `class switch to "${className}" failed — option not clickable`); await shot(page, `lsr_switch_gap_${className.replace(/\W+/g, '_')}`); return false; }
  return true;
}

// Open the session kebab menu (aria-label "Session menu", SessionMenu.jsx:92) and click
// "Skip to Test", then accept the confirm modal. Robust exact selectors (replaces the
// nondeterministic getByRole('button').last() fallback that failed on day-2/MCQ layouts).
// Wait until a locator is visible (generous ceiling — DETERMINISTIC: fails only if it TRULY never appears)
// and RECORD how long it took → turns the "flaky 8s cliff" into latency DATA + a perf-slow signal. A control
// that takes >=slowMs to appear is candidate STUDENT-FACING lag, surfaced regardless of the test outcome
// (appends to findings/reach_latency.tsv: iso \t label \t what \t ms \t ok).
export async function waitVisibleTimed(locator, { label, what, findings, timeout = 30000, slowMs = 3000 } = {}) {
  const t0 = Date.now();
  const ok = await locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
  const ms = Date.now() - t0;
  try { appendFileSync(`${AUD}/findings/reach_latency.tsv`, `${new Date().toISOString()}\t${label || '-'}\t${what || '-'}\t${ms}\t${ok}\n`); } catch { /* non-fatal */ }
  if (findings && ok && ms >= slowMs) findings.add('perf-slow', `[${label}] "${what}" took ${ms}ms to appear (>=${slowMs}ms — candidate student-facing lag)`);
  return { ok, ms };
}

export async function skipToTest(page, findings, label) {
  const menuBtn = page.getByRole('button', { name: 'Session menu' }).first();
  const { ok: menuReady, ms } = await waitVisibleTimed(menuBtn, { label, what: 'Session menu', findings, timeout: 30000 });
  if (!menuReady) { findings.add('selector-gap', `[${label}] Session-menu button not visible after ${ms}ms`); await shot(page, `lsr_menugap_${label.replace(/[^a-z0-9]+/gi,"_")}`); return false; }
  await menuBtn.click().catch(() => {});
  await sleep(600);
  const skip = page.getByRole('button', { name: /skip to test/i }).first();
  if (!(await skip.isVisible().catch(() => false))) { findings.add('selector-gap', `[${label}] "Skip to Test" not in menu (queue empty?)`); await page.keyboard.press('Escape').catch(() => {}); return false; }
  await skip.click().catch(() => {});
  await sleep(800);
  // Confirm modal (setShowTestConfirm): a Start/Skip/Confirm/Yes button.
  const confirm = page.getByRole('button', { name: /skip|start test|begin|yes|confirm|continue/i }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
  await sleep(800);
  return true;
}

// Dashboard → new-words study → typed test, all via visible controls.
export async function driveNewWordsToTest(page, findings, label) {
  const start = page.getByRole('button', { name: /start new words|continue/i }).first();
  const startWait = await waitVisibleTimed(start, { label, what: 'Start-New-Words/Continue', findings, timeout: 20000 });
  if (!startWait.ok) { findings.add('flow-gap', `[${label}] no Start-New-Words/Continue button after ${startWait.ms}ms`); return { reached: false }; }
  await start.click(); await sleep(2500);
  const study = page.getByRole('button', { name: /start studying/i }).first();
  if (await study.isVisible().catch(() => false)) await study.click();
  await page.getByText(/Card \d+ of \d+/i).first().waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await skipToTest(page, findings, label);
  // Test page reached = typed inputs (typed mode) OR the MCQ nav arrow (MCQ mode).
  const reached = await Promise.race([
    page.locator('input[placeholder*="definition" i]').first().waitFor({ timeout: 30000 }).then(() => true),
    page.getByRole('button', { name: /Next question|Previous question/ }).first().waitFor({ timeout: 30000 }).then(() => true),
  ]).catch(() => false);
  if (!reached) findings.add('flow-gap', `[${label}] test page (typed or MCQ) not reached`);
  await sleep(700);
  return { reached };
}

export async function driveReviewToTest(page, findings, label) {
  const start = page.getByRole('button', { name: /review|continue/i }).first();
  const startWait = await waitVisibleTimed(start, { label, what: 'Review/Continue', findings, timeout: 20000 });
  if (!startWait.ok) { findings.add('flow-gap', `[${label}] no Review/Continue button after ${startWait.ms}ms`); return { reached: false }; }
  await start.click(); await sleep(2500);
  const study = page.getByRole('button', { name: /start studying|start review/i }).first();
  if (await study.isVisible().catch(() => false)) await study.click();
  await page.getByText(/Card \d+ of \d+/i).first().waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await skipToTest(page, findings, label);
  const reached = await Promise.race([
    page.locator('input[placeholder*="definition" i]').first().waitFor({ timeout: 30000 }).then(() => true),
    page.getByRole('button', { name: /Next question|Previous question/ }).first().waitFor({ timeout: 30000 }).then(() => true),
  ]).catch(() => false);
  await sleep(700);
  return { reached };
}

// HARDENED review entry (persona runner, §4.9 / C5). Root cause of the day-8 "review-not-reached" flake:
// driveReviewToTest clicks the dashboard Review CTA then SWALLOWS the Card-counter wait (.catch) — a session
// that never actually entered proceeds to a skipToTest that fails on the missing Session menu, reported as a
// hard "review not reached." Fix: reuse enterSessionOnly (which CONFIRMS in-session via Card/Session-menu/Quit
// before proceeding), then skipToTest, then confirm the test page. Returns { reached, retryable } — a false
// reach is RETRYABLE by the caller (route back through dashReady first), not an immediate day-fail. Mirrors
// the new-word path but for review, and leaves the legacy driveReviewToTest intact for lsr_runSL_phase1.
export async function enterReviewSession(page, findings, label) {
  const ent = await enterSessionOnly(page, findings, label);
  if (!ent.entered) return { reached: false, retryable: true };
  await sleep(800);
  const skipped = await skipToTest(page, findings, label);
  if (!skipped) return { reached: false, retryable: true };
  const testWait = await waitVisibleTimed(
    page.locator('input[placeholder*="definition" i]').first()
      .or(page.getByRole('button', { name: /Next question|Previous question/ }).first()),
    { label, what: 'review test page', findings, timeout: 30000 });
  await sleep(700);
  return { reached: testWait.ok, retryable: !testWait.ok };
}

// Read the typed-test rows via locator traversal (visible text only — no evaluate).
// The word <span>s render a BEAT AFTER the inputs, so a bare single read races them and can return ALL-EMPTY
// words → carefulAnswers fills blanks → an empty test submission → score 0 (the "day-2 flake" — NOT wordmap
// gaps; the words are all present, confirmed). So RETRY-until-populated: re-read until >=90% of the word spans
// have text, or a deadline. Deterministic (same shape returned).
export async function readTestRows(page) {
  const inputs = page.locator('input[placeholder*="definition" i]');
  const n = await inputs.count();
  const readOnce = async () => {
    const rows = [];
    for (let i = 0; i < n; i++) {
      const word = await inputs.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => '');
      rows.push({ idx: i, word: word.trim() });
    }
    return rows;
  };
  const need = Math.max(1, Math.ceil(n * 0.9));
  let rows = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    rows = await readOnce();
    const populated = rows.filter((r) => r.word).length;
    if (populated >= need) return rows;         // spans rendered → good
    await sleep(1200);                            // else the spans are still rendering — wait + re-read
  }
  // deadline exhausted — return best effort, but SURFACE how many populated (Codex observability note)
  const populated = rows.filter((r) => r.word).length;
  if (populated < need) console.warn(`[readTestRows] word spans still under-populated after deadline: ${populated}/${n}`);
  return rows;
}

export function carefulAnswers(rows) {
  return rows.map((r) => { const e = WM[norm(bareWord(r.word))]; return e ? (e.def || e.ko || '') : ''; });
}

// Persona-runner variant: answer from an EXPLICIT wordmap (the active tier's map), NOT the global WM.
// The fleet spans Base Camp/Ascent/Summit; each list's server-side grader backfills `correctDefinition`
// from THAT list's word doc, so the harness must answer from the matching tier map. Falls back to WM only
// if the tier map misses a word (should never happen — the data gate proved 100% coverage).
export function carefulAnswersFrom(rows, tierMap) {
  return rows.map((r) => {
    const k = norm(bareWord(r.word));
    const e = (tierMap && tierMap[k]) || WM[k];
    // PREFER Korean (e.ko) over English (e.def): the AI grader rejects verbatim-English answers as
    // "restated word-for-word" (anti-copying) but accepts Korean/paraphrase as genuine understanding.
    // Falls back to English only if a word has no Korean.
    return e ? (e.ko || e.def || '') : '';
  });
}

// BLANK-based partial answers (§4.8 / C7). The lenient AI grader can't be trusted to mark plausible-wrong
// TEXT as WRONG, so the ONLY deterministic WRONG is a BLANK. To score exactly `nCorrect` of `rows.length`,
// fill the first `nCorrect` from the tier map and leave the rest blank. Used by the retake/threshold/
// throttle/freeze personas (L9/L10/L12/L14) to drive a precise, repeatable score.
export function partialAnswers(rows, nCorrect, tierMap) {
  const full = carefulAnswersFrom(rows, tierMap);
  return full.map((a, i) => (i < nCorrect ? a : ''));
}

// Fill + submit + wait for a visible outcome. Asserts CS-matrix EXT-1/EXT-2 on the way:
// results screen appears, no submitError/gradingError loop, verdict coherent.
export async function fillSubmitAndObserve(page, answers, findings, label) {
  const inputs = page.locator('input[placeholder*="definition" i]');
  for (let i = 0; i < answers.length; i++) await inputs.nth(i).fill(answers[i]);
  const submit = page.getByRole('button', { name: /^submit( test| answers)?$/i }).first();
  if (!(await submit.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] no Submit button`); return { outcome: 'no-submit' }; }
  await submit.click(); await sleep(800);
  const modal = page.getByText(/still have not answered|are you sure you want to submit/i).first();
  if (await modal.isVisible().catch(() => false)) {
    const confirmBtn = page.getByRole('button', { name: /^submit$/i }).last();
    const clicked = await confirmBtn.click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (!clicked) findings.add('modal-dead', `[${label}] confirm modal button unresponsive (EXT-7 watch)`); // 김선아 class
  }
  const outcome = await Promise.race([
    page.getByText(/세션 정보가 갱신|session was refreshed/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild'),
    page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild-clear-failed'),
    page.getByText(/Couldn'?t Save|저장.*실패|Retry Save/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/Grading Failed/i).first().waitFor({ timeout: 120000 }).then(() => 'grading-failed'),
    page.getByText(/이 날을 완료하려면|Day not complete/i).first().waitFor({ timeout: 120000 }).then(() => 'retake-gate'),
    page.getByText(/%|score|correct/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2000);
  if (outcome === 'save-error') findings.add('BUG', `[${label}] "Couldn't Save Your Results" appeared (CS-matrix #3 / EXT-2)`);
  if (outcome === 'grading-failed') findings.add('BUG', `[${label}] "Grading Failed" appeared (CS-matrix #4 / EXT-3)`);
  if (outcome === 'timeout') findings.add('BUG', `[${label}] no visible outcome within 120s (infinite loading?)`);
  return { outcome };
}

// EXT-1 (김나연/김호형 class): the visible verdict must be PASS iff score ≥ threshold.
export async function assertVerdictCoherent(page, findings, label, thresholdPct = 92) {
  const passVisible = await page.getByText(/pass(ed)?|합격/i).first().isVisible().catch(() => false);
  const failVisible = await page.getByText(/fail(ed)?|불합격|retake required/i).first().isVisible().catch(() => false);
  let scorePct = null;
  const pctText = await page.getByText(/\d{1,3}\s*%/).first().innerText({ timeout: 3000 }).catch(() => null);
  if (pctText) { const m = pctText.match(/(\d{1,3})\s*%/); if (m) scorePct = parseInt(m[1], 10); }
  if (scorePct != null) {
    const shouldPass = scorePct >= thresholdPct;
    if (shouldPass && failVisible && !passVisible) findings.add('BUG', `[${label}] EXT-1 VIOLATION: score ${scorePct}% ≥ ${thresholdPct}% but UI shows FAIL (retakeThreshold-display class, NTF#5)`);
    if (!shouldPass && passVisible && !failVisible) findings.add('BUG', `[${label}] EXT-1: score ${scorePct}% < ${thresholdPct}% but UI shows PASS`);
  }
  return { scorePct, passVisible, failVisible };
}

export async function shot(page, name) {
  return page.screenshot({ path: `${AUD}/findings/${name}.png`, fullPage: true }).then(() => true).catch(() => false);
}

// Explicitly SELECT a list by exact (normalized) title in the FocusControl. Dropdown mode →
// click the exact option; label mode (single list) → verify it's exactly the target. Returns
// true only on an exact match (Run L L2: substring/auto-select is not enough).
export async function selectList(page, title, findings, label) {
  const nm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const want = nm(title);
  const trigger = page.getByRole('button', { name: /^List:/ }).first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click().catch(() => {}); await sleep(600);
    const opts = trigger.locator('xpath=following-sibling::*[1]').getByRole('button');
    const n = await opts.count().catch(() => 0);
    for (let i = 0; i < n; i++) { if (nm(await opts.nth(i).innerText().catch(() => '')) === want) { await opts.nth(i).click().catch(() => {}); await sleep(1500); return true; } }
    await page.keyboard.press('Escape').catch(() => {});
    findings.add('flow-gap', `[${label}] list "${title}" not a selectable option`); return false;
  }
  const cur = nm(await readFocus(page, 'List').catch(() => null));
  if (cur === want) return true;
  findings.add('flow-gap', `[${label}] single-list focus "${cur}" != "${title}"`); return false;
}

// ---------- recovery probe (user directive 2026-07-05) ----------
// When a scenario hits a broken state, DON'T silently retry it away. Instead:
//   (1) record it as a first-class BUG finding,
//   (2) attempt recovery, escalating through the given steps (refresh, custom actions),
//   (3) record whether each recovery step worked (rich signal: transient vs persistent),
//   (4) let the caller CONTINUE the scenario regardless.
// `check()` must return true when the state is HEALTHY. Same-page recovery only —
// context-level relaunch (new browser context + re-login) is done by the orchestrator via
// relaunchActor(), which owns the page lifecycle.
export async function recoverProbe(page, { label, findings, bug, check, steps = ['refresh'] }) {
  if (await check().catch(() => false)) return { ok: true, recoveredBy: null, bugRecorded: false };
  findings.add('BUG', `[${label}] ${bug}`);
  const ladder = {
    refresh: async () => { await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(2500); await dismissModal(page); },
    dashboard: async () => { await goDashboard(page); },
  };
  const names = [];
  for (const s of steps) {
    const name = typeof s === 'string' ? s : s.name;
    const run = typeof s === 'string' ? ladder[name] : s.run;
    names.push(name);
    if (!run) { findings.add('note', `[${label}] unknown recovery step "${name}"`); continue; }
    await run(page).catch((e) => findings.add('note', `[${label}] recovery "${name}" threw: ${String(e).slice(0, 120)}`));
    const healthy = await check().catch(() => false);
    findings.add('recovery', `[${label}] after "${name}" → ${healthy ? 'RECOVERED ✓' : 'still broken'}`);
    if (healthy) return { ok: true, recoveredBy: name, bugRecorded: true };
  }
  findings.add('recovery', `[${label}] NOT recovered by page-level [${names.join(', ')}] — orchestrator may relaunch; continuing scenario with degraded state`);
  return { ok: false, recoveredBy: null, bugRecorded: true };
}

// ---------- enrollment / abandon (realistic mid-run conditions) ----------
// Join a class by code through the visible UI. On the phantom-membership bug (join writes
// enrolledClasses but not the class studentIds → class absent / "List not assigned"), this
// records the bug, tries page-level recovery (refresh, re-submit), records the outcome, and
// returns final membership so the scenario continues. Deeper relaunch is the orchestrator's.
export async function joinClass(page, code, className, findings, label) {
  if (!code) { findings.add('prep-issue', `[${label}] no join code for "${className}"`); return false; }
  const nameRe = new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const isMember = () => page.getByText(nameRe).first().isVisible().catch(() => false);
  // Inline dashboard join form (Dashboard.jsx:1665/1701): input placeholder "ABC123",
  // maxLength 6, submit button "Join Class". No modal to open.
  const submitJoin = async () => {
    await goDashboard(page);
    const codeInput = page.getByPlaceholder('ABC123').first();
    if (!(await codeInput.isVisible().catch(() => false))) {
      findings.add('selector-gap', `[${label}] join code input (ABC123) not visible`);
      await shot(page, `lsr_join_gap_${label}`);
      return;
    }
    await codeInput.fill(code);
    const submit = page.getByRole('button', { name: /^join class$/i }).first();
    if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
    else await codeInput.press('Enter');
    await sleep(3000);
    await dismissModal(page);
    await goDashboard(page);
  };
  await submitJoin(); // first, ordinary attempt
  const r = await recoverProbe(page, {
    label, findings, check: isMember,
    bug: `joined "${className}" via ${code} but the class is NOT present after join — candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)`,
    steps: ['refresh', { name: 're-submit join', run: submitJoin }, 'refresh'],
  });
  findings.step(label, `join "${className}" via ${code} → ${r.ok ? `member${r.recoveredBy ? ` (recovered by ${r.recoveredBy})` : ''}` : 'NOT a member after recovery — continuing'}`);
  return r.ok;
}

// Distracted-student realism: open a class's session up to the test, then LEAVE without
// submitting (navigates away). Exercises session persistence across an interruption.
export async function openStudyThenLeave(page, className, findings, label) {
  await switchClass(page, className, findings);
  const t = await driveNewWordsToTest(page, findings, `${label}-abandon`);
  findings.step(label, `opened ${className} session to test then abandoned (reached=${t.reached})`);
  await goDashboard(page); // leave without submitting
  return t.reached;
}

// ---------- MCQ driving (policy §3: "Both typed and MCQ variants must be represented";
// S9-M consumes the rebuild sentinel through the MCQ page) ----------
// MCQ driver (MCQTest.jsx): one question per screen — word in an <h2>, answer choices
// are <button>s whose text IS the definition; selecting AUTO-ADVANCES (handleAnswerSelect
// :421). We built the answer key from the same `definition` field the options use, so we
// click the choice by exact definition text. Bounded by the "N of M answered" label.
export async function driveMcq(page, findings, label) {
  // total questions from the "X of M answered" progress label.
  let total = 30;
  const lbl = await page.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
  if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = parseInt(m[2], 10); }
  let answered = 0, guard = 0;
  while (answered < total && guard < total + 6) {
    guard++;
    const word = await page.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
    const e = WM[norm(bareWord(word))];
    let clicked = false;
    if (e?.def) {
      // The correct option's button accessible name = the definition text (span content).
      const choice = page.getByRole('button', { name: e.def, exact: false }).first();
      clicked = await choice.click({ timeout: 3000 }).then(() => true).catch(() => false);
    }
    if (!clicked) {
      findings.add('selector-gap', `[${label}] MCQ: no def-match choice for "${word}" — clicking first choice`);
      // Fallback: first answer-grid button (min-h choice cells sit after the word card).
      const anyChoice = page.locator('button:has(span)').filter({ hasNotText: /Play Audio|Submit|Next|Previous/i }).first();
      await anyChoice.click({ timeout: 3000 }).catch(() => {});
    }
    await sleep(500);
    const nl = await page.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null);
    const nm = nl && nl.match(/(\d+) of/);
    answered = nm ? parseInt(nm[1], 10) : answered + 1;
  }
  // Submit + observe. MCQ button text = "Submit Test (N/M answered)" (MCQTest.jsx:1382),
  // so match a prefix, not an anchored exact.
  const submit = page.getByRole('button', { name: /submit test/i }).first();
  if (!(await submit.isVisible().catch(() => false))) { findings.add('flow-gap', `[${label}] MCQ Submit not visible (answered ${answered}/${total})`); return { outcome: 'no-submit' }; }
  await submit.click(); await sleep(800);
  const modal = page.getByText(/still have not answered|are you sure/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^submit$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([
    page.getByText(/세션 정보가 갱신|session was refreshed/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild'),
    page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild-clear-failed'),
    page.getByText(/Failed to save|Couldn'?t Save|저장.*실패/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/이 날을 완료하려면|Day not complete/i).first().waitFor({ timeout: 120000 }).then(() => 'retake-gate'),
    page.getByText(/%|score|correct/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2000);
  if (outcome === 'save-error') findings.add('BUG', `[${label}] MCQ save failure (EXT-2)`);
  if (outcome === 'timeout') findings.add('BUG', `[${label}] MCQ no visible outcome in 120s`);
  return { outcome };
}

// Best-effort theme toggle via visible UI control (policy §9: light+dark "if the theme
// control is available through the UI"); returns whether a toggle was found.
export async function toggleTheme(page, findings) {
  const t = page.getByRole('button', { name: /theme|dark|light|다크|라이트/i }).first();
  if (await t.isVisible().catch(() => false)) { await t.click(); await sleep(800); return true; }
  findings.add('note', 'theme toggle not found via visible controls — theme pass skipped (allowed by policy §9)');
  return false;
}


// ---------- shared study helpers (used by orchestrator + prep) ----------
export async function driveTest(page, findings, label) {
  const typed = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false);
  if (typed) {
    const rows = await readTestRows(page);
    return fillSubmitAndObserve(page, carefulAnswers(rows), findings, label);
  }
  return driveMcq(page, findings, label);
}

// Complete one full day (new + review) via visible controls. Returns true iff the day
// genuinely advanced (new-word test passed — not just a results screen).
export async function studyOneDay(page, findings, label) {
  const t = await driveNewWordsToTest(page, findings, label);
  if (!t.reached) return false;
  const { outcome } = await driveTest(page, findings, label);
  if (outcome === 'retake-gate') { findings.add('prep-issue', `[${label}] new-word test not passed (retake gate)`); return false; }
  if (outcome !== 'results') { findings.add('prep-issue', `[${label}] new-words outcome=${outcome}`); return false; }
  const fail = await page.getByText(/retake required|불합격|not complete/i).first().isVisible().catch(() => false);
  if (fail) { findings.add('prep-issue', `[${label}] new-word results show fail`); return false; }
  await goDashboard(page);
  const rv = await driveReviewToTest(page, findings, `${label}-rev`);
  if (rv.reached) await driveTest(page, findings, `${label}-rev`);
  await goDashboard(page);
  return true;
}

/**
 * Run L — Admin-FREE measured driver (per RUNL_DESIGN_SPEC.md). Reads the bound fixture and
 * runs the measured cases; the read-only verifier asserts the oracles. No backend pre-gate.
 * Bound pipeline: fixture → verify --pre → THIS → verify --post.
 *
 *   LSR_AUDIT_PW=… [LSR_BUILD_ID=…] NODE_PATH=/app/node_modules node audit/playwright/lsr_runL.mjs <runId>
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import {
  AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard, switchClass,
  driveNewWordsToTest, driveTest, readTestRows, fillSubmitAndObserve, readVisibleProgress,
  readFocus, readFocusList, selectList, enterSessionOnly, leaveSessionViaQuit, shot,
} from './lsr_ui.mjs';
import { fixtureDigest } from './lsr_runL_digest.mjs';
const nm = (s) => (s || '').replace(/\s+/g, ' ').trim();
async function passedResults(page, mode) { // specific passed-results card + Continue (BOUNDED waits, not instant isVisible)
  const heading = mode === 'mcq' ? /New Words Test Passed/i : /Completed Day \d+ session/i;
  const h = await page.getByText(heading).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  const cont = await page.getByRole('button', { name: /continue|다음|next/i }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  return h && cont;
}
// Track screenshots this run actually captured successfully, so --post can require the exact
// set (and the driver deletes stale ones up front → no reuse of a prior run's PNGs).
const shots = [];
async function snap(page, name) { const ok = await shot(page, `runL_${runId}_${name}`); if (ok) shots.push(name); else F.add('flow-gap', `screenshot ${name} FAILED to capture`); return ok; }

const runId = process.argv[2];
if (!runId) { console.error('usage: lsr_runL.mjs <runId>'); process.exit(2); }
const BUILD_ID = process.env.LSR_BUILD_ID;
if (!BUILD_ID) { console.error('LSR_BUILD_ID is REQUIRED — export the owner-supplied deployed build id/commit'); process.exit(2); }
const FIX_PATH = `${AUD}/findings/runL_fixture_${runId}.json`;
if (!existsSync(FIX_PATH)) { console.error(`no fixture for ${runId} — run lsr_runL_fixture.mjs then verify --pre`); process.exit(2); }
const FIX = JSON.parse(readFileSync(FIX_PATH, 'utf8'));
const LIST_TITLE = FIX.list.title;
// PRE-FLIGHT GUARD: refuse to run (and consume the fresh personas) unless a VALID bound --pre
// exists for this runId/build with the exact required case set. Prevents an accidental run
// after a failed --pre from burning the fixtures.
const REQUIRED = ['L1-T', 'L1-M', 'L1-R', 'L2'];
const PRE_PATH = `${AUD}/findings/runL_pre_${runId}.json`;
if (!existsSync(PRE_PATH)) { console.error(`no --pre for ${runId} — run lsr_runL_verify.mjs --pre ${runId} first`); process.exit(2); }
const PRE = JSON.parse(readFileSync(PRE_PATH, 'utf8'));
const preCases = Object.keys(PRE.cases || {});
if (PRE.valid !== true) { console.error('--pre is not valid:true — fix fixtures and re-run --pre'); process.exit(2); }
if (PRE.runId !== runId || PRE.buildId !== BUILD_ID) { console.error(`--pre run/build mismatch (runId=${PRE.runId} build=${PRE.buildId})`); process.exit(2); }
if (!(preCases.length === REQUIRED.length && REQUIRED.every((x) => preCases.includes(x)))) { console.error(`--pre case set ${JSON.stringify(preCases)} != {${REQUIRED}}`); process.exit(2); }
// Identity binding: the fixture digest the DRIVER operates on must equal what --pre validated.
const DIGEST = fixtureDigest(FIX);
if (PRE.fixtureDigest !== DIGEST) { console.error(`fixture changed since --pre (digest ${DIGEST} != pre ${PRE.fixtureDigest}) — re-run --pre`); process.exit(2); }

const F = makeFindings(`RUNL_${runId}`);
const activity = { runId, buildId: BUILD_ID, fixtureDigest: DIGEST, startedAt: new Date().toISOString(), cases: {} };

// Delete this run's expected screenshots up front so a failed reused run can't reuse stale PNGs.
for (const cid of REQUIRED) for (const suf of ['before', 'after']) { try { rmSync(`${AUD}/findings/runL_${runId}_${cid}_${suf}.png`); } catch { /* */ } }
for (const extra of ['L1R_intermediate', 'L2_afterEnter', 'L2_inSession']) { try { rmSync(`${AUD}/findings/runL_${runId}_${extra}.png`); } catch { /* */ } }

async function beforeState(page) { const p = await readVisibleProgress(page).catch(() => ({})); return { visibleDayBefore: p.day ?? null, visibleWordsBefore: p.words ?? null }; }
async function afterState(page) { await goDashboard(page); const p = await readVisibleProgress(page).catch(() => ({})); return { visibleDayAfter: p.day ?? null, visibleWords: p.words ?? null }; }
async function day1Complete(page, cid, mode) { // L1-T / L1-M: reach test, pass with careful answers
  const before = await beforeState(page); // dashboard shows Day 1 / 0 words (fresh)
  const t = await driveNewWordsToTest(page, F, cid);
  if (!t.reached) return { ...before, ok: false, note: 'test not reached' };
  const { outcome } = await driveTest(page, F, cid); // mode-aware careful answers
  const passedHeadingSeen = await passedResults(page, mode); // specific card BEFORE leaving
  return { ...before, outcome, passedHeadingSeen, ...(await afterState(page)) };
}

console.log(`\n▶ Run L measured driver (${runId}) — Admin-free\n`);
const browser = await launch();
for (const [cid, c] of Object.entries(FIX.cases)) {
  const { page } = await newAuditPage(browser, F, cid);
  const rec = { email: c.email, role: c.role, mode: c.mode, joinTarget: c.joinTarget, class: c.class ?? null, classB: c.classB ?? null }; // per-case identity (bound in --post)
  try {
    const li = await login(page, c.email, F);
    rec.loggedIn = li;
    if (!li) { activity.cases[cid] = rec; await page.context().close(); continue; }
    await goDashboard(page);
    F.step(cid, `logged in as ${c.email}; dashboard`);
    await snap(page, `${cid}_before`);

    if (cid === 'L1-T' || cid === 'L1-M') {
      F.step(cid, `Day-1 ${c.mode} completion`);
      const r = await day1Complete(page, cid, c.mode);
      Object.assign(rec, r);
      F.step(cid, `day ${r.visibleDayBefore}→${r.visibleDayAfter} words ${r.visibleWordsBefore}→${r.visibleWords} passedHeading=${r.passedHeadingSeen}`);
    } else if (cid === 'L1-R') {
      // fail once → intermediate assertion (retake state, day still 1, 0 words, screenshot) → retry → pass
      const bst = await beforeState(page); rec.visibleDayBefore = bst.visibleDayBefore; rec.visibleWordsBefore = bst.visibleWordsBefore;
      const t = await driveNewWordsToTest(page, F, `${cid}-fail`);
      if (!t.reached) { rec.note = 'fail-test not reached'; }
      else {
        const rows = await readTestRows(page);
        const fail = await fillSubmitAndObserve(page, rows.map(() => 'zzzzzz'), F, `${cid}-fail`);
        rec.failOutcome = fail.outcome;
        // A FAILED new-word test shows a scored results screen with a "Try Again" retake button
        // (TypedTest.jsx:1358, gated by canRetake = score<threshold). That button — NOT an
        // outcome string — is the canonical retake signal (a fail still renders a "%" score, so
        // fillSubmitAndObserve returns 'results', not 'retake-gate').
        const tryAgain = page.getByRole('button', { name: /try again/i }).first();
        rec.retakeSeen = await tryAgain.isVisible().catch(() => false);
        const successVisible = await page.getByText(/completed|축하|great job|day complete|new words test passed/i).first().isVisible().catch(() => false);
        rec.successAbsent = !successVisible;
        await goDashboard(page);
        const mid = await readVisibleProgress(page).catch(() => ({}));
        rec.midDay = mid.day ?? null; rec.midWords = mid.words ?? null;
        await snap(page, 'L1R_intermediate');
        F.step(cid, `failed once (outcome=${rec.failOutcome}); mid-state day=${rec.midDay} words=${rec.midWords}`);
        // retry → pass
        const t2 = await driveNewWordsToTest(page, F, `${cid}-pass`);
        if (t2.reached) { const { outcome } = await driveTest(page, F, `${cid}-pass`); rec.passOutcome = outcome; rec.passedHeadingSeen = await passedResults(page, c.mode); }
        await goDashboard(page);
        const after = await readVisibleProgress(page).catch(() => ({}));
        rec.visibleDayAfter = after.day ?? null; rec.visibleWords = after.words ?? null;
        F.step(cid, `retook → pass (outcome=${rec.passOutcome}); day=${rec.visibleDayAfter} words=${rec.visibleWords}`);
      }
    } else if (cid === 'L2') {
      // select B AND EXPLICITLY select its list L (persists saved focus) → ENTER-ONLY (fires
      // getOrCreateClassProgress, no study/test) → leave → reload → assert focus still Class:B AND
      // List:L (EXACT normalized equality) + B-local values.
      await switchClass(page, c.classB, F);
      const selL = await selectList(page, LIST_TITLE, F, `${cid}-selL`); // explicit visible list selection
      const fc0 = nm(await readFocus(page, 'Class').catch(() => null));
      const fl0 = nm(await readFocusList(page).catch(() => null));
      rec.selectedB = fc0 === nm(c.classB); // EXACT
      rec.selectedListL = selL && fl0 === nm(LIST_TITLE); // EXACT
      F.step(cid, `selected Class:${fc0} List:${fl0} (B=${rec.selectedB} L=${rec.selectedListL})`);
      const t = await enterSessionOnly(page, F, `${cid}-enter`);
      rec.entered = t.entered; // non-null boolean
      await snap(page, 'L2_inSession'); // REQUIRED session-entry evidence (immediately after entering, before leaving)
      // Leave like a USER via the visible Quit → "Leave Study Session?" → Leave flow (Codex): this
      // sets the intentional-leave flag so no beforeunload dialog fires + no reload timeout.
      rec.leftViaQuit = await leaveSessionViaQuit(page, F, cid);
      await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
      const focusClass = nm(await readFocus(page, 'Class').catch(() => null));
      const focusList = nm(await readFocusList(page).catch(() => null));
      rec.focusStillB = focusClass === nm(c.classB); // EXACT
      rec.focusListStillL = focusList === nm(LIST_TITLE); // EXACT
      const prog = await readVisibleProgress(page).catch(() => ({}));
      rec.bVisibleDay = prog.day ?? null; rec.bVisibleWords = prog.words ?? null;
      F.step(cid, `after enter+reload: Class:${focusClass} List:${focusList} day=${rec.bVisibleDay} words=${rec.bVisibleWords}`);
      await snap(page, 'L2_afterEnter');
    }
    await snap(page, `${cid}_after`);
  } catch (e) { F.add('scenario-error', `[${cid}] ${String(e).slice(0, 160)}`); }
  activity.cases[cid] = rec;
  console.log(`  ${cid}: ${JSON.stringify(rec).slice(0, 150)}`);
  await page.context().close().catch(() => {});
}
await browser.close();
activity.endedAt = new Date().toISOString();
activity.shots = shots; // successfully-captured screenshots (this run)
writeFileSync(`${AUD}/findings/runL_activity_${runId}.json`, JSON.stringify(activity, null, 2));

// Bound anomaly artifact — FAIL-CLOSED: EVERY finding is fatal EXCEPT an explicit benign allowlist
// (steps/notes/recovery) and the known-benign Firestore channel-abort noise. So unlisted kinds like
// modal-dead/prep-issue are fatal by default (design: every non-allowlisted anomaly fails).
const BENIGN_KINDS = new Set(['recovery', 'note', 'observation', 'native-dialog']);
const isFsChannelAbort = (d) => /firestore\.googleapis\.com/i.test(d) && /(Listen|Write)\/channel/i.test(d) && /ERR_ABORTED/i.test(d);
const CONSOLE_ALLOW = [/ResizeObserver/i, /favicon/i, /analytics|gtag|gtm/i, /web-vitals/i];
const fatal = F.raw.filter((r) => {
  if (BENIGN_KINDS.has(r.kind)) return false;
  if ((r.kind === 'console-error' || r.kind === 'request-failed') && (isFsChannelAbort(r.detail) || (r.kind === 'console-error' && CONSOLE_ALLOW.some((re) => re.test(r.detail))))) return false;
  return true; // everything else is fatal
}).map((r) => `${r.kind}: ${r.detail.slice(0, 160)}`);
writeFileSync(`${AUD}/findings/runL_anomalies_${runId}.json`, JSON.stringify({ runId, buildId: BUILD_ID, fixtureDigest: DIGEST, cases: Object.keys(activity.cases), startedAt: activity.startedAt, endedAt: activity.endedAt, fatal }, null, 2));
writeFileSync(`${AUD}/findings/runL_activity_${runId}.json`, JSON.stringify(activity, null, 2));
console.log(`\nactivity → findings/runL_activity_${runId}.json  |  anomalies: ${fatal.length}`);
console.log(`NEXT: lsr_runL_verify.mjs --post ${runId}`);
process.exit(0);

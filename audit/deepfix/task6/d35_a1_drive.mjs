/**
 * R50 D3.5 tier-3 A1 recovery drive (CORRECTED seed) — live prod, sandbox student only.
 * Drives TWO good Day-6 reviews (MCQ, correct-answer via token-overlap vs the list's own word defs),
 * capturing Admin read-back after each. Expected A1 recovery:
 *   review #1 -> HELD (csd flat @5, review_recorded, reviewMode stays throttle via M1 hysteresis)
 *   review #2 -> ESCAPE (reviewMode->false -> day re-allocates new words)
 * NEVER a 26SM write. Seed uid irZu1zzY3uOdxmcouI6TzWy5YJ83 (25WTa2r11 / dVliNv0p9jqZYp9rfLpN).
 */
import { writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, enterReviewSession, norm } = UI;
const { chromium } = await import('playwright');

const EMAIL = 'lsr_a2_jisua1@vocaboost.test';
const UID = 'irZu1zzY3uOdxmcouI6TzWy5YJ83';
const CLASS = '25WTa2r11';
const LIST = 'dVliNv0p9jqZYp9rfLpN';
const CPID = `${CLASS}_${LIST}`;
const F = makeFindings ? makeFindings('A1DRV') : { add: (...a) => console.log('F', ...a) };

// ── 1) build word->def map from the LIST's own words subcollection (guaranteed coverage) ──
const wsnap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
for (const d of wsnap.docs) {
  const w = d.data();
  const defs = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String);
  MAP[keyOf(w.word)] = defs;
}
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function bestOption(word, optTexts) {
  const k = keyOf(word);
  const defs = MAP[k] || [];
  const dt = new Set(defs.flatMap(toks));
  let best = 0, bestScore = -1;
  optTexts.forEach((o, i) => { const sc = toks(o).filter((t) => dt.has(t)).length; if (sc > bestScore) { bestScore = sc; best = i; } });
  return { best, bestScore, hasDef: defs.length > 0 };
}

// ── Admin read-back of the sandbox student (class_progress + latest session + review-type logs) ──
async function readback(tag) {
  const cp = (await db.collection('users').doc(UID).collection('class_progress').doc(CPID).get()).data() || {};
  const canon = (await db.collection('users').doc(UID).collection('list_progress').get()).size;
  // latest session_state status
  let latestSession = null;
  try {
    const ss = await db.collection('users').doc(UID).collection('session_states').get();
    const arr = ss.docs.map((d) => ({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (b.updatedAt?._seconds || 0) - (a.updatedAt?._seconds || 0));
    if (arr[0]) latestSession = { id: arr[0].id, status: arr[0].status, reviewMode: arr[0].reviewMode, dayNumber: arr[0].dayNumber };
  } catch {}
  // server-written review logs (M7: type present + server-only)
  let logTypes = {};
  try {
    const sl = await db.collection('system_logs').where('userId', '==', UID).limit(50).get();
    for (const d of sl.docs) { const t = d.data().type || d.data().event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; }
  } catch {}
  return {
    tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel,
    reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore),
    canonical_list_progress: canon, latestSession, logTypes,
  };
}

// ── drive one GOOD review MCQ; returns {entered, answered, total, matched, outcome, scorePct} ──
async function driveGoodReview(page, tag) {
  const rv = await enterReviewSession(page, F, tag);
  if (!rv.reached) return { entered: false, why: 'review-test-not-reached' };
  let total = 30;
  const lbl = await page.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
  if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
  let answered = 0, guard = 0, matched = 0, nodef = 0;
  while (answered < total && guard < total + 8) {
    guard++;
    const word = await page.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
    const opts = page.locator('button[class*="min-h-"]');
    const n = await opts.count();
    if (!word || n === 0) { await sleep(700); continue; }
    const texts = [];
    for (let i = 0; i < n; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '));
    const { best, bestScore, hasDef } = bestOption(word, texts);
    if (!hasDef) nodef++;
    if (bestScore > 0) matched++;
    await opts.nth(best).click({ timeout: 3000 }).catch(() => {});
    await sleep(450);
    const nl = await page.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null);
    const nm = nl && nl.match(/(\d+) of/);
    answered = nm ? +nm[1] : answered + 1;
  }
  // submit + M5 dialog + observe outcome
  const submit = page.getByRole('button', { name: /submit test/i }).first();
  await submit.click({ timeout: 5000 }).catch(() => {});
  await sleep(900);
  const modal = page.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([
    page.getByText(/세션 정보가 갱신|session was refreshed/i).first().waitFor({ timeout: 120000 }).then(() => 'rebuild'),
    page.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2500);
  const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const pct = (body.match(/(\d{1,3})\s*%/) || [])[1];
  return { entered: true, answered, total, matched, nodef, outcome, scorePct: pct ? +pct : null };
}

// ── run ──
const out = { round: 50, seedUid: UID, class: CLASS, list: LIST, mapWords: Object.keys(MAP).length };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then((c) => c.newPage());
  out.loggedIn = await login(p, EMAIL, F); await sleep(1500);
  await goDashboard(p); await sleep(3000);
  const dash = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  out.renderExcerpt = dash.slice(0, 260);
  out.rendersDay6 = /day\s*6\b/i.test(dash) && !/day\s*11\b/i.test(dash);
  out.rendersDay11 = /day\s*11\b/i.test(dash);
  out.seedPre = await readback('pre-drive');

  out.review1 = await driveGoodReview(p, 'A1-rev1');
  out.readback1 = await readback('after-review-1');

  await goDashboard(p); await sleep(2500);
  out.review2 = await driveGoodReview(p, 'A1-rev2');
  out.readback2 = await readback('after-review-2');

  await b.close();
} catch (e) { out.error = String(e).slice(0, 300); await b.close().catch(() => {}); }

// verdict hints (WSL's assert-recovery.mjs is authoritative)
out.HELD_after_1 = out.readback1 && out.readback1.csd === 5;
out.ESCAPE_after_2 = out.readback2 && (out.readback2.reviewMode === false || out.readback2.csd > 5 || out.readback2.twi > 400);
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_a1_drive_r50.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

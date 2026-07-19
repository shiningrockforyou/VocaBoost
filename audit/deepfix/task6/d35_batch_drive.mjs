/**
 * R51 D3.5 tier-3 BATCH drive — 5-student recovery wave (scale-up), live prod, SANDBOX only (never 26SM).
 * THROTTLE (3): login -> renderCheck Day-(csd+1) review-only -> drive good MCQ review -> read-back -> escape check.
 * OFF-BY-ONE (2): login -> renderCheck; csd should reconcile csd->csd+1 ON LOAD (resolveListProgress safeCSD=max(stored,anchor));
 *                 no drive. Pre (Admin, pre-login) vs Post (Admin, post-login) csd delta is the finding.
 * One evidence JSON keyed by tag. WSL runs assert-recovery.mjs for authoritative verdicts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, enterReviewSession, norm } = UI;
const { chromium } = await import('playwright');

const ROSTER = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster;
const LIST = ROSTER[0].listId; // RmNNkuLPectBlBPiLbAJ (shared by all 5)
const F = makeFindings ? makeFindings('BATCH') : { add: (...a) => console.log('F', ...a) };

// ── word->def map from the shared list's words subcollection ──
const wsnap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
for (const d of wsnap.docs) { const w = d.data(); MAP[keyOf(w.word)] = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String); }
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function bestOption(word, optTexts) {
  const dt = new Set((MAP[keyOf(word)] || []).flatMap(toks));
  let best = 0, bestScore = -1;
  optTexts.forEach((o, i) => { const sc = toks(o).filter((t) => dt.has(t)).length; if (sc > bestScore) { bestScore = sc; best = i; } });
  return { best, bestScore, hasDef: (MAP[keyOf(word)] || []).length > 0 };
}

async function readback(uid, classId, tag) {
  const cpid = `${classId}_${LIST}`;
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(cpid).get()).data() || {};
  const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
  let logTypes = {};
  try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(50).get(); for (const d of sl.docs) { const t = d.data().type || d.data().event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore), canonical_list_progress: canon, logTypes };
}

async function driveGoodReview(page, tag) {
  const rv = await enterReviewSession(page, F, tag);
  if (!rv.reached) return { entered: false, why: 'review-test-not-reached' };
  let total = 30; const lbl = await page.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
  if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
  let answered = 0, guard = 0, matched = 0;
  while (answered < total && guard < total + 8) {
    guard++;
    const word = await page.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
    const opts = page.locator('button[class*="min-h-"]'); const n = await opts.count();
    if (!word || n === 0) { await sleep(700); continue; }
    const texts = []; for (let i = 0; i < n; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '));
    const { best, bestScore } = bestOption(word, texts); if (bestScore > 0) matched++;
    await opts.nth(best).click({ timeout: 3000 }).catch(() => {}); await sleep(430);
    const nl = await page.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/);
    answered = nm ? +nm[1] : answered + 1;
  }
  await page.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
  const modal = page.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([
    page.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2500);
  const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const pct = (body.match(/(\d{1,3})\s*%/) || [])[1];
  return { entered: true, answered, total, matched, outcome, scorePct: pct ? +pct : null };
}

const dayOf = (body) => { const m = body.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const results = {};
const b = await chromium.launch({ headless: true });
for (const s of ROSTER) {
  const r = { tag: s.tag, family: s.family, uid: s.uid, classId: s.sandboxClassId, seededCsd: s.seededCsd };
  try {
    r.pre = await readback(s.uid, s.sandboxClassId, 'pre-login'); // Admin, pre-login (no reconcile yet)
    const ctx = await b.newContext(); const p = await ctx.newPage();
    r.loggedIn = await login(p, s.email, F); await sleep(1500);
    await goDashboard(p); await sleep(3500);
    const dash = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    r.renderDay = dayOf(dash); r.renderExcerpt = dash.slice(0, 200);
    r.offersNewWords = /start new words/i.test(dash); r.offersReviewOnly = /start review|retry review/i.test(dash) && !/start new words/i.test(dash);
    r.postLoad = await readback(s.uid, s.sandboxClassId, 'post-login'); // reconcile-on-load captured here
    if (s.family === 'throttle-deadlock') {
      // expect Day-(csd+1) review-only; drive a good review -> escape
      r.expectDay = (r.postLoad.csd ?? s.seededCsd) + 1;
      r.renderOk = r.renderDay === r.expectDay; // else INVALID_PRECONDITION signal
      r.review = await driveGoodReview(p, s.tag);
      r.afterReview = await readback(s.uid, s.sandboxClassId, 'after-review');
      await goDashboard(p); await sleep(3000);
      const dash2 = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      r.postEscape = { offersNewWords: /start new words/i.test(dash2), day: dayOf(dash2), excerpt: dash2.slice(0, 160) };
      r.escape_confirmed = r.postEscape.offersNewWords === true || r.afterReview.reviewMode === false;
    } else {
      // off-by-one: csd should have reconciled csd->csd+1 ON LOAD (no drive)
      r.reconciled = (r.postLoad.csd ?? null) === s.seededCsd + 1;
      r.reconcileDelta = { pre: r.pre.csd, post: r.postLoad.csd, expected: s.seededCsd + 1 };
    }
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 250); }
  results[s.tag] = r;
  console.log(`[${s.tag}] ${s.family} renderDay=${r.renderDay} ` + (s.family === 'throttle-deadlock'
    ? `review=${r.review?.scorePct}% reviewMode->${r.afterReview?.reviewMode} escape=${r.escape_confirmed}`
    : `reconcile pre=${r.pre?.csd}->post=${r.postLoad?.csd} (want ${s.seededCsd + 1}) ok=${r.reconciled}`));
}
await b.close().catch(() => {});
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_batch_r51.json', JSON.stringify({ round: 51, list: LIST, mapWords: Object.keys(MAP).length, results }, null, 2));
console.log('\nwrote deepfix_d35_tier3_batch_r51.json');

/**
 * R58 — David-directed FIDELITY re-tests, live prod, SANDBOX only (never 26SM). Direct-nav mandatory.
 * TEST A: faithful throttle hysteresis (4 students, now reviewMode=true+interv=1.0, UNIQUE classes) — prove TWO good
 *   reviews needed: renderCheck HELD -> review#1(>=0.90) -> READBACK (expect STILL HELD reviewMode=true csd flat) ->
 *   review#2(>=0.90) -> READBACK (expect ESCAPED reviewMode=false). Read-back after EACH review as its own step.
 * TEST B: mid-list lost-save lostsave_bc_d6 (csd5, twi400, day-6 anchor MISSING, day-6 words 400-479 EXIST) — direct-nav,
 *   degradeProbe (offers Day-6 NEW test?), COMPLETE it (typed >=92%) -> expect csd 5->6, twi 400->480, ONE day-6 anchor.
 */
import { writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings, sleep, norm, BASE } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');
const F = makeFindings ? makeFindings('R58') : { add: () => {} };
const RUN_START = new Date().toISOString();

const THROTTLE = [
  { tag: 'thr_0DnzKs', email: 'lsr_a2_thr0DnzKs@vocaboost.test', uid: 'fAgr0aQxMZcJj4o3Q58uYCg9ccy1', cls: '25WTa2r1thr0DnzKs', list: 'RmNNkuLPectBlBPiLbAJ' },
  { tag: 'thr_bFV18s', email: 'lsr_a2_thrbFV18s@vocaboost.test', uid: 'ITS6kfkXvlhJA3i8BlwEnFhNnuU2', cls: '25WTa2r1thrbFV18s', list: 'RmNNkuLPectBlBPiLbAJ' },
  { tag: 'thr_yiVt86', email: 'lsr_a2_thryiVt86@vocaboost.test', uid: 'CdVCpFcFO6V1oYIM9gcjOjRt3n53', cls: '25WTa2r1thryiVt86', list: 'RmNNkuLPectBlBPiLbAJ' },
  { tag: 'jisu_a1', email: 'lsr_a2_jisua1@vocaboost.test', uid: 'irZu1zzY3uOdxmcouI6TzWy5YJ83', cls: '25WTa2r1jisua1', list: 'dVliNv0p9jqZYp9rfLpN' },
];
const LOSTSAVE = { tag: 'lostsave_bc_d6', email: 'lsr_a2_lostsavebcd6@vocaboost.test', uid: 'pzKKLxSYcchTKPJsLi9FxIlP9Xk1', cls: '25WTa2r1lostsavebcd6', list: 'RmNNkuLPectBlBPiLbAJ' };

const MAPS = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
async function mapFor(listId) { if (MAPS[listId]) return MAPS[listId]; const snap = await db.collection('lists').doc(listId).collection('words').get(); const m = {}; for (const d of snap.docs) { const w = d.data(); const dd = w.definitions || {}; m[keyOf(w.word)] = { defs: [w.definition, dd.en].filter(Boolean).map(String), ko: dd.ko || '' }; } MAPS[listId] = m; return m; }
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function pick(prompt, optTexts, MAP) { const pe = MAP[keyOf(prompt)]; if (pe && pe.defs.length) { const dt = new Set(pe.defs.flatMap(toks)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const s = toks(o).filter((t) => dt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs }; } const pt = new Set(toks(prompt)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const defs = (MAP[keyOf(o)] || {}).defs || []; const s = defs.flatMap(toks).filter((t) => pt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs }; }
async function readback(uid, cls, list, tag) { const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${cls}_${list}`).get()).data() || {}; const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size; let logTypes = {}, fresh = 0; try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(80).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) fresh++; } } catch {} return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore), canonical_list_progress: canon, logTypes, fresh }; }
async function dayAnchors(uid, list, day) { try { const at = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', list).get(); return at.docs.map((d) => d.data()).filter((a) => a.studyDay === day && /new/i.test(a.attemptType || a.type || '') && (a.passed === true || a.isPassed === true)).length; } catch { return null; } }
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

async function reachDirect(p, slog, cls, list) {
  const target = `${BASE}/session/${cls}/${list}`;
  await p.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(4500);
  const routedUrl = p.url(); const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const probe = { target, routedUrl, containsListId: routedUrl.includes(list), renderDay: dayOf(body), offersNewWords: /start new words/i.test(body), offersReviewOnly: /start review|retry review/i.test(body) && !/start new words/i.test(body), coherent: !/something went wrong|error boundary|unexpected error|failed to load/i.test(body), excerpt: body.slice(0, 160) };
  if (!probe.containsListId && !/\/(mcqtest|typedtest)\//.test(routedUrl)) { slog.step('wrongListLoaded', { routedUrl, wanted: list }); return { reached: false, probe, wrongList: true }; }
  let ss = null; for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
  if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
  let via = null; const menu = p.getByRole('button', { name: 'Session menu' }).first();
  if (await menu.isVisible().catch(() => false)) { await menu.click().catch(() => {}); await sleep(700); const skip = p.getByText(/^\s*skip to test\s*$/i).first(); if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await sleep(900); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) await st.click().catch(() => {}); await p.waitForURL(/\/(mcqtest|typedtest)\//, { timeout: 15000 }).catch(() => {}); if (await inTest(p)) via = 'A'; } else await p.keyboard.press('Escape').catch(() => {}); }
  if (!(await inTest(p))) { slog.step('reachPathB', {}); for (let k = 0; k < 90 && !(await inTest(p)); k++) { slog.progress('dismissCards', k + 1, 90); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) { await st.click().catch(() => {}); await sleep(1500); continue; } const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first(); if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; } const know = p.getByRole('button', { name: /i know this word/i }).first(); if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(140); continue; } await p.keyboard.press('c').catch(() => {}); await sleep(140); } if (await inTest(p)) via = 'B'; }
  probe.via = via; probe.routedUrl = p.url(); slog.step('reachProbe', probe);
  return { reached: await inTest(p), probe };
}
async function driveGood(p, slog, MAP) {
  const typed = /\/typedtest\//.test(p.url()) || (await p.locator('input[placeholder*="definition" i]').count()) > 0;
  let answered = 0, matched = 0, total = 30;
  if (typed) { const inp = p.locator('input[placeholder*="definition" i]'); for (let a = 0; a < 6; a++) { total = await inp.count(); if (total) break; await sleep(800); } for (let i = 0; i < total; i++) { const word = await inp.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => ''); const e = MAP[keyOf(word)]; const ans = e ? (e.ko || e.defs[0] || '') : ''; if (ans) matched++; await inp.nth(i).fill(ans).catch(() => {}); answered = i + 1; slog.progress('answering', answered, total, { matched, kind: 'typed' }); } }
  else { const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => ''); const m = lbl.match(/(\d+) of (\d+)/); total = m ? +m[2] : 30; let g = 0; while (answered < total && g < total + 10) { g++; const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => ''); const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count(); if (!word || nn === 0) { await sleep(700); continue; } const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ')); const r = pick(word, texts, MAP); if (r.bs > 0) matched++; await opts.nth(r.best).click({ timeout: 3000 }).catch(() => {}); await sleep(420); const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/); answered = nm ? +nm[1] : answered + 1; slog.progress('answering', answered, total, { matched, kind: 'mcq' }); } }
  slog.step('answered', { answered, total, matched, typed });
  await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
  const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first(); if (await modal.isVisible().catch(() => false)) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'), p.getByText(/retake required|불합격|not complete|이 날을 완료/i).first().waitFor({ timeout: 25000 }).then(() => 'retake-gate'), p.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 25000 }).then(() => 'results')]).catch(() => 'timeout');
  await sleep(2500); const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); const scorePct = (body.match(/(\d{1,3})\s*%/) || [])[1] ? +(body.match(/(\d{1,3})\s*%/) || [])[1] : null;
  slog.step('outcome', { outcome, scorePct }); return { outcome, scorePct, matched, total, typed };
}

const results = {};
const b = await chromium.launch({ headless: true });
// ---- TEST A ----
for (const S of THROTTLE) {
  const slog = makeStepLogger(`r58-${S.tag}`); slog.heartbeat(15000); const MAP = await mapFor(S.list);
  const r = { tag: S.tag, test: 'A', uid: S.uid, cls: S.cls, list: S.list, steps: slog.file, reviews: [] };
  try {
    r.pre = await readback(S.uid, S.cls, S.list, 'pre'); slog.step('login', { email: S.email, preCsd: r.pre.csd, reviewMode: r.pre.reviewMode });
    const ctx = await b.newContext(); const p = await ctx.newPage(); r.loggedIn = await login(p, S.email, F); await sleep(1500);
    for (let i = 1; i <= 2; i++) {
      const rr = await reachDirect(p, slog, S.cls, S.list); if (rr.wrongList) { r.wrongList = true; break; }
      if (i === 1) { r.renderDay = rr.probe.renderDay; r.heldAtRender = rr.probe.offersReviewOnly || !rr.probe.offersNewWords; }
      if (!rr.reached) { r.reviews.push({ i, reached: false }); break; }
      const d = await driveGood(p, slog, MAP);
      const rb = await readback(S.uid, S.cls, S.list, `after-review-${i}`);
      slog.step(`readback_after_review_${i}`, { reviewMode: rb.reviewMode, csd: rb.csd, interv: rb.interv, recent: rb.recentLast3, review_recorded: rb.logTypes.review_recorded || 0 });
      r.reviews.push({ i, via: rr.probe.via, mode: d.typed ? 'typed' : 'mcq', score: d.scorePct, matched: d.matched, outcome: d.outcome, reviewMode: rb.reviewMode, csd: rb.csd, interv: rb.interv });
      await sleep(1500);
    }
    r.post = await readback(S.uid, S.cls, S.list, 'post');
    r.heldAfter1 = r.reviews[0] && r.reviews[0].reviewMode === true && r.reviews[0].csd === r.pre.csd;
    r.escapedAfter2 = r.reviews[1] && r.reviews[1].reviewMode === false;
    r.escapedAfter1 = r.reviews[0] && r.reviews[0].reviewMode === false; // the OLD artifact — should be false now
    r.faithful2step = r.heldAfter1 && r.escapedAfter2;
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 300); slog.error('drive', e); }
  slog.done({ tag: S.tag, heldAfter1: r.heldAfter1, escapedAfter2: r.escapedAfter2, faithful2step: r.faithful2step });
  results[S.tag] = r;
  console.log(`[${S.tag}/A] pre reviewMode=${r.pre?.reviewMode} csd=${r.pre?.csd} | after#1 reviewMode=${r.reviews[0]?.reviewMode} | after#2 reviewMode=${r.reviews[1]?.reviewMode} | faithful2step=${r.faithful2step} escapedAfter1=${r.escapedAfter1}`);
}
// ---- TEST B ----
{
  const S = LOSTSAVE; const slog = makeStepLogger(`r58-${S.tag}`); slog.heartbeat(15000); const MAP = await mapFor(S.list);
  const r = { tag: S.tag, test: 'B', uid: S.uid, cls: S.cls, list: S.list, steps: slog.file }; const consoleErrors = [];
  try {
    r.pre = await readback(S.uid, S.cls, S.list, 'pre'); r.anchorsBefore = await dayAnchors(S.uid, S.list, 6); slog.step('login', { email: S.email, preCsd: r.pre.csd, preTwi: r.pre.twi });
    const ctx = await b.newContext(); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); }); p.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e.message || e).slice(0, 140)));
    r.loggedIn = await login(p, S.email, F); await sleep(1500);
    const rr = await reachDirect(p, slog, S.cls, S.list); r.degradeProbe = rr.probe; r.wrongList = !!rr.wrongList;
    slog.step('degradeProbe', { renderDay: rr.probe.renderDay, offersNewWords: rr.probe.offersNewWords, coherent: rr.probe.coherent, containsListId: rr.probe.containsListId, routedUrl: rr.probe.routedUrl });
    if (!rr.wrongList && rr.reached) { const d = await driveGood(p, slog, MAP); r.drive = d; await sleep(1500); }
    else r.drive = { reached: false };
    r.consoleErrors = consoleErrors.slice(0, 6); r.crashed = consoleErrors.some((e) => /PAGEERROR|Minified React error|cannot read|undefined is not/i.test(e));
    r.post = await readback(S.uid, S.cls, S.list, 'post'); r.anchorsAfter = await dayAnchors(S.uid, S.list, 6);
    r.csd5to6 = r.post.csd === 6 && r.pre.csd === 5; r.twi400to480 = r.post.twi === 480 && r.pre.twi === 400; r.exactlyOneAnchor = r.anchorsAfter === 1;
    r.autoRecovered = r.csd5to6 && r.exactlyOneAnchor;
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 300); slog.error('drive', e); }
  slog.done({ tag: S.tag, csd5to6: r.csd5to6, twi400to480: r.twi400to480, anchors: r.anchorsAfter });
  results[S.tag] = r;
  console.log(`[${S.tag}/B] pre csd=${r.pre?.csd} twi=${r.pre?.twi} -> post csd=${r.post?.csd} twi=${r.post?.twi} | anchors ${r.anchorsBefore}->${r.anchorsAfter} | offersNew=${r.degradeProbe?.offersNewWords} drive=${JSON.stringify(r.drive).slice(0,80)} autoRecovered=${r.autoRecovered} crashed=${r.crashed}`);
}
await b.close().catch(() => {});
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r58_refidelity.json', JSON.stringify({ round: 58, runStart: RUN_START, results }, null, 2));
console.log('\nRUN_START=' + RUN_START + '  wrote deepfix_d35_tier3_r58_refidelity.json');

/**
 * R60 — FINISH DAY-6 for lostsave_bc_d6 (close the lost-save recovery), live prod, SANDBOX only (never 26SM).
 * WSL clarified r59: csd=5/twi=480 is COHERENT MID-DAY-6 (day-6 NEW done + valid anchor; day-6 REVIEW pending; a day
 * advances only when new+review BOTH complete). So complete the day-6 REVIEW -> expect csd 5->6.
 * Direct-nav /session/25WTa2r1lostsavebcd6/RmNNkuLPectBlBPiLbAJ (assert routedUrl contains RmNNkuLP). Reach+COMPLETE
 * the review (MCQ/typed per class), then a bare reload to confirm it sticks.
 * EXPECTED (FULLY auto-recovered): csd 5->6, twi stays 480, day-6 review+passed attempt, fresh review_recorded/
 * csd_twi_reconciled, canonical=0. If csd stays 5 after the review too -> genuine gap.
 */
import { writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings, sleep, norm, BASE } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');

const UID = 'pzKKLxSYcchTKPJsLi9FxIlP9Xk1', CLASS = '25WTa2r1lostsavebcd6', LIST = 'RmNNkuLPectBlBPiLbAJ';
const EMAIL = 'lsr_a2_lostsavebcd6@vocaboost.test', CPID = `${CLASS}_${LIST}`;
const F = makeFindings ? makeFindings('R60') : { add: () => {} };
const slog = makeStepLogger('r60-lostsave_bc_d6'); slog.heartbeat(15000);
const RUN_START = new Date().toISOString();

const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
const snap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {}; for (const d of snap.docs) { const w = d.data(); const dd = w.definitions || {}; MAP[keyOf(w.word)] = { defs: [w.definition, dd.en].filter(Boolean).map(String), ko: dd.ko || '' }; }
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function pick(prompt, optTexts) { const pe = MAP[keyOf(prompt)]; if (pe && pe.defs.length) { const dt = new Set(pe.defs.flatMap(toks)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const s = toks(o).filter((t) => dt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs }; } const pt = new Set(toks(prompt)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const defs = (MAP[keyOf(o)] || {}).defs || []; const s = defs.flatMap(toks).filter((t) => pt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs }; }
async function readback(tag) { const cp = (await db.collection('users').doc(UID).collection('class_progress').doc(CPID).get()).data() || {}; const canon = (await db.collection('users').doc(UID).collection('list_progress').get()).size; let logTypes = {}, fresh = 0; try { const sl = await db.collection('system_logs').where('userId', '==', UID).limit(80).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) fresh++; } } catch {} return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, canonical_list_progress: canon, logTypes, fresh }; }
async function day6ReviewAttempts() { try { const at = await db.collection('attempts').where('studentId', '==', UID).where('listId', '==', LIST).get(); return at.docs.map((d) => d.data()).filter((a) => a.studyDay === 6 && /review/i.test(a.attemptType || a.type || '') && (a.passed === true || a.isPassed === true)).length; } catch { return null; } }
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

async function directNavAndReach(p, settleWaits = 8) {
  const target = `${BASE}/session/${CLASS}/${LIST}`;
  await p.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});
  let settled = false; for (let w = 0; w < settleWaits; w++) { await sleep(1000); const bd = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); if (!/preparing your session/i.test(bd)) { settled = true; break; } }
  await sleep(1500);
  const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const probe = { routedUrl: p.url(), containsListId: p.url().includes(LIST), renderDay: dayOf(body), offersReview: /start review|retry review|review study|^review$/i.test(body), offersNewWords: /start new words/i.test(body), settled, excerpt: body.slice(0, 180) };
  if (!probe.containsListId && !/\/(mcqtest|typedtest)\//.test(p.url())) { slog.step('wrongListLoaded', { routedUrl: p.url() }); return { reached: false, probe, wrongList: true }; }
  let ss = null; for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
  if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
  let via = null; const menu = p.getByRole('button', { name: 'Session menu' }).first();
  if (await menu.isVisible().catch(() => false)) { await menu.click().catch(() => {}); await sleep(700); const skip = p.getByText(/^\s*skip to test\s*$/i).first(); if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await sleep(900); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) await st.click().catch(() => {}); await p.waitForURL(/\/(mcqtest|typedtest)\//, { timeout: 15000 }).catch(() => {}); if (await inTest(p)) via = 'A'; } else await p.keyboard.press('Escape').catch(() => {}); }
  if (!(await inTest(p))) { slog.step('reachPathB', {}); for (let k = 0; k < 90 && !(await inTest(p)); k++) { slog.progress('dismissCards', k + 1, 90); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) { await st.click().catch(() => {}); await sleep(1500); continue; } const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first(); if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; } const know = p.getByRole('button', { name: /i know this word/i }).first(); if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(140); continue; } await p.keyboard.press('c').catch(() => {}); await sleep(140); } if (await inTest(p)) via = 'B'; }
  probe.via = via; probe.testUrl = p.url(); slog.step('degradeProbe', probe);
  return { reached: await inTest(p), probe };
}
async function driveGood(p) {
  const typed = /\/typedtest\//.test(p.url()) || (await p.locator('input[placeholder*="definition" i]').count()) > 0;
  let answered = 0, matched = 0, total = 30;
  if (typed) { const inp = p.locator('input[placeholder*="definition" i]'); for (let a = 0; a < 6; a++) { total = await inp.count(); if (total) break; await sleep(800); } for (let i = 0; i < total; i++) { const word = await inp.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => ''); const e = MAP[keyOf(word)]; const ans = e ? (e.ko || e.defs[0] || '') : ''; if (ans) matched++; await inp.nth(i).fill(ans).catch(() => {}); answered = i + 1; slog.progress('answering', answered, total, { matched, kind: 'typed' }); } }
  else { const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => ''); const m = lbl.match(/(\d+) of (\d+)/); total = m ? +m[2] : 30; let g = 0; while (answered < total && g < total + 10) { g++; const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => ''); const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count(); if (!word || nn === 0) { await sleep(700); continue; } const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ')); const r = pick(word, texts); if (r.bs > 0) matched++; await opts.nth(r.best).click({ timeout: 3000 }).catch(() => {}); await sleep(420); const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/); answered = nm ? +nm[1] : answered + 1; slog.progress('answering', answered, total, { matched, kind: 'mcq' }); } }
  slog.step('answered', { answered, total, matched, typed });
  await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
  const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first(); if (await modal.isVisible().catch(() => false)) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'), p.getByText(/%|score|correct|점|합격|retake|불합격|not complete/i).first().waitFor({ timeout: 25000 }).then(() => 'results')]).catch(() => 'timeout');
  await sleep(2500); const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); const scorePct = (body.match(/(\d{1,3})\s*%/) || [])[1] ? +(body.match(/(\d{1,3})\s*%/) || [])[1] : null;
  slog.step('outcome', { outcome, scorePct }); return { outcome, scorePct, matched, total, typed };
}

const out = { round: 60, tag: 'lostsave_bc_d6', uid: UID, class: CLASS, list: LIST, runStart: RUN_START };
const b = await chromium.launch({ headless: true });
try {
  out.pre = await readback('pre'); out.reviewAnchorsBefore = await day6ReviewAttempts(); slog.step('login', { email: EMAIL, preCsd: out.pre.csd, preTwi: out.pre.twi });
  const ctx = await b.newContext(); const p = await ctx.newPage(); out.loggedIn = await login(p, EMAIL, F); await sleep(1500);
  const rr = await directNavAndReach(p); out.degradeProbe = rr.probe; out.wrongList = !!rr.wrongList;
  if (!rr.wrongList && rr.reached) { out.review = await driveGood(p); out.reachVia = rr.probe.via; }
  else out.review = { reached: false };
  out.afterReview = await readback('after-review');
  slog.step('after_review_readback', { csd: out.afterReview.csd, twi: out.afterReview.twi, fresh: out.afterReview.fresh });
  await ctx.close();
  // bare reload to confirm it sticks
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); await login(p2, EMAIL, F); await sleep(1500);
  await p2.goto(`${BASE}/session/${CLASS}/${LIST}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let w = 0; w < 8; w++) { await sleep(1000); const bd = (await p2.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); if (!/preparing your session/i.test(bd)) break; }
  await sleep(2000); out.reloadRouted = p2.url();
  out.post = await readback('post-reload'); out.reviewAnchorsAfter = await day6ReviewAttempts();
  slog.step('reload_readback', { csd: out.post.csd, twi: out.post.twi, canon: out.post.canonical_list_progress, routedUrl: out.reloadRouted });
  await ctx2.close(); await b.close();
} catch (e) { out.error = String(e).slice(0, 300); slog.error('drive', e); await b.close().catch(() => {}); }
out.csd5to6 = out.post && out.post.csd === 6 && out.pre.csd === 5;
out.twiStable480 = out.post && out.post.twi === 480;
out.reviewAnchorCreated = (out.reviewAnchorsAfter || 0) > (out.reviewAnchorsBefore || 0);
out.canonZero = out.post && out.post.canonical_list_progress === 0;
out.verdict = out.csd5to6 && out.twiStable480 ? `FULLY AUTO-RECOVERED: day-6 review completed -> csd 5->6, twi stays 480, canonical=${out.post.canonical_list_progress}` : (out.post && out.post.csd === 5 ? `GAP: csd STILL 5 after completing day-6 review (review outcome=${out.review?.outcome} score=${out.review?.scorePct}) — genuine gap` : `OTHER: post csd=${out.post?.csd} twi=${out.post?.twi}`);
slog.done({ verdict: out.verdict });
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r60_lostsave.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ degradeProbe: out.degradeProbe, review: out.review, pre: out.pre?.csd, afterReview: out.afterReview?.csd, postReload: out.post?.csd, twi: out.pre?.twi + '->' + out.post?.twi, reviewAnchors: out.reviewAnchorsBefore + '->' + out.reviewAnchorsAfter, verdict: out.verdict }, null, 2));

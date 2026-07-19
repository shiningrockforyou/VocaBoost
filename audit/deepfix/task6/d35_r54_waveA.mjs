/**
 * R54 WAVE A — 3 live-ticket verbatim clones, live prod, SANDBOX only (never 26SM).
 *   live_oyk (오윤권, runaway-inflated csd12): renderCheck -> submit EMPTY review x2 -> expect HELD@12 (no advance, no demote)
 *   live_kjk (김재경, throttle csd4):          renderCheck -> skip(empty) x1 -> 2 GOOD reviews -> expect escape after 2nd
 *   live_lhs (이해섭, normal csd9):            renderCheck -> complete day-10 (new-word test [SOLVED reach] + review) -> csd 9->10 once
 * Mandatory: lsr_step_logger wired into every drive; reachProbe on first card; in-loop progress+heartbeat; fail-fast <=25s.
 * Reach path per WSL source-dive: Start-Studying gate -> Session menu -> "Skip to Test" -> "Start Test" -> /mcqtest/ ;
 *   fallback: press 'C' per card to DRAIN (NOT "Next card" which only cycles), Start-Test confirm auto-opens at <=1 card.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, norm } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');

const ROSTER = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster;
const ONLY = process.argv.slice(2); // optional: restrict to given tags
const pick3 = ['live_oyk', 'live_kjk', 'live_lhs'].filter((t) => !ONLY.length || ONLY.includes(t)).map((t) => ROSTER.find((r) => r.tag === t));
const F = makeFindings ? makeFindings('R54A') : { add: () => {} };

// per-list word->def maps (cache)
const MAPS = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
async function mapFor(listId) {
  if (MAPS[listId]) return MAPS[listId];
  const snap = await db.collection('lists').doc(listId).collection('words').get();
  const m = {}; for (const d of snap.docs) { const w = d.data(); const dd = w.definitions || {}; m[keyOf(w.word)] = { defs: [w.definition, dd.en].filter(Boolean).map(String), ko: dd.ko || '' }; }
  MAPS[listId] = m; return m;
}
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function pick(prompt, optTexts, MAP) {
  const pk = keyOf(prompt);
  const pe = MAP[pk];
  if (pe && pe.defs.length) { const dt = new Set(pe.defs.flatMap(toks)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const s = toks(o).filter((t) => dt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs, dir: 'word->def' }; }
  const pt = new Set(toks(prompt)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const defs = (MAP[keyOf(o)] || {}).defs || []; const s = defs.flatMap(toks).filter((t) => pt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs, dir: 'def->word' };
}
async function readback(uid, classId, listId, tag) {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data() || {};
  const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
  let logTypes = {}; try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(60).get(); for (const d of sl.docs) { const t = d.data().type || d.data().event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore), canonical_list_progress: canon, logTypes };
}
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

// SOLVED reach: kind='review'|'new'. Returns {reached, probe}.
async function reach(p, slog, kind) {
  const probe = { kind, startStudyingSeen: false, menuFound: false, skipItemFound: false, confirmLabel: null, routedUrl: null, via: null };
  const ctaRe = kind === 'new' ? /start new words|^continue$|start session/i : /start review|retry review|^review$|^continue$|start session/i;
  const cta = p.getByRole('button', { name: ctaRe }).first();
  if (await cta.isVisible().catch(() => false)) { await cta.click().catch(() => {}); await sleep(2500); }
  // poll up to ~6s for the "Start Studying" customize modal (it races the render — r54 Wave-A miss)
  let ss = null;
  for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
  probe.startStudyingSeen = !!ss;
  if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
  slog.step('startStudyingGate', { present: probe.startStudyingSeen, kind });
  // PATH A: Session menu -> Skip to Test -> Start Test -> /mcqtest/
  const menu = p.getByRole('button', { name: 'Session menu' }).first();
  probe.menuFound = await menu.isVisible().catch(() => false);
  if (probe.menuFound) {
    await menu.click().catch(() => {}); await sleep(700);
    const skip = p.getByText(/^\s*skip to test\s*$/i).first();
    probe.skipItemFound = await skip.isVisible().catch(() => false);
    if (probe.skipItemFound) {
      await skip.click().catch(() => {}); await sleep(900);
      const startTest = p.getByRole('button', { name: /^\s*start test\s*$/i }).first();
      if (await startTest.isVisible().catch(() => false)) { probe.confirmLabel = 'Start Test'; await startTest.click().catch(() => {}); }
      await p.waitForURL(/\/mcqtest\//, { timeout: 15000 }).catch(() => {});
      if (await inTest(p)) probe.via = 'A';
    } else { await p.keyboard.press('Escape').catch(() => {}); }
  }
  // PATH B: drain with 'C'
  if (!(await inTest(p))) {
    slog.step('reachPathB', { reason: 'pathA-not-routed' });
    const n = 90;
    for (let k = 0; k < n && !(await inTest(p)); k++) {
      slog.progress('dismissCards', k + 1, n);
      if (k === 0) { // dump the ACTUAL study-card controls (aria-labels + text) so a failure is diagnostic
        const bs = p.getByRole('button'); const bn = await bs.count(); const labels = [];
        for (let j = 0; j < Math.min(bn, 28); j++) { const al = await bs.nth(j).getAttribute('aria-label').catch(() => null); const tx = (await bs.nth(j).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 28); const vis = await bs.nth(j).isVisible().catch(() => false); if (vis && (al || tx)) labels.push(al ? '@' + al : tx); }
        slog.step('drainControls', { url: p.url(), labels });
      }
      const startTest = p.getByRole('button', { name: /^\s*start test\s*$/i }).first();
      if (await startTest.isVisible().catch(() => false)) { await startTest.click().catch(() => {}); await sleep(1500); continue; }
      const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first();
      if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; }
      // PRIMARY drain: click the "I know this word (C)" button (keypress needs focus — was unreliable)
      const know = p.getByRole('button', { name: /i know this word/i }).first();
      if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(140); continue; }
      await p.keyboard.press('c').catch(() => {}); await sleep(140);
    }
    if (await inTest(p)) probe.via = 'B';
  }
  probe.routedUrl = p.url();
  slog.step('reachProbe', probe);
  return { reached: await inTest(p), probe };
}

// drive the test (MCQ or TYPED): mode 'good' (answer correctly) or 'empty' (submit nothing).
async function driveMcq(p, slog, MAP, mode) {
  const typed = /\/typedtest\//.test(p.url()) || (await p.locator('input[placeholder*="definition" i]').count()) > 0;
  let answered = 0, matched = 0, total = 30;
  if (typed) {
    const inputs = p.locator('input[placeholder*="definition" i]');
    for (let a = 0; a < 6; a++) { total = await inputs.count(); if (total > 0) break; await sleep(800); }
    if (mode === 'good') {
      for (let i = 0; i < total; i++) {
        const word = await inputs.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => '');
        const e = MAP[keyOf(word)];
        const ans = e ? (e.ko || e.defs[0] || '') : ''; if (ans) matched++;
        await inputs.nth(i).fill(ans).catch(() => {});
        answered = i + 1; slog.progress('answering', answered, total, { matched, kind: 'typed' });
      }
    }
    slog.step('answered', { answered: mode === 'good' ? answered : 0, total, matched, mode, kind: 'typed' });
  } else {
    const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
    if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
    if (mode === 'good') {
      let guard = 0;
      while (answered < total && guard < total + 10) {
        guard++;
        const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
        const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count();
        if (!word || nn === 0) { await sleep(700); continue; }
        const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '));
        const r = pick(word, texts, MAP); if (r.bs > 0) matched++;
        await opts.nth(r.best).click({ timeout: 3000 }).catch(() => {}); await sleep(420);
        const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/);
        answered = nm ? +nm[1] : answered + 1;
        slog.progress('answering', answered, total, { matched, kind: 'mcq' });
      }
    }
    slog.step('answered', { answered, total, matched, mode, kind: 'mcq' });
  }
  await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
  const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first();
  const hadDialog = await modal.isVisible().catch(() => false);
  if (hadDialog) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  slog.step('dialog', { hadEmptyConfirm: hadDialog });
  const outcome = await Promise.race([
    p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'),
    p.getByText(/retake required|불합격|not complete|이 날을 완료/i).first().waitFor({ timeout: 25000 }).then(() => 'retake-gate'),
    p.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 25000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2200);
  const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const scorePct = (body.match(/(\d{1,3})\s*%/) || [])[1] ? +(body.match(/(\d{1,3})\s*%/) || [])[1] : null;
  slog.step('outcome', { outcome, scorePct });
  return { answered, total, matched, outcome, scorePct };
}

const results = {};
const b = await chromium.launch({ headless: true });
for (const S of pick3) {
  const slog = makeStepLogger(`r54-${S.tag}`);
  slog.heartbeat(15000);
  const MAP = await mapFor(S.listId);
  const r = { tag: S.tag, family: S.family, uid: S.uid, class: S.sandboxClassId, list: S.listId, seededCsd: S.seededCsd, steps: slog.file };
  try {
    r.pre = await readback(S.uid, S.sandboxClassId, S.listId, 'pre'); slog.step('login', { email: S.email, preCsd: r.pre.csd });
    const ctx = await b.newContext(); const p = await ctx.newPage();
    r.loggedIn = await login(p, S.email, F); await sleep(1500);
    await goDashboard(p); await sleep(3000);
    const dash = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    r.renderDay = dayOf(dash); r.offersNewWords = /start new words/i.test(dash); r.offersReviewOnly = /start review|retry review/i.test(dash) && !/start new words/i.test(dash);
    slog.step('renderCheck', { renderDay: r.renderDay, offersNewWords: r.offersNewWords, offersReviewOnly: r.offersReviewOnly });

    if (S.tag === 'live_oyk') {
      r.rounds = [];
      for (let i = 0; i < 2; i++) {
        const rr = await reach(p, slog, 'review');
        if (!rr.reached) { r.rounds.push({ i, reached: false }); break; }
        const d = await driveMcq(p, slog, MAP, 'empty');
        const rb = await readback(S.uid, S.sandboxClassId, S.listId, `after-empty-${i}`);
        r.rounds.push({ i, reached: true, outcome: d.outcome, csd: rb.csd });
        await goDashboard(p); await sleep(2500);
      }
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.HELD_at_12 = r.post.csd === 12 && r.pre.csd === 12;
    } else if (S.tag === 'live_kjk') {
      r.rounds = [];
      // skip (empty) x1
      let rr = await reach(p, slog, 'review');
      if (rr.reached) { const d = await driveMcq(p, slog, MAP, 'empty'); r.rounds.push({ kind: 'skip', outcome: d.outcome, csd: (await readback(S.uid, S.sandboxClassId, S.listId, 'after-skip')).csd }); await goDashboard(p); await sleep(2500); }
      // 2 good reviews
      for (let i = 0; i < 2; i++) {
        rr = await reach(p, slog, 'review');
        if (!rr.reached) { r.rounds.push({ kind: `good-${i}`, reached: false }); break; }
        const d = await driveMcq(p, slog, MAP, 'good');
        const rb = await readback(S.uid, S.sandboxClassId, S.listId, `after-good-${i}`);
        r.rounds.push({ kind: `good-${i}`, score: d.scorePct, matched: d.matched, outcome: d.outcome, csd: rb.csd, reviewMode: rb.reviewMode });
        await goDashboard(p); await sleep(2500);
      }
      const dash2 = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.postOffersNewWords = /start new words/i.test(dash2);
      r.escaped = r.post.reviewMode === false || r.postOffersNewWords || r.post.csd > r.pre.csd;
    } else if (S.tag === 'live_lhs') {
      // complete day: new-word test (SOLVED reach) then review
      r.rounds = [];
      let rr = await reach(p, slog, 'new'); r.newReachProbe = rr.probe;
      if (rr.reached) { const d = await driveMcq(p, slog, MAP, 'good'); r.rounds.push({ kind: 'newword', score: d.scorePct, matched: d.matched, outcome: d.outcome }); await goDashboard(p); await sleep(3000); }
      else { r.rounds.push({ kind: 'newword', reached: false }); }
      // review step (if the day offers it)
      const dashR = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/start review|retry review|^review$/i.test(dashR)) {
        rr = await reach(p, slog, 'review');
        if (rr.reached) { const d = await driveMcq(p, slog, MAP, 'good'); r.rounds.push({ kind: 'review', score: d.scorePct, matched: d.matched, outcome: d.outcome }); await goDashboard(p); await sleep(3000); }
      }
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.csdAdvancedOnce = r.post.csd === r.pre.csd + 1;
    }
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 300); slog.error('drive', e); }
  slog.done({ tag: S.tag, pre: r.pre?.csd, post: r.post?.csd });
  results[S.tag] = r;
  console.log(`[${S.tag}] pre csd=${r.pre?.csd} -> post csd=${r.post?.csd} | ${JSON.stringify(r.rounds || r.error)}`);
}
await b.close().catch(() => {});
const OUTP = 'C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r54_waveA.json';
let merged = { round: 54, wave: 'A', results: {} };
try { merged = JSON.parse(readFileSync(OUTP, 'utf8')); merged.results = merged.results || {}; } catch {}
Object.assign(merged.results, results); // overwrite only the just-driven tags, preserve others
writeFileSync(OUTP, JSON.stringify(merged, null, 2));
console.log('\nwrote deepfix_d35_tier3_r54_waveA.json');

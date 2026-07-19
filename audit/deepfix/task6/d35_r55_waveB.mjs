/**
 * R55 WAVE B — throttle escapes (B1x4) + off-by-one completions (B2x2) + 최도훈 lost-save (B3) — live prod, SANDBOX only.
 * Reuses r54 reach machinery (Start-Studying poll -> Path A Session menu -> Skip to Test -> Start Test -> /mcqtest|typedtest/)
 * + per-class MCQ/typed detection (typed = fill definitions.ko) + step-logger (mandatory, live JSONL evidence).
 * Priority order B1 -> B3 -> B2. FRESH drive (WSL verdict-engine now requires --since fresh proof). Never 26SM.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, norm } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');
const ROSTER = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster;
const F = makeFindings ? makeFindings('R55B') : { add: () => {} };
const ORDER = ['thr_0DnzKs', 'thr_bFV18s', 'thr_yiVt86', 'jisu_a1', 'choi_a12', 'obo_GL7SXB', 'obo_JoJ2ch']; // B1 -> B3 -> B2
const ONLY = process.argv.slice(2);
const RUN = (ONLY.length ? ORDER.filter((t) => ONLY.includes(t)) : ORDER).map((t) => ROSTER.find((r) => r.tag === t)).filter(Boolean);
const RUN_START = new Date().toISOString();

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
  const pe = MAP[keyOf(prompt)];
  if (pe && pe.defs.length) { const dt = new Set(pe.defs.flatMap(toks)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const s = toks(o).filter((t) => dt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs }; }
  const pt = new Set(toks(prompt)); let b = 0, bs = -1; optTexts.forEach((o, i) => { const defs = (MAP[keyOf(o)] || {}).defs || []; const s = defs.flatMap(toks).filter((t) => pt.has(t)).length; if (s > bs) { bs = s; b = i; } }); return { best: b, bs };
}
async function readback(uid, classId, listId, tag) {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data() || {};
  const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
  let logTypes = {}, freshLogs = 0; try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(80).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) freshLogs++; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore), canonical_list_progress: canon, logTypes, freshLogsSinceStart: freshLogs };
}
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

async function reach(p, slog, kind) {
  const probe = { kind, startStudyingSeen: false, menuFound: false, skipItemFound: false, confirmLabel: null, routedUrl: null, via: null };
  const ctaRe = kind === 'new' ? /start new words|^continue$|start session/i : /start review|retry review|^review$|^continue$|start session/i;
  const cta = p.getByRole('button', { name: ctaRe }).first();
  if (await cta.isVisible().catch(() => false)) { await cta.click().catch(() => {}); await sleep(2500); }
  let ss = null;
  for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
  probe.startStudyingSeen = !!ss;
  if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
  slog.step('startStudyingGate', { present: probe.startStudyingSeen, kind });
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
      await p.waitForURL(/\/(mcqtest|typedtest)\//, { timeout: 15000 }).catch(() => {});
      if (await inTest(p)) probe.via = 'A';
    } else { await p.keyboard.press('Escape').catch(() => {}); }
  }
  if (!(await inTest(p))) {
    slog.step('reachPathB', { reason: 'pathA-not-routed' });
    const n = 90;
    for (let k = 0; k < n && !(await inTest(p)); k++) {
      slog.progress('dismissCards', k + 1, n);
      const startTest = p.getByRole('button', { name: /^\s*start test\s*$/i }).first();
      if (await startTest.isVisible().catch(() => false)) { await startTest.click().catch(() => {}); await sleep(1500); continue; }
      const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first();
      if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; }
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
async function driveTest(p, slog, MAP, mode) {
  const typed = /\/typedtest\//.test(p.url()) || (await p.locator('input[placeholder*="definition" i]').count()) > 0;
  let answered = 0, matched = 0, total = 30;
  if (typed) {
    const inputs = p.locator('input[placeholder*="definition" i]');
    for (let a = 0; a < 6; a++) { total = await inputs.count(); if (total > 0) break; await sleep(800); }
    if (mode === 'good') for (let i = 0; i < total; i++) { const word = await inputs.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => ''); const e = MAP[keyOf(word)]; const ans = e ? (e.ko || e.defs[0] || '') : ''; if (ans) matched++; await inputs.nth(i).fill(ans).catch(() => {}); answered = i + 1; slog.progress('answering', answered, total, { matched, kind: 'typed' }); }
    slog.step('answered', { answered: mode === 'good' ? answered : 0, total, matched, mode, kind: 'typed' });
  } else {
    const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
    if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
    if (mode === 'good') { let g = 0; while (answered < total && g < total + 10) { g++; const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => ''); const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count(); if (!word || nn === 0) { await sleep(700); continue; } const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ')); const r = pick(word, texts, MAP); if (r.bs > 0) matched++; await opts.nth(r.best).click({ timeout: 3000 }).catch(() => {}); await sleep(420); const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/); answered = nm ? +nm[1] : answered + 1; slog.progress('answering', answered, total, { matched, kind: 'mcq' }); } }
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
  return { answered, total, matched, outcome, scorePct, typed };
}
async function day16Anchors(uid, listId) {
  try { const at = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get();
    return at.docs.map((d) => d.data()).filter((a) => a.studyDay === 16 && /new/i.test(a.attemptType || a.type || '') && (a.passed === true || a.isPassed === true)).length;
  } catch { return null; }
}

const results = {};
const b = await chromium.launch({ headless: true });
for (const S of RUN) {
  const bucket = ['obo_GL7SXB', 'obo_JoJ2ch'].includes(S.tag) ? 'B2' : (S.tag === 'choi_a12' ? 'B3' : 'B1');
  const slog = makeStepLogger(`r55-${S.tag}`); slog.heartbeat(15000);
  const MAP = await mapFor(S.listId);
  const r = { tag: S.tag, bucket, family: S.family, uid: S.uid, class: S.sandboxClassId, list: S.listId, seededCsd: S.seededCsd, steps: slog.file };
  try {
    r.pre = await readback(S.uid, S.sandboxClassId, S.listId, 'pre'); slog.step('login', { email: S.email, preCsd: r.pre.csd, bucket });
    const ctx = await b.newContext(); const p = await ctx.newPage();
    r.loggedIn = await login(p, S.email, F); await sleep(1500);
    await goDashboard(p); await sleep(3000);
    const dash = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    r.renderDay = dayOf(dash); r.offersNewWords = /start new words/i.test(dash); r.offersReviewOnly = /start review|retry review/i.test(dash) && !/start new words/i.test(dash);
    r.renderCoherent = !/something went wrong|error boundary|unexpected error|failed to load/i.test(dash);
    slog.step('renderCheck', { renderDay: r.renderDay, offersNewWords: r.offersNewWords, offersReviewOnly: r.offersReviewOnly, coherent: r.renderCoherent });

    if (bucket === 'B1') { // throttle escape: 2 good reviews
      r.rounds = [];
      for (let i = 0; i < 2; i++) {
        const rr = await reach(p, slog, 'review'); if (!rr.reached) { r.rounds.push({ i, reached: false, probe: rr.probe }); break; }
        const d = await driveTest(p, slog, MAP, 'good');
        const rb = await readback(S.uid, S.sandboxClassId, S.listId, `after-good-${i}`);
        r.rounds.push({ i, via: rr.probe.via, mode: d.typed ? 'typed' : 'mcq', score: d.scorePct, matched: d.matched, outcome: d.outcome, csd: rb.csd, reviewMode: rb.reviewMode, interv: rb.interv });
        slog.step('readback', { i, csd: rb.csd, reviewMode: rb.reviewMode, interv: rb.interv, review_recorded: rb.logTypes.review_recorded || 0 });
        await goDashboard(p); await sleep(2500);
      }
      const dash2 = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.escaped = r.post.reviewMode === false || /start new words/i.test(dash2) || r.post.csd > r.pre.csd;
      r.noDemote = r.post.csd >= r.pre.csd; r.review_recorded = r.post.logTypes.review_recorded || 0;
    } else if (bucket === 'B3') { // choi_a12 lost-save: degradeProbe -> complete day-16 new
      r.degradeProbe = { renderDay: r.renderDay, offersNewWords: r.offersNewWords, offersReviewOnly: r.offersReviewOnly, coherent: r.renderCoherent, falseSuccess: /100%|완료했|day complete|all done/i.test(dash) && !r.offersNewWords, excerpt: dash.slice(0, 200) };
      slog.step('degradeProbe', r.degradeProbe);
      r.anchorsBefore = await day16Anchors(S.uid, S.listId);
      const rr = await reach(p, slog, 'new'); r.newReachProbe = rr.probe;
      if (rr.reached) { const d = await driveTest(p, slog, MAP, 'good'); r.newword = { via: rr.probe.via, mode: d.typed ? 'typed' : 'mcq', score: d.scorePct, matched: d.matched, outcome: d.outcome }; await goDashboard(p); await sleep(3000); }
      else r.newword = { reached: false };
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.anchorsAfter = await day16Anchors(S.uid, S.listId);
      r.csd15to16 = r.post.csd === 16 && r.pre.csd === 15; r.exactlyOneAnchor = r.anchorsAfter === 1;
    } else { // B2 off-by-one: complete the offered day
      const kind = r.offersNewWords ? 'new' : 'review';
      const rr = await reach(p, slog, kind); r.reachProbe = rr.probe;
      if (rr.reached) { const d = await driveTest(p, slog, MAP, 'good'); r.completion = { via: rr.probe.via, mode: d.typed ? 'typed' : 'mcq', score: d.scorePct, outcome: d.outcome }; await goDashboard(p); await sleep(3000); }
      else r.completion = { reached: false };
      r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
      r.csdReconciled = r.post.csd > r.pre.csd; r.reconcileLog = (r.post.logTypes.csd_twi_reconciled || 0) + (r.post.logTypes.resolve_list_progress || 0); r.canonZero = r.post.canonical_list_progress === 0;
    }
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 300); slog.error('drive', e); }
  slog.done({ tag: S.tag, pre: r.pre?.csd, post: r.post?.csd });
  results[S.tag] = r;
  console.log(`[${S.tag}/${bucket}] pre=${r.pre?.csd} post=${r.post?.csd} | ${JSON.stringify(r.rounds || r.newword || r.completion || r.error).slice(0, 160)}`);
}
await b.close().catch(() => {});
const OUTP = 'C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r55_waveB.json';
let merged = { round: 55, wave: 'B', runStart: RUN_START, results: {} };
try { merged = JSON.parse(readFileSync(OUTP, 'utf8')); merged.results = merged.results || {}; merged.runStart = RUN_START; } catch {}
Object.assign(merged.results, results);
writeFileSync(OUTP, JSON.stringify(merged, null, 2));
console.log('\nRUN_START=' + RUN_START + '  wrote deepfix_d35_tier3_r55_waveB.json');

/**
 * R56 WAVE C — 4 synthetic adversarial configs (WSL-designed), live prod, SANDBOX only (never 26SM).
 *   A2_skip_hold(csd5):        direct-nav -> Skip to Test -> submit EMPTY review -> expect HELD csd/twi flat
 *   F1_extreme_runaway(csd30): renderCheck ONLY (bare load = the test; resolver fires on read) -> read-only-safe, no crash/demote
 *   F8_canonical_anomaly(csd6,canon=1): renderCheck ONLY -> resolver DETECTS canonical, no crash, no proliferation (count stays 1)
 *   F4_incoherent_throttle(csd6): direct-nav -> one skipped review -> coherent reconcile, no phantom hold
 * NEW STANDING RULE: navigate DIRECTLY to /session/<classId>/<listId> (roster exact); assert routedUrl contains listId
 *   else wrongListLoaded+stop. Capture console errors (crash detection). Reuse r54/r55 reach + step-logger.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings, sleep, norm, BASE } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');
const ROSTER = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/synthetic_seed_roster.json', 'utf8')).roster;
const F = makeFindings ? makeFindings('R56C') : { add: () => {} };
const ONLY = process.argv.slice(2);
const RUN = (ONLY.length ? ROSTER.filter((r) => ONLY.includes(r.tag)) : ROSTER);
const RUN_START = new Date().toISOString();
const RENDER_ONLY = new Set(['F1_extreme_runaway', 'F8_canonical_anomaly']);

const MAPS = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
async function mapFor(listId) { if (MAPS[listId]) return MAPS[listId]; const snap = await db.collection('lists').doc(listId).collection('words').get(); const m = {}; for (const d of snap.docs) { const w = d.data(); const dd = w.definitions || {}; m[keyOf(w.word)] = { defs: [w.definition, dd.en].filter(Boolean).map(String), ko: dd.ko || '' }; } MAPS[listId] = m; return m; }
async function readback(uid, classId, listId, tag) {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data() || {};
  const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
  let logTypes = {}, fresh = 0; try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(80).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) fresh++; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, canonical_list_progress: canon, logTypes, freshLogsSinceStart: fresh };
}
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

// direct-nav reach: goto /session/<classId>/<listId>, assert listId, then Start-Studying gate -> Path A -> Path B
async function reachDirect(p, slog, classId, listId, renderOnly) {
  const target = `${BASE}/session/${classId}/${listId}`;
  await p.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000); // let resolveListProgress fire on read + render
  const routedUrl = p.url();
  const containsListId = routedUrl.includes(listId);
  const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const probe = { target, routedUrl, containsListId, renderDay: dayOf(body), offersNewWords: /start new words/i.test(body), offersReviewOnly: /start review|retry review/i.test(body) && !/start new words/i.test(body), coherent: !/something went wrong|error boundary|unexpected error|failed to load|blank/i.test(body), excerpt: body.slice(0, 180) };
  if (renderOnly) { slog.step('reachProbe', { ...probe, renderOnly: true }); return { reached: false, probe, renderOnly: true }; }
  if (!containsListId && !/\/(mcqtest|typedtest)\//.test(routedUrl)) { slog.step('wrongListLoaded', { routedUrl, wanted: listId }); return { reached: false, probe, wrongList: true }; }
  // Start-Studying gate
  let ss = null; for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
  probe.startStudyingSeen = !!ss; if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
  // Path A
  const menu = p.getByRole('button', { name: 'Session menu' }).first(); probe.menuFound = await menu.isVisible().catch(() => false);
  if (probe.menuFound) { await menu.click().catch(() => {}); await sleep(700); const skip = p.getByText(/^\s*skip to test\s*$/i).first(); probe.skipItemFound = await skip.isVisible().catch(() => false);
    if (probe.skipItemFound) { await skip.click().catch(() => {}); await sleep(900); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) { probe.confirmLabel = 'Start Test'; await st.click().catch(() => {}); } await p.waitForURL(/\/(mcqtest|typedtest)\//, { timeout: 15000 }).catch(() => {}); if (await inTest(p)) probe.via = 'A'; } else await p.keyboard.press('Escape').catch(() => {}); }
  // Path B
  if (!(await inTest(p))) { slog.step('reachPathB', {}); for (let k = 0; k < 90 && !(await inTest(p)); k++) { slog.progress('dismissCards', k + 1, 90); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) { await st.click().catch(() => {}); await sleep(1500); continue; } const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first(); if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; } const know = p.getByRole('button', { name: /i know this word/i }).first(); if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(140); continue; } await p.keyboard.press('c').catch(() => {}); await sleep(140); } if (await inTest(p)) probe.via = 'B'; }
  probe.routedUrl = p.url();
  slog.step('reachProbe', probe);
  return { reached: await inTest(p), probe };
}
async function submitEmpty(p, slog) {
  const typed = /\/typedtest\//.test(p.url());
  let total = 0; if (typed) { const inp = p.locator('input[placeholder*="definition" i]'); for (let a = 0; a < 5; a++) { total = await inp.count(); if (total) break; await sleep(700); } } else { const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 6000 }).catch(() => ''); const m = lbl.match(/(\d+) of (\d+)/); total = m ? +m[2] : 30; }
  slog.step('answered', { answered: 0, total, mode: 'empty', kind: typed ? 'typed' : 'mcq' });
  await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
  const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first(); const had = await modal.isVisible().catch(() => false);
  if (had) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  slog.step('dialog', { hadEmptyConfirm: had });
  const outcome = await Promise.race([p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'), p.getByText(/%|score|correct|점|합격|retake|불합격|not complete/i).first().waitFor({ timeout: 25000 }).then(() => 'results')]).catch(() => 'timeout');
  await sleep(2000); slog.step('outcome', { outcome }); return { outcome, total, typed };
}

const results = {};
const b = await chromium.launch({ headless: true });
for (const S of RUN) {
  const slog = makeStepLogger(`r56-${S.tag}`); slog.heartbeat(15000);
  const MAP = await mapFor(S.listId);
  const r = { tag: S.tag, family: S.family, uid: S.uid, class: S.sandboxClassId, list: S.listId, seededCsd: S.seededCsd, steps: slog.file };
  const consoleErrors = [];
  try {
    r.pre = await readback(S.uid, S.sandboxClassId, S.listId, 'pre'); slog.step('login', { email: S.email, preCsd: r.pre.csd, family: S.family });
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
    p.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e.message || e).slice(0, 140)));
    r.loggedIn = await login(p, S.email, F); await sleep(1500);
    const renderOnly = RENDER_ONLY.has(S.tag);
    const rr = await reachDirect(p, slog, S.sandboxClassId, S.listId, renderOnly);
    r.reachProbe = rr.probe; r.wrongList = !!rr.wrongList;
    if (!renderOnly && !rr.wrongList && rr.reached) { r.skip = await submitEmpty(p, slog); }
    await sleep(1500);
    r.consoleErrors = consoleErrors.slice(0, 8); r.crashed = consoleErrors.some((e) => /PAGEERROR|Minified React error|cannot read|undefined is not/i.test(e));
    r.post = await readback(S.uid, S.sandboxClassId, S.listId, 'post');
    // per-family verdict hints
    r.csdFlat = r.post.csd === r.pre.csd; r.twiFlat = r.post.twi === r.pre.twi; r.noDemote = r.post.csd >= r.pre.csd;
    r.resolveLog = (r.post.logTypes.resolve_list_progress || 0); r.quarantineLog = (r.post.logTypes.list_progress_quarantine_candidate || 0) + (r.post.logTypes.list_progress_quarantine || 0);
    r.canonProliferated = r.post.canonical_list_progress > r.pre.canonical_list_progress;
    slog.step('readback', { csd: r.post.csd, twi: r.post.twi, canon: r.post.canonical_list_progress, resolveLog: r.resolveLog, quarantineLog: r.quarantineLog, crashed: r.crashed });
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 300); slog.error('drive', e); }
  slog.done({ tag: S.tag, pre: r.pre?.csd, post: r.post?.csd, crashed: r.crashed });
  results[S.tag] = r;
  console.log(`[${S.tag}] pre=${r.pre?.csd}->post=${r.post?.csd} csdFlat=${r.csdFlat} noDemote=${r.noDemote} canon=${r.pre?.canonical_list_progress}->${r.post?.canonical_list_progress} resolveLog=${r.resolveLog} quarantine=${r.quarantineLog} crashed=${r.crashed} wrongList=${r.wrongList} route=${r.reachProbe?.containsListId}`);
}
await b.close().catch(() => {});
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r56_waveC.json', JSON.stringify({ round: 56, wave: 'C', runStart: RUN_START, results }, null, 2));
console.log('\nRUN_START=' + RUN_START + '  wrote deepfix_d35_tier3_r56_waveC.json');

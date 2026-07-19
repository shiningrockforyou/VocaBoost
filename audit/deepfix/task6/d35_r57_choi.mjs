/**
 * R57 — 최도훈 (choi_a12) LOST-SAVE RE-DRIVE on the CORRECT list (Base Camp), live prod, SANDBOX only (never 26SM).
 * r55 hit his fresh Ascent list (dashboard routed wrong). Now DIRECT-NAV to /session/25WTa2r15/RmNNkuLPectBlBPiLbAJ.
 * Impossible session: csd=15, twi=1200, day-16 anchor MISSING, corrupted day-16 review-study phase (inert).
 * THE QUESTION: does the deployed server-authoritative fix AUTO-recover him (offer Day-16 new test -> complete -> advance)
 * WITHOUT a manual CS pass? PASS=auto-recover: csd 15->16, EXACTLY ONE day-16 new+passed anchor, twi 1200->1280,
 * fresh csd_twi_reconciled/new_word_test_recorded, canonical=0. HOLD=no advance => deployed fix does NOT auto-recover.
 * BOTH are real findings — do NOT force anything, log exactly what happens.
 */
import { writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings, sleep, norm, BASE } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');

const UID = 'NsDhPDK61wT6wds4clsIDPSNbHw2';
const CLASS = '25WTa2r15';
const LIST = 'RmNNkuLPectBlBPiLbAJ'; // Base Camp — the impossible session (NOT the Ascent dVliNv0p)
const EMAIL = 'lsr_a2_choia12@vocaboost.test';
const CPID = `${CLASS}_${LIST}`;
const F = makeFindings ? makeFindings('R57') : { add: () => {} };
const slog = makeStepLogger('r57-choi_a12'); slog.heartbeat(15000);
const RUN_START = new Date().toISOString();

const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
const snap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {}; for (const d of snap.docs) { const w = d.data(); const dd = w.definitions || {}; MAP[keyOf(w.word)] = { defs: [w.definition, dd.en].filter(Boolean).map(String), ko: dd.ko || '' }; }
const MAP_WORDS = Object.keys(MAP).length;
async function readback(tag) {
  const cp = (await db.collection('users').doc(UID).collection('class_progress').doc(CPID).get()).data() || {};
  const canon = (await db.collection('users').doc(UID).collection('list_progress').get()).size;
  let logTypes = {}, fresh = 0; try { const sl = await db.collection('system_logs').where('userId', '==', UID).limit(80).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) fresh++; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, canonical_list_progress: canon, logTypes, freshLogsSinceStart: fresh };
}
async function day16Anchors() { try { const at = await db.collection('attempts').where('studentId', '==', UID).where('listId', '==', LIST).get(); return at.docs.map((d) => d.data()).filter((a) => a.studyDay === 16 && /new/i.test(a.attemptType || a.type || '') && (a.passed === true || a.isPassed === true)).length; } catch { return null; } }
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };
const inTest = async (p) => /\/(mcqtest|typedtest)\//.test(p.url()) || (await p.locator('button[class*="min-h-"]').count()) > 0 || (await p.locator('input[placeholder*="definition" i]').count()) > 0;

const out = { round: 57, tag: 'choi_a12', uid: UID, class: CLASS, list: LIST, mapWords: MAP_WORDS, runStart: RUN_START };
const consoleErrors = [];
const b = await chromium.launch({ headless: true });
try {
  out.pre = await readback('pre'); slog.step('login', { email: EMAIL, preCsd: out.pre.csd, preTwi: out.pre.twi });
  out.anchorsBefore = await day16Anchors();
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
  p.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e.message || e).slice(0, 140)));
  out.loggedIn = await login(p, EMAIL, F); await sleep(1500);
  // DIRECT-NAV to the Base Camp session
  const target = `${BASE}/session/${CLASS}/${LIST}`;
  await p.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4500); // resolver fires on read + render
  const routedUrl = p.url();
  const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const degradeProbe = { target, routedUrl, containsBaseCamp: routedUrl.includes(LIST), loadedAscentInstead: routedUrl.includes('dVliNv0p9jqZYp9rfLpN'), renderDay: dayOf(body), offersNewWords: /start new words/i.test(body), offersReviewOnly: /start review|retry review/i.test(body) && !/start new words/i.test(body), falseSuccess: /100%|완료했|day complete|all done|list complete|finished the list/i.test(body) && !/start new words|start review/i.test(body), coherent: !/something went wrong|error boundary|unexpected error|failed to load/i.test(body), excerpt: body.slice(0, 220) };
  out.degradeProbe = degradeProbe; slog.step('degradeProbe', degradeProbe);
  // WRONG LIST GUARD — the whole point of r57
  if (!degradeProbe.containsBaseCamp && !/\/(mcqtest|typedtest)\//.test(routedUrl)) {
    out.wrongListLoaded = true; slog.step('wrongListLoaded', { routedUrl, wanted: LIST });
    out.verdict = 'BLOCKED: routed to wrong list (' + routedUrl + ') — cannot test Base Camp lost-save';
  } else {
    // reach + COMPLETE the offered Day-16 test (Path A -> Skip to Test -> Start Test; else C-drain)
    let ss = null; for (let w = 0; w < 6; w++) { const btn = p.getByRole('button', { name: /^\s*start studying\s*$/i }).first(); if (await btn.isVisible().catch(() => false)) { ss = btn; break; } if (await inTest(p)) break; await sleep(1000); }
    if (ss) { await ss.click().catch(() => {}); await sleep(2000); }
    let via = null;
    const menu = p.getByRole('button', { name: 'Session menu' }).first();
    if (await menu.isVisible().catch(() => false)) { await menu.click().catch(() => {}); await sleep(700); const skip = p.getByText(/^\s*skip to test\s*$/i).first(); if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await sleep(900); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) await st.click().catch(() => {}); await p.waitForURL(/\/(mcqtest|typedtest)\//, { timeout: 15000 }).catch(() => {}); if (await inTest(p)) via = 'A'; } else await p.keyboard.press('Escape').catch(() => {}); }
    if (!(await inTest(p))) { slog.step('reachPathB', {}); for (let k = 0; k < 90 && !(await inTest(p)); k++) { slog.progress('dismissCards', k + 1, 90); const st = p.getByRole('button', { name: /^\s*start test\s*$/i }).first(); if (await st.isVisible().catch(() => false)) { await st.click().catch(() => {}); await sleep(1500); continue; } const take = p.getByRole('button', { name: /take test|all cards reviewed/i }).first(); if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(1500); continue; } const know = p.getByRole('button', { name: /i know this word/i }).first(); if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(140); continue; } await p.keyboard.press('c').catch(() => {}); await sleep(140); } if (await inTest(p)) via = 'B'; }
    out.reached = await inTest(p); out.reachVia = via; out.testUrl = p.url();
    slog.step('reachProbe', { reached: out.reached, via, testUrl: out.testUrl });
    if (out.reached) {
      const typed = /\/typedtest\//.test(p.url()) || (await p.locator('input[placeholder*="definition" i]').count()) > 0;
      let answered = 0, matched = 0, total = 0;
      if (typed) { const inp = p.locator('input[placeholder*="definition" i]'); for (let a = 0; a < 6; a++) { total = await inp.count(); if (total) break; await sleep(800); } for (let i = 0; i < total; i++) { const word = await inp.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => ''); const e = MAP[keyOf(word)]; const ans = e ? (e.ko || e.defs[0] || '') : ''; if (ans) matched++; await inp.nth(i).fill(ans).catch(() => {}); answered = i + 1; slog.progress('answering', answered, total, { matched, kind: 'typed' }); } }
      else { const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => ''); const m = lbl.match(/(\d+) of (\d+)/); total = m ? +m[2] : 30; let g = 0; while (answered < total && g < total + 10) { g++; const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => ''); const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count(); if (!word || nn === 0) { await sleep(700); continue; } const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ')); const pe = MAP[keyOf(word)]; let best = 0, bs = -1; if (pe && pe.defs.length) { const dt = new Set(pe.defs.flatMap((x) => norm(x).split(/\s+/))); texts.forEach((o, i) => { const s = norm(o).split(/\s+/).filter((t) => dt.has(t)).length; if (s > bs) { bs = s; best = i; } }); } if (bs > 0) matched++; await opts.nth(best).click({ timeout: 3000 }).catch(() => {}); await sleep(420); const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/); answered = nm ? +nm[1] : answered + 1; slog.progress('answering', answered, total, { matched, kind: 'mcq' }); } }
      out.drive = { typed, answered, total, matched };
      slog.step('answered', out.drive);
      await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
      const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first(); if (await modal.isVisible().catch(() => false)) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
      out.outcome = await Promise.race([p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'), p.getByText(/retake required|불합격|not complete|이 날을 완료/i).first().waitFor({ timeout: 25000 }).then(() => 'retake-gate'), p.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 25000 }).then(() => 'results')]).catch(() => 'timeout');
      await sleep(2500); const rbody = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); out.scorePct = (rbody.match(/(\d{1,3})\s*%/) || [])[1] ? +(rbody.match(/(\d{1,3})\s*%/) || [])[1] : null;
      slog.step('outcome', { outcome: out.outcome, scorePct: out.scorePct });
    } else { out.reachNote = 'no test offered (list-end / no day-16 words?)'; }
  }
  await sleep(1500); out.consoleErrors = consoleErrors.slice(0, 8); out.crashed = consoleErrors.some((e) => /PAGEERROR|Minified React error|cannot read|undefined is not/i.test(e));
  out.post = await readback('post'); out.anchorsAfter = await day16Anchors();
  slog.step('readback', { csd: out.post.csd, twi: out.post.twi, canon: out.post.canonical_list_progress, anchorsAfter: out.anchorsAfter, crashed: out.crashed });
  await b.close();
} catch (e) { out.error = String(e).slice(0, 300); slog.error('drive', e); await b.close().catch(() => {}); }
// verdict
if (!out.verdict) {
  const advanced = out.post && out.post.csd === 16 && out.pre.csd === 15;
  const oneAnchor = out.anchorsAfter === 1; const twiUp = out.post && out.post.twi > out.pre.twi;
  if (advanced && oneAnchor) out.verdict = `PASS auto-recovery: csd 15->16, ${out.anchorsAfter} day-16 anchor, twi ${out.pre.twi}->${out.post.twi}, canonical=${out.post.canonical_list_progress}`;
  else if (out.post && out.post.csd === out.pre.csd) out.verdict = `HELD: csd stayed ${out.post.csd} (deployed fix does NOT auto-recover — manual CS pass still needed). offered=${out.degradeProbe?.offersNewWords} reached=${out.reached} outcome=${out.outcome}`;
  else out.verdict = `OTHER: pre csd=${out.pre?.csd} post csd=${out.post?.csd} anchors=${out.anchorsAfter} — inspect`;
}
slog.done({ verdict: out.verdict });
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r57_choi.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ degradeProbe: out.degradeProbe, wrongList: out.wrongListLoaded, reached: out.reached, drive: out.drive, outcome: out.outcome, scorePct: out.scorePct, pre: out.pre?.csd, post: out.post?.csd, twi: out.pre?.twi + '->' + out.post?.twi, anchors: out.anchorsBefore + '->' + out.anchorsAfter, crashed: out.crashed, verdict: out.verdict }, null, 2));

/**
 * R52 D3.5 tier-3 OFF-BY-ONE disambiguator — drive ONE completion, live prod, SANDBOX only (never 26SM).
 * Student obo_GL7SXB (김우주, class 25WTa2r12, list RmNNkuLPectBlBPiLbAJ, seeded csd=5). Complete the offered
 * new-word day (MCQ correct via token-overlap matcher, M5 dialog) -> read-back: does class_progress.csd advance
 * to a sane value (>=6, past the seeded 5)? csd_twi_reconciled / server-only log (M7)? canonical stays 0 (M4)?
 * PASS = csd advances cleanly (not re-stuck / not demoted). Real gap = stuck/demote/re-loop -> STOP + escalate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, enterSessionOnly, skipToTest, norm } = UI;
const { chromium } = await import('playwright');

const ROSTER = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster;
const S = ROSTER.find((r) => r.tag === 'obo_GL7SXB');
const LIST = S.listId;
const CPID = `${S.sandboxClassId}_${LIST}`;
const F = makeFindings ? makeFindings('OBOC') : { add: (...a) => console.log('F', ...a) };

// word->def map from the list's words subcollection
const wsnap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {};
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
for (const d of wsnap.docs) { const w = d.data(); MAP[keyOf(w.word)] = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String); }
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
function bestOption(word, optTexts) {
  const dt = new Set((MAP[keyOf(word)] || []).flatMap(toks));
  let best = 0, bestScore = -1;
  optTexts.forEach((o, i) => { const sc = toks(o).filter((t) => dt.has(t)).length; if (sc > bestScore) { bestScore = sc; best = i; } });
  return { best, bestScore };
}
async function readback(tag) {
  const cp = (await db.collection('users').doc(S.uid).collection('class_progress').doc(CPID).get()).data() || {};
  const canon = (await db.collection('users').doc(S.uid).collection('list_progress').get()).size;
  let logTypes = {};
  try { const sl = await db.collection('system_logs').where('userId', '==', S.uid).limit(60).get(); for (const d of sl.docs) { const t = d.data().type || d.data().event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map((s) => s.reviewScore), canonical_list_progress: canon, logTypes };
}
const dayOf = (body) => { const m = body.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };

// enter the offered session (new words or review) -> skipToTest -> answer MCQ correctly -> submit -> observe
async function driveOneStep(page, tag) {
  const ent = await enterSessionOnly(page, F, tag);
  if (!ent.entered) return { entered: false, why: 'session-not-entered' };
  await sleep(800);
  await skipToTest(page, F, tag);
  await sleep(1200);
  // typed or MCQ?
  const typedInputs = page.locator('input[placeholder*="definition" i]');
  if ((await typedInputs.count()) > 0) {
    const n = await typedInputs.count();
    for (let i = 0; i < n; i++) {
      const word = await typedInputs.nth(i).locator('xpath=..').locator('span.font-medium').first().innerText({ timeout: 3000 }).catch(() => '');
      const defs = MAP[keyOf(word)] || [];
      await typedInputs.nth(i).fill(defs[0] || '');
    }
    await page.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {});
  } else {
    let total = 30; const lbl = await page.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
    if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
    let answered = 0, guard = 0, matched = 0;
    while (answered < total && guard < total + 8) {
      guard++;
      const word = await page.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
      const opts = page.locator('button[class*="min-h-"]'); const nn = await opts.count();
      if (!word || nn === 0) { await sleep(700); continue; }
      const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '));
      const { best, bestScore } = bestOption(word, texts); if (bestScore > 0) matched++;
      await opts.nth(best).click({ timeout: 3000 }).catch(() => {}); await sleep(430);
      const nl = await page.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/);
      answered = nm ? +nm[1] : answered + 1;
    }
    await page.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {});
    var driven = { total, matched };
  }
  await sleep(900);
  const modal = page.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
  const outcome = await Promise.race([
    page.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 120000 }).then(() => 'save-error'),
    page.getByText(/retake required|불합격|not complete|이 날을 완료/i).first().waitFor({ timeout: 120000 }).then(() => 'retake-gate'),
    page.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 120000 }).then(() => 'results'),
  ]).catch(() => 'timeout');
  await sleep(2500);
  const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const pct = (body.match(/(\d{1,3})\s*%/) || [])[1];
  return { entered: true, outcome, scorePct: pct ? +pct : null, ...(driven || {}) };
}

const out = { round: 52, tag: S.tag, student: '김우주', uid: S.uid, class: S.sandboxClassId, list: LIST, seededCsd: S.seededCsd, mapWords: Object.keys(MAP).length };
const b = await chromium.launch({ headless: true });
try {
  out.pre = await readback('pre-login');
  const p = await b.newContext().then((c) => c.newPage());
  out.loggedIn = await login(p, S.email, F); await sleep(1500);
  await goDashboard(p); await sleep(3500);
  const dash = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  out.renderDay = dayOf(dash); out.offersNewWords = /start new words/i.test(dash); out.offersReviewOnly = /start review|retry review/i.test(dash) && !/start new words/i.test(dash);
  out.renderExcerpt = dash.slice(0, 200);
  out.postLoad = await readback('post-login');
  // complete the offered day — up to 2 steps (new words, then any review), until csd moves or no session offered
  out.steps = [];
  for (let step = 0; step < 2; step++) {
    await goDashboard(p); await sleep(3000);
    const d = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (!/start new words|start review|^continue$|start session/i.test(d)) { out.steps.push({ step, note: 'no session offered', day: dayOf(d) }); break; }
    const res = await driveOneStep(p, `obo-step${step}`);
    const rb = await readback(`after-step${step}`);
    out.steps.push({ step, day: dayOf(d), drive: res, csdAfter: rb.csd, twiAfter: rb.twi });
    if ((rb.csd ?? S.seededCsd) > S.seededCsd) break; // csd advanced -> done
  }
  await goDashboard(p); await sleep(3000);
  out.postComplete = await readback('post-completion');
  const dfin = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  out.finalRenderDay = dayOf(dfin);
  await b.close();
} catch (e) { out.error = String(e).slice(0, 300); await b.close().catch(() => {}); }

// interpretation hints (WSL assert-recovery.mjs authoritative)
const finalCsd = out.postComplete?.csd ?? out.seededCsd;
out.csdAdvanced = finalCsd > out.seededCsd;
out.csdDemoted = finalCsd < out.seededCsd;
out.M4_held = out.postComplete?.canonical_list_progress === 0;
out.verdictHint = out.csdAdvanced && !out.csdDemoted && out.M4_held ? 'OFF-BY-ONE RECOVERED (PASS) — csd advanced cleanly on completion' : (out.csdDemoted ? 'REAL GAP — csd demoted, STOP+escalate' : 'INCONCLUSIVE — csd did not advance; check outcome');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_obo_complete_r52.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ seededCsd: out.seededCsd, renderDay: out.renderDay, offersNewWords: out.offersNewWords, steps: out.steps?.map((s) => ({ step: s.step, day: s.day, score: s.drive?.scorePct, outcome: s.drive?.outcome, csdAfter: s.csdAfter })), finalCsd, csdAdvanced: out.csdAdvanced, M4_held: out.M4_held, verdictHint: out.verdictHint }, null, 2));

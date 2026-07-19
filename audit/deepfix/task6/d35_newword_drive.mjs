/**
 * R53 new-word test drive (validated) — reaches the new-word MCQ via the PROVEN driveNewWordsToTest helper
 * (start new words -> Start Studying -> wait "Card X of Y" -> skipToTest), then answers with a DIRECTION-AGNOSTIC
 * token-overlap matcher over the list's words subcollection. Dumps Q1 (heading + options + inferred direction) for
 * confirmation. Student obo_JoJ2ch (도하율, class 25WTa2r14, seeded csd=6) — expect verified high score + csd 6->7.
 * Live prod, SANDBOX only, never 26SM. Submits (a real completion) — this is the validation drive.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const PROG = 'C:/Users/dmchw/vocaboost/audit/playwright/findings/_r53_progress.log';
const t0 = Date.now();
const prog = (m) => { const line = `+${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`; try { appendFileSync(PROG, line + '\n'); } catch {} console.log(line); };
try { writeFileSync(PROG, `R53 new-word drive start\n`); } catch {}
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, driveNewWordsToTest, skipToTest, enterSessionOnly, norm } = UI;
const { chromium } = await import('playwright');
// Hardcoded per the R53 handoff (roster file was regenerated mid-round for the next wave; this student still exists
// in Firestore). Details verified from this round's inspects.
const S = { tag: 'obo_JoJ2ch', email: 'lsr_a2_oboJoJ2ch@vocaboost.test', uid: 'c8EcfdbsbLTJCDGFQYJnt1hbAl93', sandboxClassId: '25WTa2r14', listId: 'RmNNkuLPectBlBPiLbAJ', seededCsd: 6 };
const LIST = S.listId, CPID = `${S.sandboxClassId}_${LIST}`;
const F = makeFindings ? makeFindings('NWDRV') : { add: () => {} };
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
const wsnap = await db.collection('lists').doc(LIST).collection('words').get();
const MAP = {}; for (const d of wsnap.docs) { const w = d.data(); MAP[keyOf(w.word)] = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String); }
const toks = (s) => norm(s).replace(/[①-⓿0-9().,;:!?'"/\-]/g, ' ').split(/\s+/).filter((t) => t.length > 2);

// DIRECTION-AGNOSTIC: prompt may be a WORD (options=definitions) or a DEFINITION (options=words).
function pick(prompt, optTexts) {
  const pk = keyOf(prompt);
  if (MAP[pk]) { // prompt is a word -> match option-definition to the word's def(s)
    const dt = new Set(MAP[pk].flatMap(toks));
    let best = 0, bs = -1; optTexts.forEach((o, i) => { const sc = toks(o).filter((t) => dt.has(t)).length; if (sc > bs) { bs = sc; best = i; } });
    return { best, bs, dir: 'word->def' };
  }
  // prompt is a definition -> match option-word whose def overlaps the prompt
  const pt = new Set(toks(prompt));
  let best = 0, bs = -1; optTexts.forEach((o, i) => { const defs = MAP[keyOf(o)] || []; const sc = defs.flatMap(toks).filter((t) => pt.has(t)).length; if (sc > bs) { bs = sc; best = i; } });
  return { best, bs, dir: 'def->word' };
}
async function readback(tag) {
  const cp = (await db.collection('users').doc(S.uid).collection('class_progress').doc(CPID).get()).data() || {};
  const canon = (await db.collection('users').doc(S.uid).collection('list_progress').get()).size;
  let logTypes = {}; try { const sl = await db.collection('system_logs').where('userId', '==', S.uid).limit(60).get(); for (const d of sl.docs) { const t = d.data().type || d.data().event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, canonical_list_progress: canon, logTypes };
}
const dayOf = (b) => { const m = b.match(/day\s*(\d+)\b/i); return m ? +m[1] : null; };

const out = { round: 53, tag: S.tag, student: '도하율', uid: S.uid, class: S.sandboxClassId, seededCsd: S.seededCsd };
const b = await chromium.launch({ headless: true });
try {
  prog('reading pre-login state (Admin)');
  out.pre = await readback('pre-login');
  prog(`pre csd=${out.pre.csd} twi=${out.pre.twi} — launching browser`);
  const p = await b.newContext().then((c) => c.newPage());
  out.loggedIn = await login(p, S.email, F); await sleep(1500);
  prog(`loggedIn=${out.loggedIn} — going to dashboard`);
  await goDashboard(p); await sleep(3000);
  out.renderDay = dayOf((await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '));
  prog(`dashboard renderDay=${out.renderDay} — reaching new-word test via driveNewWordsToTest`);
  const inTest = async () => p.url().includes('/mcqtest/') || (await p.locator('button[class*="min-h-"]').count()) > 0;
  // reach the new-word test via the proven helper; fallback = study-through. Cap the helper so it can't hang.
  let r = await Promise.race([driveNewWordsToTest(p, F, 'nwdrv'), sleep(70000).then(() => ({ reached: false, capped: true }))]);
  out.reachedVia = 'driveNewWordsToTest'; out.reached = await inTest();
  prog(`driveNewWordsToTest done (helperReached=${r.reached} capped=${!!r.capped}); inTest=${out.reached}`);
  if (!out.reached) { // fallback: study through cards to Take Test
    prog('fallback: study-through the cards to Take Test');
    for (let k = 0; k < 95 && !(await inTest()); k++) {
      const take = p.getByRole('button', { name: /take test|start test/i }).first();
      if (await take.isVisible().catch(() => false)) { prog(`  study-through k=${k}: clicking Take/Start Test`); await take.click().catch(() => {}); await sleep(2500); continue; }
      const know = p.getByRole('button', { name: /i know this word|^next$|got it|^continue$|start studying/i }).first();
      if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(200); if (k % 10 === 0) prog(`  study-through k=${k} advancing cards`); continue; }
      await sleep(400);
    }
    out.reachedVia = 'study-through-fallback'; out.reached = await inTest();
    prog(`fallback done; inTest=${out.reached}`);
  }
  if (!out.reached) { out.why = 'new-word-test-not-reached'; prog('NOT REACHED — recording why + reading back'); }
  else {
    const q1w = (await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ');
    const o1 = p.locator('button[class*="min-h-"]'); const on = await o1.count(); const o1t = [];
    for (let i = 0; i < Math.min(on, 6); i++) o1t.push((await o1.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80));
    out.q1 = { heading: q1w, options: o1t, headingIsWord: !!MAP[keyOf(q1w)], pick: pick(q1w, o1t) };
    prog(`REACHED TEST. Q1 heading="${q1w.slice(0, 40)}" headingIsWord=${out.q1.headingIsWord} dir=${out.q1.pick.dir} opts=${on}`);
    let total = 30; const lbl = await p.getByText(/\d+ of \d+ answered/i).first().innerText({ timeout: 8000 }).catch(() => null);
    if (lbl) { const m = lbl.match(/(\d+) of (\d+)/); if (m) total = +m[2]; }
    let answered = 0, guard = 0, matched = 0;
    while (answered < total && guard < total + 10) {
      guard++;
      const word = await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '');
      const opts = p.locator('button[class*="min-h-"]'); const nn = await opts.count();
      if (!word || nn === 0) { await sleep(700); continue; }
      const texts = []; for (let i = 0; i < nn; i++) texts.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '));
      const { best, bs } = pick(word, texts); if (bs > 0) matched++;
      await opts.nth(best).click({ timeout: 3000 }).catch(() => {}); await sleep(430);
      const nl = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => null); const nm = nl && nl.match(/(\d+) of/);
      answered = nm ? +nm[1] : answered + 1;
      if (answered % 5 === 0 || guard <= 2) prog(`  answering: ${answered}/${total} (matched=${matched})`);
    }
    out.driven = { total, answered, matched };
    prog(`answered ${answered}/${total} matched=${matched} — submitting`);
    await p.getByRole('button', { name: /submit test/i }).first().click({ timeout: 5000 }).catch(() => {}); await sleep(900);
    const modal = p.getByText(/still have not answered|are you sure|아직.*답|제출하시겠/i).first();
    if (await modal.isVisible().catch(() => false)) await p.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last().click({ timeout: 4000 }).catch(() => {});
    prog('submitted — awaiting outcome (25s cap)');
    out.outcome = await Promise.race([
      p.getByText(/Failed to save|저장.*실패/i).first().waitFor({ timeout: 25000 }).then(() => 'save-error'),
      p.getByText(/retake required|불합격|not complete|이 날을 완료/i).first().waitFor({ timeout: 25000 }).then(() => 'retake-gate'),
      p.getByText(/%|score|correct|점|합격/i).first().waitFor({ timeout: 25000 }).then(() => 'results'),
    ]).catch(() => 'timeout');
    await sleep(2500);
    const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    out.scorePct = (body.match(/(\d{1,3})\s*%/) || [])[1] ? +(body.match(/(\d{1,3})\s*%/) || [])[1] : null;
    prog(`outcome=${out.outcome} scorePct=${out.scorePct}`);
  }
  await goDashboard(p); await sleep(3000);
  out.post = await readback('post-completion');
  out.finalRenderDay = dayOf((await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '));
  prog(`post csd=${out.post.csd} twi=${out.post.twi} finalRenderDay=${out.finalRenderDay}`);
  await b.close();
} catch (e) { out.error = String(e).slice(0, 300); prog('ERROR ' + out.error); await b.close().catch(() => {}); }
out.preCsd = out.pre?.csd;
out.csdAdvancedThisRun = (out.post?.csd ?? out.preCsd) > (out.preCsd ?? out.seededCsd); // delta from THIS run's pre
out.offByOneAlreadyReconciled = (out.preCsd ?? out.seededCsd) > out.seededCsd; // csd 6->7 happened on prior session-entry
out.verifiedHighScore = (out.scorePct ?? 0) >= 70 && out.outcome === 'results';
out.verdict = out.verifiedHighScore
  ? `PASS: reach+matcher FIX validated (verified high-score new-word completion ${out.scorePct}%); csd ${out.preCsd}->${out.post?.csd}`
  : (out.reached ? `PARTIAL: reached test; score=${out.scorePct} outcome=${out.outcome}` : 'BLOCKED: could not reach new-word test');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_newword_r53.json', JSON.stringify(out, null, 2));
prog(`DONE verdict=${out.verdict}`);
console.log(JSON.stringify({ reached: out.reached, reachedVia: out.reachedVia, q1dir: out.q1?.pick?.dir, q1headingIsWord: out.q1?.headingIsWord, driven: out.driven, outcome: out.outcome, scorePct: out.scorePct, seededCsd: out.seededCsd, postCsd: out.post?.csd, csdAdvanced: out.csdAdvanced, verdict: out.verdict }, null, 2));

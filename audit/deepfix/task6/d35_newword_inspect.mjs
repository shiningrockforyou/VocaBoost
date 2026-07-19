// R53: inspect the NEW-WORD MCQ structure (why matcher got 0/30). Read-only — reach the test, dump one question's
// heading + option texts, DO NOT submit. Student obo_JoJ2ch (도하율, class 25WTa2r14, list RmNNkuLPectBlBPiLbAJ).
import { readFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, enterSessionOnly, skipToTest, norm } = UI;
const { chromium } = await import('playwright');
const S = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster.find((r) => r.tag === 'obo_JoJ2ch');
const F = makeFindings ? makeFindings('NWINS') : { add: () => {} };
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
// sample the list map to classify prompt/options
const wsnap = await db.collection('lists').doc(S.listId).collection('words').get();
const MAP = {}; for (const d of wsnap.docs) { const w = d.data(); MAP[keyOf(w.word)] = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String); }
const out = { tag: S.tag, uid: S.uid, class: S.sandboxClassId };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then((c) => c.newPage());
  out.loggedIn = await login(p, S.email, F); await sleep(1500);
  await goDashboard(p); await sleep(3000);
  out.dashExcerpt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
  const ent = await enterSessionOnly(p, F, 'nwins'); out.entered = ent.entered;
  await sleep(800); await skipToTest(p, F, 'nwins'); await sleep(1500);
  out.url = p.url();
  out.headingL2 = (await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ');
  out.headingL1 = (await p.getByRole('heading', { level: 1 }).first().innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ');
  out.answeredLabel = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => '');
  const opts = p.locator('button[class*="min-h-"]'); const n = await opts.count(); out.optionCount = n; out.options = [];
  for (let i = 0; i < Math.min(n, 6); i++) out.options.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 100));
  // classify: is the heading a WORD (in MAP) or a DEFINITION? are options WORDS or DEFINITIONS?
  out.headingIsWord = !!MAP[keyOf(out.headingL2)];
  out.optionsAreWords = out.options.map((o) => !!MAP[keyOf(o)]);
  out.bodyTop = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
  await b.close(); // NO submit
} catch (e) { out.error = String(e).slice(0, 250); await b.close().catch(() => {}); }
console.log(JSON.stringify(out, null, 2));

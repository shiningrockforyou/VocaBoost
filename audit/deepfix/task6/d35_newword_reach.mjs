// R53: find the reliable path from new-word STUDY -> the MCQ test. Dump all buttons, dismiss the "Customize
// Flashcards" overlay, try Session-menu/Skip-to-Test, else study through cards, then dump the test question
// structure (heading vs options direction). Read-only-ish: reaches the test but DOES NOT submit.
import { readFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep, enterSessionOnly, norm } = UI;
const { chromium } = await import('playwright');
const S = JSON.parse(readFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/a2_clone_roster.json', 'utf8')).roster.find((r) => r.tag === 'obo_JoJ2ch');
const F = makeFindings ? makeFindings('NWRCH') : { add: () => {} };
const keyOf = (w) => norm(String(w || '').split('\n')[0].replace(/\s*\([^)]*\)\s*$/, ''));
const wsnap = await db.collection('lists').doc(S.listId).collection('words').get();
const MAP = {}; for (const d of wsnap.docs) { const w = d.data(); MAP[keyOf(w.word)] = [w.definition, ...(Array.isArray(w.definitions) ? w.definitions : [])].filter(Boolean).map(String); }
const listButtons = async (p) => {
  const bs = p.getByRole('button'); const n = await bs.count(); const arr = [];
  for (let i = 0; i < Math.min(n, 30); i++) { const t = (await bs.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim(); const vis = await bs.nth(i).isVisible().catch(() => false); if (t && vis) arr.push(t.slice(0, 40)); }
  return arr;
};
const out = { tag: S.tag };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then((c) => c.newPage());
  await login(p, S.email, F); await sleep(1500);
  await goDashboard(p); await sleep(3000);
  await enterSessionOnly(p, F, 'reach'); await sleep(1500);
  out.studyButtons = await listButtons(p);
  // dismiss customize overlay if present
  for (const re of [/got it|continue|start studying|start|done|close|next/i]) {
    const btn = p.getByRole('button', { name: re }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(1200); out.dismissed = re.source; break; }
  }
  // try Session menu -> Skip to Test
  const menu = p.getByRole('button', { name: 'Session menu' }).first();
  out.hasSessionMenu = await menu.isVisible().catch(() => false);
  if (out.hasSessionMenu) { await menu.click().catch(() => {}); await sleep(700); out.menuButtons = await listButtons(p);
    const skip = p.getByRole('button', { name: /skip to test/i }).first();
    if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await sleep(900);
      const conf = p.getByRole('button', { name: /skip|start test|begin|yes|confirm|continue/i }).last();
      if (await conf.isVisible().catch(() => false)) await conf.click().catch(() => {}); await sleep(2500);
    } else { await p.keyboard.press('Escape').catch(() => {}); }
  }
  // if still not at test, study through the cards (press "I know this word"/Next) up to 90x
  const inTest = async () => p.url().includes('/mcqtest/') || (await p.locator('button[class*="min-h-"]').count()) > 0;
  for (let k = 0; k < 90 && !(await inTest()); k++) {
    const take = p.getByRole('button', { name: /take test|start test/i }).first();
    if (await take.isVisible().catch(() => false)) { await take.click().catch(() => {}); await sleep(2500); continue; }
    const know = p.getByRole('button', { name: /i know this word|next|got it|continue/i }).first();
    if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(220); continue; }
    await sleep(400);
  }
  out.url = p.url(); out.reachedTest = await inTest();
  out.headingL2 = (await p.getByRole('heading', { level: 2 }).first().innerText({ timeout: 4000 }).catch(() => '')).replace(/\s+/g, ' ');
  out.answeredLabel = await p.getByText(/\d+ of \d+ answered/i).first().innerText().catch(() => '');
  const opts = p.locator('button[class*="min-h-"]'); const n = await opts.count(); out.optionCount = n; out.options = [];
  for (let i = 0; i < Math.min(n, 6); i++) out.options.push((await opts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90));
  out.headingIsWord = !!MAP[keyOf(out.headingL2)];
  out.optionsAreWords = out.options.map((o) => !!MAP[keyOf(o)]);
  out.direction = out.headingIsWord ? 'PROMPT=word, OPTIONS=definitions' : (out.optionsAreWords.some(Boolean) ? 'PROMPT=definition, OPTIONS=words' : 'unknown');
  await b.close(); // NO submit
} catch (e) { out.error = String(e).slice(0, 250); await b.close().catch(() => {}); }
console.log(JSON.stringify(out, null, 2));

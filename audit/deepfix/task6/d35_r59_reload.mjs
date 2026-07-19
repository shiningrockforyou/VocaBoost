/**
 * R59 — bare-reload LASTING check (fast), live prod, SANDBOX only (never 26SM). NO reviews, NO tests.
 * Per student: login -> direct-nav /session/<cls>/<list> -> poll <=8s past "Preparing your session..." -> read class_progress.
 *   lostsave_bc_d6: EXPECT csd 5->6 + twi 400->480 (valid day-6 anchor reconciles on THIS load; if csd stays 5 = orphaned anchor gap)
 *   4 throttle:     EXPECT reviewMode still FALSE (escape LASTING across fresh load), csd unchanged
 */
import { writeFileSync } from 'node:fs';
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings, sleep, BASE } = UI;
const { makeStepLogger } = await import('../../playwright/lsr_step_logger.mjs');
const { chromium } = await import('playwright');
const F = makeFindings ? makeFindings('R59') : { add: () => {} };
const RUN_START = new Date().toISOString();

const STUDENTS = [
  { tag: 'lostsave_bc_d6', email: 'lsr_a2_lostsavebcd6@vocaboost.test', uid: 'pzKKLxSYcchTKPJsLi9FxIlP9Xk1', cls: '25WTa2r1lostsavebcd6', list: 'RmNNkuLPectBlBPiLbAJ', expect: 'csd 5->6, twi 400->480 (anchor reconciles)' },
  { tag: 'thr_0DnzKs', email: 'lsr_a2_thr0DnzKs@vocaboost.test', uid: 'fAgr0aQxMZcJj4o3Q58uYCg9ccy1', cls: '25WTa2r1thr0DnzKs', list: 'RmNNkuLPectBlBPiLbAJ', expect: 'reviewMode false, csd 11' },
  { tag: 'thr_bFV18s', email: 'lsr_a2_thrbFV18s@vocaboost.test', uid: 'ITS6kfkXvlhJA3i8BlwEnFhNnuU2', cls: '25WTa2r1thrbFV18s', list: 'RmNNkuLPectBlBPiLbAJ', expect: 'reviewMode false, csd 7' },
  { tag: 'thr_yiVt86', email: 'lsr_a2_thryiVt86@vocaboost.test', uid: 'CdVCpFcFO6V1oYIM9gcjOjRt3n53', cls: '25WTa2r1thryiVt86', list: 'RmNNkuLPectBlBPiLbAJ', expect: 'reviewMode false, csd 17' },
  { tag: 'jisu_a1', email: 'lsr_a2_jisua1@vocaboost.test', uid: 'irZu1zzY3uOdxmcouI6TzWy5YJ83', cls: '25WTa2r1jisua1', list: 'dVliNv0p9jqZYp9rfLpN', expect: 'reviewMode false, csd 5' },
];
async function readback(uid, cls, list, tag) {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${cls}_${list}`).get()).data() || {};
  const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
  let logTypes = {}, fresh = 0; try { const sl = await db.collection('system_logs').where('userId', '==', uid).limit(60).get(); for (const d of sl.docs) { const dd = d.data(); const t = dd.type || dd.event || 'unknown'; logTypes[t] = (logTypes[t] || 0) + 1; const ts = dd.timestamp?._seconds || dd.createdAt?._seconds; if (ts && new Date(ts * 1000).toISOString() >= RUN_START) fresh++; } } catch {}
  return { tag, csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, reviewMode: cp.reviewMode ?? null, interv: cp.interventionLevel, canonical_list_progress: canon, logTypes, fresh };
}

const results = {};
const b = await chromium.launch({ headless: true });
for (const S of STUDENTS) {
  const slog = makeStepLogger(`r59-${S.tag}`); slog.heartbeat(15000);
  const r = { tag: S.tag, uid: S.uid, cls: S.cls, list: S.list, expect: S.expect, steps: slog.file };
  try {
    r.pre = await readback(S.uid, S.cls, S.list, 'pre'); slog.step('login', { email: S.email, preCsd: r.pre.csd, preTwi: r.pre.twi, preReviewMode: r.pre.reviewMode });
    const ctx = await b.newContext(); const p = await ctx.newPage();
    r.loggedIn = await login(p, S.email, F); await sleep(1500);
    const target = `${BASE}/session/${S.cls}/${S.list}`;
    await p.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // poll <=8s past "Preparing your session..."
    let settled = false; for (let w = 0; w < 8; w++) { await sleep(1000); const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); if (!/preparing your session/i.test(body)) { settled = true; break; } }
    await sleep(1500);
    const routedUrl = p.url(); const containsListId = routedUrl.includes(S.list);
    r.routedUrl = routedUrl; r.containsListId = containsListId; r.settled = settled;
    if (!containsListId && !/\/(mcqtest|typedtest)\//.test(routedUrl)) { slog.step('wrongListLoaded', { routedUrl, wanted: S.list }); r.wrongList = true; }
    await sleep(1500); // allow reconcile write to land
    r.post = await readback(S.uid, S.cls, S.list, 'post');
    slog.step('reload_readback', { tag: S.tag, csd: r.post.csd, twi: r.post.twi, reviewMode: r.post.reviewMode, routedUrl, containsListId, settled, fresh: r.post.fresh });
    await ctx.close();
  } catch (e) { r.error = String(e).slice(0, 250); slog.error('reload', e); }
  slog.done({ tag: S.tag, csd: r.post?.csd, twi: r.post?.twi, reviewMode: r.post?.reviewMode });
  // verdict per family
  if (S.tag === 'lostsave_bc_d6') { r.reconciled = r.post && r.post.csd === 6 && r.post.twi === 480; r.orphanedAnchor = r.post && r.post.csd === 5; r.verdict = r.reconciled ? 'PASS: valid anchor reconciled on load (csd 5->6, twi 400->480)' : (r.orphanedAnchor ? 'GAP: csd stayed 5 (orphaned anchor — manual pass needed)' : `OTHER csd=${r.post?.csd} twi=${r.post?.twi}`); }
  else { r.escapeLasting = r.post && r.post.reviewMode === false && r.post.csd === r.pre.csd; r.verdict = r.escapeLasting ? `PASS: escape LASTING (reviewMode false, csd ${r.post.csd} unchanged) across fresh load` : `REGRESSION? reviewMode=${r.post?.reviewMode} csd=${r.pre?.csd}->${r.post?.csd}`; }
  results[S.tag] = r;
  console.log(`[${S.tag}] pre{csd=${r.pre?.csd},twi=${r.pre?.twi},rm=${r.pre?.reviewMode}} -> post{csd=${r.post?.csd},twi=${r.post?.twi},rm=${r.post?.reviewMode}} | route=${r.containsListId} | ${r.verdict}`);
}
await b.close().catch(() => {});
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_r59_reload.json', JSON.stringify({ round: 59, runStart: RUN_START, results }, null, 2));
console.log('\nRUN_START=' + RUN_START + '  wrote deepfix_d35_tier3_r59_reload.json');

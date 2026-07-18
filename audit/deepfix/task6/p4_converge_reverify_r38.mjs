// Round 38 convergence LIVE re-probe (verify-only). Netlify build-stamp + functions version provenance.
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings } = UI;
const { chromium } = await import('playwright');
const PROJECT = 'vocaboost-879c2';
const BASE = 'https://vocaboostone.netlify.app';
const EXPECT = { buildSha: '6bffe1c', funcSha: '0ddbb34', epoch: 1784333239063 };
const F = makeFindings ? makeFindings('R38') : { add: () => {} };
const out = { runId: 'p4-converge-reverify-r38', at: new Date().toISOString(), expect: EXPECT };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(2500);
  const stamp = await p.evaluate(() => window.__VOCABOOST_BUILD__ || null).catch(() => null);
  out.netlify = { shortSha: stamp?.shortSha, dirty: stamp?.dirty, builtAt: stamp?.builtAt };
  // token for version callable
  await login(p, 'dup_repro_a@vocaboost.test', F);
  await p.waitForTimeout(1200);
  const token = await p.evaluate(async () => {
    const dbs = await indexedDB.databases?.() || [{ name: 'firebaseLocalStorageDb' }];
    for (const d of dbs) { if (!/firebaseLocalStorage/i.test(d.name || '')) continue;
      const t = await new Promise((res) => { const req = indexedDB.open(d.name); req.onsuccess = () => { try { const all = req.result.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll(); all.onsuccess = () => { for (const r of all.result || []) { const at = r?.value?.stsTokenManager?.accessToken; if (at) return res(at); } res(null); }; all.onerror = () => res(null); } catch { res(null); } }; req.onerror = () => res(null); });
      if (t) return t; }
    return null;
  }).catch(() => null);
  if (token) {
    const r = await fetch(`https://us-central1-${PROJECT}.cloudfunctions.net/version`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: {} }) });
    const body = await r.json().catch(() => null);
    const res = body?.result || {}; const flags = res.flags || {};
    const epoch = res.forcedPathwayGrandfatherEpochMs ?? res.forcedPathwayEpoch ?? flags.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS ?? null;
    out.functions = { shortSha: res.shortSha, FORCED_PATHWAY_ENABLED: flags.FORCED_PATHWAY_ENABLED, epoch, LIST_PROGRESS_CANONICAL: flags.LIST_PROGRESS_CANONICAL, ANCHOR_VALIDATION_ENFORCE: flags.ANCHOR_VALIDATION_ENFORCE, SERVER_COMPLETE_SESSION_ENABLED: flags.SERVER_COMPLETE_SESSION_ENABLED };
  }
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
out.checks = {
  netlify_sha: out.netlify?.shortSha === EXPECT.buildSha,
  netlify_clean: out.netlify?.dirty === false,
  func_sha: out.functions?.shortSha === EXPECT.funcSha,
  forced_pathway_enabled: out.functions?.FORCED_PATHWAY_ENABLED === true,
  epoch: Number(out.functions?.epoch) === EXPECT.epoch,
  canonical_false: out.functions?.LIST_PROGRESS_CANONICAL === false,
  enforce_false: out.functions?.ANCHOR_VALIDATION_ENFORCE === false,
};
out.ALL_VERIFIED = Object.values(out.checks).every(Boolean);
const { writeFileSync } = await import('node:fs');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_converge_reverify_r38.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n[r38-reverify] netlify=' + out.netlify?.shortSha + '/' + out.netlify?.dirty + ' func=' + out.functions?.shortSha + ' FP=' + out.functions?.FORCED_PATHWAY_ENABLED + ' epoch=' + out.functions?.epoch + ' CANON=' + out.functions?.LIST_PROGRESS_CANONICAL + ' ENFORCE=' + out.functions?.ANCHOR_VALIDATION_ENFORCE + ' | ALL_VERIFIED=' + out.ALL_VERIFIED);

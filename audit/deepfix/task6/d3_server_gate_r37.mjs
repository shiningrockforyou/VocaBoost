// P4/D3 FAIL-CLOSED server-state gate (MUST pass before any client push).
// (a) local verify_forced_pathway_epoch.mjs exit 0.
// (b) DEPLOYED version provenance: FORCED_PATHWAY_ENABLED===true AND FORCED_PATHWAY_GRANDFATHER_EPOCH_MS===1784333239063
//     AND deployed sha === expected (0ddbb34). ANY wrong/null/mismatch => GATE FAIL => do NOT push client.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const EXPECT_EPOCH = 1784333239063;
const EXPECT_SHA = '0ddbb34';
const PROJECT = 'vocaboost-879c2';
const out = { runId: 'd3-server-gate-r37', at: new Date().toISOString(), expectEpoch: EXPECT_EPOCH, expectSha: EXPECT_SHA };

// (a) local epoch verifier
try {
  execSync('node audit/deepfix/task6/verify_forced_pathway_epoch.mjs', { cwd: 'C:/Users/dmchw/vocaboost', stdio: 'pipe' });
  out.a_localEpochGate = { exit: 0, pass: true };
} catch (e) { out.a_localEpochGate = { exit: e.status ?? 1, pass: false, output: String(e.stdout || e.stderr || e).slice(0, 300) }; }

// (b) DEPLOYED version provenance (authenticated)
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings } = UI;
const { chromium } = await import('playwright');
const F = makeFindings ? makeFindings() : { add: () => {} };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  await login(p, 'dup_repro_a@vocaboost.test', F);
  await p.waitForTimeout(1200);
  const token = await p.evaluate(async () => {
    const dbs = await indexedDB.databases?.() || [{ name: 'firebaseLocalStorageDb' }];
    for (const d of dbs) { if (!/firebaseLocalStorage/i.test(d.name || '')) continue;
      const tok = await new Promise((res) => { const req = indexedDB.open(d.name); req.onsuccess = () => { try { const all = req.result.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll(); all.onsuccess = () => { for (const row of all.result || []) { const at = row?.value?.stsTokenManager?.accessToken; if (at) return res(at); } res(null); }; all.onerror = () => res(null); } catch { res(null); } }; req.onerror = () => res(null); });
      if (tok) return tok; }
    return null;
  }).catch(() => null);
  if (token) {
    const r = await fetch(`https://us-central1-${PROJECT}.cloudfunctions.net/version`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: {} }) });
    const body = await r.json().catch(() => null);
    const res = body?.result || {};
    const flags = res.flags || {};
    // epoch may be surfaced at result.forcedPathwayEpoch OR flags.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS OR result.epoch
    const deployedEpoch = res.forcedPathwayGrandfatherEpochMs ?? res.forcedPathwayEpoch ?? res.grandfatherEpochMs ?? flags.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS ?? res.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS ?? null;
    out.b_deployed = { sha: res.sha, shortSha: res.shortSha, forcedPathwayEnabled: flags.FORCED_PATHWAY_ENABLED, deployedEpoch, allResultKeys: Object.keys(res), rawResult: JSON.stringify(res).slice(0, 700) };
    out.b_checks = {
      forcedPathwayEnabled_true: flags.FORCED_PATHWAY_ENABLED === true,
      epoch_match: Number(deployedEpoch) === EXPECT_EPOCH,
      sha_match: res.shortSha === EXPECT_SHA,
    };
  } else out.b_deployed = { error: 'no token' };
  await b.close();
} catch (e) { out.b_error = String(e).slice(0, 200); await b.close().catch(() => {}); }

const bOk = out.b_checks && out.b_checks.forcedPathwayEnabled_true && out.b_checks.epoch_match && out.b_checks.sha_match;
out.GATE_PASS = !!(out.a_localEpochGate?.pass && bOk);
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d3_server_gate_r37.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n[d3-gate] (a) localEpoch=' + out.a_localEpochGate?.pass + ' | (b) FP_ENABLED=' + out.b_checks?.forcedPathwayEnabled_true + ' epoch=' + out.b_checks?.epoch_match + ' sha=' + out.b_checks?.sha_match + ' | ==> GATE_PASS=' + out.GATE_PASS);
process.exit(out.GATE_PASS ? 0 : 1);

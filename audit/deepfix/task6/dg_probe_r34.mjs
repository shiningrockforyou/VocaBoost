// DG-2 + DG-3 live deploy-provenance probes for cert-59df732-r34.
// DG-3: hosting build-stamp window.__VOCABOOST_BUILD__.shortSha == 59df732 (PR-1 client LIVE).
// DG-2: deployed `version` callable payload (which functions commit is live — expected PRE-PR-2 since
//       only the client shipped at 59df732; the functions deploy is P3-pending). Honest provenance snapshot.
const { chromium } = await import('playwright');
const PROJECT = 'vocaboost-879c2';
const BASE = 'https://vocaboostone.netlify.app';
const EXPECT_SHA = '59df732';
const out = { runId: 'cert-59df732-r34', probedAt: new Date().toISOString(), project: PROJECT, base: BASE, expectShortSha: EXPECT_SHA };

// ── DG-2: deployed exports.version (v2 onCall — direct callable-protocol POST) ──
const vurl = `https://us-central1-${PROJECT}.cloudfunctions.net/version`;
try {
  const r = await fetch(vurl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }) });
  const txt = await r.text();
  let body = null; try { body = JSON.parse(txt); } catch {}
  out.dg2 = { url: vurl, httpStatus: r.status, result: body?.result ?? null, raw: txt.slice(0, 300) };
  const v = body?.result || {};
  out.dg2.deployedShortSha = v.shortSha ?? null;
  out.dg2.deployedSha = v.sha ?? null;
  out.dg2.deployedDirty = v.dirty ?? null;
  out.dg2.builtAt = v.builtAt ?? null;
} catch (e) { out.dg2 = { url: vurl, error: String(e).slice(0, 200) }; }

// ── DG-3: hosting build-stamp ──
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(2500);
  const stamp = await p.evaluate(() => window.__VOCABOOST_BUILD__ || null).catch(() => null);
  out.dg3 = { buildStamp: stamp, shortSha: stamp?.shortSha ?? null, dirty: stamp?.dirty ?? null, builtAt: stamp?.builtAt ?? null };
  out.dg3.matches59df732 = stamp?.shortSha === EXPECT_SHA;
  await b.close();
} catch (e) { out.dg3 = { error: String(e).slice(0, 200) }; await b.close().catch(() => {}); }

out.summary = {
  DG3_hosting_is_59df732: out.dg3?.matches59df732 === true,
  DG2_deployed_functions_shortSha: out.dg2?.deployedShortSha ?? '(probe failed/needs-SDK)',
  DG2_note: (out.dg2?.deployedShortSha && out.dg2.deployedShortSha !== EXPECT_SHA)
    ? `deployed functions=${out.dg2.deployedShortSha} (PRE-PR-2 — functions deploy is P3-pending; client hosting=${EXPECT_SHA}). Expected divergence.`
    : (out.dg2?.deployedShortSha === EXPECT_SHA ? 'functions also at 59df732' : 'DG-2 callable probe inconclusive (see dg2.raw)'),
};
const fp = 'C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_dg_probes_cert-59df732-r34.json';
const { writeFileSync } = await import('node:fs');
writeFileSync(fp, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n[dg_probe] DG-3 hosting==59df732:', out.summary.DG3_hosting_is_59df732, '| DG-2 deployed functions:', out.summary.DG2_deployed_functions_shortSha);

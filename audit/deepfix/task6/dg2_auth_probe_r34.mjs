// DG-2 authenticated probe: sign in a sandbox user on prod, extract the Firebase ID token from the
// SDK's IndexedDB, and call the deployed `version` v2 onCall callable with a bearer token.
const UI = await import('../../playwright/lsr_ui.mjs'); // base-guard needs LSR_ALLOW_PROD_SMOKE for prod
const { login, makeFindings } = UI;
const { chromium } = await import('playwright');
const PROJECT = 'vocaboost-879c2';
const email = process.argv[2] || 'dup_repro_a@vocaboost.test'; // already-spent account; login-only (non-consuming), NEVER touch reserve-c
const F = makeFindings ? makeFindings() : { add: () => {} };
const out = { runId: 'cert-59df732-r34', probedAt: new Date().toISOString(), project: PROJECT, email };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  out.loggedIn = await login(p, email, F);
  await p.waitForTimeout(1500);
  // pull the ID token out of the modular SDK's IndexedDB (firebaseLocalStorage)
  const token = await p.evaluate(async () => {
    const dbs = await indexedDB.databases?.() || [{ name: 'firebaseLocalStorageDb' }];
    for (const d of dbs) {
      if (!/firebaseLocalStorage/i.test(d.name || '')) continue;
      const tok = await new Promise((res) => {
        const req = indexedDB.open(d.name);
        req.onsuccess = () => {
          try {
            const db = req.result; const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const store = tx.objectStore('firebaseLocalStorage'); const all = store.getAll();
            all.onsuccess = () => {
              for (const row of all.result || []) {
                const v = row?.value; const at = v?.stsTokenManager?.accessToken;
                if (at) return res(at);
              }
              res(null);
            };
            all.onerror = () => res(null);
          } catch { res(null); }
        };
        req.onerror = () => res(null);
      });
      if (tok) return tok;
    }
    return null;
  }).catch(() => null);
  out.gotToken = !!token;
  if (token) {
    const vurl = `https://us-central1-${PROJECT}.cloudfunctions.net/version`;
    const r = await fetch(vurl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: {} }) });
    const txt = await r.text(); let body = null; try { body = JSON.parse(txt); } catch {}
    const v = body?.result || {};
    out.dg2 = { httpStatus: r.status, deployedSha: v.sha ?? null, deployedShortSha: v.shortSha ?? null, deployedDirty: v.dirty ?? null, builtAt: v.builtAt ?? null, branch: v.branch ?? null, flags: v.flags ?? null, raw: txt.slice(0, 400) };
  }
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
out.summary = out.dg2?.deployedShortSha
  ? `DG-2 deployed functions=${out.dg2.deployedShortSha} (client hosting=59df732 via DG-3). ${out.dg2.deployedShortSha === '59df732' ? 'functions also 59df732' : 'functions PRE-PR-2 (P3 deploy pending) — expected divergence'}`
  : `DG-2 still inconclusive (gotToken=${out.gotToken}, status=${out.dg2?.httpStatus || 'n/a'})`;
const { writeFileSync } = await import('node:fs');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_dg2_auth_cert-59df732-r34.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

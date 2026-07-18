// D2/P3 post-deploy verification.
// (a) prod completeSession unauth probe → must NO LONGER return FAILED_PRECONDITION SERVER_COMPLETE_SESSION_ENABLED=false.
// (b) DG-2 version (authenticated) → the deployed FOUNDATION_FLAGS: assert the 7 true + the must-stay-false false.
const PROJECT = 'vocaboost-879c2';
const out = { runId: 'd2-verify-r35', probedAt: new Date().toISOString(), project: PROJECT };

// ── (a) completeSession unauth ──
try {
  const url = `https://us-central1-${PROJECT}.cloudfunctions.net/completeSession`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }) });
  const txt = await r.text();
  out.completeSession = { httpStatus: r.status, body: txt.slice(0, 300) };
  out.completeSession.stillDisarmed = /SERVER_COMPLETE_SESSION_ENABLED\s*=?\s*false|SERVER_COMPLETE_SESSION_ENABLED.*disabled/i.test(txt);
} catch (e) { out.completeSession = { error: String(e).slice(0, 200) }; }

// ── (b) version authenticated (token via browser login → IndexedDB) ──
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
    for (const d of dbs) {
      if (!/firebaseLocalStorage/i.test(d.name || '')) continue;
      const tok = await new Promise((res) => {
        const req = indexedDB.open(d.name);
        req.onsuccess = () => { try { const tx = req.result.transaction('firebaseLocalStorage', 'readonly'); const all = tx.objectStore('firebaseLocalStorage').getAll(); all.onsuccess = () => { for (const row of all.result || []) { const at = row?.value?.stsTokenManager?.accessToken; if (at) return res(at); } res(null); }; all.onerror = () => res(null); } catch { res(null); } };
        req.onerror = () => res(null);
      });
      if (tok) return tok;
    }
    return null;
  }).catch(() => null);
  if (token) {
    const r = await fetch(`https://us-central1-${PROJECT}.cloudfunctions.net/version`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: {} }) });
    const body = await r.json().catch(() => null);
    const flags = body?.result?.flags || {};
    out.deployed = { sha: body?.result?.sha, shortSha: body?.result?.shortSha, dirty: body?.result?.dirty, builtAt: body?.result?.builtAt, flags };
    const MUST_TRUE = ['SERVER_COMPLETE_SESSION_ENABLED', 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED', 'SERVER_RESET_PROGRESS_ENABLED', 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED', 'ANCHOR_VALIDATION_SHADOW', 'REVIEW_ENGAGEMENT_STAMP_ENABLED', 'RECOVERY_SCORE_CLAMP_ENABLED'];
    const MUST_FALSE = ['LIST_PROGRESS_CANONICAL', 'ANCHOR_VALIDATION_ENFORCE', 'CYCLING_ENABLED', 'FORCED_PATHWAY_ENABLED', 'SERVER_REVIEW_CHALLENGE_ENABLED', 'SERVER_OVERRIDE_ENABLED', 'TEACHER_IDS_WRITE_ENABLED', 'GRADE_TOKEN_ENFORCED', 'GRADE_TOKEN_MINT', 'TEACHER_PROVISIONING_ENABLED', 'TEACHER_CLAIM_ENABLED'];
    out.check = {
      trueMissing: MUST_TRUE.filter(k => flags[k] !== true),
      falseViolations: MUST_FALSE.filter(k => k in flags && flags[k] !== false),
    };
    out.check.posture_ok = out.check.trueMissing.length === 0 && out.check.falseViolations.length === 0;
    out.check.the7 = Object.fromEntries(MUST_TRUE.map(k => [k, flags[k]]));
    out.check.mustStayFalse = Object.fromEntries(MUST_FALSE.filter(k => k in flags).map(k => [k, flags[k]]));
  } else out.deployed = { error: 'no token' };
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }

const { writeFileSync } = await import('node:fs');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d2_verify_r35.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n[d2-verify] completeSession stillDisarmed=' + (out.completeSession?.stillDisarmed) + ' (status ' + (out.completeSession?.httpStatus) + ') | deployed sha=' + (out.deployed?.shortSha) + ' | POSTURE_OK=' + (out.check?.posture_ok));

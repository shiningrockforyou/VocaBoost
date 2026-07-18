// r33 preliminary (SAFE, non-consuming): read a dup_repro account's csd via Admin SDK + confirm live-prod
// login works (classifier check). Does NOT navigate into the session, so the one-shot re-entry state is preserved.
//   usage: node pr1_csd_probe_r33.mjs <email>
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const { db, uidByEmail } = FB;
const email = process.argv[2] || 'dup_repro_a@vocaboost.test';

// trigger lazy admin init before any admin.auth() use (r22 lesson)
const database = db();
const uid = await uidByEmail(email);
console.log('email=' + email + ' uid=' + uid);
if (!uid) { console.log('NO UID — account may not exist'); process.exit(2); }
const snap = await database.collection('users').doc(uid).collection('class_progress').get();
console.log('class_progress docs: ' + snap.size);
snap.docs.forEach(d => { const x = d.data(); console.log('  docId=' + d.id + ' csd=' + x.currentStudyDay + ' twi=' + x.totalWordsIntroduced + ' classId=' + (x.classId || '') + ' listId=' + (x.listId || '')); });

// quick live-prod login check (browser) — auth only, NO session navigation (non-consuming)
const UI = await import('../../playwright/lsr_ui.mjs');   // base guard: needs LSR_ALLOW_PROD_SMOKE for prod
const { BASE, login, makeFindings } = UI;
console.log('BASE=' + BASE);
const { chromium } = await import('playwright');
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  const F = makeFindings ? makeFindings() : { add: (...a) => console.log('F', ...a) };
  const ok = await login(p, email, F);
  console.log('LOGIN ok=' + ok + ' (auth only, no session nav — re-entry state preserved)');
  await b.close();
} catch (e) { console.log('LOGIN-ERR ' + String(e).slice(0, 160)); await b.close().catch(() => {}); }

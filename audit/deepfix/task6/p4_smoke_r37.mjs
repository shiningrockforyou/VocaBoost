// P4/D3 post-client-cutover smoke (SANDBOX, live 6bffe1c build). Focused core assertion:
// a NORMAL new-word completion routes through the SERVER (SERVER_PROGRESS_WRITE) and ADVANCES csd+twi,
// with NO list_progress canonical write (LIST_PROGRESS_CANONICAL=false). Fresh student+class = clean day-1.
// (Throttle-held / advanceForChallenge / dayGuardRejected assertions are covered by M-CALL flag-ON 21/0 +
//  deferred to the post-cutover full-UI audits — hard to seed on live prod in one pass.)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
const AUD = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'playwright');
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const { db, uidByEmail, readProgress } = FB;
const UI = await import('../../playwright/lsr_ui.mjs');
const { PASS, makeFindings, launch, newAuditPage, login, joinClass, selectList, goDashboard, driveNewWordsToTest, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, sleep } = UI;
const T = await import('../../playwright/lsr_teacher.mjs');
const { createClass, assignList, readJoinCode } = T;

const TEACHER = 'lsr_teacher_02@vocaboost.test';
const F = makeFindings ? makeFindings('P4SMK') : { add: (...a) => console.log('F', ...a) };
db(); // init admin before admin.auth()
const listsFile = JSON.parse(readFileSync(resolve(AUD, 'lsr_lists.json'), 'utf8'));
const chosen = (listsFile.teachers?.[TEACHER]?.lists || []).find((l) => l.tier === 'base');
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier };
const ts = Date.now();
const className = `25WT P4SMK ${ts}`;
const email = `lsr_p4smk_${ts}@vocaboost.test`;
const out = { runId: 'p4-smoke-r37', at: new Date().toISOString(), build: '6bffe1c', email, className, list: LIST };

const uid = (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid;
out.uid = uid;
const getDocId = (c, l) => `${c}_${l}`;

let classId;
const browser = await launch();
try {
  // provision (teacher)
  const { page: tp } = await newAuditPage(browser, F, 'teacher');
  await login(tp, TEACHER, F);
  await createClass(tp, className, F);
  await assignList(tp, className, LIST.title, { pace: 20, thr: 92, mode: 'typed', reviewMode: 'typed', testSize: 30, listId: LIST.id }, F);
  const code = await readJoinCode(tp, className, F);
  await tp.context().close().catch(() => {});
  const cq = await db().collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) throw new Error(`provision: ${cq.size} classes named ${className}`);
  classId = cq.docs[0].id; out.classId = classId; out.joinCode = code;

  // student drive
  const { page } = await newAuditPage(browser, F, 'p4smk');
  await login(page, email, F);
  await joinClass(page, code, className, F, 'p4smk');
  await selectList(page, LIST.title, F, 'p4smk').catch(() => {});
  await goDashboard(page).catch(() => {});
  out.pre = await readProgress(uid, classId, LIST.id);
  out.preListProgress = (await db().collection('users').doc(uid).collection('list_progress').get()).size;

  const r = await driveNewWordsToTest(page, F, 'p4smk');
  out.reachedTest = r.reached;
  if (r.reached) {
    let rows = []; try { rows = await readTestRows(page); } catch (e) { out.readErr = String(e).slice(0, 120); }
    out.testRows = rows.length; out.testKind = rows.length > 0 ? 'typed' : 'mcq?';
    if (rows.length > 0) {
      const answers = carefulAnswersFrom(rows, null);
      out.answered = answers.filter((a) => a).length;
      const obs = await fillSubmitAndObserve(page, answers, F, 'p4smk');
      out.submitOutcome = obs?.outcome || 'submitted';
    }
  }
  await page.context().close().catch(() => {});
} catch (e) { out.error = String(e).slice(0, 240); }
await browser.close().catch(() => {});

// post-state (wait for async server completion write)
if (classId) {
  for (let i = 0; i < 6; i++) { await sleep(4000); out.post = await readProgress(uid, classId, LIST.id); if (out.post.csd > (out.pre?.csd || 0)) break; }
  out.postListProgress = (await db().collection('users').doc(uid).collection('list_progress').get()).size;
  const cpDoc = (await db().collection('users').doc(uid).collection('class_progress').doc(getDocId(classId, LIST.id)).get()).data() || {};
  out.reviewModePresent = ('reviewMode' in cpDoc);
  out.reviewModeValue = cpDoc.reviewMode ?? null;
}

out.assert = {
  csd_advanced: (out.post?.csd || 0) > (out.pre?.csd || 0),
  twi_advanced: (out.post?.twi || 0) > (out.pre?.twi || 0),
  no_list_progress_write: out.postListProgress === 0,
  completed: out.submitOutcome === 'results',
};
out.SMOKE_PASS = out.assert.csd_advanced && out.assert.twi_advanced && out.assert.no_list_progress_write;
const { writeFileSync } = await import('node:fs');
writeFileSync(resolve(AUD, 'findings', 'deepfix_p4_smoke_r37.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\n[p4-smoke] reachedTest=' + out.reachedTest + ' outcome=' + out.submitOutcome + ' | csd ' + (out.pre?.csd) + '->' + (out.post?.csd) + ' twi ' + (out.pre?.twi) + '->' + (out.post?.twi) + ' listProgress=' + out.postListProgress + ' | SMOKE_PASS=' + out.SMOKE_PASS);

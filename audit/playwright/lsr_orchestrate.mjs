/**
 * LSR audit — multi-actor orchestration engine (teacher-concurrent scenarios).
 * SCENARIO_CATALOG_teacher_concurrent.md. UI-only interaction; Admin SDK read-only
 * pre/post snapshots ONLY (never during a browser scenario).
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_orchestrate.mjs <SCENARIO_ID> [--flag-on]
 *   ... TA1            run one scenario against the current (flag-off) deploy
 *   ... XC2 --flag-on  (Run S) requires a LIST_SCOPED_RECON=true build deployed
 *
 * A scenario declares actors {roleKey: email(role)}, an async pre(ctx) to build the
 * precondition (student study), and an async run(ctx) that interleaves actor actions
 * (use Promise.all for ‖ concurrency). ctx.<role> exposes bound UI helpers; ctx.F the
 * findings collector; ctx.uid(role) the actor uid (for post-verify labels only).
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import {
  AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard, switchClass,
  joinClass, driveNewWordsToTest, studyOneDay, shot,
} from './lsr_ui.mjs';
import * as T from './lsr_teacher.mjs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const ROSTER = JSON.parse(readFileSync(`${AUD}/lsr_accounts.json`, 'utf8')).accounts;
const STATE = JSON.parse(readFileSync(`${AUD}/lsr_prep_state.json`, 'utf8'));
const uidOf = (email) => ROSTER.find((a) => a.email === email)?.uid;
const CODE = (cn) => STATE.classes[cn]?.joinCode;
const em = (s) => (s.includes('@') ? s : `${s}@vocaboost.test`);
const TA = '25WT LSR-A TYPED', TB = '25WT LSR-B TYPED', MA = '25WT LSR-A MCQ', MB = '25WT LSR-B MCQ';
const TOP = 'LSR TOP Vocab (audit clone)', CORE = 'LSR CORE Vocab (audit clone)';
// Dedicated, ISOLATED teacher-wave classes (never the Run-L/S persona classes TA/TB) —
// destructive teacher moves (unassign/settings/remove) must not damage persona config.
const KA = '25WT LSR-TCH-A', KB = '25WT LSR-TCH-B', KC = '25WT LSR-TCH-C';

const scenarioId = process.argv[2];
const FLAG_ON = process.argv.includes('--flag-on');

// ---------------- scenario catalog (Wave T-1 P1) ----------------
const SCENARIOS = {
  // TA1 — list ADD flips students onto the new list [known-bug getPrimaryFocus]
  TA1: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s17' },
    pre: async (c) => { await c.S1.join(KA); await c.S1.study('s17-d1'); await c.S1.study('s17-d2'); },
    run: async (c) => {
      await c.S1.dash();
      const before = await c.S1.focusListText();
      // Teacher adds a SECOND list to the class while the student is on the dashboard.
      await c.T.assignList(KA, CORE, { pace: 80, thr: 92, mode: 'typed' });
      await c.S1.reload();
      const after = await c.S1.focusListText();
      const flipped = before && after && before !== after;
      c.F.add(flipped ? 'BUG' : 'observation', `[TA1] default focus list before="${before}" after teacher list-add="${after}" — ${flipped ? 'FLIPPED (getPrimaryFocus §7-H3 / 박시은 repro)' : 'unchanged (good)'}`);
      c.result.flipped = flipped; c.result.before = before; c.result.after = after;
    },
  },
  // TA2 — list UNASSIGN strands mid-progress students [known-bug nice-to-haves #1]
  TA2: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s18' },
    pre: async (c) => { await c.S1.join(KB); await c.S1.study('s18-d1'); },
    run: async (c) => {
      await c.S1.dash();
      await c.T.unassignList(KB, TOP);
      await c.S1.reload();
      const reach = await c.S1.canReachList(TOP);
      const stranded = !reach;
      c.F.add(stranded ? 'BUG' : 'observation', `[TA2] after teacher unassigned "${TOP}" from ${KB}, student can reach the list: ${reach} — ${stranded ? 'STRANDED (박한별 repro)' : 'still reachable'}`);
      c.result.stranded = stranded;
    },
  },
  // TA5 — teacher assigns the in-progress list to a SECOND class the student is in (Phase-1 core)
  TA5: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s19' },
    pre: async (c) => { await c.S1.join(KA); await c.S1.study('s19-d1'); await c.S1.study('s19-d2'); await c.S1.study('s19-d3'); await c.S1.join(KB); },
    run: async (c) => {
      // S1 has day-3 on TOP in KA; KB also assigns TOP (both share TOP already in our setup),
      // so this validates the teacher-driven dual-class entry. Student opens TOP under KB.
      await c.S1.switch(KB);
      await c.S1.dash();
      const t = await c.S1.openStudy();
      c.result.reachedUnderB = t;
      c.F.add('observation', `[TA5] student opened shared list under 2nd class KB (reached=${t}); flag-on must carry day-3 (verify post-snapshot)`);
    },
  },
  // TS1 — pace bump mid-list
  TS1: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s20' },
    pre: async (c) => { await c.S1.join(KA); for (let i = 1; i <= 3; i++) await c.S1.study(`s20-d${i}`); },
    run: async (c) => {
      await c.T.editSettings(KA, TOP, { pace: 120 });
      await c.S1.reload();
      const ok = await c.S1.study('s20-afterpace');
      c.F.add('observation', `[TS1] after pace 80→120, next day advanced=${ok} (verify twi jumped by ~120 from prior position, post-snapshot)`);
      c.result.advanced = ok;
    },
  },
  // TS2 — threshold RAISE strands a borderline passer (server pass must hold)
  TS2: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s21' },
    pre: async (c) => { await c.S1.join(KA); await c.S1.study('s21-d1'); },
    run: async (c) => {
      await c.T.editSettings(KA, TOP, { thr: 99 });
      await c.S1.reload();
      // Careful answers ~100% still clear 99, but the point is the ALREADY-passed day-1 must not un-pass.
      c.F.add('observation', `[TS2] threshold raised 92→99 after a passed day; verify day-1 stored passed=true is unchanged (post-snapshot)`);
    },
  },
  // TE1 — teacher removes a mid-session student
  TE1: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s22' },
    pre: async (c) => { await c.S1.join(KA); await c.S1.study('s22-d1'); },
    run: async (c) => {
      // S1 opens a fresh (day-2) session; teacher removes S1 mid-session.
      await c.S1.switch(KA);
      await c.S1.openStudy();
      await c.T.removeStudent(KA, 'LSR Student 22');
      await c.S1.reload();
      const enrolled = await c.S1.canReachList(TOP);
      c.F.add('observation', `[TE1] student removed mid-session; still sees the list=${enrolled}; verify progress NOT destroyed (removeStudentFromClass deletes no progress) post-snapshot`);
      c.result.stillEnrolled = enrolled;
    },
  },
  // TE2 — remove from A while dual-enrolled in B on the same list (safe-unenroll)
  TE2: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s23' },
    pre: async (c) => { await c.S1.join(KA); await c.S1.study('s23-d1'); await c.S1.join(KB); },
    run: async (c) => {
      await c.T.removeStudent(KA, 'LSR Student 23');
      await c.S1.reload();
      await c.S1.switch(KB);
      const t = await c.S1.openStudy();
      c.F.add('observation', `[TE2] removed from A while dual on shared list; opened under B (reached=${t}); shared progress must survive (flag-on carries it) — verify post-snapshot`);
      c.result.reachedUnderB = t;
    },
  },
  // MS1 — one unassign hits THREE simultaneous mid-session students
  MS1: {
    actors: { T: 'lsr_teacher_01', S1: 'lsr_s24', S2: 'lsr_s25', S3: 'lsr_s26' },
    pre: async (c) => { for (const s of ['S1', 'S2', 'S3']) { await c[s].join(KA); await c[s].study(`${s}-d1`); } },
    run: async (c) => {
      // All three open a session; teacher unassigns the list from under all of them at once.
      await Promise.all([c.S1.openStudy(), c.S2.openStudy(), c.S3.openStudy()]);
      await c.T.unassignList(KA, TOP);
      const reach = await Promise.all([c.S1.reloadReach(TOP), c.S2.reloadReach(TOP), c.S3.reloadReach(TOP)]);
      const anyCrash = c.F.raw.some((r) => r.kind === 'page-error');
      c.F.add('observation', `[MS1] unassign hit 3 live sessions; reachable after=[${reach}]; consistent degradation=${new Set(reach).size === 1}; pageError=${anyCrash}`);
      c.result.reach = reach;
    },
  },
  // AD2 — student self-reset while holding cross-class shared-list progress
  AD2: {
    actors: { S1: 'lsr_s27' },
    pre: async (c) => { await c.S1.join(KA); for (let i = 1; i <= 2; i++) await c.S1.study(`s27-d${i}`); await c.S1.join(KB); },
    run: async (c) => {
      // Reset progress via Settings while dual-enrolled on the shared list.
      const did = await c.S1.resetProgress();
      c.F.add('observation', `[AD2] self-reset invoked=${did}; verify whether cross-class shared study_states/attempts were nuked (§7-B6 concern) — post-snapshot`);
      c.result.reset = did;
    },
  },
  // XC3 — same-day concurrent completion, two classes (real §13 race)
  XC3: {
    actors: { S1a: 'lsr_s28', S1b: 'lsr_s28' }, // same student, two contexts (two devices)
    pre: async (c) => { await c.S1a.join(KA); await c.S1a.join(KB); },
    run: async (c) => {
      // Two contexts (same student) open the same uncompleted day under different classes,
      // then submit near-simultaneously.
      await c.S1a.switch(KA); await c.S1b.switch(KB);
      await Promise.all([c.S1a.study('s28-A'), c.S1b.study('s28-B')]);
      c.F.add('observation', `[XC3] same student completed the same day under A and B concurrently — verify no double-introduction / position jump / duplicate anchor (post-snapshot)`);
    },
  },
};

// ---------------- actor helper binding ----------------
function studentHelpers(page, F) {
  return {
    page,
    dash: () => goDashboard(page),
    reload: async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000); },
    join: (cn) => joinClass(page, CODE(cn), cn, F, 'stu'),
    study: (label) => studyOneDay(page, F, label),
    switch: (cn) => switchClass(page, cn, F),
    openStudy: () => driveNewWordsToTest(page, F, 'openStudy').then((r) => r.reached),
    focusListText: async () => { const el = page.getByText(/^List:/).first(); const t = await el.locator('xpath=..').innerText().catch(() => null); return t ? t.replace(/\s+/g,' ').trim() : null; },
    canReachList: async (title) => page.getByText(title, { exact: false }).first().isVisible().catch(() => false),
    reloadReach: async (title) => { await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500); return page.getByText(title, { exact: false }).first().isVisible().catch(() => false); },
    resetProgress: async () => {
      await page.goto(`${(await import('./lsr_ui.mjs')).BASE}/settings`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2000);
      const btn = page.getByRole('button', { name: /reset.*progress|progress.*reset/i }).first();
      if (!(await btn.isVisible().catch(() => false))) { F.add('selector-gap', '[AD2] reset-progress control not found on Settings'); await shot(page, 'lsr_ad2_settings'); return false; }
      await btn.click().catch(() => {}); await sleep(1000);
      await page.getByRole('button', { name: /confirm|yes|reset/i }).last().click().catch(() => {});
      await sleep(2500);
      return true;
    },
  };
}
function teacherHelpers(page, F) {
  return {
    page,
    assignList: (cn, list, s) => T.assignList(page, cn, list, s, F),
    unassignList: (cn, list) => T.unassignList(page, cn, list, F),
    editSettings: (cn, list, ch) => T.editSettings(page, cn, list, ch, F),
    removeStudent: (cn, name) => T.removeStudent(page, cn, name, F),
    openGradebook: (cn) => T.openGradebook(page, cn, F),
    createClass: (cn) => T.createClass(page, cn, F),
  };
}

// ---------------- runner ----------------
async function snapshot(actors) {
  const out = {};
  for (const email of new Set(Object.values(actors))) {
    const uid = uidOf(em(email));
    if (!uid) continue;
    const u = db.collection('users').doc(uid);
    const [cp, ss, lp] = await Promise.all([u.collection('class_progress').get(), u.collection('session_states').get(), u.collection('list_progress').get()]);
    const at = await db.collection('attempts').where('studentId', '==', uid).get();
    out[email] = {
      uid,
      class_progress: cp.docs.map((d) => ({ id: d.id, csd: d.data().currentStudyDay || 0, twi: d.data().totalWordsIntroduced || 0 })),
      session_states: ss.docs.length,
      list_progress: lp.docs.map((d) => ({ id: d.id, csd: d.data().currentStudyDay, twi: d.data().totalWordsIntroduced })),
      attempts: at.docs.map((d) => { const a = d.data(); return { sessionType: a.sessionType, studyDay: a.studyDay, passed: a.passed, score: a.score, listId: a.listId, classId: a.classId }; }),
    };
  }
  return out;
}

// Restore the isolated teacher-wave classes to clean state + clear actor students, so
// each scenario is independent (config provisioning — no browser open, policy-clean).
async function resetForScenario(actors) {
  const TOP = 'EQ0Dc9rb7gvoerflHlnz';
  const paces = { '25WT LSR-TCH-A': 80, '25WT LSR-TCH-B': 100, '25WT LSR-TCH-C': 60 };
  const sib = (await db.collection('classes').where('name', '==', '25WT LSR-B TYPED').get()).docs[0].data().assignments[TOP];
  for (const [name, pace] of Object.entries(paces)) {
    const q = await db.collection('classes').where('name', '==', name).get();
    if (q.empty) continue;
    await q.docs[0].ref.update({ assignments: { [TOP]: { ...sib, pace } }, studentIds: [], studentCount: 0 });
    const mem = await q.docs[0].ref.collection('members').get();
    for (const m of mem.docs) await m.ref.delete();
  }
  for (const email of new Set(Object.values(actors))) {
    if (/teacher/.test(email)) continue;
    const uid = uidOf(em(email)); if (!uid) continue;
    const u = db.collection('users').doc(uid);
    for (const c of ['class_progress', 'session_states', 'list_progress']) { const snap = await u.collection(c).get(); for (const d of snap.docs) await d.ref.delete(); }
    const at = await db.collection('attempts').where('studentId', '==', uid).get(); for (const d of at.docs) await d.ref.delete();
    const tchIds = {};
    for (const nm of Object.keys(paces)) { const cq = await db.collection('classes').where('name', '==', nm).get(); if (!cq.empty) tchIds[cq.docs[0].id] = true; }
    const ud = (await u.get()).data() || {}; const ec = ud.enrolledClasses || {};
    let changed = false; for (const cid of Object.keys(ec)) if (tchIds[cid]) { delete ec[cid]; changed = true; }
    if (changed) await u.update({ enrolledClasses: ec });
  }
}

const S = SCENARIOS[scenarioId];
if (!S) { console.error(`unknown scenario "${scenarioId}". Available: ${Object.keys(SCENARIOS).join(', ')}`); process.exit(2); }
if (FLAG_ON && !process.argv.includes('--flag-on')) { /* noop */ }

const F = makeFindings(`ORCH_${scenarioId}_${new Date().toISOString().slice(0, 10)}`);
const R = { scenario: scenarioId, flag: FLAG_ON ? 'ON' : 'OFF', startedAt: new Date().toISOString(), result: {} };

console.log(`\n▶ ${scenarioId} (flag ${R.flag}) — actors: ${JSON.stringify(S.actors)}`);
console.log('  · resetting isolated classes + actor students…');
await resetForScenario(S.actors);
const pre = await snapshot(S.actors);          // read-only, before any browser
const browser = await launch();
const ctx = { F, result: R.result, uid: (role) => uidOf(em(S.actors[role])) };
const pages = {};
for (const [role, email] of Object.entries(S.actors)) {
  const isTeacher = /teacher/.test(email);
  const { page } = await newAuditPage(browser, F, `${scenarioId}-${role}`);
  const ok = await login(page, em(email), F);
  if (!ok) console.log(`  ⚠ ${role} (${email}) login failed`);
  pages[role] = page;
  ctx[role] = isTeacher ? teacherHelpers(page, F) : studentHelpers(page, F);
}
try {
  if (S.pre) { console.log('  · building precondition…'); await S.pre(ctx); }
  console.log('  · running interleaved timeline…');
  await S.run(ctx);
} catch (e) {
  F.add('scenario-error', `${scenarioId} threw: ${String(e).slice(0, 200)}`);
  console.log('  ❌ scenario threw:', String(e).slice(0, 160));
}
await browser.close();
const post = await snapshot(S.actors);         // read-only, after all contexts closed
R.pre = pre; R.post = post; R.endedAt = new Date().toISOString();
writeFileSync(`${AUD}/findings/lsr_orch_${scenarioId}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(R, null, 2));
console.log(`\n${scenarioId} done. result=${JSON.stringify(R.result)}`);
console.log(`pre/post + findings written. Anomalies filed: ${F.raw.filter((r) => ['BUG', 'page-error', 'selector-gap', 'scenario-error'].includes(r.kind)).length}`);
console.log(`findings: ${F.path}`);
process.exit(0);

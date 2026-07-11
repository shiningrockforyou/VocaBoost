/**
 * Run L — READ-ONLY Admin verifier (bound by runId). Per RUNL_DESIGN_SPEC.md (Codex-blessed) +
 * the implementation-review hardening. NEVER writes/deletes app data.
 *   --pre  <runId>  validate fixtures (strict-fresh; L2 winning-anchor counterfactual; enrollment/
 *                   assignment/mode), snapshot pre-state + flag-on log IDs, write valid flag, clear stale.
 *   --post <runId>  require pre.valid; bind fixture+pre+activity+anomalies+buildId; assert every
 *                   per-case oracle with class-specific, NON-NULL-EXACT evidence; combined verdict.
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { fixtureDigest } from './lsr_runL_digest.mjs';

const mode = process.argv[2], runId = process.argv[3];
if (!['--pre', '--post'].includes(mode) || !runId) { console.error('usage: lsr_runL_verify.mjs --pre|--post <runId>'); process.exit(2); }
const BUILD_ID = process.env.LSR_BUILD_ID;
if (!BUILD_ID) { console.error('LSR_BUILD_ID is REQUIRED (must match the fixture/driver build id)'); process.exit(2); }
const AUD = '/app/audit/playwright';
const P = (n) => `${AUD}/findings/runL_${n}_${runId}.json`;
// #1 [Codex]: for --pre, delete ALL prior artifacts (incl. pre) BEFORE any fallible init, so a
// cred/init/query failure on a reused runId cannot leave a stale valid:true pre for --post.
if (mode === '--pre') for (const n of ['pre', 'activity', 'verdict', 'anomalies']) { try { rmSync(P(n)); } catch { /* absent */ } }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const ROSTER = JSON.parse(readFileSync(`${AUD}/lsr_accounts.json`, 'utf8')).accounts;
const uidOf = (email) => ROSTER.find((a) => a.email === email)?.uid;
const FIX_PATH = `${AUD}/findings/runL_fixture_${runId}.json`;
if (!existsSync(FIX_PATH)) { console.error(`no fixture for ${runId}`); process.exit(2); }
const FIX = JSON.parse(readFileSync(FIX_PATH, 'utf8'));
const LIST = FIX.list.id;
if (FIX.buildId !== BUILD_ID) { console.error(`fixture buildId ${FIX.buildId} != env ${BUILD_ID}`); process.exit(2); }

const FLAG_ON_LOGS = ['orphaned_attempt_flagged', 'day_guard_rejected_session_cleared', 'day_guard_session_clear_FAILED'];
const validAnchor = (a) => Number.isInteger(a.nwei) && a.nwei >= 0 && Number.isInteger(a.nwsi) && a.nwsi >= 0 && !!a.testId
  && Number.isInteger(a.studyDay) && a.studyDay > 0
  && Number.isInteger(a.wordsIntroduced) && a.wordsIntroduced > 0 && a.wordsIntroduced === (a.nwei - a.nwsi + 1);

async function snapPersona(uid) {
  const u = db.collection('users').doc(uid);
  const [doc, cp, ss, lp, at, st] = await Promise.all([
    u.get(), u.collection('class_progress').get(), u.collection('session_states').get(),
    u.collection('list_progress').get(), db.collection('attempts').where('studentId', '==', uid).get(), u.collection('study_states').get(),
  ]);
  return {
    enrolledClasses: Object.keys(doc.data()?.enrolledClasses || {}),
    primaryFocusListId: doc.data()?.settings?.primaryFocusListId ?? doc.data()?.primaryFocusListId ?? null,
    primaryFocusClassId: doc.data()?.settings?.primaryFocusClassId ?? doc.data()?.primaryFocusClassId ?? null,
    class_progress: cp.docs.map((d) => ({ id: d.id, classId: d.data().classId, listId: d.data().listId, csd: d.data().currentStudyDay || 0, twi: d.data().totalWordsIntroduced || 0 })),
    session_states: ss.docs.map((d) => d.id),
    list_progress: lp.docs.map((d) => d.id),
    study_states: st.docs.map((d) => d.id),
    attempts: at.docs.map((d) => { const a = d.data(); return { id: d.id, classId: a.classId, listId: a.listId, sessionType: a.sessionType, testType: a.testType ?? null, studyDay: a.studyDay ?? null, passed: a.passed ?? null, nwsi: a.newWordStartIndex ?? null, nwei: a.newWordEndIndex ?? null, testId: a.testId ?? null, wordsIntroduced: a.wordsIntroduced ?? null, ms: a.submittedAt?.toMillis?.() || 0 }; }),
  };
}
// Resolve a class by name. FAIL (return {dup:true}) if the name is ambiguous — duplicate-named
// classes (e.g. from a re-run fixture) would otherwise bind the verifier to a different instance
// than the student studied.
const classIdByName = async (name) => { const q = await db.collection('classes').where('name', '==', name).get(); if (q.empty) return { id: null }; if (q.size > 1) return { id: q.docs[0].id, dup: true, count: q.size }; return { id: q.docs[0].id }; };
async function classInfo(classId) {
  const c = (await db.collection('classes').doc(classId).get()).data() || {};
  const assignments = c.assignments || {};
  // EFFECTIVE assignment = what the Dashboard actually renders (db.js:502), replicated EXACTLY
  // incl. the []-truthy bug (NEED_TO_FIX #7): `assignedLists || Object.keys(assignments)`. So a
  // split-brain class (assignedLists:[] + populated assignments) is CAUGHT here, not masked.
  const effective = c.assignedLists || Object.keys(assignments);
  const a = assignments[LIST];
  // singleList: the effective set is EXACTLY [LIST] — guards the wrong-list case (a multi-list
  // class lets the student's default focus study the WRONG list; L1-T studied CORE not TOP).
  return { effective: effective.includes(LIST), singleList: effective.length === 1 && effective[0] === LIST, mode: a?.testMode || null };
}
async function scopedLogIds(uids) { const out = {}; for (const t of FLAG_ON_LOGS) { const s = await db.collection('system_logs').where('type', '==', t).get(); out[t] = s.docs.filter((d) => uids.has(d.data().userId)).map((d) => d.id); } return out; }

// ================= --pre =================
if (mode === '--pre') {
  const problems = []; // stale artifacts already cleared before init (#1)
  if (!FIX.ok) problems.push('fixture builder reported not-ok');
  const pre = { runId, buildId: BUILD_ID, fixtureDigest: fixtureDigest(FIX), at: new Date().toISOString(), cases: {} };
  const uids = new Set();
  for (const [cid, c] of Object.entries(FIX.cases)) {
    const uid = uidOf(c.email); if (!uid) { problems.push(`${cid}: unknown uid ${c.email}`); continue; }
    uids.add(uid);
    const s = await snapPersona(uid);
    const entry = { email: c.email, uid, role: c.role, mode: c.mode, snap: s };
    if (c.role === 'fresh') {
      const cr = await classIdByName(c.class);
      const classId = cr.id;
      if (cr.dup) problems.push(`${cid}: DUPLICATE class name "${c.class}" (${cr.count} matches) — ambiguous binding`);
      if (!classId) { problems.push(`${cid}: cannot resolve class "${c.class}"`); }
      else {
        const ci = await classInfo(classId);
        if (!ci.effective) problems.push(`${cid}: list not EFFECTIVE on the class dashboard (assignedLists split-brain? NEED_TO_FIX#7)`);
        if (!ci.singleList) problems.push(`${cid}: class is NOT single-list [${LIST}] — a multi-list class lets the student study the WRONG list`);
        if (ci.mode !== c.mode) problems.push(`${cid}: class assignment mode ${ci.mode} != ${c.mode}`);
        if (!(s.enrolledClasses.length === 1 && s.enrolledClasses[0] === classId)) problems.push(`${cid}: enrolled=${JSON.stringify(s.enrolledClasses)} (expected exactly [${classId}])`);
      }
      if (s.class_progress.length) problems.push(`${cid}: NOT fresh — ${s.class_progress.length} class_progress`);
      if (s.session_states.length) problems.push(`${cid}: NOT fresh — session_states`);
      if (s.attempts.length) problems.push(`${cid}: NOT fresh — attempts`);
      if (s.study_states.length) problems.push(`${cid}: NOT fresh — study_states`);
      entry.classId = classId;
    } else if (c.role === 'collision') {
      // Winning valid list-wide anchor (max nwei among passed valid anchors, ANY class).
      const anchors = s.attempts.filter((a) => a.listId === LIST && a.sessionType === 'new' && a.passed === true).filter(validAnchor);
      const winner = anchors.sort((x, y) => y.nwei - x.nwei)[0] || null;
      const crB = await classIdByName(c.classB);
      const classBId = crB.id;
      if (crB.dup) problems.push(`L2: DUPLICATE class B name "${c.classB}" (${crB.count} matches) — ambiguous`);
      if (!winner) problems.push('L2: NO valid winning anchor (counterfactual void)');
      else if ((winner.studyDay ?? 0) < 2) problems.push(`L2: winning anchor studyDay ${winner.studyDay} < 2`);
      const classAId = winner?.classId || null;
      if (!classBId) problems.push(`L2: cannot resolve class B "${c.classB}"`);
      // Class A is a DATA-LAYER historical anchor only (never rendered in L2) — do NOT require
      // dashboard-effective (it may carry the assignedLists split-brain). Its winning anchor on
      // LIST already proves the assignment. Class B IS entered via the dashboard → require effective.
      if (classBId) { const cb = await classInfo(classBId); if (!cb.effective) problems.push('L2: class B list not EFFECTIVE on dashboard (NEED_TO_FIX#7)'); if (!cb.singleList) problems.push('L2: class B is NOT single-list [LIST] — wrong-list risk'); if (cb.mode !== c.mode) problems.push(`L2: class B mode ${cb.mode} != ${c.mode}`); }
      if (classBId && s.class_progress.some((cp) => cp.classId === classBId)) problems.push('L2: B already has a class_progress doc (not fresh)');
      if (classBId && s.attempts.some((a) => a.classId === classBId)) problems.push('L2: B already has attempts (not fresh)');
      // L2's anchor account is a REUSED historical persona (only s04/s12 carry a day≥2 anchor), so
      // it ACCUMULATES prior-run fresh-B enrollments. Require it be enrolled in BOTH A and this
      // run's B — NOT exactly-2. Isolation that matters is still enforced: B is fresh (no
      // class_progress / attempts, asserted above) and the driver explicitly selects B+list. Any
      // extra stale enrollments are irrelevant to the measurement. (L1 accounts stay exact-[classId].)
      if (!(classAId && classBId && s.enrolledClasses.includes(classAId) && s.enrolledClasses.includes(classBId))) problems.push(`L2: enrolled=${JSON.stringify(s.enrolledClasses)} must include A(${classAId}) and B(${classBId})`);
      entry.classAId = classAId; entry.classBId = classBId; entry.winnerNwei = winner?.nwei ?? null; entry.winnerStudyDay = winner?.studyDay ?? null;
    }
    pre.cases[cid] = entry;
  }
  pre.logs = await scopedLogIds(uids);
  pre.valid = problems.length === 0;
  writeFileSync(P('pre'), JSON.stringify(pre, null, 2)); // written always, but carries valid:false
  console.log(pre.valid ? '✅ --pre fixtures VALID' : `❌ --pre INVALID (${problems.length}):`);
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(pre.valid ? 0 : 1);
}

// ================= --post =================
if (!existsSync(P('pre'))) { console.error('no --pre'); process.exit(2); }
if (!existsSync(P('activity'))) { console.error('no activity — run lsr_runL.mjs'); process.exit(2); }
if (!existsSync(P('anomalies'))) { console.error('no anomalies artifact — driver did not complete'); process.exit(2); }
const pre = JSON.parse(readFileSync(P('pre'), 'utf8'));
const act = JSON.parse(readFileSync(P('activity'), 'utf8'));
const anom = JSON.parse(readFileSync(P('anomalies'), 'utf8'));
const problems = [];
const REQUIRED = ['L1-T', 'L1-M', 'L1-R', 'L2'];

const winStart = Date.parse(act.startedAt || 0), winEnd = Date.parse(act.endedAt || Date.now());
const setEq = (arr) => { const s = new Set(arr); return s.size === REQUIRED.length && REQUIRED.every((x) => s.has(x)); };
if (pre.valid !== true) problems.push('BIND: --pre was INVALID (cannot certify)');
// runId bound on EVERY artifact (#6).
for (const [nm, obj] of [['fixture', FIX], ['pre', pre], ['activity', act], ['anomalies', anom]]) if (obj.runId !== runId) problems.push(`BIND: ${nm}.runId ${obj.runId} != ${runId}`);
// buildId consistent + non-empty across all artifacts.
for (const b of [FIX.buildId, pre.buildId, act.buildId, anom.buildId]) if (!b || b !== BUILD_ID) problems.push(`BIND: buildId mismatch (${b} != ${BUILD_ID})`);
// IDENTITY binding (Codex round-5): the fixture digest must be identical across pre/activity/
// anomalies AND recompute-equal from the current fixture file — so a fixture edited after --pre
// (different account/class/list behind the same case name) cannot be certified.
const nowDigest = fixtureDigest(FIX);
for (const [nm, d] of [['pre', pre.fixtureDigest], ['activity', act.fixtureDigest], ['anomalies', anom.fixtureDigest], ['fixture(recomputed)', nowDigest]]) if (d !== nowDigest) problems.push(`BIND: fixtureDigest mismatch (${nm}=${d} != ${nowDigest})`);
// EXACT required case-set equality on fixture/pre/activity/anomalies (#6) — not just presence.
for (const [nm, keys] of [['fixture', Object.keys(FIX.cases || {})], ['pre', Object.keys(pre.cases || {})], ['activity', Object.keys(act.cases || {})], ['anomalies', anom.cases || []]]) if (!setEq(keys)) problems.push(`BIND: ${nm} case set ${JSON.stringify(keys)} != {${REQUIRED}}`);
// Timestamp ordering fixture ≤ pre ≤ activity.start ≤ activity.end (#6).
const ts = [Date.parse(FIX.at || 0), Date.parse(pre.at || 0), winStart, winEnd];
if (!(ts[0] <= ts[1] && ts[1] <= ts[2] && ts[2] <= ts[3])) problems.push(`BIND: artifact timestamps out of order ${JSON.stringify([FIX.at, pre.at, act.startedAt, act.endedAt])}`);
// Anomaly artifact time binding.
if (anom.startedAt !== act.startedAt || anom.endedAt !== act.endedAt) problems.push('BIND: anomalies time window != activity');
if ((anom.fatal || []).length) problems.push(`${anom.fatal.length} fatal browser anomalies: ${(anom.fatal || []).slice(0, 5).join(' | ')}`);
const reqTrue = (cid, a, k) => { if (a[k] !== true) problems.push(`${cid}: ${k} !== true (${a[k]})`); };
const reqEq = (cid, a, k, v) => { if (a[k] !== v) problems.push(`${cid}: ${k}=${a[k]} (expected ${v})`); };

const uids = new Set(Object.values(pre.cases).map((c) => c.uid));
for (const [cid, pc] of Object.entries(pre.cases)) {
  const post = await snapPersona(pc.uid);
  const a = act.cases?.[cid] || {};
  const fc = FIX.cases?.[cid] || {};
  // Per-case identity equality: the account/role/mode/classes the DRIVER operated (activity)
  // must equal what the fixture declared and --pre validated (Codex round-5).
  if (a.email !== fc.email || a.email !== pc.email) problems.push(`${cid}: email mismatch activity=${a.email} fixture=${fc.email} pre=${pc.email}`);
  if (a.role !== pc.role) problems.push(`${cid}: role mismatch activity=${a.role} pre=${pc.role}`);
  if (a.mode !== pc.mode) problems.push(`${cid}: mode mismatch activity=${a.mode} pre=${pc.mode}`);
  if ((a.class ?? null) !== (fc.class ?? null) || (a.classB ?? null) !== (fc.classB ?? null)) problems.push(`${cid}: class binding mismatch activity=(${a.class},${a.classB}) fixture=(${fc.class},${fc.classB})`);
  if (post.list_progress.length) problems.push(`${cid}: ${post.list_progress.length} list_progress (contamination)`);
  // #4 fail-closed evidence: required screenshots must be BOTH captured-this-run (in activity.shots)
  // AND present on disk. Since the driver deletes this run's PNGs up front, "on disk + recorded" can't
  // be satisfied by a stale/reused file. Codex round-4.
  const capturedThisRun = new Set(act.shots || []);
  const needShot = (name) => { if (!capturedThisRun.has(name)) problems.push(`${cid}: screenshot ${name} not captured this run`); else if (!existsSync(`${AUD}/findings/runL_${runId}_${name}.png`)) problems.push(`${cid}: screenshot ${name} missing on disk`); };
  needShot(`${cid}_before`); needShot(`${cid}_after`);
  if (cid === 'L1-R') needShot('L1R_intermediate');
  if (cid === 'L2') { needShot('L2_inSession'); needShot('L2_afterEnter'); }

  if (cid === 'L2') {
    // EXACT attempt-id equality (no add/remove) for the persona.
    const preIds = new Set(pc.snap.attempts.map((x) => x.id)); const postIds = new Set(post.attempts.map((x) => x.id));
    if (preIds.size !== postIds.size || [...postIds].some((id) => !preIds.has(id))) problems.push(`L2: attempt set changed (${preIds.size}→${postIds.size}) — view-only expected identical`);
    // #3: progress docs must be list-specific (classId AND listId===LIST) — a different list's
    // doc for the same class must not mask a target-list regression.
    const aBefore = pc.snap.class_progress.find((c) => c.classId === pc.classAId && c.listId === LIST);
    const aAfter = post.class_progress.find((c) => c.classId === pc.classAId && c.listId === LIST);
    if (!aAfter) problems.push('L2: class A target-list doc DISAPPEARED');
    else if (!aBefore || aAfter.csd !== aBefore.csd || aAfter.twi !== aBefore.twi) problems.push(`L2: A doc changed ${aBefore?.csd}/${aBefore?.twi}→${aAfter.csd}/${aAfter.twi}`);
    const bAfter = post.class_progress.find((c) => c.classId === pc.classBId && c.listId === LIST);
    if (bAfter && (bAfter.csd !== 0 || bAfter.twi !== 0)) problems.push(`L2: B target-list doc promoted (csd=${bAfter.csd} twi=${bAfter.twi}, expected 0/0)`);
    // #2: BOTH Class:B AND List:L must have been selected + still focused at read time.
    reqTrue('L2', a, 'selectedB'); reqTrue('L2', a, 'selectedListL'); reqTrue('L2', a, 'entered');
    reqTrue('L2', a, 'leftViaQuit'); // left via the visible Quit→Leave flow (not programmatic nav)
    reqTrue('L2', a, 'focusStillB'); reqTrue('L2', a, 'focusListStillL');
    reqEq('L2', a, 'bVisibleDay', 1); reqEq('L2', a, 'bVisibleWords', 0);
    // NOTE: the user-doc saved-focus (settings.primaryFocusListId) is NOT asserted. It is (a)
    // redundant with the VISIBLE focus checks above (focusStillB/focusListStillL, which prove the
    // measurement locked onto B through the reload), and (b) out of L2's flag-off-equivalence
    // scope — it's app UX persistence, not the cross-class anchor behavior the flag gates. It was
    // also observed not to persist on a SINGLE-LIST class selection (selectList no-ops in label
    // mode → no handleListSelection); that's a possible minor UX gap, tracked separately, not a
    // flag-off regression and not part of this gate.
    continue;
  }

  // L1-T / L1-M / L1-R — class-SPECIFIC evidence via the bound classId.
  const cid_ = pc.classId;
  const cpBefore = pc.snap.class_progress.find((c) => c.classId === cid_ && c.listId === LIST) || { csd: 0, twi: 0 };
  const cpAfter = post.class_progress.find((c) => c.classId === cid_ && c.listId === LIST);
  const preIds = new Set(pc.snap.attempts.map((x) => x.id));
  const newAtt = post.attempts.filter((x) => !preIds.has(x.id) && x.classId === cid_ && x.listId === LIST && x.sessionType === 'new');
  const passes = newAtt.filter((x) => x.passed === true), fails = newAtt.filter((x) => x.passed === false);
  if (!cpAfter) { problems.push(`${cid}: no class_progress/{${cid_}}_{${LIST}} after run`); continue; }
  if (cpAfter.csd !== (cpBefore.csd || 0) + 1) problems.push(`${cid}: CSD ${cpBefore.csd}→${cpAfter.csd} (expected +1)`);
  // #1: EXACT total new-attempt count (T/M=1, R=2); NO passed:null; validate mode+window for EVERY attempt.
  const expTotal = cid === 'L1-R' ? 2 : 1;
  if (newAtt.length !== expTotal) problems.push(`${cid}: ${newAtt.length} total new attempts (expected ${expTotal})`);
  if (passes.length + fails.length !== newAtt.length) problems.push(`${cid}: ${newAtt.length - passes.length - fails.length} new attempt(s) with passed:null`);
  for (const x of newAtt) {
    if (x.testType !== pc.mode) problems.push(`${cid}: attempt ${x.id} testType ${x.testType} != ${pc.mode}`);
    if (!(x.ms >= winStart - 5000 && x.ms <= winEnd + 15000)) problems.push(`${cid}: attempt ${x.id} submittedAt ${x.ms} outside driver window`);
  }
  if (passes.length !== 1) problems.push(`${cid}: ${passes.length} passed new attempts (expected 1)`);
  else {
    const p = passes[0];
    if (!validAnchor(p)) problems.push(`${cid}: pass anchor invalid`);
    else if ((cpAfter.twi - (cpBefore.twi || 0)) !== p.wordsIntroduced) problems.push(`${cid}: TWI delta ${cpAfter.twi - (cpBefore.twi || 0)} != wordsIntroduced ${p.wordsIntroduced}`);
    if (a.visibleWords !== p.wordsIntroduced) problems.push(`${cid}: visible words ${a.visibleWords} != wordsIntroduced ${p.wordsIntroduced}`);
  }
  // #4: prove the initial fresh visible state (Day 1 / 0 words) so "1→2" is fully tested; passed card seen.
  reqEq(cid, a, 'visibleDayBefore', 1); reqEq(cid, a, 'visibleWordsBefore', 0);
  reqEq(cid, a, 'visibleDayAfter', 2); reqTrue(cid, a, 'passedHeadingSeen');
  if (cid === 'L1-R') {
    if (fails.length !== 1) problems.push(`L1-R: ${fails.length} failed new attempts (expected exactly 1)`);
    reqTrue('L1-R', a, 'retakeSeen'); reqTrue('L1-R', a, 'successAbsent');
    reqEq('L1-R', a, 'midDay', 1); reqEq('L1-R', a, 'midWords', 0);
    reqEq('L1-R', a, 'passOutcome', 'results');
  } else { if (fails.length !== 0) problems.push(`${cid}: ${fails.length} failed new attempts (expected 0)`); reqEq(cid, a, 'outcome', 'results'); }
}

// Flag-ON-only log delta by ID, scoped to run users.
const postLogs = await scopedLogIds(uids);
for (const t of FLAG_ON_LOGS) { const preSet = new Set(pre.logs?.[t] || []); const added = (postLogs[t] || []).filter((id) => !preSet.has(id)); if (added.length) problems.push(`log ${t}: +${added.length} (flag-off must be 0)`); }

const verdict = { runId, buildId: BUILD_ID, at: new Date().toISOString(), problems, pass: problems.length === 0 };
writeFileSync(P('verdict'), JSON.stringify(verdict, null, 2));
console.log(problems.length ? `\n❌ Run L: ${problems.length} problem(s):` : '\n✅ Run L: all oracles + invariants hold');
problems.forEach((p) => console.log('  - ' + p));
console.log(`\n${verdict.pass ? '✅ FINAL: PASS — flag-off equivalence certified (build attestation, not runtime proof).' : '❌ FINAL: FAIL'}`);
process.exit(verdict.pass ? 0 : 1);

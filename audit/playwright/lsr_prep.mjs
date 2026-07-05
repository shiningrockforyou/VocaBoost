/**
 * B_LIST_PROGRESS_PHASE1_UI — PREP phase (FULL-UI, post-login; policy-bound).
 * Provisioned accounts exist (lsr_provision.mjs — the only Admin step). Everything here
 * is visible-UI: teacher creates/configures classes, students join by code, persona
 * histories are built by actually studying. Staged + resumable; state in
 * lsr_prep_state.json; selector gaps become findings and abort the stage for tuning.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_prep.mjs --teacher   (stage 1)
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_prep.mjs --joins     (stage 2)
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_prep.mjs --days      (stage 3)
 *
 * Classes (26SM-mirror settings; 25WT namespace):
 *   25WT LSR-A TYPED  pace 80  thr 92  typed  list "LSR TOP Vocab (audit clone)"
 *   25WT LSR-B TYPED  pace 100 thr 92  typed  same list
 *   25WT LSR-A MCQ    pace 80  thr 92  MCQ    list "LSR CORE Vocab (audit clone)"
 *   25WT LSR-B MCQ    pace 100 thr 92  MCQ    same list
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard, switchClass,
  driveNewWordsToTest, driveReviewToTest, readTestRows, carefulAnswers,
  fillSubmitAndObserve, shot, dismissModal, joinClass, openStudyThenLeave,
  driveMcq,
} from './lsr_ui.mjs';

const F = makeFindings(`PREP_${new Date().toISOString().slice(0, 10)}`);
const statePath = `${AUD}/lsr_prep_state.json`;
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { classes: {}, joins: {}, days: {} };
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

const CLASSES = [
  { name: '25WT LSR-A TYPED', pace: 80, thr: 92, mode: 'typed', list: 'LSR TOP Vocab (audit clone)' },
  { name: '25WT LSR-B TYPED', pace: 100, thr: 92, mode: 'typed', list: 'LSR TOP Vocab (audit clone)' },
  { name: '25WT LSR-A MCQ', pace: 80, thr: 92, mode: 'mcq', list: 'LSR TOP Vocab (audit clone)' },
  { name: '25WT LSR-B MCQ', pace: 100, thr: 92, mode: 'mcq', list: 'LSR TOP Vocab (audit clone)' },
];
// Per-persona SCENARIO timelines — interleave join / study / switch / abandon in the
// order real students (and the CS-log incidents) actually did them: study in A FIRST,
// then get enrolled in B mid-course. Enrollment-after-progress is what creates the
// bug precondition (fresh Day-0 B doc beside real A progress). Actions:
//   {a:'join',  c}          enter join code for class c (realistic mid-run enrollment)
//   {a:'study', c}          switch to c + complete one full day (new + review)
//   {a:'switch',c}          switch active class mid-flow (no study) — organic navigation
//   {a:'abandon',c}         open c's session to the test then LEAVE unsubmitted (distracted)
// The AUDIT (Run L/S) performs the OBSERVED transition; PREP only builds the precondition.
const TA = '25WT LSR-A TYPED', TB = '25WT LSR-B TYPED', MA = '25WT LSR-A MCQ', MB = '25WT LSR-B MCQ';
const SCENARIOS = {
  // P-L1 smoke: fresh single class, no pre-study (L1 studies live).
  lsr_s01: [{ a: 'join', c: TA }],
  // P-L1-MCQ: fresh single MCQ class.
  lsr_s02: [{ a: 'join', c: MA }],
  // P-L2 (flag-off dual regression): 2 days in A, THEN join B mid-course (dual, uncarried).
  lsr_s03: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // P-MOVE (이주헌): 3 days in A, THEN moved to B mid-course. Run S1 enters B → carry-forward.
  lsr_s04: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // P-DUAL (박주하): 1 day A → join B mid-course → switch back to A (interleaved switching).
  lsr_s05: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }, { a: 'switch', c: TA }],
  // P-JOIN: both joined fresh (same uncompleted Day-1 in A and B). Run S3 = two-context join guard.
  lsr_s06: [{ a: 'join', c: TA }, { a: 'join', c: TB }],
  // P-STALE-T: 1 day A (so a Day-2 review exists) → join B. Run S9-T two-context stale submit.
  lsr_s07: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // P-STALE-M (MCQ): same shape on the MCQ pair.
  lsr_s08: [{ a: 'join', c: MA }, { a: 'study', c: MA }, { a: 'join', c: MB }],
  // S10 stale-display: 1 day A → join B.
  lsr_s09: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // mobile repeat (S1-like move).
  lsr_s10: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // mobile MCQ stale repeat.
  lsr_s11: [{ a: 'join', c: MA }, { a: 'study', c: MA }, { a: 'join', c: MB }],
  // dark repeat (move).
  lsr_s12: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }],
  // P-PAIR (mixed history): 3 days A (with a distracted mid-session abandon), join B
  // mid-course, 2 days B → genuinely mixed dual-class anchor/review lineage.
  lsr_s13: [{ a: 'join', c: TA }, { a: 'study', c: TA }, { a: 'study', c: TA }, { a: 'abandon', c: TA }, { a: 'study', c: TA }, { a: 'join', c: TB }, { a: 'study', c: TB }, { a: 'study', c: TB }],
};
const CODE = (cn) => state.classes[cn]?.joinCode;
const em = (s) => `${s}@vocaboost.test`;
const LISTS = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8')).lists;
const listIdFor = (title) => LISTS.find((l) => l.title === title)?.newId;
const MODE_VALUE = (m) => (m === 'mcq' ? 'mcq' : 'typed'); // option labels: mcq="Multiple Choice Only", typed="Written Only" (ClassDetail.jsx:1102-1104)

// Drive the visible test in whichever mode the class uses (typed inputs vs MCQ radios).
async function driveTest(page, label) {
  const typed = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false);
  if (typed) {
    const rows = await readTestRows(page);
    return fillSubmitAndObserve(page, carefulAnswers(rows), F, label);
  }
  return driveMcq(page, F, label);
}

async function completeOneDay(page, label) {
  const t = await driveNewWordsToTest(page, F, label);
  if (!t.reached) return false;
  const { outcome } = await driveTest(page, label);
  // The day only advances if the new-word test PASSED. A retake-gate or a fail verdict
  // means careful answers fell below threshold — do NOT mark the day built.
  if (outcome === 'retake-gate') { F.add('prep-issue', `[${label}] new-word test did NOT pass (retake gate) — day not built`); return false; }
  if (outcome !== 'results') { F.add('prep-issue', `[${label}] new-words outcome=${outcome}`); return false; }
  const failVerdict = await page.getByText(/retake required|불합격|not complete/i).first().isVisible().catch(() => false);
  if (failVerdict) { F.add('prep-issue', `[${label}] new-word results show fail — careful answers below threshold`); return false; }
  await goDashboard(page);
  const rv = await driveReviewToTest(page, F, `${label}-rev`);
  if (rv.reached) await driveTest(page, `${label}-rev`);
  await goDashboard(page);
  return true;
}

const browser = await launch();

// Open a class's detail page from the dashboard and run the assign/settings/code steps.
// Every click is guarded; disabled states become findings, never crashes.
async function openClassDetail(page, c, F) {
  const slug = c.name.replace(/\W+/g, '_');
  await page.getByText(c.name, { exact: true }).first().click({ timeout: 8000 }).catch(() => F.add('selector-gap', `open ${c.name} detail failed`));
  await sleep(2000);
  await shot(page, `lsr_prep_detail_${slug}`);
  const assigned = await page.getByText(c.list).first().isVisible().catch(() => false);
  if (!assigned) {
    const opener = page.getByRole('button', { name: /assign list|add list/i }).first();
    if (await opener.isVisible().catch(() => false)) {
      const enabled = await opener.isEnabled().catch(() => false);
      if (enabled) { await opener.click({ timeout: 5000 }).catch(() => {}); await sleep(1200); }
      // Picker (modal or inline): select the clone by title, then confirm via the
      // now-enabled Assign button.
      await page.getByText(c.list).first().click({ timeout: 5000 }).catch(() => F.add('selector-gap', `list "${c.list}" not selectable in picker`));
      await sleep(600);
      const confirm = page.getByRole('button', { name: /^assign( list)?$|^add$|^confirm$/i }).last();
      if (await confirm.isEnabled().catch(() => false)) await confirm.click({ timeout: 5000 }).catch(() => F.add('selector-gap', 'assign confirm click failed'));
      else F.add('selector-gap', `assign confirm still disabled for ${c.name} — selection not registering`);
      await sleep(1500);
    } else F.add('selector-gap', `Assign-List control not found on ${c.name}`);
  }
  await shot(page, `lsr_prep_assigned_${slug}`);
  // Settings (pace / threshold / test mode) — capture-first; exact form selectors tuned
  // from these screenshots on the next pass.
  const settingsBtn = page.getByRole('button', { name: /settings|edit|configure/i }).first();
  if (await settingsBtn.isVisible().catch(() => false)) {
    await settingsBtn.click({ timeout: 5000 }).catch(() => {});
    await sleep(1200);
    await shot(page, `lsr_prep_settings_${slug}`);
    await dismissModal(page);
  }
  F.step('prep-teacher', `SETTINGS for ${c.name}: target pace=${c.pace} thr=${c.thr} mode=${c.mode} — verify from screenshot`);
  const codeText = await page.getByText(/join code|class code|초대 코드/i).first().innerText().catch(() => null);
  const code = codeText ? (codeText.match(/[A-Z0-9]{4,10}/) || [null])[0] : null;
  if (code) { state.classes[c.name] = { ...(state.classes[c.name] || {}), joinCode: code, target: c }; save(); }
  console.log(`${code ? '✅' : '⚠'} ${c.name} joinCode=${code}`);
  await goDashboard(page);
}

// ---------- STAGE 1: teacher creates + configures classes, records join codes ----------
if (process.argv.includes('--teacher')) {
  const { page } = await newAuditPage(browser, F, 'prep-teacher');
  const ok = await login(page, em('lsr_teacher_01'), F);
  if (!ok) { console.error('teacher login failed'); process.exit(1); }
  await shot(page, 'lsr_prep_teacher_dashboard');
  for (const c of CLASSES) {
    if (state.classes[c.name]?.joinCode) { console.log(`↺ ${c.name} already created`); continue; }
    F.step('prep-teacher', `create class ${c.name}`);
    await goDashboard(page);
    // UI idempotency: if the class card already exists, skip creation (a crashed prior
    // run may have created it without recording state).
    const already = await page.getByText(c.name, { exact: true }).first().isVisible().catch(() => false);
    if (already) { console.log(`↺ ${c.name} exists on dashboard — skipping create`); }
    const createBtn = page.getByRole('button', { name: /create new class|new class|\+ class/i }).first();
    if (already) { await openClassDetail(page, c, F); state.classes[c.name] = state.classes[c.name] || { joinCode: null, configured: false, target: c }; save(); continue; }
    if (!(await createBtn.isVisible().catch(() => false))) { F.add('selector-gap', 'Create-New-Class button not found — tune stage 1'); await shot(page, 'lsr_prep_gap_createclass'); break; }
    await createBtn.click(); await sleep(1200);
    const nameBox = page.getByLabel(/class name|name/i).or(page.getByPlaceholder(/class name|name/i)).first();
    await nameBox.fill(c.name).catch(async () => { F.add('selector-gap', 'class-name input not found'); await shot(page, 'lsr_prep_gap_classname'); });
    // Modal submit is EXACTLY "Create Class" (screenshot-verified 2026-07-05) — the
    // loose /create/i matched the background "Create New Class" button and got eaten
    // by the backdrop.
    const submitBtn = page.getByRole('button', { name: /^create class$/i }).first();
    await submitBtn.click().catch(() => F.add('selector-gap', 'Create-Class modal submit not found'));
    // Wait for the modal to actually close (name input gone) before proceeding.
    await nameBox.waitFor({ state: 'hidden', timeout: 8000 }).catch(async () => {
      F.add('selector-gap', 'create-class modal did not close after submit');
      await shot(page, `lsr_prep_modal_stuck_${c.name.replace(/\W+/g, '_')}`);
    });
    await sleep(1500);
    await shot(page, `lsr_prep_created_${c.name.replace(/\W+/g, '_')}`);
    await openClassDetail(page, c, F);
    state.classes[c.name] = state.classes[c.name] || { joinCode: null, configured: false, target: c };
    save();
  }
  await page.context().close();
  console.log('STAGE 1 state:', JSON.stringify(state.classes, null, 1));
  console.log('If selector-gaps were filed: review lsr_prep_*.png, tune, re-run --teacher (idempotent).');
}

// ---------- STAGE 1b: configure classes (list correction + settings form) --------------
// Settings modal labels verified from lsr_prep_settings_*.png (2026-07-05): "Daily New
// Words (Pace)", "Test Options (choices per question)", "Test Mode" <select>, "Study
// Days Per Week", "Pass Threshold (%)", "New Word Test Size", "Review Test Mode".
if (process.argv.includes('--configure')) {
  const { page } = await newAuditPage(browser, F, 'prep-configure');
  const ok = await login(page, em('lsr_teacher_01'), F);
  if (!ok) { console.error('teacher login failed'); process.exit(1); }
  for (const c of CLASSES) {
    const slug = c.name.replace(/\W+/g, '_');
    await goDashboard(page);
    await page.getByText(c.name, { exact: true }).first().click({ timeout: 8000 }).catch(() => F.add('selector-gap', `configure: open ${c.name} failed`));
    await sleep(2000);
    // (a) Wrong list assigned? (MCQ pair must carry the CORE clone, not TOP)
    const wrong = CLASSES.map((x) => x.list).find((l) => l !== c.list);
    const wrongVisible = await page.getByText(wrong, { exact: true }).first().isVisible().catch(() => false);
    if (wrongVisible) {
      F.step('prep-configure', `${c.name}: unassign wrong list "${wrong}"`);
      // Try the visible remove/unassign control on or near the list card; capture if absent.
      const removeBtn = page.getByRole('button', { name: /unassign|remove|delete|manage lists/i }).first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click({ timeout: 5000 }).catch(() => {});
        await sleep(1000);
        await shot(page, `lsr_prep_cfg_manage_${slug}`);
        const unassign = page.getByRole('button', { name: /unassign|remove/i }).first();
        await unassign.click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${c.name}: unassign control not found — see screenshot`));
        await sleep(800);
        // native confirm() dialog is auto-accepted below via page.on('dialog') hook
        await dismissModal(page);
      } else { F.add('selector-gap', `${c.name}: no manage/unassign control visible`); await shot(page, `lsr_prep_cfg_nounassign_${slug}`); }
      await sleep(1500);
    }
    // (b) Correct list assigned? The Assign-a-List modal is a FULL FORM (screenshot-
    // verified): List <select> + pace/testOptions/testMode/threshold/testSize/reviewMode
    // + "Assign List" submit — settings are set AT ASSIGN TIME.
    let assigned = await page.getByText(c.list, { exact: true }).first().isVisible().catch(() => false);
    if (!assigned) {
      F.step('prep-configure', `${c.name}: assign "${c.list}" via assign-modal form`);
      const opener = page.getByRole('button', { name: /assign list|add list/i }).last();
      await opener.click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${c.name}: Assign List opener failed`));
      await sleep(1200);
      const listSel = page.getByLabel(/^list$/i).first();
      const targetId = listIdFor(c.list);
      let picked = await listSel.selectOption({ value: targetId }).then(() => true).catch(() => false);
      if (!picked) picked = await listSel.selectOption({ label: new RegExp(c.list.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).then(() => true).catch(() => false);
      if (!picked) { F.add('selector-gap', `${c.name}: List select could not pick "${c.list}" (value=${targetId})`); await shot(page, `lsr_prep_cfg_picker_${slug}`); }
      // Fill the whole form here (settings live in this modal).
      await page.getByLabel(/daily new words/i).first().fill(String(c.pace)).catch(() => {});
      await page.getByLabel(/^test mode$/i).first().selectOption({ value: MODE_VALUE(c.mode) }).catch(() => F.add('selector-gap', `${c.name}: assign-modal Test Mode select failed`));
      await page.getByLabel(/pass threshold/i).first().fill(String(c.thr)).catch(() => {});
      await page.getByLabel(/new word test size/i).first().fill('30').catch(() => {});
      await page.getByLabel(/review test mode/i).first().selectOption({ value: MODE_VALUE(c.mode) }).catch(() => {});
      await shot(page, `lsr_prep_cfg_assignform_${slug}`);
      const confirm = page.getByRole('button', { name: /^assign( list)?$/i }).last();
      if (await confirm.isEnabled().catch(() => false)) await confirm.click().catch(() => {});
      await sleep(2000);
      assigned = await page.getByText(c.list, { exact: true }).first().isVisible().catch(() => false);
    }
    // (c) Open the assigned list's settings modal (generic settings selector reached it
    // on the discovery run) and (d) fill the verified labels.
    const settingsBtn = page.getByRole('button', { name: /settings|edit|configure/i }).first();
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click({ timeout: 5000 }).catch(() => {});
      await sleep(1200);
      const pace = page.getByLabel(/daily new words/i).first();
      if (await pace.isVisible().catch(() => false)) {
        await pace.fill(String(c.pace));
        await page.getByLabel(/^test mode$/i).first().selectOption({ value: MODE_VALUE(c.mode) })
          .catch(() => F.add('selector-gap', `${c.name}: Test Mode select (value=${MODE_VALUE(c.mode)}) failed`));
        await page.getByLabel(/pass threshold/i).first().fill(String(c.thr)).catch(() => {});
        await page.getByLabel(/new word test size/i).first().fill('30').catch(() => {});
        await page.getByLabel(/review test mode/i).first().selectOption({ value: MODE_VALUE(c.mode) }).catch(() => {});
        await shot(page, `lsr_prep_cfg_filled_${slug}`);
        const saveBtn = page.getByRole('button', { name: /^save( settings| changes)?$/i }).last();
        await saveBtn.click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${c.name}: settings Save not found`));
        await sleep(1500);
      } else { F.add('selector-gap', `${c.name}: settings modal did not open / pace label missing`); await shot(page, `lsr_prep_cfg_nosettings_${slug}`); }
      await dismissModal(page);
    } else F.add('selector-gap', `${c.name}: settings button not visible`);
    await shot(page, `lsr_prep_cfg_done_${slug}`);
    console.log(`configured pass done: ${c.name} (assigned=${assigned})`);
  }
  await page.context().close();
  console.log('STAGE 1b complete — verify with read-only class check.');
}

// ---------- STAGE 1c: --fixmode — set Test Mode on the assigned-list settings modal -----
// The settings/assign modals wrap each <select> in a <label> whose accessible name
// includes helper text, so getByLabel(/^test mode$/) fails. Locate selects by their
// OPTION content instead (filter hasText) — visible, policy-clean. Option values:
// mcq="Multiple Choice Only", typed="Written Only", both="Both" (ClassDetail.jsx:1102).
if (process.argv.includes('--fixmode')) {
  const { page } = await newAuditPage(browser, F, 'prep-fixmode');
  if (!(await login(page, em('lsr_teacher_01'), F))) { console.error('teacher login failed'); process.exit(1); }
  for (const c of CLASSES) {
    const slug = c.name.replace(/\W+/g, '_');
    await goDashboard(page);
    await page.getByText(c.name, { exact: true }).first().click({ timeout: 8000 }).catch(() => F.add('selector-gap', `fixmode: open ${c.name} failed`));
    await sleep(2000);
    // Open the assigned list's settings (the pencil/settings/edit control on the list card).
    const settingsBtn = page.getByRole('button', { name: /settings|edit|configure|manage lists/i }).first();
    if (!(await settingsBtn.isVisible().catch(() => false))) { F.add('selector-gap', `${c.name}: no settings control`); await shot(page, `lsr_prep_fixmode_nobtn_${slug}`); continue; }
    await settingsBtn.click({ timeout: 5000 }).catch(() => {});
    await sleep(1500);
    // Test Mode select = the first <select> whose options include "Written Only".
    const modeSelects = page.locator('select').filter({ hasText: 'Written Only' });
    const nSel = await modeSelects.count();
    if (nSel === 0) { F.add('selector-gap', `${c.name}: no mode <select> found in modal`); await shot(page, `lsr_prep_fixmode_nomodal_${slug}`); await dismissModal(page); continue; }
    const val = MODE_VALUE(c.mode);
    await modeSelects.nth(0).selectOption({ value: val }).catch(() => F.add('selector-gap', `${c.name}: Test Mode selectOption(${val}) failed`));
    if (nSel > 1) await modeSelects.nth(1).selectOption({ value: val }).catch(() => {}); // Review Test Mode
    // Re-confirm the numeric fields (unanchored getByLabel works for these).
    await page.getByLabel(/daily new words/i).first().fill(String(c.pace)).catch(() => {});
    await page.getByLabel(/pass threshold/i).first().fill(String(c.thr)).catch(() => {});
    await shot(page, `lsr_prep_fixmode_filled_${slug}`);
    const saveBtn = page.getByRole('button', { name: /^(save( settings| changes)?|assign( list)?|update)$/i }).last();
    await saveBtn.click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${c.name}: save/assign button not found`));
    await sleep(2000);
    await dismissModal(page);
    console.log(`fixmode done: ${c.name} → ${val}`);
  }
  await page.context().close();
  console.log('STAGE 1c complete — verify read-only.');
}

// ---------- STAGE 2: --scenarios — realistic interleaved persona timelines --------------
if (process.argv.includes('--scenarios')) {
  const onlyStu = process.argv.filter((a) => /^lsr_s\d+$/.test(a));
  for (const [stu, actions] of Object.entries(SCENARIOS)) {
    if (onlyStu.length && !onlyStu.includes(stu)) continue;
    state.scenarios = state.scenarios || {};
    const doneSteps = state.scenarios[stu] || 0;
    if (doneSteps >= actions.length) { console.log(`↺ ${stu} scenario complete (${doneSteps}/${actions.length})`); continue; }
    const { page } = await newAuditPage(browser, F, `scn-${stu}`);
    const ok = await login(page, em(stu), F);
    if (!ok) { await page.context().close(); continue; }
    let step = doneSteps;
    for (; step < actions.length; step++) {
      const act = actions[step];
      const tag = `${stu}#${step + 1}/${actions.length}:${act.a}(${act.c || ''})`;
      let good = true;
      try {
        if (act.a === 'join') good = await joinClass(page, CODE(act.c), act.c, F, stu) || true; // unverified-join is not fatal (may already be member)
        else if (act.a === 'switch') good = await switchClass(page, act.c, F);
        else if (act.a === 'abandon') good = await openStudyThenLeave(page, act.c, F, stu);
        else if (act.a === 'study') {
          await switchClass(page, act.c, F);
          good = await completeOneDay(page, `${stu}-${act.c.replace(/\W+/g, '')}-s${step + 1}`);
        }
      } catch (e) { good = false; F.add('prep-issue', `${tag} threw: ${String(e).slice(0, 120)}`); }
      if (!good && act.a === 'study') { F.add('prep-issue', `${tag} FAILED — scenario paused (resumable)`); break; }
      state.scenarios[stu] = step + 1; save();
      console.log(`${good ? '✅' : '⚠'} ${tag}`);
    }
    await page.context().close();
  }
  console.log('SCENARIO progress:', JSON.stringify(state.scenarios, null, 1));
}
await browser.close();
console.log(`\nfindings: ${F.path}`);
process.exit(0);

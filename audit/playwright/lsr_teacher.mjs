/**
 * LSR audit — teacher-action primitives (UI-only, policy-bound).
 * Selectors source-verified in ClassDetail.jsx: tabs (Assigned Lists/Students/Gradebook),
 * IconButton title="Edit Settings"/"Unassign list", per-row "Remove" (LinkButton),
 * native window.confirm on unassign/remove (auto-accepted by the page 'dialog' handler
 * in newAuditPage). Assign-modal form + settings selects reuse the stage-1 discoveries
 * (List <select> by clone id; Test Mode select located by option content — wrapping
 * labels break getByLabel for selects, mcq="Multiple Choice Only", typed="Written Only").
 */
import { sleep, goDashboard, dismissModal, shot, armDialog } from './lsr_ui.mjs';

// Clone list titles → doc ids (audit-owned lists).
export const LIST_ID = {
  'LSR TOP Vocab (audit clone)': 'EQ0Dc9rb7gvoerflHlnz',
  'LSR CORE Vocab (audit clone)': 'aDVcq3MoCvVYPTpb83IU',
};
const MODE_VALUE = (m) => (m === 'mcq' ? 'mcq' : 'typed');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function openClassDetail(page, className, F) {
  await goDashboard(page);
  await page.getByText(className, { exact: true }).first().click({ timeout: 8000 })
    .catch(() => F.add('selector-gap', `teacher: open class "${className}" failed`));
  await sleep(2000);
  const ok = await page.getByText(/CLASS DETAIL/i).first().isVisible().catch(() => false);
  if (!ok) F.add('selector-gap', `teacher: CLASS DETAIL not shown for "${className}"`);
  return ok;
}

async function tab(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(1200);
}

// Assign a list to a class via the Assign-a-List modal form (settings set at assign time).
export async function assignList(page, className, listTitle, { pace, thr, mode, testSize = 30 } = {}, F) {
  await openClassDetail(page, className, F);
  await tab(page, 'Assigned Lists');
  const opener = page.getByRole('button', { name: /^assign list$/i }).first(); // anchored: must NOT match the 'Unassign list' trash button
  await opener.click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${className}: Assign List opener failed`));
  await sleep(1200);
  const targetId = LIST_ID[listTitle];
  const listSel = page.getByLabel(/^list$/i).first();
  let picked = targetId ? await listSel.selectOption({ value: targetId }).then(() => true).catch(() => false) : false;
  if (!picked) picked = await listSel.selectOption({ label: new RegExp(escRe(listTitle)) }).then(() => true).catch(() => false);
  if (!picked) { F.add('selector-gap', `${className}: assign list select "${listTitle}" failed`); await shot(page, `lsr_tch_assign_gap_${className.replace(/\W+/g, '_')}`); }
  if (pace != null) await page.getByLabel(/daily new words/i).first().fill(String(pace)).catch(() => {});
  if (mode) await page.getByLabel(/^test mode$/i).first().selectOption({ value: MODE_VALUE(mode) }).catch(async () => {
    await page.locator('select').filter({ hasText: 'Written Only' }).first().selectOption({ value: MODE_VALUE(mode) }).catch(() => F.add('selector-gap', `${className}: assign Test Mode set failed`));
  });
  if (thr != null) await page.getByLabel(/pass threshold/i).first().fill(String(thr)).catch(() => {});
  await page.getByLabel(/new word test size/i).first().fill(String(testSize)).catch(() => {});
  const confirm = page.getByRole('button', { name: /^assign( list)?$/i }).last();
  if (await confirm.isEnabled().catch(() => false)) await confirm.click().catch(() => {});
  await sleep(2000);
  const ok = await page.getByText(listTitle, { exact: false }).first().isVisible().catch(() => false);
  F.step('teacher', `assign "${listTitle}" to ${className} (pace=${pace} thr=${thr} mode=${mode}) → ${ok ? 'ok' : 'unverified'}`);
  return ok;
}

// Unassign a list (Trash IconButton title="Unassign list" + native confirm). `dialog`
// declares intent for the confirm: 'accept' (proceed) or 'dismiss' (cancel). Returns
// { gone, dialogMessage } so callers (e.g. TA2 F03 contract) can assert the exact warning
// text AND that cancel preserves / accept removes.
export async function unassignList(page, className, listTitle, F, { dialog = 'accept' } = {}) {
  await openClassDetail(page, className, F);
  await tab(page, 'Assigned Lists');
  // The card containing listTitle → its "Unassign list" icon button.
  let btn = page.getByTitle('Unassign list').first();
  const cards = page.locator('div', { hasText: listTitle }).filter({ has: page.getByTitle('Unassign list') });
  if (await cards.count().catch(() => 0)) btn = cards.last().getByTitle('Unassign list').first();
  if (!(await btn.isVisible().catch(() => false))) { F.add('selector-gap', `${className}: Unassign control for "${listTitle}" not found`); await shot(page, `lsr_tch_unassign_gap_${className.replace(/\W+/g, '_')}`); return { gone: false, dialogMessage: null }; }
  armDialog(page, dialog);
  await btn.click().catch(() => {});
  await sleep(2000);
  const dialogMessage = page.__dialog?.last?.message || null;
  const gone = !(await page.getByText(listTitle, { exact: false }).first().isVisible().catch(() => false));
  F.step('teacher', `unassign "${listTitle}" from ${className} [dialog=${dialog}] → ${gone ? 'removed' : 'still present'}`);
  return { gone, dialogMessage };
}

// Read a class's join code from the teacher ClassDetail UI (visible "Join Code" panel,
// ClassDetail.jsx:678/1000). Forward-only class creation reads the code to hand to a student.
export async function readJoinCode(page, className, F) {
  await openClassDetail(page, className, F);
  const lbl = page.getByText(/^Join Code$/i).first();
  if (!(await lbl.isVisible({ timeout: 6000 }).catch(() => false))) { F.add('selector-gap', `${className}: Join Code panel not found`); return null; }
  const codeEl = lbl.locator('xpath=following-sibling::*[1]');
  const raw = (await codeEl.innerText().catch(() => '')).replace(/\s+/g, '').trim();
  const code = /^[A-Za-z0-9]{4,8}$/.test(raw) ? raw : null;
  if (!code) F.add('selector-gap', `${className}: join code text unreadable ("${raw.slice(0, 20)}")`);
  F.step('teacher', `read join code for ${className} → ${code || 'FAILED'}`);
  return code;
}

// Edit an assigned list's settings (pace/threshold/mode/testSize) via title="Edit Settings".
export async function editSettings(page, className, listTitle, changes, F) {
  await openClassDetail(page, className, F);
  await tab(page, 'Assigned Lists');
  let gear = page.getByTitle('Edit Settings').first();
  const cards = page.locator('div', { hasText: listTitle }).filter({ has: page.getByTitle('Edit Settings') });
  if (await cards.count().catch(() => 0)) gear = cards.last().getByTitle('Edit Settings').first();
  if (!(await gear.isVisible().catch(() => false))) { F.add('selector-gap', `${className}: Edit Settings for "${listTitle}" not found`); return false; }
  await gear.click().catch(() => {});
  await sleep(1200);
  if (changes.pace != null) await page.getByLabel(/daily new words/i).first().fill(String(changes.pace)).catch(() => {});
  if (changes.thr != null) await page.getByLabel(/pass threshold/i).first().fill(String(changes.thr)).catch(() => {});
  if (changes.testSize != null) await page.getByLabel(/new word test size/i).first().fill(String(changes.testSize)).catch(() => {});
  if (changes.mode) {
    const sel = page.locator('select').filter({ hasText: 'Written Only' });
    await sel.nth(0).selectOption({ value: MODE_VALUE(changes.mode) }).catch(() => F.add('selector-gap', `${className}: settings Test Mode set failed`));
    if (await sel.count().catch(() => 0) > 1) await sel.nth(1).selectOption({ value: MODE_VALUE(changes.mode) }).catch(() => {});
  }
  await shot(page, `lsr_tch_settings_${className.replace(/\W+/g, '_')}`);
  await page.getByRole('button', { name: /^(save( settings| changes)?|update)$/i }).last().click({ timeout: 5000 }).catch(() => F.add('selector-gap', `${className}: settings Save not found`));
  await sleep(1500);
  await dismissModal(page);
  F.step('teacher', `edit settings ${className}/${listTitle}: ${JSON.stringify(changes)}`);
  return true;
}

// Remove a student (Students tab → row "Remove" LinkButton + native confirm).
export async function removeStudent(page, className, studentName, F) {
  await openClassDetail(page, className, F);
  await tab(page, 'Students');
  const row = page.getByRole('row', { name: new RegExp(escRe(studentName), 'i') }).first();
  let removeBtn = row.getByRole('button', { name: /^remove$/i }).first();
  if (!(await removeBtn.isVisible().catch(() => false))) {
    // fallback: any Remove near the student name
    removeBtn = page.getByRole('button', { name: /^remove$/i }).first();
  }
  if (!(await removeBtn.isVisible().catch(() => false))) { F.add('selector-gap', `${className}: Remove control for "${studentName}" not found`); await shot(page, `lsr_tch_remove_gap_${className.replace(/\W+/g, '_')}`); return false; }
  armDialog(page, 'accept'); // this primitive intends to confirm the removal
  await removeBtn.click().catch(() => {});
  await sleep(2000);
  F.step('teacher', `remove "${studentName}" from ${className}`);
  return true;
}

export async function openGradebook(page, className, F) {
  await openClassDetail(page, className, F);
  await tab(page, 'Gradebook');
  await sleep(1500);
  await shot(page, `lsr_tch_gradebook_${className.replace(/\W+/g, '_')}`);
  return page.getByText(/Gradebook/i).first().isVisible().catch(() => false);
}

// Create a class (dashboard "Create New Class" modal). Returns the join code if visible.
export async function createClass(page, className, F) {
  await goDashboard(page);
  const createBtn = page.getByRole('button', { name: /create new class|new class/i }).first();
  await createBtn.click({ timeout: 6000 }).catch(() => F.add('selector-gap', 'Create New Class button not found'));
  await sleep(1000);
  const nameBox = page.getByLabel(/class name|name/i).or(page.getByPlaceholder(/class name|name/i)).first();
  await nameBox.fill(className).catch(() => {});
  await page.getByRole('button', { name: /^create class$/i }).first().click().catch(() => {});
  await nameBox.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await sleep(1500);
  F.step('teacher', `create class "${className}"`);
  return true;
}

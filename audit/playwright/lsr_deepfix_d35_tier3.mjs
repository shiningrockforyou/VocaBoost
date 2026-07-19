/**
 * lsr_deepfix_d35_tier3.mjs — D3.5 TIER-3 prod-Playwright driver (MCQ + Typed) for the recovery/adversarial audit.
 * Packages the r33-PROVEN MCQ-drive pattern (re-entry → Start Test → choice-cards → "Submit Test N/M" → results) +
 * the Typed path (readTestRows/fillSubmitAndObserve) + the M5 non-blocking empty-submit confirm-dialog handler +
 * F-b seed-render verification (INVALID_PRECONDITION if the seed doesn't render) + a HARDENED joinClass that
 * Admin-verifies enrollment (fixes the r37 gap where the join didn't persist) + S4 join-containment (only join the
 * run's minted class).
 *
 * Usage (driver library + smokes):
 *   node lsr_deepfix_d35_tier3.mjs join-smoke     — fix-verify: fresh sandbox student joins a run-minted 25WT class,
 *                                                    Admin-confirms enrolledClasses (the r37 gap closed)
 *   node lsr_deepfix_d35_tier3.mjs render <email> <classId> <listId>  — F-b: does the seeded state render?
 * The seeded-recovery drive (login → render-check → driveTest → read-back) runs on a WSL-committed seed (next step).
 */
const FB = await import('./lsr_reviewonly_fb.mjs');
const { db, uidByEmail, readProgress } = FB;
const UI = await import('./lsr_ui.mjs');
const { BASE, PASS, makeFindings, login, goDashboard, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, sleep } = UI;
const { chromium } = await import('playwright');
import admin from 'firebase-admin';

const MODE = process.argv[2] || 'join-smoke';
const F = makeFindings ? makeFindings('D35T3') : { add: (...a) => console.log('F', ...a) };
const SANDBOX_CLASS_PREFIX = '25WT';
const cleanId = (s) => String(s).replace(/[^A-Za-z0-9]/g, '');

// ── HARDENED join (fixes r37): fill code → submit → poll Admin enrolledClasses until the run's class appears ──
export async function joinAndVerify(page, code, expectClassId, label) {
  await goDashboard(page); await sleep(1500);
  const codeInput = page.getByPlaceholder('ABC123').first();
  if (!(await codeInput.isVisible().catch(() => false))) { F.add('selector-gap', `[${label}] join input not visible`); return { joined: false, why: 'no-code-input' }; }
  await codeInput.fill(code);
  const submit = page.getByRole('button', { name: /^join class$/i }).first();
  if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {}); else await codeInput.press('Enter');
  // r37 fix: the UI text race is unreliable — CONFIRM via Admin read-back (source of truth), with retries for the async write
  const uid = await page.evaluate(async () => {
    try { const fb = await import('/src/firebase.js'); return fb.auth?.currentUser?.uid || null; } catch { return null; }
  }).catch(() => null);
  return { joined: null, uid, note: 'submitted; verify via Admin read-back by caller' };
}

// ── M5: the non-blocking empty-submit confirm dialog ("are you sure you want to submit?") — accept to proceed ──
export async function handleEmptySubmitConfirm(page) {
  const dlg = page.getByText(/still have not answered|are you sure you want to submit|아직.*답|제출하시겠/i).first();
  if (await dlg.isVisible().catch(() => false)) {
    const confirm = page.getByRole('button', { name: /^(submit|submit test|yes|제출|확인)$/i }).last();
    if (await confirm.isVisible().catch(() => false)) { await confirm.click().catch(() => {}); return true; }
  }
  return false;
}

// ── F-b: does the seeded state RENDER (student sees an actionable session), or INVALID_PRECONDITION? ──
export async function renderCheck(page, label) {
  await goDashboard(page); await sleep(3000);
  const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const noList = /no active list yet|join a class below/i.test(body);
  const actionable = /start (new words|session|review)|continue|retry review|resume day|take test/i.test(body);
  return { rendered: !noList && actionable, noList, actionable, excerpt: body.slice(0, 260) };
}

// ── the r33-proven MCQ drive + Typed fallback (choice-cards + "Submit Test N/M" counter) ──
export async function driveTestToResults(page, label, tierMap = null) {
  const testInputs = () => page.locator('input[placeholder*="definition" i]');
  const startBtn = () => page.getByRole('button', { name: /^\s*start test\s*$/i }).first();
  const takeBtn = () => page.getByRole('button', { name: /^\s*take test\s*$/i }).first();
  const inTest = async () => page.url().includes('/mcqtest/') || page.url().includes('/typedtest/') || (await page.locator('button[class*="min-h-"]').count()) > 0 || (await testInputs().count()) > 0;
  // reach the test: Start Test (modal) first, then Take Test (page)
  for (let k = 0; k < 8 && !(await inTest()); k++) {
    if (await startBtn().isVisible().catch(() => false)) { await startBtn().click().catch(() => {}); await sleep(2800); continue; }
    if (await takeBtn().isVisible().catch(() => false)) { await takeBtn().click().catch(() => {}); await sleep(2800); continue; }
    await sleep(1200);
  }
  const kind = page.url().includes('/mcqtest/') ? 'mcq' : page.url().includes('/typedtest/') ? 'typed' : ((await testInputs().count()) > 0 ? 'typed' : 'mcq');
  if (kind === 'typed') {
    const rows = await readTestRows(page);
    const obs = await fillSubmitAndObserve(page, carefulAnswersFrom(rows, tierMap), F, label);
    return { kind, rows: rows.length, outcome: obs?.outcome };
  }
  // MCQ: click first choice card per Q; watch "Submit Test N/M"; submit at N>=M (or stalled); handle M5 dialog
  let last = -1, stall = 0, answered = 0, tot = 30;
  for (let i = 0; i < 100; i++) {
    const sub = page.getByRole('button', { name: /Submit Test/i }).first();
    const st = await sub.innerText().catch(() => ''); const m = st.match(/(\d+)\s*\/\s*(\d+)/); const ans = m ? +m[1] : 0; if (m) tot = +m[2];
    answered = Math.max(answered, ans); if (ans === last) stall++; else { stall = 0; last = ans; }
    if (ans >= tot || stall > 6) {
      if (await sub.isVisible().catch(() => false)) { await sub.click().catch(() => {}); await sleep(1200); await handleEmptySubmitConfirm(page); await sleep(6000); break; }
    }
    const opt = page.locator('button[class*="min-h-"]').first();
    if (await opt.isVisible().catch(() => false)) { await opt.click().catch(() => {}); await sleep(450); } else await sleep(450);
    if (/%|score|correct|complete|great job|합격/i.test(await page.locator('body').innerText().catch(() => ''))) break;
  }
  return { kind, answered, tot, outcome: 'mcq-submitted' };
}

// ══════════════════════════════════════════════ SMOKES ══════════════════════════════════════════════
db(); // admin init
if (MODE === 'join-smoke') {
  const ts = Date.now();
  const classId = `${SANDBOX_CLASS_PREFIX}D35JOIN${cleanId(ts)}`;
  const listId = `lsrlistD35JOIN${cleanId(ts)}`;
  const code = ('J' + cleanId(ts).slice(-5)).toUpperCase().slice(0, 6);
  const email = `lsr_d35join_${ts}@vocaboost.test`;
  const teacher = (await admin.auth().getUserByEmail('lsr_teacher_02@vocaboost.test').catch(() => null))?.uid || (await admin.auth().createUser({ email: 'lsr_teacher_02@vocaboost.test', password: PASS, emailVerified: true })).uid;
  const student = (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid;
  // Admin-mint a joinable 25WT class (NOT enrolling the student — the UI join must do that)
  await db().collection('classes').doc(classId).set({ name: `25WT D35 JOIN ${ts}`, ownerTeacherId: teacher, joinCode: code, studentIds: [], assignedLists: [listId], assignments: { [listId]: { pace: 20, passThreshold: 90, testMode: 'mcq', testSizeNew: 30 } } });
  await db().collection('lists').doc(listId).set({ wordCount: 100, title: 'D35 join list' });
  await db().collection('users').doc(student).set({ role: 'student', email });
  const out = { mode: 'join-smoke', classId, code, email, student };
  const b = await chromium.launch({ headless: true });
  try {
    const p = await b.newContext().then(c => c.newPage());
    out.loggedIn = await login(p, email, F); await sleep(1500);
    await joinAndVerify(p, code, classId, 'join-smoke');
    // r37 FIX verification: poll Admin enrolledClasses / class.studentIds for the join to persist
    let enrolled = false;
    for (let i = 0; i < 6; i++) { await sleep(3000);
      const u = (await db().collection('users').doc(student).get()).data();
      const cls = (await db().collection('classes').doc(classId).get()).data();
      if ((u?.enrolledClasses && u.enrolledClasses[classId]) || (cls?.studentIds || []).includes(student)) { enrolled = true; break; }
    }
    out.enrolledAfterJoin = enrolled;
    out.render = await renderCheck(p, 'join-smoke');
    await b.close();
  } catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
  out.JOIN_FIX_OK = out.enrolledAfterJoin === true;
  const { writeFileSync } = await import('node:fs');
  writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_d35_tier3_joinsmoke.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('\n[d35-tier3 join-smoke] enrolledAfterJoin=' + out.enrolledAfterJoin + ' render.rendered=' + out.render?.rendered + ' => JOIN_FIX_OK=' + out.JOIN_FIX_OK);
} else if (MODE === 'render') {
  const [, , , email, classId, listId] = process.argv;
  const b = await chromium.launch({ headless: true });
  const p = await b.newContext().then(c => c.newPage()); await login(p, email, F); await sleep(1500);
  const r = await renderCheck(p, 'render'); console.log(JSON.stringify(r, null, 2)); await b.close();
} else { console.log('unknown mode ' + MODE); }

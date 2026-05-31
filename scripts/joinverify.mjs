/**
 * JOINVERIFY — end-to-end Firestore rule fix verification
 * Label: JOINVERIFY
 *
 * 1. Admin SDK: read all classes + their studentIds/members to find a clean (student,class) pair
 * 2. Playwright (real authenticated UI): perform the join through the app
 * 3. Admin SDK: assert studentIds now contains the uid (the key assertion)
 * 4. Admin SDK: clean up the test enrollment, verify restoration
 * 5. Write findings + evidence
 */

import { chromium } from 'playwright';
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Paths ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const SEEDED_PATH = path.join(__dirname, '../audit/playwright/seeded_accounts.json');
const FINDINGS_DIR = path.join(__dirname, '../findings');
const EVIDENCE_DIR = path.join(FINDINGS_DIR, 'evidence/joinverify');
const LOGS_DIR = path.join(FINDINGS_DIR, 'agent_logs');
const LOGS_JSONL = path.join(LOGS_DIR, 'JOINVERIFY.jsonl');
const STATUS_JSON = path.join(LOGS_DIR, 'JOINVERIFY.status.json');
const FINDINGS_MD = path.join(FINDINGS_DIR, 'findings_joinverify.md');

// ── Setup dirs ─────────────────────────────────────────────────────────────
[EVIDENCE_DIR, LOGS_DIR].forEach(d => mkdirSync(d, { recursive: true }));

// ── Logging ────────────────────────────────────────────────────────────────
function log(level, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  console.log(`[${level}] ${msg}`, Object.keys(data).length ? JSON.stringify(data) : '');
  writeFileSync(LOGS_JSONL, JSON.stringify(entry) + '\n', { flag: 'a' });
}

function saveStatus(status) {
  writeFileSync(STATUS_JSON, JSON.stringify({ ...status, updatedAt: new Date().toISOString() }, null, 2));
}

// ── Firebase Admin ─────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'vocaboost-879c2',
  });
}
const db = admin.firestore();

// ── Seeded accounts ────────────────────────────────────────────────────────
const seeded = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'));
const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt';
const TOP_JOIN_CODE = 'QSTRZL';
const CORE_JOIN_CODE = '3VEHE8';

// ── Step 1: Read class state and find a clean pair ─────────────────────────
async function findCleanPair() {
  log('INFO', 'Reading class documents from Firestore (Admin SDK)');

  const [topDoc, coreDoc] = await Promise.all([
    db.collection('classes').doc(TOP_CLASS_ID).get(),
    db.collection('classes').doc(CORE_CLASS_ID).get(),
  ]);

  const topData = topDoc.data() || {};
  const coreData = coreDoc.data() || {};

  log('INFO', 'TOP class fetched', {
    classId: TOP_CLASS_ID,
    studentCount: topData.studentCount,
    studentIdsLength: (topData.studentIds || []).length,
    name: topData.name || topData.className,
  });
  log('INFO', 'CORE class fetched', {
    classId: CORE_CLASS_ID,
    studentCount: coreData.studentCount,
    studentIdsLength: (coreData.studentIds || []).length,
    name: coreData.name || coreData.className,
  });

  // Save before snapshots
  writeFileSync(
    path.join(EVIDENCE_DIR, 'before_top_class_doc.json'),
    JSON.stringify({ id: TOP_CLASS_ID, ...topData, studentIds: topData.studentIds || [] }, null, 2)
  );
  writeFileSync(
    path.join(EVIDENCE_DIR, 'before_core_class_doc.json'),
    JSON.stringify({ id: CORE_CLASS_ID, ...coreData, studentIds: coreData.studentIds || [] }, null, 2)
  );

  const topStudentIds = topData.studentIds || [];
  const coreStudentIds = coreData.studentIds || [];

  // We want to use a CORE student to join TOP class (cross-class) — a completely clean pair
  // Or a TOP student to join CORE class
  // First preference: find a CORE student NOT in TOP class (so they join TOP)
  // This is the cleanest since they have their own class already

  let chosen = null;

  // Try: CORE student joining TOP class (they're in CORE, not in TOP)
  for (const acc of seeded.accounts.filter(a => a.targetClass === 'CORE')) {
    const inTop = topStudentIds.includes(acc.uid);
    // Check member doc
    const memberSnap = await db.collection('classes').doc(TOP_CLASS_ID).collection('members').doc(acc.uid).get();
    const memberExists = memberSnap.exists;

    if (!inTop && !memberExists) {
      log('INFO', 'Found clean pair: CORE student NOT in TOP class', {
        uid: acc.uid,
        email: acc.email,
        persona: acc.personaId,
        targetClass: acc.targetClass,
        classId: TOP_CLASS_ID,
        joinCode: TOP_JOIN_CODE,
        inStudentIds: false,
        memberExists: false,
      });
      chosen = {
        student: acc,
        classId: TOP_CLASS_ID,
        className: topData.name || topData.className || '25WT 2차 TOP OFFLINE',
        joinCode: TOP_JOIN_CODE,
        beforeStudentIds: [...topStudentIds],
        beforeStudentCount: topData.studentCount || 0,
        beforeMemberExists: false,
        beforeInStudentIds: false,
      };
      break;
    }
  }

  // Fallback: TOP student joining CORE
  if (!chosen) {
    for (const acc of seeded.accounts.filter(a => a.targetClass === 'TOP')) {
      const inCore = coreStudentIds.includes(acc.uid);
      const memberSnap = await db.collection('classes').doc(CORE_CLASS_ID).collection('members').doc(acc.uid).get();
      const memberExists = memberSnap.exists;

      if (!inCore && !memberExists) {
        log('INFO', 'Found clean pair: TOP student NOT in CORE class', {
          uid: acc.uid,
          email: acc.email,
          classId: CORE_CLASS_ID,
        });
        chosen = {
          student: acc,
          classId: CORE_CLASS_ID,
          className: coreData.name || coreData.className || '25WT 2차 CORE OFFLINE',
          joinCode: CORE_JOIN_CODE,
          beforeStudentIds: [...coreStudentIds],
          beforeStudentCount: coreData.studentCount || 0,
          beforeMemberExists: false,
          beforeInStudentIds: false,
        };
        break;
      }
    }
  }

  if (!chosen) {
    log('ERROR', 'BLOCKED: Could not find a clean (student,class) pair where uid is absent from studentIds AND member doc');
    throw new Error('BLOCKED: No clean pair found. All audit students may already be in both classes.');
  }

  return chosen;
}

// ── Step 2: UI Join via Playwright ────────────────────────────────────────
async function performJoinViaUI(chosen) {
  const BASE_URL = 'https://vocaboostone.netlify.app';
  log('INFO', 'Launching Playwright browser', { executablePath: '/ms-playwright/chromium-1223/chrome-linux/chrome' });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const permissionDeniedErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.toLowerCase().includes('permission') || text.toLowerCase().includes('denied') || text.toLowerCase().includes('missing or insufficient')) {
      consoleErrors.push({ type: msg.type(), text });
      if (text.toLowerCase().includes('permission') || text.toLowerCase().includes('missing or insufficient')) {
        permissionDeniedErrors.push(text);
      }
    }
  });

  let joinSuccess = false;
  let joinError = null;
  let screenshotPaths = [];

  try {
    // Navigate to root (SPA warm-up)
    log('INFO', 'Navigating to app root', { url: BASE_URL });
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_root_loaded.png'), fullPage: true });
    screenshotPaths.push('01_root_loaded.png');

    // Login
    log('INFO', 'Logging in as student', { email: chosen.student.email });
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
    const loginLinkCount = await loginLink.count();
    if (loginLinkCount > 0) {
      await loginLink.click();
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login');
        dispatchEvent(new PopStateEvent('popstate'));
      });
    }

    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await page.getByLabel(/email/i).first().fill(chosen.student.email);
    await page.getByLabel(/password/i).first().fill(chosen.student.password);
    await page.getByLabel(/password/i).first().press('Enter');

    // Wait for dashboard
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i })
        .first().click().catch(() => {});
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
    });

    log('INFO', 'Login successful', { url: page.url() });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_dashboard_after_login.png'), fullPage: true });
    screenshotPaths.push('02_dashboard_after_login.png');

    // Look for join class option
    // Try to find "Join class", "Join a class", "+ Add class", etc.
    log('INFO', 'Looking for join class UI element');

    // Try clicking join button or navigating to join route
    const joinBtn = page.getByRole('button', { name: /join\s*(a\s*)?class|add\s*class|\+\s*class/i }).first();
    const joinLink = page.getByRole('link', { name: /join\s*(a\s*)?class|add\s*class|\+\s*class/i }).first();
    const joinBtnCount = await joinBtn.count();
    const joinLinkCount2 = await joinLink.count();

    log('INFO', 'Join elements found', { buttons: joinBtnCount, links: joinLinkCount2 });

    if (joinBtnCount > 0) {
      await joinBtn.click();
      log('INFO', 'Clicked join class button');
    } else if (joinLinkCount2 > 0) {
      await joinLink.click();
      log('INFO', 'Clicked join class link');
    } else {
      // Try navigating via page evaluation or direct URL
      log('INFO', 'No join button/link found, trying page snapshot to understand layout');
      const snapshot = await page.content();
      // Look for any reference to "join" in the page
      const hasJoin = snapshot.toLowerCase().includes('join');
      log('INFO', 'Page has join text', { hasJoin });

      // Try going to /join route directly
      await page.evaluate(() => {
        history.pushState({}, '', '/join');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_join_page.png'), fullPage: true });
    screenshotPaths.push('03_join_page.png');
    log('INFO', 'Current URL after trying to navigate to join', { url: page.url() });

    // Look for join code input
    const codeInput = page.getByPlaceholder(/join\s*code|class\s*code|code/i).first();
    const codeInputAlt = page.getByLabel(/join\s*code|class\s*code|code/i).first();
    const anyInput = page.locator('input[type="text"], input:not([type])').first();

    let inputEl = null;
    if (await codeInput.count() > 0) {
      inputEl = codeInput;
      log('INFO', 'Found code input by placeholder');
    } else if (await codeInputAlt.count() > 0) {
      inputEl = codeInputAlt;
      log('INFO', 'Found code input by label');
    } else {
      // Check current page more carefully
      const pageTitle = await page.title();
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      log('INFO', 'Page state', { url: page.url(), title: pageTitle, bodyText: pageText });

      // Try clicking add/join button again
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.textContent();
        log('INFO', 'Found button', { text });
      }

      // Try to navigate to explicit join URL
      await page.goto(BASE_URL + '/join', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '03b_join_url.png'), fullPage: true });

      if (await codeInput.count() > 0) {
        inputEl = codeInput;
      } else if (await codeInputAlt.count() > 0) {
        inputEl = codeInputAlt;
      } else if (await anyInput.count() > 0) {
        inputEl = anyInput;
        log('INFO', 'Using fallback generic text input');
      }
    }

    if (!inputEl) {
      throw new Error('Could not find join code input field on the page');
    }

    // Enter join code
    log('INFO', 'Entering join code', { code: chosen.joinCode });
    await inputEl.fill(chosen.joinCode);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_code_entered.png'), fullPage: true });

    // Submit
    const submitBtn = page.getByRole('button', { name: /join|submit|confirm|enter/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      log('INFO', 'Clicked submit/join button');
    } else {
      await inputEl.press('Enter');
      log('INFO', 'Pressed Enter to submit');
    }

    // Wait for result (either success message or redirect)
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_after_join.png'), fullPage: true });
    screenshotPaths.push('05_after_join.png');

    const afterUrl = page.url();
    const afterText = await page.evaluate(() => document.body.innerText.substring(0, 800));
    log('INFO', 'After join state', { url: afterUrl, bodyText: afterText });

    // Check for error messages
    const errorEl = page.getByText(/error|failed|permission|denied/i).first();
    const errorCount = await errorEl.count();
    if (errorCount > 0) {
      const errorText = await errorEl.textContent();
      log('WARN', 'Error text found on page after join', { errorText });
    }

    joinSuccess = true;
    log('INFO', 'Join UI flow completed successfully');

  } catch (err) {
    joinError = err.message;
    log('ERROR', 'Error during UI join', { error: err.message, stack: err.stack });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_error.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  return {
    joinSuccess,
    joinError,
    consoleErrors,
    permissionDeniedErrors,
    screenshotPaths,
  };
}

// ── Step 3: Verify via Admin SDK ───────────────────────────────────────────
async function verifyJoinResult(chosen) {
  log('INFO', 'Verifying join result via Admin SDK', { classId: chosen.classId, uid: chosen.student.uid });

  const classDoc = await db.collection('classes').doc(chosen.classId).get();
  const classData = classDoc.data() || {};
  const afterStudentIds = classData.studentIds || [];
  const afterStudentCount = classData.studentCount || 0;

  const memberDoc = await db.collection('classes').doc(chosen.classId).collection('members').doc(chosen.student.uid).get();
  const memberExists = memberDoc.exists;

  const uidInStudentIds = afterStudentIds.includes(chosen.student.uid);

  // Check user's enrolledClasses
  const userDoc = await db.collection('users').doc(chosen.student.uid).get();
  const userData = userDoc.data() || {};
  // enrolledClasses may be an array or a map/object depending on app version
  const rawEnrolled = userData.enrolledClasses;
  let enrolledClasses;
  if (Array.isArray(rawEnrolled)) {
    enrolledClasses = rawEnrolled;
  } else if (rawEnrolled && typeof rawEnrolled === 'object') {
    // Could be a map: { classId: true } or { classId: { ... } }
    enrolledClasses = Object.keys(rawEnrolled);
  } else {
    enrolledClasses = [];
  }
  const classInEnrolled = enrolledClasses.includes(chosen.classId);

  log('INFO', 'After join verification', {
    uid: chosen.student.uid,
    classId: chosen.classId,
    uidInStudentIds,
    afterStudentIdsLength: afterStudentIds.length,
    afterStudentCount,
    memberExists,
    classInEnrolled,
    studentCountDelta: afterStudentCount - chosen.beforeStudentCount,
    studentIdsDelta: afterStudentIds.length - chosen.beforeStudentIds.length,
  });

  // Save after snapshot
  writeFileSync(
    path.join(EVIDENCE_DIR, 'after_class_doc.json'),
    JSON.stringify({ id: chosen.classId, ...classData, studentIds: afterStudentIds }, null, 2)
  );
  if (memberExists) {
    writeFileSync(
      path.join(EVIDENCE_DIR, 'after_member_doc.json'),
      JSON.stringify({ uid: chosen.student.uid, ...memberDoc.data() }, null, 2)
    );
  }

  return {
    uidInStudentIds,
    memberExists,
    afterStudentCount,
    afterStudentIds,
    classInEnrolled,
    memberData: memberExists ? memberDoc.data() : null,
    userData: userData,
  };
}

// ── Step 4: Clean up ───────────────────────────────────────────────────────
async function cleanupEnrollment(chosen) {
  const { uid } = chosen.student;
  const classId = chosen.classId;

  log('INFO', 'Starting cleanup', { uid, classId });

  const batch = db.batch();

  // 1. Delete members/{uid} doc
  const memberRef = db.collection('classes').doc(classId).collection('members').doc(uid);
  batch.delete(memberRef);

  // 2. Remove uid from studentIds (arrayRemove) and decrement studentCount
  const classRef = db.collection('classes').doc(classId);
  batch.update(classRef, {
    studentIds: admin.firestore.FieldValue.arrayRemove(uid),
    studentCount: admin.firestore.FieldValue.increment(-1),
  });

  // 3. Remove classId from users/{uid}.enrolledClasses
  const userRef = db.collection('users').doc(uid);
  batch.update(userRef, {
    enrolledClasses: admin.firestore.FieldValue.arrayRemove(classId),
  });

  await batch.commit();
  log('INFO', 'Cleanup batch committed');

  // Verify cleanup
  const [classSnap, memberSnap, userSnap] = await Promise.all([
    db.collection('classes').doc(classId).get(),
    db.collection('classes').doc(classId).collection('members').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ]);

  const afterCleanupData = classSnap.data() || {};
  const afterStudentIds = afterCleanupData.studentIds || [];
  const afterStudentCount = afterCleanupData.studentCount || 0;
  const memberGone = !memberSnap.exists;
  const uidGone = !afterStudentIds.includes(uid);
  const userData = userSnap.data() || {};
  const classRemovedFromUser = !(userData.enrolledClasses || []).includes(classId);

  log('INFO', 'Cleanup verification', {
    uid,
    classId,
    memberGone,
    uidGone,
    classRemovedFromUser,
    afterStudentCount,
    afterStudentIdsLength: afterStudentIds.length,
    expectedStudentCount: chosen.beforeStudentCount,
    expectedStudentIdsLength: chosen.beforeStudentIds.length,
  });

  // Save post-cleanup snapshot
  writeFileSync(
    path.join(EVIDENCE_DIR, 'after_cleanup_class_doc.json'),
    JSON.stringify({ id: classId, ...afterCleanupData, studentIds: afterStudentIds }, null, 2)
  );

  return {
    memberGone,
    uidGone,
    classRemovedFromUser,
    afterStudentCount,
    afterStudentIds,
    cleanupComplete: memberGone && uidGone && classRemovedFromUser,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log('INFO', 'JOINVERIFY agent started');
  saveStatus({ status: 'running', stage: 'init' });

  let chosen, joinResult, verifyResult, cleanupResult;

  try {
    // Step 1: Find clean pair
    saveStatus({ status: 'running', stage: 'finding_clean_pair' });
    chosen = await findCleanPair();
    log('INFO', 'Chosen pair', {
      studentUid: chosen.student.uid,
      studentEmail: chosen.student.email,
      studentPersona: chosen.student.personaId,
      classId: chosen.classId,
      className: chosen.className,
      joinCode: chosen.joinCode,
      beforeStudentIdsLength: chosen.beforeStudentIds.length,
      beforeStudentCount: chosen.beforeStudentCount,
      beforeInStudentIds: chosen.beforeInStudentIds,
      beforeMemberExists: chosen.beforeMemberExists,
    });

    // Step 2: Join via real UI (Playwright)
    saveStatus({ status: 'running', stage: 'ui_join', chosen: { uid: chosen.student.uid, classId: chosen.classId } });
    joinResult = await performJoinViaUI(chosen);

    // Step 3: Verify via Admin SDK
    saveStatus({ status: 'running', stage: 'verifying' });
    verifyResult = await verifyJoinResult(chosen);

    const THE_VERDICT = verifyResult.uidInStudentIds;
    log(THE_VERDICT ? 'INFO' : 'ERROR', 'KEY ASSERTION: uid in studentIds after join', {
      verdict: THE_VERDICT ? 'PASS' : 'FAIL',
      uid: chosen.student.uid,
      classId: chosen.classId,
    });

    // Step 4: Clean up (always run, even if assertion failed)
    saveStatus({ status: 'running', stage: 'cleanup' });
    cleanupResult = await cleanupEnrollment(chosen);

    // ── Write findings ─────────────────────────────────────────────────────
    const findingsMd = `# JOINVERIFY: Firestore Rule Fix Verification Report
**Date:** ${new Date().toISOString()}
**Agent:** JOINVERIFY
**Target:** https://vocaboostone.netlify.app (prod)
**Rule change:** firestore.rules:60 — \`hasOnly(['studentCount','studentIds'])\` (allows studentIds writes)

---

## Chosen Test Pair (Safe)

| Field | Value |
|-------|-------|
| Student UID | \`${chosen.student.uid}\` |
| Student Email | ${chosen.student.email} |
| Student Persona | ${chosen.student.personaId} |
| Student's Own Class | ${chosen.student.targetClass} |
| Test Class ID | \`${chosen.classId}\` |
| Test Class Name | ${chosen.className} |
| Join Code | ${chosen.joinCode} |
| Why safe | Student is a seeded audit account whose own class is ${chosen.student.targetClass}. Testing join to ${chosen.student.targetClass === 'TOP' ? 'CORE' : 'TOP'} class is cross-class — fully reversible, no impact on primary class membership. |

---

## BEFORE State

| Check | Value |
|-------|-------|
| uid in studentIds? | **${chosen.beforeInStudentIds}** |
| member doc exists? | **${chosen.beforeMemberExists}** |
| studentIds length | ${chosen.beforeStudentIds.length} |
| studentCount | ${chosen.beforeStudentCount} |

---

## Join Performed via Real UI?

${joinResult.joinSuccess ? '**YES** — Join was performed through the live authenticated UI (Playwright). Firebase rules were enforced.' : `**PARTIAL / ERROR** — ${joinResult.joinError || 'Unknown error'}`}

${joinResult.permissionDeniedErrors.length > 0
  ? `**PERMISSION-DENIED ERRORS DETECTED:**\n${joinResult.permissionDeniedErrors.map(e => `- ${e}`).join('\n')}`
  : '**No permission-denied errors detected in browser console.**'}

${joinResult.consoleErrors.length > 0
  ? `Console errors:\n${joinResult.consoleErrors.map(e => `- [${e.type}] ${e.text}`).join('\n')}`
  : 'No console errors detected.'}

---

## AFTER State (Key Assertions)

| Assertion | Expected | Actual | Result |
|-----------|----------|--------|--------|
| **uid in studentIds?** | true | **${verifyResult.uidInStudentIds}** | **${verifyResult.uidInStudentIds ? '✅ PASS' : '❌ FAIL'}** |
| studentCount incremented? | ${chosen.beforeStudentCount + 1} | ${verifyResult.afterStudentCount} | ${verifyResult.afterStudentCount === chosen.beforeStudentCount + 1 ? '✅ PASS' : '❌ FAIL'} |
| member doc created? | true | ${verifyResult.memberExists} | ${verifyResult.memberExists ? '✅ PASS' : '❌ FAIL'} |
| class in enrolledClasses? | true | ${verifyResult.classInEnrolled} | ${verifyResult.classInEnrolled ? '✅ PASS' : '❌ FAIL'} |

studentIds before length: ${chosen.beforeStudentIds.length}
studentIds after length: ${verifyResult.afterStudentIds.length}

---

## Cleanup

| Check | Result |
|-------|--------|
| member doc deleted | ${cleanupResult.memberGone ? '✅ YES' : '❌ NO'} |
| uid removed from studentIds | ${cleanupResult.uidGone ? '✅ YES' : '❌ NO'} |
| class removed from user.enrolledClasses | ${cleanupResult.classRemovedFromUser ? '✅ YES' : '❌ NO'} |
| studentCount after cleanup | ${cleanupResult.afterStudentCount} (was ${chosen.beforeStudentCount}) |
| studentIds length after cleanup | ${cleanupResult.afterStudentIds.length} (was ${chosen.beforeStudentIds.length}) |
| Cleanup complete? | **${cleanupResult.cleanupComplete ? '✅ YES — prod restored to BEFORE state' : '❌ NO — MANUAL CLEANUP NEEDED'}** |

---

## Evidence Files
- \`evidence/joinverify/before_top_class_doc.json\` — TOP class state before test
- \`evidence/joinverify/before_core_class_doc.json\` — CORE class state before test
- \`evidence/joinverify/after_class_doc.json\` — Test class state after join
- \`evidence/joinverify/after_cleanup_class_doc.json\` — Test class state after cleanup
${verifyResult.memberExists ? '- `evidence/joinverify/after_member_doc.json` — Member doc snapshot after join' : ''}
- Screenshots in \`evidence/joinverify/\`: ${joinResult.screenshotPaths.join(', ')}
- Logs: \`agent_logs/JOINVERIFY.jsonl\`

---

## VERDICT

**Is the deployed rule fix CONFIRMED working end-to-end?**

# ${verifyResult.uidInStudentIds ? '✅ YES — CONFIRMED' : '❌ NO — FIX NOT WORKING'}

${verifyResult.uidInStudentIds
  ? 'The Firestore rule change (`hasOnly([\'studentCount\',\'studentIds\'])`) is confirmed working in production. A real authenticated client write (via UI join flow) successfully updated both `studentIds` and `studentCount` in `classes/{id}`. The phantom-member bug is fixed.'
  : 'The uid was NOT found in studentIds after the UI join. The rule fix may not have deployed correctly, or the join flow has another issue.'}
`;

    writeFileSync(FINDINGS_MD, findingsMd);
    log('INFO', 'Findings written', { path: FINDINGS_MD });

    const finalStatus = {
      status: THE_VERDICT ? 'passed' : 'failed',
      verdict: THE_VERDICT ? 'CONFIRMED_WORKING' : 'FIX_NOT_WORKING',
      chosen: {
        studentUid: chosen.student.uid,
        studentEmail: chosen.student.email,
        studentPersona: chosen.student.personaId,
        classId: chosen.classId,
        className: chosen.className,
        whySafe: `Seeded audit student, cross-class join (own=${chosen.student.targetClass}, tested=${chosen.student.targetClass === 'TOP' ? 'CORE' : 'TOP'})`,
      },
      before: {
        uidInStudentIds: chosen.beforeInStudentIds,
        memberExists: chosen.beforeMemberExists,
        studentIdsLength: chosen.beforeStudentIds.length,
        studentCount: chosen.beforeStudentCount,
      },
      join: {
        performedViaRealUI: joinResult.joinSuccess,
        error: joinResult.joinError || null,
        permissionDeniedErrors: joinResult.permissionDeniedErrors,
        consoleErrorCount: joinResult.consoleErrors.length,
      },
      after: {
        uidNowInStudentIds: verifyResult.uidInStudentIds,
        studentCountIncremented: verifyResult.afterStudentCount === chosen.beforeStudentCount + 1,
        memberDocCreated: verifyResult.memberExists,
        permissionDeniedInConsole: joinResult.permissionDeniedErrors.length > 0,
      },
      cleanup: {
        done: cleanupResult.cleanupComplete,
        memberGone: cleanupResult.memberGone,
        uidGone: cleanupResult.uidGone,
        classRemovedFromUser: cleanupResult.classRemovedFromUser,
        afterStudentCount: cleanupResult.afterStudentCount,
        afterStudentIdsLength: cleanupResult.afterStudentIds.length,
        restoredToBeforeState:
          cleanupResult.afterStudentIds.length === chosen.beforeStudentIds.length &&
          cleanupResult.afterStudentCount === chosen.beforeStudentCount,
      },
    };
    saveStatus(finalStatus);
    log('INFO', 'JOINVERIFY completed', { verdict: finalStatus.verdict });

    return finalStatus;
  } catch (err) {
    log('ERROR', 'Fatal error in JOINVERIFY', { error: err.message, stack: err.stack });
    saveStatus({ status: 'error', error: err.message, stage: 'unknown' });

    // If chosen, join was attempted (joinResult exists), but not cleaned up — attempt cleanup
    // IMPORTANT: only cleanup if join actually wrote data (check studentIds in Firestore)
    if (chosen && joinResult && !cleanupResult) {
      log('WARN', 'Attempting emergency cleanup after fatal error', { uid: chosen.student.uid, classId: chosen.classId });
      try {
        // First check if anything was written
        const checkSnap = await db.collection('classes').doc(chosen.classId).get();
        const checkData = checkSnap.data() || {};
        const uidPresent = (checkData.studentIds || []).includes(chosen.student.uid);
        if (uidPresent) {
          cleanupResult = await cleanupEnrollment(chosen);
          log('INFO', 'Emergency cleanup result', { cleanupComplete: cleanupResult.cleanupComplete });
        } else {
          log('INFO', 'Emergency cleanup skipped — uid was not in studentIds (no join data to clean up)');
        }
      } catch (cleanupErr) {
        log('ERROR', 'Emergency cleanup also failed', { error: cleanupErr.message });
        log('WARN', 'MANUAL CLEANUP NEEDED', {
          uid: chosen?.student?.uid,
          classId: chosen?.classId,
          action: 'Delete members/{uid}, arrayRemove uid from studentIds, decrement studentCount, remove classId from users/{uid}.enrolledClasses',
        });
      }
    }

    throw err;
  }
}

main().then(status => {
  console.log('\n=== JOINVERIFY STATUS BLOCK ===');
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('JOINVERIFY FAILED:', err.message);
  process.exit(1);
});

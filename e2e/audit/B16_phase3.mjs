/**
 * B16 Phase 3 — Targeted tests based on Phase 2 findings:
 * 1. Create class (proper button location)
 * 2. Join flow with NEW student (B24-F01 confirm/deny)
 * 3. Class settings edit / pace / join code regeneration
 * 4. studentIds UI discrepancy (shows 37, actual members 63)
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const BASE = 'https://vocaboostone.netlify.app'
const EVIDENCE = '/app/audit/playwright/findings/evidence/B16'
mkdirSync(EVIDENCE, { recursive: true })

let _db = null
function getDb() {
  if (_db) return _db
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf-8'))
    initializeApp({ credential: cert(sa) })
  }
  _db = getFirestore()
  return _db
}

async function loginAsTeacher(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible().catch(() => false)) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill('veterans@vocaboost.com')
  await page.getByLabel(/password/i).first().fill('veterans5944')
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$|teacher|classes)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$|teacher|classes)/, { timeout: 15000 }).catch(() => {})
  })
}

async function loginAsStudent(page, email, password) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible().catch(() => false)) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$|classes)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$|classes)/, { timeout: 15000 }).catch(() => {})
  })
}

async function waitForDashboardLoad(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('Loading...'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

async function shot(page, label) {
  const path = `${EVIDENCE}/${label}.png`
  await page.screenshot({ path, fullPage: true }).catch(e => console.error('screenshot err', e.message))
  return path
}

const results = {}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    // ===== TEST 1: Create class happy path =====
    console.log('\n=== TEST 1: Create Class ===')
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page1 = await ctx1.newPage()
    let createdClassId = null
    let createdClassName = null
    let createdJoinCode = null

    try {
      await loginAsTeacher(page1)
      await waitForDashboardLoad(page1)
      await shot(page1, 'B16_P3_S01_01_dashboard')

      // Navigate directly to create class URL or use button
      const createBtn = page1.getByRole('button', { name: /create new class/i }).first()
      const createBtnVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false)
      console.log('Create New Class button visible:', createBtnVisible)

      if (createBtnVisible) {
        await createBtn.click()
        await page1.waitForTimeout(1500)
        await shot(page1, 'B16_P3_S01_02_modal')

        const testName = `_AuditB16_${Date.now()}`
        // Find modal inputs
        const dialog = page1.getByRole('dialog').first()
        const dialogVisible = await dialog.isVisible().catch(() => false)
        console.log('Dialog/modal visible:', dialogVisible)

        // Try multiple strategies to find name input
        const nameInputStrategies = [
          () => page1.getByLabel(/class name/i).first(),
          () => dialog.locator('input[type="text"]').first(),
          () => page1.locator('input[placeholder*="name" i], input[placeholder*="class" i]').first(),
          () => page1.locator('input').first(),
        ]

        let nameInput = null
        for (const strategy of nameInputStrategies) {
          const el = strategy()
          if (await el.isVisible().catch(() => false)) {
            nameInput = el
            break
          }
        }

        if (!nameInput) {
          await shot(page1, 'B16_P3_S01_03_no_input')
          results.S01_createClass = { result: 'blocked', reason: 'Name input not found in create modal' }
        } else {
          await nameInput.fill(testName)
          createdClassName = testName

          // Try filling pace/days if visible
          const daysInput = page1.getByLabel(/days per week|study days/i).first()
          if (await daysInput.isVisible().catch(() => false)) await daysInput.fill('5')

          await shot(page1, 'B16_P3_S01_04_filled')

          const saveBtn = page1.getByRole('button', { name: /save|create|confirm/i }).first()
          await saveBtn.click()
          await page1.waitForTimeout(3000)
          await shot(page1, 'B16_P3_S01_05_saved')

          // Check Firestore
          const createdSnap = await getDb().collection('classes').where('name', '==', testName).get()
          if (createdSnap.size > 0) {
            createdClassId = createdSnap.docs[0].id
            const createdData = createdSnap.docs[0].data()
            createdJoinCode = createdData.joinCode
            console.log('Created class:', createdClassId, 'joinCode:', createdJoinCode)
            await getDb().doc(`classes/${createdClassId}`).update({ _auditTestClass: true })
            results.S01_createClass = {
              result: 'pass',
              classId: createdClassId,
              joinCode: createdJoinCode,
              hasJoinCode: !!createdJoinCode,
            }
          } else {
            results.S01_createClass = { result: 'fail', reason: 'Class not in Firestore after save' }
          }
        }
      } else {
        results.S01_createClass = { result: 'blocked', reason: 'Create New Class button not visible' }
      }
    } catch (e) {
      results.S01_createClass = { result: 'error', error: e.message }
      console.error('S01 error:', e.message)
    }

    // S03: Cancel mid-create
    console.log('\n--- S03: Cancel mid-create ---')
    try {
      // Navigate back to dashboard first
      await page1.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
      await waitForDashboardLoad(page1)

      const createBtn2 = page1.getByRole('button', { name: /create new class/i }).first()
      if (await createBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createBtn2.click()
        await page1.waitForTimeout(1000)
        const escapeName = `_AUDIT_CANCEL_${Date.now()}`
        const input = page1.locator('input').first()
        if (await input.isVisible().catch(() => false)) {
          await input.fill(escapeName)
        }
        // Press Escape
        await page1.keyboard.press('Escape')
        await page1.waitForTimeout(1000)
        await shot(page1, 'B16_P3_S03_after_escape')
        const cancelSnap = await getDb().collection('classes').where('name', '==', escapeName).get()
        results.S03_cancelCreate = {
          result: cancelSnap.size === 0 ? 'pass' : 'fail',
          noClassCreated: cancelSnap.size === 0,
        }
        console.log('S03 Cancel:', results.S03_cancelCreate)
      } else {
        results.S03_cancelCreate = { result: 'blocked', reason: 'Create button not visible' }
      }
    } catch (e) {
      results.S03_cancelCreate = { result: 'error', error: e.message }
    }

    await ctx1.close()

    // ===== TEST 2: Class settings edit (S10) =====
    console.log('\n=== TEST 2: Class Settings Edit ===')
    // Use the TOP OFFLINE class (known to work) — but read-only check only
    const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
    const TOP_URL = `${BASE}/classes/${TOP_CLASS_ID}`

    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page2 = await ctx2.newPage()

    try {
      await loginAsTeacher(page2)
      await waitForDashboardLoad(page2)

      // Navigate directly to TOP class detail
      await page2.goto(TOP_URL, { waitUntil: 'domcontentloaded' })
      await page2.waitForTimeout(2500)
      await shot(page2, 'B16_P3_S10_01_top_class')

      const topClassText = await page2.textContent('body')
      console.log('TOP class detail text:', topClassText?.substring(0, 800))

      // Look for Settings button in class detail
      const settingsBtn = page2.getByRole('button', { name: /settings|edit/i }).first()
      const settingsBtnVisible = await settingsBtn.isVisible().catch(() => false)
      console.log('Settings button visible:', settingsBtnVisible)

      if (settingsBtnVisible) {
        await settingsBtn.click()
        await page2.waitForTimeout(1500)
        await shot(page2, 'B16_P3_S10_02_settings_open')
        const settingsText = await page2.textContent('body')
        console.log('Settings modal text:', settingsText?.substring(0, 1000))

        // Check what fields are in settings
        const inputs = await page2.locator('input, select, textarea').all()
        const fields = []
        for (const inp of inputs) {
          const label = await inp.getAttribute('aria-label').catch(() => '')
          const placeholder = await inp.getAttribute('placeholder').catch(() => '')
          const type = await inp.getAttribute('type').catch(() => '')
          const tagName = await inp.evaluate(el => el.tagName).catch(() => '')
          const value = await inp.inputValue().catch(() => '')
          fields.push({ tagName, type, label, placeholder, value: value.substring(0, 50) })
        }
        console.log('Settings fields:', JSON.stringify(fields, null, 2))

        // Capture pre-edit Firestore state
        const preEditDoc = await getDb().doc(`classes/${TOP_CLASS_ID}`).get()
        const preEditData = preEditDoc.data()

        // Close without editing (safety on shared class)
        await page2.keyboard.press('Escape')
        await page2.waitForTimeout(500)

        // Verify no change occurred
        const postEditDoc = await getDb().doc(`classes/${TOP_CLASS_ID}`).get()
        const postEditData = postEditDoc.data()
        const unchanged = JSON.stringify(preEditData?.assignedListIds) === JSON.stringify(postEditData?.assignedListIds)

        results.S10_classSettingsEdit = {
          result: 'partial',
          settingsFieldsFound: fields,
          assignmentsUnchangedAfterCancel: unchanged,
          note: 'Opened settings, verified fields present, closed without editing to avoid mutating shared prod class',
        }
      } else {
        results.S10_classSettingsEdit = { result: 'blocked', reason: 'Settings button not found in class detail' }
      }

      // Check join code display (S06)
      const joinCodeText = topClassText?.match(/[A-Z0-9]{6}/)?.[0]
      const joinCodeVisible = topClassText?.includes('Join Code') || topClassText?.includes('QSTRZL')
      results.S06_joinCodeDisplay = {
        result: joinCodeVisible ? 'pass' : 'partial',
        joinCodeVisible,
        codeFound: joinCodeText,
        note: 'Join code displayed in class detail page',
      }

      // Check the UI "Students enrolled: 37" vs actual members count (B24-F02)
      const enrolledCountMatch = topClassText?.match(/Students enrolled:\s*(\d+)/i)
      const displayedCount = enrolledCountMatch ? parseInt(enrolledCountMatch[1]) : null
      const actualMembersSnap = await getDb().collection(`classes/${TOP_CLASS_ID}/members`).get()
      const actualMembersCount = actualMembersSnap.size
      const topDoc = await getDb().doc(`classes/${TOP_CLASS_ID}`).get()
      const topData = topDoc.data()

      console.log('UI shows enrolled:', displayedCount)
      console.log('Firestore studentCount:', topData?.studentCount)
      console.log('Firestore studentIds count:', topData?.studentIds?.length)
      console.log('Actual members subcollection:', actualMembersCount)

      results.S08_enrollmentCountDiscrepancy = {
        uiDisplayedCount: displayedCount,
        firestoreStudentCount: topData?.studentCount,
        firestoreStudentIdsLength: topData?.studentIds?.length,
        actualMembersSubcollection: actualMembersCount,
        gap: actualMembersCount - (topData?.studentIds?.length || 0),
        uiMatchesStudentCount: displayedCount === topData?.studentCount,
        description: `UI shows ${displayedCount}, Firestore has ${topData?.studentCount} (studentCount), ${actualMembersCount} in members subcollection`,
      }
      writeFileSync(`${EVIDENCE}/B16_P3_enrollment_discrepancy.json`, JSON.stringify(results.S08_enrollmentCountDiscrepancy, null, 2))

    } catch (e) {
      results.S10_classSettingsEdit = { result: 'error', error: e.message }
      console.error('S10 error:', e.message)
    }
    await ctx2.close()

    // ===== TEST 3: Join Flow - New Student (B24-F01 definitive test) =====
    console.log('\n=== TEST 3: Join Flow - New Student (B24-F01) ===')
    const NEW_STUDENT = {
      email: 'audit_distracted_01_core@vocaboost.test',
      password: 'AuditPass2026!',
      uid: 'wPsFGQMdtJOmZ0h7MF5GlUcXKqx1',
    }
    const TOP_CLASS_ID_JOIN = 'k8tzOiiwotBbtJS3uTiv'
    const TOP_JOIN_CODE = 'QSTRZL'
    const db = getDb()

    // Verify student is NOT in TOP before test
    const preJoinMember = await db.doc(`classes/${TOP_CLASS_ID_JOIN}/members/${NEW_STUDENT.uid}`).get()
    const preJoinEnrolled = await db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID_JOIN}`).get()
    const preJoinTopDoc = await db.doc(`classes/${TOP_CLASS_ID_JOIN}`).get()
    const preTopData = preJoinTopDoc.data()

    console.log('Pre-join student state:')
    console.log('  In TOP members:', preJoinMember.exists)
    console.log('  In TOP enrolledClasses:', preJoinEnrolled.exists)
    console.log('  TOP studentCount:', preTopData?.studentCount)
    console.log('  TOP studentIds:', preTopData?.studentIds?.length)

    const preState = {
      student: NEW_STUDENT.email, uid: NEW_STUDENT.uid,
      inTopMembers: preJoinMember.exists, inTopEnrolled: preJoinEnrolled.exists,
      topStudentCount: preTopData?.studentCount, topStudentIds: preTopData?.studentIds?.length,
      capturedAt: new Date().toISOString(),
    }
    writeFileSync(`${EVIDENCE}/B16_P3_join_pre_state.json`, JSON.stringify(preState, null, 2))

    if (preJoinMember.exists || preJoinEnrolled.exists) {
      results.B24_F01_joinFlow = { result: 'blocked', reason: 'Student already in TOP — cannot test new member join' }
    } else {
      const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const joinConsoleLogs = []
      ctx3.on('console', msg => {
        const text = msg.text()
        joinConsoleLogs.push({ type: msg.type(), text: text.substring(0, 500) })
        if (msg.type() === 'error' || text.toLowerCase().includes('permission') || text.toLowerCase().includes('firestore')) {
          console.log(`[BROWSER ${msg.type()}] ${text.substring(0, 300)}`)
        }
      })
      const page3 = await ctx3.newPage()

      try {
        await loginAsStudent(page3, NEW_STUDENT.email, NEW_STUDENT.password)
        // Wait for student dashboard to load
        await page3.waitForTimeout(3000)
        await shot(page3, 'B16_P3_join_01_student_dash')

        const studentDashText = await page3.textContent('body')
        console.log('Student dashboard:', studentDashText?.substring(0, 600))

        // Look for join code input
        await page3.waitForSelector('input[placeholder="ABC123"]', { timeout: 10000 }).catch(() => {
          console.log('ABC123 input not found within 10s')
        })

        const joinInput = page3.locator('input[placeholder="ABC123"]').first()
        const joinInputVisible = await joinInput.isVisible().catch(() => false)
        console.log('Join input (ABC123) visible:', joinInputVisible)

        if (!joinInputVisible) {
          // Capture full dashboard state
          await shot(page3, 'B16_P3_join_02_no_input')
          const allInputs = await page3.locator('input').all()
          console.log('All inputs:', allInputs.length)
          for (const inp of allInputs) {
            const ph = await inp.getAttribute('placeholder').catch(() => '')
            console.log(`  input placeholder: "${ph}"`)
          }
          results.B24_F01_joinFlow = { result: 'blocked', reason: 'ABC123 join input not visible on student dashboard' }
        } else {
          await joinInput.fill(TOP_JOIN_CODE)
          await shot(page3, 'B16_P3_join_03_code_entered')

          // Find join button
          const joinBtn = page3.locator('button').filter({ hasText: /^join$/i }).first()
          const joinBtnVisible = await joinBtn.isVisible().catch(() => false)
          console.log('Join button visible:', joinBtnVisible)

          if (joinBtnVisible) {
            await joinBtn.click()
          } else {
            await joinInput.press('Enter')
          }

          // Wait for join to process
          await page3.waitForTimeout(5000)
          await shot(page3, 'B16_P3_join_04_post_join')

          const postDashText = await page3.textContent('body')
          console.log('Post-join dashboard:', postDashText?.substring(0, 700))

          // Check Firestore
          const postMember = await db.doc(`classes/${TOP_CLASS_ID_JOIN}/members/${NEW_STUDENT.uid}`).get()
          const postEnrolled = await db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID_JOIN}`).get()
          const postTopDoc = await db.doc(`classes/${TOP_CLASS_ID_JOIN}`).get()
          const postTopData = postTopDoc.data()

          console.log('\nPost-join Firestore:')
          console.log('  In TOP members:', postMember.exists, postMember.exists ? JSON.stringify(postMember.data()) : '')
          console.log('  In TOP enrolledClasses:', postEnrolled.exists, postEnrolled.exists ? JSON.stringify(postEnrolled.data()) : '')
          console.log('  TOP studentCount:', postTopData?.studentCount)
          console.log('  TOP studentIds:', postTopData?.studentIds?.length)

          const uiShowsTop = postDashText?.includes('TOP') || postDashText?.includes('k8tzOiiwotBbtJS3uTiv')

          const postState = {
            student: NEW_STUDENT.email, uid: NEW_STUDENT.uid,
            joinCodeUsed: TOP_JOIN_CODE,
            memberWritten: postMember.exists,
            memberData: postMember.exists ? postMember.data() : null,
            enrolledClassesUpdated: postEnrolled.exists,
            enrolledData: postEnrolled.exists ? postEnrolled.data() : null,
            topStudentCount: postTopData?.studentCount,
            topStudentIds: postTopData?.studentIds?.length,
            studentCountIncremented: postTopData?.studentCount > preTopData?.studentCount,
            studentIdsUpdated: postTopData?.studentIds?.includes(NEW_STUDENT.uid),
            uiShowsTopClass: uiShowsTop,
            consoleErrors: joinConsoleLogs.filter(l => l.type === 'error'),
            capturedAt: new Date().toISOString(),
          }
          writeFileSync(`${EVIDENCE}/B16_P3_join_post_state.json`, JSON.stringify(postState, null, 2))
          writeFileSync(`${EVIDENCE}/B16_P3_join_console.json`, JSON.stringify(joinConsoleLogs, null, 2))

          // RESULT ANALYSIS - THE CRITICAL B24-F01 CHECK
          if (postEnrolled.exists && postMember.exists && postTopData?.studentIds?.includes(NEW_STUDENT.uid)) {
            results.B24_F01_joinFlow = {
              result: 'pass',
              finding: 'JOIN SUCCEEDED FOR NEW STUDENT — B24-F01 appears to be fixed OR did not reproduce',
              details: postState,
            }
            console.log('✅ B24-F01: Join SUCCEEDED for new student')
          } else if (postMember.exists && !postEnrolled.exists) {
            results.B24_F01_joinFlow = {
              result: 'fail',
              severity: 'HIGH',
              finding: 'B24-F01 CONFIRMED: members subcollection written but enrolledClasses NOT updated — phantom enrollment',
              details: postState,
            }
            console.log('❌ B24-F01 CONFIRMED: Phantom enrollment')
          } else if (!postMember.exists && !postEnrolled.exists) {
            // Check if there was a UI error message
            const hasErrorText = postDashText?.match(/error|invalid|not found|failed/i)
            results.B24_F01_joinFlow = {
              result: 'fail',
              finding: 'Join silently failed — no Firestore writes at all',
              uiError: hasErrorText ? 'Error text found in UI' : 'No error shown to user',
              details: postState,
            }
            console.log('❌ Join silently failed — no writes')
          } else if (!postEnrolled.exists && !postMember.exists) {
            results.B24_F01_joinFlow = {
              result: 'partial',
              finding: 'Inconclusive join result',
              details: postState,
            }
          }

          // CLEANUP
          console.log('\nCleaning up join test...')
          const batch = db.batch()
          if (postMember.exists) {
            batch.delete(db.doc(`classes/${TOP_CLASS_ID_JOIN}/members/${NEW_STUDENT.uid}`))
            console.log('  Will delete member doc')
          }
          if (postEnrolled.exists) {
            batch.delete(db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID_JOIN}`))
            console.log('  Will delete enrolledClasses doc')
          }
          await batch.commit().catch(e => console.error('Cleanup batch error:', e.message))

          // Revert studentCount/studentIds if changed
          if (postTopData?.studentCount > preTopData?.studentCount || postTopData?.studentIds?.includes(NEW_STUDENT.uid)) {
            await db.doc(`classes/${TOP_CLASS_ID_JOIN}`).update({
              studentCount: FieldValue.increment(-1),
              studentIds: FieldValue.arrayRemove(NEW_STUDENT.uid),
            }).catch(e => console.error('Cleanup count error:', e.message))
            console.log('  Reverted studentCount/studentIds')
          }
          console.log('Cleanup complete')
        }
      } catch (e) {
        results.B24_F01_joinFlow = { result: 'error', error: e.message }
        console.error('Join flow error:', e.message)
      }
      await ctx3.close()
    }

    // ===== TEST 4: Source code review of joinClass + firestore.rules =====
    console.log('\n=== TEST 4: Source Code Analysis ===')
    try {
      const dbJs = readFileSync('./src/services/db.js', 'utf-8')
      // Extract joinClass function
      const joinClassIdx = dbJs.indexOf('joinClass')
      if (joinClassIdx !== -1) {
        const joinClassCode = dbJs.substring(joinClassIdx, joinClassIdx + 3000)
        console.log('joinClass code excerpt:')
        console.log(joinClassCode.substring(0, 2000))
        results.joinClassSourceCode = joinClassCode.substring(0, 2000)
        writeFileSync(`${EVIDENCE}/B16_P3_joinClass_code.txt`, joinClassCode)
      }
    } catch (e) {
      console.log('Cannot read db.js:', e.message)
    }

    try {
      const rules = readFileSync('./firestore.rules', 'utf-8')
      console.log('\nFirestore rules:')
      console.log(rules)
      results.firestoreRulesSnippet = rules
      writeFileSync(`${EVIDENCE}/B16_P3_firestore_rules.txt`, rules)
    } catch (e) {
      console.log('Cannot read firestore.rules:', e.message)
    }

    // ===== TEST 5: Cleanup created test class =====
    if (createdClassId) {
      console.log('\n=== Cleaning up created test class ===')
      try {
        const members = await getDb().collection(`classes/${createdClassId}/members`).get()
        const batch = getDb().batch()
        members.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
        await getDb().doc(`classes/${createdClassId}`).delete()
        console.log('Deleted test class:', createdClassId)
      } catch (e) {
        console.error('Cleanup error:', e.message)
      }
    }

    // Write final results
    writeFileSync(`${EVIDENCE}/B16_P3_all_results.json`, JSON.stringify(results, null, 2))
    console.log('\n=== B16 Phase 3 Complete ===')
    console.log(JSON.stringify(results, null, 2))

  } finally {
    await browser.close()
  }

  return results
}

main().catch(e => {
  console.error('Phase 3 fatal:', e)
  process.exit(1)
})

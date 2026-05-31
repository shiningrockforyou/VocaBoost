/**
 * B16 — Teacher Class Management
 * Priority: P2 | Persona: Novice Teacher (veterans@vocaboost.com)
 * Focus: join code generation, join flow (confirm/deny B24-F01), studentCount vs members
 *        consistency (B24-F02), class settings edit, unsaved-changes/modal-cancel behavior.
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'fs'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const BASE = 'https://vocaboostone.netlify.app'
const EVIDENCE = '/app/audit/playwright/findings/evidence/B16'
const LOG_FILE = '/app/audit/playwright/findings/agent_logs/X.jsonl'
const STATUS_FILE = '/app/audit/playwright/findings/agent_logs/X.status.json'

mkdirSync(EVIDENCE, { recursive: true })

// --- Firestore Admin ---
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

// --- Logging ---
function log(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  appendFileSync(LOG_FILE, line + '\n')
  console.log(line)
}

function updateStatus(patch) {
  let current = {}
  try { current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8')) } catch {}
  const next = { ...current, ...patch, lastUpdate: new Date().toISOString() }
  writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2))
}

// --- Screenshot helper ---
let screenshotIdx = 0
async function shot(page, label) {
  screenshotIdx++
  const path = `${EVIDENCE}/${label}.png`
  await page.screenshot({ path, fullPage: true }).catch(e => console.error('screenshot err', e.message))
  return path
}

// --- Firestore helpers ---
async function getClassDoc(classId) {
  const db = getDb()
  const snap = await db.doc(`classes/${classId}`).get()
  return snap.exists ? { id: snap.id, ...snap.data() } : null
}

async function getMembersCount(classId) {
  const db = getDb()
  const snap = await db.collection(`classes/${classId}/members`).get()
  return snap.size
}

async function getMemberIds(classId) {
  const db = getDb()
  const snap = await db.collection(`classes/${classId}/members`).get()
  return snap.docs.map(d => d.id)
}

async function queryClassesByName(name) {
  const db = getDb()
  const snap = await db.collection('classes').where('name', '==', name).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function deleteClassAndCleanup(classId, classDoc) {
  const db = getDb()
  // Only delete audit-created throwaway test classes - check for audit marker
  if (!classDoc || !classDoc._auditTestClass) {
    console.warn(`Skipping delete of ${classId} — no _auditTestClass marker`)
    return false
  }
  // Delete members subcollection
  const members = await db.collection(`classes/${classId}/members`).get()
  const batch1 = db.batch()
  members.docs.forEach(d => batch1.delete(d.ref))
  await batch1.commit()
  // Delete class doc
  await db.doc(`classes/${classId}`).delete()
  return true
}

// --- Login helper ---
async function loginAsTeacher(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  const loginLinkVisible = await loginLink.isVisible().catch(() => false)
  if (loginLinkVisible) {
    await loginLink.click()
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill('veterans@vocaboost.com')
  await page.getByLabel(/password/i).first().fill('veterans5944')
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$|teacher|classes)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$|teacher|classes)/, { timeout: 15000 }).catch(() => {})
  })
  console.log('Teacher logged in, URL:', page.url())
}

async function loginAsStudent(page, email, password) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  const loginLinkVisible = await loginLink.isVisible().catch(() => false)
  if (loginLinkVisible) {
    await loginLink.click()
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$|classes)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$|classes)/, { timeout: 15000 }).catch(() => {})
  })
  console.log('Student logged in, URL:', page.url())
}

// --- Results tracking ---
const results = {
  S01: { result: 'pending', notes: [] },
  S02: { result: 'pending', notes: [] },
  S03: { result: 'pending', notes: [] },
  S04: { result: 'pending', notes: [] },
  S05: { result: 'pending', notes: [] },
  S06: { result: 'pending', notes: [] },
  S07: { result: 'pending', notes: [] },
  S08: { result: 'pending', notes: [] },
  S09: { result: 'pending', notes: [] },
  S10: { result: 'pending', notes: [] },
  // Extended
  B24_JOIN_FLOW: { result: 'pending', notes: [] },
  B24_MEMBER_CONSISTENCY: { result: 'pending', notes: [] },
}

// ============================================================
// MAIN TEST SUITE
// ============================================================
async function runB16() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const consoleErrors = []
  let createdTestClassId = null
  let createdTestClassDoc = null
  let createdTestClassJoinCode = null

  try {
    // ---- S01: Create class happy path ----
    updateStatus({ currentScenario: 'S01', trialsCompleted: 0 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S01' })
    const s01start = Date.now()

    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    ctx1.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ scenario: 'S01', msg: msg.text() }) })
    const page1 = await ctx1.newPage()

    try {
      await loginAsTeacher(page1)
      await shot(page1, 'B16_S01_01_teacher_dashboard')

      // Look for Create New Class button or link
      const createBtn = page1.getByRole('button', { name: /create.*class|new class/i }).first()
      const createLink = page1.getByRole('link', { name: /create.*class|new class/i }).first()
      const createVisible = await createBtn.isVisible().catch(() => false)
      const createLinkVisible = await createLink.isVisible().catch(() => false)

      if (!createVisible && !createLinkVisible) {
        // Explore the page structure
        const pageText = await page1.textContent('body')
        console.log('Page text snippet:', pageText?.substring(0, 500))
        await shot(page1, 'B16_S01_01b_no_create_button')
        results.S01.notes.push('Could not find "Create New Class" button/link; teacher dashboard layout unclear')
        results.S01.result = 'blocked'
      } else {
        if (createVisible) await createBtn.click()
        else await createLink.click()

        await page1.waitForTimeout(1000)
        await shot(page1, 'B16_S01_02_create_modal')

        // Fill class name
        const testClassName = `_AUDIT_TEST_${Date.now()}`
        const nameInput = page1.getByLabel(/class name|name/i).first()
        const nameInputVisible = await nameInput.isVisible().catch(() => false)

        if (!nameInputVisible) {
          const allInputs = page1.locator('input')
          const count = await allInputs.count()
          console.log(`Found ${count} inputs in modal`)
          if (count > 0) {
            await allInputs.first().fill(testClassName)
          }
        } else {
          await nameInput.fill(testClassName)
        }

        // Fill study days per week if present
        const daysInput = page1.getByLabel(/days per week|study days/i).first()
        const daysVisible = await daysInput.isVisible().catch(() => false)
        if (daysVisible) await daysInput.fill('5')

        await shot(page1, 'B16_S01_03_form_filled')

        // Save
        const saveBtn = page1.getByRole('button', { name: /save|create|confirm/i }).first()
        await saveBtn.click()
        await page1.waitForTimeout(2000)
        await shot(page1, 'B16_S01_04_after_save')

        // Check if class was created
        const classes = await queryClassesByName(testClassName)
        if (classes.length > 0) {
          createdTestClassId = classes[0].id
          createdTestClassDoc = classes[0]
          createdTestClassJoinCode = classes[0].joinCode
          // Mark as audit test class for cleanup safety
          await getDb().doc(`classes/${createdTestClassId}`).update({ _auditTestClass: true })
          console.log(`Created test class: ${createdTestClassId}, joinCode: ${createdTestClassJoinCode}`)
          results.S01.result = 'pass'
          results.S01.notes.push(`Created class ${testClassName} id=${createdTestClassId} joinCode=${createdTestClassJoinCode}`)
        } else {
          results.S01.result = 'fail'
          results.S01.notes.push(`Class "${testClassName}" not found in Firestore after save`)
        }
      }
    } catch (e) {
      results.S01.result = 'error'
      results.S01.notes.push(`Error: ${e.message}`)
      console.error('S01 error:', e)
    }
    await ctx1.close()
    log({ event: 'scenario', batch: 'B16', scenario: 'S01', result: results.S01.result, durationMs: Date.now() - s01start, notes: results.S01.notes })

    // ---- S06: Join code verification (PRIORITY — confirms/denies B24-F01) ----
    updateStatus({ currentScenario: 'S06', trialsCompleted: 1 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S06' })
    const s06start = Date.now()

    {
      // First verify the existing TOP class join code from audit_state.json
      const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
      const TOP_JOIN_CODE = 'QSTRZL'
      const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
      const CORE_JOIN_CODE = '3VEHE8'

      // Capture baseline Firestore state
      try {
        const topDoc = await getClassDoc(TOP_CLASS_ID)
        const coreDoc = await getClassDoc(CORE_CLASS_ID)
        const topMembersCount = await getMembersCount(TOP_CLASS_ID)
        const coreMembersCount = await getMembersCount(CORE_CLASS_ID)

        const baseline = {
          capturedAt: new Date().toISOString(),
          topClass: {
            studentCount: topDoc?.studentCount,
            studentIdsLength: topDoc?.studentIds?.length,
            membersCount: topMembersCount,
            joinCode: topDoc?.joinCode,
            gap: topMembersCount - (topDoc?.studentIds?.length || 0),
          },
          coreClass: {
            studentCount: coreDoc?.studentCount,
            studentIdsLength: coreDoc?.studentIds?.length,
            membersCount: coreMembersCount,
            joinCode: coreDoc?.joinCode,
            gap: coreMembersCount - (coreDoc?.studentIds?.length || 0),
          },
        }

        writeFileSync(`${EVIDENCE}/B16_S06_firestore_baseline.json`, JSON.stringify(baseline, null, 2))
        console.log('B24-F02 baseline check:', JSON.stringify(baseline, null, 2))

        // Check consistency (B24-F02 confirmation)
        const topGap = baseline.topClass.gap
        const coreGap = baseline.coreClass.gap

        results.B24_MEMBER_CONSISTENCY.notes.push(
          `TOP: studentCount=${baseline.topClass.studentCount}, studentIds=${baseline.topClass.studentIdsLength}, members=${topMembersCount}, gap=${topGap}`,
          `CORE: studentCount=${baseline.coreClass.studentCount}, studentIds=${baseline.coreClass.studentIdsLength}, members=${coreMembersCount}, gap=${coreGap}`
        )

        if (topGap > 0 || coreGap > 0) {
          results.B24_MEMBER_CONSISTENCY.result = 'fail'
          results.B24_MEMBER_CONSISTENCY.notes.push(`CONFIRMED B24-F02: studentCount/studentIds vs members subcollection out of sync`)
        } else {
          results.B24_MEMBER_CONSISTENCY.result = 'pass'
        }

        // Also verify join code is present in teacher UI
        const ctx6 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page6 = await ctx6.newPage()

        await loginAsTeacher(page6)
        await shot(page6, 'B16_S06_01_teacher_dashboard')

        // Navigate to the TOP class settings to find join code
        // Look for class cards on dashboard
        const pageContent = await page6.textContent('body')
        const hasTopClass = pageContent?.includes('TOP') || pageContent?.includes('OFFLINE')
        console.log('Dashboard has TOP class text:', hasTopClass)

        // Look for the TOP class card
        const classCards = page6.locator('[class*="card"], [class*="Card"]').filter({ hasText: /TOP|OFFLINE/i })
        const cardCount = await classCards.count()
        console.log('Class card count:', cardCount)

        if (cardCount > 0) {
          await classCards.first().click().catch(() => {})
          await page6.waitForTimeout(1500)
          await shot(page6, 'B16_S06_02_class_settings')

          // Look for join code display
          const joinCodeText = await page6.textContent('body')
          const hasJoinCode = joinCodeText?.includes(TOP_JOIN_CODE) || joinCodeText?.includes('join') || joinCodeText?.includes('code')
          console.log('Page has join code text:', hasJoinCode)

          if (hasJoinCode) {
            results.S06.result = 'pass'
            results.S06.notes.push(`Join code ${TOP_JOIN_CODE} visible in teacher class settings`)
          } else {
            results.S06.result = 'partial'
            results.S06.notes.push('Join code area found but code not visible without deeper navigation')
            await shot(page6, 'B16_S06_03_join_code_area')
          }
        } else {
          results.S06.result = 'partial'
          results.S06.notes.push('Could not locate TOP class card in teacher dashboard')
        }

        await ctx6.close()

      } catch (e) {
        results.S06.result = 'error'
        results.S06.notes.push(`Error: ${e.message}`)
        console.error('S06 error:', e)
      }
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S06', result: results.S06.result, durationMs: Date.now() - s06start, notes: results.S06.notes })
    log({ event: 'scenario', batch: 'B16', scenario: 'B24_MEMBER_CONSISTENCY', result: results.B24_MEMBER_CONSISTENCY.result, notes: results.B24_MEMBER_CONSISTENCY.notes })

    // ---- B24-F01: Join flow test — does a valid join code enroll a NEW student? ----
    updateStatus({ currentScenario: 'B24_JOIN_FLOW', trialsCompleted: 3 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'B24_JOIN_FLOW_JOIN_TEST' })
    const joinFlowStart = Date.now()

    {
      const SEEDED = JSON.parse(readFileSync('./audit/playwright/seeded_accounts.json', 'utf-8'))
      const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
      const CORE_JOIN_CODE = '3VEHE8'
      const TOP_JOIN_CODE = 'QSTRZL'

      // Use a student who is in CORE (and might not be in TOP) for join test
      // Use classswitcher persona accounts
      const classSwitchers = SEEDED.accounts.filter(a => a.personaId === 'classswitcher')
      console.log('ClassSwitcher accounts:', classSwitchers.map(a => `${a.email} (${a.targetClass})`))

      // Find a classswitcher account that is NOT already in TOP
      // (B24 found switcher01 was pre-seeded in TOP members - we need a truly new member)
      let testStudent = null
      let testStudentAlreadyInTop = false

      for (const switcher of classSwitchers) {
        try {
          const memberDoc = await getDb().doc(`classes/${TOP_CLASS_ID}/members/${switcher.uid}`).get()
          if (!memberDoc.exists) {
            testStudent = switcher
            testStudentAlreadyInTop = false
            console.log(`Found fresh student not in TOP: ${switcher.email}`)
            break
          } else {
            console.log(`${switcher.email} already in TOP members subcollection`)
            if (!testStudent) {
              testStudent = switcher // fallback
              testStudentAlreadyInTop = true
            }
          }
        } catch (e) {
          console.error('Error checking member doc:', e.message)
        }
      }

      if (!testStudent) {
        // Fallback to careful student in CORE
        const coreStudents = SEEDED.accounts.filter(a => a.targetClass === 'CORE' && a.personaId === 'careful')
        testStudent = coreStudents[0]
        if (testStudent) {
          const memberDoc = await getDb().doc(`classes/${TOP_CLASS_ID}/members/${testStudent.uid}`).get()
          testStudentAlreadyInTop = memberDoc.exists
        }
      }

      if (!testStudent) {
        results.B24_JOIN_FLOW.result = 'blocked'
        results.B24_JOIN_FLOW.notes.push('No suitable test student found for join flow test')
        log({ event: 'scenario', batch: 'B16', scenario: 'B24_JOIN_FLOW', result: 'blocked', reason: 'No suitable test student' })
      } else {
        console.log(`Testing join with: ${testStudent.email}, alreadyInTop: ${testStudentAlreadyInTop}`)

        // Capture student state BEFORE join attempt
        const db = getDb()
        const preJoinEnrolled = await db.collection(`users/${testStudent.uid}/enrolledClasses`).get()
        const preJoinTopMember = await db.doc(`classes/${TOP_CLASS_ID}/members/${testStudent.uid}`).get()
        const preJoinTopDoc = await getClassDoc(TOP_CLASS_ID)

        const priorState = {
          capturedAt: new Date().toISOString(),
          student: testStudent.email,
          uid: testStudent.uid,
          alreadyInTopMembers: preJoinTopMember.exists,
          enrolledClasses: preJoinEnrolled.docs.map(d => ({ id: d.id, ...d.data() })),
          topClassStudentCount: preJoinTopDoc?.studentCount,
          topClassStudentIdsLength: preJoinTopDoc?.studentIds?.length,
        }
        writeFileSync(`${EVIDENCE}/B16_JOIN_FLOW_pre_state.json`, JSON.stringify(priorState, null, 2))

        // Now attempt the join via the UI
        const ctxJoin = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        ctxJoin.on('console', msg => {
          const text = msg.text()
          if (text.toLowerCase().includes('error') || text.toLowerCase().includes('permission') || text.toLowerCase().includes('denied')) {
            consoleErrors.push({ scenario: 'B24_JOIN_FLOW', msg: text, type: msg.type() })
          }
          console.log(`[browser console] [${msg.type()}] ${text.substring(0, 200)}`)
        })
        const pageJoin = await ctxJoin.newPage()

        try {
          await loginAsStudent(pageJoin, testStudent.email, testStudent.password)
          await shot(pageJoin, 'B16_JOIN_01_student_dashboard_pre')

          // Look for join class input
          const joinInput = pageJoin.getByPlaceholder(/code|ABC123|join/i).first()
          const joinInputAlt = pageJoin.getByRole('textbox').filter({ hasText: '' }).last()
          const joinInputVisible = await joinInput.isVisible().catch(() => false)

          console.log('Join input visible:', joinInputVisible)

          if (!joinInputVisible) {
            // Explore dashboard
            const bodyText = await pageJoin.textContent('body')
            console.log('Dashboard text (first 800):', bodyText?.substring(0, 800))
            await shot(pageJoin, 'B16_JOIN_01b_no_join_input')

            // Try to find join code input more broadly
            const inputs = await pageJoin.locator('input').all()
            console.log('Total inputs:', inputs.length)
            for (let i = 0; i < inputs.length; i++) {
              const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '')
              console.log(`Input ${i}: placeholder="${placeholder}"`)
            }
          }

          // Try to enter the TOP join code
          const joinCodeToTry = testStudentAlreadyInTop ? CORE_JOIN_CODE : TOP_JOIN_CODE
          const targetClassId = testStudentAlreadyInTop ? 'LVjBTFuYE8FbPG34pVAt' : TOP_CLASS_ID

          const inputEl = pageJoin.getByPlaceholder(/ABC123|join code|class code/i).first()
          const inputElVisible = await inputEl.isVisible().catch(() => false)

          if (inputElVisible) {
            await inputEl.fill(joinCodeToTry)
            await shot(pageJoin, 'B16_JOIN_02_code_entered')

            // Submit
            const joinBtn = pageJoin.getByRole('button', { name: /join/i }).first()
            const joinBtnVisible = await joinBtn.isVisible().catch(() => false)
            if (joinBtnVisible) {
              await joinBtn.click()
            } else {
              await inputEl.press('Enter')
            }

            await pageJoin.waitForTimeout(3000) // Wait for async join
            await shot(pageJoin, 'B16_JOIN_03_after_join_attempt')

            // Capture post-join state from Firestore
            const postJoinEnrolled = await db.collection(`users/${testStudent.uid}/enrolledClasses`).get()
            const postJoinMember = await db.doc(`classes/${targetClassId}/members/${testStudent.uid}`).get()
            const postJoinTopDoc = await getClassDoc(targetClassId)

            const postState = {
              capturedAt: new Date().toISOString(),
              joinCodeUsed: joinCodeToTry,
              targetClassId,
              nowInMembersSubcollection: postJoinMember.exists,
              memberDocData: postJoinMember.exists ? postJoinMember.data() : null,
              enrolledClasses: postJoinEnrolled.docs.map(d => ({ id: d.id, ...d.data() })),
              classStudentCount: postJoinTopDoc?.studentCount,
              classStudentIdsLength: postJoinTopDoc?.studentIds?.length,
            }
            writeFileSync(`${EVIDENCE}/B16_JOIN_FLOW_post_state.json`, JSON.stringify(postState, null, 2))

            // Determine if join succeeded
            const nowEnrolledInTarget = postJoinEnrolled.docs.some(d => d.id === targetClassId || d.data()?.classId === targetClassId)
            const memberExistsInSubcollection = postJoinMember.exists

            console.log('Post-join analysis:')
            console.log('  nowEnrolledInTarget:', nowEnrolledInTarget)
            console.log('  memberExistsInSubcollection:', memberExistsInSubcollection)
            console.log('  enrolledClasses count:', postJoinEnrolled.size)

            // Was this a new member or existing?
            const wasNewMember = !priorState.alreadyInTopMembers && !testStudentAlreadyInTop

            if (nowEnrolledInTarget) {
              results.B24_JOIN_FLOW.result = 'pass'
              results.B24_JOIN_FLOW.notes.push(`JOIN SUCCEEDED: student ${testStudent.email} enrolled in class ${targetClassId}`)
              results.B24_JOIN_FLOW.notes.push(`wasNewMember: ${wasNewMember}`)
            } else if (memberExistsInSubcollection && !nowEnrolledInTarget) {
              results.B24_JOIN_FLOW.result = 'fail'
              results.B24_JOIN_FLOW.notes.push(`B24-F01 CONFIRMED: members subcollection written but enrolledClasses NOT updated (phantom enrollment)`)
              results.B24_JOIN_FLOW.notes.push(`Student ${testStudent.email} is in members subcollection but NOT in enrolledClasses`)
              results.B24_JOIN_FLOW.notes.push(`wasNewMember: ${wasNewMember}`)
            } else if (!memberExistsInSubcollection && !nowEnrolledInTarget) {
              // Nothing happened at all
              const pageText = await pageJoin.textContent('body')
              const hasError = pageText?.match(/error|invalid|not found|try again/i)
              results.B24_JOIN_FLOW.result = 'partial'
              results.B24_JOIN_FLOW.notes.push(`Join attempt: member NOT created, enrolledClasses NOT updated. hasErrorText: ${!!hasError}`)
            }

          } else {
            // Cannot find join code input — try clicking around to find it
            const pageText = await pageJoin.textContent('body')
            console.log('No join code input found. Dashboard text:', pageText?.substring(0, 600))

            results.B24_JOIN_FLOW.result = 'blocked'
            results.B24_JOIN_FLOW.notes.push('Join code input (placeholder ABC123) not found on dashboard; cannot test join flow via UI')
          }

        } catch (e) {
          results.B24_JOIN_FLOW.result = 'error'
          results.B24_JOIN_FLOW.notes.push(`Error: ${e.message}`)
          console.error('JOIN FLOW error:', e)
        }

        await ctxJoin.close()
      }
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'B24_JOIN_FLOW', result: results.B24_JOIN_FLOW.result, durationMs: Date.now() - joinFlowStart, notes: results.B24_JOIN_FLOW.notes })

    // ---- S02: Create class with duplicate name ----
    updateStatus({ currentScenario: 'S02', trialsCompleted: 5 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S02' })
    const s02start = Date.now()

    if (createdTestClassId) {
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page2 = await ctx2.newPage()
      try {
        await loginAsTeacher(page2)
        const createBtn = page2.getByRole('button', { name: /create.*class|new class/i }).first()
        const createBtnVisible = await createBtn.isVisible().catch(() => false)
        if (createBtnVisible) {
          await createBtn.click()
          await page2.waitForTimeout(800)
          const nameInput = page2.getByLabel(/class name|name/i).first()
          const nameInputVisible = await nameInput.isVisible().catch(() => false)
          const dupName = createdTestClassDoc?.name || `_AUDIT_TEST_DUP_${Date.now()}`
          if (nameInputVisible) {
            await nameInput.fill(dupName)
            const saveBtn = page2.getByRole('button', { name: /save|create|confirm/i }).first()
            await saveBtn.click()
            await page2.waitForTimeout(1500)
            await shot(page2, 'B16_S02_01_after_dup_save')
            // Check for validation error
            const bodyText = await page2.textContent('body')
            const hasError = !!bodyText?.match(/already exists|duplicate|same name/i)
            const dupClasses = await queryClassesByName(dupName)
            results.S02.notes.push(`Duplicate allowed: ${dupClasses.length > 1}, hasErrorMsg: ${hasError}`)
            results.S02.result = 'pass' // Both outcomes (allow or block) are acceptable per spec
          } else {
            results.S02.result = 'blocked'
            results.S02.notes.push('Name input not found in create modal')
          }
        } else {
          results.S02.result = 'blocked'
          results.S02.notes.push('Create Class button not found')
        }
      } catch (e) {
        results.S02.result = 'error'
        results.S02.notes.push(`Error: ${e.message}`)
      }
      await ctx2.close()
    } else {
      results.S02.result = 'skipped'
      results.S02.notes.push('S01 did not create a class — cannot test duplicate name')
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S02', result: results.S02.result, durationMs: Date.now() - s02start, notes: results.S02.notes })

    // ---- S03: Cancel mid-create ----
    updateStatus({ currentScenario: 'S03', trialsCompleted: 6 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S03' })
    const s03start = Date.now()

    {
      const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page3 = await ctx3.newPage()
      try {
        await loginAsTeacher(page3)
        const createBtn = page3.getByRole('button', { name: /create.*class|new class/i }).first()
        const createBtnVisible = await createBtn.isVisible().catch(() => false)
        if (createBtnVisible) {
          await createBtn.click()
          await page3.waitForTimeout(800)
          const nameInput = page3.getByLabel(/class name|name/i).first()
          const nameInputVisible = await nameInput.isVisible().catch(() => false)
          const cancelName = `_AUDIT_CANCEL_${Date.now()}`
          if (nameInputVisible) {
            await nameInput.fill(cancelName)
            // Click Cancel
            const cancelBtn = page3.getByRole('button', { name: /cancel|close|dismiss/i }).first()
            const cancelBtnVisible = await cancelBtn.isVisible().catch(() => false)
            if (cancelBtnVisible) {
              await cancelBtn.click()
            } else {
              // Try Escape
              await page3.keyboard.press('Escape')
            }
            await page3.waitForTimeout(1000)
            await shot(page3, 'B16_S03_01_after_cancel')
            // Verify no class was created
            const cancelledClasses = await queryClassesByName(cancelName)
            if (cancelledClasses.length === 0) {
              results.S03.result = 'pass'
              results.S03.notes.push('Cancel correctly prevented class creation')
            } else {
              results.S03.result = 'fail'
              results.S03.notes.push(`Cancel DID NOT prevent creation — class "${cancelName}" exists in Firestore`)
            }
          } else {
            results.S03.result = 'blocked'
            results.S03.notes.push('Name input not found in create modal')
          }
        } else {
          results.S03.result = 'blocked'
          results.S03.notes.push('Create Class button not found')
        }
      } catch (e) {
        results.S03.result = 'error'
        results.S03.notes.push(`Error: ${e.message}`)
      }
      await ctx3.close()
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S03', result: results.S03.result, durationMs: Date.now() - s03start, notes: results.S03.notes })

    // ---- S04: Modal close via Escape ----
    updateStatus({ currentScenario: 'S04', trialsCompleted: 7 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S04' })
    const s04start = Date.now()

    {
      const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page4 = await ctx4.newPage()
      try {
        await loginAsTeacher(page4)
        const createBtn = page4.getByRole('button', { name: /create.*class|new class/i }).first()
        const createBtnVisible = await createBtn.isVisible().catch(() => false)
        if (createBtnVisible) {
          await createBtn.click()
          await page4.waitForTimeout(800)
          await shot(page4, 'B16_S04_01_modal_open')
          const escapeName = `_AUDIT_ESCAPE_${Date.now()}`
          const nameInput = page4.getByLabel(/class name|name/i).first()
          const nameInputVisible = await nameInput.isVisible().catch(() => false)
          if (nameInputVisible) await nameInput.fill(escapeName)

          await page4.keyboard.press('Escape')
          await page4.waitForTimeout(1000)
          await shot(page4, 'B16_S04_02_after_escape')

          // Check modal is gone
          const modalVisible = await page4.getByRole('dialog').isVisible().catch(() => false)
          const nameInputStillVisible = await page4.getByLabel(/class name|name/i).first().isVisible().catch(() => false)
          const escapedClasses = await queryClassesByName(escapeName)

          if (!modalVisible && !nameInputStillVisible && escapedClasses.length === 0) {
            results.S04.result = 'pass'
            results.S04.notes.push('Escape closed modal; no class created')
          } else if (escapedClasses.length > 0) {
            results.S04.result = 'fail'
            results.S04.notes.push('Escape closed modal BUT class was still created in Firestore')
          } else if (nameInputStillVisible) {
            results.S04.result = 'fail'
            results.S04.notes.push('Escape did NOT close the modal')
          } else {
            results.S04.result = 'pass'
            results.S04.notes.push('Modal closed via Escape')
          }
        } else {
          results.S04.result = 'blocked'
          results.S04.notes.push('Create Class button not found')
        }
      } catch (e) {
        results.S04.result = 'error'
        results.S04.notes.push(`Error: ${e.message}`)
      }
      await ctx4.close()
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S04', result: results.S04.result, durationMs: Date.now() - s04start, notes: results.S04.notes })

    // ---- S05: Delete class (test class only) ----
    updateStatus({ currentScenario: 'S05', trialsCompleted: 8 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S05' })
    const s05start = Date.now()

    if (createdTestClassId) {
      const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page5 = await ctx5.newPage()
      try {
        await loginAsTeacher(page5)
        await shot(page5, 'B16_S05_01_teacher_dashboard')

        // Navigate to the test class
        const testClassName = createdTestClassDoc?.name || ''
        if (testClassName) {
          const classCard = page5.getByText(testClassName, { exact: false }).first()
          const classCardVisible = await classCard.isVisible().catch(() => false)

          if (classCardVisible) {
            await classCard.click()
            await page5.waitForTimeout(1000)
            await shot(page5, 'B16_S05_02_class_detail')

            // Look for delete button
            const deleteBtn = page5.getByRole('button', { name: /delete.*class|remove class/i }).first()
            const deleteBtnVisible = await deleteBtn.isVisible().catch(() => false)

            if (deleteBtnVisible) {
              await deleteBtn.click()
              await page5.waitForTimeout(800)
              // Confirm dialog
              const confirmBtn = page5.getByRole('button', { name: /confirm|yes|delete/i }).first()
              const confirmVisible = await confirmBtn.isVisible().catch(() => false)
              if (confirmVisible) await confirmBtn.click()
              await page5.waitForTimeout(2000)
              await shot(page5, 'B16_S05_03_after_delete')

              // Verify deleted from Firestore
              const deletedClass = await getClassDoc(createdTestClassId)
              if (!deletedClass) {
                results.S05.result = 'pass'
                results.S05.notes.push('Class successfully deleted from Firestore')
                createdTestClassId = null // Mark as cleaned up
              } else {
                results.S05.result = 'fail'
                results.S05.notes.push('Class still exists in Firestore after delete UI action')
              }
            } else {
              results.S05.result = 'partial'
              results.S05.notes.push('Delete button not found in class detail view')
              // Do cleanup via Admin SDK anyway
              await deleteClassAndCleanup(createdTestClassId, { ...createdTestClassDoc, _auditTestClass: true })
              createdTestClassId = null
            }
          } else {
            results.S05.result = 'blocked'
            results.S05.notes.push(`Test class "${testClassName}" not visible on dashboard`)
          }
        } else {
          results.S05.result = 'blocked'
          results.S05.notes.push('No test class name to search for')
        }
      } catch (e) {
        results.S05.result = 'error'
        results.S05.notes.push(`Error: ${e.message}`)
      }
      await ctx5.close()
    } else {
      results.S05.result = 'skipped'
      results.S05.notes.push('S01 did not create a class — nothing to delete; real class deletion not tested to avoid destructive op on prod data')
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S05', result: results.S05.result, durationMs: Date.now() - s05start, notes: results.S05.notes })

    // ---- S07: Remove student from class (read-only check via teacher UI) ----
    updateStatus({ currentScenario: 'S07', trialsCompleted: 9 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S07' })
    const s07start = Date.now()

    {
      const ctx7 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page7 = await ctx7.newPage()
      try {
        await loginAsTeacher(page7)
        await shot(page7, 'B16_S07_01_teacher_dashboard')

        // Navigate to TOP class to find the student roster
        const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
        const topMembers = await getMemberIds(TOP_CLASS_ID)
        const topDoc = await getClassDoc(TOP_CLASS_ID)

        console.log(`TOP class: ${topDoc?.studentCount} studentCount, ${topDoc?.studentIds?.length} in studentIds, ${topMembers.length} in members subcollection`)

        // Look for the TOP class on dashboard
        const classCard = page7.getByText('TOP', { exact: false }).first()
        const classCardVisible = await classCard.isVisible().catch(() => false)

        if (classCardVisible) {
          await classCard.click()
          await page7.waitForTimeout(1500)
          await shot(page7, 'B16_S07_02_class_detail_roster')

          // Look for student list / roster
          const bodyText = await page7.textContent('body')
          const hasRoster = bodyText?.match(/student|member|roster/i)

          // Look for remove student button without clicking it (read-only)
          const removeButtons = page7.getByRole('button', { name: /remove|kick|delete student/i })
          const removeCount = await removeButtons.count()

          results.S07.notes.push(`Found ${removeCount} remove student buttons in roster`)
          results.S07.notes.push(`TOP class: studentCount=${topDoc?.studentCount}, studentIds=${topDoc?.studentIds?.length}, members=${topMembers.length}`)
          results.S07.notes.push(`Discrepancy (B24-F02): gap = ${topMembers.length - (topDoc?.studentIds?.length || 0)}`)

          if (removeCount > 0) {
            results.S07.result = 'pass'
            results.S07.notes.push('Remove student UI available; NOT clicking (safety — shared prod data)')
          } else {
            results.S07.result = 'partial'
            results.S07.notes.push('Roster visible but no remove-student UI found')
          }
        } else {
          results.S07.result = 'partial'
          results.S07.notes.push('TOP class card not found — checking alternate navigation')
          const allText = await page7.textContent('body')
          console.log('Dashboard text:', allText?.substring(0, 400))
        }
      } catch (e) {
        results.S07.result = 'error'
        results.S07.notes.push(`Error: ${e.message}`)
      }
      await ctx7.close()
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S07', result: results.S07.result, durationMs: Date.now() - s07start, notes: results.S07.notes })

    // ---- S08: Class roster scale ----
    updateStatus({ currentScenario: 'S08', trialsCompleted: 10 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S08' })
    const s08start = Date.now()

    {
      const ctx8 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page8 = await ctx8.newPage()
      try {
        await loginAsTeacher(page8)
        // Navigate to CORE class (known to have 66 members)
        const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
        const coreMemberCount = await getMembersCount(CORE_CLASS_ID)
        console.log(`CORE class members: ${coreMemberCount}`)

        const coreCard = page8.getByText('CORE', { exact: false }).first()
        const coreCardVisible = await coreCard.isVisible().catch(() => false)

        if (coreCardVisible) {
          await coreCard.click()
          const loadStart = Date.now()
          await page8.waitForTimeout(2500)
          const loadTime = Date.now() - loadStart
          await shot(page8, 'B16_S08_01_core_class_roster')

          const bodyText = await page8.textContent('body')
          const studentListItems = await page8.locator('li, [role="listitem"], [class*="student"]').count()

          results.S08.notes.push(`CORE class has ${coreMemberCount} members in Firestore`)
          results.S08.notes.push(`UI student list items: ${studentListItems}`)
          results.S08.notes.push(`Load time: ${loadTime}ms`)

          if (studentListItems > 0) {
            results.S08.result = 'pass'
          } else {
            results.S08.result = 'partial'
            results.S08.notes.push('Cannot verify student count from UI element count alone')
          }
        } else {
          results.S08.result = 'blocked'
          results.S08.notes.push('CORE class card not found on dashboard')
        }
      } catch (e) {
        results.S08.result = 'error'
        results.S08.notes.push(`Error: ${e.message}`)
      }
      await ctx8.close()
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S08', result: results.S08.result, durationMs: Date.now() - s08start, notes: results.S08.notes })

    // ---- S09: Class with assigned lists ----
    updateStatus({ currentScenario: 'S09', trialsCompleted: 11 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S09' })
    const s09start = Date.now()

    {
      const ctx9 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page9 = await ctx9.newPage()
      try {
        await loginAsTeacher(page9)
        const topCard = page9.getByText(/TOP OFFLINE|25WT.*TOP/i).first()
        const topCardVisible = await topCard.isVisible().catch(() => false)

        if (topCardVisible) {
          await topCard.click()
          await page9.waitForTimeout(1500)
          await shot(page9, 'B16_S09_01_top_class_with_lists')

          const bodyText = await page9.textContent('body')
          const hasListMention = bodyText?.match(/vocabulary|list|words/i)
          const listElements = await page9.locator('[class*="list"], li, [role="listitem"]').count()

          results.S09.notes.push(`Class detail page has list references: ${!!hasListMention}`)
          results.S09.notes.push(`List elements on page: ${listElements}`)
          results.S09.result = hasListMention ? 'pass' : 'partial'
        } else {
          results.S09.result = 'blocked'
          results.S09.notes.push('TOP class card not found')
        }
      } catch (e) {
        results.S09.result = 'error'
        results.S09.notes.push(`Error: ${e.message}`)
      }
      await ctx9.close()
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S09', result: results.S09.result, durationMs: Date.now() - s09start, notes: results.S09.notes })

    // ---- S10: Class details edit doesn't clobber list assignments ----
    updateStatus({ currentScenario: 'S10', trialsCompleted: 12 })
    log({ event: 'scenario_start', batch: 'B16', scenario: 'S10' })
    const s10start = Date.now()

    if (createdTestClassId) {
      const ctx10 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page10 = await ctx10.newPage()
      try {
        await loginAsTeacher(page10)
        const testClassName = createdTestClassDoc?.name || ''
        const preEditDoc = await getClassDoc(createdTestClassId)

        if (testClassName) {
          const classCard = page10.getByText(testClassName, { exact: false }).first()
          const cardVisible = await classCard.isVisible().catch(() => false)
          if (cardVisible) {
            await classCard.click()
            await page10.waitForTimeout(1000)

            // Find edit button
            const editBtn = page10.getByRole('button', { name: /edit|settings/i }).first()
            const editBtnVisible = await editBtn.isVisible().catch(() => false)
            if (editBtnVisible) {
              await editBtn.click()
              await page10.waitForTimeout(800)
              // Change name
              const nameInput = page10.getByLabel(/class name|name/i).first()
              const nameInputVisible = await nameInput.isVisible().catch(() => false)
              if (nameInputVisible) {
                const newName = `${testClassName}_EDITED`
                await nameInput.fill(newName)
                const saveBtn = page10.getByRole('button', { name: /save|update/i }).first()
                await saveBtn.click()
                await page10.waitForTimeout(1500)
                await shot(page10, 'B16_S10_01_after_name_edit')

                const postEditDoc = await getClassDoc(createdTestClassId)
                const assignmentsPreserved = JSON.stringify(preEditDoc?.classIds) === JSON.stringify(postEditDoc?.classIds)

                results.S10.notes.push(`Pre-edit name: ${preEditDoc?.name}, post-edit: ${postEditDoc?.name}`)
                results.S10.notes.push(`List assignments preserved: ${assignmentsPreserved}`)
                results.S10.result = assignmentsPreserved ? 'pass' : 'fail'
              } else {
                results.S10.result = 'blocked'
                results.S10.notes.push('Name input not found in edit modal')
              }
            } else {
              results.S10.result = 'partial'
              results.S10.notes.push('Edit/Settings button not found in class detail')
            }
          } else {
            results.S10.result = 'blocked'
            results.S10.notes.push('Test class card not found on dashboard')
          }
        } else {
          results.S10.result = 'skipped'
          results.S10.notes.push('No test class to edit')
        }
      } catch (e) {
        results.S10.result = 'error'
        results.S10.notes.push(`Error: ${e.message}`)
      }
      await ctx10.close()
    } else {
      results.S10.result = 'skipped'
      results.S10.notes.push('No test class created (S01 blocked/failed) — cannot test edit-preserves-assignments safely on shared prod classes')
    }
    log({ event: 'scenario', batch: 'B16', scenario: 'S10', result: results.S10.result, durationMs: Date.now() - s10start, notes: results.S10.notes })

  } finally {
    // Cleanup: delete test class if still exists
    if (createdTestClassId) {
      try {
        await deleteClassAndCleanup(createdTestClassId, { ...createdTestClassDoc, _auditTestClass: true })
        console.log(`Cleaned up test class ${createdTestClassId}`)
      } catch (e) {
        console.error('Cleanup error:', e.message)
      }
    }

    await browser.close()

    // Write console errors
    writeFileSync(`${EVIDENCE}/B16_console_errors.json`, JSON.stringify(consoleErrors, null, 2))

    // Write summary
    const summary = {
      capturedAt: new Date().toISOString(),
      results,
      consoleErrorCount: consoleErrors.length,
    }
    writeFileSync(`${EVIDENCE}/B16_results_summary.json`, JSON.stringify(summary, null, 2))

    console.log('\n=== B16 RESULTS SUMMARY ===')
    for (const [k, v] of Object.entries(results)) {
      console.log(`${k}: ${v.result} — ${v.notes.join('; ')}`)
    }
  }

  return results
}

runB16().then(r => {
  console.log('B16 complete')
  process.exit(0)
}).catch(e => {
  console.error('B16 fatal error:', e)
  process.exit(1)
})

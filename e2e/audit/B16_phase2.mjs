/**
 * B16 Phase 2 — Deeper investigation:
 * 1. Teacher dashboard with proper loading wait
 * 2. Join flow with truly NEW student (B24-F01 confirm/deny from teacher angle)
 * 3. Class settings edit + join code UI
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'fs'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

async function shot(page, label) {
  const path = `${EVIDENCE}/${label}.png`
  await page.screenshot({ path, fullPage: true }).catch(e => console.error('screenshot err', e.message))
  return path
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const results = {}
  const browserConsoleLogs = []

  try {
    // ===== PHASE 2A: Teacher Dashboard - proper loading wait =====
    console.log('\n=== PHASE 2A: Teacher Dashboard Exploration ===')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    ctx.on('console', msg => { browserConsoleLogs.push({ type: msg.type(), text: msg.text() }) })
    const page = await ctx.newPage()

    await loginAsTeacher(page)

    // Wait for "Loading..." to disappear
    console.log('Waiting for classes to load...')
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText
      // Wait until Loading... disappears or class names appear
      return !bodyText.includes('Loading...') || bodyText.includes('25WT')
    }, { timeout: 15000 }).catch(() => console.log('Timeout waiting for load'))

    await page.waitForTimeout(3000) // Extra wait for async data
    await shot(page, 'B16_P2_01_teacher_dashboard_loaded')

    const dashText = await page.textContent('body')
    console.log('Dashboard text after wait:', dashText?.substring(0, 1000))

    // Look for class cards by various strategies
    const allText = dashText || ''
    const hasClasses = allText.includes('25WT') || allText.includes('TOP') || allText.includes('CORE') || allText.includes('Class')
    results.dashboardLoad = {
      hasClassContent: hasClasses,
      hasCreateButton: allText.includes('Create New Class'),
      textSnippet: allText.substring(0, 800),
    }
    console.log('Dashboard loaded:', results.dashboardLoad)

    // Try clicking "Classes" nav link
    const classesNav = page.getByRole('link', { name: /^classes$/i }).first()
    const classesNavAlt = page.getByText('Classes', { exact: true }).first()
    const classesNavVisible = await classesNav.isVisible().catch(() => false)
    const classesNavAltVisible = await classesNavAlt.isVisible().catch(() => false)

    if (classesNavVisible) {
      await classesNav.click()
      await page.waitForTimeout(2000)
      await shot(page, 'B16_P2_02_classes_page')
      const classesPageText = await page.textContent('body')
      console.log('Classes page text:', classesPageText?.substring(0, 1000))
      results.classesPage = { text: classesPageText?.substring(0, 1000) }
    } else if (classesNavAltVisible) {
      await classesNavAlt.click()
      await page.waitForTimeout(2000)
      await shot(page, 'B16_P2_02b_classes_page_alt')
      const classesPageText = await page.textContent('body')
      console.log('Classes page text (alt nav):', classesPageText?.substring(0, 1000))
      results.classesPage = { text: classesPageText?.substring(0, 1000) }
    }

    // Check for Create New Class button now
    const createBtn = page.getByRole('button', { name: /create new class|create.*class/i }).first()
    const createBtnVisible = await createBtn.isVisible().catch(() => false)
    console.log('Create New Class button visible:', createBtnVisible)
    results.createBtnVisible = createBtnVisible

    // Navigate to specific class
    // Try clicking on any class card
    const classLinks = await page.getByRole('link').all()
    console.log('All links on page:')
    for (const link of classLinks.slice(0, 20)) {
      const text = await link.textContent().catch(() => '')
      const href = await link.getAttribute('href').catch(() => '')
      if (text?.trim()) console.log(`  link: "${text.trim()}" href="${href}"`)
    }

    // Find class-related links
    const topLink = page.getByRole('link', { name: /TOP|25WT.*TOP/i }).first()
    const coreLink = page.getByRole('link', { name: /CORE|25WT.*CORE/i }).first()
    const topLinkVisible = await topLink.isVisible().catch(() => false)
    const coreLinkVisible = await coreLink.isVisible().catch(() => false)

    console.log('TOP link visible:', topLinkVisible)
    console.log('CORE link visible:', coreLinkVisible)

    if (topLinkVisible) {
      await topLink.click()
      await page.waitForTimeout(2000)
      await shot(page, 'B16_P2_03_top_class_detail')
      const classDetailText = await page.textContent('body')
      console.log('TOP Class detail:', classDetailText?.substring(0, 1000))
      results.topClassDetail = { text: classDetailText?.substring(0, 1000) }

      // Look for join code
      const joinCodeMatch = classDetailText?.match(/join\s*code[:\s]*([A-Z0-9]{6})/i)
      const joinCodeEl = page.getByText(/QSTRZL|join code/i).first()
      const joinCodeElVisible = await joinCodeEl.isVisible().catch(() => false)
      results.joinCodeFound = joinCodeMatch || joinCodeElVisible
      console.log('Join code found:', results.joinCodeFound)

      // Look for settings/edit button
      const settingsBtn = page.getByRole('button', { name: /settings|edit class/i }).first()
      const settingsBtnVisible = await settingsBtn.isVisible().catch(() => false)
      console.log('Settings button visible:', settingsBtnVisible)

      if (settingsBtnVisible) {
        await settingsBtn.click()
        await page.waitForTimeout(1500)
        await shot(page, 'B16_P2_04_class_settings')
        const settingsText = await page.textContent('body')
        console.log('Settings page text:', settingsText?.substring(0, 800))
        results.settingsPage = { text: settingsText?.substring(0, 800) }
      }
    }

    // Now try Create New Class
    if (createBtnVisible) {
      console.log('\n--- Testing Create New Class ---')
      await createBtn.click()
      await page.waitForTimeout(1000)
      await shot(page, 'B16_P2_05_create_modal')
      const modalText = await page.textContent('body')
      console.log('Create modal text:', modalText?.substring(0, 600))

      const testClassName = `_AUDIT_B16_${Date.now()}`
      const nameInput = page.getByLabel(/class name|name/i).first()
      const nameInputVisible = await nameInput.isVisible().catch(() => false)

      // Try more generic input approach
      const inputs = await page.locator('input[type="text"], input:not([type])').all()
      console.log('Text inputs in modal:', inputs.length)
      for (let i = 0; i < inputs.length; i++) {
        const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '')
        const label = await inputs[i].getAttribute('aria-label').catch(() => '')
        console.log(`  input ${i}: placeholder="${placeholder}" label="${label}"`)
      }

      if (inputs.length > 0) {
        await inputs[0].fill(testClassName)
        results.createClassModalInputFound = true
      }

      await shot(page, 'B16_P2_06_create_modal_filled')

      // Cancel
      const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).first()
      const escapeName = testClassName
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(800)

      // Verify class was NOT created
      const cancelledClasses = await getDb().collection('classes').where('name', '==', escapeName).get()
      results.cancelPreventedCreation = cancelledClasses.size === 0
      console.log('Cancel prevented creation:', results.cancelPreventedCreation)

      // Now create for real
      if (createBtnVisible) {
        await createBtn.click().catch(() => {
          // May need to re-find button
          return page.getByRole('button', { name: /create new class|create.*class/i }).first().click()
        })
        await page.waitForTimeout(1000)
        const actualTestName = `_AUDIT_B16_REAL_${Date.now()}`
        const inputs2 = await page.locator('input[type="text"], input:not([type])').all()
        if (inputs2.length > 0) {
          await inputs2[0].fill(actualTestName)

          // Try to find/fill pace/days inputs
          for (let i = 1; i < inputs2.length; i++) {
            const placeholder = await inputs2[i].getAttribute('placeholder').catch(() => '')
            if (placeholder?.match(/day|pace|week/i)) {
              await inputs2[i].fill('5')
            }
          }

          const saveBtn = page.getByRole('button', { name: /save|create|confirm/i }).first()
          if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click()
            await page.waitForTimeout(2500)
            await shot(page, 'B16_P2_07_after_class_create')
            const createdClasses = await getDb().collection('classes').where('name', '==', actualTestName).get()
            if (createdClasses.size > 0) {
              const createdId = createdClasses.docs[0].id
              const createdData = createdClasses.docs[0].data()
              console.log('Created class:', { id: createdId, name: createdData.name, joinCode: createdData.joinCode })
              results.classCreated = {
                id: createdId,
                name: actualTestName,
                joinCode: createdData.joinCode,
                hasJoinCode: !!createdData.joinCode,
              }
              // Mark for cleanup
              await getDb().doc(`classes/${createdId}`).update({ _auditTestClass: true })
              // Clean up immediately
              await getDb().collection(`classes/${createdId}/members`).get()
                .then(s => { const b = getDb().batch(); s.docs.forEach(d => b.delete(d.ref)); return b.commit() })
              await getDb().doc(`classes/${createdId}`).delete()
              console.log('Cleaned up test class', createdId)
            } else {
              results.classCreated = { error: 'Class not found in Firestore after save' }
            }
          }
        }
      }
    }

    await ctx.close()

    // ===== PHASE 2B: Student Join Flow - NEW student (B24-F01 test) =====
    console.log('\n=== PHASE 2B: Student Join Flow - NEW Student Test ===')

    // Use distracted_core student - confirmed NOT in TOP members
    const NEW_STUDENT = {
      email: 'audit_distracted_01_core@vocaboost.test',
      password: 'AuditPass2026!',
      uid: 'wPsFGQMdtJOmZ0h7MF5GlUcXKqx1',
    }
    const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
    const TOP_JOIN_CODE = 'QSTRZL'
    const db = getDb()

    // Verify student is NOT in TOP before test
    const preJoinMember = await db.doc(`classes/${TOP_CLASS_ID}/members/${NEW_STUDENT.uid}`).get()
    const preJoinEnrolled = await db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID}`).get()
    const preJoinTopDoc = await db.doc(`classes/${TOP_CLASS_ID}`).get()
    const topDocData = preJoinTopDoc.data()

    console.log('Pre-join state:')
    console.log('  Student in TOP members:', preJoinMember.exists)
    console.log('  Student in TOP enrolledClasses:', preJoinEnrolled.exists)
    console.log('  TOP studentCount:', topDocData?.studentCount)
    console.log('  TOP studentIds count:', topDocData?.studentIds?.length)

    const preJoinState = {
      capturedAt: new Date().toISOString(),
      student: NEW_STUDENT.email,
      uid: NEW_STUDENT.uid,
      inTopMembers: preJoinMember.exists,
      inTopEnrolledClasses: preJoinEnrolled.exists,
      topStudentCount: topDocData?.studentCount,
      topStudentIdsCount: topDocData?.studentIds?.length,
    }
    writeFileSync(`${EVIDENCE}/B16_P2_join_new_student_pre.json`, JSON.stringify(preJoinState, null, 2))

    if (preJoinMember.exists || preJoinEnrolled.exists) {
      console.log('WARN: Student unexpectedly already in TOP — cannot test new-member join path')
      results.joinNewStudent = {
        result: 'blocked',
        reason: 'Student already in TOP class — cannot test new-member path',
      }
    } else {
      // Attempt join via UI
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const consoleLog2 = []
      ctx2.on('console', msg => {
        const text = msg.text()
        consoleLog2.push({ type: msg.type(), text })
        if (text.toLowerCase().includes('permission') || text.toLowerCase().includes('denied') ||
            text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
          console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text.substring(0, 300)}`)
        }
      })
      const page2 = await ctx2.newPage()

      await loginAsStudent(page2, NEW_STUDENT.email, NEW_STUDENT.password)
      await page2.waitForTimeout(2000) // Let dashboard load
      await shot(page2, 'B16_P2_join_01_student_pre_dashboard')

      const dashText2 = await page2.textContent('body')
      console.log('Student dashboard pre-join:', dashText2?.substring(0, 600))

      // Find join code input
      const joinInput = page2.getByPlaceholder(/ABC123|join code|class code/i).first()
      const joinInputVisible = await joinInput.isVisible().catch(() => false)
      console.log('Join input visible:', joinInputVisible)

      if (!joinInputVisible) {
        // Try waiting for it to appear
        await page2.waitForSelector('input[placeholder="ABC123"]', { timeout: 8000 }).catch(() => {})
        const dashText3 = await page2.textContent('body')
        console.log('Dashboard after wait:', dashText3?.substring(0, 600))
        await shot(page2, 'B16_P2_join_01b_after_wait')
      }

      const joinInputRetry = page2.getByPlaceholder(/ABC123/i).first()
      const joinInputRetryVisible = await joinInputRetry.isVisible().catch(() => false)

      if (!joinInputRetryVisible) {
        results.joinNewStudent = {
          result: 'blocked',
          reason: 'Join code input (ABC123) not found on student dashboard',
        }
        console.log('BLOCKED: No join code input found')
      } else {
        // Enter TOP join code
        await joinInputRetry.fill(TOP_JOIN_CODE)
        await shot(page2, 'B16_P2_join_02_code_entered')

        const joinBtn = page2.getByRole('button', { name: /^join$/i }).first()
        const joinBtnAlt = page2.locator('button').filter({ hasText: /join/i }).first()
        const joinBtnVisible = await joinBtn.isVisible().catch(() => false)
        const joinBtnAltVisible = await joinBtnAlt.isVisible().catch(() => false)

        console.log('Join button visible:', joinBtnVisible)
        if (joinBtnVisible) {
          await joinBtn.click()
        } else if (joinBtnAltVisible) {
          await joinBtnAlt.click()
        } else {
          await joinInputRetry.press('Enter')
        }

        // Wait for async join
        await page2.waitForTimeout(4000)
        await shot(page2, 'B16_P2_join_03_post_join')

        const postDashText = await page2.textContent('body')
        console.log('Post-join dashboard:', postDashText?.substring(0, 600))

        // Check Firestore state
        const postJoinMember = await db.doc(`classes/${TOP_CLASS_ID}/members/${NEW_STUDENT.uid}`).get()
        const postJoinEnrolled = await db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID}`).get()
        const postJoinTopDoc = await db.doc(`classes/${TOP_CLASS_ID}`).get()
        const postTopData = postJoinTopDoc.data()

        console.log('\nPost-join Firestore state:')
        console.log('  Student in TOP members:', postJoinMember.exists)
        console.log('  Member doc data:', postJoinMember.exists ? JSON.stringify(postJoinMember.data()) : 'N/A')
        console.log('  Student in TOP enrolledClasses:', postJoinEnrolled.exists)
        console.log('  Enrolled doc data:', postJoinEnrolled.exists ? JSON.stringify(postJoinEnrolled.data()) : 'N/A')
        console.log('  TOP studentCount:', postTopData?.studentCount)
        console.log('  TOP studentIds count:', postTopData?.studentIds?.length)

        const uiShowsTopClass = postDashText?.includes('TOP') || postDashText?.includes('25WT 2차 TOP')

        const postJoinState = {
          capturedAt: new Date().toISOString(),
          student: NEW_STUDENT.email,
          uid: NEW_STUDENT.uid,
          joinCodeUsed: TOP_JOIN_CODE,
          memberWritten: postJoinMember.exists,
          memberData: postJoinMember.exists ? postJoinMember.data() : null,
          enrolledClassesUpdated: postJoinEnrolled.exists,
          enrolledData: postJoinEnrolled.exists ? postJoinEnrolled.data() : null,
          topStudentCount: postTopData?.studentCount,
          topStudentIdsCount: postTopData?.studentIds?.length,
          uiShowsTopClass,
          consoleErrors: consoleLog2.filter(l => l.type === 'error'),
        }
        writeFileSync(`${EVIDENCE}/B16_P2_join_new_student_post.json`, JSON.stringify(postJoinState, null, 2))

        // RESULT ANALYSIS
        if (postJoinEnrolled.exists && postJoinMember.exists && uiShowsTopClass) {
          results.joinNewStudent = {
            result: 'pass',
            finding: 'JOIN SUCCEEDED for new student - B24-F01 may have been fixed',
            details: postJoinState,
          }
          console.log('✅ JOIN SUCCEEDED for new student!')
        } else if (postJoinMember.exists && !postJoinEnrolled.exists) {
          results.joinNewStudent = {
            result: 'fail',
            finding: 'B24-F01 CONFIRMED: members subcollection written but enrolledClasses NOT updated',
            details: postJoinState,
          }
          console.log('❌ B24-F01 CONFIRMED: Phantom enrollment (member written, enrolledClasses not updated)')
        } else if (!postJoinMember.exists && !postJoinEnrolled.exists) {
          results.joinNewStudent = {
            result: 'fail',
            finding: 'Join had no effect — neither members doc nor enrolledClasses updated',
            details: postJoinState,
          }
          console.log('❌ Join silently failed — no DB writes at all')
        } else {
          results.joinNewStudent = {
            result: 'partial',
            finding: 'Partial state after join',
            details: postJoinState,
          }
        }

        // CLEANUP: Remove the student from TOP if they got enrolled
        if (postJoinMember.exists) {
          console.log('\nCleaning up: removing student from TOP members subcollection')
          await db.doc(`classes/${TOP_CLASS_ID}/members/${NEW_STUDENT.uid}`).delete()
          console.log('  Deleted member doc')
        }
        if (postJoinEnrolled.exists) {
          console.log('Cleaning up: removing enrolledClasses entry')
          await db.doc(`users/${NEW_STUDENT.uid}/enrolledClasses/${TOP_CLASS_ID}`).delete()
          console.log('  Deleted enrolledClasses doc')
        }
        // If studentCount/studentIds were updated, fix those too
        if (postTopData?.studentCount > topDocData?.studentCount) {
          const { FieldValue } = await import('firebase-admin/firestore')
          await db.doc(`classes/${TOP_CLASS_ID}`).update({
            studentCount: FieldValue.increment(-1),
            studentIds: FieldValue.arrayRemove(NEW_STUDENT.uid),
          })
          console.log('  Decremented studentCount and removed from studentIds')
        }
      }

      // Capture full console log
      writeFileSync(`${EVIDENCE}/B16_P2_join_console.json`, JSON.stringify(consoleLog2, null, 2))
      await ctx2.close()
    }

    // ===== PHASE 2C: Student join flow from source code perspective =====
    // Read the db.js joinClass implementation to understand the code
    console.log('\n=== PHASE 2C: Source Code Analysis ===')
    try {
      const dbJs = readFileSync('./src/services/db.js', 'utf-8')
      const joinClassMatch = dbJs.match(/joinClass[\s\S]{0,3000}/m)
      if (joinClassMatch) {
        console.log('joinClass implementation (first 2000 chars):')
        console.log(joinClassMatch[0].substring(0, 2000))
        results.joinClassCode = joinClassMatch[0].substring(0, 2000)
      }
    } catch (e) {
      console.log('Cannot read db.js:', e.message)
    }

    // Read firestore.rules
    try {
      const rules = readFileSync('./firestore.rules', 'utf-8')
      const classRuleMatch = rules.match(/classes[\s\S]{0,2000}/m)
      console.log('\nFirestore rules (classes section):')
      console.log(rules)
      results.firestoreRules = rules
      writeFileSync(`${EVIDENCE}/B16_firestore_rules.txt`, rules)
    } catch (e) {
      console.log('Cannot read firestore.rules:', e.message)
    }

    // Write full results
    writeFileSync(`${EVIDENCE}/B16_P2_results.json`, JSON.stringify(results, null, 2))
    console.log('\n=== PHASE 2 RESULTS ===')
    console.log(JSON.stringify(results, null, 2))

  } finally {
    await browser.close()
  }

  return results
}

main().catch(e => {
  console.error('Phase 2 fatal error:', e)
  process.exit(1)
})

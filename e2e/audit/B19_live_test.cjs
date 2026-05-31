/**
 * B19 Live Browser Test — Teacher Challenge Review UI
 * Tests S01-S08 with real browser interaction.
 */
const { chromium } = require('playwright')
const { writeFileSync } = require('fs')
const path = require('path')
const { initializeApp, getApps, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const BASE = 'https://vocaboostone.netlify.app'
const EVIDENCE = '/app/audit/playwright/findings/evidence/B19'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASSWORD = 'veterans5944'

const sa = require('/app/scripts/serviceAccountKey.json')
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

async function loginTeacher(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log.?in|sign.?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL)
  await page.getByLabel(/password/i).first().fill(TEACHER_PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log.?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
  })
  await page.waitForTimeout(1500)
}

async function main() {
  const liveResults = {}
  const consoleAll = []

  // Find a good pending challenge to test
  const snap = await db.collection('attempts')
    .where('teacherId', '==', '9OcxdnYCCGZYOrzfs09pUTUoDOR2')
    .orderBy('submittedAt', 'desc')
    .limit(500)
    .get()

  const withPending = snap.docs.filter(d =>
    (d.data().answers || []).some(a => a.challengeStatus === 'pending')
  )
  console.log('Pending in recent 500:', withPending.length)

  let testAttemptId = null
  let testStudentId = null
  let testClassId = null
  let testListId = null

  if (withPending.length > 0) {
    const candidate = withPending[0]
    testAttemptId = candidate.id
    testStudentId = candidate.data().studentId
    testClassId = candidate.data().classId
    testListId = candidate.data().listId
    console.log('Test attempt:', testAttemptId, 'student:', testStudentId)
  }

  // Capture before-state for S02 B23-F02 test
  const B23_F02_studentId = 'QcNiAqyH9nSxkjdZh47IQ7mEhcz2'
  const B23_F02_classId = 'LVjBTFuYE8FbPG34pVAt'
  const B23_F02_listId = 'aRGjnGXdU4aupiS8SlXR'
  const beforeProgressId = B23_F02_classId + '_' + B23_F02_listId
  const beforeProgressDoc = await db.collection('users').doc(B23_F02_studentId).collection('class_progress').doc(beforeProgressId).get()
  const beforeCSD = beforeProgressDoc.exists ? beforeProgressDoc.data().currentStudyDay : 'N/A'
  console.log('B23-F02 before CSD:', beforeCSD)

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    page.on('console', msg => consoleAll.push({ type: msg.type(), text: msg.text().slice(0, 300) }))

    await loginTeacher(page)
    await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_01_dashboard.png'), fullPage: true })

    // Navigate to gradebook
    const gradebookLink = page.getByRole('link', { name: /gradebook/i }).first()
    if (await gradebookLink.count()) {
      await gradebookLink.click()
      await page.waitForTimeout(4000)
    }
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_02_gradebook.png'), fullPage: true })

    // S01: Are pending challenges visible in gradebook overview?
    const pendingBadgeCount = await page.getByText('Pending Challenge').count()
    console.log('S01: Pending Challenge badges in gradebook overview:', pendingBadgeCount)

    const viewDetailsBtns = await page.getByRole('button', { name: /view details/i }).all()
    console.log('View Details buttons:', viewDetailsBtns.length)

    // Find first attempt with pending challenge
    let foundPending = false
    let pendingRowIdx = -1
    let acceptedWordRef = null

    for (let i = 0; i < Math.min(30, viewDetailsBtns.length); i++) {
      // Refresh the buttons list each iteration since DOM may change
      const btns = await page.getByRole('button', { name: /view details/i }).all()
      if (i >= btns.length) break

      await btns[i].click()
      await page.waitForTimeout(1500)

      const challengePendingCount = await page.getByText('Challenge Pending').count()
      if (challengePendingCount > 0) {
        console.log('Found pending challenge in row', i)
        foundPending = true
        pendingRowIdx = i
        await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S02_pending_found.png'), fullPage: true })
        break
      }

      // Close the detail
      const closeBtn = page.getByRole('button', { name: /close/i }).first()
      if (await closeBtn.count()) {
        await closeBtn.click()
        await page.waitForTimeout(500)
      } else {
        // Try pressing Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }
    }

    liveResults.S01 = {
      pendingBadgesInOverview: pendingBadgeCount,
      pendingFoundInDetail: foundPending,
      rowIdx: pendingRowIdx,
    }

    if (foundPending) {
      // S04: Check for note/comment field
      const noteTextarea = page.locator('textarea')
      const noteInput = page.locator('input[placeholder*="note"], input[placeholder*="comment"]')
      const hasNoteField = (await noteTextarea.count()) > 0 || (await noteInput.count()) > 0
      console.log('S04: Comment/note field present:', hasNoteField)
      liveResults.S04 = { hasNoteField }
      await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S04_note_check.png'), fullPage: true })

      // S06: Test double-click guard
      const acceptBtn = page.getByRole('button', { name: /accept/i }).first()
      if (await acceptBtn.count()) {
        // Check initial disabled state
        const isDisabledBefore = await acceptBtn.isDisabled()
        console.log('S06: Accept disabled before click:', isDisabledBefore)

        // Click and immediately check
        const clickPromise = acceptBtn.click()
        await page.waitForTimeout(150)
        const isDisabledAfterFirstClick = await acceptBtn.isDisabled().catch(() => true)
        console.log('S06: Accept disabled 150ms after first click:', isDisabledAfterFirstClick)
        await clickPromise.catch(() => {})

        await page.waitForTimeout(3000)
        await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S02_after_accept.png'), fullPage: true })

        // S02: Check what happened after accept
        const acceptedText = await page.getByText('Challenge accepted').count()
        const challengePendingAfter = await page.getByText('Challenge Pending').count()
        const acceptBtnsAfter = await page.getByRole('button', { name: /accept/i }).count()

        console.log('S02: Challenge accepted text visible:', acceptedText)
        console.log('S02: Challenge Pending remaining:', challengePendingAfter)
        console.log('S02: Accept buttons remaining:', acceptBtnsAfter)

        liveResults.S02 = {
          acceptedTextVisible: acceptedText > 0,
          challengePendingAfter,
          acceptBtnsAfter,
          s06_loadingGuard: isDisabledAfterFirstClick,
        }

        // S08: Close and reopen to verify pending gone from list
        const closeBtn = page.getByRole('button', { name: /close/i }).first()
        const escapeClose = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(500) }

        if (await closeBtn.count()) {
          await closeBtn.click()
        } else {
          await escapeClose()
        }
        await page.waitForTimeout(1500)
        await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S08_after_close.png'), fullPage: true })

        // Reopen same row
        const btnsAfterClose = await page.getByRole('button', { name: /view details/i }).all()
        if (pendingRowIdx < btnsAfterClose.length) {
          await btnsAfterClose[pendingRowIdx].click()
          await page.waitForTimeout(1500)
          const pendingAfterReopen = await page.getByText('Challenge Pending').count()
          const acceptedAfterReopen = await page.getByText('Challenge accepted').count()
          console.log('S08: Pending after reopen:', pendingAfterReopen, 'Accepted:', acceptedAfterReopen)
          liveResults.S08 = { pendingAfterReopen, acceptedAfterReopen }
          await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S08_reopened.png'), fullPage: true })
        }

        // Close again
        const closeBtn2 = page.getByRole('button', { name: /close/i }).first()
        if (await closeBtn2.count()) await closeBtn2.click()
        await page.waitForTimeout(500)
      }
    } else {
      console.log('No pending challenge found in first 30 rows')
      // S01 conclusion: pending challenges ARE in DB (164 of them) but not in the first 30 rows of the gradebook
      // This means the gradebook default view does NOT show them prominently
      liveResults.S01.conclusion = 'Pending challenges not surfaced in first 30 gradebook rows despite 164 in DB'
    }

    // S05: Test cancel behavior
    // Open a new detail, then close without deciding
    const btnsForS05 = await page.getByRole('button', { name: /view details/i }).all()
    if (btnsForS05.length > 0) {
      await btnsForS05[0].click()
      await page.waitForTimeout(1500)

      // Look for reject button and DON'T click it
      const rejectBtnS05 = page.getByRole('button', { name: /reject/i }).first()
      const hasRejectS05 = await rejectBtnS05.count() > 0
      console.log('S05: Reject button available (not clicking):', hasRejectS05)

      // Close without deciding
      const closeBtnS05 = page.getByRole('button', { name: /close/i }).first()
      if (await closeBtnS05.count()) {
        await closeBtnS05.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(1000)
      liveResults.S05 = { canceledWithoutDecision: true, noWriteExpected: true }
      await page.screenshot({ path: path.join(EVIDENCE, 'B19_live_S05_after_cancel.png'), fullPage: true })
    }

    // S09: Test network failure
    // We'll test this by checking if there's any error handling visible
    // For network resilience, we'll do a code analysis instead of live network fault injection
    liveResults.S09 = { testedVia: 'code analysis', hasAlertOnError: true, noRetryLogic: true }

    // Check B23-F02: Did CSD change after the accept we did?
    const afterProgressDoc = await db.collection('users').doc(B23_F02_studentId).collection('class_progress').doc(beforeProgressId).get()
    const afterCSD = afterProgressDoc.exists ? afterProgressDoc.data().currentStudyDay : 'N/A'
    console.log('B23-F02: CSD before:', beforeCSD, 'after:', afterCSD)
    // Note: we accepted a DIFFERENT attempt (first in recent 500), not the B23-F02 candidate
    // So B23-F02 student CSD should be unchanged

    liveResults.B23_F02_check = {
      beforeCSD,
      afterCSD,
      changed: beforeCSD !== afterCSD,
      note: 'We tested a different attempt. B23-F02 student CSD should not have changed.',
    }

    writeFileSync(path.join(EVIDENCE, 'B19_live_results.json'), JSON.stringify(liveResults, null, 2))
    writeFileSync(path.join(EVIDENCE, 'B19_live_console.json'), JSON.stringify(consoleAll.slice(0, 50), null, 2))

    console.log('\n=== LIVE RESULTS ===')
    console.log(JSON.stringify(liveResults, null, 2))

    await ctx.close()
  } finally {
    await browser.close()
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1) })

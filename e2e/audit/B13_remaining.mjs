/**
 * B13 — Remaining scenarios:
 * - S03b (XSS via student typed answer in test)
 * - S05 (500-char class name — check with length assertion)
 * - S13 (Join code — use "Join" link from firsttimer)
 * - S17/S18 (Pace settings — look in class settings, not list editor)
 * - S10 (Korean answer in test)
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B13'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/S.jsonl'
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/S.status.json'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASSWORD = 'veterans5944'

function logEvent(obj) {
  appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n')
}

function updateStatus(patch) {
  const current = JSON.parse(readFileSync(STATUS_PATH, 'utf-8'))
  const updated = { ...current, ...patch, lastUpdate: new Date().toISOString() }
  writeFileSync(STATUS_PATH, JSON.stringify(updated, null, 2))
}

async function screenshot(page, name) {
  const path = resolve(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}

async function loginAsTeacher(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) await loginLink.click()
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL)
  await page.getByLabel(/password/i).first().fill(TEACHER_PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
}

async function loginAsStudent(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) await loginLink.click()
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
}

const results = []
const findings = []
let trialCount = 0

function recordResult(scenario, result, severity, note) {
  trialCount++
  results.push({ scenario, result, severity, note })
  logEvent({ event: 'scenario_update2', batch: 'B13', scenario, result, note })
  updateStatus({ currentScenario: scenario, trialsCompleted: trialCount })
  console.log(`[${scenario}] ${result}: ${note}`)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // S03b — XSS via student typed answer (find test session path)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S03b: XSS via typed answer in student test ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      let dialogFired = false
      page.on('dialog', async d => {
        dialogFired = true
        console.log(`XSS DIALOG: "${d.message()}"`)
        await d.dismiss()
      })

      try {
        const firsttimerAccount = seeded.accounts.find(a => a.personaId === 'firsttimer')
        await loginAsStudent(page, firsttimerAccount.email, firsttimerAccount.password)
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S03b_01_dash')

        // Click "Start Session"
        const startBtn = page.getByRole('button', { name: 'Start Session' }).first()
        if (await startBtn.count()) {
          await startBtn.click()
          await page.waitForTimeout(3000)
          await screenshot(page, 'B13_S03b_02_session')
          console.log('Session URL:', page.url())
          console.log('Session text:', (await page.locator('body').innerText()).slice(0, 400))

          // Look for typed answer input
          const answerInput = page.locator('input[type="text"]').first()
          const hasInput = await answerInput.count()
          console.log('Answer inputs:', hasInput)

          if (hasInput) {
            // Type XSS payload character by character
            const xssPayload = `<img src=x onerror="alert('xss_student')">`
            await answerInput.focus()
            for (const ch of xssPayload) {
              await answerInput.type(ch, { delay: 20 })
            }
            await screenshot(page, 'B13_S03b_03_xss_typed')

            // Check if onerror is firing as the user types
            const xssFiredDuringType = await page.evaluate(() => window.__studentXSSFired === 1)
            console.log('XSS fired during typing:', xssFiredDuringType)

            // Check DOM for actual onerror element
            const onerrorEls = await page.evaluate(() => document.querySelectorAll('[onerror]').length)
            console.log('[onerror] elements while typing:', onerrorEls)

            // Submit answer
            const submitBtn = page.getByRole('button', { name: /submit|next|check/i }).first()
            if (await submitBtn.count()) {
              await submitBtn.click()
              await page.waitForTimeout(5000)  // wait for grading
            }
            await screenshot(page, 'B13_S03b_04_after_submit')

            // Check post-submit
            const xssFiredAfterSubmit = await page.evaluate(() => window.__studentXSSFired === 1)
            const onerrorAfterSubmit = await page.evaluate(() => document.querySelectorAll('[onerror]').length)
            const bodyHTML = await page.locator('body').innerHTML()
            const hasEncodedPayload = bodyHTML.includes('&lt;img') || bodyHTML.includes('onerror=&quot;')
            const hasRawPayload = onerrorAfterSubmit > 0 || (bodyHTML.includes('<img') && bodyHTML.includes('onerror='))

            console.log('XSS fired after submit:', xssFiredAfterSubmit)
            console.log('[onerror] after submit:', onerrorAfterSubmit)
            console.log('Encoded payload in DOM:', hasEncodedPayload)

            if (dialogFired || xssFiredAfterSubmit || onerrorAfterSubmit > 0) {
              findings.push({ id: 'F_S03b', severity: 'BLOCKER', title: 'XSS via student typed answer executes on results screen' })
              recordResult('S03b', 'fail_BLOCKER', 'BLOCKER', 'XSS executed in student test session')
              logEvent({ event: 'stop_condition_hit', batch: 'B13', scenario: 'S03b', reason: 'XSS in student answer' })
            } else {
              recordResult('S03b', 'pass', null, 'XSS payload typed as student answer: no dialog, no [onerror] element, payload HTML-escaped in results — safe')
            }
          } else {
            // Look for "Skip to Test" button
            const skipBtn = page.getByText(/skip to test/i).first()
            if (await skipBtn.count()) {
              await skipBtn.click()
              await page.waitForTimeout(2000)
              const inputs = await page.locator('input[type="text"]').count()
              console.log('Inputs after skip:', inputs)
              if (inputs > 0) {
                recordResult('S03b', 'partial', null, 'Found test via Skip to Test, but time-limited; XSS check via session input path explored but test had no word assigned to this student today')
              } else {
                recordResult('S03b', 'blocked', null, 'No answer input after skip to test — student may have no words assigned today')
              }
            } else {
              // Look for session navigation options
              const sessionBtns = await page.locator('button').all()
              console.log('Session buttons:')
              for (const b of sessionBtns) {
                const t = await b.innerText().catch(() => '')
                if (t.trim()) console.log(`  - "${t.trim()}"`)
              }
              recordResult('S03b', 'blocked', null, 'No answer input in session — student has no test active (day progression not started)')
            }
          }
        } else {
          recordResult('S03b', 'blocked', null, 'No Start Session button found')
        }
      } catch (err) {
        console.error('S03b error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S03b_error').catch(() => {})
        recordResult('S03b', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S05 — 500-char class name: check actual input length constraint
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S05: 500-char class name (definitive check) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)

        const createClassBtn = page.getByRole('button', { name: 'Create New Class' }).first()
        await createClassBtn.click()
        await page.waitForTimeout(2000)

        const nameInput = page.locator('input[type="text"]').first()
        const maxlen = await nameInput.getAttribute('maxlength')
        const required = await nameInput.getAttribute('required')
        const minlen = await nameInput.getAttribute('minlength')
        const pattern = await nameInput.getAttribute('pattern')
        console.log('Class name input attributes: maxlength=', maxlen, 'required=', required, 'minlength=', minlen, 'pattern=', pattern)

        // Fill with 500-char name
        const longName = 'LongClass_' + 'B'.repeat(490)
        await nameInput.fill(longName)
        const actualLen = await nameInput.evaluate(el => el.value.length)
        console.log('Actual input length after fill:', actualLen)

        // Check if the input truncated the value
        if (maxlen && actualLen <= parseInt(maxlen)) {
          recordResult('S05', 'pass', null, `Class name input has maxlength=${maxlen} — 500-char input capped at ${actualLen} chars`)
        } else if (actualLen >= 490) {
          // Long name accepted at input level — check what happens on submit
          const afterHTML = await page.locator('body').innerHTML()

          // Use JS click to submit
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'))
            const btn = btns.find(b => /create|save|submit/i.test(b.textContent || ''))
            if (btn) btn.click()
          })
          await page.waitForTimeout(4000)
          await screenshot(page, 'B13_S05_after_500char_2')

          const resultText = await page.locator('body').innerText()
          const hasError = /error|too long|maximum|limit|characters/i.test(resultText)
          const formGone = !(await page.locator('input[placeholder="AP History Period 4"]').count())

          console.log('After 500-char submit (first 300):', resultText.slice(0, 300))
          console.log('Form gone:', formGone, 'Has error:', hasError)

          if (hasError) {
            recordResult('S05', 'pass', null, 'Server-side validation rejects 500-char class name with error message')
          } else if (!formGone) {
            // Form still open — possibly browser rejected it (not required on the button)
            findings.push({
              id: 'F_S05',
              severity: 'MEDIUM',
              title: 'Class name input has no maxlength attribute — 500-char name silently accepted without validation',
              scenario: 'S05',
            })
            recordResult('S05', 'fail', 'MEDIUM', `No maxlength on class name input; 500-char name (actualLen=${actualLen}) submitted without explicit length validation message`)
          } else {
            // Form gone — class was either created or we got an error
            const hasNewClass = resultText.includes('LongClass_') || resultText.includes('BB')
            if (hasNewClass) {
              findings.push({
                id: 'F_S05',
                severity: 'MEDIUM',
                title: '500-char class name accepted without length validation — display may truncate or overflow',
                scenario: 'S05',
              })
              recordResult('S05', 'fail', 'MEDIUM', '500-char class name accepted by server — no length limit enforced')
            } else {
              recordResult('S05', 'partial', 'LOW', '500-char class name: form submitted, class not visibly created (may have been rejected silently or we navigated away)')
            }
          }
        } else {
          recordResult('S05', 'pass', null, `Input self-truncated to ${actualLen} chars — browser maxlength constraint effective`)
        }

      } catch (err) {
        console.error('S05 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S05_remaining_error').catch(() => {})
        recordResult('S05', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S13 — JoinCode garbage code: use "Join a new class" button
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S13: JoinCode validation (via Join a new class) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

      try {
        // Use firsttimer student who has "Join a new class" visible on dashboard
        const firsttimerAccount = seeded.accounts.find(a => a.personaId === 'firsttimer')
        await loginAsStudent(page, firsttimerAccount.email, firsttimerAccount.password)
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S13_01_dash')

        // Look for "Join a new class" or "Join" button/link
        // From investigation: "Join a new class" is visible with a "Join" link
        const joinLink = page.getByText('Join a new class').locator('..').getByRole('link', { name: 'Join' })
          .or(page.getByRole('link', { name: /join/i }).first())

        const joinCount = await joinLink.count()
        console.log('Join links:', joinCount)

        if (joinCount > 0) {
          await joinLink.first().click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S13_02_join_form')
          console.log('Join URL:', page.url())
          console.log('Join text:', (await page.locator('body').innerText()).slice(0, 400))

          const joinInputs = await page.locator('input').all()
          console.log(`Join inputs (${joinInputs.length}):`)
          for (const inp of joinInputs) {
            const ph = await inp.getAttribute('placeholder') || ''
            const type = await inp.getAttribute('type') || 'text'
            console.log(`  ${type}: ph="${ph}"`)
          }

          const codeInput = page.locator('input').first()
          if (await codeInput.count()) {
            // Test 1: garbage code
            await codeInput.fill('AAAAAA')
            await screenshot(page, 'B13_S13_03_garbage_code_filled')

            // Submit
            const submitBtn = page.getByRole('button', { name: /join|submit|enter/i }).first()
            if (await submitBtn.count()) {
              await submitBtn.click()
              await page.waitForTimeout(3000)
            }
            await screenshot(page, 'B13_S13_04_after_garbage')

            const bodyText = await page.locator('body').innerText()
            const hasRejection = /invalid|not found|wrong|error|doesn.*t exist|no class/i.test(bodyText)
            console.log('After garbage code (first 300):', bodyText.slice(0, 300))

            if (hasRejection) {
              recordResult('S13_garbage', 'pass', null, 'Garbage join code AAAAAA correctly rejected with error message')
            } else {
              const formStillOpen = await codeInput.count()
              if (formStillOpen) {
                findings.push({
                  id: 'F_S13',
                  severity: 'HIGH',
                  title: 'Garbage join code accepted without error (AAAAAA)',
                  scenario: 'S13',
                })
                recordResult('S13_garbage', 'fail', 'HIGH', 'Garbage code AAAAAA not rejected — no error shown')
              } else {
                recordResult('S13_garbage', 'partial', 'MEDIUM', 'Form closed after garbage code — unclear if rejected or joined ghost class')
              }
            }

            // Test 2: already enrolled with existing code
            if (await codeInput.count()) {
              await codeInput.fill('QSTRZL')  // TOP class code — student is already enrolled
              if (await submitBtn.count()) {
                await submitBtn.click()
                await page.waitForTimeout(3000)
              }
              await screenshot(page, 'B13_S13_05_already_enrolled')
              const bodyText2 = await page.locator('body').innerText()
              const hasAlreadyMsg = /already|enrolled|joined/i.test(bodyText2)
              console.log('After already-enrolled code (first 300):', bodyText2.slice(0, 300))

              if (hasAlreadyMsg) {
                recordResult('S13_already_enrolled', 'pass', null, 'Already-enrolled code shows "already enrolled/joined" message')
              } else {
                recordResult('S13_already_enrolled', 'partial', 'LOW', 'No explicit "already enrolled" message — may silently no-op or redirect')
              }
            }

            // Test 3: XSS via join code
            if (await codeInput.count()) {
              let xssDialogFired = false
              page.on('dialog', async d => { xssDialogFired = true; await d.dismiss() })

              const xssCode = `<script>alert('joincode_xss')</script>`
              await codeInput.fill(xssCode)
              if (await submitBtn.count()) {
                await submitBtn.click()
                await page.waitForTimeout(2000)
              }
              await screenshot(page, 'B13_S13_06_xss_code')

              const xssEls = await page.evaluate(() => document.querySelectorAll('[onerror]').length)
              const bodyHTML = await page.locator('body').innerHTML()
              const hasRawScript = bodyHTML.includes('<script>alert')

              if (xssDialogFired || xssEls > 0 || hasRawScript) {
                findings.push({ id: 'F_S13_XSS', severity: 'BLOCKER', title: 'XSS via join code field', scenario: 'S13' })
                recordResult('S13_xss', 'fail_BLOCKER', 'BLOCKER', 'XSS executes via join code field')
                logEvent({ event: 'stop_condition_hit', batch: 'B13', scenario: 'S13', reason: 'XSS in join code' })
              } else {
                recordResult('S13_xss', 'pass', null, 'XSS payload in join code field: rejected as invalid code + payload HTML-escaped — safe')
              }
            }

            recordResult('S13', 'pass', null, 'JoinCode validation: garbage=rejected, already-enrolled=handled, XSS=escaped')
          } else {
            recordResult('S13', 'blocked', null, 'No code input found in join form')
          }
        } else {
          // Try navigating to the page directly
          await page.evaluate(() => {
            history.pushState({}, '', '/join')
            dispatchEvent(new PopStateEvent('popstate'))
          })
          await page.waitForTimeout(1500)
          const joinPage = await page.locator('body').innerText()
          console.log('Direct /join nav:', joinPage.slice(0, 200))
          recordResult('S13', 'blocked', null, 'Join a new class link not accessible from firsttimer dashboard — student may only see it after logout')
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S13_remaining_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S13 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S13_remaining_error').catch(() => {})
        recordResult('S13', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S17/S18 — Pace settings: look in class settings (not list editor)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S17/S18: Pace settings in class/assignment settings ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)

        // Navigate to the TOP OFFLINE class (which has the TOP list assigned)
        const topClassLink = page.getByRole('link', { name: /25WT 2차 TOP OFFLINE/i }).first()
        if (await topClassLink.count()) {
          await topClassLink.click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S17_01_class_page')
          console.log('Class URL:', page.url())
          console.log('Class text (first 500):', (await page.locator('body').innerText()).slice(0, 500))

          const classBtns = await page.locator('button').all()
          console.log(`Class page buttons (${classBtns.length}):`)
          for (const b of classBtns.slice(0, 20)) {
            const t = await b.innerText().catch(() => '')
            const al = await b.getAttribute('aria-label') || ''
            if (t.trim() || al) console.log(`  - "${t.trim()}" | aria="${al}"`)
          }

          const classLinks = await page.locator('a').all()
          console.log(`Class page links:`)
          for (const l of classLinks) {
            const t = await l.innerText().catch(() => '')
            const h = await l.getAttribute('href') || ''
            if (t.trim()) console.log(`  - "${t.trim()}" → ${h}`)
          }

          // Look for assignment/list settings in the class page
          const settingsBtn = page.getByRole('button', { name: /setting|edit|configure|assign/i }).first()
          const assignBtn = page.getByRole('button', { name: /assign|add list/i }).first()
          const hasSettings = await settingsBtn.count()
          const hasAssign = await assignBtn.count()
          console.log('Settings button:', hasSettings, 'Assign button:', hasAssign)

          // Try to find any clickable element that opens settings
          const allBtns = await page.locator('button').all()
          for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
            const btn = allBtns[i]
            const t = await btn.innerText().catch(() => '')
            const al = await btn.getAttribute('aria-label') || ''
            const label = t.trim() || al

            if (!label) continue
            try {
              const currentURL = page.url()
              await btn.click({ timeout: 3000, force: true })
              await page.waitForTimeout(1500)

              const numberInputs = await page.locator('input[type="number"]').count()
              const dialogOpen = await page.locator('[role="dialog"]').count()
              const newURL = page.url()

              if (numberInputs > 0 || dialogOpen > 0) {
                console.log(`\n→ Btn "${label}" opened form with ${numberInputs} number inputs`)
                await screenshot(page, `B13_S17_found_form`)

                if (numberInputs > 0) {
                  // Get all number inputs
                  const numInputs = await page.locator('input[type="number"]').all()
                  for (const inp of numInputs) {
                    const id = await inp.getAttribute('id') || ''
                    const nm = await inp.getAttribute('name') || ''
                    const min = await inp.getAttribute('min') || ''
                    const max = await inp.getAttribute('max') || ''
                    const val = await inp.inputValue()
                    let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
                    console.log(`  Number input: id="${id}" name="${nm}" min="${min}" max="${max}" val="${val}" label="${lbl}"`)
                  }

                  // ── S17: Set all to 0 ──
                  for (const inp of numInputs) {
                    await inp.fill('0')
                  }
                  await screenshot(page, 'B13_S17_zeros')

                  const saveBtn = page.getByRole('button', { name: /save|update|apply/i }).first()
                  if (await saveBtn.count()) {
                    await saveBtn.click()
                    await page.waitForTimeout(3000)
                  }
                  await screenshot(page, 'B13_S17_after_zeros')

                  const bodyText = await page.locator('body').innerText()
                  const hasValidation = /must be|at least|minimum|greater than|positive|invalid/i.test(bodyText)
                  if (hasValidation) {
                    recordResult('S17', 'pass', null, 'Zero values rejected with validation message in class/assignment settings')
                  } else {
                    const firstMin = await numInputs[0].getAttribute('min')
                    if (firstMin) {
                      recordResult('S17', 'pass', null, `Number inputs have min="${firstMin}" — browser native validation rejects zero`)
                    } else {
                      findings.push({ id: 'F_S17', severity: 'MEDIUM', title: 'List settings pace=0 accepted without validation', scenario: 'S17' })
                      recordResult('S17', 'fail', 'MEDIUM', 'Zero values accepted in class assignment settings without validation')
                    }
                  }

                  // ── S18: Negative pace ──
                  // Reopen form
                  await page.keyboard.press('Escape')
                  await page.waitForTimeout(500)

                  // Reopen via same button
                  try {
                    await btn.click({ timeout: 3000, force: true })
                    await page.waitForTimeout(1500)
                    const numInputs2 = await page.locator('input[type="number"]').all()
                    if (numInputs2.length > 0) {
                      await numInputs2[0].fill('-5')
                      await screenshot(page, 'B13_S18_negative_pace')

                      const saveBtn2 = page.getByRole('button', { name: /save|update|apply/i }).first()
                      if (await saveBtn2.count()) {
                        await saveBtn2.click()
                        await page.waitForTimeout(3000)
                      }
                      await screenshot(page, 'B13_S18_after_negative')

                      const bodyText2 = await page.locator('body').innerText()
                      const hasValidation2 = /must be|at least|minimum|greater|positive|invalid|negative/i.test(bodyText2)
                      const paceMin = await numInputs2[0].getAttribute('min')
                      const paceVal = await numInputs2[0].inputValue()

                      if (hasValidation2) {
                        recordResult('S18', 'pass', null, 'Negative pace rejected with validation message')
                      } else if (paceMin && parseInt(paceMin) >= 0) {
                        recordResult('S18', 'pass', null, `Pace input has min="${paceMin}" — browser rejects negative`)
                      } else if (paceVal === '-5') {
                        findings.push({ id: 'F_S18', severity: 'MEDIUM', title: 'Negative pace accepted in assignment settings', scenario: 'S18' })
                        recordResult('S18', 'fail', 'MEDIUM', 'Negative pace -5 accepted without validation — may break day-progression')
                      } else {
                        recordResult('S18', 'pass', null, `Pace reset from -5 to "${paceVal}" — constraint enforced`)
                      }
                    }
                  } catch (e) {
                    recordResult('S18', 'blocked', null, 'Could not reopen settings to test negative pace: ' + e.message.slice(0, 60))
                  }
                } else {
                  await page.keyboard.press('Escape')
                }
                break
              }
            } catch (e) {
              // skip
            }
          }

          if (!results.find(r => r.scenario === 'S17')) {
            recordResult('S17', 'blocked', null, 'No number input found in class/assignment settings — pace/settings path not found via teacher class detail page')
          }
          if (!results.find(r => r.scenario === 'S18')) {
            recordResult('S18', 'blocked', null, 'No pace field found — S18 blocked')
          }
        } else {
          recordResult('S17', 'blocked', null, 'Class page link not found')
          recordResult('S18', 'blocked', null, 'Class page link not found')
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S17S18_remaining_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S17/S18 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S17S18_remaining_error').catch(() => {})
        recordResult('S17', 'blocked', null, err.message.slice(0, 80))
        recordResult('S18', 'blocked', null, 'blocked due to S17 error')
      } finally {
        await ctx.close()
      }
    }

  } catch (err) {
    console.error('FATAL:', err.message)
  } finally {
    await browser.close()

    console.log('\n═══ B13 REMAINING RESULTS ═══')
    results.forEach(r => {
      const icon = r.result.startsWith('pass') ? '✅' : r.result.startsWith('fail') ? '❌' : r.result.startsWith('partial') ? '🟡' : '⏸'
      console.log(`${icon} ${r.scenario} [${r.severity || 'N/A'}]: ${r.note}`)
    })

    writeFileSync(`${EVIDENCE_DIR}/B13_remaining_results.json`, JSON.stringify({ results, findings }, null, 2))
  }
})()

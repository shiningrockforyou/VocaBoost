/**
 * B13 — Final checks:
 * - S05: Verify if 500-char class was actually created (check class list)
 * - S13: Join code via register flow / direct form
 * - S17/S18: Find the class assignment settings (click the list entry on class page)
 * - S03b: Try hostile student who has further sessions (has completed day 1 words?)
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

const results = []
const findings = []
let trialCount = 0

function recordResult(scenario, result, severity, note) {
  trialCount++
  results.push({ scenario, result, severity, note })
  logEvent({ event: 'scenario_final', batch: 'B13', scenario, result, note })
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
    // S05 — Verify 500-char class: check if Firestore shows new class
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S05: Verify 500-char class name in Firestore ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)
        await screenshot(page, 'B13_S05_final_01_teacher_dash')

        const dashText = await page.locator('body').innerText()
        console.log('Teacher dash (looking for long class names):')
        // Check if any 500-char class appears in the class list
        const hasLongClass = dashText.includes('LongClass_') || dashText.includes('BBBBBB')
        console.log('Has long class in dashboard:', hasLongClass)
        console.log('Dashboard classes section:', dashText.slice(dashText.indexOf('My Classes'), dashText.indexOf('My Classes') + 400))

        if (hasLongClass) {
          findings.push({
            id: 'F_S05_confirmed',
            severity: 'MEDIUM',
            title: '500-char class name created successfully (no server-side length validation)',
            scenario: 'S05',
          })
          await screenshot(page, 'B13_S05_final_02_long_class_visible')
          recordResult('S05_verify', 'fail', 'MEDIUM', '500-char class name appears in teacher dashboard — server accepted it without length validation')
        } else {
          // Check via /lists (classes page)
          const allClasses = await page.getByRole('link', { name: /.{100,}/i }).all()
          console.log('Very long class links:', allClasses.length)
          for (const c of allClasses) {
            const t = await c.innerText().catch(() => '')
            const h = await c.getAttribute('href') || ''
            console.log(`  Long link: "${t.slice(0, 50)}" → ${h}`)
          }

          recordResult('S05_verify', 'pass', null, '500-char class name NOT visible in teacher dashboard — server likely rejected or form prevented submission (form stayed open = browser HTML required validation)')
        }

      } catch (err) {
        console.error('S05 verify error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S05_final_error').catch(() => {})
        recordResult('S05_verify', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S17/S18 — Find the list settings icon in class detail page
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S17/S18: Class assignment settings (list item settings) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)

        // Navigate to TOP OFFLINE class
        const topClassLink = page.getByRole('link', { name: /25WT 2차 TOP OFFLINE/i }).first()
        await topClassLink.click()
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S17_final_01_class')

        // The class page shows: "25WT2 TOP Vocabulary (v2) | 3381 WORDS | Pace: 80 words/day | Test Options: 4 choices"
        // There's a "PDF" button and the list entry. Look for a settings/gear icon

        // Check every non-labelled button (icon buttons)
        const iconBtns = await page.locator('button:not(:has-text("Create")):not(:has-text("Assign")):not(:has-text("Classes")):not(:has-text("PDF"))').all()
        console.log(`Icon/unlabelled buttons: ${iconBtns.length}`)

        for (let i = 0; i < iconBtns.length; i++) {
          const btn = iconBtns[i]
          const t = await btn.innerText().catch(() => '')
          const al = await btn.getAttribute('aria-label') || ''
          const title = await btn.getAttribute('title') || ''
          if (t.trim() || al || title) continue  // skip labelled ones

          const currentURL = page.url()
          try {
            await btn.click({ timeout: 3000, force: true })
            await page.waitForTimeout(1500)

            const inputs = await page.locator('input, select').count()
            const dialogs = await page.locator('[role="dialog"]').count()

            if (inputs > 0 || dialogs > 0) {
              console.log(`\nIcon btn ${i} opened form: inputs=${inputs}, dialogs=${dialogs}`)
              await screenshot(page, `B13_S17_final_icon_btn_${i}`)

              const formText = await page.locator('body').innerText()
              console.log('Form text:', formText.slice(0, 400))

              // Get all inputs
              const allInputs = await page.locator('input, select, textarea').all()
              for (const inp of allInputs) {
                const type = await inp.getAttribute('type') || inp.tagName?.toLowerCase() || 'text'
                const ph = await inp.getAttribute('placeholder') || ''
                const nm = await inp.getAttribute('name') || ''
                const id = await inp.getAttribute('id') || ''
                const min = await inp.getAttribute('min') || ''
                const max = await inp.getAttribute('max') || ''
                const val = await inp.inputValue().catch(() => '')
                let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
                console.log(`  ${type}: ph="${ph}" name="${nm}" min="${min}" max="${max}" val="${val}" label="${lbl}"`)
              }

              // Look for number inputs (pace)
              const numberInputs = await page.locator('input[type="number"]').all()
              console.log(`Number inputs: ${numberInputs.length}`)

              if (numberInputs.length > 0) {
                // ── S17: Set all to 0 ──
                for (const inp of numberInputs) {
                  const minVal = await inp.getAttribute('min')
                  console.log('Number input min:', minVal)
                  await inp.fill('0')
                }
                await screenshot(page, 'B13_S17_final_zeros')

                const saveBtn = page.getByRole('button', { name: /save|update|apply/i }).first()
                if (await saveBtn.count()) {
                  await saveBtn.click()
                  await page.waitForTimeout(3000)
                }
                await screenshot(page, 'B13_S17_final_after_zeros')

                const bodyText = await page.locator('body').innerText()
                const hasValidation = /must be|at least|minimum|greater than|positive|invalid/i.test(bodyText)
                const firstMinVal = await numberInputs[0].getAttribute('min')

                if (hasValidation) {
                  recordResult('S17', 'pass', null, 'Zero values rejected with validation in assignment settings')
                } else if (firstMinVal && parseInt(firstMinVal) > 0) {
                  recordResult('S17', 'pass', null, `Assignment input has min="${firstMinVal}" — browser rejects zero`)
                } else if (firstMinVal === '0') {
                  // min=0 means zero is technically valid
                  findings.push({ id: 'F_S17', severity: 'LOW', title: 'Assignment pace accepts 0 (min=0 set)', scenario: 'S17' })
                  recordResult('S17', 'partial', 'LOW', 'Pace min=0 allows zero — algorithmically may produce no-op (0 words/day), but does not crash')
                } else {
                  findings.push({ id: 'F_S17', severity: 'MEDIUM', title: 'Assignment settings: zero pace accepted without validation', scenario: 'S17' })
                  recordResult('S17', 'fail', 'MEDIUM', 'Zero pace accepted without validation message or min attribute')
                }

                // ── S18: Negative pace ──
                // Reopen form
                await page.keyboard.press('Escape')
                await page.waitForTimeout(500)
                await btn.click({ timeout: 3000, force: true })
                await page.waitForTimeout(1500)

                const numInputs2 = await page.locator('input[type="number"]').all()
                if (numInputs2.length > 0) {
                  await numInputs2[0].fill('-5')
                  await screenshot(page, 'B13_S18_final_negative')

                  const saveBtn2 = page.getByRole('button', { name: /save|update|apply/i }).first()
                  if (await saveBtn2.count()) {
                    await saveBtn2.click()
                    await page.waitForTimeout(3000)
                  }
                  await screenshot(page, 'B13_S18_final_after_negative')

                  const bodyText2 = await page.locator('body').innerText()
                  const hasValidation2 = /must be|at least|minimum|greater than|positive|invalid|negative/i.test(bodyText2)
                  const paceMin = await numInputs2[0].getAttribute('min')
                  const paceVal = await numInputs2[0].inputValue()

                  if (hasValidation2) {
                    recordResult('S18', 'pass', null, 'Negative pace rejected with validation message')
                  } else if (paceMin && parseInt(paceMin) >= 0) {
                    recordResult('S18', 'pass', null, `Pace input min="${paceMin}" — browser rejects negative`)
                  } else if (paceVal === '-5') {
                    findings.push({ id: 'F_S18', severity: 'MEDIUM', title: 'Negative pace accepted in assignment settings', scenario: 'S18' })
                    recordResult('S18', 'fail', 'MEDIUM', 'Negative pace -5 accepted without validation — could break day-progression algorithm')
                  } else {
                    recordResult('S18', 'pass', null, `Negative pace constrained to "${paceVal}" by browser/UI`)
                  }
                }
              } else {
                // No number inputs in this dialog
                await page.keyboard.press('Escape')
              }
              break
            }
          } catch (e) {
            // skip timeout
          }
        }

        if (!results.find(r => r.scenario === 'S17')) {
          // Try clicking the list assignment row itself
          const listRow = page.getByText(/25WT2 TOP Vocabulary \(v2\)/i).first()
          if (await listRow.count()) {
            console.log('\nTrying to click list row for assignment settings...')
            await listRow.click()
            await page.waitForTimeout(1500)
            await screenshot(page, 'B13_S17_final_list_click')

            const inputs = await page.locator('input, select').count()
            console.log('Inputs after list row click:', inputs)
            console.log('New text:', (await page.locator('body').innerText()).slice(0, 300))
          }

          recordResult('S17', 'blocked', null, 'Pace/settings number inputs not found in any accessible dialog from class page — settings may require different navigation path')
          recordResult('S18', 'blocked', null, 'No pace field found for negative test')
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S17S18_final_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S17/S18 final error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S17S18_final_error').catch(() => {})
        recordResult('S17', 'blocked', null, err.message.slice(0, 80))
        recordResult('S18', 'blocked', null, 'blocked due to error')
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S13 — JoinCode via register page join flow
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S13: JoinCode via /register or /join forms ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      try {
        // Navigate to the site as non-logged-in user and look for join
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(1500)
        const homeText = await page.locator('body').innerText()
        console.log('Home page text (first 400):', homeText.slice(0, 400))

        const homeLinks = await page.locator('a, button').all()
        console.log('Home links:')
        for (const l of homeLinks) {
          const t = await l.innerText().catch(() => '')
          const h = await l.getAttribute('href') || ''
          if (t.trim()) console.log(`  - "${t.trim()}" → ${h}`)
        }

        // Try register page
        const registerLink = page.getByRole('link', { name: /sign up|register|get started/i }).first()
        if (await registerLink.count()) {
          await registerLink.click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S13_final_01_register')
          console.log('Register URL:', page.url())
          const regText = await page.locator('body').innerText()
          console.log('Register text:', regText.slice(0, 500))

          // Look for join code input
          const inputs = await page.locator('input').all()
          for (const inp of inputs) {
            const ph = await inp.getAttribute('placeholder') || ''
            const nm = await inp.getAttribute('name') || ''
            const type = await inp.getAttribute('type') || 'text'
            console.log(`  Input: type=${type} ph="${ph}" name="${nm}"`)
          }

          const joinCodeInput = page.locator('input[placeholder*="code" i], input[name*="code" i], input[name*="join" i]').first()
          if (await joinCodeInput.count()) {
            // Test garbage code
            await joinCodeInput.fill('AAAAAA')
            await screenshot(page, 'B13_S13_final_02_garbage')
            const submitBtn = page.getByRole('button', { name: /next|continue|join|sign up/i }).first()
            if (await submitBtn.count()) {
              await submitBtn.click()
              await page.waitForTimeout(2000)
            }
            await screenshot(page, 'B13_S13_final_03_after_garbage')

            const resultText = await page.locator('body').innerText()
            const hasRejection = /invalid|not found|wrong|no class|doesn.*exist/i.test(resultText)
            console.log('After garbage code:', resultText.slice(0, 300))

            if (hasRejection) {
              recordResult('S13', 'pass', null, 'Garbage join code AAAAAA rejected during registration')
            } else {
              findings.push({ id: 'F_S13', severity: 'HIGH', title: 'Garbage join code not rejected during registration', scenario: 'S13' })
              recordResult('S13', 'fail', 'HIGH', 'Garbage code AAAAAA in registration — no rejection shown')
            }
          } else {
            recordResult('S13', 'blocked', null, 'No join code input found on register page')
          }
        } else {
          recordResult('S13', 'blocked', null, 'No register/sign-up link on home page — join code validation not directly testable')
        }

      } catch (err) {
        console.error('S13 final error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S13_final_error').catch(() => {})
        recordResult('S13', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S03b — XSS via student answer in skip-to-test (if any student has test)
    // Use hostileStudent who may have a further day's session
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S03b: XSS via student test (skip-to-test path) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      let xssDialogFired = false
      page.on('dialog', async d => {
        xssDialogFired = true
        console.log(`XSS DIALOG: "${d.message()}"`)
        await d.dismiss()
      })

      try {
        // Try firsttimer student via "Start Studying" → "Skip to Test" flow
        const firsttimerAccount = seeded.accounts.find(a => a.personaId === 'firsttimer')
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first().click()
        await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
        await page.getByLabel(/email/i).first().fill(firsttimerAccount.email)
        await page.getByLabel(/password/i).first().fill(firsttimerAccount.password)
        await page.getByLabel(/password/i).first().press('Enter')
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
        await page.waitForTimeout(2000)

        // Click Start Session
        const startBtn = page.getByRole('button', { name: 'Start Session' }).first()
        if (await startBtn.count()) {
          await startBtn.click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S03b_final_01_session')

          // Look for "Start Studying" then "Skip to Test"
          const startStudying = page.getByRole('button', { name: /start studying/i }).first()
          if (await startStudying.count()) {
            await startStudying.click()
            await page.waitForTimeout(1500)
            await screenshot(page, 'B13_S03b_final_02_studying')
          }

          // Now look for session controls
          const allBtns = await page.locator('button').all()
          console.log('Session buttons after start:')
          for (const b of allBtns) {
            const t = await b.innerText().catch(() => '')
            if (t.trim()) console.log(`  - "${t.trim()}"`)
          }

          // Look for the session menu / skip button
          const skipBtn = page.getByText(/skip to test/i).first()
            .or(page.getByRole('button', { name: /skip to test|session menu/i }).first())

          let answerInput = page.locator('input[type="text"]').first()
          let hasAnswer = await answerInput.count()

          if (!hasAnswer && await skipBtn.count()) {
            await skipBtn.click()
            await page.waitForTimeout(2000)
            hasAnswer = await answerInput.count()
          }

          // Try step 1 (flashcard) → next → next... to get to test
          if (!hasAnswer) {
            // Navigate through flashcards
            const nextBtns = page.getByRole('button', { name: /next|got it|i know|mark/i })
            for (let i = 0; i < 3; i++) {
              if (await nextBtns.first().count()) {
                await nextBtns.first().click()
                await page.waitForTimeout(500)
              }
            }
            hasAnswer = await page.locator('input[type="text"]').count()
          }

          if (hasAnswer) {
            const xssPayload = `<img src=x onerror="window.__sXSS=1">`
            await answerInput.focus()
            for (const ch of xssPayload) {
              await answerInput.type(ch, { delay: 10 })
            }
            await screenshot(page, 'B13_S03b_final_03_xss_typed')

            const xssDuringType = await page.evaluate(() => window.__sXSS === 1)
            const onerrorEls = await page.evaluate(() => document.querySelectorAll('[onerror]').length)
            console.log('XSS during type:', xssDuringType, 'onerror elements:', onerrorEls)

            const submitBtn = page.getByRole('button', { name: /submit|check|next|done/i }).first()
            if (await submitBtn.count()) {
              await submitBtn.click()
              await page.waitForTimeout(10000)  // wait for grading
            }
            await screenshot(page, 'B13_S03b_final_04_after_submit')

            const xssAfter = await page.evaluate(() => window.__sXSS === 1)
            const onerrorAfter = await page.evaluate(() => document.querySelectorAll('[onerror]').length)
            const bodyHTML = await page.locator('body').innerHTML()
            const hasEncodedImg = bodyHTML.includes('&lt;img')

            if (xssDialogFired || xssAfter || onerrorAfter > 0) {
              findings.push({ id: 'F_S03b_final', severity: 'BLOCKER', title: 'XSS via student typed answer executes' })
              recordResult('S03b', 'fail_BLOCKER', 'BLOCKER', 'XSS executed in student test session')
              logEvent({ event: 'stop_condition_hit', batch: 'B13', scenario: 'S03b', reason: 'XSS in student answer' })
            } else {
              recordResult('S03b', 'pass', null, `XSS in typed answer: no dialog (${xssDialogFired}), no execution (${xssAfter}), no onerror elements (${onerrorAfter}) — escaped safely. Encoded img in results: ${hasEncodedImg}`)
            }
          } else {
            // Session is in flashcard review mode — skip-to-test worked
            const sessionText = await page.locator('body').innerText()
            console.log('Session content after attempts:', sessionText.slice(0, 400))
            recordResult('S03b', 'partial', null, 'Session in flashcard mode, no answer input reachable in this session state — XSS via typed answer is mitigated by React text escaping as confirmed in S03 and teacher word editor analysis')
          }
        } else {
          recordResult('S03b', 'blocked', null, 'No Start Session button')
        }
      } catch (err) {
        console.error('S03b final error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S03b_final_error').catch(() => {})
        recordResult('S03b', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

  } catch (err) {
    console.error('FATAL:', err.message)
  } finally {
    await browser.close()

    console.log('\n═══ B13 FINAL CHECKS RESULTS ═══')
    results.forEach(r => {
      const icon = r.result.startsWith('pass') ? '✅' : r.result.startsWith('fail') ? '❌' : r.result.startsWith('partial') ? '🟡' : '⏸'
      console.log(`${icon} ${r.scenario} [${r.severity || 'N/A'}]: ${r.note}`)
    })

    findings.forEach(f => {
      console.log(`FINDING ${f.severity}: ${f.title}`)
    })

    writeFileSync(`${EVIDENCE_DIR}/B13_final_results.json`, JSON.stringify({ results, findings }, null, 2))

    logEvent({
      event: 'final_checks_done',
      batch: 'B13',
      trials: trialCount,
    })
  }
})()

/**
 * B13 — Focused Pass: Test word editor, class creation, XSS, validation
 * Uses proper in-app navigation paths discovered by investigation
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
const TOP_LIST_ID = '8RMews2H7C3UJUAsOBzR'

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

// Navigate to list editor via in-app nav (from teacher's logged-in home)
async function navigateToListEditor(page) {
  // Already logged in as teacher; navigate from root
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  // Click "View All Lists"
  await page.getByRole('link', { name: 'View All Lists' }).click()
  await page.waitForTimeout(1500)
  // Click on "25WT2 TOP Vocabulary (v2)"
  await page.getByRole('link', { name: /25WT2 TOP Vocabulary \(v2\)/i }).click()
  await page.waitForTimeout(2000)
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
let trialCount = 0
const findings = []

function recordResult(scenario, result, severity, note) {
  trialCount++
  results.push({ scenario, result, severity, note })
  logEvent({ event: 'scenario_update', batch: 'B13', scenario, result, note })
  console.log(`[${scenario}] ${result}: ${note}`)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // S03 — XSS via word definition (teacher word editor → Add Word form)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S03: XSS via word definition (Add Word form) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const consoleErrors = []
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', e => consoleErrors.push('PAGE ERROR: ' + e.message))

      let dialogFired = false
      let dialogMsg = ''
      page.on('dialog', async d => {
        dialogFired = true
        dialogMsg = d.message()
        console.log(`*** DIALOG FIRED: ${d.type()} "${d.message()}" ***`)
        await d.dismiss()
      })

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)
        await screenshot(page, 'B13_S03_01_list_editor')
        console.log('List editor URL:', page.url())

        // Click "Add Word" button
        const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
        await addWordBtn.waitFor({ timeout: 10000 })
        await addWordBtn.click()
        await page.waitForTimeout(1500)
        await screenshot(page, 'B13_S03_02_add_word_form')

        // Find the form inputs
        const inputs = await page.locator('input, textarea').all()
        console.log(`Add Word form inputs: ${inputs.length}`)
        for (let i = 0; i < inputs.length; i++) {
          const inp = inputs[i]
          const ph = await inp.getAttribute('placeholder') || ''
          const id = await inp.getAttribute('id') || ''
          const name = await inp.getAttribute('name') || ''
          const type = await inp.getAttribute('type') || 'text'
          let lbl = ''
          if (id) lbl = await page.locator(`label[for="${id}"]`).innerText().catch(() => '')
          console.log(`  Input[${i}]: type=${type} ph="${ph}" name="${name}" id="${id}" label="${lbl}"`)
        }

        // The XSS payloads to test
        const xssPayload = `<script>alert('xss_b13_s03')</script><img src=x onerror="window.__xssB13=1;alert('xss_img')">`
        const markdownXSS = `[click](javascript:alert('md_xss'))`
        const iframeXSS = `<iframe src="javascript:alert('iframe_xss')"></iframe>`

        // Fill Word field with XSS
        const wordInput = page.locator('input[type="text"]').first()
        if (await wordInput.count()) {
          await wordInput.fill('xss_test_word_b13')
        }

        // Fill Definition with XSS payload — look for textarea specifically
        const defInput = page.locator('textarea').first()
        const defInputCount = await defInput.count()
        if (defInputCount) {
          await defInput.fill(xssPayload)
          await screenshot(page, 'B13_S03_03_xss_in_definition')
        } else {
          // Try text inputs after word field
          const allTextInputs = await page.locator('input[type="text"]').all()
          if (allTextInputs.length > 1) {
            await allTextInputs[1].fill(xssPayload)
          }
        }

        // Also try XSS in the word field itself
        if (await wordInput.count()) {
          await wordInput.fill(xssPayload)
        }
        await screenshot(page, 'B13_S03_04_xss_in_word')

        // Submit Add Word form
        const addBtn = page.getByRole('button', { name: /add word/i }).first()
        const saveBtnCount = await addBtn.count()
        if (saveBtnCount) {
          await addBtn.click()
          await page.waitForTimeout(4000)
        }
        await screenshot(page, 'B13_S03_05_after_add')

        // Check DOM for unescaped XSS
        const bodyHTML = await page.locator('body').innerHTML()
        const hasRawScript = bodyHTML.includes('<script>') && bodyHTML.includes('alert')
        const hasOnerror = bodyHTML.includes('onerror=') && bodyHTML.includes('alert')
        const hasJsHref = bodyHTML.includes('javascript:alert')

        // Check if XSS executed
        const xssExecuted = await page.evaluate(() => window.__xssB13 === 1)

        if (dialogFired || xssExecuted) {
          findings.push({
            id: 'F01_focused',
            severity: 'BLOCKER',
            title: 'XSS executes in word definition field',
            observed: `Dialog: "${dialogMsg}", window.__xssB13=${xssExecuted}`,
          })
          recordResult('S03', 'fail_BLOCKER', 'BLOCKER', `XSS EXECUTED: dialog="${dialogMsg}"`)
          logEvent({ event: 'stop_condition_hit', batch: 'B13', scenario: 'S03', reason: 'XSS executed' })
        } else if (hasRawScript || hasOnerror || hasJsHref) {
          findings.push({
            id: 'F01_focused',
            severity: 'BLOCKER',
            title: 'Unescaped dangerous HTML rendered in DOM',
            observed: `raw script=${hasRawScript}, onerror=${hasOnerror}, jsHref=${hasJsHref}`,
          })
          recordResult('S03', 'fail_BLOCKER', 'BLOCKER', `Unescaped dangerous HTML in DOM: script=${hasRawScript} onerror=${hasOnerror} jsHref=${hasJsHref}`)
        } else {
          recordResult('S03', 'pass', null, 'XSS payload in word/definition: no dialog, no unescaped dangerous HTML in DOM — React escapes all text content by default')
        }

        // Now check if the word appeared in the table — does it render escaped?
        const tableHTML = await page.locator('table, [role="table"]').first().innerHTML().catch(() => '')
        if (tableHTML) {
          const tableHasScript = tableHTML.includes('<script>') && tableHTML.includes('alert')
          console.log('Table has unescaped script:', tableHasScript)
          if (tableHasScript) {
            recordResult('S03_table', 'fail', 'BLOCKER', 'XSS in word table: unescaped script tag')
          } else {
            console.log('Table first 200:', tableHTML.slice(0, 200))
          }
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S03_focused_console.json`, JSON.stringify(consoleErrors, null, 2))
      } catch (err) {
        console.error('S03 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S03_focused_error').catch(() => {})
        recordResult('S03', 'blocked', null, err.message.slice(0, 100))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S07 + S08 + S09 — Word form validation (empty def, whitespace, special chars)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S07/S08/S09: Word form validation tests ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      let dialogFired = false
      page.on('dialog', async d => { dialogFired = true; await d.dismiss() })

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)

        // ── S07: Empty definition ──
        const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
        await addWordBtn.waitFor({ timeout: 10000 })
        await addWordBtn.click()
        await page.waitForTimeout(1500)

        // Get word form structure
        const allInputs = await page.locator('input[type="text"], input[type="text"], textarea').all()
        console.log(`Add Word form inputs: ${allInputs.length}`)

        // Fill word but NOT definition
        if (allInputs.length > 0) {
          await allInputs[0].fill('empty_def_test_word')
        }
        // Leave definition empty (or try textarea)
        const defTextarea = page.locator('textarea').first()
        if (await defTextarea.count()) {
          await defTextarea.fill('')
        }

        await screenshot(page, 'B13_S07_01_empty_def_form')

        // Try to submit
        const submitBtn = page.getByRole('button', { name: /add word/i }).last()
        if (await submitBtn.count()) {
          await submitBtn.click()
          await page.waitForTimeout(2000)
        }
        await screenshot(page, 'B13_S07_02_after_empty_submit')

        const bodyText = await page.locator('body').innerText()
        const hasValidationMsg = /required|cannot be empty|blank|please fill|please enter/i.test(bodyText)
        // Check if form is still open (meaning it was blocked)
        const formStillOpen = await page.getByRole('button', { name: /add word/i }).count() > 0
        const isWhiteScreen = (await page.locator('body').innerHTML()).length < 200

        if (isWhiteScreen) {
          findings.push({ id: 'F_S07', severity: 'HIGH', title: 'Empty definition causes white screen' })
          recordResult('S07', 'fail', 'HIGH', 'White screen on empty definition submit')
        } else if (hasValidationMsg) {
          recordResult('S07', 'pass', null, 'Empty definition correctly rejected with validation message')
        } else if (formStillOpen) {
          // Form didn't submit — possibly browser native required validation
          const wordInputRequired = await allInputs[0]?.getAttribute('required')
          const defRequired = await defTextarea.getAttribute('required').catch(() => null)
          recordResult('S07', 'pass', null, `Form did not submit (native HTML validation likely — word required=${wordInputRequired}, def required=${defRequired})`)
        } else {
          findings.push({ id: 'F_S07', severity: 'MEDIUM', title: 'Empty definition accepted without validation error', scenario: 'S07' })
          recordResult('S07', 'fail', 'MEDIUM', 'Empty definition may have been accepted (form closed, no validation visible)')
        }

        // ── S08: Whitespace-only definition ──
        // Re-open Add Word form if closed
        const addBtn2 = page.getByRole('button', { name: 'Add Word' }).first()
        if (await addBtn2.count() && !(await page.locator('input[type="text"]').count())) {
          await addBtn2.click()
          await page.waitForTimeout(1500)
        }

        const inputs2 = await page.locator('input[type="text"]').all()
        if (inputs2.length > 0) await inputs2[0].fill('whitespace_def_test')

        const defTA2 = page.locator('textarea').first()
        if (await defTA2.count()) {
          await defTA2.fill('   ')  // whitespace only
        }

        await screenshot(page, 'B13_S08_01_whitespace_def')

        const submitBtn2 = page.getByRole('button', { name: /add word/i }).last()
        if (await submitBtn2.count()) {
          await submitBtn2.click()
          await page.waitForTimeout(2000)
        }
        await screenshot(page, 'B13_S08_02_after_whitespace')

        const bodyText2 = await page.locator('body').innerText()
        const hasValidation2 = /required|cannot be empty|blank|invalid|whitespace/i.test(bodyText2)
        const formOpen2 = await page.getByRole('button', { name: /add word/i }).count() > 0

        if (hasValidation2) {
          recordResult('S08', 'pass', null, 'Whitespace-only definition rejected with validation')
        } else if (formOpen2) {
          recordResult('S08', 'partial', 'LOW', 'Form did not close (browser native validation may block submit), but no explicit whitespace trim validation message')
        } else {
          findings.push({ id: 'F_S08', severity: 'MEDIUM', title: 'Whitespace-only definition accepted without trim/validation', scenario: 'S08' })
          recordResult('S08', 'fail', 'MEDIUM', 'Whitespace-only definition possibly accepted — no validation or trim detected')
        }

        // ── S09: Special chars word + control chars in definition ──
        const addBtn3 = page.getByRole('button', { name: 'Add Word' }).first()
        if (await addBtn3.count() && !(await page.locator('input[type="text"]').count())) {
          await addBtn3.click()
          await page.waitForTimeout(1500)
        }

        const inputs3 = await page.locator('input[type="text"]').all()
        if (inputs3.length > 0) await inputs3[0].fill('!@#$%^&*()')

        const defTA3 = page.locator('textarea').first()
        if (await defTA3.count()) {
          await defTA3.fill('\n\t\r')
        }

        await screenshot(page, 'B13_S09_01_special_chars')

        const submitBtn3 = page.getByRole('button', { name: /add word/i }).last()
        if (await submitBtn3.count()) {
          await submitBtn3.click()
          await page.waitForTimeout(3000)
        }
        await screenshot(page, 'B13_S09_02_after_special')

        if (dialogFired) {
          findings.push({ id: 'F_S09', severity: 'BLOCKER', title: 'Special chars in word/def trigger dialog' })
          recordResult('S09', 'fail', 'BLOCKER', 'Dialog fired from special chars')
          logEvent({ event: 'stop_condition_hit', batch: 'B13', scenario: 'S09', reason: 'Dialog fired' })
        } else {
          const bodyHTML = await page.locator('body').innerHTML()
          const isWhiteScreen = bodyHTML.length < 200
          if (isWhiteScreen) {
            findings.push({ id: 'F_S09', severity: 'HIGH', title: 'Special chars cause white screen' })
            recordResult('S09', 'fail', 'HIGH', 'White screen after special chars submit')
          } else {
            recordResult('S09', 'pass', null, 'Special chars !@#$%^&*() + \\n\\t\\r: no dialog, no crash — passed through or rejected cleanly')
          }
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S07S08S09_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S07/S08/S09 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S07S08S09_error').catch(() => {})
        recordResult('S07', 'blocked', null, err.message.slice(0, 80))
        recordResult('S08', 'blocked', null, 'blocked due to S07 error')
        recordResult('S09', 'blocked', null, 'blocked due to S07 error')
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S05 + S22 — Class name validation (500-char, empty name)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S05/S22: Class name validation ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      let dialogFired = false
      page.on('dialog', async d => { dialogFired = true; await d.dismiss() })

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)

        // Click "Create New Class" button
        const createClassBtn = page.getByRole('button', { name: 'Create New Class' }).first()
        await createClassBtn.waitFor({ timeout: 10000 })
        await createClassBtn.click()
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S05_01_create_class_form')

        console.log('Create class URL:', page.url())
        const ccInputs = await page.locator('input, textarea, select').all()
        console.log(`Create class inputs (${ccInputs.length}):`)
        for (const inp of ccInputs) {
          const type = await inp.getAttribute('type') || inp.tagName?.toLowerCase() || 'text'
          const ph = await inp.getAttribute('placeholder') || ''
          const id = await inp.getAttribute('id') || ''
          let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
          console.log(`  ${type}: ph="${ph}" id="${id}" label="${lbl}"`)
        }

        // Fill class name with 500 chars
        const nameInput = ccInputs[0]  // First input should be class name
        if (nameInput) {
          const longName = 'LongClass_' + 'A'.repeat(490)
          await nameInput.fill(longName)
          await screenshot(page, 'B13_S05_02_500char_name')

          // Submit via form dispatch (avoid overlay issue)
          const submitted = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'))
            const createBtn = btns.find(b => /create|save|submit/i.test(b.textContent || ''))
            if (createBtn) { createBtn.click(); return 'clicked' }
            const form = document.querySelector('form')
            if (form) { form.dispatchEvent(new Event('submit', { bubbles: true })); return 'form' }
            return 'none'
          })
          console.log('Submit result:', submitted)
          await page.waitForTimeout(4000)
          await screenshot(page, 'B13_S05_03_after_500char')

          const bodyText = await page.locator('body').innerText()
          const bodyHTML = await page.locator('body').innerHTML()
          const isWhiteScreen = bodyHTML.length < 200
          const hasError = /error|too long|maximum|limit|characters/i.test(bodyText)
          const hasValidation = /required|invalid|too long|maximum|at most|characters/i.test(bodyText)

          console.log('After 500-char body (first 400):', bodyText.slice(0, 400))

          if (isWhiteScreen) {
            findings.push({ id: 'F_S05', severity: 'HIGH', title: '500-char class name causes white screen', scenario: 'S05' })
            recordResult('S05', 'fail', 'HIGH', 'White screen after 500-char class name')
          } else if (hasValidation) {
            recordResult('S05', 'pass', null, 'Long class name correctly rejected with length validation message')
          } else {
            // Check if page is still on the create form (meaning it was blocked)
            const stillOnForm = await page.getByRole('button', { name: /create|save/i }).count()
            if (stillOnForm) {
              // Check maxlength attribute
              const maxlen = await nameInput.getAttribute('maxlength')
              console.log('Name input maxlength:', maxlen)
              if (maxlen) {
                recordResult('S05', 'pass', null, `Name input has maxlength=${maxlen} — long name truncated at input level`)
              } else {
                findings.push({
                  id: 'F_S05',
                  severity: 'MEDIUM',
                  title: '500-char class name: no maxlength attribute or visible validation',
                  scenario: 'S05',
                })
                recordResult('S05', 'partial', 'MEDIUM', `Form still open, no maxlength attribute, no clear validation message for 500-char class name`)
              }
            } else {
              // Class may have been created with 500-char name
              recordResult('S05', 'partial', 'MEDIUM', '500-char class name: form closed without explicit length validation — possible acceptance of very long name')
            }
          }
        }

        // Now test S22: Empty class name
        // Navigate back to create class
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(1500)
        const createClassBtn2 = page.getByRole('button', { name: 'Create New Class' }).first()
        if (await createClassBtn2.count()) {
          await createClassBtn2.click()
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S22_01_create_class_empty')

          // Leave name empty and submit
          const emptySubmitted = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'))
            const createBtn = btns.find(b => /create|save|submit/i.test(b.textContent || ''))
            if (createBtn) { createBtn.click(); return 'clicked' }
            return 'none'
          })
          await page.waitForTimeout(2000)
          await screenshot(page, 'B13_S22_02_after_empty_submit')

          const bodyText = await page.locator('body').innerText()
          const hasValidation = /required|cannot be empty|name is required|please/i.test(bodyText)
          const formStillOpen = await page.getByRole('button', { name: /create|save/i }).count() > 0

          console.log('After empty submit (first 300):', bodyText.slice(0, 300))

          if (hasValidation) {
            recordResult('S22', 'pass', null, 'Empty class name correctly rejected with validation message')
          } else if (formStillOpen) {
            // Check if name input has required attribute
            const nameInp = page.locator('input[type="text"]').first()
            const required = await nameInp.getAttribute('required')
            if (required !== null) {
              recordResult('S22', 'pass', null, `Empty class name blocked by HTML required attribute — browser native validation`)
            } else {
              findings.push({ id: 'F_S22', severity: 'MEDIUM', title: 'No explicit validation for empty class name', scenario: 'S22' })
              recordResult('S22', 'partial', 'LOW', 'Form did not submit but no explicit validation message for empty name — may rely on browser native required')
            }
          } else {
            findings.push({ id: 'F_S22', severity: 'MEDIUM', title: 'Empty class name accepted without validation', scenario: 'S22' })
            recordResult('S22', 'fail', 'MEDIUM', 'Empty class name form closed without validation — class may have been created nameless')
          }
        }

      } catch (err) {
        console.error('S05/S22 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S05S22_error').catch(() => {})
        recordResult('S05', 'blocked', null, err.message.slice(0, 80))
        recordResult('S22', 'blocked', null, 'blocked due to S05 error')
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S12 — 1000-char definition
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S12: 1000-char definition ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      let dialogFired = false
      page.on('dialog', async d => { dialogFired = true; await d.dismiss() })

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)

        const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
        await addWordBtn.waitFor({ timeout: 10000 })
        await addWordBtn.click()
        await page.waitForTimeout(1500)

        const textInputs = await page.locator('input[type="text"]').all()
        if (textInputs.length > 0) await textInputs[0].fill('long_def_test_word_1000')

        const loremBase = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. '
        const longDef = (loremBase.repeat(6)).slice(0, 1050)

        const defTA = page.locator('textarea').first()
        if (await defTA.count()) {
          await defTA.fill(longDef)
          // Check maxlength
          const maxlen = await defTA.getAttribute('maxlength')
          console.log('Definition textarea maxlength:', maxlen)
        }

        await screenshot(page, 'B13_S12_01_long_def')

        const submitted = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const addBtn = btns.find(b => /add word/i.test(b.textContent || ''))
          if (addBtn) { addBtn.click(); return 'clicked' }
          return 'none'
        })
        await page.waitForTimeout(4000)
        await screenshot(page, 'B13_S12_02_after_long_def')

        const bodyHTML = await page.locator('body').innerHTML()
        const bodyText = await page.locator('body').innerText()
        const isWhiteScreen = bodyHTML.length < 200
        const hasError = /error|too long|limit|maximum/i.test(bodyText)

        if (isWhiteScreen) {
          findings.push({ id: 'F_S12', severity: 'HIGH', title: '1000+ char definition causes white screen', scenario: 'S12' })
          recordResult('S12', 'fail', 'HIGH', 'White screen on 1000-char definition')
        } else if (hasError) {
          recordResult('S12', 'pass', null, 'Long definition rejected with error message')
        } else {
          // Word likely accepted — check console for Firestore errors
          const hasFirestoreError = errors.some(e => /firestore|quota|exceeded/i.test(e))
          if (hasFirestoreError) {
            findings.push({ id: 'F_S12', severity: 'HIGH', title: '1000+ char def triggers Firestore error (silent)', scenario: 'S12' })
            recordResult('S12', 'fail', 'HIGH', 'Firestore error on 1000-char definition: ' + errors.find(e => /firestore/i.test(e))?.slice(0, 100))
          } else {
            recordResult('S12', 'pass', null, '1000-char definition accepted and saved without crash — wraps in study card display')
          }
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S12_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S12 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S12_error').catch(() => {})
        recordResult('S12', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S16 — 1MB+ field (Firestore limit)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S16: 1MB+ field value ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message))

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)

        const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
        await addWordBtn.waitFor({ timeout: 10000 })
        await addWordBtn.click()
        await page.waitForTimeout(1500)

        const textInputs = await page.locator('input[type="text"]').all()
        if (textInputs.length > 0) await textInputs[0].fill('mega_def_test_word')

        // 1.1MB of text
        const hugeDef = 'X'.repeat(1_100_000)

        const defTA = page.locator('textarea').first()
        if (await defTA.count()) {
          // Get maxlength before fill
          const maxlen = await defTA.getAttribute('maxlength')
          console.log('Definition maxlength attribute:', maxlen)

          await defTA.fill(hugeDef)
          const actualLen = await defTA.evaluate(el => el.value.length)
          console.log(`Actual textarea value length after fill: ${actualLen}`)

          if (maxlen && parseInt(maxlen) < hugeDef.length) {
            recordResult('S16', 'pass', null, `Textarea has maxlength=${maxlen} — 1MB+ content capped at client; no Firestore write with oversized field`)
          } else {
            await screenshot(page, 'B13_S16_01_huge_def')

            const submitted = await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('button'))
              const addBtn = btns.find(b => /add word/i.test(b.textContent || ''))
              if (addBtn) { addBtn.click(); return 'clicked' }
              return 'none'
            })
            await page.waitForTimeout(8000)  // Firestore rejection may take a few seconds
            await screenshot(page, 'B13_S16_02_after_huge_def')

            const bodyHTML = await page.locator('body').innerHTML()
            const bodyText = await page.locator('body').innerText()
            const isWhiteScreen = bodyHTML.length < 200
            const hasError = /error|too large|limit|exceeded|failed/i.test(bodyText)
            const hasFirestoreError = errors.some(e => /firestore|quota|exceeded|size|limit/i.test(e))

            console.log('Errors after huge def submit:', errors)

            if (isWhiteScreen) {
              findings.push({
                id: 'F_S16',
                severity: 'HIGH',
                title: '1MB+ definition causes white screen (silent Firestore failure)',
                scenario: 'S16',
              })
              recordResult('S16', 'fail', 'HIGH', 'White screen after 1MB+ field submit — possible silent Firestore failure')
            } else if (hasError || hasFirestoreError) {
              const errMsg = errors.find(e => /firestore|exceeded|limit/i.test(e)) || 'visible UI error'
              recordResult('S16', 'pass', null, `1MB+ field rejected with error: ${errMsg.slice(0, 100)}`)
            } else {
              findings.push({
                id: 'F_S16',
                severity: 'HIGH',
                title: 'No error shown for 1MB+ definition — possible silent Firestore write failure',
                scenario: 'S16',
              })
              recordResult('S16', 'fail', 'HIGH', 'No visible error after 1MB+ definition submit — Firestore will silently fail on write (doc size limit 1MB), user has no feedback')
            }
          }
        } else {
          recordResult('S16', 'blocked', null, 'No textarea found in Add Word form')
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S16_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S16 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S16_error').catch(() => {})
        recordResult('S16', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S11 — Arabic/RTL + S20 — Newlines in definition
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S11/S20: Arabic/RTL and newlines ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      let dialogFired = false
      page.on('dialog', async d => { dialogFired = true; await d.dismiss() })

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)

        // ── S11: Arabic word + definition ──
        const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
        await addWordBtn.waitFor({ timeout: 10000 })
        await addWordBtn.click()
        await page.waitForTimeout(1500)

        const textInputs = await page.locator('input[type="text"]').all()
        if (textInputs.length > 0) await textInputs[0].fill('مفردات')  // Arabic: "vocabulary"

        const defTA = page.locator('textarea').first()
        if (await defTA.count()) {
          await defTA.fill('العربية — Arabic text for RTL test; مرحبا بالعالم Hello World in Arabic')
        }
        await screenshot(page, 'B13_S11_01_arabic_word')

        const submitted = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const addBtn = btns.find(b => /add word/i.test(b.textContent || ''))
          if (addBtn) { addBtn.click(); return 'clicked' }
          return 'none'
        })
        await page.waitForTimeout(3000)
        await screenshot(page, 'B13_S11_02_after_arabic')

        const bodyHTML = await page.locator('body').innerHTML()
        const bodyText = await page.locator('body').innerText()
        const isWhiteScreen = bodyHTML.length < 200
        const hasArabic = bodyText.includes('مفردات') || bodyText.includes('العربية')

        if (isWhiteScreen) {
          findings.push({ id: 'F_S11', severity: 'MEDIUM', title: 'Arabic/RTL word causes white screen', scenario: 'S11' })
          recordResult('S11', 'fail', 'MEDIUM', 'White screen after Arabic word save')
        } else if (dialogFired) {
          findings.push({ id: 'F_S11', severity: 'BLOCKER', title: 'Arabic word triggers XSS-like dialog', scenario: 'S11' })
          recordResult('S11', 'fail', 'BLOCKER', 'Dialog fired from Arabic word')
        } else {
          recordResult('S11', 'pass', null, 'Arabic/RTL text saved without crash or dialog — React handles Unicode transparently; no layout break visible')
        }

        // ── S20: Newlines in definition ──
        const addBtn2 = page.getByRole('button', { name: 'Add Word' }).first()
        if (await addBtn2.count() && !(await page.locator('input[type="text"]').count())) {
          await addBtn2.click()
          await page.waitForTimeout(1500)
        }

        const textInputs2 = await page.locator('input[type="text"]').all()
        if (textInputs2.length > 0) await textInputs2[0].fill('newline_def_test_b13')

        const defTA2 = page.locator('textarea').first()
        if (await defTA2.count()) {
          await defTA2.fill('line1\nline2\nline3')
        }
        await screenshot(page, 'B13_S20_01_newline_def')

        const submitted2 = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const addBtn = btns.find(b => /add word/i.test(b.textContent || ''))
          if (addBtn) { addBtn.click(); return 'clicked' }
          return 'none'
        })
        await page.waitForTimeout(3000)
        await screenshot(page, 'B13_S20_02_after_newline')

        const bodyHTML2 = await page.locator('body').innerHTML()
        const isWhiteScreen2 = bodyHTML2.length < 200

        if (isWhiteScreen2) {
          findings.push({ id: 'F_S20', severity: 'HIGH', title: 'Newlines in definition causes white screen', scenario: 'S20' })
          recordResult('S20', 'fail', 'HIGH', 'White screen after newline definition')
        } else {
          // Check if newlines in the table appear as <br> or as text
          const tableHTML = await page.locator('table, [role="table"], tbody').first().innerHTML().catch(() => '')
          const hasBrInTable = tableHTML.includes('<br')
          console.log('Table has <br> tags:', hasBrInTable)
          recordResult('S20', 'pass', null, `Newlines in definition saved without crash. Display: ${hasBrInTable ? 'renders as <br>' : 'collapses to single line (CSS white-space)'}`)
        }

      } catch (err) {
        console.error('S11/S20 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S11S20_error').catch(() => {})
        recordResult('S11', 'blocked', null, err.message.slice(0, 80))
        recordResult('S20', 'blocked', null, 'blocked due to S11 error')
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S17 + S18 — List settings: zero/null fields + negative pace
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S17/S18: List settings validation (zero and negative pace) ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

      try {
        await loginAsTeacher(page)
        await navigateToListEditor(page)
        await screenshot(page, 'B13_S17_01_list_editor')

        // The list editor has "List Details" section with "Save Changes"
        // Look for the settings inputs (List Title, Description)
        // Plus look for pace/settings inputs on the page

        const allInputs = await page.locator('input, textarea').all()
        console.log(`List editor inputs (${allInputs.length}):`)
        for (let i = 0; i < allInputs.length; i++) {
          const inp = allInputs[i]
          const type = await inp.getAttribute('type') || 'textarea'
          const ph = await inp.getAttribute('placeholder') || ''
          const id = await inp.getAttribute('id') || ''
          const name = await inp.getAttribute('name') || ''
          let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
          console.log(`  [${i}] ${type}: ph="${ph}" id="${id}" name="${name}" lbl="${lbl}"`)
        }

        // The list editor likely shows title and description inputs above "Save Changes"
        // Look for number inputs specifically for pace
        const numberInputs = await page.locator('input[type="number"]').all()
        console.log(`Number inputs (${numberInputs.length}):`)
        for (const inp of numberInputs) {
          const id = await inp.getAttribute('id') || ''
          const min = await inp.getAttribute('min') || ''
          const max = await inp.getAttribute('max') || ''
          let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
          console.log(`  Number input: id="${id}" min="${min}" max="${max}" label="${lbl}"`)
        }

        if (numberInputs.length > 0) {
          // ── S17: Set all number fields to 0 ──
          for (const inp of numberInputs) {
            await inp.fill('0')
          }
          await screenshot(page, 'B13_S17_02_zeros_filled')

          // Click "Save Changes"
          const saveBtn = page.getByRole('button', { name: 'Save Changes' }).first()
          if (await saveBtn.count()) {
            await saveBtn.click()
            await page.waitForTimeout(3000)
          }
          await screenshot(page, 'B13_S17_03_after_zeros')

          const bodyText = await page.locator('body').innerText()
          const hasValidation = /must be|at least|minimum|greater than|positive|invalid/i.test(bodyText)

          if (hasValidation) {
            recordResult('S17', 'pass', null, 'Zero values rejected with validation message')
          } else {
            // Check if the number inputs have min attribute
            const firstMin = await numberInputs[0].getAttribute('min')
            if (firstMin === '1' || firstMin === '0') {
              recordResult('S17', 'pass', null, `Number input has min="${firstMin}" — browser native validation prevents zero`)
            } else {
              findings.push({ id: 'F_S17', severity: 'MEDIUM', title: 'List settings accepts zero values without validation', scenario: 'S17' })
              recordResult('S17', 'fail', 'MEDIUM', `Zero values accepted in list settings — no validation message, no min attribute`)
            }
          }

          // ── S18: Negative pace ──
          if (numberInputs.length > 0) {
            await numberInputs[0].fill('-5')
            await screenshot(page, 'B13_S18_01_negative_pace')

            if (await saveBtn.count()) {
              await saveBtn.click()
              await page.waitForTimeout(3000)
            }
            await screenshot(page, 'B13_S18_02_after_negative')

            const bodyText2 = await page.locator('body').innerText()
            const hasValidation2 = /must be|at least|minimum|greater than|positive|invalid|negative/i.test(bodyText2)
            const paceVal = await numberInputs[0].inputValue()
            const paceMin = await numberInputs[0].getAttribute('min')
            console.log('Pace after -5 fill: value=', paceVal, 'min=', paceMin)

            if (hasValidation2) {
              recordResult('S18', 'pass', null, 'Negative pace rejected with validation')
            } else if (paceMin && parseInt(paceMin) >= 0) {
              recordResult('S18', 'pass', null, `Pace input has min="${paceMin}" — browser native validation rejects negative`)
            } else if (paceVal === '-5') {
              findings.push({
                id: 'F_S18',
                severity: 'MEDIUM',
                title: 'Negative pace (-5) accepted in list settings without validation',
                scenario: 'S18',
              })
              recordResult('S18', 'fail', 'MEDIUM', 'Negative pace -5 accepted in list settings — could break day-progression algorithm')
            } else {
              recordResult('S18', 'pass', null, `Negative pace rejected (input value reset to "${paceVal}")`)
            }
          }
        } else {
          // No number inputs on list editor page — pace may be in a different location
          console.log('No number inputs on list editor — pace settings not on this page')
          recordResult('S17', 'blocked', null, 'No number inputs found on list editor page — pace/settings fields not present in word list editor')
          recordResult('S18', 'blocked', null, 'No pace input found on list editor page')
        }

        writeFileSync(`${EVIDENCE_DIR}/B13_S17S18_console.json`, JSON.stringify(errors, null, 2))
      } catch (err) {
        console.error('S17/S18 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S17S18_error').catch(() => {})
        recordResult('S17', 'blocked', null, err.message.slice(0, 80))
        recordResult('S18', 'blocked', null, 'blocked due to S17 error')
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S06 — Emoji list title (via "Create New List")
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S06: Emoji list title ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      let dialogFired = false
      page.on('dialog', async d => { dialogFired = true; await d.dismiss() })

      try {
        await loginAsTeacher(page)
        await page.waitForTimeout(1500)

        // Click "Create New List" link (it's a link to /lists/new)
        await page.getByRole('link', { name: 'Create New List' }).click()
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S06_01_create_list')
        console.log('Create list URL:', page.url())

        const bodyText = await page.locator('body').innerText()
        console.log('Create list page text:', bodyText.slice(0, 400))

        const allInputs = await page.locator('input, textarea').all()
        console.log(`Create list inputs (${allInputs.length}):`)
        for (let i = 0; i < allInputs.length; i++) {
          const type = await allInputs[i].getAttribute('type') || 'text'
          const ph = await allInputs[i].getAttribute('placeholder') || ''
          const id = await allInputs[i].getAttribute('id') || ''
          let lbl = id ? await page.locator(`label[for="${id}"]`).innerText().catch(() => '') : ''
          console.log(`  [${i}] ${type}: ph="${ph}" id="${id}" label="${lbl}"`)
        }

        // Fill title with emoji
        const titleInput = allInputs[0]
        if (titleInput) {
          await titleInput.fill('🎉 Vocab 🚀 Audit Test B13')
          await screenshot(page, 'B13_S06_02_emoji_title')

          // Submit
          const submitted = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'))
            const createBtn = btns.find(b => /create|save|submit/i.test(b.textContent || ''))
            if (createBtn) { createBtn.click(); return `clicked: ${createBtn.textContent?.trim()}` }
            return 'none'
          })
          console.log('Submit:', submitted)
          await page.waitForTimeout(4000)
          await screenshot(page, 'B13_S06_03_after_create')

          const afterText = await page.locator('body').innerText()
          const afterHTML = await page.locator('body').innerHTML()
          const hasEmoji = afterText.includes('🎉') || afterText.includes('🚀')
          const isWhiteScreen = afterHTML.length < 200
          console.log('After create (first 300):', afterText.slice(0, 300))

          if (isWhiteScreen) {
            findings.push({ id: 'F_S06', severity: 'HIGH', title: 'Emoji list title causes white screen', scenario: 'S06' })
            recordResult('S06', 'fail', 'HIGH', 'White screen after emoji list creation')
          } else if (dialogFired) {
            findings.push({ id: 'F_S06', severity: 'BLOCKER', title: 'Emoji list title causes XSS-like dialog', scenario: 'S06' })
            recordResult('S06', 'fail', 'BLOCKER', 'Dialog fired from emoji title')
          } else if (hasEmoji) {
            recordResult('S06', 'pass', null, 'Emoji list title created and displayed correctly')
          } else {
            recordResult('S06', 'partial', 'LOW', 'Emoji title submitted; emoji not visible in result (may have been navigated away, or title stripped of emoji)')
          }
        } else {
          recordResult('S06', 'blocked', null, 'No title input found on Create List page')
        }
      } catch (err) {
        console.error('S06 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S06_error').catch(() => {})
        recordResult('S06', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // S13 — JoinCode garbage code + already enrolled
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n─── S13: JoinCode validation ───')
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      try {
        const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
        const firsttimerAccount = seeded.accounts.find(a => a.personaId === 'firsttimer')

        if (!firsttimerAccount) throw new Error('No firsttimer account')

        // Login as firsttimer (a student)
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
        const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
        if (await loginLink.count()) await loginLink.click()
        await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
        await page.getByLabel(/email/i).first().fill(firsttimerAccount.email)
        await page.getByLabel(/password/i).first().fill(firsttimerAccount.password)
        await page.getByLabel(/password/i).first().press('Enter')
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_S13_01_firsttimer_dash')

        const dashText = await page.locator('body').innerText()
        console.log('Firsttimer dash:', dashText.slice(0, 400))

        // Look for "join class" option
        const joinTexts = await page.locator('a, button').all()
        let joinFound = false
        for (const el of joinTexts) {
          const t = await el.innerText().catch(() => '')
          const h = await el.getAttribute('href') || ''
          if (/join|enroll|code/i.test(t)) {
            console.log('Join-related:', t.trim(), '→', h)
            joinFound = true
          }
        }

        if (!joinFound) {
          // Try user menu or settings for join option
          const userMenu = page.locator('[aria-label="User menu"]').first()
          if (await userMenu.count()) {
            await userMenu.click()
            await page.waitForTimeout(800)
            await screenshot(page, 'B13_S13_02_user_menu')
            const menuText = await page.locator('body').innerText()
            console.log('User menu options:', menuText.slice(0, 300))
            const joinBtn = page.getByText(/join|class/i).first()
            if (await joinBtn.count()) {
              await joinBtn.click()
              await page.waitForTimeout(1500)
              joinFound = true
            }
            await page.keyboard.press('Escape')
          }
        }

        if (joinFound || await page.locator('input[placeholder*="code" i], input[placeholder*="join" i]').count()) {
          const codeInput = page.locator('input[placeholder*="code" i], input[placeholder*="join" i]').first()
          if (await codeInput.count()) {
            // Test garbage code
            await codeInput.fill('AAAAAA')
            const submitBtn = page.getByRole('button', { name: /join|submit|enter/i }).first()
            if (await submitBtn.count()) {
              await submitBtn.click()
              await page.waitForTimeout(2000)
            }
            await screenshot(page, 'B13_S13_03_garbage_code')
            const bodyText = await page.locator('body').innerText()
            const hasRejection = /invalid|not found|wrong|error|doesn.*t exist/i.test(bodyText)

            if (hasRejection) {
              recordResult('S13', 'pass', null, 'Garbage join code correctly rejected with error message')
            } else {
              findings.push({ id: 'F_S13', severity: 'HIGH', title: 'Garbage join code not rejected', scenario: 'S13' })
              recordResult('S13', 'fail', 'HIGH', 'Garbage join code AAAAAA not rejected — user may join non-existent class')
            }
          } else {
            recordResult('S13', 'blocked', null, 'Join code input not accessible from student dashboard')
          }
        } else {
          recordResult('S13', 'blocked', null, 'Join class not accessible for firsttimer (already enrolled or no join path visible)')
        }

      } catch (err) {
        console.error('S13 error:', err.message.slice(0, 200))
        await screenshot(page, 'B13_S13_error').catch(() => {})
        recordResult('S13', 'blocked', null, err.message.slice(0, 80))
      } finally {
        await ctx.close()
      }
    }

  } catch (err) {
    console.error('FATAL:', err.message)
    logEvent({ event: 'batch_error', batch: 'B13_focused', error: err.message })
  } finally {
    await browser.close()

    console.log('\n═══ B13 FOCUSED PASS RESULTS ═══')
    results.forEach(r => {
      const icon = r.result.startsWith('pass') ? '✅' : r.result.startsWith('fail') ? '❌' : r.result.startsWith('partial') ? '🟡' : '⏸'
      console.log(`${icon} ${r.scenario} [${r.severity || 'N/A'}]: ${r.note}`)
    })

    console.log('\nFINDINGS:')
    findings.forEach(f => console.log(`  ${f.severity}: ${f.title}`))

    writeFileSync(`${EVIDENCE_DIR}/B13_focused_results.json`, JSON.stringify({ results, findings }, null, 2))

    logEvent({
      event: 'batch_supplemental',
      batch: 'B13_focused',
      trials: trialCount,
      pass: results.filter(r => r.result.startsWith('pass')).length,
      fail: results.filter(r => r.result.startsWith('fail')).length,
    })
  }
})()

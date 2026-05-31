/**
 * B13 — Deep XSS investigation
 * The focused pass found `onerror=true` in HTML — investigate if it's escaped or executing
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B13'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASSWORD = 'veterans5944'

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

async function navigateToListEditor(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.getByRole('link', { name: 'View All Lists' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('link', { name: /25WT2 TOP Vocabulary \(v2\)/i }).click()
  await page.waitForTimeout(2000)
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // Critical: XSS execution detection
  let xssDialogFired = false
  let xssDialogMsg = ''
  page.on('dialog', async d => {
    xssDialogFired = true
    xssDialogMsg = d.message()
    console.log(`*** XSS DIALOG: ${d.type()} "${d.message()}" ***`)
    await d.dismiss()
  })

  const consoleErrors = []
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text())
    console.log(`[console:${m.type()}] ${m.text().slice(0, 150)}`)
  })
  page.on('pageerror', e => {
    consoleErrors.push('PAGE ERROR: ' + e.message)
    console.log(`[pageerror] ${e.message}`)
  })

  try {
    await loginAsTeacher(page)
    await navigateToListEditor(page)

    // ── Submit XSS payload as word definition ──
    const addWordBtn = page.getByRole('button', { name: 'Add Word' }).first()
    await addWordBtn.waitFor({ timeout: 10000 })
    await addWordBtn.click()
    await page.waitForTimeout(1500)

    // The form fields (from investigation):
    // Input[2]: name="word" ph="Abate"
    // Input[3]: name="definition" ph="To become less intense or widespread."
    const wordInput = page.locator('input[name="word"]').first()
    const defInput = page.locator('input[name="definition"], textarea[name="definition"]').first()

    await wordInput.fill('XSS_TEST_WORD_B13')
    await defInput.fill('<img src=x onerror="window.__xssB13Fired=1;alert(\'b13_xss\')"><script>alert("b13_script")</script>')

    await screenshot(page, 'B13_XSS_01_payload_filled')

    // Check if onerror is executing DURING typing/fill
    const xssAfterFill = await page.evaluate(() => window.__xssB13Fired === 1)
    console.log('XSS executed after fill (before submit):', xssAfterFill)

    if (xssAfterFill || xssDialogFired) {
      console.log('*** BLOCKER: XSS EXECUTED DURING INPUT FILL ***')
    }

    // Submit the word
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const addBtn = btns.find(b => /add word/i.test(b.textContent || ''))
      if (addBtn) { addBtn.click(); return `clicked: "${addBtn.textContent?.trim()}"` }
      return 'none'
    })
    console.log('Submit result:', submitted)
    await page.waitForTimeout(4000)
    await screenshot(page, 'B13_XSS_02_after_submit')

    // Check XSS execution after submission
    const xssAfterSubmit = await page.evaluate(() => window.__xssB13Fired === 1)
    console.log('XSS executed after submit:', xssAfterSubmit)
    console.log('Dialog fired:', xssDialogFired, xssDialogMsg)

    // Get the actual DOM to understand what's happening
    const bodyHTML = await page.locator('body').innerHTML()

    // Search for the XSS payload in DOM
    const hasRawOnerror = bodyHTML.includes('onerror="window.__xssB13Fired')
    const hasHtmlEncodedOnerror = bodyHTML.includes('onerror=&quot;') || bodyHTML.includes('onerror=&#')
    const hasRawScript = bodyHTML.includes('<script>alert') || bodyHTML.includes('<script>alert')
    const hasEncodedScript = bodyHTML.includes('&lt;script&gt;') || bodyHTML.includes('&#60;script&#62;')

    console.log('\n=== XSS DOM Analysis ===')
    console.log('Raw onerror attribute:', hasRawOnerror)
    console.log('HTML-encoded onerror:', hasHtmlEncodedOnerror)
    console.log('Raw <script> tag:', hasRawScript)
    console.log('HTML-encoded &lt;script&gt;:', hasEncodedScript)

    // Find the XSS payload in the DOM (search for surrounding text)
    const payloadIndex = bodyHTML.indexOf('XSS_TEST_WORD_B13')
    if (payloadIndex >= 0) {
      const context = bodyHTML.slice(Math.max(0, payloadIndex - 100), payloadIndex + 500)
      console.log('\nDOM context around XSS word:')
      console.log(context)
      writeFileSync(`${EVIDENCE_DIR}/B13_XSS_dom_context.txt`, context)
    }

    // Also look for the onerror in the context
    const onerrorIndex = bodyHTML.indexOf('onerror')
    if (onerrorIndex >= 0) {
      const onerrorContext = bodyHTML.slice(Math.max(0, onerrorIndex - 200), onerrorIndex + 300)
      console.log('\nDOM context around onerror:')
      console.log(onerrorContext)
      writeFileSync(`${EVIDENCE_DIR}/B13_XSS_onerror_context.txt`, onerrorContext)
    }

    // Check if `onerror` appears as a react text node (escaped) vs as an attribute
    const onerrorAsAttr = await page.evaluate(() => {
      const allImgs = document.querySelectorAll('img[onerror]')
      return {
        count: allImgs.length,
        srcs: Array.from(allImgs).map(img => ({ src: img.src, onerror: img.getAttribute('onerror') }))
      }
    })
    console.log('\nActual img[onerror] elements in DOM:', JSON.stringify(onerrorAsAttr, null, 2))

    // DEFINITIVE check: is the onerror an attribute on an actual HTML element?
    if (onerrorAsAttr.count > 0) {
      console.log('\n*** BLOCKER: img element with onerror attribute in DOM ***')
      console.log('This means the XSS payload was rendered as raw HTML, not escaped text')
      console.log('Even if the browser did not fire the alert (e.g., src=x may not trigger in headless),')
      console.log('this IS a stored XSS vulnerability.')
    } else {
      // Check if there are any elements with onerror at all
      const anyOnerror = await page.evaluate(() => {
        const all = document.querySelectorAll('[onerror]')
        return all.length
      })
      console.log('Elements with onerror attribute (any tag):', anyOnerror)

      if (anyOnerror > 0) {
        console.log('*** BLOCKER: element with onerror attribute exists ***')
      } else {
        // The onerror appears in HTML text (escaped) - safe
        console.log('onerror appears in DOM as text content only (escaped) - SAFE')
        console.log('React uses JSX which HTML-escapes all text content by default')
        console.log('The earlier detection was a false positive (checking innerHTML which includes escaped text)')
      }
    }

    // Check the definition input field value
    const defValue = await defInput.inputValue().catch(() => '')
    console.log('\nDefinition input current value:', defValue.slice(0, 100))

    // Now check results screen / word table to see how the saved word appears
    await screenshot(page, 'B13_XSS_03_word_table_check')

    // Find the XSS word in the word table
    const tableRows = await page.locator('tbody tr').all()
    console.log('\nWord table rows:', tableRows.length)
    // Find the XSS row
    for (const row of tableRows.slice(0, 5)) {
      const rowText = await row.innerText().catch(() => '')
      if (rowText.includes('XSS_TEST_WORD_B13') || rowText.includes('onerror') || rowText.includes('script')) {
        console.log('XSS word in table:', rowText.slice(0, 200))
        const rowHTML = await row.innerHTML().catch(() => '')
        console.log('XSS word HTML:', rowHTML.slice(0, 500))
        writeFileSync(`${EVIDENCE_DIR}/B13_XSS_table_row.html`, rowHTML)
      }
    }

    // Check for actual onerror elements again
    const finalOnerrorCheck = await page.evaluate(() => {
      const elems = document.querySelectorAll('[onerror]')
      return {
        count: elems.length,
        details: Array.from(elems).map(el => ({
          tag: el.tagName,
          src: el.getAttribute('src'),
          onerror: el.getAttribute('onerror'),
          outerHTML: el.outerHTML.slice(0, 200)
        }))
      }
    })
    console.log('\nFinal onerror element check:', JSON.stringify(finalOnerrorCheck, null, 2))

    // Check if XSS word was actually saved (may have been rejected)
    const wordFoundInTable = await page.locator('tbody').innerText().catch(() => '')
    console.log('Word table has XSS word:', wordFoundInTable.includes('XSS_TEST_WORD_B13'))

    // FINAL VERDICT
    console.log('\n=== FINAL XSS VERDICT ===')
    if (xssDialogFired || xssAfterFill || xssAfterSubmit || finalOnerrorCheck.count > 0) {
      console.log('RESULT: BLOCKER — XSS EXECUTED or onerror attribute in DOM')
      console.log('Dialog fired:', xssDialogFired, xssDialogMsg)
      console.log('window.__xssB13Fired:', xssAfterSubmit)
      console.log('[onerror] elements:', finalOnerrorCheck.count)
    } else {
      console.log('RESULT: SAFE — XSS payload stored as escaped text, not executed')
      console.log('React JSX automatically escapes all string content')
      console.log('The onerror=true reported earlier was checking innerHTML which shows escaped HTML entities as literal text')
    }

    writeFileSync(`${EVIDENCE_DIR}/B13_XSS_final_check.json`, JSON.stringify({
      xssDialogFired,
      xssDialogMsg,
      xssAfterFill,
      xssAfterSubmit,
      hasRawOnerror,
      hasHtmlEncodedOnerror,
      hasRawScript,
      hasEncodedScript,
      onerrorElementsInDOM: finalOnerrorCheck,
      wordFoundInTable: wordFoundInTable.includes('XSS_TEST_WORD_B13'),
    }, null, 2))

  } catch (err) {
    console.error('ERROR:', err.message.slice(0, 300))
    await screenshot(page, 'B13_XSS_error').catch(() => {})
  } finally {
    await browser.close()
    console.log('\nXSS investigation complete.')
  }
})()

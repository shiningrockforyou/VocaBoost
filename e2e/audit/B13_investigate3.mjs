/**
 * B13 Investigation 3 — focused exploration of specific UI flows
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

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // Track all dialogs
  let dialogs = []
  page.on('dialog', async d => {
    dialogs.push({ type: d.type(), message: d.message() })
    console.log(`DIALOG: ${d.type()} — "${d.message()}"`)
    await d.dismiss()
  })

  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message))

  try {
    await loginAsTeacher(page)
    await page.waitForTimeout(2000)

    // ── 1. Navigate to Lists via "View All Lists" link ──
    const viewAllLink = page.getByRole('link', { name: 'View All Lists' }).first()
    await viewAllLink.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'B13_inv3_01_all_lists')
    console.log('All lists URL:', page.url())
    const listsText = await page.locator('body').innerText()
    console.log('Lists page text:\n', listsText.slice(0, 600))

    const listsBtns = await page.locator('button').all()
    console.log(`Lists page buttons (${listsBtns.length}):`)
    for (const b of listsBtns) {
      const t = await b.innerText().catch(() => '')
      if (t.trim()) console.log(`  - "${t.trim()}"`)
    }
    const listsLinks = await page.locator('a').all()
    console.log(`Lists page links:`)
    for (const l of listsLinks) {
      const t = await l.innerText().catch(() => '')
      const h = await l.getAttribute('href') || ''
      if (t.trim()) console.log(`  - "${t.trim()}" → ${h}`)
    }

    // ── 2. Click on TOP list (v2) ──
    const topListLink = page.getByRole('link', { name: /25WT2 TOP Vocabulary \(v2\)/i }).first()
    if (await topListLink.count()) {
      await topListLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv3_02_top_list_detail')
      console.log('\nTop list detail URL:', page.url())
      console.log('Top list detail text:\n', (await page.locator('body').innerText()).slice(0, 800))

      const tlBtns = await page.locator('button').all()
      console.log(`\nTop list buttons (${tlBtns.length}):`)
      for (const b of tlBtns) {
        const t = await b.innerText().catch(() => '')
        const ariaLabel = await b.getAttribute('aria-label') || ''
        const title = await b.getAttribute('title') || ''
        if (t.trim() || ariaLabel || title) {
          console.log(`  - "${t.trim()}" | aria="${ariaLabel}" | title="${title}"`)
        }
      }

      // Try each button to find word editor / settings
      const btnCount = await page.locator('button').count()
      for (let i = 0; i < btnCount; i++) {
        const btn = page.locator('button').nth(i)
        const t = await btn.innerText().catch(() => '')
        const al = await btn.getAttribute('aria-label') || ''
        const title = await btn.getAttribute('title') || ''
        const label = t.trim() || al || title
        if (!label) continue

        const currentURL = page.url()
        try {
          await btn.scrollIntoViewIfNeeded()
          await btn.click({ timeout: 5000, force: true })
          await page.waitForTimeout(1500)
          const newURL = page.url()
          const inputCount = await page.locator('input, textarea').count()
          const dialogCount = await page.locator('[role="dialog"]').count()

          if (inputCount > 0 || dialogCount > 0 || newURL !== currentURL) {
            console.log(`\n→ Btn "${label}" OPENED SOMETHING: URL=${newURL}, inputs=${inputCount}, dialogs=${dialogCount}`)
            await screenshot(page, `B13_inv3_03_btn_${i}_${label.slice(0,15).replace(/\s+/g,'_')}`)

            for (let j = 0; j < inputCount; j++) {
              const inp = page.locator('input, textarea').nth(j)
              const ph = await inp.getAttribute('placeholder') || ''
              const nm = await inp.getAttribute('name') || ''
              const id = await inp.getAttribute('id') || ''
              const type = await inp.getAttribute('type') || 'text'
              let lbl = ''
              if (id) {
                lbl = await page.locator(`label[for="${id}"]`).innerText().catch(() => '')
              }
              console.log(`  Input[${j}]: type=${type} ph="${ph}" name="${nm}" id="${id}" label="${lbl}"`)
            }

            // Check if settings form visible — try to find pace/name fields
            const formText = await page.locator('[role="dialog"], form, .modal').first().innerText().catch(() => '')
            if (formText) console.log('Form text:', formText.slice(0, 300))

            // Close dialog
            await page.keyboard.press('Escape')
            await page.waitForTimeout(500)
          }
        } catch (e) {
          // skip timeout
        }
      }
    }

    // ── 3. Navigate via "Create New Class" ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500)
    await screenshot(page, 'B13_inv3_04_teacher_home_again')

    // Click "Create New Class" button
    const createClassBtn = page.getByRole('button', { name: /create new class/i }).first()
    if (await createClassBtn.count()) {
      await createClassBtn.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv3_05_create_class')
      console.log('\nCreate class URL:', page.url())
      const ccText = await page.locator('body').innerText()
      console.log('Create class text:\n', ccText.slice(0, 800))

      const ccInputs = await page.locator('input, textarea').all()
      console.log(`\nCreate class inputs (${ccInputs.length}):`)
      for (const inp of ccInputs) {
        const ph = await inp.getAttribute('placeholder') || ''
        const id = await inp.getAttribute('id') || ''
        const nm = await inp.getAttribute('name') || ''
        const type = await inp.getAttribute('type') || 'text'
        let lbl = ''
        if (id) lbl = await page.locator(`label[for="${id}"]`).innerText().catch(() => '')
        console.log(`  Input: type=${type} ph="${ph}" name="${nm}" id="${id}" label="${lbl}"`)
      }

      // Test S05: 500-char name
      const nameInput = page.getByLabel(/class name|name/i).first()
        .or(page.locator('input[type="text"]').first())
      if (await nameInput.count()) {
        const longName = 'A'.repeat(500)
        await nameInput.fill(longName)
        await screenshot(page, 'B13_inv3_05b_500char_name')

        // Find the actual submit button that is clickable (not behind overlay)
        const allBtns = await page.locator('button').all()
        console.log('\nCreate class buttons:')
        for (const b of allBtns) {
          const t = await b.innerText().catch(() => '')
          if (t.trim()) console.log(`  - "${t.trim()}"`)
        }

        // Get the form and submit it directly
        const submitResult = await page.evaluate(() => {
          const form = document.querySelector('form')
          if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
            form.dispatchEvent(submitEvent)
            return 'form submitted'
          }
          // Try clicking submit button via JS
          const btns = Array.from(document.querySelectorAll('button[type="submit"], button'))
          const submitBtn = btns.find(b => /create|save|submit/i.test(b.textContent || ''))
          if (submitBtn) {
            submitBtn.click()
            return 'button clicked'
          }
          return 'nothing found'
        })
        console.log('Submit result:', submitResult)
        await page.waitForTimeout(3000)
        await screenshot(page, 'B13_inv3_05c_after_500char_submit')

        const bodyText = await page.locator('body').innerText()
        console.log('After 500-char name submit:', bodyText.slice(0, 400))
      }

      // Close
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    // ── 4. Test class with empty name ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500)

    const createClassBtn2 = page.getByRole('button', { name: /create new class/i }).first()
    if (await createClassBtn2.count()) {
      await createClassBtn2.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv3_06_create_class_empty')

      // Submit without filling name
      const submitResult2 = await page.evaluate(() => {
        const form = document.querySelector('form')
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
          const prevented = !form.dispatchEvent(submitEvent)
          return `form submitted (prevented=${prevented})`
        }
        return 'no form'
      })
      console.log('Empty class name submit result:', submitResult2)
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv3_06b_after_empty_submit')
      console.log('After empty name submit:', (await page.locator('body').innerText()).slice(0, 400))

      await page.keyboard.press('Escape')
    }

    // ── 5. Check hostile student's test session path ──
    const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
    const hostile = seeded.accounts.find(a => a.personaId === 'hostile' && a.targetClass === 'TOP')

    // Sign out via user menu
    const userMenu = page.locator('[aria-label="User menu"]').first()
    if (await userMenu.count()) {
      await userMenu.click()
      await page.waitForTimeout(800)
      await screenshot(page, 'B13_inv3_07_user_menu')
      const signOutBtn = page.getByText(/sign out|log out/i).first()
      if (await signOutBtn.count()) {
        await signOutBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500)

    // Login as hostile student
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count()) await loginLink.click()
    else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
    await page.getByLabel(/email/i).first().fill(hostile.email)
    await page.getByLabel(/password/i).first().fill(hostile.password)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshot(page, 'B13_inv3_08_hostile_dash')
    console.log('\nHostile dashboard:', (await page.locator('body').innerText()).slice(0, 600))

    // Look for the class list card and click it
    const classCards = await page.locator('a').all()
    for (const l of classCards) {
      const t = await l.innerText().catch(() => '')
      const h = await l.getAttribute('href') || ''
      if (t.trim() || h) console.log(`  Link: "${t.trim().slice(0,50)}" → ${h}`)
    }

    // Try to navigate to session via class card
    const classLink = page.getByRole('link', { name: /25WT2 TOP|vocab/i }).first()
    if (await classLink.count()) {
      await classLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv3_09_after_class_click')
      console.log('\nAfter class click URL:', page.url())
      console.log('Content:', (await page.locator('body').innerText()).slice(0, 400))

      // Check for test session UI
      const inputs = await page.locator('input[type="text"]').count()
      console.log('Input[text] fields:', inputs)

      // Look for Skip to Test in session menu
      const skipToTest = page.getByText(/skip to test/i).first()
      const hasSkip = await skipToTest.count()
      console.log('Skip to Test button:', hasSkip)

      if (hasSkip) {
        await skipToTest.click()
        await page.waitForTimeout(2000)
        await screenshot(page, 'B13_inv3_10_after_skip')
        console.log('After skip URL:', page.url())
        const inputs2 = await page.locator('input[type="text"]').count()
        console.log('Inputs after skip:', inputs2)
      }
    }

    // Now check buttons on wherever we are
    const finalBtns = await page.locator('button').all()
    console.log(`\nFinal page buttons (${finalBtns.length}):`)
    for (const b of finalBtns) {
      const t = await b.innerText().catch(() => '')
      if (t.trim()) console.log(`  - "${t.trim()}"`)
    }

    await screenshot(page, 'B13_inv3_11_final')

    // Console errors summary
    console.log('\nConsole errors collected:')
    errors.forEach(e => console.log('  ERR:', e.slice(0, 200)))

  } catch (err) {
    console.error('ERROR:', err.message)
    await screenshot(page, 'B13_inv3_exception').catch(() => {})
  } finally {
    await browser.close()
    console.log('\nInvestigation 3 done.')
  }
})()

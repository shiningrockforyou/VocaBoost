/**
 * B13 Investigation 2 — explore teacher word editor + list settings via in-app navigation only
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
  console.log(`Screenshot: ${path}`)
  return path
}

async function loginAsTeacher(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
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
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
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

  try {
    await loginAsTeacher(page)
    await page.waitForTimeout(2000)
    await screenshot(page, 'B13_inv2_01_teacher_home')

    // ── Navigate to Lists via in-app nav ──
    const listsLink = page.getByRole('link', { name: /^lists$/i }).first()
      .or(page.getByRole('link', { name: /view all lists/i }).first())
      .or(page.getByText(/^Lists$/).first())

    if (await listsLink.count()) {
      console.log('Clicking Lists nav...')
      await listsLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_02_lists_page')
      console.log('Lists URL:', page.url())

      const listText = await page.locator('body').innerText()
      console.log('Lists page text:', listText.slice(0, 500))

      const listBtns = await page.locator('button').all()
      console.log(`\nButtons on Lists page (${listBtns.length}):`)
      for (const b of listBtns) {
        const t = await b.innerText().catch(() => '')
        if (t.trim()) console.log(`  - "${t.trim()}"`)
      }
    }

    // ── Click on the TOP list ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    const topListLink = page.getByRole('link', { name: /25WT2 TOP Vocabulary \(v2\)/i }).first()
    if (await topListLink.count()) {
      await topListLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_03_top_list_via_nav')
      console.log('Top list URL (via nav):', page.url())

      const listText = await page.locator('body').innerText()
      console.log('List detail text:', listText.slice(0, 800))

      const btns = await page.locator('button').all()
      console.log(`\nList detail buttons (${btns.length}):`)
      for (const b of btns) {
        const t = await b.innerText().catch(() => '')
        const cls = await b.getAttribute('class') || ''
        if (t.trim()) console.log(`  - "${t.trim()}"`)
      }

      // Try every button
      const btnCount = await page.locator('button').count()
      console.log('\nExploring each button:')
      for (let i = 0; i < btnCount; i++) {
        const btn = page.locator('button').nth(i)
        const t = await btn.innerText().catch(() => '')
        if (!t.trim()) continue

        const currentURL = page.url()
        try {
          await btn.click({ timeout: 3000 })
          await page.waitForTimeout(1500)
          const newURL = page.url()
          const inputs = await page.locator('input, textarea').count()
          const dialogs = await page.locator('[role="dialog"], .modal, [class*="modal"]').count()
          if (inputs > 0 || dialogs > 0 || newURL !== currentURL) {
            console.log(`  Btn "${t.trim()}" → URL: ${newURL}, inputs: ${inputs}, dialogs: ${dialogs}`)
            await screenshot(page, `B13_inv2_04_btn_${i}_${t.trim().slice(0,20).replace(/\s+/g,'_')}`)
            // Describe inputs
            for (let j = 0; j < inputs; j++) {
              const inp = page.locator('input, textarea').nth(j)
              const ph = await inp.getAttribute('placeholder') || ''
              const nm = await inp.getAttribute('name') || ''
              const lbl = await inp.getAttribute('aria-label') || ''
              const type = await inp.getAttribute('type') || 'text'
              console.log(`    Input[${j}]: type=${type} placeholder="${ph}" name="${nm}" aria-label="${lbl}"`)
            }
            // Close if dialog
            const closeBtn = page.getByRole('button', { name: /close|cancel|×|✕/i }).first()
            if (await closeBtn.count()) {
              await closeBtn.click()
              await page.waitForTimeout(500)
            } else {
              // Press Escape
              await page.keyboard.press('Escape')
              await page.waitForTimeout(500)
            }
          } else {
            console.log(`  Btn "${t.trim()}" → no change`)
          }
        } catch (e) {
          console.log(`  Btn "${t.trim()}" → ERROR: ${e.message.split('\n')[0]}`)
        }
      }
    }

    // ── Navigate to a class (to find class settings/name editor) ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)

    const classLink = page.getByRole('link', { name: /25WT 2차 TOP OFFLINE/i }).first()
    if (await classLink.count()) {
      await classLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_05_class_detail')
      console.log('\nClass detail URL:', page.url())
      console.log('Class detail text:', (await page.locator('body').innerText()).slice(0, 500))

      const btns = await page.locator('button').all()
      console.log(`\nClass detail buttons (${btns.length}):`)
      for (const b of btns) {
        const t = await b.innerText().catch(() => '')
        if (t.trim()) console.log(`  - "${t.trim()}"`)
      }
    }

    // ── Navigate to "Create New Class" ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    const createClassBtn = page.getByText('Create New Class').first()
    if (await createClassBtn.count()) {
      await createClassBtn.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_06_create_class')
      console.log('\nCreate class URL:', page.url())
      const ccText = await page.locator('body').innerText()
      console.log('Create class text:', ccText.slice(0, 500))

      const inputs = await page.locator('input, textarea').all()
      console.log(`\nCreate class inputs (${inputs.length}):`)
      for (const inp of inputs) {
        const ph = await inp.getAttribute('placeholder') || ''
        const nm = await inp.getAttribute('name') || ''
        const lbl = await inp.getAttribute('aria-label') || ''
        const type = await inp.getAttribute('type') || 'text'
        const labelEl = await page.locator(`label[for="${await inp.getAttribute('id') || 'x'}"]`).first()
        const labelText = await labelEl.innerText().catch(() => '')
        console.log(`  Input: type=${type} placeholder="${ph}" name="${nm}" aria-label="${lbl}" label="${labelText}"`)
      }

      const btns = await page.locator('button').all()
      console.log(`\nCreate class buttons (${btns.length}):`)
      for (const b of btns) {
        const t = await b.innerText().catch(() => '')
        if (t.trim()) console.log(`  - "${t.trim()}"`)
      }
    }

    // ── Explore "Create New List" ──
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    const createListLink = page.getByRole('link', { name: 'Create New List' }).first()
      .or(page.getByText('Create New List').first())
    if (await createListLink.count()) {
      await createListLink.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_07_create_list')
      console.log('\nCreate list URL:', page.url())
      const clText = await page.locator('body').innerText()
      console.log('Create list text:', clText.slice(0, 500))

      const inputs = await page.locator('input, textarea').all()
      console.log(`\nCreate list inputs (${inputs.length}):`)
      for (const inp of inputs) {
        const ph = await inp.getAttribute('placeholder') || ''
        const nm = await inp.getAttribute('name') || ''
        const type = await inp.getAttribute('type') || 'text'
        const id = await inp.getAttribute('id') || ''
        let labelText = ''
        if (id) {
          const lEl = await page.locator(`label[for="${id}"]`).first()
          labelText = await lEl.innerText().catch(() => '')
        }
        console.log(`  Input: type=${type} placeholder="${ph}" name="${nm}" id="${id}" label="${labelText}"`)
      }
    }

    // ── Check student hostile account ──
    const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
    const hostile = seeded.accounts.find(a => a.personaId === 'hostile' && a.targetClass === 'TOP')

    // Sign out
    await page.evaluate(async () => {
      try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js')
        const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
        const auth = getAuth()
        await signOut(auth)
      } catch(e) { console.error('signout error:', e.message) }
    })
    await page.context().clearCookies()
    await page.context().clearPermissions()

    // Navigate to root — if still logged in as teacher, look for signout
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    await screenshot(page, 'B13_inv2_08_after_signout_attempt')

    // Try user menu
    const userMenu = page.getByRole('button', { name: /user menu|avatar|profile/i })
      .or(page.locator('[aria-label="User menu"]'))
    if (await userMenu.count()) {
      await userMenu.click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'B13_inv2_08b_user_menu')
      const signOutBtn = page.getByText(/sign out|log out/i).first()
      if (await signOutBtn.count()) {
        await signOutBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    await screenshot(page, 'B13_inv2_09_after_full_signout')
    await page.waitForTimeout(1000)

    // Login as hostile student
    const loginLink3 = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink3.count()) {
      await loginLink3.click()
    } else {
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

    await screenshot(page, 'B13_inv2_10_hostile_dash')
    console.log('\nHostile student URL:', page.url())
    const hostileDash = await page.locator('body').innerText()
    console.log('Hostile dashboard:\n', hostileDash.slice(0, 800))

    // List all buttons
    const hostileBtns = await page.locator('button').all()
    console.log(`\nHostile buttons (${hostileBtns.length}):`)
    for (const b of hostileBtns) {
      const t = await b.innerText().catch(() => '')
      if (t.trim()) console.log(`  - "${t.trim()}"`)
    }

    // List all links
    const hostileLinks = await page.locator('a').all()
    console.log(`\nHostile links (${hostileLinks.length}):`)
    for (const l of hostileLinks) {
      const t = await l.innerText().catch(() => '')
      const h = await l.getAttribute('href') || ''
      if (t.trim()) console.log(`  - "${t.trim()}" → ${h}`)
    }

    // Try clicking list card / start session
    const studyBtn = page.getByText(/start|study|test today|begin/i).first()
    if (await studyBtn.count()) {
      await studyBtn.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_11_hostile_session_attempt')
      console.log('After study click URL:', page.url())
      const sessText = await page.locator('body').innerText()
      console.log('Session text:', sessText.slice(0, 500))

      // Look for inputs
      const sessInputs = await page.locator('input, textarea').all()
      console.log(`Session inputs: ${sessInputs.length}`)

      // Look for session menu / skip to test button
      const sessionMenu = page.getByText(/session|menu|skip/i)
      const smCount = await sessionMenu.count()
      console.log(`Session menu items: ${smCount}`)
    }

    // Try clicking the class/list card directly
    const classCard = page.getByRole('link', { name: /25WT2 TOP/i }).first()
    if (await classCard.count()) {
      await classCard.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'B13_inv2_12_class_card_click')
      console.log('After class card click URL:', page.url())
      const cardText = await page.locator('body').innerText()
      console.log('After class card click:', cardText.slice(0, 500))
    }

  } catch (err) {
    console.error('Investigation error:', err.message)
    await screenshot(page, 'B13_inv2_error').catch(() => {})
  } finally {
    await browser.close()
    console.log('\nInvestigation 2 complete.')
  }
})()

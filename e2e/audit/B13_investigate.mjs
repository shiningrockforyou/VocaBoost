/**
 * B13 Investigation — explore teacher UI structure to find word editor, list settings, etc.
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
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
    await screenshot(page, 'B13_inv_01_teacher_home')

    const dashText = await page.locator('body').innerText()
    console.log('Teacher dashboard text:\n', dashText.slice(0, 800))
    console.log('\nTeacher dashboard URL:', page.url())

    // List all buttons
    const buttons = await page.locator('button').all()
    console.log('\nAll buttons on teacher dashboard:')
    for (const btn of buttons) {
      const text = await btn.innerText().catch(() => '')
      const role = await btn.getAttribute('aria-label') || ''
      console.log(`  - "${text.trim()}" | aria-label: "${role}"`)
    }

    // List all links
    const links = await page.locator('a').all()
    console.log('\nAll links on teacher dashboard:')
    for (const link of links) {
      const text = await link.innerText().catch(() => '')
      const href = await link.getAttribute('href') || ''
      if (text.trim() || href) console.log(`  - "${text.trim()}" → ${href}`)
    }

    await screenshot(page, 'B13_inv_02_teacher_nav')

    // Try navigating to various paths
    const pathsToTry = [
      '/lists',
      '/classes',
      '/teacher',
      '/teacher/lists',
      '/teacher/classes',
      '/gradebook',
      '/admin',
      '/dashboard',
    ]

    for (const path of pathsToTry) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const text = await page.locator('body').innerText()
      const url = page.url()
      console.log(`\n${path} → ${url}`)
      console.log('  Content:', text.slice(0, 200))

      const btns = await page.locator('button').all()
      console.log(`  Buttons (${btns.length}):`)
      for (const b of btns.slice(0, 10)) {
        const t = await b.innerText().catch(() => '')
        if (t.trim()) console.log(`    - "${t.trim()}"`)
      }
    }

    // Navigate to TOP list detail
    const TOP_LIST_ID = '8RMews2H7C3UJUAsOBzR'
    await page.goto(`${BASE_URL}/lists/${TOP_LIST_ID}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshot(page, 'B13_inv_03_list_detail')

    const listUrl = page.url()
    console.log('\nList detail URL:', listUrl)
    const listText = await page.locator('body').innerText()
    console.log('List detail text:', listText.slice(0, 500))

    const listBtns = await page.locator('button').all()
    console.log(`\nList detail buttons (${listBtns.length}):`)
    for (const b of listBtns) {
      const t = await b.innerText().catch(() => '')
      const cls = await b.getAttribute('class') || ''
      if (t.trim()) console.log(`  - "${t.trim()}"`)
    }

    // Check if teacher was redirected (maybe not a teacher in terms of Firestore role)
    // Try clicking each button one by one to find edit
    for (let i = 0; i < Math.min(listBtns.length, 10); i++) {
      const t = await listBtns[i].innerText().catch(() => '')
      console.log(`Clicking button ${i}: "${t.trim()}"`)
      try {
        await listBtns[i].click({ timeout: 3000 })
        await page.waitForTimeout(1000)
        const afterText = await page.locator('body').innerText()
        const afterUrl = page.url()
        if (afterUrl !== listUrl || afterText.length !== listText.length) {
          console.log('  → State changed! URL:', afterUrl)
          console.log('  → New content:', afterText.slice(0, 200))
          await screenshot(page, `B13_inv_04_after_btn${i}`)
        }
        // If dialog/modal opened
        const inputs = await page.locator('input, textarea').all()
        if (inputs.length > 0) {
          console.log(`  → Found ${inputs.length} inputs!`)
          for (const inp of inputs) {
            const label = await inp.getAttribute('placeholder') || await inp.getAttribute('name') || await inp.getAttribute('id') || ''
            const type = await inp.getAttribute('type') || 'text'
            console.log(`    Input: type="${type}" placeholder/name="${label}"`)
          }
          await screenshot(page, `B13_inv_04b_inputs_btn${i}`)
          // Close dialog if open
          const closeBtn = page.getByRole('button', { name: /close|cancel|×/i }).first()
          if (await closeBtn.count()) await closeBtn.click()
          await page.waitForTimeout(500)
        }
      } catch (e) {
        // skip
      }
    }

    // Check teacher's class/list management from teacher dashboard home
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000)
    await screenshot(page, 'B13_inv_05_teacher_final_dash')

    // Look for the "Classes" or "Lists" section specifically
    const navItems = await page.locator('nav a, [role="navigation"] a').all()
    console.log('\nNav items:')
    for (const item of navItems) {
      const text = await item.innerText().catch(() => '')
      const href = await item.getAttribute('href') || ''
      if (text.trim()) console.log(`  - "${text.trim()}" → ${href}`)
    }

    // Try sidebar or header navigation
    const headerLinks = await page.locator('header a, header button').all()
    console.log('\nHeader items:')
    for (const item of headerLinks) {
      const text = await item.innerText().catch(() => '')
      if (text.trim()) console.log(`  - "${text.trim()}"`)
    }

    // What does the full body HTML look like structurally?
    const structureHTML = await page.evaluate(() => {
      const nav = document.querySelector('nav')
      const aside = document.querySelector('aside')
      const main = document.querySelector('main')
      return {
        navHTML: nav ? nav.outerHTML.slice(0, 1000) : 'none',
        asideHTML: aside ? aside.outerHTML.slice(0, 1000) : 'none',
        mainHTML: main ? main.outerHTML.slice(0, 500) : 'none',
      }
    })
    console.log('\nNav HTML:', structureHTML.navHTML.slice(0, 500))
    console.log('\nAside HTML:', structureHTML.asideHTML.slice(0, 500))

    // Try the student hostile account to see what test session looks like
    const seeded = JSON.parse(require('fs').readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
    const hostile = seeded.accounts.find(a => a.personaId === 'hostile' && a.targetClass === 'TOP')
    console.log('\nHostile account:', hostile?.email)

    // Sign out and login as student
    await page.evaluate(async () => {
      try {
        // Try Firebase signOut
        const { getAuth, signOut } = await import('firebase/auth')
        const auth = getAuth()
        await signOut(auth)
      } catch(e) {}
    })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1000)

    const loginLink2 = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink2.count()) {
      await loginLink2.click()
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
    }

    await page.getByLabel(/email/i).first().waitFor({ timeout: 10000 })
    await page.getByLabel(/email/i).first().fill(hostile.email)
    await page.getByLabel(/password/i).first().fill(hostile.password)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)

    await screenshot(page, 'B13_inv_06_hostile_dash')
    const hostileDash = await page.locator('body').innerText()
    console.log('\nHostile student dashboard:\n', hostileDash.slice(0, 600))

    // What buttons are available?
    const hostileBtns = await page.locator('button').all()
    console.log('\nHostile student buttons:')
    for (const b of hostileBtns) {
      const t = await b.innerText().catch(() => '')
      if (t.trim()) console.log(`  - "${t.trim()}"`)
    }

    // Look for "Start Test", "Skip to Test", etc.
    const allLinks2 = await page.locator('a').all()
    console.log('\nHostile student links:')
    for (const l of allLinks2) {
      const t = await l.innerText().catch(() => '')
      const h = await l.getAttribute('href') || ''
      if (t.trim()) console.log(`  - "${t.trim()}" → ${h}`)
    }

    // Try clicking any visible card or button
    const clickable = page.getByText(/test|start|study|session|today|continue/i)
    const cCount = await clickable.count()
    console.log('\nClickable test-related:', cCount)
    for (let i = 0; i < Math.min(cCount, 5); i++) {
      const t = await clickable.nth(i).innerText().catch(() => '')
      console.log(`  - "${t.trim()}"`)
    }

  } catch (err) {
    console.error('Investigation error:', err.message)
  } finally {
    await browser.close()
    console.log('\nInvestigation complete.')
  }
})()

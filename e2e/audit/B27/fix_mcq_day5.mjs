/**
 * Fix: Complete the pending Day 5 MCQ review test for anxious/TOP
 * Uses direct DOM evaluation to find and click MCQ option buttons
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_anxious_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

// Word lookup from cache
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const BY_TEXT = {}
for (const w of WORD_CACHE) {
  const norm = w.word.split('\n')[0].trim().toLowerCase()
  BY_TEXT[norm] = w
}
function lu(text) {
  if (!text) return null
  const n = text.split('\n')[0].trim().toLowerCase()
  if (BY_TEXT[n]) return BY_TEXT[n]
  const s = n.replace(/\s*\(old english\)/i, '').trim()
  if (BY_TEXT[s]) return BY_TEXT[s]
  for (const [k, v] of Object.entries(BY_TEXT)) {
    if (k.startsWith(n) || n.startsWith(k)) return v
  }
  return null
}

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // Login via / then /login
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  if (!page.url().includes('/login')) {
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
  }

  // But /login gives 404 on Netlify — need client-side routing
  // Navigate to / first and find login link
  const url = page.url()
  if (url.includes('page not found') || url.includes('404')) {
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
  }

  // Check for login form
  let emailInput = page.getByLabel(/email/i).first()
  let emailVis = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)

  if (!emailVis) {
    // Look for login link to navigate to login
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink.click()
      await page.waitForTimeout(2000)
      emailInput = page.getByLabel(/email/i).first()
      emailVis = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
    }
  }

  if (!emailVis) {
    // Try clicking / navigating to login
    await page.evaluate(() => {
      window.location.href = '/login'
    })
    await page.waitForTimeout(3000)
    emailInput = page.getByLabel(/email/i).first()
    emailVis = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
  }

  console.log('Email input visible:', emailVis)

  if (emailVis) {
    await emailInput.fill(EMAIL)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForTimeout(5000)
    console.log('After login URL:', page.url())
  }

  // Navigate to home/dashboard
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  console.log('Dashboard URL:', page.url())

  const dashBody = await page.locator('body').textContent().catch(() => '')
  console.log('Dashboard snippet:', dashBody.substring(0, 400))

  // Start session
  const startBtns = page.getByRole('button', { name: /^Start Session$/i })
  const cnt = await startBtns.count()
  console.log('Start Session button count:', cnt)

  if (cnt === 0) {
    // Maybe already in a session
    console.log('No Start Session button')
  } else {
    await startBtns.first().click()
    await page.waitForTimeout(3000)
  }

  // Check for modal
  const afterBody = await page.locator('body').textContent().catch(() => '')
  console.log('After start body:', afterBody.substring(0, 400))

  // Dismiss modal
  for (let i = 0; i < 5; i++) {
    const modal = page.locator('.fixed.inset-0.z-50, [class*="backdrop"], [class*="overlay"]').first()
    const mv = await modal.isVisible({ timeout: 1000 }).catch(() => false)
    if (!mv) break
    console.log(`Modal visible, attempt ${i+1}`)

    const startStudying = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startStudying.click({ force: true })
      await page.waitForTimeout(1000)
      continue
    }

    const allBtnsInModal = await page.locator('.fixed.inset-0 button, [class*="z-50"] button').all()
    if (allBtnsInModal.length > 0) {
      for (const btn of allBtnsInModal) {
        const txt = await btn.textContent().catch(() => '')
        console.log('Modal button:', txt?.trim().substring(0, 50))
        if (/start|ok|close|continue|dismiss|got it|begin/i.test(txt)) {
          await btn.click({ force: true })
          await page.waitForTimeout(1000)
          break
        }
      }
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  // Skip to Test
  const sessionMenu = page.locator('[aria-label="Session menu"]').first()
  const smv = await sessionMenu.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('Session menu visible:', smv)

  if (smv) {
    await sessionMenu.click()
    await page.waitForTimeout(500)
    const skip = page.getByText('Skip to Test').first()
    if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skip.click()
      await page.waitForTimeout(1000)
      const confirm = page.getByRole('button', { name: /start test/i }).first()
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirm.click()
        await page.waitForTimeout(3000)
      }
    }
  }

  // Now check what's on the page
  const testBody = await page.locator('body').textContent().catch(() => '')
  console.log('\nTest page body:', testBody.substring(0, 600))

  // Check for typed input
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const typedCount = await typedInputs.count()
  console.log('Typed inputs:', typedCount)

  // Check for MCQ
  const hasReview = testBody.includes('Review Test')
  console.log('Has Review Test:', hasReview)

  // List all buttons
  const allBtns = await page.locator('button').all()
  console.log('\nAll buttons:')
  for (const btn of allBtns) {
    const txt = await btn.textContent().catch(() => '')
    const cls = await btn.getAttribute('class').catch(() => '')
    const lbl = await btn.getAttribute('aria-label').catch(() => '')
    const disabled = await btn.isDisabled().catch(() => false)
    console.log(`  [dis=${disabled}] "${txt?.trim().substring(0, 80)}" lbl="${lbl}" cls="${cls?.substring(0, 40)}"`)
  }

  // Take screenshot
  await page.screenshot({ path: '/app/audit/playwright/findings/evidence/B27/anxious/mcq_debug_v2.png', fullPage: true })
  console.log('Screenshot saved.')

  if (hasReview) {
    // Attempt to complete MCQ test using evaluate for direct DOM interaction
    console.log('\nAttempting MCQ completion via evaluate...')
    const result = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms))
      const log = []
      let answered = 0

      for (let q = 0; q < 50; q++) {
        await sleep(300)

        // Check if test done
        const body = document.body.textContent || ''
        if (!body.includes('Review Test')) break

        // Get submit button
        const submitBtn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent?.trim().toLowerCase().includes('submit test'))
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click()
          log.push({ type: 'submitted', q })
          await sleep(5000)
          break
        }

        // Find option buttons: buttons with substantial text that aren't nav buttons
        const allBtns = Array.from(document.querySelectorAll('button'))
        const navPat = /^(submit test|next|skip|session menu|start studying|play audio|sign out|log out)$/i
        const optBtns = allBtns.filter(b => {
          const txt = b.textContent?.trim() || ''
          return txt.length >= 8 && txt.length <= 300 && !navPat.test(txt) && !b.disabled
        })

        log.push({ type: 'q', q, optCount: optBtns.length, body: body.substring(0, 100) })

        if (optBtns.length === 0) {
          // Maybe all answered, try submit
          if (submitBtn) {
            submitBtn.click()
            log.push({ type: 'fallback_submit', q })
            await sleep(5000)
            break
          }
          await sleep(500)
          continue
        }

        // Click first option (or the one with correct definition if we knew it)
        optBtns[0].click()
        log.push({ type: 'clicked', text: optBtns[0].textContent?.trim().substring(0, 40) })
        answered++
        await sleep(200)

        // Look for Next button
        const nextBtn = Array.from(document.querySelectorAll('button'))
          .find(b => /^next$/i.test(b.textContent?.trim()))
        if (nextBtn) {
          nextBtn.click()
          await sleep(200)
        }
      }

      return { answered, log: log.slice(-10) }
    })

    console.log('MCQ result:', JSON.stringify(result, null, 2))
    await page.waitForTimeout(3000)

    const finalBody = await page.locator('body').textContent().catch(() => '')
    console.log('Final body:', finalBody.substring(0, 300))
    const scoreMatch = finalBody.match(/(\d+)%/)
    console.log('Score:', scoreMatch ? scoreMatch[1] + '%' : 'not found')
  }

} finally {
  await browser.close()
  console.log('Done.')
}

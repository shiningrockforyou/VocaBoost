/**
 * B14F Retest v5 — FIX-12: FRQ textarea scroll-into-view
 * Handles the two-step FRQ choice (select card + Confirm button)
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14F_retest')
const TEST_ID = 'test_micro_full_1'
const EMAIL = 'student9@apboost.test'
const PASSWORD = 'Student123!'

const log = (msg) => console.log(`[${new Date().toISOString().replace('T',' ').substring(0,19)}] ${msg}`)

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) })
  log(`  Screenshot: ${name}.png`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const results = { fix12_frqScroll: {} }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const page = await context.newPage()

  try {
    // Login
    await page.goto(`${BASE_URL}/ap/login`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    let ef = await page.$('input[type="email"]')
    if (!ef) { await page.goto(`${BASE_URL}/login`); await sleep(2000); ef = await page.$('input[type="email"]') }
    await ef.fill(EMAIL)
    await (await page.$('input[type="password"]')).fill(PASSWORD)
    await page.keyboard.press('Enter')
    await sleep(2500)
    log(`URL: ${page.url()}`)

    // Navigate to test
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`, { waitUntil: 'domcontentloaded' })
    await sleep(4000)
    await screenshot(page, 'v5_01_initial')

    const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 200))
    log(`Body: ${bodyText}`)

    // Resume/begin if instruction screen
    if (bodyText.includes('Begin Test') || bodyText.includes('Resume Test')) {
      const rb = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")')
      if (rb) { await rb.click(); await sleep(2500) }
    }

    // Navigate to FRQ
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => {
        const body = document.body.textContent || ''
        return {
          isChoiceScreen: body.includes('Type Your Answers') && body.includes('Write by Hand'),
          hasTextarea: !!document.querySelector('textarea'),
          hasBtnNext: !!document.querySelector('button:is([class*="Next"])') ||
                      Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Next →'),
          hasBtnReview: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Review →'),
          isReview: body.includes('Review Your Answers'),
          hasConfirmBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim().includes('Confirm')),
        }
      })

      if (s.hasTextarea) { log(`Textarea at iter ${i}`); break }

      if (s.isChoiceScreen) {
        log(`Choice screen at iter ${i}`)
        // Click Type Your Answers card
        const typeCard = await page.$('button:has-text("Type Your Answers")')
        if (typeCard) {
          await typeCard.click()
          await sleep(600)
          // Check for confirm button
          const confirmBtn = await page.$('button:has-text("Confirm")')
          if (confirmBtn) {
            log('  Clicking Confirm & Continue')
            await confirmBtn.click()
            await sleep(2000)
          }
        }
        continue
      }

      if (s.isReview) {
        const sb = await page.$('button:has-text("Submit")')
        if (sb) { await sb.click(); await sleep(2000) }
        continue
      }

      // Answer A
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
        for (const btn of buttons) {
          for (const span of btn.querySelectorAll('span')) {
            if (span.textContent?.trim() === 'A' &&
                (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
              btn.click(); return
            }
          }
        }
      })
      await sleep(200)

      if (s.hasBtnNext) {
        const nb = await page.$('button:has-text("Next →")')
        if (nb) { await nb.click(); await sleep(350) }
      } else if (s.hasBtnReview) {
        const rb = await page.$('button:has-text("Review →")')
        if (rb) { await rb.click(); await sleep(700) }
      }
    }

    await sleep(1000)
    await screenshot(page, 'v5_02_after_choice')

    // Now check for textarea
    const ta = await page.$('textarea')
    if (!ta) {
      log('Still no textarea. Checking page...')
      const body2 = await page.evaluate(() => ({
        text: document.body.textContent?.substring(0, 300),
        url: window.location.href
      }))
      log(`Page state: ${JSON.stringify(body2)}`)
      results.fix12_frqScroll.error = 'No textarea found after FRQ choice'
    } else {
      log('Textarea found! Running scroll test...')
      await screenshot(page, 'v5_03_frq_with_ta')

      // Measure at 667
      const at667 = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        const rect = ta.getBoundingClientRect()
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight }
      })
      results.fix12_frqScroll.at667 = at667
      log(`At 667: ${JSON.stringify(at667)}`)

      // Switch to 350 height (keyboard simulation)
      await page.setViewportSize({ width: 375, height: 350 })
      await sleep(600)
      await screenshot(page, 'v5_04_350_before')

      const before = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        const rect = ta.getBoundingClientRect()
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
      })
      results.fix12_frqScroll.before350 = before
      log(`At 350 BEFORE focus: ${JSON.stringify(before)}`)

      // Focus to trigger scrollIntoView
      const taEl = await page.$('textarea')
      await taEl.click()
      await sleep(800)
      await screenshot(page, 'v5_05_350_after')

      const after = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        const rect = ta.getBoundingClientRect()
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
      })
      results.fix12_frqScroll.after350 = after
      log(`At 350 AFTER focus: ${JSON.stringify(after)}`)

      results.fix12_frqScroll.scrollWorked = after.inVP === true
      results.fix12_frqScroll.wasHidden = !before.inVP

      // Restore
      await page.setViewportSize({ width: 375, height: 667 })
    }

  } catch (e) {
    log(`Error: ${e.message}`)
    results.error = e.message
    await screenshot(page, 'v5_error').catch(() => {})
  } finally {
    await browser.close()
  }

  log('\n=== FIX-12 RESULT ===')
  const s = results.fix12_frqScroll
  if (s.error) {
    log(`SKIP: ${s.error}`)
  } else {
    log(`Was hidden at 350: ${s.wasHidden}`)
    log(`Scrolled into view: ${s.scrollWorked}`)
    log(`Before: top=${s.before350?.top}, inVP=${s.before350?.inVP}`)
    log(`After:  top=${s.after350?.top}, inVP=${s.after350?.inVP}`)
    log(`STATUS: ${s.scrollWorked ? 'PASS' : 'FAIL'}`)
  }

  fs.writeFileSync(
    path.join(__dirname, 'b14f_retest_v5_results.json'),
    JSON.stringify(results, null, 2)
  )
}

main().catch(e => { console.error(e); process.exit(1) })

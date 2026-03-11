/**
 * B14F Retest v4 — FIX-12 only: FRQ textarea scroll-into-view
 * Assumes MCQ already completed by student9 (from v3 run)
 * Student9 should have a session that just completed MCQ / at FRQ choice
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14F_retest')
const TEST_ID = 'test_micro_full_1'
const EMAIL = 'student9@apboost.test'
const PASSWORD = 'Student123!'

const log = (msg) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[${ts}] ${msg}`)
}

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: fp, fullPage: false })
  log(`  Screenshot: ${name}.png`)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const results = {
    fix12_frqScroll: {}
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const page = await context.newPage()

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().substring(0, 100))
  })

  try {
    // Login
    log('Login...')
    await page.goto(`${BASE_URL}/ap/login`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    let ef = await page.$('input[type="email"]')
    if (!ef) { await page.goto(`${BASE_URL}/login`); await sleep(2000); ef = await page.$('input[type="email"]') }
    const pf = await page.$('input[type="password"]')
    await ef.fill(EMAIL)
    await pf.fill(PASSWORD)
    await pf.press('Enter')
    await sleep(2500)
    log(`Logged in: ${page.url()}`)

    // Navigate to test
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`, { waitUntil: 'domcontentloaded' })
    await sleep(4000)

    // Take screenshot to see state
    await screenshot(page, 'v4_01_initial')

    const initialState = await page.evaluate(() => {
      const body = document.body.textContent || ''
      return {
        url: window.location.href,
        hasInstruction: body.includes('Begin Test') || body.includes('Resume Test'),
        hasTesting: body.includes('Question') && body.includes('of') && body.includes('Next'),
        isChoice: body.includes('Type Your Answers') || body.includes('Write by Hand'),
        hasTextarea: !!document.querySelector('textarea'),
        isError: body.includes('scheduleFlush') || body.includes('Something went wrong'),
        snippet: body.substring(0, 200)
      }
    })
    log(`Initial state: ${JSON.stringify(initialState)}`)

    // If we need to resume
    if (initialState.hasInstruction) {
      const rb = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")')
      if (rb) { await rb.click(); await sleep(3000) }
    }

    // Answer MCQ questions until FRQ choice appears
    log('Navigating to FRQ...')
    let gotToFRQ = false
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => {
        const body = document.body.textContent || ''
        return {
          isChoice: body.includes('Type Your Answers') || body.includes('Write by Hand'),
          hasTextarea: !!document.querySelector('textarea'),
          hasBtnNext: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Next →'),
          hasBtnReview: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Review →'),
          isReview: body.includes('Review Your Answers'),
          hasBtnSubmit: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim().includes('Submit')),
          isError: body.includes('scheduleFlush') || body.includes('Something went wrong'),
          questionNum: body.match(/Question (\d+) of/)?.[1] || 'unknown'
        }
      })

      if (s.isError) { log(`Error at iter ${i}`); break }

      if (s.hasTextarea) {
        log(`FRQ textarea found at iter ${i}!`)
        gotToFRQ = true
        break
      }

      if (s.isChoice) {
        log(`FRQ choice screen at iter ${i}, clicking Type Your Answers`)
        const tb = await page.$('button:has-text("Type Your Answers")')
        if (tb) {
          await tb.click()
          await sleep(2000) // Wait for FRQ questions to load
          // Now check for textarea
          const hasTa = await page.$('textarea')
          if (hasTa) {
            log('Got FRQ textarea after clicking Type!')
            gotToFRQ = true
          }
          break
        }
      }

      if (s.isReview) {
        log(`Review screen, submitting section`)
        const sb = await page.$('button:has-text("Submit")')
        if (sb) {
          await sb.click()
          await sleep(2000)
        }
        continue
      }

      // Answer A and go next
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
        if (rb) { await rb.click(); await sleep(800) }
      }
    }

    await screenshot(page, 'v4_02_frq_reached')
    log(`Got to FRQ: ${gotToFRQ}`)

    if (gotToFRQ) {
      // Wait for textarea to be ready
      await sleep(500)
      let ta = await page.$('textarea')
      if (!ta) {
        // Check once more
        await sleep(1000)
        ta = await page.$('textarea')
      }

      if (ta) {
        // Measure at 667
        const at667 = await page.evaluate(() => {
          const ta = document.querySelector('textarea')
          if (!ta) return null
          const rect = ta.getBoundingClientRect()
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight }
        })
        results.fix12_frqScroll.at667 = at667
        log(`FRQ at 667: top=${at667?.top}, inVP=${at667?.inVP}`)
        await screenshot(page, 'v4_03_frq_667')

        // Switch to 375x350
        await page.setViewportSize({ width: 375, height: 350 })
        await sleep(600)

        const before = await page.evaluate(() => {
          const ta = document.querySelector('textarea')
          if (!ta) return null
          const rect = ta.getBoundingClientRect()
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
        })
        results.fix12_frqScroll.before350Focus = before
        log(`FRQ at 350 BEFORE: top=${before?.top}, inVP=${before?.inVP}, needsScroll=${before?.needsScroll}`)
        await screenshot(page, 'v4_04_frq_350_before')

        // Focus the textarea (triggers scrollIntoView after 300ms delay)
        const taEl = await page.$('textarea')
        await taEl.click()
        await sleep(800) // 300ms delay + animation

        const after = await page.evaluate(() => {
          const ta = document.querySelector('textarea')
          if (!ta) return null
          const rect = ta.getBoundingClientRect()
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
        })
        results.fix12_frqScroll.after350Focus = after
        log(`FRQ at 350 AFTER: top=${after?.top}, inVP=${after?.inVP}, needsScroll=${after?.needsScroll}`)
        await screenshot(page, 'v4_05_frq_350_after')

        results.fix12_frqScroll.scrollIntoViewWorked = after?.inVP === true
        results.fix12_frqScroll.wasHiddenBefore = before?.inVP === false

        await page.setViewportSize({ width: 375, height: 667 })
      } else {
        log('No textarea even after clicking Type')
        results.fix12_frqScroll.error = 'Textarea not found after clicking Type Your Answers'
        await screenshot(page, 'v4_03_no_ta')
      }
    } else {
      results.fix12_frqScroll.error = 'Could not reach FRQ section'
    }

    results.consoleErrors = errors
    log(`Console errors: ${errors.length}`)

  } catch (err) {
    log(`Error: ${err.message}`)
    results.error = err.message
    await screenshot(page, 'v4_error').catch(() => {})
  } finally {
    await browser.close()
  }

  log('\n=== FIX-12 RESULT ===')
  log(`Scroll worked: ${results.fix12_frqScroll.scrollIntoViewWorked}`)
  log(`Was hidden before: ${results.fix12_frqScroll.wasHiddenBefore}`)
  log(`before350: top=${results.fix12_frqScroll.before350Focus?.top}, inVP=${results.fix12_frqScroll.before350Focus?.inVP}`)
  log(`after350: top=${results.fix12_frqScroll.after350Focus?.top}, inVP=${results.fix12_frqScroll.after350Focus?.inVP}`)

  const out = path.join(__dirname, 'b14f_retest_v4_results.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  log(`Written: ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })

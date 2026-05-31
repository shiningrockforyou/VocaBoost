/**
 * B20 — Modal overlay probe
 * Investigate what modal is intercepting pointer events in session
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

function getAccount(personaId, targetClass = null) {
  let c = SEEDED.accounts.filter(a => a.personaId === personaId)
  if (targetClass) c = c.filter(a => a.targetClass === targetClass)
  return c[0]
}

async function loginAs(page, personaId, targetClass = null) {
  const account = personaId === 'teacher'
    ? { email: 'veterans@vocaboost.com', password: 'veterans5944' }
    : getAccount(personaId, targetClass)
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) await loginLink.click()
  else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  }
  await page.waitForTimeout(1000)
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')
  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch (_) {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const EVIDENCE = '/app/audit/playwright/findings/evidence/B20'

  // Test 1: Check what the inset-0 z-50 overlay is in each context
  for (const [personaId, targetClass, label] of [
    ['phone', null, 'phone'],
    ['careful', 'TOP', 'careful_TOP'],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    })
    const page = await ctx.newPage()
    try {
      await loginAs(page, personaId, targetClass)
      await page.waitForTimeout(2000)

      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      // Inspect the overlay that's intercepting pointer events
      const overlayInfo = await page.evaluate(() => {
        const overlay = document.querySelector('.fixed.inset-0.z-50')
        if (!overlay) return null
        return {
          classes: overlay.className,
          text: overlay.innerText.slice(0, 500),
          childCount: overlay.children.length,
          firstChildClass: overlay.firstElementChild?.className || '',
          firstChildText: overlay.firstElementChild?.innerText?.slice(0, 200) || '',
          display: getComputedStyle(overlay).display,
          visibility: getComputedStyle(overlay).visibility,
          opacity: getComputedStyle(overlay).opacity,
          pointerEvents: getComputedStyle(overlay).pointerEvents,
        }
      })
      console.log(`\n=== ${label} session overlay ===`)
      console.log(JSON.stringify(overlayInfo, null, 2))

      // Take screenshot for evidence
      await page.screenshot({ path: `${EVIDENCE}/B20_modal_probe_${label}.png` })

      // Check if there's a real modal open
      const modalCheck = await page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"]')
        return Array.from(modals).map(m => ({
          open: m.getAttribute('aria-hidden') !== 'true',
          text: m.innerText.slice(0, 300),
          classes: m.className.slice(0, 100)
        }))
      })
      console.log(`Modals with role="dialog":`, JSON.stringify(modalCheck, null, 2))

      // Also look for z-50 elements
      const z50Info = await page.evaluate(() => {
        const z50Els = []
        document.querySelectorAll('*').forEach(el => {
          const z = getComputedStyle(el).zIndex
          if (parseInt(z) >= 50) {
            const rect = el.getBoundingClientRect()
            if (rect.width > 100 && rect.height > 100) {
              z50Els.push({
                tag: el.tagName,
                zIndex: z,
                classes: el.className.toString().slice(0, 100),
                text: el.innerText.slice(0, 100),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top)
              })
            }
          }
        })
        return z50Els.slice(0, 10)
      })
      console.log('High z-index elements:', JSON.stringify(z50Info, null, 2))

    } finally {
      await ctx.close()
    }
  }

  // Test 2: Check the student dashboard header overflow source more carefully
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)

      // Get the header structure
      const headerInfo = await page.evaluate(() => {
        const header = document.querySelector('header, nav, [class*="header" i], [class*="navbar" i]')
        if (!header) return 'no header found'
        return {
          tag: header.tagName,
          classes: header.className,
          width: Math.round(header.getBoundingClientRect().width),
          children: Array.from(header.children).map(c => ({
            tag: c.tagName,
            classes: c.className,
            width: Math.round(c.getBoundingClientRect().width),
            right: Math.round(c.getBoundingClientRect().right)
          }))
        }
      })
      console.log('\n=== Student dashboard header structure ===')
      console.log(JSON.stringify(headerInfo, null, 2))

      // Look at the flex container that overflows
      const flexOverflow = await page.evaluate(() => {
        const flexEls = document.querySelectorAll('.flex.items-center.gap-3')
        return Array.from(flexEls).slice(0, 3).map(el => ({
          classes: el.className,
          width: Math.round(el.getBoundingClientRect().width),
          right: Math.round(el.getBoundingClientRect().right),
          parentClasses: el.parentElement?.className?.slice(0, 100) || '',
          childCount: el.children.length,
          children: Array.from(el.children).map(c => ({
            tag: c.tagName,
            classes: c.className.slice(0, 60),
            width: Math.round(c.getBoundingClientRect().width)
          }))
        }))
      })
      console.log('\n=== Overflowing flex containers ===')
      console.log(JSON.stringify(flexOverflow, null, 2))

      await page.screenshot({ path: `${EVIDENCE}/B20_dashboard_mobile_header.png`, fullPage: true })

    } finally {
      await ctx.close()
    }
  }

  await browser.close()
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })

/**
 * B20 — Session menu mobile probe
 * Tests if "Skip to Test" is accessible via the Session menu button on mobile
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

  // Test Session menu at mobile viewport (S16 focused test)
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'phone')
      await page.waitForTimeout(2000)

      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      await page.screenshot({ path: `${EVIDENCE}/B20_S16_before_menu.png` })

      // Click the "Session menu" button
      const sessionMenuBtn = page.getByRole('button', { name: /session menu/i }).first()
      const menuVisible = await sessionMenuBtn.isVisible().catch(() => false)
      console.log('Session menu button visible:', menuVisible)

      if (menuVisible) {
        const box = await sessionMenuBtn.boundingBox()
        console.log('Session menu button size:', box)
        if (box.height < 44) {
          console.log('WARNING: Session menu button height', box.height, 'px < 44px tap target minimum')
        }

        await sessionMenuBtn.click()
        await page.waitForTimeout(1500)
        await page.screenshot({ path: `${EVIDENCE}/B20_S16_menu_open.png` })

        // Check what's in the menu
        const menuContent = await page.evaluate(() => {
          const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]')
          return Array.from(dialogs).map(d => ({
            role: d.getAttribute('role'),
            text: d.innerText.slice(0, 500),
            height: d.getBoundingClientRect().height,
            width: d.getBoundingClientRect().width,
            top: d.getBoundingClientRect().top,
            bottom: d.getBoundingClientRect().bottom,
          }))
        })
        console.log('Menu/dialog content:', JSON.stringify(menuContent, null, 2))

        // Check Skip to Test
        const skipBtn = page.getByText(/skip to test/i).first()
        const skipVisible = await skipBtn.isVisible().catch(() => false)
        console.log('Skip to Test visible in menu:', skipVisible)

        if (skipVisible) {
          const skipBox = await skipBtn.boundingBox()
          console.log('Skip to Test size:', skipBox)
          if (skipBox.height < 44) {
            console.log('WARNING: Skip to Test button height', skipBox.height, 'px < 44px')
          }
          await page.screenshot({ path: `${EVIDENCE}/B20_S16_skip_visible.png` })
        }

        // Check Step button (1 of 3) for progress sheet
        const stepBtn = page.getByRole('button', { name: /step \d+ of \d+/i }).first()
        if (await stepBtn.isVisible().catch(() => false)) {
          console.log('Step button found:', await stepBtn.innerText())
          const stepBox = await stepBtn.boundingBox()
          console.log('Step button size:', stepBox)
        }
      }

      // Also test the "Step 1 of 3" button for progress sheet access
      const stepBtn = page.getByRole('button', { name: /step \d+ of \d+/i }).first()
      if (await stepBtn.isVisible().catch(() => false)) {
        console.log('\nTesting Step button for progress sheet...')
        await stepBtn.click()
        await page.waitForTimeout(1500)
        await page.screenshot({ path: `${EVIDENCE}/B20_S16_step_clicked.png` })
        const sheetContent = await page.evaluate(() => {
          const sheets = document.querySelectorAll('[role="dialog"], [data-state="open"], [class*="Sheet"]')
          return Array.from(sheets).map(d => ({
            text: d.innerText.slice(0, 300),
            bottom: d.getBoundingClientRect().bottom,
            height: d.getBoundingClientRect().height
          }))
        })
        console.log('Sheet after step click:', JSON.stringify(sheetContent, null, 2))
      }

    } finally {
      await ctx.close()
    }
  }

  // Test button tap targets in session on mobile (focused)
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'phone')
      await page.waitForTimeout(2000)

      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      // Check ALL buttons for tap target compliance
      const btns = await page.$$('button')
      const smallBtns = []
      for (const btn of btns) {
        const text = await btn.innerText().catch(() => '')
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '')
        const box = await btn.boundingBox().catch(() => null)
        if (box && (box.height < 44 || box.width < 44)) {
          smallBtns.push({
            label: ariaLabel || text.slice(0, 40),
            height: Math.round(box.height),
            width: Math.round(box.width),
            y: Math.round(box.y)
          })
        }
      }
      console.log('\n\nSmall tap targets on mobile (< 44px) in session:')
      smallBtns.forEach(b => console.log(`  [${b.label}] ${b.width}x${b.height}px @y=${b.y}`))

    } finally {
      await ctx.close()
    }
  }

  await browser.close()
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })

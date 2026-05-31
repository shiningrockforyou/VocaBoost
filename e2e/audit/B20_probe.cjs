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

async function measureOverflow(page, label) {
  const info = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth
    const clientWidth = document.documentElement.clientWidth
    // Find offending elements
    const overflowing = []
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.right > clientWidth + 5) {
        overflowing.push({
          tag: el.tagName,
          class: el.className?.toString?.()?.slice(0, 80) || '',
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          id: el.id || ''
        })
      }
    })
    return {
      docScrollWidth: docWidth,
      clientWidth,
      hasOverflow: docWidth > clientWidth,
      overflowing: overflowing.slice(0, 10)
    }
  })
  console.log(`\n--- ${label} ---`)
  console.log(`  scrollWidth=${info.docScrollWidth} clientWidth=${info.clientWidth} overflow=${info.hasOverflow}`)
  if (info.overflowing.length > 0) {
    console.log('  Overflowing elements:')
    info.overflowing.forEach(el => {
      console.log(`    <${el.tag}${el.id ? '#'+el.id : ''} class="${el.class}"> right=${el.right}px width=${el.width}px`)
    })
  }
  return info
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const findings = {}

  // ─── Test student dashboard on mobile ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)
      findings.dashboard_mobile = await measureOverflow(page, 'Dashboard (mobile 375x812)')

      // Look at the session if we can get to it
      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
        findings.session_mobile = await measureOverflow(page, 'Session (mobile 375x812)')
        await page.screenshot({ path: '/app/audit/playwright/findings/evidence/B20/B20_probe_session_mobile.png' })
      }
    } finally {
      await ctx.close()
    }
  }

  // ─── Test teacher dashboard on mobile ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)
      findings.teacher_dashboard_mobile = await measureOverflow(page, 'Teacher Dashboard (mobile 375x812)')

      // Navigate to list editor
      const listsLink = page.getByRole('link', { name: /list|vocabulary|단어/i }).first()
      if (await listsLink.isVisible().catch(() => false)) {
        await listsLink.click()
        await page.waitForTimeout(2000)
        findings.list_editor_mobile = await measureOverflow(page, 'List Editor (mobile 375x812)')
      }
    } finally {
      await ctx.close()
    }
  }

  // ─── Test gradebook on mobile ─────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)
      const gbLink = page.getByRole('link', { name: /gradebook|grade|성적/i }).first()
      if (await gbLink.isVisible().catch(() => false)) {
        await gbLink.click()
        await page.waitForTimeout(2000)
        findings.gradebook_mobile = await measureOverflow(page, 'Gradebook (mobile 375x812)')
      }
    } finally {
      await ctx.close()
    }
  }

  // ─── Test class roster on mobile ──────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)
      const rosterLink = page.getByRole('link', { name: /class|roster|student/i }).first()
      if (await rosterLink.isVisible().catch(() => false)) {
        await rosterLink.click()
        await page.waitForTimeout(2000)
        findings.roster_mobile = await measureOverflow(page, 'Class Roster (mobile 375x812)')
      }
    } finally {
      await ctx.close()
    }
  }

  // ─── Check session progress sheet on mobile ────────────────────────────────
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
        findings.phone_session = await measureOverflow(page, 'Phone Session (375x812)')
        await page.screenshot({ path: '/app/audit/playwright/findings/evidence/B20/B20_probe_phone_session.png' })

        // Look for session menu / progress sheet trigger
        // Inspect all buttons on the page
        const btns = await page.$$('button')
        const btnInfo = []
        for (const btn of btns) {
          const text = await btn.innerText().catch(() => '')
          const ariaLabel = await btn.getAttribute('aria-label').catch(() => '')
          const box = await btn.boundingBox().catch(() => null)
          if (box) {
            btnInfo.push({ text: text.slice(0, 40), ariaLabel, height: Math.round(box.height), width: Math.round(box.width), y: Math.round(box.y) })
          }
        }
        console.log('\nPhone session buttons:')
        btnInfo.forEach(b => console.log(`  [${b.ariaLabel || b.text}] ${b.width}x${b.height} @y=${b.y}`))

        // Try clicking the progress indicator (often a "N/M" or progress bar)
        const progressBtns = btnInfo.filter(b => /\d+\/\d+|\d+%|progress/i.test(b.text + b.ariaLabel))
        console.log('Progress buttons found:', progressBtns)
      }
    } finally {
      await ctx.close()
    }
  }

  fs.writeFileSync('/app/audit/playwright/findings/evidence/B20/B20_probe_findings.json', JSON.stringify(findings, null, 2))
  console.log('\nProbe complete. Results written to B20_probe_findings.json')
  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })

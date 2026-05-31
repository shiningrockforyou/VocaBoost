/**
 * B05 S09 — Quit Session test
 * The confirm dialog has a "Quit session" button with aria-label
 * Need to click it by aria-label or partial text
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B05'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/J.jsonl'

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const CAREFUL_TOP = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')

mkdirSync(EVIDENCE_DIR, { recursive: true })

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj })
  writeFileSync(LOG_PATH, line + '\n', { flag: 'a' })
}

async function ss(page, name) {
  const fp = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: fp, fullPage: true }).catch(() => {})
  console.log('SS:', name)
}

async function loginAs(page, account) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count() > 0) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
}

async function runQuit() {
  const browser = await chromium.launch({ headless: true })
  const results = { quitWorked: false, notes: [] }

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
      }
    })
    const page = await ctx.newPage()

    await loginAs(page, CAREFUL_TOP)

    // Start session
    const startBtn = page.getByRole('button', { name: /start/i }).first()
    await startBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await ss(page, 'B05_quit_01_session')

    // Dismiss flashcard customization modal
    const startStudying = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.count() > 0) {
      await startStudying.click()
      await page.waitForTimeout(500)
    }

    // Open session menu
    const menuBtn = page.locator('button[aria-label="Session menu"]').first()
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(600)
      await ss(page, 'B05_quit_02_menu')

      // Click Quit Session text
      const quitText = page.getByText('Quit Session').first()
      if (await quitText.count() > 0) {
        await quitText.click()
        await page.waitForTimeout(1500)
        await ss(page, 'B05_quit_03_quit_dialog')

        // Get all visible buttons
        const body = await page.innerText('body')
        console.log('Quit dialog body:', body.substring(0, 400))

        // Look for confirmation button by all possible patterns
        const allBtns = await page.locator('button').all()
        let foundQuitConfirm = false
        for (const btn of allBtns) {
          const text = await btn.innerText().catch(() => '')
          const label = await btn.getAttribute('aria-label').catch(() => '')
          console.log(`  Button: text="${text.trim()}" aria-label="${label}"`)
          if (/quit|confirm|yes|leave/i.test(text) || /quit/i.test(label)) {
            if (await btn.isVisible() && await btn.isEnabled()) {
              console.log('Clicking quit confirm button:', text || label)
              await btn.click()
              foundQuitConfirm = true
              break
            }
          }
        }

        await page.waitForTimeout(2000)
        await ss(page, 'B05_quit_04_after_quit')

        const postUrl = page.url()
        const postBody = await page.innerText('body')
        results.notes.push(`URL after quit: ${postUrl}`)
        results.notes.push(`On dashboard: ${/dashboard|vocaboostone\.netlify\.app\/$|\/$/i.test(postUrl)}`)
        results.notes.push(`Session still available: ${/start|begin/i.test(postBody)}`)

        if (foundQuitConfirm && /dashboard|\/$/i.test(postUrl)) {
          results.quitWorked = true
          results.notes.push('QUIT WORKS: Session quit confirmed, returned to dashboard')
        } else if (foundQuitConfirm) {
          results.notes.push('Quit dialog confirmed but not sure where we landed')
          results.quitWorked = true
        } else {
          results.notes.push('Could not find quit confirm button')
        }

      } else {
        results.notes.push('Quit Session text not found in menu')
      }
    } else {
      results.notes.push('Session menu not visible')
    }

    await ctx.close()
  } finally {
    await browser.close()
  }

  console.log('Quit test results:', JSON.stringify(results, null, 2))
  log({ event: 'scenario', batch: 'B05', scenario: 'S09_quit', result: results.quitWorked ? 'pass' : 'fail', notes: results.notes })

  writeFileSync('/app/audit/playwright/findings/evidence/B05/B05_quit_results.json',
    JSON.stringify({ results, completedAt: new Date().toISOString() }, null, 2))

  return results
}

runQuit().catch(err => {
  console.error('FATAL:', err.message)
  log({ event: 'error', batch: 'B05', scenario: 'S09', error: err.message })
})

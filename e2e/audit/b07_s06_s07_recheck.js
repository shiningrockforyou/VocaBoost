/**
 * B07 S06/S07 recheck — verify error UI and retry button behavior
 * when all writes fail or are stalled
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B07'
const SEEDED = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const BASE_URL = 'https://vocaboostone.netlify.app'

function getAccount(personaId, targetClass = 'TOP') {
  return SEEDED.accounts.find(a => a.personaId === personaId && a.targetClass === targetClass)
}

async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) await r.unregister()
    }
  })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
  })
  return account
}

async function recheckS06() {
  console.log('\n=== S06 RECHECK: All Firestore writes return 500 ===')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleLog = []
  page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 400) }))
  page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: e.message }))

  try {
    // First login WITHOUT blocking to get a valid session
    const account = await loginAs(page, 'recovering', 'CORE')
    console.log(`Logged in as ${account.email}`)

    const dashContent = await page.evaluate(() => document.body?.innerText || '')
    console.log(`Dashboard: ${dashContent.substring(0, 300)}`)

    // Check localStorage for session state
    const ls = await page.evaluate(() => {
      const result = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        result[k] = localStorage.getItem(k)?.substring(0, 100)
      }
      return result
    })
    console.log('LocalStorage keys:', Object.keys(ls))

    // Now apply 500 on ALL subsequent writes
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        console.log(`[S06] Blocking write with 500: ${url.substring(0, 80)}`)
        route.fulfill({ status: 500, body: '{}' })
      } else {
        route.continue().catch(() => {})
      }
    })

    // Click Start Session
    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      console.log('Clicked Start Session')
      await page.waitForTimeout(8000)

      const sessionContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`After start (with 500s): ${sessionContent.substring(0, 400)}`)
      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S06_recheck_01.png`, fullPage: true })

      const hasError = sessionContent.toLowerCase().includes('error') ||
                      sessionContent.toLowerCase().includes('failed') ||
                      sessionContent.toLowerCase().includes('sorry')
      const hasRetry = await page.getByRole('button', { name: /try again|retry/i }).count() > 0
      const errors = consoleLog.filter(l => l.type === 'error').map(l => l.text)

      console.log(`hasError=${hasError}, hasRetry=${hasRetry}`)
      console.log('Console errors:', errors.slice(0, 5))
    } else {
      // No Start Session button — try to see what account state says
      const startBtns = await page.getByRole('button', { name: /start|begin|study|resume/i }).all()
      console.log(`All session-type buttons: ${startBtns.length}`)
      for (const btn of startBtns) {
        console.log(`  - "${await btn.innerText().catch(() => '?')}"`)
      }
      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S06_recheck_no_start.png`, fullPage: true })
    }

  } finally {
    await browser.close()
  }
}

async function recheckS07() {
  console.log('\n=== S07 RECHECK: Firestore stalled — focused on session start path ===')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleLog = []
  page.on('console', msg => {
    const text = msg.text()
    consoleLog.push({ type: msg.type(), text: text.substring(0, 400) })
    if (msg.type() === 'error') console.log(`  [console.error] ${text.substring(0, 200)}`)
  })
  page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`))

  try {
    const account = await loginAs(page, 'recovering', 'TOP')
    console.log(`Logged in as ${account.email}`)

    // Apply stall AFTER login (only to subsequent writes)
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        console.log(`  [S07] STALLING write: ${url.substring(0, 80)}`)
        // Never resolve
      } else {
        route.continue().catch(() => {})
      }
    })

    const dashContent = await page.evaluate(() => document.body?.innerText || '')
    console.log(`Dashboard: ${dashContent.substring(0, 200)}`)

    // Start session
    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      console.log('Clicked Start Session — waiting 20s for timeout behavior')
      await page.waitForTimeout(20000)
      const content = await page.evaluate(() => document.body?.innerText || '')
      const html = await page.evaluate(() => document.body?.innerHTML || '')
      console.log(`After 20s stall (content length=${content.length}): ${content.substring(0, 400)}`)
      console.log(`HTML (spinner check): ${html.includes('spin') ? 'spinner found in HTML' : 'no spinner class'}`)
      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S07_recheck_01.png`, fullPage: true })

      const hasSpinner = await page.locator('[class*="spin"]').count() > 0
      const hasLoading = await page.locator('[aria-busy="true"]').count() > 0
      const isStuck = content.trim().length < 100 || hasSpinner || hasLoading
      console.log(`hasSpinner=${hasSpinner}, hasLoading=${hasLoading}, isStuck=${isStuck}`)
    } else {
      console.log('No Start Session button')
      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S07_recheck_no_start.png`, fullPage: true })
    }

  } finally {
    await browser.close()
  }
}

// Also check idempotency — attempt docs for recovering persona
async function checkIdempotency() {
  console.log('\n=== Idempotency check: recovering TOP uid ===')
  const recoveringTop = SEEDED.accounts.find(a => a.personaId === 'recovering' && a.targetClass === 'TOP')
  const recoveringCore = SEEDED.accounts.find(a => a.personaId === 'recovering' && a.targetClass === 'CORE')
  console.log(`recovering/TOP uid: ${recoveringTop.uid}`)
  console.log(`recovering/CORE uid: ${recoveringCore.uid}`)

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const { readFileSync } = await import('fs')

    if (getApps().length === 0) {
      const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }

    const db = getFirestore()

    for (const [label, uid] of [['TOP', recoveringTop.uid], ['CORE', recoveringCore.uid]]) {
      const snap = await db.collection('attempts').where('studentId', '==', uid).get()
      const docs = snap.docs.map(d => ({
        id: d.id,
        sessionType: d.data().sessionType,
        score: d.data().score,
        nonce: d.data().nonce || d.data().idempotencyKey || 'no-nonce',
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() || 'unknown'
      }))
      console.log(`\nrecovering/${label} (${uid}) attempts: ${docs.length}`)
      docs.forEach(d => console.log(`  - ${d.id}: type=${d.sessionType} score=${d.score} nonce=${d.nonce} created=${d.createdAt}`))

      writeFileSync(`${EVIDENCE_DIR}/B07_idempotency_${label}.json`, JSON.stringify({ uid, label, attempts: docs }, null, 2))
    }
  } catch (e) {
    console.error('Idempotency check failed:', e.message)
  }
}

async function main() {
  await checkIdempotency()
  await recheckS06()
  await recheckS07()
  console.log('\nRechecks complete.')
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e)
  process.exit(1)
})

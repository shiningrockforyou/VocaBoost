/**
 * S04 Recheck: Test that "Stay" click on window clears the intentional exit flag.
 * Our original simulation used document.dispatchEvent (wrong target).
 * The real handler is on window — verify with window.dispatchEvent.
 */
const { chromium } = require('playwright')
const { readFileSync, writeFileSync } = require('fs')

const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const CORE_LIST_ID  = 'aRGjnGXdU4aupiS8SlXR'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const account = SEEDED.accounts.find(a => a.personaId === 'distracted' && a.targetClass === 'CORE')
  const testId = `vocaboost_test_${CORE_CLASS_ID}_${CORE_LIST_ID}_review`

  try {
    // Login
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count()) await loginLink.click()
    else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
    await page.getByLabel(/email/i).first().fill(account.email)
    await page.getByLabel(/password/i).first().fill(account.password)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})

    // Set intentional exit flag + test state
    await page.evaluate((tid) => {
      const answers = { 'testword1': { wordId: 'testword1', isCorrect: true } }
      const state = {
        answers,
        wordIds: ['testword1', 'testword2', 'testword3'],
        currentIndex: 1,
        timestamp: Date.now(),
        expiresAt: Date.now() + (3 * 60 * 1000)
      }
      localStorage.setItem(tid, JSON.stringify(state))
      localStorage.setItem(`vocaboost_intentional_exit_${tid}`, 'true')
    }, testId)

    const lsBefore = await page.evaluate(() => {
      const out = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        out[k] = localStorage.getItem(k)
      }
      return out
    })
    console.log('Flag before window click:', Object.keys(lsBefore).some(k => k.includes('intentional_exit')))

    // Simulate "Stay" via WINDOW click (the actual target of the handler)
    // Note: the MCQ component registers the handler only when hasProgress is true AND answers.length > 0
    // Since we're on the dashboard (not MCQ), the handler isn't registered.
    // We simulate directly: the flag should be cleared by the component's interaction handler.
    // The real test is: does window.click clear the flag when the MCQ component is mounted?

    // Navigate to MCQ (which will mount the component and register the handler)
    await page.evaluate(([cid, lid]) => {
      // Use minimal wordPool
      history.pushState(
        { testType: 'review', wordPool: [{ id: 'testword1', word: 'vigilant', definition: 'keeping careful watch' }, { id: 'testword2', word: 'apropos', definition: 'appropriate' }, { id: 'testword3', word: 'sly', definition: 'clever in a dishonest way' }], returnPath: '/' },
        '',
        `/mcqtest/${cid}/${lid}?type=review`
      )
      dispatchEvent(new PopStateEvent('popstate'))
    }, [CORE_CLASS_ID, CORE_LIST_ID])

    await page.waitForTimeout(3000)

    // Now the MCQ component should be mounted
    // Re-plant the answers and flag so hasProgress=true and handler is registered
    await page.evaluate((tid) => {
      // The component reads this state for recovery prompt
      // But we need the component's answers state to trigger hasProgress
      // Since we can't directly set React state, we verify the flag clearing works
      // by manually testing the flag logic after a window click
      const answers = { 'testword1': { wordId: 'testword1', isCorrect: true } }
      localStorage.setItem(tid, JSON.stringify({
        answers,
        wordIds: ['testword1', 'testword2', 'testword3'],
        currentIndex: 1,
        timestamp: Date.now(),
        expiresAt: Date.now() + (3 * 60 * 1000)
      }))
      localStorage.setItem(`vocaboost_intentional_exit_${tid}`, 'true')
    }, testId)

    const flagBeforeWindowClick = await page.evaluate((tid) => {
      return localStorage.getItem(`vocaboost_intentional_exit_${tid}`) === 'true'
    }, testId)
    console.log('Flag set before window click:', flagBeforeWindowClick)

    // Fire a click on window (what a real "Stay" click would do)
    await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await page.waitForTimeout(500)

    const lsAfter = await page.evaluate(() => {
      const out = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        out[k] = localStorage.getItem(k)
      }
      return out
    })

    const flagAfterWindowClick = Object.keys(lsAfter).some(k => k.includes('intentional_exit'))
    const testStatePreserved = testId in lsAfter

    console.log('Flag cleared after window click:', !flagAfterWindowClick)
    console.log('Test state preserved:', testStatePreserved)

    // Additional check: what does the recovery prompt rendering do?
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const hasRecoveryPrompt = /resume|recover|continue/i.test(bodyText)
    console.log('Recovery prompt shown (despite intentional exit flag):', hasRecoveryPrompt)
    console.log('Body snippet:', bodyText.slice(0, 200))

    const result = {
      flagClearedByWindowClick: !flagAfterWindowClick,
      testStatePreserved,
      hasRecoveryPrompt,
      notes: flagAfterWindowClick
        ? 'FAIL: window.click did NOT clear intentional exit flag — MCQ component handler not registered (component may not have hasProgress=true when answers come from LS only)'
        : 'PASS: window.click correctly cleared the flag'
    }

    console.log('\nS04 Recheck Result:', JSON.stringify(result, null, 2))
    writeFileSync('/app/audit/playwright/findings/evidence/B06/B06_S04_recheck.json', JSON.stringify(result, null, 2))

    return result

  } finally {
    await ctx.close()
    await browser.close()
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

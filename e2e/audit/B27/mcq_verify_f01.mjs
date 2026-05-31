/**
 * Targeted F01 verification probe.
 * Enter review test for Day 10 (current session state), capture first ~15 MCQ question words,
 * verify each against pre-session study_states.
 * Does NOT submit the test (to avoid changing state).
 * Uses correct MCQ word extraction: text of the word being DEFINED (large heading), not option text.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_lazy_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const OUT = '/app/audit/playwright/findings/evidence/B27/lazy_rerun'
const UID = 'VBgBmlrlzXVPzURmABkdDBGtKd42'

const CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const BY_TEXT = {}
const BY_ID = {}
for (const w of CACHE) {
  BY_TEXT[w.word.trim().toLowerCase()] = w
  BY_TEXT[w.word.trim().replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()] = w
  BY_ID[w.id] = w
}

function lookupWord(text) {
  if (!text) return null
  return BY_TEXT[text.trim().toLowerCase()] || BY_TEXT[text.trim().replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()] || null
}

// Admin SDK
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Pre-session study_states
const ssSnap = await db.collection(`users/${UID}/study_states`).get()
const preSSMap = {}
for (const doc of ssSnap.docs) {
  const d = doc.data()
  preSSMap[doc.id] = d
  if (d.wordId) preSSMap[d.wordId] = d
}
const nowMs = Date.now()
console.log(`Pre-session MASTERED with future returnAt: ${Object.values(preSSMap).filter(ss => ss.status === 'MASTERED' && ss.returnAt?._seconds && ss.returnAt._seconds * 1000 > nowMs).length}`)

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
})

const capturedWords = []
let leakedMastered = []

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    const origNow = Date.now.bind(Date)
    const offset = new Date('2026-06-20T09:00:00+09:00').getTime() - origNow()
    Date.now = () => origNow() + offset
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })
  
  const page = await context.newPage()
  
  // Login
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /continue/i }).first().click()
    await page.waitForTimeout(5000)
  }
  
  const dashBody = await page.locator('body').textContent()
  console.log('Dashboard:', dashBody.substring(0, 200))
  
  // Start session  
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(4000)
  }
  
  const bodyAfterStart = await page.locator('body').textContent()
  const stepMatch = bodyAfterStart.match(/Step (\d+) of (\d+)/)
  const currentStep = stepMatch ? parseInt(stepMatch[1]) : null
  console.log('Step after start:', currentStep)
  
  // Handle step 5 (H2)
  if (currentStep === 5) {
    console.log('H2: at step 5, moving to next day...')
    const moveOn = page.getByRole('button', { name: /move on to next day/i }).first()
    const back = page.getByRole('button', { name: /back to dashboard/i }).first()
    if (await moveOn.isVisible({ timeout: 2000 }).catch(() => false)) await moveOn.click()
    else if (await back.isVisible({ timeout: 2000 }).catch(() => false)) await back.click()
    await page.waitForTimeout(3000)
    // Re-start
    const startBtn2 = page.getByRole('button', { name: /Start Session/i }).first()
    if (await startBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn2.click()
      await page.waitForTimeout(4000)
    }
  }
  
  // Skip to review test via session menu
  let bodyForStep = await page.locator('body').textContent()
  let st = bodyForStep.match(/Step (\d+)/)
  let step = st ? parseInt(st[1]) : null
  
  if (step === 3 || step === 4) {
    console.log(`At step ${step}, skipping to review test...`)
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(700)
      const skipBtn = page.getByText('Skip to Test')
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(1000)
        const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
        if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await startTestBtn.click()
          await page.waitForTimeout(4000)
        }
      }
    }
  }
  
  await page.screenshot({ path: OUT + '/verify_01_review_start.png' })
  
  // Now capture MCQ questions — one at a time, up to 15 questions
  // The MCQ shows one word + 4 definition options. Word is in a prominent heading.
  // After clicking an option, the next question appears (or submit button if done).
  
  for (let q = 0; q < 15; q++) {
    const body = await page.locator('body').textContent()
    
    // Check if still in review test
    if (!body.includes('Review Test') && !body.includes('review test')) {
      console.log(`Q${q}: No longer in review test. Done.`)
      break
    }
    
    // Extract the CURRENT question word
    // MCQ format: shows word in large text, student picks definition
    const wordInfo = await page.evaluate(() => {
      // Find the question word - look for the word being defined
      // It's usually in a prominent element near the top of the question area
      // The options are definition texts (longer strings)
      
      // Strategy 1: Find the first element with large font that's a short word/phrase
      const candidates = []
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length > 0) continue // skip containers
        const text = el.textContent.trim()
        if (!text || text.length < 2 || text.length > 60) continue
        // Skip obvious non-words
        if (text.match(/^\d+/) || text.includes('Review Test') || text.includes('Step ') || text.includes('Answered') || text.includes('%')) continue
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        const fontWeight = parseInt(style.fontWeight)
        if (fontSize >= 20 || fontWeight >= 600) {
          candidates.push({ text, fontSize, fontWeight, tag: el.tagName })
        }
      }
      
      // Sort by fontSize desc, then fontWeight desc
      candidates.sort((a, b) => b.fontSize - a.fontSize || b.fontWeight - a.fontWeight)
      
      // The question word is typically the largest single word/short phrase
      return candidates.slice(0, 5)
    })
    
    console.log(`\nQ${q} candidates:`, JSON.stringify(wordInfo))
    
    // Take the most likely word (largest/boldest that's a plausible vocabulary word)
    let questionWord = null
    for (const candidate of wordInfo) {
      const w = lookupWord(candidate.text)
      if (w) {
        questionWord = { word: candidate.text, wordEntry: w }
        break
      }
    }
    
    if (!questionWord && wordInfo.length > 0) {
      // Try all candidates  
      questionWord = { word: wordInfo[0].text, wordEntry: null }
    }
    
    // Check its study_state
    let preStatus = undefined
    let preReturnAtMs = null
    if (questionWord?.wordEntry) {
      const ss = preSSMap[questionWord.wordEntry.id]
      if (ss) {
        preStatus = ss.status
        preReturnAtMs = ss.returnAt?._seconds ? ss.returnAt._seconds * 1000 : null
      }
    }
    
    const isF01 = preStatus === 'MASTERED' && preReturnAtMs && preReturnAtMs > nowMs
    
    capturedWords.push({
      q,
      word: questionWord?.word,
      wordId: questionWord?.wordEntry?.id,
      position: questionWord?.wordEntry?.position,
      preStatus,
      preReturnAtMs,
      isF01,
      candidates: wordInfo.slice(0, 3)
    })
    
    console.log(`Q${q}: "${questionWord?.word}" pos=${questionWord?.wordEntry?.position} status=${preStatus} returnAt=${preReturnAtMs ? new Date(preReturnAtMs).toISOString() : null} F01=${isF01}`)
    if (isF01) {
      leakedMastered.push({ q, wordId: questionWord.wordEntry.id, word: questionWord.word, position: questionWord.wordEntry.position, preReturnAtMs })
    }
    
    await page.screenshot({ path: OUT + `/verify_q${String(q).padStart(2,'0')}.png` })
    
    // Click a random option to advance to next question
    // Options are buttons with definition text
    const options = await page.evaluate(() => {
      // Find option buttons - they contain definition text (longer) and have styling
      const btns = []
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent.trim()
        if (text && text.length > 8 && text.length < 200 && !text.match(/submit|next|back|skip|menu|continue|move on|start|cancel|dashboard/i)) {
          const r = btn.getBoundingClientRect()
          if (r.width > 100 && r.height > 30) {
            btns.push({ text: text.substring(0, 60), x: r.x + r.width/2, y: r.y + r.height/2 })
          }
        }
      }
      return btns
    })
    
    console.log(`  Options found: ${options.length}`)
    if (options.length > 0) {
      // Click LAST option (usually wrong, lazy behavior)
      const opt = options[options.length - 1]
      await page.mouse.click(opt.x, opt.y)
      await page.waitForTimeout(800)
    } else {
      // Try submit
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`  Submit button visible. NOT clicking (don't want to change state).`)
        break
      }
      console.log(`  No options and no submit. Breaking.`)
      break
    }
  }
  
  // Final screenshot
  await page.screenshot({ path: OUT + '/verify_final.png' })
  
} finally {
  await browser.close()
}

console.log('\n=== RESULTS ===')
console.log(`Words captured: ${capturedWords.length}`)
console.log(`F01 leaks (MASTERED-future in review): ${leakedMastered.length}`)
for (const leak of leakedMastered) {
  console.log(`  Q${leak.q}: wordId=${leak.wordId} word="${leak.word}" pos=${leak.position} returnAt=${new Date(leak.preReturnAtMs).toISOString()}`)
}

writeFileSync(OUT + '/verify_results.json', JSON.stringify({ capturedWords, leakedMastered, nowMs }, null, 2))
console.log('Results saved to', OUT + '/verify_results.json')


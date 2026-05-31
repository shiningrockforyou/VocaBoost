/**
 * Full F01 verification: Complete the MCQ review test for Day 10 (current session),
 * capturing every question word and checking each against pre-session study_states.
 * Uses correct MCQ navigation: page.mouse.click on option coordinates.
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
  const clean = w.word.trim().replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
  if (clean !== w.word.trim().toLowerCase()) BY_TEXT[clean] = w
  BY_ID[w.id] = w
}
function lookupWord(text) {
  if (!text) return null
  const t = text.trim().toLowerCase()
  return BY_TEXT[t] || BY_TEXT[t.replace(/\s*\([^)]+\)\s*$/, '').trim()] || null
}

// Admin SDK
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const ssSnap = await db.collection(`users/${UID}/study_states`).get()
const preSSMap = {}
for (const doc of ssSnap.docs) {
  const d = doc.data()
  preSSMap[doc.id] = d
  if (d.wordId) preSSMap[d.wordId] = d
}
const nowMs = Date.now()

const masteredFuture = Object.values(preSSMap).filter(ss => 
  ss.status === 'MASTERED' && ss.returnAt?._seconds && ss.returnAt._seconds * 1000 > nowMs
)
console.log(`Pre-session MASTERED with future returnAt: ${masteredFuture.length}`)

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
})

const capturedWords = []
let f01Leaks = []
let score = null

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
  
  // Start session
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(4000)
  }
  
  const bodyAfterStart = await page.locator('body').textContent()
  const stepMatch = bodyAfterStart.match(/Step (\d+)/)
  const step = stepMatch ? parseInt(stepMatch[1]) : null
  console.log('Step:', step)
  
  // If H2
  if (step === 5) {
    const moveOn = page.getByRole('button', { name: /move on to next day/i }).first()
    const back = page.getByRole('button', { name: /back to dashboard/i }).first()
    if (await moveOn.isVisible({ timeout: 2000 }).catch(() => false)) await moveOn.click()
    else if (await back.isVisible({ timeout: 2000 }).catch(() => false)) await back.click()
    await page.waitForTimeout(3000)
    const sb2 = page.getByRole('button', { name: /Start Session/i }).first()
    if (await sb2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sb2.click()
      await page.waitForTimeout(4000)
    }
  }
  
  // Skip to review test
  let bodyCheck = await page.locator('body').textContent()
  let sm = bodyCheck.match(/Step (\d+)/)
  let curStep = sm ? parseInt(sm[1]) : null
  if (curStep === 3 || curStep === 4) {
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(700)
      const skipBtn = page.getByText('Skip to Test')
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(1000)
        const startTest = page.getByRole('button', { name: /start test/i }).first()
        if (await startTest.isVisible({ timeout: 3000 }).catch(() => false)) {
          await startTest.click()
          await page.waitForTimeout(4000)
        }
      }
    }
  }
  
  // Full MCQ test capture — up to 60 questions
  for (let q = 0; q < 60; q++) {
    const body = await page.locator('body').textContent()
    if (!body.includes('Review Test')) {
      console.log(`Q${q}: Not in review test anymore. Done.`)
      break
    }
    
    // Check if all answered + submit visible
    const submittedMatch = body.match(/(\d+) of (\d+) answered/)
    const allAnswered = submittedMatch && parseInt(submittedMatch[1]) >= parseInt(submittedMatch[2])
    
    // Extract question word
    const wordInfo = await page.evaluate(() => {
      const candidates = []
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length > 0) continue
        const text = el.textContent.trim()
        if (!text || text.length < 2 || text.length > 60) continue
        if (/^\d+|Review Test|Step |Answered|%|Submit|Play Audio|correct|wrong/i.test(text)) continue
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        const fontWeight = parseInt(style.fontWeight)
        if (fontSize >= 20 || fontWeight >= 600) {
          candidates.push({ text, fontSize, fontWeight, tag: el.tagName })
        }
      }
      candidates.sort((a, b) => b.fontSize - a.fontSize || b.fontWeight - a.fontWeight)
      return candidates.slice(0, 3)
    })
    
    // Find the vocabulary word from candidates
    let qWord = null
    for (const c of wordInfo) {
      const w = lookupWord(c.text)
      if (w) { qWord = { word: c.text, entry: w }; break }
    }
    if (!qWord && wordInfo[0]) qWord = { word: wordInfo[0].text, entry: null }
    
    // Check study_state
    let preStatus = undefined
    let preReturnAtMs = null
    if (qWord?.entry) {
      const ss = preSSMap[qWord.entry.id]
      if (ss) {
        preStatus = ss.status
        preReturnAtMs = ss.returnAt?._seconds ? ss.returnAt._seconds * 1000 : null
      }
    }
    
    const isF01 = preStatus === 'MASTERED' && preReturnAtMs != null && preReturnAtMs > nowMs
    capturedWords.push({ q, word: qWord?.word, wordId: qWord?.entry?.id, position: qWord?.entry?.position, preStatus, preReturnAtMs, isF01 })
    
    console.log(`Q${q}: "${qWord?.word}" pos=${qWord?.entry?.position} ${preStatus ?? 'NEVER_TESTED'} F01=${isF01}`)
    if (isF01) f01Leaks.push({ q, word: qWord.word, wordId: qWord.entry.id, pos: qWord.entry.position, preReturnAtMs })
    
    if (allAnswered) {
      console.log(`All answered. Submitting.`)
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        const scoreBody = await page.locator('body').textContent()
        const sm = scoreBody.match(/(\d+)%/)
        const sm2 = scoreBody.match(/(\d+) of (\d+) correct/i)
        score = sm ? parseInt(sm[1]) : (sm2 ? Math.round(parseInt(sm2[1]) / parseInt(sm2[2]) * 100) : null)
        console.log('Score:', score)
        break
      }
    }
    
    // Click an option using mouse coordinates
    const optionInfo = await page.evaluate(() => {
      const btns = []
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent.trim()
        if (!text || text.length < 8 || /submit|menu|skip|back|dashboard|move on|start|cancel|play audio|🔊/i.test(text)) continue
        const r = btn.getBoundingClientRect()
        if (r.width > 100 && r.height > 30) {
          btns.push({ text: text.substring(0, 50), x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height })
        }
      }
      return btns
    })
    
    if (optionInfo.length === 0) {
      // Submit may be visible
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        const scoreBody = await page.locator('body').textContent()
        const sm = scoreBody.match(/(\d+)%/)
        score = sm ? parseInt(sm[1]) : null
        console.log('Submitted. Score:', score)
        break
      }
      console.log('No options. Breaking.')
      break
    }
    
    // Lazy: click last option
    const opt = optionInfo[optionInfo.length - 1]
    await page.mouse.click(opt.x, opt.y)
    await page.waitForTimeout(600)
  }
  
  await page.screenshot({ path: OUT + '/verify_complete.png' })
  
} finally {
  await browser.close()
}

console.log('\n=== FULL F01 VERIFICATION RESULTS ===')
console.log(`Questions captured: ${capturedWords.length}`)
console.log(`Score: ${score}`)
console.log(`F01 Leaks (MASTERED-future served in review): ${f01Leaks.length}`)
if (f01Leaks.length > 0) {
  console.log('LEAKED MASTERED words:')
  for (const leak of f01Leaks) {
    console.log(`  Q${leak.q} wordId=${leak.wordId} word="${leak.word}" pos=${leak.pos} returnAt=${new Date(leak.preReturnAtMs).toISOString()}`)
  }
  console.log('F01: NOT FIXED')
} else {
  console.log('No MASTERED words served. F01: RESOLVED for this session.')
}

console.log('\nAll captured words:')
for (const w of capturedWords) {
  console.log(`  Q${w.q}: "${w.word}" pos=${w.position} status=${w.preStatus ?? 'NEVER_TESTED'} F01=${w.isF01}`)
}

writeFileSync(OUT + '/verify_full_results.json', JSON.stringify({ capturedWords, f01Leaks, score, nowMs }, null, 2))

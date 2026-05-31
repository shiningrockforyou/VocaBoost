/**
 * Day 11 MCQ review test - F01 verification (second review session).
 * CSD is now 10. Dashboard should show Day 11.
 * Day 11 segment: calculateSegment(11, 5, 240, 80, 1.0) = [0, 47]
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

const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// PRE-SESSION study_states (taken NOW, before session)
const ssSnap = await db.collection(`users/${UID}/study_states`).get()
const preSSMap = {}
for (const doc of ssSnap.docs) {
  const d = doc.data()
  preSSMap[doc.id] = d
  if (d.wordId) preSSMap[d.wordId] = d
}
const nowMs = Date.now()
const dayMs = new Date('2026-06-23T09:00:00+09:00').getTime()  // Day 11 simulated date

const preMasteredFuture = Object.values(preSSMap).filter(ss => ss.status === 'MASTERED' && ss.returnAt?._seconds && ss.returnAt._seconds * 1000 > dayMs)
console.log(`Pre-session Day 11: MASTERED with future returnAt (vs Day 11 time): ${preMasteredFuture.length}`)

const IDK = ['idk', 'I don\'t know', '모름', '?', 'pass']
function lazyAns() { return IDK[Math.floor(Math.random() * IDK.length)] }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
})

const capturedWords = []
let f01Leaks = []
let score = null

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // Shim to Day 11 date
  await context.addInitScript(() => {
    const origNow = Date.now.bind(Date)
    const offset = new Date('2026-06-23T09:00:00+09:00').getTime() - origNow()
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
  const dayMatch = dashBody.match(/Day\s+(\d+)\s*Start Session/i)
  console.log('Dashboard day:', dayMatch ? dayMatch[1] : 'unknown')
  
  // Start session
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(4000)
  }
  
  const bodyAfterStart = await page.locator('body').textContent()
  const stepMatch = bodyAfterStart.match(/Step (\d+)/)
  let step = stepMatch ? parseInt(stepMatch[1]) : null
  console.log('Step after start:', step, '| Text:', bodyAfterStart.substring(0, 200))
  
  // H2 guard
  if (step === 5) {
    const moveOn = page.getByRole('button', { name: /move on to next day/i }).first()
    const back = page.getByRole('button', { name: /back to dashboard/i }).first()
    if (await moveOn.isVisible({ timeout: 2000 }).catch(() => false)) await moveOn.click()
    else if (await back.isVisible({ timeout: 2000 }).catch(() => false)) await back.click()
    await page.waitForTimeout(3000)
    // Navigate back to dashboard and start fresh
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    const sb2 = page.getByRole('button', { name: /Start Session/i }).first()
    if (await sb2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sb2.click()
      await page.waitForTimeout(4000)
    }
    const body2 = await page.locator('body').textContent()
    const sm2 = body2.match(/Step (\d+)/)
    step = sm2 ? parseInt(sm2[1]) : null
    console.log('Step after H2 clear:', step)
  }
  
  // If Day 11, we need to handle the typed new-word test first (step 1/2), then review (step 3/4)
  // OR we might be at step 3 directly if typed test already done
  if (step === 1 || step === null) {
    // Need to do typed test (IL=1.0 → 0 new words, so test shows no inputs)
    // OR skip to test
    const dismissBtn = page.getByRole('button', { name: /start studying/i }).first()
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click()
      await page.waitForTimeout(1000)
    }
    
    const skipOk = async () => {
      const menuBtn = page.locator('[aria-label="Session menu"]')
      if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) return false
      await menuBtn.click()
      await page.waitForTimeout(500)
      const skipBtn = page.getByText('Skip to Test')
      if (!await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.keyboard.press('Escape')
        return false
      }
      await skipBtn.click()
      await page.waitForTimeout(800)
      const stBtn = page.getByRole('button', { name: /start test/i }).first()
      if (await stBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stBtn.click()
        await page.waitForTimeout(3000)
      }
      return true
    }
    
    await skipOk()
    
    // Now handle the typed test (should have 0 words at IL=1.0, or need to fill and submit)
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    const ic = await typedInputs.count().catch(() => 0)
    console.log('Typed inputs:', ic)
    
    if (ic > 0) {
      // Fill lazy answers
      for (let i = 0; i < ic; i++) {
        await typedInputs.nth(i).fill(lazyAns())
      }
      const submitTyped = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitTyped.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitTyped.click()
        // Wait for grading
        for (let t = 0; t < 12; t++) {
          await page.waitForTimeout(5000)
          const b = await page.locator('body').textContent()
          if (b.includes('Completed Day') || b.match(/\d+%/) || b.includes('Your Answer')) break
        }
      }
    }
    
    // Continue to next step
    const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(3000)
    }
    
    const bodyNow = await page.locator('body').textContent()
    const sm3 = bodyNow.match(/Step (\d+)/)
    step = sm3 ? parseInt(sm3[1]) : null
    console.log('Step after typed test handling:', step)
  }
  
  // Now skip to review test if at step 3
  if (step === 3 || step === 4) {
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
  
  const bodyBeforeTest = await page.locator('body').textContent()
  console.log('Body before MCQ loop:', bodyBeforeTest.substring(0, 300))
  await page.screenshot({ path: OUT + '/day11_verify_start.png' })
  
  // MCQ loop
  for (let q = 0; q < 60; q++) {
    const body = await page.locator('body').textContent()
    if (!body.includes('Review Test')) {
      console.log(`Q${q}: Not in review test. Done.`)
      break
    }
    
    const submittedMatch = body.match(/(\d+) of (\d+) answered/)
    const allAnswered = submittedMatch && parseInt(submittedMatch[1]) >= parseInt(submittedMatch[2])
    
    // Extract question word
    const wordInfo = await page.evaluate(() => {
      const candidates = []
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length > 0) continue
        const text = el.textContent.trim()
        if (!text || text.length < 2 || text.length > 70) continue
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
    
    let qWord = null
    for (const c of wordInfo) {
      const w = lookupWord(c.text)
      if (w) { qWord = { word: c.text, entry: w }; break }
    }
    if (!qWord && wordInfo[0]) qWord = { word: wordInfo[0].text, entry: null }
    
    let preStatus = undefined
    let preReturnAtMs = null
    if (qWord?.entry) {
      const ss = preSSMap[qWord.entry.id]
      if (ss) {
        preStatus = ss.status
        preReturnAtMs = ss.returnAt?._seconds ? ss.returnAt._seconds * 1000 : null
      }
    }
    
    const isF01 = preStatus === 'MASTERED' && preReturnAtMs != null && preReturnAtMs > dayMs
    capturedWords.push({ q, word: qWord?.word, wordId: qWord?.entry?.id, position: qWord?.entry?.position, preStatus, preReturnAtMs, isF01 })
    
    console.log(`Q${q}: "${qWord?.word}" pos=${qWord?.entry?.position} ${preStatus ?? 'NEVER_TESTED'} F01=${isF01}`)
    if (isF01) f01Leaks.push({ q, word: qWord.word, wordId: qWord.entry.id, pos: qWord.entry.position, preReturnAtMs })
    
    if (allAnswered) {
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
    
    const optionInfo = await page.evaluate(() => {
      const btns = []
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent.trim()
        if (!text || text.length < 8 || /submit|menu|skip|back|dashboard|move on|start|cancel|play audio|🔊/i.test(text)) continue
        const r = btn.getBoundingClientRect()
        if (r.width > 100 && r.height > 30) {
          btns.push({ text: text.substring(0, 50), x: r.x + r.width/2, y: r.y + r.height/2 })
        }
      }
      return btns
    })
    
    if (optionInfo.length === 0) {
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        const scoreBody = await page.locator('body').textContent()
        const sm = scoreBody.match(/(\d+)%/)
        score = sm ? parseInt(sm[1]) : null
        break
      }
      break
    }
    
    const opt = optionInfo[optionInfo.length - 1]
    await page.mouse.click(opt.x, opt.y)
    await page.waitForTimeout(600)
  }
  
  await page.screenshot({ path: OUT + '/day11_verify_end.png' })
  
} finally {
  await browser.close()
}

console.log('\n=== DAY 11 F01 VERIFICATION RESULTS ===')
console.log(`Questions captured: ${capturedWords.length}, Score: ${score}`)
console.log(`F01 Leaks: ${f01Leaks.length}`)
for (const l of f01Leaks) {
  console.log(`  Q${l.q}: wordId=${l.wordId} word="${l.word}" pos=${l.pos} returnAt=${new Date(l.preReturnAtMs).toISOString()}`)
}
console.log(f01Leaks.length > 0 ? 'F01: NOT FIXED' : 'F01: RESOLVED for this day')

writeFileSync(OUT + '/day11_verify_results.json', JSON.stringify({ day: 11, capturedWords, f01Leaks, score, dayMs }, null, 2))

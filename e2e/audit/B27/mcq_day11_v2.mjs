/**
 * Day 11 MCQ F01 verification — handles H2 stale Step 5.
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
for (const w of CACHE) {
  BY_TEXT[w.word.trim().toLowerCase()] = w
  const clean = w.word.trim().replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
  if (clean !== w.word.trim().toLowerCase()) BY_TEXT[clean] = w
}
function lookupWord(text) {
  if (!text) return null
  const t = text.trim().toLowerCase()
  return BY_TEXT[t] || BY_TEXT[t.replace(/\s*\([^)]+\)\s*$/, '').trim()] || null
}

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
const dayMs = new Date('2026-06-23T09:00:00+09:00').getTime()

const IDK = ['idk', 'I don\'t know', '모름', '?', 'pass']
function lazyAns() { return IDK[Math.floor(Math.random() * IDK.length)] }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
})

const capturedWords = []
let f01Leaks = []
let score = null
let h2Hit = false

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    const origNow = Date.now.bind(Date)
    const offset = new Date('2026-06-23T09:00:00+09:00').getTime() - origNow()
    Date.now = () => origNow() + offset
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })
  
  const page = await context.newPage()
  
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(3000)
  
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /continue/i }).first().click()
    await page.waitForTimeout(5000)
  }
  
  const dashBody = await page.locator('body').textContent()
  console.log('Dashboard day indicator:', dashBody.match(/Day\s+\d+/)?.[0])
  
  // Start session
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(4000)
  }
  
  let bodyAfterStart = await page.locator('body').textContent()
  let stepM = bodyAfterStart.match(/Step (\d+)/)
  let step = stepM ? parseInt(stepM[1]) : null
  console.log('Step after start:', step)
  console.log('Body snippet:', bodyAfterStart.substring(0, 200))
  
  // H2 guard: if step 5, click back/move on and start fresh
  let h2Attempts = 0
  while (step === 5 && h2Attempts < 3) {
    h2Hit = true
    h2Attempts++
    console.log(`H2 stale Step 5 detected (attempt ${h2Attempts})`)
    
    const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
    const moveOn = page.getByRole('button', { name: /move on to next day/i }).first()
    const resume = page.getByRole('button', { name: /resume/i }).first()
    
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click()
      console.log('Clicked Back to Dashboard')
    } else if (await moveOn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveOn.click()
      console.log('Clicked Move On')
    } else if (await resume.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resume.click()
      console.log('Clicked Resume')
    } else {
      // Navigate to root
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
    await page.waitForTimeout(3000)
    
    // Check again
    const bodyNow = await page.locator('body').textContent()
    stepM = bodyNow.match(/Step (\d+)/)
    step = stepM ? parseInt(stepM[1]) : null
    
    if (!step) {
      // We're on dashboard, start session again
      const sb = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
      if (await sb.isVisible({ timeout: 5000 }).catch(() => false)) {
        await sb.click()
        await page.waitForTimeout(4000)
        const bn = await page.locator('body').textContent()
        stepM = bn.match(/Step (\d+)/)
        step = stepM ? parseInt(stepM[1]) : null
        console.log('Step after H2-cleared re-start:', step)
      }
    }
  }
  
  await page.screenshot({ path: OUT + '/day11v2_after_start.png' })
  
  // Now at step 1, 2, 3, or 4
  // IL=1.0 → no new words → typed test should be empty or skip directly
  if (step === 1 || step === null) {
    // Dismiss flashcard
    const dismissBtn = page.getByRole('button', { name: /start studying/i }).first()
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click()
      await page.waitForTimeout(1000)
    }
    
    // Skip to new word test
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(500)
      const skipBtn = page.getByText('Skip to Test').first()
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(800)
        const stBtn = page.getByRole('button', { name: /start test/i }).first()
        if (await stBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await stBtn.click()
          await page.waitForTimeout(3000)
        }
      }
    }
    
    // Handle typed test (0 new words at IL=1.0 but might still show test page)
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    const ic = await typedInputs.count().catch(() => 0)
    console.log('Typed inputs (expect 0 at IL=1.0):', ic)
    
    if (ic > 0) {
      for (let i = 0; i < ic; i++) {
        await typedInputs.nth(i).fill(lazyAns())
      }
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await subBtn.click()
        // Wait grading
        for (let t = 0; t < 15; t++) {
          await page.waitForTimeout(5000)
          const b = await page.locator('body').textContent()
          if (b.match(/\d+%/) || b.includes('Your Answer')) break
        }
      }
    }
    
    const contBtn = page.getByRole('button', { name: /^continue$/i }).first()
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click()
      await page.waitForTimeout(3000)
    }
    
    const bAfterTyped = await page.locator('body').textContent()
    stepM = bAfterTyped.match(/Step (\d+)/)
    step = stepM ? parseInt(stepM[1]) : null
    console.log('Step after typed test:', step)
  }
  
  // Now at step 3 or 4 (review)
  if (step === 3 || step === 4) {
    // Skip to review test
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(700)
      const skipBtn = page.getByText('Skip to Test').first()
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(1000)
        const stBtn = page.getByRole('button', { name: /start test/i }).first()
        if (await stBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await stBtn.click()
          await page.waitForTimeout(4000)
        }
      }
    }
  }
  
  const preTestBody = await page.locator('body').textContent()
  console.log('Pre-MCQ body:', preTestBody.substring(0, 300))
  await page.screenshot({ path: OUT + '/day11v2_pre_mcq.png' })
  
  // MCQ loop
  for (let q = 0; q < 60; q++) {
    const body = await page.locator('body').textContent()
    if (!body.includes('Review Test')) { console.log(`Q${q}: Not review test. Done.`); break }
    
    const sm = body.match(/(\d+) of (\d+) answered/)
    const allAnswered = sm && parseInt(sm[1]) >= parseInt(sm[2])
    
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
        if (fontSize >= 20 || fontWeight >= 600) candidates.push({ text, fontSize, fontWeight })
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
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await subBtn.click()
        await page.waitForTimeout(5000)
        const sb = await page.locator('body').textContent()
        const s1 = sb.match(/(\d+)%/)
        const s2 = sb.match(/(\d+) of (\d+) correct/i)
        score = s1 ? parseInt(s1[1]) : (s2 ? Math.round(parseInt(s2[1]) / parseInt(s2[2]) * 100) : null)
        console.log('Score:', score)
        break
      }
    }
    
    const opts = await page.evaluate(() => {
      const btns = []
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent.trim()
        if (!text || text.length < 8 || /submit|menu|skip|back|dashboard|move on|start|cancel|play audio|🔊/i.test(text)) continue
        const r = btn.getBoundingClientRect()
        if (r.width > 100 && r.height > 30) btns.push({ x: r.x+r.width/2, y: r.y+r.height/2 })
      }
      return btns
    })
    
    if (opts.length === 0) {
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subBtn.click()
        await page.waitForTimeout(5000)
        const sb = await page.locator('body').textContent()
        const s1 = sb.match(/(\d+)%/)
        score = s1 ? parseInt(s1[1]) : null
        break
      }
      break
    }
    
    await page.mouse.click(opts[opts.length - 1].x, opts[opts.length - 1].y)
    await page.waitForTimeout(600)
  }
  
  await page.screenshot({ path: OUT + '/day11v2_end.png' })
  
} finally {
  await browser.close()
}

console.log('\n=== DAY 11 F01 RESULTS ===')
console.log(`Questions: ${capturedWords.length}, Score: ${score}, H2: ${h2Hit}`)
console.log(`F01 Leaks: ${f01Leaks.length}`)
for (const l of f01Leaks) console.log(`  Q${l.q}: ${l.word} pos=${l.pos} returnAt=${new Date(l.preReturnAtMs).toISOString()}`)
console.log(f01Leaks.length > 0 ? 'F01: NOT FIXED on Day 11' : 'F01: CLEAN on Day 11')
console.log('\nAll captured:')
for (const w of capturedWords) console.log(`  Q${w.q}: "${w.word}" pos=${w.position} ${w.preStatus ?? 'NEVER_TESTED'} F01=${w.isF01}`)

writeFileSync(OUT + '/day11v2_results.json', JSON.stringify({ day: 11, capturedWords, f01Leaks, score, h2Hit, dayMs }, null, 2))

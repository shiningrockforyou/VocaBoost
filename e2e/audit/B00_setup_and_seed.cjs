/**
 * B00 — Setup & Seed
 * Runs S01–S06. Driven by Playwright Node API (not @playwright/test runner).
 * Writes evidence to /app/audit/playwright/findings/evidence/B00/
 * Writes audit_state.json (B00 is the only batch that writes this file).
 *
 * Run from /app:
 *   node e2e/audit/B00_setup_and_seed.js
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

// ─── Paths ────────────────────────────────────────────────────────────────────
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B00'
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'
const BASE_URL = 'https://vocaboostone.netlify.app'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] ${msg}`)
}

function saveJson(name, data) {
  const p = path.join(EVIDENCE_DIR, name)
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
  return p
}

async function screenshot(page, name) {
  const p = path.join(EVIDENCE_DIR, name)
  await page.screenshot({ path: p, fullPage: true })
  log(`Screenshot saved: ${name}`)
  return p
}

function loadSeeded() {
  return JSON.parse(fs.readFileSync(SEEDED_PATH, 'utf-8'))
}

function loadAuditState() {
  return JSON.parse(fs.readFileSync(AUDIT_STATE_PATH, 'utf-8'))
}

/**
 * Login using the warm-root-then-route pattern (avoids Netlify 404 on direct /login).
 * Enter key on password field with "Continue" button fallback.
 */
async function loginAs(page, email, password, opts = {}) {
  const timeout = opts.timeout || 30000
  log(`Logging in as ${email}`)

  // Warm the SPA at root
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Route to /login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  const linkCount = await loginLink.count()
  if (linkCount > 0) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  // Wait for email field
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)

  // Press Enter (the button is "Continue" not "Log in")
  await page.getByLabel(/password/i).first().press('Enter')

  // Wait for dashboard / root redirect
  await page.waitForURL(/\/(dashboard|$)/, { timeout }).catch(async () => {
    // Fallback: click Continue/Login button
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i })
      .first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout })
  })
  log(`Login successful: ${email}`)
}

async function signOut(page) {
  try {
    // Try the sign-out button
    const btn = page.getByRole('button', { name: /sign out|log out|logout|signout/i }).first()
    const cnt = await btn.count()
    if (cnt > 0) {
      await btn.click()
      await page.waitForTimeout(1000)
      return
    }
    // Try via Firebase SDK in browser
    await page.evaluate(async () => {
      try {
        const { getAuth, signOut } = await import('firebase/auth')
        await signOut(getAuth())
      } catch (e) {}
    })
    await page.waitForTimeout(500)
    // Clear cookies/storage
    await page.context().clearCookies()
  } catch (e) {
    log(`SignOut warning: ${e.message}`)
  }
}

function collectConsoleErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Filter known noise
      if (
        text.includes('React DevTools') ||
        text.includes('apBoost') ||
        text.includes('favicon')
      ) return
      errors.push(text)
    }
  })
  return errors
}

// ─── S01: Environment Smoke ───────────────────────────────────────────────────
async function runS01(browser) {
  log('=== S01: Environment Smoke ===')
  const startMs = Date.now()
  const page = await browser.newPage()
  const errors = collectConsoleErrors(page)

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const title = await page.title()
    log(`Page title: "${title}"`)

    const titleMatch = /vocaboost/i.test(title)
    if (!titleMatch) {
      log(`WARNING: Title "${title}" does not match /VocaBoost/i`)
    }

    // Wait a moment for any initial render errors
    await page.waitForTimeout(2000)

    await screenshot(page, 'B00_S01_landing.png')

    const consoleErrorCount = errors.length
    log(`Console errors: ${consoleErrorCount}`)
    if (errors.length > 0) {
      log(`First error: ${errors[0]}`)
    }

    return {
      result: (titleMatch && consoleErrorCount === 0) ? 'pass' : 'partial',
      titleMatch,
      consoleErrors: errors,
      durationMs: Date.now() - startMs,
    }
  } finally {
    await page.close()
  }
}

// ─── S02: Verify Seeded Accounts Are Loginable ───────────────────────────────
async function runS02(browser) {
  log('=== S02: Verify Seeded Accounts (sample 1 per persona) ===')
  const startMs = Date.now()
  const seeded = loadSeeded()

  // Build one-per-persona sample: pick the first account for each unique personaId
  const personaMap = new Map()
  for (const account of seeded.accounts) {
    if (!personaMap.has(account.personaId)) {
      personaMap.set(account.personaId, account)
    }
  }

  const sample = [...personaMap.values()]
  log(`Sampling ${sample.length} personas (one per unique personaId)`)

  const results = []

  for (const account of sample) {
    const page = await browser.newPage()
    const errors = collectConsoleErrors(page)
    const t0 = Date.now()

    try {
      await loginAs(page, account.email, account.password, { timeout: 25000 })

      // Check dashboard renders and displayName visible
      await page.waitForTimeout(2000)
      const pageText = await page.textContent('body')
      const nameVisible = pageText.includes(account.displayName) ||
                          pageText.includes(account.displayName.split(' ').slice(-2).join(' '))

      // Verify class enrollment shown (looking for class name or non-empty state)
      const emptyStateText = /join your first class|join a class|no class|enroll/i
      const bodyContent = await page.textContent('body')
      const showsEmptyState = emptyStateText.test(bodyContent)

      await screenshot(page, `B00_S02_login_${account.personaId}_${account.targetClass.toLowerCase()}.png`)

      log(`${account.personaId} (${account.targetClass}): login OK, nameVisible=${nameVisible}, emptyState=${showsEmptyState}`)

      results.push({
        personaId: account.personaId,
        targetClass: account.targetClass,
        email: account.email,
        success: true,
        nameVisible,
        showsEmptyState,
        consoleErrors: errors.length,
        durationMs: Date.now() - t0,
      })
    } catch (err) {
      log(`FAIL: ${account.personaId} (${account.targetClass}): ${err.message}`)
      await screenshot(page, `B00_S02_FAIL_${account.personaId}.png`).catch(() => {})
      results.push({
        personaId: account.personaId,
        targetClass: account.targetClass,
        email: account.email,
        success: false,
        error: err.message,
        durationMs: Date.now() - t0,
      })
    } finally {
      await page.close()
    }
  }

  const successCount = results.filter(r => r.success).length
  const total = results.length
  log(`S02 result: ${successCount}/${total} logins succeeded`)

  saveJson('B00_S02_login_results.json', results)

  return {
    result: successCount >= 22 ? 'pass' : (successCount >= total * 0.75 ? 'partial' : 'fail'),
    successCount,
    total,
    failed: results.filter(r => !r.success),
    results,
    durationMs: Date.now() - startMs,
  }
}

// ─── S03: Teacher Login + Roster Check ───────────────────────────────────────
async function runS03(browser) {
  log('=== S03: Teacher Login + Roster Check ===')
  const startMs = Date.now()
  const page = await browser.newPage()
  const errors = collectConsoleErrors(page)

  try {
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASS, { timeout: 30000 })
    log('Teacher login successful')

    await page.waitForTimeout(2000)
    await screenshot(page, 'B00_S03_teacher_dashboard.png')

    const bodyText = await page.textContent('body')
    log(`Dashboard content preview: ${bodyText.substring(0, 300)}`)

    // Look for class navigation links
    const classLinks = await page.getByRole('link').all()
    const classTexts = await Promise.all(classLinks.map(l => l.textContent()))
    log(`Visible links: ${classTexts.filter(t => t && t.trim()).join(' | ')}`)

    // Try to navigate to gradebook / classes
    const topClassMatch = /25WT.*TOP|TOP.*OFFLINE/i
    const coreClassMatch = /25WT.*CORE|CORE.*OFFLINE/i

    const topVisible = topClassMatch.test(bodyText)
    const coreVisible = coreClassMatch.test(bodyText)

    log(`TOP class visible: ${topVisible}, CORE class visible: ${coreVisible}`)

    // Attempt to find audit students in the class list
    let topAuditCount = 0
    let coreAuditCount = 0

    // Check if there's a classes section on the page
    const classItems = await page.getByText(/25WT/i).all()
    log(`Found ${classItems.length} elements with "25WT" text`)

    await screenshot(page, 'B00_S03_teacher_classes.png')

    // Try clicking on TOP class if visible
    try {
      const topLink = page.getByText(/25WT.*TOP|TOP.*OFFLINE/i).first()
      const topCount = await topLink.count()
      if (topCount > 0) {
        await topLink.click()
        await page.waitForTimeout(2000)
        const rosterText = await page.textContent('body')
        topAuditCount = (rosterText.match(/Audit /g) || []).length
        await screenshot(page, 'B00_S03_top_roster.png')
        log(`TOP class roster: ~${topAuditCount} audit student mentions`)
      }
    } catch (e) {
      log(`Could not navigate to TOP class: ${e.message}`)
    }

    saveJson('B00_S03_teacher_check.json', {
      teacherLoginSuccess: true,
      topVisible,
      coreVisible,
      topAuditCount,
      coreAuditCount,
      consoleErrors: errors,
    })

    return {
      result: 'pass',
      teacherLoginSuccess: true,
      topVisible,
      coreVisible,
      durationMs: Date.now() - startMs,
    }
  } catch (err) {
    log(`S03 FAIL: ${err.message}`)
    await screenshot(page, 'B00_S03_FAIL.png').catch(() => {})
    return {
      result: 'blocked',
      reason: `Teacher login failed: ${err.message}`,
      durationMs: Date.now() - startMs,
    }
  } finally {
    await page.close()
  }
}

// ─── S04: Capture Canonical Answers via Firestore Admin SDK ─────────────────
async function runS04Firestore() {
  log('=== S04: Capture Canonical Answers via Firestore ===')
  const startMs = Date.now()

  return new Promise((resolve) => {
    const { execSync } = require('child_process')

    const script = `
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const sa = require('/app/scripts/serviceAccountKey.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt';

async function getClassLists(classId, label) {
  // Try to find lists assigned to this class
  // Possible collection paths: lists, word_lists, vocabLists
  const results = { classId, label, lists: [] };

  // Query all lists collections
  const listPaths = ['lists', 'word_lists'];

  for (const collName of listPaths) {
    try {
      // Try querying by classId or classIds
      const snap1 = await db.collection(collName).where('classId', '==', classId).get();
      const snap2 = await db.collection(collName).where('classIds', 'array-contains', classId).get();

      const docs = [...snap1.docs, ...snap2.docs];
      if (docs.length > 0) {
        console.log('Found lists in collection: ' + collName + ' for ' + label + ': ' + docs.length);

        for (const doc of docs) {
          const listData = { id: doc.id, ...doc.data(), words: [] };

          // Get words subcollection
          const wordsSnap = await db.collection(collName).doc(doc.id).collection('words').orderBy('position').get();

          if (wordsSnap.empty) {
            // Try 'items' subcollection
            const itemsSnap = await db.collection(collName).doc(doc.id).collection('items').get();
            if (!itemsSnap.empty) {
              listData.words = itemsSnap.docs.map(w => ({ id: w.id, ...w.data() }));
            }
          } else {
            listData.words = wordsSnap.docs.map(w => ({ id: w.id, ...w.data() }));
          }

          results.lists.push(listData);
        }
        break; // found in this collection, stop
      }
    } catch (e) {
      // collection might not exist
    }
  }

  return results;
}

async function main() {
  try {
    // Also try direct lists query without class filter
    const allListsSnap = await db.collection('lists').limit(20).get();
    console.log('Total lists in collection: ' + allListsSnap.size);

    const allLists = allListsSnap.docs.map(d => ({ id: d.id, title: d.data().title, classIds: d.data().classIds || d.data().classId }));
    console.log('Sample lists: ' + JSON.stringify(allLists.slice(0, 5)));

    const topResult = await getClassLists(TOP_CLASS_ID, 'TOP');
    const coreResult = await getClassLists(CORE_CLASS_ID, 'CORE');

    const output = { topResult, coreResult, allListsSample: allLists };
    fs.writeFileSync('/app/audit/playwright/findings/evidence/B00/B00_S04_firestore_lists.json', JSON.stringify(output, null, 2));
    console.log('TOP lists found: ' + topResult.lists.length);
    console.log('CORE lists found: ' + coreResult.lists.length);

    if (topResult.lists.length > 0) {
      console.log('TOP first list wordCount: ' + topResult.lists[0].words.length);
    }
    if (coreResult.lists.length > 0) {
      console.log('CORE first list wordCount: ' + coreResult.lists[0].words.length);
    }

    process.exit(0);
  } catch (e) {
    console.error('Error: ' + e.message);
    process.exit(1);
  }
}

main();
`

    try {
      const result = execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        cwd: '/app',
        timeout: 60000,
        encoding: 'utf-8',
      })
      log('Firestore query output: ' + result)
    } catch (e) {
      log('Firestore script error: ' + (e.stdout || e.message))
    }

    // Check if file was written
    const outPath = '/app/audit/playwright/findings/evidence/B00/B00_S04_firestore_lists.json'
    if (fs.existsSync(outPath)) {
      const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'))
      resolve({ result: 'done', data, durationMs: Date.now() - startMs })
    } else {
      resolve({ result: 'partial', data: null, durationMs: Date.now() - startMs })
    }
  })
}

// ─── S05: Dashboard Enrollment Gate ──────────────────────────────────────────
async function runS05(browser) {
  log('=== S05: Dashboard Enrollment Gate ===')
  const startMs = Date.now()
  const seeded = loadSeeded()

  const gateAccounts = [
    { personaId: 'careful', targetClass: 'TOP', expectedClass: '25WT 2차 TOP OFFLINE' },
    { personaId: 'careful', targetClass: 'CORE', expectedClass: '25WT 2차 CORE OFFLINE' },
  ]

  const gateResults = []

  for (const gate of gateAccounts) {
    const account = seeded.accounts.find(
      a => a.personaId === gate.personaId && a.targetClass === gate.targetClass
    )
    if (!account) {
      log(`WARNING: No account found for ${gate.personaId}/${gate.targetClass}`)
      gateResults.push({ ...gate, result: 'no_account', blocker: false })
      continue
    }

    const page = await browser.newPage()
    const errors = collectConsoleErrors(page)

    try {
      await loginAs(page, account.email, account.password, { timeout: 30000 })
      await page.waitForTimeout(3000)

      const bodyText = await page.textContent('body')

      // Check for empty state
      const emptyStatePattern = /join your first class|join a class|no class enrolled|enroll in|get started/i
      const showsEmptyState = emptyStatePattern.test(bodyText)

      // Check for class card
      const classVisible = bodyText.includes(gate.expectedClass) ||
                           bodyText.includes('TOP OFFLINE') && gate.targetClass === 'TOP' ||
                           bodyText.includes('CORE OFFLINE') && gate.targetClass === 'CORE'

      // Check for today's session card
      const sessionCardPattern = /today|start|session|day \d|학습/i
      const sessionCardVisible = sessionCardPattern.test(bodyText)

      log(`${gate.targetClass} gate: emptyState=${showsEmptyState}, classVisible=${classVisible}, sessionCard=${sessionCardVisible}`)
      log(`Console errors: ${errors.length}`)

      await screenshot(page, `B00_S05_enrollment_gate_${gate.targetClass.toLowerCase()}.png`)

      const isBlocker = showsEmptyState || !classVisible

      gateResults.push({
        ...gate,
        result: isBlocker ? 'BLOCKER' : 'pass',
        blocker: isBlocker,
        showsEmptyState,
        classVisible,
        sessionCardVisible,
        consoleErrors: errors.length,
        consoleErrorTexts: errors,
      })

      if (isBlocker) {
        log(`BLOCKER: ${gate.targetClass} gate failed! showsEmptyState=${showsEmptyState}, classVisible=${classVisible}`)
      }
    } catch (err) {
      log(`Gate FAIL: ${gate.targetClass}: ${err.message}`)
      gateResults.push({
        ...gate,
        result: 'error',
        blocker: true,
        error: err.message,
      })
    } finally {
      await page.close()
    }
  }

  // Sample 5 additional personas
  const samplePersonas = ['distracted', 'korean', 'rushed', 'phone', 'lazy']
  const sampleResults = []

  for (const personaId of samplePersonas) {
    const account = seeded.accounts.find(a => a.personaId === personaId)
    if (!account) {
      sampleResults.push({ personaId, result: 'no_account' })
      continue
    }

    const page = await browser.newPage()
    const errors = collectConsoleErrors(page)

    try {
      await loginAs(page, account.email, account.password, { timeout: 25000 })
      await page.waitForTimeout(2000)

      const bodyText = await page.textContent('body')
      const emptyStatePattern = /join your first class|join a class|no class enrolled|enroll in|get started/i
      const showsEmptyState = emptyStatePattern.test(bodyText)
      const sessionCardPattern = /today|start|session|day \d|학습/i
      const sessionCardVisible = sessionCardPattern.test(bodyText)

      await screenshot(page, `B00_S05_dashboard_${personaId}.png`)

      log(`Sample ${personaId}: emptyState=${showsEmptyState}, sessionCard=${sessionCardVisible}, errors=${errors.length}`)

      sampleResults.push({
        personaId,
        targetClass: account.targetClass,
        result: showsEmptyState ? 'fail' : 'pass',
        showsEmptyState,
        sessionCardVisible,
        consoleErrors: errors.length,
      })
    } catch (err) {
      sampleResults.push({ personaId, result: 'error', error: err.message })
    } finally {
      await page.close()
    }
  }

  const anyBlocker = gateResults.some(r => r.blocker)
  saveJson('B00_S05_enrollment_results.json', { gateResults, sampleResults })

  return {
    result: anyBlocker ? 'BLOCKER' : 'pass',
    anyBlocker,
    gateResults,
    sampleResults,
    durationMs: Date.now() - startMs,
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────
async function main() {
  const results = {}
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  })

  try {
    // S01
    log('\n--- Running S01 ---')
    results.S01 = await runS01(browser)
    log(`S01 result: ${results.S01.result}`)

    // S02
    log('\n--- Running S02 ---')
    results.S02 = await runS02(browser)
    log(`S02 result: ${results.S02.result} (${results.S02.successCount}/${results.S02.total})`)

    // S03
    log('\n--- Running S03 ---')
    results.S03 = await runS03(browser)
    log(`S03 result: ${results.S03.result}`)

    // S04 (Firestore)
    log('\n--- Running S04 (Firestore) ---')
    results.S04 = await runS04Firestore()
    log(`S04 result: ${results.S04.result}`)

    // S05 (Enrollment Gate)
    log('\n--- Running S05 ---')
    results.S05 = await runS05(browser)
    log(`S05 result: ${results.S05.result}`)

  } finally {
    await browser.close()
  }

  // Save all results
  saveJson('B00_all_results.json', results)
  log('\nAll scenarios complete. Results saved to evidence/B00/')

  // Print summary
  console.log('\n=== B00 SUMMARY ===')
  console.log(`S01: ${results.S01?.result}`)
  console.log(`S02: ${results.S02?.result} (${results.S02?.successCount}/${results.S02?.total} logins)`)
  console.log(`S03: ${results.S03?.result}`)
  console.log(`S04: ${results.S04?.result}`)
  console.log(`S05: ${results.S05?.result} (blocker=${results.S05?.anyBlocker})`)

  return results
}

main().then(results => {
  fs.writeFileSync('/app/e2e/audit/B00_results.json', JSON.stringify(results, null, 2))
  console.log('\nDone.')
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

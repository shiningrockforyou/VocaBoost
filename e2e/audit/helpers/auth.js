/**
 * Authentication helper for the vocaBoost Playwright audit.
 *
 * Reads the pre-seeded accounts from audit/playwright/seeded_accounts.json
 * and exposes a single `loginAs(page, personaId, opts)` entry point.
 *
 * For teacher personas (noviceTeacher, powerTeacher, anxiousTeacher, etc.),
 * resolves to the Veterans TA proxy account.
 */

import { readFileSync, existsSync } from 'fs'
import { expect } from '@playwright/test'

const SEEDED_PATH = 'audit/playwright/seeded_accounts.json'

let _seededCache = null
function getSeeded() {
  if (_seededCache) return _seededCache
  if (!existsSync(SEEDED_PATH)) {
    throw new Error(`seeded_accounts.json missing at ${SEEDED_PATH}. Run scripts/seed-audit-students.js --apply first.`)
  }
  _seededCache = JSON.parse(readFileSync(SEEDED_PATH, 'utf-8'))
  return _seededCache
}

// Veterans TA proxy — all teacher persona requests resolve here.
// Credentials are documented in the chat log; not stored in seeded_accounts.
const TEACHER_PROXY = {
  email: 'veterans@vocaboost.com',
  password: 'veterans5944',
  displayName: 'Veterans TA',
  personaId: 'teacher',
  role: 'teacher',
}

const TEACHER_PERSONA_IDS = new Set([
  'teacher',
  'noviceTeacher',
  'powerTeacher',
  'anxiousTeacher',
])

/**
 * Look up a seeded account by persona id.
 * @param {string} personaId — e.g. 'careful', 'korean'
 * @param {{targetClass?: 'TOP'|'CORE', index?: number}} opts
 */
export function getAccount(personaId, opts = {}) {
  if (TEACHER_PERSONA_IDS.has(personaId)) {
    return TEACHER_PROXY
  }
  const seeded = getSeeded()
  let candidates = seeded.accounts.filter(a => a.personaId === personaId)
  if (opts.targetClass) {
    candidates = candidates.filter(a => a.targetClass === opts.targetClass)
  }
  if (candidates.length === 0) {
    throw new Error(`No seeded account for persona=${personaId} class=${opts.targetClass || 'any'}. Available personas: ${[...new Set(seeded.accounts.map(a => a.personaId))].join(', ')}`)
  }
  const idx = (opts.index || 1) - 1
  return candidates[idx] || candidates[0]
}

/**
 * List the IDs of every persona that has at least one seeded account.
 */
export function listAvailablePersonas() {
  const seeded = getSeeded()
  return [...new Set(seeded.accounts.map(a => a.personaId))].sort()
}

/**
 * Return the seeded class info for TOP or CORE.
 */
export function getClassInfo(classKey) {
  const seeded = getSeeded()
  return seeded.classes[classKey]
}

/**
 * Log in via the login form UI. Returns the account record used.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} personaId
 * @param {{targetClass?: 'TOP'|'CORE', index?: number, baseURL?: string}} opts
 */
export async function loginAs(page, personaId, opts = {}) {
  const account = getAccount(personaId, opts)
  const base = opts.baseURL || 'https://vocaboostone.netlify.app'

  // NOTE: a hard GET of `${base}/login` returns Netlify's 404 "Page not found" —
  // the SPA index fallback is not served for deep links. Warm the SPA at root,
  // then client-route to /login so React Router renders the login form.
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)

  // The submit button is labelled "Continue" (not "Log in"); pressing Enter on
  // the password field is label-agnostic. Fall back to the Continue button.
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i })
      .first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
  return account
}

/**
 * Hard sign-out via Firebase SDK on the window.
 * Useful between persona switches without depending on a sign-out button.
 */
export async function signOut(page) {
  await page.evaluate(async () => {
    try {
      const auth = window.firebase?.auth?.() || (await import('firebase/auth')).getAuth?.()
      if (auth?.signOut) await auth.signOut()
    } catch (e) {
      // swallow — best effort
    }
  })
  await page.context().clearCookies()
}

/**
 * Quick assertion: post-login, the dashboard must show a class card,
 * not the "join your first class" empty state. This is the B00 gate.
 */
export async function assertDashboardEnrolled(page, expectedClassNamePattern) {
  // Empty state would say something like "Join your first class". Fail if found.
  const emptyState = page.getByText(/join your first class|join a class|enroll/i)
  await expect(emptyState).toBeHidden({ timeout: 5000 }).catch(() => {
    throw new Error('Dashboard shows empty enrollment state. Run scripts/repair-audit-enrollments.js --apply and retry.')
  })
  // Positive assertion: the class card must be visible.
  await expect(page.getByText(expectedClassNamePattern)).toBeVisible({ timeout: 10000 })
}

/**
 * Evidence capture for batch findings.
 *
 * Writes screenshots, console logs, network HAR, and Firestore snapshots
 * to findings/evidence/B{XX}/.
 *
 * Naming convention: B{XX}_S{NN}_<descriptor>.{png,json,har}
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = 'audit/playwright/findings/evidence'

export function evidenceDir(batchId) {
  const dir = join(ROOT, batchId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Take a screenshot named B{XX}_S{NN}_{descriptor}.png.
 */
export async function screenshot(page, batchId, scenarioId, descriptor) {
  const dir = evidenceDir(batchId)
  const path = join(dir, `${batchId}_${scenarioId}_${descriptor}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}

/**
 * Start console + page-error capture for a scenario.
 * Returns a stop() function. Calling it writes the log to disk and returns the path.
 */
export function startConsoleCapture(page, batchId, scenarioId) {
  const messages = []
  const onConsole = msg => messages.push({
    ts: Date.now(),
    type: msg.type(),
    text: msg.text(),
    location: msg.location?.()
  })
  const onPageError = err => messages.push({
    ts: Date.now(),
    type: 'pageerror',
    text: err.message,
    stack: err.stack,
  })
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  return {
    stop: () => {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      const dir = evidenceDir(batchId)
      const path = join(dir, `${batchId}_${scenarioId}_console.log`)
      writeFileSync(path, messages.map(m => JSON.stringify(m)).join('\n'))
      return path
    },
    messages,
  }
}

/**
 * Start a network HAR for a scenario. Use via the Playwright test fixture (recordHar) OR
 * the explicit ContextOptions.recordHar — this helper exists to standardize the path.
 *
 * Returns the absolute path the HAR will be written to.
 */
export function harPath(batchId, scenarioId) {
  const dir = evidenceDir(batchId)
  return join(dir, `${batchId}_${scenarioId}_network.har`)
}

/**
 * Save a Firestore snapshot (from helpers/firestore.js).
 */
export function saveFirestoreSnapshot(batchId, scenarioId, descriptor, snapshot) {
  const dir = evidenceDir(batchId)
  const path = join(dir, `${batchId}_${scenarioId}_firestore_${descriptor}.json`)
  writeFileSync(path, JSON.stringify(snapshot, null, 2))
  return path
}

/**
 * Save a diff of two Firestore snapshots.
 */
export function saveSnapshotDiff(batchId, scenarioId, descriptor, diff) {
  const dir = evidenceDir(batchId)
  const path = join(dir, `${batchId}_${scenarioId}_diff_${descriptor}.json`)
  writeFileSync(path, JSON.stringify(diff, null, 2))
  return path
}

/**
 * Save localStorage state of the page (for testRecovery scenarios).
 */
export async function snapshotLocalStorage(page, batchId, scenarioId, descriptor) {
  const dir = evidenceDir(batchId)
  const state = await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)))
  const path = join(dir, `${batchId}_${scenarioId}_localStorage_${descriptor}.json`)
  writeFileSync(path, JSON.stringify(state, null, 2))
  return path
}

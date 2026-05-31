/**
 * Network-condition presets for hostile-environment scenarios.
 *
 * Use these instead of inline route handlers so the same condition is
 * reproducible across batches. All take a Playwright BrowserContext.
 */

import {
  routeFailFirestoreWritesNTimes,
  routeStallFirestoreWrites,
  routeFailAllFirestoreWrites,
  routeStallCloudFunctions,
  routeLatencyFirestore,
} from './firestore.js'

/**
 * Pure offline. Use context.setOffline(true).
 */
export async function applyOffline(context) {
  await context.setOffline(true)
}

export async function clearOffline(context) {
  await context.setOffline(false)
}

/**
 * Slow 3G — 800ms latency on every Firestore call.
 */
export async function applySlow3G(context) {
  await routeLatencyFirestore(context, 800)
}

/**
 * Academy WiFi — 800ms latency + 5% loss on Firestore (loss simulated as 503).
 */
export async function applyAcademyWifi(context) {
  await context.route('**/*.googleapis.com/**', (route, req) => {
    setTimeout(() => {
      if (Math.random() < 0.05) {
        route.fulfill({ status: 503, body: '{}' })
      } else {
        route.continue()
      }
    }, 800)
  })
}

/**
 * Intermittent — N alternating online/offline pulses.
 * Each pulse is `intervalMs` long.
 * NOTE: leaves the context in whatever state the last pulse set.
 */
export async function applyIntermittent(context, { pulses = 4, intervalMs = 5000 } = {}) {
  for (let i = 0; i < pulses; i++) {
    await context.setOffline(i % 2 === 0)
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

/**
 * First N Firestore writes fail with 503, then succeed. Use for withRetry verification.
 */
export async function failFirestoreWritesNTimes(context, n = 1) {
  await routeFailFirestoreWritesNTimes(context, n)
}

/**
 * All Firestore writes return 500. Use for "all retries exhausted" tests.
 */
export async function failAllFirestoreWrites(context) {
  await routeFailAllFirestoreWrites(context, 500)
}

/**
 * Stall Firestore writes forever — no response. Use for timeout / stuck-UI tests.
 */
export async function stallFirestoreWrites(context) {
  await routeStallFirestoreWrites(context)
}

/**
 * Stall AI grading Cloud Function. Use for B03 / B26.
 */
export async function stallCloudFunctions(context) {
  await routeStallCloudFunctions(context)
}

/**
 * Throttle CPU 4× (slow-laptop persona). Uses CDP.
 * Requires a CDPSession; pass page.context().newCDPSession(page).
 */
export async function applyCpuThrottle4x(client) {
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

export async function clearCpuThrottle(client) {
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
}

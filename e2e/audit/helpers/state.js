/**
 * Per-agent activity logging.
 *
 * Each agent owns its own `findings/agent_logs/<label>.jsonl` (append-only)
 * and `findings/agent_logs/<label>.status.json` (overwritten).
 *
 * The orchestrator (main session) reads all of these and produces SUMMARY.md,
 * RECOMMENDATIONS.md, EVIDENCE_INDEX.md. Agents NEVER touch the orchestrator's
 * outputs or audit_state.json.
 */

import { appendFileSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const LOG_ROOT = 'audit/playwright/findings/agent_logs'

let _label = null
let _logPath = null
let _statusPath = null
let _trials = 0
let _batchesCompleted = []
let _claim = []

export function init(label, claim = []) {
  mkdirSync(LOG_ROOT, { recursive: true })
  _label = label
  _logPath = join(LOG_ROOT, `${label}.jsonl`)
  _statusPath = join(LOG_ROOT, `${label}.status.json`)
  _claim = claim
  _trials = 0
  _batchesCompleted = []
  appendEvent({ event: 'agent_start', label, claim })
  writeStatus({ state: 'running', currentBatch: null })
}

export function appendEvent(event) {
  if (!_logPath) throw new Error('helpers/state.js not init()ed. Call init(label) at agent start.')
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  appendFileSync(_logPath, line + '\n')
}

export function batchStart(batchId) {
  appendEvent({ event: 'batch_start', batch: batchId })
  writeStatus({ state: 'running', currentBatch: batchId })
}

export function scenarioDone(batchId, scenarioId, result, extra = {}) {
  _trials++
  appendEvent({ event: 'scenario', batch: batchId, scenario: scenarioId, result, ...extra })
  writeStatus({ state: 'running', currentBatch: batchId, currentScenario: scenarioId })
}

export function batchEnd(batchId, counts) {
  _batchesCompleted.push(batchId)
  appendEvent({ event: 'batch_end', batch: batchId, ...counts })
  writeStatus({ state: 'running' })
}

export function agentEnd(state = 'finished', reason = '') {
  appendEvent({ event: 'agent_end', label: _label, trialsCompleted: _trials, batchesCompleted: _batchesCompleted, state, reason })
  writeStatus({ state })
}

export function writeStatus({ state, currentBatch = null, currentScenario = null }) {
  if (!_statusPath) return
  const status = {
    label: _label,
    state,
    currentBatch,
    currentScenario,
    batchesClaimed: _claim,
    batchesCompleted: _batchesCompleted,
    trialsCompleted: _trials,
    lastUpdate: new Date().toISOString(),
  }
  writeFileSync(_statusPath, JSON.stringify(status, null, 2))
}

/**
 * Look up other agents' claims so this agent doesn't double-run a batch.
 */
export function getOtherAgentClaims() {
  if (!existsSync(LOG_ROOT)) return []
  const out = []
  const fs = require('fs')
  for (const f of fs.readdirSync(LOG_ROOT)) {
    if (!f.endsWith('.status.json')) continue
    const status = JSON.parse(readFileSync(join(LOG_ROOT, f), 'utf-8'))
    if (status.label !== _label) {
      out.push(status)
    }
  }
  return out
}

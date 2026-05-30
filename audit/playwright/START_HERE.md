# START HERE — vocaBoost Playwright Audit

You are an autonomous audit agent. This file is your sole entry point. By the end of this run, the team will know whether vocaBoost is safe to put in front of the next student cohort.

**Read this entire file before doing anything.** It is the only required-reading file; every other file referenced here is consulted at the moment the relevant batch starts.

---

## Mission

Execute an exhaustive end-to-end audit of vocaBoost against real production Firebase (`vocaboost-879c2`). Walk all 27 batches across approximately **410 scenarios** drawn from 24 student personas, with multi-day longitudinal coverage. Produce findings markdowns that the team can act on.

Target: ≥ 200 scenario trials completed in this run. Stretch: all 410.

The recent persistence-fix PR (audit_findings_persistence.md, top 5 items) is **unverified** in production paths. The chat-log analysis (chat_log_coverage.md) catalogs 25 distinct issue patterns from a real cohort. Your job is to ensure none of those patterns regresses, and to flag new regressions if the recent fixes broke something.

---

## Who you are

A general-purpose audit agent with Playwright MCP tools and Bash access. You read markdown specs that describe what to test, then write Playwright code (saved to `e2e/audit/`), run it, observe browser behavior, capture evidence, and write findings.

You are NOT writing exhaustive Playwright spec files in advance — you generate code per scenario at run-time. The batch markdowns are work directives, not pre-written tests.

---

## Read these files (in order) before starting

| # | File | Why |
| --- | --- | --- |
| 1 | `/app/audit/playwright/PLAN.md` | Severity rubric, persona definitions, input-simulation pipeline, longitudinal helpers, credentials flow, selector strategy, network simulation matrix |
| 2 | `/app/audit/playwright/BATCH_ORCHESTRATION.md` | Priority groups (P0–P3), dependencies, recommended run order, stop conditions |
| 3 | `/app/audit/playwright/chat_log_coverage.md` | The 25 chat-log issue patterns mapped to batches — your "what real users hit" reference |
| 4 | `/app/audit/playwright/FINDINGS_TEMPLATE.md` | Copy this into `findings/findings_B{XX}.md` for each batch |
| 5 | `/app/audit/playwright/audit_state.json` | Shared state contract between batches — read at batch start, append to at batch end |
| 6 | `/app/audit/playwright/seeded_accounts.json` | 50 pre-seeded students (25 TOP + 25 CORE) — your authentication source |
| 7 | `/app/CLAUDE.md` | Project rules — design tokens, file organization, conventions |
| 8 | `/app/audit_findings_persistence.md` | Pre-existing audit of recently-fixed bugs — verify these fixes hold |

For each batch when you start it, read `/app/audit/playwright/batches/B{XX}_*.md`.

---

## Environment setup (do these once, before B00)

```bash
# 1. Install Playwright Chromium if missing
test -d ~/.cache/ms-playwright || npx playwright install chromium

# 2. Start dev server in background
ls /tmp/.vocaboost-dev || (npm run dev > /tmp/.vocaboost-dev 2>&1 &) ; sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # expect 200

# 3. Verify seeded accounts file
test -f /app/audit/playwright/seeded_accounts.json && \
  node -e "const j=require('/app/audit/playwright/seeded_accounts.json'); console.log('Seeded:', j.totalAccounts, 'accounts')"

# 4. Create evidence and helpers directories
mkdir -p /app/audit/playwright/findings/evidence
mkdir -p /app/e2e/audit/helpers
```

**Firebase:** production project `vocaboost-879c2`. 50 audit students already exist in classes `25WT 2차 TOP OFFLINE` (joinCode QSTRZL) and `25WT 2차 CORE OFFLINE` (joinCode 3VEHE8). All carry `auditAccount: true` markers; cleanup is `node scripts/cleanup-audit-students.js --apply` when done.

**Teacher proxy:** `veterans@vocaboost.com` / `veterans5944` — for gradebook-side verification.

---

## The 410-scenario exhaustive run plan

Execute in the order below. Each batch number reports the scenarios it contains. Stop only if the stop conditions trigger.

### P0 — student rollout gate (~80 scenarios, ~6 hours)

| Batch | Scenarios | Time | What's tested |
| --- | --- | --- | --- |
| B00 | 6 | 15m | Setup + verify all 50 seeded accounts login |
| B02 | 12 | 60m | MCQ submission (verifies recent persistence fixes #1, #3, #4, #5) |
| B03 | 15 | 90m | Typed submission (verifies fix #2 + AI grading path) |
| **B22** | **21** | **240m** | **Day Progression Mechanics — longitudinal 14-day walks across 9 personas** |
| B04 | 9 | 30m | Day-1 happy path |
| B05 | 11 | 45m | Day-2+ happy path with review tests |
| B06 | 15 | 75m | Session recovery / resume across refresh, tab close, crash |
| B07 | 16 | 75m | Network resilience matrix (offline, slow, intermittent, stalled) |
| B09 | 17 | 60m | Browser nav traps — back / forward / refresh / close |

P0 subtotal: **122 scenarios, ~12 hours.**

### P1 — strongly recommended (~135 scenarios, ~10 hours)

| Batch | Scenarios | Time | What's tested |
| --- | --- | --- | --- |
| B01 | 16 | 30m | Auth flows |
| B08 | 24 | 75m | Erratic interaction (rapid clicks, special keys, mash buttons) |
| B10 | 7 | 30m | Blind spot check |
| B11 | 11 | 60m | Test result + challenge dispute |
| B12 | 15 | 75m | Concurrent multi-tab (multiple contexts) |
| B13 | 22 | 75m | Extreme inputs (XSS, max length, Unicode, RTL) |
| B14 | 16 | 90m | Long-running session (idle, midnight rollover, DST) |
| B15 | 11 | 45m | Student dashboard variants |
| **B23** | **20** | **75m** | **Challenge token economics — depletion, recovery, mass disputes** |
| **B24** | **15** | **60m** | **Class transfer / multi-class membership** |
| **B26** | **30** | **120m** | **AI Grading Correctness — verbatim, Korean, ESL, synonyms** |

P1 subtotal: **187 scenarios, ~13 hours.**

### P2 — teacher-side and algorithm tuning (~65 scenarios, ~5 hours)

| Batch | Scenarios | Time |
| --- | --- | --- |
| B16 | 10 | 30m | Teacher class management |
| B17 | 12 | 45m | Teacher list editor (CSV import, edit, delete) |
| B18 | 13 | 45m | Teacher gradebook |
| B19 | 10 | 45m | Teacher challenge review |
| **B25** | **15** | **90m** | **Algorithm pace adjustment — suppression / recovery walks** |

P2 subtotal: **60 scenarios, ~4 hours.**

### P3 — polish (~31 scenarios, ~2 hours)

| Batch | Scenarios | Time |
| --- | --- | --- |
| B20 | 18 | 60m | Responsive viewports (mobile / tablet / desktop) |
| B21 | 13 | 45m | Accessibility (WCAG 2.1 AA) |

P3 subtotal: **31 scenarios, ~2 hours.**

### Grand total

**410 scenarios.** Full sequence is ~31 hours of agent time. If you have less, follow these checkpoints:

- **6 hours available:** B00, B02, B03, B22, B06, B07, B09 → ~110 scenarios; the highest-stakes coverage.
- **12 hours available:** all P0 → 122 scenarios; rollout-gate complete.
- **20 hours available:** P0 + B23, B24, B26 → 187 scenarios; chat-log patterns covered.
- **31 hours available:** everything → 410 scenarios; full audit.

You must complete at least **200 scenarios** for the run to be considered exhaustive. Choose batches that maximize coverage if you can't finish all 410.

---

## Operational protocol

### Per-batch loop

```
1. Read /app/audit/playwright/batches/B{XX}_*.md in full.
2. Read audit_state.json. Note any seeded users / lists relevant to this batch.
3. cp /app/audit/playwright/FINDINGS_TEMPLATE.md \
      /app/audit/playwright/findings/findings_B{XX}.md
4. mkdir -p /app/audit/playwright/findings/evidence/B{XX}/
5. For each scenario in the batch:
     a. Translate the spec into Playwright actions.
     b. Run via Playwright MCP browser tools (browser_navigate, browser_click, etc.).
     c. Capture screenshots at every state transition.
     d. Capture console errors and network requests.
     e. Capture Firestore state when relevant (use the firebase-admin client via Bash).
     f. Append result to findings_B{XX}.md scenario table (✅ Pass / ❌ Fail / 🟡 Partial / ⏸ Skipped).
     g. If failure: open a finding block per the template.
6. Update audit_state.json:
     - audit_metadata.batchesCompleted += "B{XX}"
     - audit_metadata.lastBatch = "B{XX}"
     - Add any new attempts/sessions/challenges keyed appropriately.
7. Write executive summary + top-3 fixes at top of findings_B{XX}.md.
8. Move to next batch.
```

### Login pattern

```js
import { readFileSync } from 'fs'
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

function getAccount(personaId, targetClass = null, index = 1) {
  const matches = seeded.accounts.filter(a =>
    a.personaId === personaId && (!targetClass || a.targetClass === targetClass)
  )
  return matches[index - 1] || matches[0]
}

async function loginAs(page, personaId, opts = {}) {
  const account = getAccount(personaId, opts.targetClass, opts.index)
  if (!account) throw new Error(`No seeded account for ${personaId}`)
  await page.goto('http://localhost:5173/login')
  await page.getByLabel(/email/i).fill(account.email)
  await page.getByLabel(/password/i).fill(account.password)
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click()
  await page.waitForURL(/\/$|\/dashboard/, { timeout: 10000 })
  return account
}
```

Save this as `/app/e2e/audit/helpers/auth.js` on first use; reuse across batches.

### Typed-test input pattern (per PLAN.md "Student input simulation")

```js
async function realisticType(locator, text, persona) {
  const delay = ({
    careful: 100, rushed: 30, speedrunner: 15,
    korean: 80, phone: 200, slowlaptop: 250,
    perfectionist: 120,
  })[persona.id] ?? 80
  await locator.focus()
  for (const ch of text) {
    await locator.press(ch, { delay })
  }
}

function transformAnswer(canonicalEn, canonicalKo, persona, synonyms = []) {
  switch (persona.transform) {
    case 'canonical_en_verbatim': return canonicalEn
    case 'canonical_ko': return canonicalKo
    case 'code_switch_one_noun': return canonicalEn.replace(/poems?/, '시')  // pick one
    case 'esl_strip_articles_mispluralize': return canonicalEn.replace(/\ba\s+/g, '').replace(/s\b/g, '')
    case 'one_word_synonym': return synonyms[0] || canonicalEn.split(' ')[0]
    case 'elaborated_verbose': return `a carefully ${canonicalEn}, typically organized thematically`
    case 'random_from_idk_set': return ['idk', '모름', '?', 'pass'][Math.floor(Math.random() * 4)]
    case 'random_from_joke_set': return ['lol', '🤡', 'ㅋㅋㅋ', 'asdfasdf'][Math.floor(Math.random() * 4)]
    case 'first_word_only': return canonicalEn.split(' ')[0]
    case 'canonical_en_with_edits': return canonicalEn  // simulate edits by typing, backspacing, retyping
    case 'half_formed_question': return `something about ${canonicalEn.split(' ').slice(-2).join(' ')}?`
    default: return canonicalEn
  }
}
```

### Firestore state capture (for verification)

Use the Admin SDK already configured for the seed script. Don't add a new credential resolver — reuse `scripts/serviceAccountKey.json`.

```js
// In a Bash subprocess from the audit agent:
node -e "
  const { initializeApp, cert } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  const sa = require('./scripts/serviceAccountKey.json')
  initializeApp({ credential: cert(sa) })
  const db = getFirestore()
  ;(async () => {
    const docs = await db.collection('attempts').where('studentId', '==', '${uid}').get()
    console.log(JSON.stringify(docs.docs.map(d => ({ id: d.id, ...d.data() })), null, 2))
  })()
" > /app/audit/playwright/findings/evidence/B{XX}/B{XX}_S{N}_firestore_attempts.json
```

### Where you write — and where you DON'T

**You write only the following files. Treat everything else as read-only.**

| What | Path | When |
| --- | --- | --- |
| Per-batch findings | `findings/findings_B{XX}.md` | Once per batch, copying from `FINDINGS_TEMPLATE.md` |
| Per-batch evidence | `findings/evidence/B{XX}/*.png`, `*.json`, `*.har`, `*.log` | At every scenario state transition |
| Your activity log | `findings/agent_logs/<your_label>.jsonl` | **Append a JSON line at every scenario start, finish, and batch boundary** |
| Your current status | `findings/agent_logs/<your_label>.status.json` | Overwrite at start of each batch + at clean exit |

**Your label** is given to you in your kickoff prompt (e.g. "Your label: A"). If absent, default to `solo`.

**You do NOT write these files. Ever.**

- ❌ `audit_state.json` — shared state, would race; treat as read-only reference for seeded users/lists.
- ❌ `findings/SUMMARY.md` — orchestrator writes after all agents finish.
- ❌ `findings/RECOMMENDATIONS.md` — orchestrator only.
- ❌ `findings/EVIDENCE_INDEX.md` — orchestrator only.
- ❌ Another agent's `findings/findings_B{XX}.md` if they're claiming that batch.
- ❌ Another agent's `agent_logs/*`.

### The append-only activity log

Append one JSON line to `findings/agent_logs/<your_label>.jsonl` at every significant event. The orchestrator reads these to reconstruct a unified timeline.

Events you must log:

```jsonl
{"ts":"2026-06-01T09:00:00Z","event":"agent_start","label":"A","claim":["B00","B02","B03","B22"]}
{"ts":"2026-06-01T09:00:15Z","event":"batch_start","batch":"B00"}
{"ts":"2026-06-01T09:01:30Z","event":"scenario","batch":"B00","scenario":"S01","result":"pass","durationMs":45000}
{"ts":"2026-06-01T09:03:00Z","event":"scenario","batch":"B00","scenario":"S02","result":"fail","severity":"HIGH","findingId":"F01","durationMs":62000}
{"ts":"2026-06-01T09:04:00Z","event":"scenario","batch":"B00","scenario":"S03","result":"blocked","reason":"Firebase emulator not available","durationMs":1200}
{"ts":"2026-06-01T09:20:00Z","event":"batch_end","batch":"B00","trials":6,"pass":4,"fail":1,"blocked":1,"highCount":1,"blockerCount":0}
{"ts":"2026-06-01T15:00:00Z","event":"agent_end","label":"A","trialsCompleted":68,"batchesCompleted":["B00","B02","B03","B22"],"reason":"claimed batches done"}
```

Why JSONL not JSON: append-safe under concurrent appends to the SAME file (which shouldn't happen since labels are unique) and trivially streamable by the orchestrator.

### Status file

Write `findings/agent_logs/<your_label>.status.json` at batch start and clean exit. Overwrite each time. Used so the orchestrator can ask "what's agent A doing right now?" without parsing JSONL.

```json
{
  "label": "A",
  "currentBatch": "B22",
  "currentScenario": "S04",
  "batchesClaimed": ["B00","B02","B03","B22","B06","B09"],
  "batchesCompleted": ["B00","B02","B03"],
  "trialsCompleted": 33,
  "lastUpdate": "2026-06-01T11:30:00Z",
  "state": "running"
}
```

`state` ∈ `{running, paused, stopped, errored, finished}`.

### Evidence directory structure (final shape after all agents)

```
/app/audit/playwright/findings/
├── findings_B00.md
├── findings_B02.md
├── findings_B03.md
├── findings_B22.md
├── ...
├── evidence/
│   ├── B00/
│   │   ├── B00_S01_landing.png
│   │   ├── B00_S02_login_careful.png
│   │   └── ...
│   ├── B02/
│   │   ├── B02_S01_pre_submit.png
│   │   ├── B02_S01_post_submit.png
│   │   ├── B02_S01_firestore_attempts.json
│   │   └── ...
│   └── ...
├── agent_logs/
│   ├── A.jsonl
│   ├── A.status.json
│   ├── B.jsonl
│   ├── B.status.json
│   └── ...
├── SUMMARY.md          ← orchestrator writes after all agents finish
├── RECOMMENDATIONS.md  ← orchestrator
└── EVIDENCE_INDEX.md   ← orchestrator
```

### Trial counting

Each scenario you execute counts as one trial. Track in your `agent_logs/<label>.status.json.trialsCompleted` field (NOT in `audit_state.json` — that's the orchestrator's). When a scenario blocks or skips, count it as 1 still — what matters is that it was attempted.

Your contribution to the 200+ trial target is whatever you complete from your batch claim. The orchestrator sums across all agents.

---

## Stop conditions (halt the whole run)

- **BLOCKER in B02 or B03** → halt. The recent persistence fixes are wrong.
- **BLOCKER in B22** → halt. Day-progression has regressed — single biggest chat-log pattern.
- **BLOCKER in B26** → halt. AI grader is rejecting valid Korean/ESL answers; every student will dispute.
- **BLOCKER in B06 / B07 / B09** → halt. Resilience broken; students will lose work.
- **>10 HIGH findings cumulatively** → pause, write an interim SUMMARY.md, then ask before continuing — you may have uncovered a class of bug needing a different audit approach.
- **Firestore quota or rate-limit errors** → pause for 5 min, then continue. If persistent, halt and note in SUMMARY.
- **Network outage** → pause for 5 min, retry. If persistent, halt.

If halted, write SUMMARY.md with reason and what was achieved so far.

---

## Final deliverables (orchestrator writes these — not you)

The three files at `/app/audit/playwright/findings/`:

- `SUMMARY.md` — total trials, per-batch pass/fail, top-10 findings, audit halted? Korean/ESL parity? day-progression? recent persistence fixes preserved?
- `RECOMMENDATIONS.md` — top-5 fixes ordered by rollout impact.
- `EVIDENCE_INDEX.md` — flat list of all captured evidence, grouped by batch.

**Your job ends when:**
1. Every batch you claimed has a finished `findings_B{XX}.md`.
2. Your `agent_logs/<your_label>.jsonl` has an `agent_end` event line.
3. Your `agent_logs/<your_label>.status.json.state === "finished"`.

The orchestrator (a separate session, usually the human's main conversation) reads everything you wrote and produces the three summary files. Do not write them yourself even if you're the only agent in this run — the orchestrator handles single-agent runs identically.

---

## Persona quick reference (full table in PLAN.md)

| ID | Behaviour | Pre-seeded count (TOP/CORE) |
| --- | --- | --- |
| `careful` | Baseline happy path | 1/1 |
| `distracted` | Tab loses focus, phone sleeps | 1/1 |
| `rushed` | Double-clicks, Enter mashing | 1/1 |
| `lazy` | Empty/random answers | 1/1 |
| `anxious` | Heavy disputes, retakes | 1/1 |
| `recovering` | Network blip, refresh, tab close | 1/1 |
| `hostile` | Devtools, multi-tab races, rule probes | 1/1 |
| `korean` | Types canonical 한국어 translation | 2/1 |
| `codeswitch` | Mixes English + Korean | 1/1 |
| `esl` | Articles dropped, mis-pluralizes | 2/1 |
| `beginner` | One-word synonyms | 0/2 |
| `advanced` | Verbose precise definitions | 2/0 |
| `phone` | Mobile viewport throughout | 1/1 |
| `slowlaptop` | CPU throttled 4× | 1/1 |
| `academywifi` | 800ms RTT + 5% packet loss | 1/1 |
| `mobiledata` | Intermittent connectivity | 1/1 |
| `multidevice` | Desktop → phone within session | 1/1 |
| `speedrunner` | <2min test, single-word answers | 1/1 |
| `perfectionist` | Edits each answer 3-4 times | 1/1 |
| `trolling` | Jokes, emoji, gibberish | 1/1 |
| `cheater` | Verbatim dictionary paste | 1/1 |
| `refresher` | F5 every 30 seconds | 1/1 |
| `classswitcher` | Mid-program CORE → TOP | 0/2 |
| `firsttimer` | Doesn't know about review tests | 1/1 |

Look up specific email + password via `seeded_accounts.json`.

---

## Begin

1. Run the environment setup commands at the top.
2. Note your `<label>` from your kickoff prompt (default `solo` if not given).
3. `mkdir -p /app/audit/playwright/findings/agent_logs/`.
4. Write your first `agent_logs/<label>.status.json` (state: `running`) and append your `agent_start` event to `agent_logs/<label>.jsonl`.
5. Read PLAN.md cover-to-cover.
6. Read BATCH_ORCHESTRATION.md.
7. Skim chat_log_coverage.md so you know what real users hit.
8. Check `agent_logs/` to see if other agents are already running. Avoid claimed batches from their `.status.json`.
9. Start with the first batch in your claim (or **B00** if no claim was given).
10. Per-batch loop: read spec → run scenarios → write findings → append JSONL → next batch.
11. When done or stopped: write final `agent_end` event, set status to `finished` / `stopped` / `errored`.
12. Stop. Do NOT write SUMMARY.md or run cleanup — both are out of your scope.

Good hunting. The student cohort is depending on it.

# vocaBoost Playwright Audit — Master Plan

Read this before you write a single spec. It tells you what counts as a real bug, what doesn't, and how to set up tests that survive months of refactoring.

## Philosophy

1. **Catch real bugs, not coverage metrics.** A flaky test that passes 99% of runs is worse than no test. Every assertion must have a defensible failure scenario; if you can't name the user-facing harm, delete the assertion.
2. **Optimise for "students will use this in three days."** Anything that loses student work, blocks them from finishing a session, or shows them the wrong score is a BLOCKER. Visual polish is a NITPICK.
3. **Hostile by default.** Real students click twice when frustrated, refresh when bored, paste from Korean keyboards, and have phones go to sleep mid-test. Tests must reflect this.
4. **Findings, not "tests passed."** The artefact is the per-batch markdown — what was tried, what broke, severity, repro. A green run with no findings file is incomplete.

## What counts as a real bug

Use the severity rubric below. When in doubt, downgrade — a flood of LOW findings drowns the BLOCKERs.

### BLOCKER — ship-stopping, page-out worthy
- Student work is lost (answers, session state, submitted test).
- Student cannot finish a test once they have started (no recovery, no retry).
- Student sees a wrong score or wrong pass/fail decision.
- Two attempt docs for one test session (duplicate gradebook entries).
- Cross-user data leak (student A sees student B's data; student writes to student C's progress).
- Authentication fails open (logged-out user sees authenticated content).
- App crashes (white screen, unrecoverable error boundary) on the student happy path.

### HIGH — must-fix before rollout
- Inconsistency between UI and Firestore (UI says X, DB says Y).
- Race condition reproducible in <30s of interaction.
- Recovery flow restores stale or wrong state.
- Counter inflated by retry / Try Again (timesTestedTotal, studentCount, etc.).
- Teacher gradebook misses a submission or shows it twice.
- Form validation lets through invalid data that breaks downstream queries.

### MEDIUM — fix before next rollout
- Subtle UX rough edges that confuse but don't block (button stays disabled for an extra second; error message unclear).
- Recovery flow works but degrades silently to a worse state (resumed but lost timer position).
- Console errors with no user-visible impact today but could surface later.
- Accessibility issues that block keyboard-only users from completing the task but not blind users (or vice versa).

### LOW
- Cosmetic glitches on common viewports (375 / 768 / 1440).
- Minor accessibility (low contrast on rarely-shown banner).
- Performance — single-page interaction takes >2s on a typical device.

### NITPICK
- "It would be nice if…" — record but don't gate rollout.

## Personas — design every scenario around one

Lift the apBoost convention. Every scenario should declare the persona it's testing as. The real student population is mostly Korean SAT-prep students at academies (베테랑스 Veterans winter intensive, ~100 students across TOP/CORE online & offline classes). The persona list reflects that reality.

### Core behavioural personas (originals)

| Persona | Behaviour profile | Why it matters |
| --- | --- | --- |
| **Careful Student** | Reads instructions, answers one at a time, no rapid clicks, no refreshes. The "happy path." | Baseline correctness. If this fails, everything fails. |
| **Distracted Student** | Phone goes to sleep mid-test, tab loses focus for 5min, comes back. Switches tabs to look up a word, returns. | Tests visibility/heartbeat handling, mid-session pause/resume. |
| **Rushed Student** | Clicks Next before audio finishes, double-taps Submit, presses Enter repeatedly to advance, Submits while last keystroke still pending. | Tests race conditions, double-submit guards, debouncing. |
| **Lazy Student** | Leaves answers blank, picks random options without reading, abandons mid-test, never reviews results. | Tests handling of empty/sparse submissions, abandonment flows. |
| **Anxious Student** | Reads results obsessively, retakes immediately, raises disputes on most graded answers, switches between practice and real modes. | Tests Try Again paths, challenge flow, results screen stability. |
| **Recovering Student** | Lost network mid-submit, refreshes browser, closes tab and comes back, opens in a second tab. | Verifies the recent persistence fixes (B02, B03 specifically). |
| **Hostile Student** | Opens devtools, edits localStorage, tampers with Firestore writes via SDK, opens two tabs and races them. | Verifies Firestore rules and idempotent writes. |

### Linguistic / cultural personas

| Persona | Behaviour profile | Why it matters |
| --- | --- | --- |
| **Korean Native Typist** | Types Korean translations as definitions ("선집" instead of "anthology", "결합하다" instead of "coalesce"). Pastes from Korean IME. Uses 한글 keyboard. Mixes Korean with English when uncertain. | The real student majority. AI grader must handle Korean (or fail gracefully so the dispute flow works). Tests UTF-8 round-trips, input method handling, RTL/LTR edge cases. |
| **Code-Switching Student** | Mixes English and Korean in one definition. e.g. "an anthology of 시" or "to 결합하다 into one". | Real Korean students do this constantly. Tests AI grader tolerance, encoding. |
| **ESL Learner** | Native-Korean-speaker English with consistent grammar errors: missing articles, wrong tense, misplaced prepositions. Plural confusion. e.g. "a collections of poems" or "anthology mean book of poetry". | The majority of typed responses look like this. Tests AI grader fairness. |
| **Beginner Student** | Vocabulary gaps. Defines with synonyms they know rather than precise meaning. e.g. "anthology" → "book". | Tests AI grader for partial-credit recognition. |
| **Advanced Student** | Uses precise vocabulary, often more precise than the seed definition. e.g. "anthology" → "a curated compendium of literary works". | Tests AI grader for "more correct than the answer key" cases — false negatives. |

### Device / network personas

| Persona | Behaviour profile | Why it matters |
| --- | --- | --- |
| **Phone-Only Student** | Mobile viewport (375x812) throughout. iOS Safari user agent. Touch interactions only. | Most Korean students study on phone. Catches mobile-specific layout and touch bugs. |
| **Slow-Laptop Student** | CPU throttling 4x via Playwright CDP (`Emulation.setCPUThrottlingRate`). All interactions delayed. | Surfaces race conditions that don't fire on fast hardware. |
| **Academy-WiFi Student** | Persistent 800ms RTT with 5% packet loss simulating congested academy WiFi (the chat log explicitly mentions "코어 오프라인 반 인터넷이 조금 불안정한가요?"). | Real condition that causes the bulk of "couldn't save" issues. |
| **Mobile-Data Student** | Intermittent connectivity: 30s online, 5s offline cycling. | Korean students sometimes study on the subway. |
| **Multi-Device Student** | Starts session on desktop, switches to phone (same auth, different localStorage). | Tests cross-device session resumption, attempt-doc idempotency across origins. |

### Behaviour-outlier personas

| Persona | Behaviour profile | Why it matters |
| --- | --- | --- |
| **Speed Runner** | Submits in <2 minutes regardless of test length. Single-word answers. Hammers Enter to advance. | Stress-test the submit pipeline against rapid-fire input. |
| **Perfectionist** | Edits each answer 3-4 times before moving on. Lots of autosave writes. | Tests audit finding #7 (DailySessionFlow auto-save out-of-order writes). |
| **Trolling Student** | Joke answers, emoji, single-word ("idk", "lol", "🤡"), repeated chars. | Forces AI grader to handle non-answers gracefully. |
| **Cheater** | Opens devtools, alt-tabs to a dictionary, pastes verbatim definitions back. Sometimes opens two tabs of the same test. | Should match AI grader's verbatim-accept behaviour AND not produce double attempts. |
| **Habitual Refresher** | Refreshes every 30 seconds out of nervous habit. | Stress-tests recovery flow with high frequency. |
| **Class-Switcher** | Was in CORE class, moved to TOP mid-program (real case: 민사랑 in chat log). Tests day continuity across class transitions. | The day-progression bug class transfers triggered. |
| **Confused First-Timer** | New student. Doesn't know about review tests. Skips them. Doesn't see Day 2 next day. | Pattern 3 in chat log — students literally didn't know to take the review test. |
| **Anxious Teacher** | Refreshes gradebook obsessively, reviews a single dispute multiple times, edits and re-edits one list. | Tests stale-data handling, idempotency on grading writes. |

### Teacher personas

| Persona | Behaviour profile | Why it matters |
| --- | --- | --- |
| **Novice Teacher** | First-time class creation, hesitant to commit, double-checks before saving. Closes modals without saving. | Tests unsaved-changes warnings, modal cancel paths. |
| **Power Teacher** | Bulk imports 500 words from CSV, edits 10 lists in two tabs, accepts 30 challenges in a row. | Tests batch operations, concurrent edits, gradebook scale. |
| **TA (Teaching Assistant)** | Logs in with the shared `veterans@vocaboost.com` admin account. Doesn't own the class but needs visibility into student progress to triage daily issues. Asks "왜 day가 안넘어가요?" type questions. | The audit's actual end-user proxy. The chat log shows TAs are who hit the bugs first. |

## Student input simulation — how the agent generates realistic answers

For MCQ tests, "answer correctly" means: read the question prompt, locate the matching option text, click it. The agent doesn't need a separate answer key — the right answer is on screen.

For Typed tests, "answer" means **producing a sentence that the AI grader will accept**. The agent cannot guess from screen alone. It must consult the seeded canonical answer (stored in `audit_state.json.lists[X].words[*]`), then **transform** that canonical answer per the active persona before typing it.

### The lookup → transform → type pipeline

```
1. Agent reads the prompt word from the screen.
2. Agent looks up audit_state.json.lists[<currentList>].words.find(w => w.word === prompt).
3. Agent retrieves canonical English definition (definition_en) and canonical Korean translation (definition_ko).
4. Agent applies the persona's transform rule to produce the typed response.
5. Agent types character-by-character via Playwright (NOT a single .fill()) to mimic real keyboard input — see "typing realism" below.
```

### Persona transform rules

For a word `anthology` with `definition_en = "a published collection of poems or other writings"` and `definition_ko = "(시 등의) 선집"`:

| Persona | Transform rule | Example output |
| --- | --- | --- |
| Careful Student | Canonical English, verbatim. | `a published collection of poems or other writings` |
| Korean Native Typist | Canonical Korean translation. | `(시 등의) 선집` |
| Code-Switching Student | English structure, Korean noun. e.g. replace one noun with its 한국어 equivalent. | `a published collection of 시 or other writings` |
| ESL Learner | Strip articles, mis-pluralize, swap one tense. | `published collections of poem or other writing` |
| Beginner Student | One-word synonym from a Korean→English beginner vocabulary set. | `book` or `collection` |
| Advanced Student | Add precision the seed didn't have. | `a curated compendium of literary works, typically poetry` |
| Lazy Student | Random selection from `["idk", "I don't know", "모름", "?", "pass"]`. | `idk` |
| Trolling Student | From `["lol", "🤡", "skibidi", "based", "asdfasdf", "ㅋㅋㅋ"]`. | `ㅋㅋㅋ` |
| Speed Runner | First word of canonical, truncated. | `published` |
| Perfectionist | Canonical + repeated edits (type, backspace 5, retype, backspace 3, retype). | (typed with edit history) |
| Cheater | Canonical English verbatim (looked up "dictionary"). | `a published collection of poems or other writings` |
| Confused First-Timer | Half-formed answer + question marks. | `something about poems?` |

For each persona, declare the transform rule in the batch spec scenario, AND assert what the AI grader's expected verdict should be (accept / partial / reject) so the audit can flag mismatches.

### Typing realism — why .fill() is banned for typed answers

`page.fill()` sets the value in one go; React's onChange fires once. Real students type character by character, which generates many onChange events. The audit-known issue #10 (TypedTest reads `responses` directly from state, not a ref) only surfaces under real keystroke timing.

Use this helper instead:

```js
async function realisticType(locator, text, persona) {
  const delay = {
    'careful-student': 100,         // ~100ms between keys, deliberate
    'rushed-student': 30,           // fast
    'speed-runner': 15,             // hammering
    'korean-native-typist': 80,     // IME composition is slow
    'phone-only-student': 200,      // mobile thumbs
    'slow-laptop-student': 250,     // hardware lag
    'perfectionist': 120,           // (then sprinkle backspaces)
  }[persona.id] ?? 80
  for (const char of text) {
    await locator.press(char, { delay })
  }
}
```

For the Korean Native Typist, additionally simulate IME composition by typing 자모 components one-at-a-time when possible (Playwright supports `dispatchEvent('compositionstart')` etc.). Or just paste Korean text directly with `locator.fill(koreanString)` AFTER first establishing focus via a click — accept that this skips composition events but still validates UTF-8 round-trip.

### How the canonical answer makes it into audit_state.json

B00's S05 (seeding lists) is the moment to capture canonical answers. Each list's words are inserted via the teacher's list-editor UI; the agent already knows the (word, definition_en, definition_ko) tuples from the fixture data it's typing. Persist those tuples to `audit_state.json.lists[<key>].words = [{ word, definition_en, definition_ko, partOfSpeech }, …]` at insertion time, so every subsequent batch can look them up without re-querying Firestore.

For lists where Korean translations weren't provided in the original seed, fall back to a one-shot translation step: the agent uses an LLM (Claude, or the project's own grading function as an oracle) to produce Korean definitions at seed time and persist them.

## Multi-day longitudinal scenarios

Several bug patterns from the chat log only surface across day transitions — Day N submitted cleanly, Day N+1 shows stale words; or Day N+1 advances but state is subtly wrong. Single-session tests will never catch these. The audit needs longitudinal infrastructure.

### Date.now shimming

Install at the start of every test that crosses a day boundary:

```js
await page.addInitScript((startISO) => {
  const origNow = Date.now.bind(Date)
  const offset = new Date(startISO).getTime() - origNow()
  Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
  window.__VOCABOOST_TIME_OFFSET__ = 0
  window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
}, '2026-06-01T09:00:00+09:00')  // anchor at a fixed weekday morning KST
```

Then advance time deliberately between sessions:

```js
// Complete Day 1's session at 09:30 KST.
// Advance to next day's session window.
await page.evaluate(() => window.__advanceTime(24 * 60 * 60 * 1000))
```

Caveats:
- Firebase server timestamps are NOT shimmed (they come from the server's clock). The audit must distinguish "client thinks it's day N+1" from "Firestore docs are timestamped day N+1." For server-side timestamps, prefer Firestore emulator if available so timestamps come from the emulator (which can be shimmed at the JVM level via env vars) rather than production.
- `Date.now` shimming inside the page does NOT affect Playwright's own waiters. `page.waitForTimeout` still uses real time.
- Some libraries cache `Date.now` at import; shim must be installed via `addInitScript` (before page scripts), not via `page.evaluate` (after).

### Day-walking helper

```js
async function completeDay(page, persona, { dayNumber, classKey, listKey }) {
  // Navigate to session.
  await page.goto(`/session/${classKey}/${listKey}`)
  // Dismiss new-word cards based on persona's dismissal pattern.
  await dismissNewWordCards(page, persona)
  // Take new-word test, applying persona transforms.
  await takeNewWordTest(page, persona, listKey)
  // If Day 2+, take review test.
  if (dayNumber >= 2) {
    await takeReviewTest(page, persona, listKey)
  }
  // Capture Firestore state for this day.
  const state = await captureFirestoreState(page, persona.uid, classKey, listKey)
  await fs.promises.writeFile(
    `findings/evidence/B22/day_${dayNumber}_${persona.id}.json`,
    JSON.stringify(state, null, 2)
  )
  return state
}
```

A B22 scenario can then do:

```js
for (let day = 1; day <= 14; day++) {
  const state = await completeDay(page, persona, { dayNumber: day, classKey, listKey })
  expect(state.currentStudyDay).toBe(day)        // CSD advances 1 per day
  expect(state.recentSessions).toHaveLength(day) // capped, but for first 14 days exactly day
  await page.evaluate(() => window.__advanceTime(24 * 60 * 60 * 1000))
}
```

If any assertion fails on day K, the evidence dir has the captured state for day K-1 to diff against day K — root-causing the drift.

### Weekend skip handling

For lists with `studyDaysPerWeek=5` (M-F), advancing 24h on Friday should land on Saturday — and the next session is Monday, not Saturday. The day-walking helper should know:

```js
function nextStudyDay(currentDate, studyDaysPerWeek) {
  const next = new Date(currentDate.getTime() + 24*60*60*1000)
  if (studyDaysPerWeek <= 5) {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1)
    }
  }
  return next
}
```

## Infrastructure assumptions

The audit assumes the following are stood up before B00 runs:

- **Vite dev server** on `https://vocaboostone.netlify.app` with hot reload.
- **Firebase: production project `vocaboost-879c2`.** The 50 audit students (all carrying `auditAccount: true` markers) are already seeded into 25WT 2차 TOP OFFLINE and CORE OFFLINE. Frontend target is the live Netlify deploy at https://vocaboostone.netlify.app/. This is a deliberate decision: tests run against the same code path students see, including real Cloud Functions for AI grading. The earlier draft of this section said "never run against production" — that has been superseded; the audit's value is measuring what students actually experience.
- **Playwright** with Chromium installed (`npx playwright install chromium`).
- **Time-based testing** uses `Date.now` shimming via Playwright's `page.addInitScript` rather than real waits whenever possible — `await page.waitForTimeout(60000)` is banned. NOTE: client-side `Date.now` shim does NOT affect Firebase `serverTimestamp()` — those come from Google's clock. For batches that need server-time invariants (B22 day progression), see that batch's caveat block.

**Production tradeoffs to keep in mind:**

- Firestore snapshots use the Admin SDK (`scripts/serviceAccountKey.json`). The audit can read any document.
- Firestore writes via destructive scenarios (B12 hostile, B22 multi-tab races) DO mutate production. The 50 audit students are intentionally scoped containers — the seeded `auditAccount: true` markers let cleanup safely revert.
- Service workers may intercept Playwright route handlers on the live site; unregister at session start.
- AI grading calls cost real money (~$0.001 per call, Claude Haiku). Budget for ~1500–2000 calls across a full audit.

**Emulator path (alternative, not the chosen target):** If you specifically need to validate server-time invariants in B22 or B14, run a separate B22-emulator pass using `firebase emulators:start`. PLAN.md leaves the helpers compatible with either backend, but the default-and-tested target is production.

## Selector strategy — read this twice

vocaBoost has **zero `data-testid` attributes** in its main pages (verified 2026-05-30 via `grep -c data-testid src/pages/MCQTest.jsx src/pages/TypedTest.jsx src/pages/DailySessionFlow.jsx src/pages/Dashboard.jsx` → all 0). Selectors must be defensive.

**Priority order:**
1. **`getByRole`** with `name` — `page.getByRole('button', { name: 'Submit' })`. Survives most refactors.
2. **`getByLabel`** for form inputs — `page.getByLabel('Email')`.
3. **`getByText` with `exact: true`** for displayed strings — `page.getByText('Test Results', { exact: true })`.
4. **`getByTestId`** — *if* it exists. Encourage the team to add testids as part of remediation; record as MEDIUM findings when selectors are forced to be brittle.

**Banned:**
- CSS class selectors (`.bg-brand-primary`) — will break the moment Tailwind tokens change.
- XPath positional selectors (`div[3]/button[2]`).
- nth-child selectors unless the parent is itself robustly identified.
- Anything that depends on the layout / visual order rather than semantic role.

**Pattern: scoping to a card / panel:**
```js
const sessionCard = page.getByRole('region', { name: /today's session/i })
await sessionCard.getByRole('button', { name: 'Start' }).click()
```

**Pattern: waiting for stable state:**
```js
// Bad: arbitrary wait
await page.waitForTimeout(1000)

// Good: assertion that retries until DOM matches
await expect(page.getByText('Submitted')).toBeVisible()

// Good: network-driven wait
await page.waitForResponse(r => r.url().includes('/api/submit') && r.ok())
```

## Network simulation matrix

Each resilience-focused batch (B06, B07, B12) should exercise at least three points on this matrix:

| Condition | Playwright setup | What it tests |
| --- | --- | --- |
| **Online clean** | (default) | Baseline. |
| **Offline** | `await context.setOffline(true)` | Queue behaviour, retry, recovery. |
| **Slow 3G** | `await context.route('**/*', route => setTimeout(() => route.continue(), 800))` | Loading state correctness, race conditions, timeouts. |
| **Intermittent** | Route handler that fails the first N requests then succeeds. | Retry logic in `withRetry`, idempotency on retry. |
| **Server 500** | `route.fulfill({ status: 500, body: '{}' })` for matched URLs. | Error surfaces, user-facing recovery options. |
| **Server stalled** | Route handler that never calls `route.continue()` for matched URLs. | Timeout handling, "stuck" UI states. |

## Time / date simulation

Anything that depends on day boundaries (currentStudyDay, recentSessions, lastStudyDate, streak) must be tested across:

- **Midnight rollover** — start a session at 23:55, submit at 00:05.
- **Weekend skip** — Friday → Monday with studyDaysPerWeek=5.
- **DST transition** — March and November transitions; UTC drift.
- **Long idle** — last session was 8 days ago; streak break.
- **Reentry same day** — already completed today, opens again.

Use Playwright's `page.addInitScript` to install a `Date.now` shim. Never `setTimeout` to wait for real time.

## Credentials & accounts — how the audit logs in

### Sourcing accounts: pre-seed once, log in many times

B00's original plan (sign up users during the run) is too slow and non-deterministic. The audit instead uses pre-seeded accounts created via `scripts/seed-audit-students.js` — 50 students split 25/25 between TOP and CORE offline classes, each tagged with a persona id. Run once, log in many times across audit runs.

```bash
# One-time setup (DRY RUN, prints what would happen):
node scripts/seed-audit-students.js

# Actually create the 50 accounts:
node scripts/seed-audit-students.js --apply

# Just one class if you want to start small:
node scripts/seed-audit-students.js --apply --only=TOP

# After the audit (or when changing the persona allocation):
node scripts/cleanup-audit-students.js --apply
```

The seed script writes `audit/playwright/seeded_accounts.json` — that file is **gitignored** because it contains real Firebase passwords. The Playwright audit reads it at startup.

### What the seed produces

`seeded_accounts.json` shape (see `seeded_accounts.example.json` for full schema):

```json
{
  "projectId": "vocaboost-879c2",
  "classes": {
    "TOP":  { "id": "<firestore-id>", "name": "...", "joinCode": "QSTRZL" },
    "CORE": { "id": "<firestore-id>", "name": "...", "joinCode": "3VEHE8" }
  },
  "accounts": [
    {
      "email": "audit_korean_01_top@vocaboost.test",
      "password": "AuditPass2026!",
      "uid": "<firebase-auth-uid>",
      "personaId": "korean",
      "personaLabel": "Korean Native Typist",
      "personaTransform": "canonical_ko",
      "targetClass": "TOP"
    }
    /* … 49 more */
  ]
}
```

### Auth helpers

Login helper consumes the seeded list. One persona may have multiple accounts (e.g. Korean has 3 — 2 in TOP, 1 in CORE); the helper picks by `targetClass` if specified, else round-robins.

```js
// e2e/audit/helpers/auth.js
import { readFileSync } from 'fs'
const seeded = JSON.parse(readFileSync('audit/playwright/seeded_accounts.json', 'utf-8'))

export function getPersonaAccounts(personaId, targetClass = null) {
  return seeded.accounts.filter(a =>
    a.personaId === personaId &&
    (targetClass === null || a.targetClass === targetClass)
  )
}

export async function loginAs(page, personaId, opts = {}) {
  const candidates = getPersonaAccounts(personaId, opts.targetClass)
  if (candidates.length === 0) {
    throw new Error(`No seeded account for persona=${personaId} class=${opts.targetClass}`)
  }
  // Pick by indexInPersona if specified, else first.
  const account = opts.index ? candidates[opts.index - 1] : candidates[0]
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click()
  await page.waitForURL(/\/$|\/dashboard/, { timeout: 10000 })
  return account
}

export function getClassInfo(classKey) {
  return seeded.classes[classKey]  // { id, name, joinCode }
}
```

### Markers — how cleanup finds these accounts safely

Every Firestore user doc the seed creates gets:

```js
{
  auditAccount: true,           // primary cleanup marker
  auditPersona: 'korean',       // for filtering by persona
  auditTargetClass: 'TOP',      // for cross-checking allocation
  auditSeededAt: <serverTimestamp>
}
```

`cleanup-audit-students.js` queries `where('auditAccount', '==', true)` and only deletes matches. A real student doc never gets `auditAccount: true` unless something is very wrong; the marker is the safety net.

Member subdocs (`classes/{id}/members/{uid}`) and `enrolledClasses` subdocs also get `auditAccount: true` so any partial cleanup or future class-level inspection can identify them.

### Cleanup cascade

`cleanup-audit-students.js --apply` does the following per audit user:

1. Delete `attempts` where `studentId === uid` (skip with `--keep-attempts` for forensic review).
2. Delete subcollections: `users/{uid}/enrolledClasses`, `study_states`, `class_progress`, `sessions`.
3. For each enrolled class:
   - Delete `classes/{classId}/members/{uid}`.
   - `studentIds: arrayRemove(uid)`, `studentCount: increment(-1)`.
4. Delete `users/{uid}` doc.
5. Delete Auth user.
6. After all users processed, delete `seeded_accounts.json`.

The script has a **SAFETY_CAP = 100** — refuses to delete more than 100 accounts in one run as a guardrail against runaway cleanup.

### What if the seed script can't find the class by joinCode?

The seed resolves classes by `joinCode` query (QSTRZL → TOP, 3VEHE8 → CORE). If the codes have been regenerated or the classes deleted, the script aborts with a clear message before creating any users. Fix the codes in `scripts/audit-personas.js` and re-run.

### Production-vs-staging notes

The script targets whatever Firebase project is set in `.env` as `VITE_FIREBASE_PROJECT_ID`. For the production project `vocaboost-879c2`, only run when:
- The current student cohort is **not actively studying** (between cohorts is ideal).
- You have a confirmed window to run the audit + cleanup in sequence.
- A teacher knows that 50 "Audit ..." students will briefly appear in the TOP/CORE OFFLINE gradebooks.

For a staging or test project, the same script works — just point `VITE_FIREBASE_PROJECT_ID` at the test project and run.

## Evidence capture

Every batch produces evidence under `audit/playwright/findings/evidence/BXX/`:

- **Screenshots** at every state transition. Naming: `BXX_S<scenario>_<step>_<phase>.png` (e.g. `B02_S03_03_after_refresh.png`).
- **Network HAR** for the whole batch run: `BXX_network.har`.
- **Console log** capture: `BXX_console.log`.
- **Firestore snapshots** (when emulator is up): `BXX_S<scenario>_firestore_<event>.json` (e.g. before-submit, after-submit, after-retry).

Findings reports reference evidence by relative path.

## What NOT to test

- Implementation details. Don't assert on internal hook state, internal Firestore field names that aren't user-visible, or Tailwind class strings.
- Visual pixel-perfect diffs. Lighting changes when fonts update; flaky.
- Performance budgets unless explicitly listed in MEDIUM rubric.
- Backend Cloud Function behaviour beyond what the UI exposes — that's a separate audit (functions-level integration tests).
- apBoost flows. Out of scope. Those have their own audit suite.

## Running the audit

For unattended hours-long runs:

```bash
# Once
npx playwright install chromium
npm run dev &  # in another shell, or rely on playwright's webServer

# Per batch
npx playwright test e2e/audit/B00 --reporter=html
# (open the HTML report to review)

# All batches sequentially
for i in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21; do
  npx playwright test e2e/audit/B${i}_ --reporter=html || true
done
```

Failures should not abort the whole audit — that's why each `|| true`. The findings_BXX.md files capture what went wrong; the spec exit codes are not the source of truth.

## What good looks like

After a full pass:
- 22 `findings_BXX.md` files exist, each non-empty (passing scenarios are documented too).
- Every BLOCKER has a reproducible repro recipe, a Firestore-state diff (when applicable), a screenshot, and a one-sentence root-cause hypothesis.
- The audit's top-level summary identifies the 3–5 highest-priority items to fix before student rollout.
- Any "I couldn't test this because…" caveats are explicit.

If you finish a batch and don't have at least one MEDIUM or LOW observation, look harder — perfectly clean batches usually mean shallow testing.

# latest_to_push.md

What's in the working tree right now, ready for you to commit + push via GitHub Desktop.

---

## Suggested commit title

> **Audit infra: Tier 0+1 fixes from external review + helpers + 50-student seed repair**

(Or a tighter variant: `Audit suite: fix seed enrollment bug, normalize persona IDs, add helpers`.)

---

## Suggested commit body

```
External reviewer caught real issues. Tier 0 + Tier 1 fixes applied:

Tier 0 — execution blockers
- Fix seed enrollment write path: was writing to subcollection, app reads
  enrolledClasses as a MAP on the user doc (db.js:962). Dashboards would
  show "Join your first class" instead of the enrolled class.
- One-shot repair script run against 50 already-seeded students; all now
  carry the correct enrolledClasses map. Idempotent.
- Persona IDs normalized across audit_state.json and 9 batch files
  (carefulStudent → careful, etc.) to match seeded_accounts.json source
  of truth. 40 replacements.
- Env policy harmonized: PLAN.md no longer says "never run against
  production". Production is the deliberate target; emulator path
  documented as alternative.
- B00 hard-gates on dashboard class visibility: if any audit student
  sees the empty state on login, the whole audit halts and prompts the
  repair script.

Tier 1 — quality improvements
- Pre-populated e2e/audit/helpers/ with 7 modules (auth, personas,
  firestore, time, evidence, network, state). Agents no longer reinvent
  helpers per batch.
- helpers/firestore.js: named route patterns for Firebase Web SDK
  (Write/Listen channels + REST commit) so fault injection is endpoint-
  specific rather than the previous broad **/firestore**/**.
- Teacher persona slots resolve to veterans@vocaboost.com proxy via
  helpers/auth.js TEACHER_PERSONA_IDS set. No new teacher accounts.
- B22 server-time caveat added prominently: client Date.now shim does
  not affect Firebase serverTimestamp(); full server-time validation
  requires a separate emulator pass (documented as out of scope for the
  default production run).
- B20 scenarios reformatted: "### Pages" listing converted to 18
  separate ### S01–S18 headings; scenario counters now parse correctly.

Note: 50 audit_account-tagged test students currently exist in production
Firebase under 25WT 2차 TOP OFFLINE (25) and 25WT 2차 CORE OFFLINE (25).
Cleanup is `node scripts/cleanup-audit-students.js --apply` when audit done.
```

---

## Files changed (or new) since the last push

### New files

```
audit/playwright/START_HERE.md           Audit entry point for sub-agents (423 lines)
audit/playwright/ORCHESTRATOR.md         Aggregation playbook for the orchestrator (303 lines)
audit/playwright/PLAN.md                 (existed — heavily updated; see below)
audit/playwright/BATCH_ORCHESTRATION.md  (existed — updated)
audit/playwright/chat_log_coverage.md    Maps 25 TA-reported patterns → batch coverage
audit/playwright/FINDINGS_TEMPLATE.md    Per-batch finding template
audit/playwright/audit_state.json        Shared state contract (now uses short persona IDs)
audit/playwright/seeded_accounts.example.json   Schema documentation for the gitignored real file
audit/playwright/README.md               Entry point doc
audit/playwright/batches/B00–B26 (27 batch files, ~3,400 lines)
e2e/audit/helpers/auth.js                loginAs, getAccount, TEACHER_PROXY
e2e/audit/helpers/personas.js            transformAnswer, realisticType, perfectionistTyping
e2e/audit/helpers/firestore.js           Admin SDK snapshots + named Firebase route patterns
e2e/audit/helpers/time.js                Date.now shim install + advanceTime + weekend-skip
e2e/audit/helpers/evidence.js            screenshot, console log, HAR, Firestore snapshot capture
e2e/audit/helpers/network.js             Condition presets (offline, slow3G, academyWifi, intermittent)
e2e/audit/helpers/state.js               Per-agent JSONL + status.json logging
scripts/audit-personas.js                Shared persona allocation (24 personas, 50 accounts)
scripts/seed-audit-students.js           Seeds 50 accounts via Admin SDK; --dry-run by default
scripts/cleanup-audit-students.js        Mirror cascade cleanup keyed by auditAccount:true
scripts/repair-audit-enrollments.js      One-shot fixer for the enrollment-map bug; already run
```

### Modified files

```
.gitignore                               Added: service-account*.json, *-credentials.json,
                                                seeded_accounts.json, findings outputs
firestore.rules                          (from prior session) C1, C3 rule tightenings
src/utils/testRecovery.js                (from prior session) getOrCreateAttemptNonce helper
src/services/db.js                       (from prior session) attemptDocId param on submit
                                          functions; switched addDoc → setDoc(idempotent ID)
src/pages/MCQTest.jsx                    (from prior session) reordered handleSubmit
src/pages/TypedTest.jsx                  (from prior session) reordered handleSubmit
change_action_log.md                     (from prior session) Logged the persistence + audit fixes
audit_findings_persistence.md            (from prior session) Merged audit doc with verification
```

### Notable removals

None.

### Files NOT to push

```
audit/playwright/seeded_accounts.json    Contains real Firebase passwords; gitignored
scripts/serviceAccountKey.json           Firebase Admin SDK key; should already be gitignored
.env, .env.local                         Firebase API keys; already gitignored
```

---

## Production Firebase state right now

| Resource | Count | Marker |
| --- | --- | --- |
| `auth` users with `auditAccount` profiles | 50 | `auditAccount: true` |
| Students in 25WT 2차 TOP OFFLINE | +25 audit | enrolledClasses map populated |
| Students in 25WT 2차 CORE OFFLINE | +25 audit | enrolledClasses map populated |
| `studentCount` inflation | +25 per class | will decrement on cleanup |

Cleanup command when audit is done:

```bash
node scripts/cleanup-audit-students.js --apply
```

Defaults to dry-run; `--apply` mutates. Safety cap = 100 users per run.

---

## What's ready for the next session

1. Pre-seeded accounts: ✅
2. Helpers in `e2e/audit/helpers/`: ✅
3. Batch specs B00–B26 with normalized persona IDs: ✅
4. Live-site target wired: ✅ (https://vocaboostone.netlify.app)
5. START_HERE.md entry point: ✅
6. ORCHESTRATOR.md aggregation playbook: ✅

Kickoff prompt for the next session:

```
Read /app/audit/playwright/START_HERE.md and follow it.
Your label: solo.
Claim: all batches.
```

For concurrent agents, see ORCHESTRATOR.md and split batches across labels (A/B/C).

---

## Sanity check before pushing

- [ ] `git diff` shows expected file list above.
- [ ] No `audit/playwright/seeded_accounts.json` in the staged diff.
- [ ] No `scripts/serviceAccountKey.json` in the staged diff.
- [ ] No `.env` or `.env.local` in the staged diff.
- [ ] Commit title under 70 chars.

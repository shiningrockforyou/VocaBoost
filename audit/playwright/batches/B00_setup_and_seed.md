# B00 — Setup & Seed

**Priority:** P0 (everything depends on this)
**Estimated duration:** 10–20 minutes for the Playwright side. (The 50-account Firebase seed is done out-of-band beforehand via `scripts/seed-audit-students.js` — see PLAN.md "Credentials & accounts.")
**Outputs:** populated `audit_state.json`, smoke screenshots, verification that `seeded_accounts.json` exists and is consumable.

## Goal

Verify the environment, confirm the pre-seeded Firebase accounts (50 students across 25WT 2차 TOP OFFLINE and CORE OFFLINE) are reachable via Playwright login, capture baseline lists/words into `audit_state.json` for the lookup pipeline, and ensure every downstream batch can start from a known state.

**Important:** B00 no longer creates users from scratch. The 50 student accounts have already been seeded via `node scripts/seed-audit-students.js --apply` (out of band, run from a shell with Firebase Admin SDK credentials). This batch consumes `seeded_accounts.json` rather than re-running signup flows.

## Preconditions

- Vite dev server reachable at `https://vocaboostone.netlify.app` (verify with `curl -s -o /dev/null -w "%{http_code}" https://vocaboostone.netlify.app/` → `200`).
- Firebase config in `.env`. For production project `vocaboost-879c2`, verify the current cohort is between sessions (the seeded "Audit ..." students will be visible in the gradebook briefly).
- Playwright Chromium installed (`npx playwright install chromium` was run).
- **`audit/playwright/seeded_accounts.json` exists** — produced by `node scripts/seed-audit-students.js --apply`. If missing, B00 cannot proceed; abort and run the seed first.
- `e2e/audit/` directory exists; create if not (`mkdir -p e2e/audit/helpers`).

## Scenarios

### S01 — Environment smoke

1. `page.goto('/')`
2. Assert page title matches `/VocaBoost/i`.
3. Assert no critical console errors (filter out the React DevTools warning and known apBoost noise).
4. Screenshot `B00_S01_landing.png`.

**Pass criteria:** page loads, title matches, no `console.error` calls fired during initial render.

### S02 — Verify seeded accounts are loginable

Goal: prove the 50 pre-seeded accounts in `seeded_accounts.json` can actually log in via the UI. Catches password regressions, Firebase Auth disabled, blocked emails, etc.

1. Read `audit/playwright/seeded_accounts.json`. Verify schema: has `projectId`, `classes.TOP`, `classes.CORE`, and an `accounts` array of length ~50.
2. Sample one account per persona (24 logins total — not all 50, to keep B00 fast):
   - `helpers.loginAs(page, personaId)`.
   - Assert dashboard renders, displays the seeded `displayName`.
   - Assert the student sees the expected class enrollment (TOP or CORE based on seed config).
   - Sign out.
   - Screenshot `B00_S02_login_${personaId}.png`.
3. If any login fails: HIGH finding. Note which persona; the audit can still proceed for other personas, but B22+ scenarios that rely on the failed persona will skip.

**Pass criteria:** ≥22 of 24 sampled accounts log in successfully. If <22 succeed, BLOCKER — the seed step failed silently or auth is broken.

### S03 — Verify class enrollment matches expectations

Goal: each of the 25WT 2차 TOP OFFLINE and CORE OFFLINE classes now has the 25 audit students plus whatever real students were already there.

1. Log in as the Veterans teacher account (`veterans@vocaboost.com` — see chat log for credentials).
2. Navigate to gradebook → 25WT 2차 TOP OFFLINE.
3. Look for the 25 audit students (displayName starts with "Audit ").
4. Screenshot the roster.
5. Same for 25WT 2차 CORE OFFLINE.
6. Note actual `studentCount` on both classes (will be real student count + 25).

**Pass criteria:** 25 audit students visible per class.
**Failure → HIGH** if any audit student is missing from the gradebook — implies seed-script enrollment write failed silently for that account.

If the teacher login isn't available in this environment, skip S03 and note it; B16-B18 will verify the same data later.

### S04 — Capture canonical answers into audit_state.json

Goal: the typed-test input pipeline (PLAN.md "Student input simulation") needs to look up canonical English + Korean translations per word. Capture them from the TOP and CORE class's assigned lists.

1. Log in as Veterans teacher.
2. Navigate to a list assigned to 25WT 2차 TOP OFFLINE. Get the list's words (via UI or by inspecting Firestore directly if access permits).
3. For each word, capture `{ id, word, partOfSpeech, definition_en, definition_ko }` if available.
4. Persist to `audit_state.json.lists.topActiveList = { id, title, wordCount, classIds: [classes.TOP.id], words: [...] }`.
5. Same for a list assigned to CORE.
6. If `definition_ko` is not populated in the seed data, use an LLM (Claude or the project's own grading function as an oracle) to produce Korean translations for at least 20 words per list and write back.

**Pass criteria:** `audit_state.json.lists.topActiveList.words` and `.coreActiveList.words` each have ≥20 entries with both definition_en and definition_ko.

### S05 — DASHBOARD ENROLLMENT GATE (BLOCKER if it fails)

**This scenario gates the entire audit.** A previous version of the seed script wrote enrollment to a subcollection while the app reads it as a map on the user doc; the bug let logins succeed but showed all students an empty "join your first class" state. If this gate fails, every downstream batch fails for the same setup reason. Halt the whole audit and run `node scripts/repair-audit-enrollments.js --apply` (script is idempotent and safe to re-run).

For ONE student of each class — pick `careful` for TOP and `careful` for CORE, since baseline persona is the most-likely-correct test:

1. `helpers.loginAs(page, 'careful', { targetClass: 'TOP' })`
2. **Assert the dashboard shows a class card with text matching `25WT 2차 TOP OFFLINE`.** If instead you see "Join your first class" or any other empty state → **HALT THE AUDIT**, file BLOCKER, run the repair script, restart B00.
3. Assert the today's-session card is present and clickable.
4. Assert no `console.error` calls fired during dashboard load.
5. Screenshot `B00_S05_enrollment_gate_top.png`.
6. Log out.
7. Repeat with `helpers.loginAs(page, 'careful', { targetClass: 'CORE' })` and `25WT 2차 CORE OFFLINE`.

**Then** for 5 sampled students across persona categories:

1. `helpers.loginAs(page, personaId)`.
2. Assert dashboard renders without console errors.
3. Verify the student sees the appropriate class card.
4. Verify the today's-session card is present and clickable.
5. Screenshot `B00_S05_dashboard_${personaId}.png`.

**Pass criteria:** Both gate logins show a real class card. All 5 sampled personas pass the same checks.
**Failure on the gate → BLOCKER, halt the whole audit.**
**Failure on a sample persona only → MEDIUM, continue but flag.**

### S06 — Final audit_state.json sanity check

Write a one-line summary into `audit_state.json.notes`:
```
"B00 verified: 50 seeded accounts (25 TOP + 25 CORE) loginable; canonical answers captured for N words"
```

Validate by reading the file back and asserting every required field is populated.

## Findings file

Even if everything passes, write `findings/findings_B00.md` from the template. Document:

- Any persona that failed to log in.
- Any class roster discrepancy.
- Lists where Korean translations had to be backfilled.
- Console warnings about missing testids if you introduced any in helpers.

## Exit conditions

- ✅ All 50 accounts log in, canonical answers captured → proceed to B02.
- ❌ <22 of 24 sampled accounts log in → halt. The seed step failed; rerun `node scripts/seed-audit-students.js --apply --resume` from a shell with Admin SDK creds.
- 🟡 Some personas missing (e.g., classswitcher) → continue but skip B24's S03 / B22's S19.

# Test plan — attempt-write lockdown + G2 (server-authoritative typed grading)

Covers `PLAN_attempt_write_lockdown.md` (W1/W2/W3) + the typed slice of
`PLAN_server_authoritative_grading.md` (G2). Two layers, because they validate different things:

| Layer | File | What it proves | Needs |
|---|---|---|---|
| **Rules-unit** (security core) | `firestore-tests/attempts_lockdown.rules.test.js` | Forgery is **denied at the rule boundary** (direct create, student `answers`/grade-field writes) — a *direct-API* attack Playwright can't do | Firestore emulator + `@firebase/rules-unit-testing` |
| **Playwright E2E** (user flows) | `e2e/lockdown_g2.spec.js` | The legit flows still work through the new server paths (challenge submit, empty-review completion, typed/MCQ grade) | dev server + a seeded 25WT student, flags ON |

> ⚠️ Author's note: these were written without execution (no browser/deploy/emulator in the authoring
> container). Treat the **first run as part of validation** — selectors in the E2E spec may need a tweak
> against the live UI; the rules-unit tests are deterministic and should pass against the W3 rules as written.

---

## A. Rules-unit tests (run FIRST — no deploy, strongest security signal)

Validates the **W3** rules block (from `W3_attempts_lockdown.rules.md`) against the emulator. Run these
against a `firestore.rules` that HAS W3 applied (copy the staged block in, or point the test at a W3 copy).

```bash
npm i -D @firebase/rules-unit-testing        # not yet a dep
firebase emulators:exec --only firestore "node --test firestore-tests/attempts_lockdown.rules.test.js"
# or: firebase emulators:start --only firestore  (then run the test file in another shell)
```

Cases (all in the test file):
- student direct `create({passed:true,score:100})` → **DENIED** (was allowed pre-W3).
- student `update(answers:[…isCorrect:true…])` → **DENIED**.
- student `delete` own attempt (reset) → **ALLOWED**.
- teacher-of-record `update` → **ALLOWED**; non-teacher update → DENIED.
- read: own attempt / teacher-of-record → allowed; other student → denied.

## B. Playwright E2E (run against dev + seeded 25WT student, flags ON)

**Preconditions:** functions deployed; `SERVER_CHALLENGE_WRITE` + `SERVER_REVIEW_MARKER` flipped ON +
`npm run dev` rebuilt; `audit/playwright/seeded_accounts.json` present (real creds, gitignored). For the
G2 token round-trip assertions, also `GRADE_TOKEN_MINT` ON.

```bash
npm run test:e2e -- lockdown_g2          # headless
npm run test:e2e:ui -- lockdown_g2       # watch
```

Flows: login → typed test grades + persists (no-regression); MCQ submit (no-regression); challenge submit
goes through the callable (token decrements, teacher sees pending); empty-review Day-2+ completes + advances.
The spec logs steps/findings like the existing audit specs and is resilient to the OFF/ON flag state where
the user-visible behavior is identical (it asserts behavior, not the write path).

## C. Functions-logic tests (follow-on)
`gradeToken` mint/verify, `serverGraded` gating, the writer-API guard, and TTL are intricate to unit-test
(they need Firestore mocking via `firebase-functions-test`, already a dep, plus exporting the helpers).
Lower priority than A/B; tracked as a follow-on. The rules-unit tests + the E2E token round-trip cover the
externally-observable behavior in the meantime.

## What still requires manual deploy-time checks
- `data-integrity-sweep` clean before/after each flag flip (`scripts/cs/data-integrity-sweep.mjs 25WT`).
- The forged-create / forged-grade denial **in production** (the rules-unit tests prove the rules; a live
  spot-check via the Firebase console or a direct SDK call confirms the deployed rules match).

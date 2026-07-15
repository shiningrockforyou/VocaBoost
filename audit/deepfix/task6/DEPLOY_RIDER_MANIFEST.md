# Deploy Rider Manifest — the INITIAL staged release (#11 + the ungated live fixes)

**Status:** LOCAL-ONLY (2026-07-15). Resolves the end-review NO-GO condition: both Fable reviewers + Codex said
the tree converts to GO **once every deliberate live delta is explicitly whitelisted here** and the deploy is
`--only`-scoped. This manifest is that whitelist. David runs the deploys.

## What this release IS
The **initial staged release** — ships the deepfix's **ungated live fixes** + lands the **dormant** foundation
code. Deploy payload, in order:

> **1. `--only firestore:indexes`** (build) → **2. `--only functions`** (all `FOUNDATION_FLAGS` off → dormant)
> → **3. `--only hosting`** (client flags off except the 2 already-live) — **NO `firestore:rules`**, **no flag
> flips**, **never a bare `firebase deploy`**.

It is **NOT byte-equivalent** — it deliberately ships the fixes below. It carries **zero** rules changes and
**zero** flag flips (the 8 dormant flags stay off; their cutovers are separate, later).

---

## A · Ungated CLIENT live deltas (ship live in `--only hosting`) — ACCEPTED

| ID | Delta | Fixes | Deploy-order requirement | Disposition |
|----|-------|-------|--------------------------|-------------|
| **F3** | Review-only-day completion activates (rides `LIST_SCOPED_RECON`, already live) — throttled/all-mastered days complete + advance CSD | **#11** permanent-freeze | none (rides a live flag) | **ACCEPT** — the point of the release. Known cosmetic edge: an all-mastered non-list-complete day can show "Day Complete" without CSD advancing (RO-S10 carry-forward; server P4 closes it). |
| **F2** | `queryTeacherAttempts` Name-filter pushes a `studentId` where-clause (unconditional) | C-33 gradebook | **indexes built** (step 1) **before** hosting — else `failed-precondition` on a Name filter | **ACCEPT** — order enforced by 1→3 |

> **F1 EXCLUDED from this release** (Codex end-review-v2 BLOCKER, verified). The Signup teacher-onboarding
> redesign (invite-code → `provisionTeacher`) depends on `TEACHER_PROVISIONING_ENABLED`, which by design
> (functions/index.js:1960-1961) flips **only in the P6 release train** ("the rules close self-select signup;
> this is the replacement path"). Shipping F1 now would call a dormant callable → new teachers stuck as students.
> **Fix applied:** reverted `src/pages/Signup.jsx` to HEAD (today's working teacher signup stays live); F1
> preserved at `audit/deepfix/task3/Signup.p6.jsx` for the P6 cutover. See §D.
| **F4** | Result-card PASS/FAIL now reads the server's stored verdict (rides `SERVER_ATTEMPT_WRITE`, live); + `Number.isFinite` threshold guard | C-23 | none | **ACCEPT** |
| **F5** | `getAssignedListIds` fallback to `Object.keys(assignments)`; attempt `listId ?? parsedListId` | C-34 / C-35 gradebook data | none | **ACCEPT** |
| **F6** | Attempt-nonce store hardening — memoized nonce on degraded storage + `nonce_storage_degraded` log; healthy-storage output verified identical | I-5 / 06-29 save-outage | none | **ACCEPT** |
| **F7** | New `permission-denied` handlers → reload prompt + `legacy_write_denied` log (keys on ANY permission-denied) | pre-P6 defense | none | **ACCEPT** — rare edge (reachable if a student is unenrolled mid-session); acceptable |

## B · Ungated SERVER deltas (ship live in `--only functions`) — ACCEPTED / VERIFIED

| ID | Delta | Disposition |
|----|-------|-------------|
| **MED-1** | `gradeTypedTest` returns + caches `attemptDocId` (P3 nonce-F2 leg; additive, current client ignores it) | **ACCEPT** — additive, on the exception list |
| **MED-2** | `GRADE_TOKEN_MINT` was `true` in-tree | **RESOLVED** — flipped to `false`. **Both** `GRADE_TOKEN_ENFORCED` and `GRADE_TOKEN_MINT` are now `false` (= live prod); `mintTokens = MINT \|\| ENFORCED` ⇒ typed grading never touches `GRADE_TOKEN_SECRET`. |
| **MED-5** | `markReviewComplete` upgraded marker (traffic-dormant: `SERVER_REVIEW_MARKER` off + sole call site gated) | **ACCEPT/NOTE** — invocable-but-unreached; no security regression pre-P6 |

## C · Inert / observability (ship, no behavior change) — NOTED

| ID | Delta | Disposition |
|----|-------|-------------|
| **F8/F9** | Build stamp (`vite.config.js` + `main.jsx` + `buildStamp.js`): `window.__VOCABOOST_BUILD__` + one `console.info`; try/catch, never fails build | **ACCEPT** — approved ops/provenance side-effect (explicitly exempted from "zero side-effect") |
| — | Functions-emulator wiring (`firebase.js` + `firebase.json`, `VITE_USE_EMULATOR`-gated) | **NOTE** — test-only, off in prod → byte-equivalent |
| — | `sessionConfig` inert shape adds (cycling/nextList nulls) — sessionStorage-only, never written to Firestore | **NOTE** — verified no doc-level drift |

## D · NOT in this release (dormant / deferred — no action for the initial deploy)

- **All 8 flag-gated fixes** (SERVER_PROGRESS_WRITE / CHALLENGE / REVIEW_MARKER / RESET / OVERRIDE / TEACHER_IDS /
  CONTINUATION / CYCLING) — ship **dormant** (flags off); each flips at its own cutover.
- **U5 cycling intervention reset** — cycling-gated → inert here (CYCLING_ENABLED off).
- **`firestore.rules`** (P10d end-state) — **NOT deployed.** Codex BLOCKER: a bare deploy ships it. Rules deploy
  only at R1/R2/R3 per `DEPLOY_ORDER.md`.
- **Migration `--catchup` bugs (MED-3, MED-4)** — cutover-only (P5); tracked to fix **before P5**, out of this
  release's scope.
- **Backfills / claim migration** — P10c/P10d cutover, not now.
- **F1 — Signup teacher-onboarding redesign** (invite-code → `provisionTeacher`) — a **P6-cutover** change
  (`TEACHER_PROVISIONING_ENABLED` flips with the P6 rules). **Reverted out** of the initial release;
  today's teacher self-registration stays live. F1 preserved at `audit/deepfix/task3/Signup.p6.jsx` →
  re-apply at P6 together with `TEACHER_PROVISIONING_ENABLED=true` + `teacher_invites` docs + the P6 rules.

---

## E · Hard deploy-order invariants for THIS release
1. **indexes (step 1) built BEFORE hosting (step 3)** — F2.
2. **functions (step 2) before hosting (step 3)** — no longer hard-required (F1 excluded), but keep the order:
   functions ships DORMANT (no live client caller in this release) and landing it first is harmless + tidy.
3. **NO `firestore:rules`** in this release. **Never a bare `firebase deploy`.**
4. **No flag flips** — server `FOUNDATION_FLAGS`, `TEACHER_PROVISIONING_ENABLED`, and the 8 client flags stay off.

## F · David's pre-deploy VERIFY item
- **`firestore.indexes.json` must be the complete prod index catalog** before `--only firestore:indexes`
  (Fable NIT-3): a `--only firestore:indexes` deploy treats the file as authoritative and will propose
  **deleting** any prod index created in the console but absent from the file. Diff the file against the
  console's index list first.

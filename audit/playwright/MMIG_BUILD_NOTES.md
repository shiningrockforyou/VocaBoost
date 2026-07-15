# M-MIG BUILD NOTES — the migration-audit matrix (deepfix Task 5)

**Module:** `audit/playwright/lsr_deepfix_migrate_audit.mjs` (NEW). **Date:** 2026-07-14.
**Status:** BUILT + statically validated + parser/guard validated against LIVE read-only Firebase.
**Systems under test:** `scripts/cs/deepfix-migrate-list-progress.mjs` (P5, `P5-FND-3-v1`) and,
optionally, `scripts/cs/deepfix-migrate-attempts-teacherids.mjs` (P10c). **Not modified.**
**Design oracle:** `audit/deepfix/task4/AUDIT_DESIGN.md` §1.F (MIG-1..10) + §1.H RET-3 + §3/§4/§7.

This driver is a Node / Firebase-Admin **data**-audit runner (NOT a browser matrix). It seeds the
§1.F 25WT sandbox cohort, invokes the migration in `--dry` (WRITE-FREE) mode, parses the plan +
FINAL line, and asserts the MIG oracles against the `--dry` diff / a read-only post-image. It
**NEVER** runs `--commit`/`--catchup` — those are Codex's authorized Task-6 legs.

---

## CLI + modes
```
node audit/playwright/lsr_deepfix_migrate_audit.mjs <runId> [--dry-only] [--slack=7] [--keep] [--with-teacherids]
```
- **default (full dry audit)** — provision the dedicated 25WT MIG classes → seed the §1.F cohort →
  per-uid `--dry` → sandbox+allowlist re-verify → MIG oracle asserts. Runs in the **authorized env**
  (Admin-SDK writes seeds to sandbox 25WT). Requires the sandbox cohort + `scripts/serviceAccountKey.json`.
- **`--dry-only` (self-validation)** — NO live provisioning/seeding/migration, ZERO Firestore access.
  Validates the runner: imports resolve, the FINAL/JSON parser, and the oracle EVALUATORS against
  synthetic ± poisoned fixtures (the executable oracle-walk `SELF-EVAL`); marks every live MIG oracle
  `DEFERRED(env)`. This is the mode runnable in the WSL/build env. **Exit 0** on a clean self-check.
- Fail-closed manifest → `findings/deepfix_mig_<runId>.{json,md}`. **Nonzero exit on any FAIL/INVALID.**
  `DEFERRED` is honest (Codex's commit leg), never a false PASS, and never certifies alone.

---

## Oracle realization — read-only `--dry` asserts vs deferred to Codex's `--commit`

| Oracle | How realized | Leg |
|---|---|---|
| **MIG-1** LIVE-STRAND collapse | `--dry`: `after.twi == cross-class anchor nwei+1`; population `LIVE-STRAND`; action MIGRATE; A1/A3 clean. Seed `seedDualDocStrand` (doc A anchored ahead, doc B active behind by exactly `DAY_WORDS=80`). | **DRY** |
| **MIG-2** divergent + own-anchor CSD | `--dry`: `after.twi == fast anchor max (640)`; `after.csd == slow's higher day (15)`; 0 `CSD_IMPLAUSIBLE`; A7 clean. Seed `seedDivergentPace` (each doc has its OWN valid anchor). | **DRY** |
| **MIG-3** review-only CSD evidence | `--dry`: action MIGRATE; `after.csd` PRESERVED (not demoted to anchorDay); 0 `CSD_IMPLAUSIBLE`; A6 clean. Seed `seedReviewOnlyGapN` (anchor day 3 + 10 post-anchor review days → gap 10 **exceeds slack 7**, so the durable review-attempt evidence is LOAD-BEARING). | **DRY** |
| **MIG-4** forged/anchorless → QUARANTINE | `--dry` **partial**: action `SKIP_QUARANTINE` + `ANCHORLESS_TWI` + never zeroed/auto-promoted + invalidAnchor reported (legacy retained). Seed `seedForgedTwiHigh` (twi 2000, one INVALID-anchor attempt, no valid anchor). | **DRY** + **DEFERRED** |
| **MIG-5** single-doc 1:1 re-key | `--dry`: `after == verbatim` (csd/twi unchanged); population `single-doc`; 0 `singleDocDeviations`; droppedFields listed. Seed `seedSingleDoc`. | **DRY** |
| **MIG-6** idempotent re-run | `--commit` then re-run → SKIP_DONE / 0 diffs. Command in the manifest stub. | **DEFERRED** |
| **MIG-7** post-flip catch-up | needs `--commit` + a racing legacy write + `--catchup`. Fixture staged (`seedRacingLegacyWrite`); in `--dry` nothing is committed (0 `list_progress` in DB), so `--catchup` finds nothing. | **DEFERRED** |
| **MIG-8** errored-anchor abort | **code-walk** (`--dry`): the `computePair` try/catch → `QUAR.PAIR_ERROR` + `SKIP_ERROR` wrapper is present and the pool loop continues for other pairs. The invalid-anchor "moves nothing" arm is exercised live by MIG-4. A hard `computePair` THROW is **not deterministically seed-reproducible** (the script is defensively coded) — flagged. | **DRY (code-walk)** |
| **MIG-9** cohort hard asserts | `--dry` **partial**: A1/A2 empty cohort-wide (aggregated per-uid reports); the `--dry` diff artifact per uid; `migrationVersion` stamp; backups-per-source via `--dry --backup`. The post-commit twi/csd-**after** sweep on the WRITTEN docs is deferred. | **DRY** + **DEFERRED** |
| **MIG-10** CS toolchain retarget | **static (`--dry`)**: `manual-pass.mjs` writes the full valid anchor (MIG-10a — PASS at HEAD). Live sweep-flags-a-list_progress-corruption + manual-pass write = deferred. **MIG-10b** (sweep/census read `list_progress`) is a shipped-state oracle: empirically **NOT shipped at HEAD** (both still read `class_progress`) → reported `DEFERRED` with status. | **DRY (static)** + **DEFERRED** |
| **RET-3** legacy deletion + sweep clean | needs `--commit` + the P7 deletion script (`scripts/cs/deepfix-delete-legacy-class-progress.mjs` — **not present at HEAD**) + a `list_progress`-shaped sweep. | **DEFERRED** |

---

## The sandbox-allowlist guard (BINDING; AUDIT_DESIGN §4.1 guard 2)
The migration CLI offers only a **single** `--uid` (not a multi-uid allowlist), so the driver realizes
the "explicit uid allowlist" by **invoking the migration once per allowlisted seed uid**
(`25WT --dry --uid=<uid> --out-dir=<per-uid> --backup`), which bounds each plan to that uid. Then it
**independently re-verifies** — via a fresh Admin `.get()` of every source doc's class + `auth().getUser`
of the pair uid — that EVERY doc the plan enumerates is `25WT`-class + `lsr_*@vocaboost.test`:
- **Any non-sandbox doc → HARD ABORT (INVALID)**, never authorize. The class **name in the plan is not
  trusted** (the migration strips the `26SM ` prefix from its display name, `deepfix-migrate-list-progress.mjs:404`,
  so a 26SM doc could read un-prefixed) — the driver re-reads the class id (`docId.split('_')[0]`).
- **Any non-allowlisted (but sandbox) doc → INVALID** (fail-closed). With per-uid invocation this should
  be impossible; if it appears it signals a scoping bug.
- Empirically confirmed (read-only) against a real plan doc: `docId.split('_')[0]` → classId → name
  `"25WT PX L7 S1 fleet"` (startsWith 25WT ✓); uid → `lsr_s97@vocaboost.test` (lsr_* ✓) → GUARD PASS.

**Why per-uid and not a single cohort run:** a live probe found **164 of 200 classes are 25WT** with
**390 `class_progress` docs across 298 uids**. A cohort-wide `--dry 25WT` plan is dominated by
non-seeded (but sandbox) pairs, which the fail-closed allowlist would reject. Per-uid invocation keeps
the plan allowlist-bounded while the sandbox re-verify stays the hard 26SM guarantee.

---

## Reuse (AUDIT_DESIGN §7) + the one flagged deviation
- **Reused verbatim:** `assertSandboxTriple`, `db`, `getDocId`, `now`, `tsPlusDays`, `readListWordCount`,
  `uidByEmail`, `resetStudentState`, `SANDBOX` (from `lsr_reviewonly_fb.mjs`, re-exported by
  `lsr_deepfix_fb.mjs`); the manifest / findings / git-state / fail-closed-exit convention
  (`lsr_deepfix_static.mjs`). Every seed WRITE goes through the imported `assertSandboxTriple` FIRST.
- **DEVIATION (flagged):** AUDIT_DESIGN §3/§7 nominally place the §1.F MIG seeds
  (`seedDualDocStrand` / `seedDivergentPace` / `seedReviewOnlyGapN` / `seedForgedTwiHigh` /
  `seedRacingLegacyWrite` / plain single-doc) in `lsr_deepfix_fb.mjs`. **They did not exist there** at
  build time (that module only carries the RO/RS/CUT/CA/CY/OV seeds). To honor the task's "NEW file
  `<this>`" single-file constraint (modify no existing module), they are defined **locally in the
  driver**, reusing the imported guard verbatim. They are promotable to `lsr_deepfix_fb.mjs` by Codex.

---

## Calibration knobs
- **`--slack=N`** (default 7) — CSD-screen slack, passed to the migration. MIG-3's seed uses gap 10 so
  it exceeds slack 7; if slack is raised past 10 the review-evidence stops being load-bearing (re-tune `n`).
- **`DAY_WORDS = 80`** (migration constant) — the strand/stranded threshold. MIG-1's `seedDualDocStrand`
  puts doc B exactly 80 twi behind the anchor to hit `activeBehind` → `LIVE-STRAND`. If the migration's
  `DAY_WORDS` changes, re-tune the `twiB` offset.
- **Divergent population label** — MIG-2's design numbers (pace-80/day-8 vs pace-20/day-15) leave the
  slow doc 340 twi behind the anchor, so the migration labels the pair `stale-2nd-enroll`, **not**
  `divergent` (the `divergent` label needs all docs within `DAY_WORDS` of the anchor). The MIG-2 oracle
  asserts the **substantive merge result** (twi = fast anchor max, csd = slow's own-anchor day, not
  quarantined) and does NOT depend on the label — the own-anchor CSD screen is what MIG-2 certifies.
- **Cohort config** — `LSR_TEACHER`/`SL_STUDENTS` (>=6 lsr_* MIG students)/`LSR_TIER`; falls back to
  `lsr_accounts.json` + `lsr_lists.json`. Provisions deterministic classes `25WT MIG {DUALA,DUALB,DIVF,DIVS,POOL}`
  (idempotent by name). Default students `lsr_s90..s95` — override if those uids don't exist.
- **`--with-teacherids`** — also runs the P10c backfill `--dry` (MIG-TID). Default OFF: that script does
  one attempts query per cohort class (heavy on 164 sandbox classes).
- **Forged fixture** — `seedForgedTwiHigh(forgedTwi=2000)`; the per-uid `--dry` for this uid EXITS 2
  (NOT_READY, quarantine≥1) — EXPECTED; the driver tolerates the nonzero exit and still reads the report.

---

## MIG oracles I could NOT fully realize (flagged, per the task mandate)
1. **MIG-4 `{mode:'quarantined'}` canonical + blocked-study UX + `list_progress_quarantined` log** — the
   CURRENT migration script **skips** quarantined pairs (SKIP_QUARANTINE, legacy retained), it does **NOT
   write a quarantined canonical doc**. That `{mode:'quarantined'}` + blocked-study + log is the
   `resolveListProgress` **resolver** leg (CS-8), a separate mechanism, NOT this migration. The driver
   asserts the realizable half (skip + ANCHORLESS_TWI + never-zeroed) and DEFERS the resolver/E2E half.
2. **MIG-8 hard `computePair` abort** — verified by **code-walk** (try/catch → PAIR_ERROR/SKIP_ERROR +
   pool continues). No seed input **deterministically throws** inside `computePair` (defensive code), so
   the live "abort THIS student, continue others" path is code-walk-certified, not seed-triggered.
3. **MIG-10b sweep/census `list_progress` retarget** — **NOT shipped at HEAD** (both
   `data-integrity-sweep.mjs` and `deepfix-census2.mjs` still read `class_progress`, confirmed
   2026-07-14). Reported `DEFERRED` with status — a P7/F6-3 shipped-state oracle, not a migration FAIL.
4. **MIG-6 / MIG-7 / MIG-9-commit / MIG-10-commit / RET-3** — all require `--commit`/`--catchup` and are
   STUBBED as Codex Task-6 legs, each with the exact command + expected oracle in the manifest.
   RET-3 additionally needs the P7 deletion script, which does **not exist at HEAD**.

---

## Empirical grounding (live read-only Firebase, 2026-07-14)
- 200 classes; **164 are 25WT** (audit sandbox); 26SM present (never touched).
- **390 `class_progress` docs under 25WT across 298 uids**; **0 `list_progress` docs in the whole DB**
  (0 stamped) → the migration has been committed nowhere; MIG-9 A8 (zero pre-existing canonical) holds
  today and idempotency/catch-up/RET-3 are genuinely commit-time.
- A single **read-only `--dry --uid=<real sandbox uid>` run** validated the parser end-to-end: exit 0,
  `FINAL: READY asserts_failing=0 quarantine=0`, JSON schema exactly matching the pinned source
  (`:609-616`). That sample uid even carried a real dual-doc `stale-2nd-enroll` case (twi 1600 vs 960 →
  merged 1600) — the live shape MIG-1/MIG-5 target.

## Validation performed
| Check | Result |
|---|---|
| `node --check audit/playwright/lsr_deepfix_migrate_audit.mjs` | **PARSE OK** |
| `--dry-only` self-validation run | exit 0, `SELF_VALIDATED`; SELF-EVAL PASS (evaluators + parser vs synthetic ± poisoned), MIG-8/MIG-10a PASS, MIG-10b correctly DEFERRED |
| full-mode dynamic import `./lsr_deepfix_fb.mjs` | OK; **all 12 `FB.*` members present** (missing: NONE); `FieldValue.arrayUnion`/`Timestamp.now` available |
| parser vs REAL `--dry` output | matched (FINAL line + JSON schema) |
| sandbox-guard primitives vs a real plan doc | docId→classId split + 25WT name re-read + lsr_* auth-email re-read → GUARD PASS (sandbox); 26SM → ABORT |
| `--commit`/`--catchup` executed | **NO** (never — Codex Task-6). No 26SM touched. `change_action_log.md` NOT touched. |

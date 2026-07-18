# DEEPFIX PROGRAM AUDIT CERTIFICATION — `cert-59df732-r34`

> Consolidates the six deepfix matrices (M-STATIC · M-UI · M-WB · M-MIG · M-CALL · M-RULES) into ONE
> fail-closed program certification of FIX_PLAN P0–P10 (AUDIT_DESIGN task4 §2/§5/§6). INVALID ≠ PASS;
> a subset cannot certify.

## VERDICT: ❌ **NOT-CERTIFIED**

- **runId:** `cert-59df732-r34`
- **generated:** 2026-07-17T20:33:19.061Z
- **bound git HEAD:** `59df732657dfb742d4392a47ae5c1d988377387a`
- **bound sha256(firestore.rules):** `752981b78f532ebd737c521920a034038380c228aa6305844dc4f17fcde1aca9`
- **M-STATIC target:** `shipped`

### ❌ Blocking reasons (4)

- **[MISSING_MATRIX]** _(M-WB)_ M-WB (deepfix_wb_cert-59df732-r34.json) is ABSENT — a subset cannot certify (§2.1).
- **[MATRIX_NOT_CLEAN]** _(M-STATIC)_ M-STATIC NOT-CLEAN — fail=33 invalid=0 fatal=0 unknownVerdict=0 (self verdict: NOT_CLEAN).
- **[MATRIX_NOT_CLEAN]** _(M-UI)_ M-UI NOT-CLEAN — fail=2 invalid=0 fatal=1 unknownVerdict=0 (self verdict: NOT-CLEAN).
- **[COVERAGE_UNAUDITED]** 38 canonical scenario(s) have NO covering verdict in any matrix (nothing unaudited silently — §5): P1:RA1, P1:RA2, P1:RA3, P1:RA5, P1:RA5b, P1:RA6, P1:RA7, P1:RA8, P1:RA9, P1:RO-S10, P1:W-RA3g, P1:W-RA4, P1:W-RA4b, P2:RS-3, P2:RS-4, P4:CUT-2, P4:CUT-3, P4:CUT-4, P4:CUT-5, P4:CUT-6, P4:CUT-7, P4:CUT-8, P6:CUT-2, P6:CUT-6, P8:CA-1, P8:CA-2, P8:CA-3, P8:CA-4, P8:CA-5, P8:CA-6, P9:CY-1, P9:CY-2, P9:CY-4, P9:CY-5, P9:CY-6, P9:CY-7, P10:OV-4, P10:OV-5.

## Per-matrix summary

| | Matrix | present | runId-bound | clean | pass | fail | invalid | skip | deferred | fatal | self-verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ❌ | M-STATIC | true | true | false | 8 | 33 | 0 | 2 | 0 | 0 | NOT_CLEAN |
| ❌ | M-UI | true | true | false | 2 | 2 | 0 | 0 | 0 | 1 | NOT-CLEAN |
| ⬜ | M-WB | false | — | — | 0 | 0 | 0 | 0 | 0 | 0 | — |
| ✅ | M-MIG | true | true | true | 10 | 0 | 0 | 1 | 8 | 0 | NOT_CLEAN |
| ✅ | M-CALL | true | true | true | 21 | 0 | 0 | 2 | 0 | 0 | CLEAN |
| ✅ | M-RULES | true | true | true | 11 | 0 | 0 | 0 | 0 | 0 | CLEAN |

## Deployment / flag binding (§2.2)

- **git HEAD coherent:** ✅ M-STATIC=`59df732657`, M-UI=`59df732657`, M-MIG=`59df732657`, M-CALL=`59df732657`, M-RULES=`59df732657`
- **firestore.rules sha coherent:** ✅ M-RULES=`752981b78f53`
- **flag-set coherent:** ✅
- **flag-ON end-state:** M-CALL=flag-ON, M-RULES=flag-ON
- **M-STATIC target == shipped:** ✅ (`shipped`)

> Deferred provenance (flag): the deployed `exports.version` sha (DG-2) + hosting build-stamp sha (DG-3) of §2.2(a)/(b)
> are SKIP in M-STATIC (no live network) and are NOT present in any finding-JSON at HEAD — Codex must bind them at Task-6.

## §5 coverage map (FIX_PLAN phase → scenarios → verdict)

| | Phase | Scope | covered | scenarios (verdict) |
|---|---|---|---|---|
| ❌ | **P0** FND-0 deploy-safety substrate | 4 | 4/4 | DG-1·FAIL, DG-2·SKIP, DG-3·SKIP, DG-4 |
| ❌ | **P1** RO review-only completion (S1–S10) | 15 | 2/15 | RA1·UNCOVERED, RA2·UNCOVERED, RA3·UNCOVERED, RA5·UNCOVERED, RA5b·UNCOVERED, RA6·UNCOVERED, RA7·UNCOVERED, RA8·UNCOVERED, RA9·UNCOVERED, RO-S1·FAIL, RO-S9, RO-S10·UNCOVERED, W-RA3g·UNCOVERED, W-RA4·UNCOVERED, W-RA4b·UNCOVERED |
| ❌ | **P2** RS read/render truth surfaces | 4 | 2/4 | RS-1, RS-2·FAIL, RS-3·UNCOVERED, RS-4·UNCOVERED |
| 🟡 | **P3** FND-1 server surface | 12 | 12/12 | CS-1, CS-2, CS-3, CS-4, CS-5, CS-6, CS-7·SKIP, CS-8, CS-9, CS-10·SKIP, CS-11, DG-2·SKIP |
| ❌ | **P4** FND-2 client cutover | 9 | 2/9 | CUT-1·FAIL, CUT-2·UNCOVERED, CUT-3·UNCOVERED, CUT-4·UNCOVERED, CUT-5·UNCOVERED, CUT-6·UNCOVERED, CUT-7·UNCOVERED, CUT-8·UNCOVERED, DG-3·SKIP |
| 🟡 | **P5** FND-3 data migration | 10 | 10/10 | MIG-1, MIG-2, MIG-3, MIG-4, MIG-5, MIG-6·DEFERRED, MIG-7·DEFERRED, MIG-8, MIG-9, MIG-10 |
| ⛔ | **P6** FND-4 cutoff rules matrix | 12 | 10/12 | RUL-1, RUL-2, RUL-3, RUL-4, RUL-5, RUL-6, RUL-7, RUL-8, RUL-9, CUT-2·UNCOVERED, CUT-6·UNCOVERED, CS-6 |
| ❌ | **P7** FND-5 retirement | 4 | 4/4 | RET-1·FAIL, RET-2·FAIL, RET-3·DEFERRED, RET-4·FAIL |
| ⛔ | **P8** CONT-A continuation | 6 | 0/6 | CA-1·UNCOVERED, CA-2·UNCOVERED, CA-3·UNCOVERED, CA-4·UNCOVERED, CA-5·UNCOVERED, CA-6·UNCOVERED |
| ⛔ | **P9** CYC cycling | 7 | 1/7 | CY-1·UNCOVERED, CY-2·UNCOVERED, CY-3, CY-4·UNCOVERED, CY-5·UNCOVERED, CY-6·UNCOVERED, CY-7·UNCOVERED |
| ⛔ | **P10** OVR override + challenge redesign | 6 | 4/6 | OV-1, OV-2, OV-3, OV-4·UNCOVERED, OV-5·UNCOVERED, OV-6 |

## DEFERRED / SKIP ledger (SKIP ≠ PASS)

Observed not-executed legs (13); UNEXPECTED off-ledger (0):

| | Matrix | Scenario | Verdict | On documented ledger? |
|---|---|---|---|---|
| 🕓 | M-STATIC | DG-2 | SKIP | yes |
| 🕓 | M-STATIC | DG-3 | SKIP | yes |
| 🕓 | M-MIG | MIG-10b | DEFERRED | yes |
| 🕓 | M-MIG | MIG-9-backup | DEFERRED | yes |
| 🕓 | M-MIG | MIG-7 | DEFERRED | yes |
| 🕓 | M-MIG | MIG-TID | SKIP | yes |
| 🕓 | M-MIG | MIG-6 | DEFERRED | yes |
| 🕓 | M-MIG | MIG-7 | DEFERRED | yes |
| 🕓 | M-MIG | MIG-9-commit | DEFERRED | yes |
| 🕓 | M-MIG | MIG-10-commit | DEFERRED | yes |
| 🕓 | M-MIG | RET-3 | DEFERRED | yes |
| 🕓 | M-CALL | CS-7 | SKIP | yes |
| 🕓 | M-CALL | CS-10 | SKIP | yes |

**Documented ledger (what is legitimately NOT executed here):**
- **M-STATIC** — `DG-2`, `DG-3`, `DG-4b`, `CUT-1b`: deployed-probe / built-bundle legs — no live network or local dist/ in M-STATIC (§6.1/§1.A). Codex supplies the deployed exports.version (DG-2) + hosting build-stamp (DG-3) + bundle greps (DG-4b/CUT-1b) at Task-6.
- **M-CALL** — `CS-7`, `CS-10`, `CY-3`: CS-7/CS-10 are secret-backed (GRADE_TOKEN_SECRET / ANTHROPIC_API_KEY; the grading-job recovery suite runs against the deployed functions, not the emulator — CS-10 note). CY-3 is gated on CYCLING_ENABLED(server) in the loaded flag-set (§1.J parameterized). NOTE: at the true end-state these should EXECUTE, not defer.
- **M-MIG** — `MIG-6`, `MIG-7`, `MIG-9-commit`, `MIG-10-commit`, `RET-3`, `MIG-TID`, `MIG-9-backup`, `MIG-10b`: write-guarded --commit/--catchup legs (MIG-6/7/9c/10c/RET-3) + the opt-in P10c teacherIds --dry (MIG-TID) + status legs (--dry --backup shared dir MIG-9-backup; F6-3 sweep/census retarget MIG-10b) — Codex Task-6 authorized-commit (§1.F/§1.H/§6). IMPORTANT: the DRY oracles MIG-1..5/MIG-8/MIG-9/MIG-10a are NOT on this ledger — they MUST PASS in the full-dry run. A --dry-only M-MIG leaves MIG-1..5/9 DEFERRED ⇒ P5 unaudited ⇒ NOT-CERTIFIED.

## §6 NOT-re-executed ledger (verified-as-artifact / live-ops / mechanism — by design)

These FIX_PLAN criteria are NOT re-executed by this audit; the program certification requires the
bound gate artifacts to EXIST (missing artifact = INVALID, never PASS — §6). This cert ENUMERATES
them; the artifacts themselves live outside the finding-JSON inputs (Codex/David confirm at Task-6).

| Ref | Class | Item | Requires |
|---|---|---|---|
| §6.1 | transition-window | P4 "resolver wrote ZERO canonical docs before P5" | the P4-era gate manifest; end-state substitute = MIG-9 single-writer trace + CS-8 straggler path |
| §6.2 | transition-window | P3 resolver READ-ONLY mode behavior | end-state corollary (canonical-first + straggler hydrate) certified by CS-8 |
| §6.3 | transition-window | P6 14-day no-legacy-write window + build-version census [C8-1] + 26SM quarantine=0 [C7-2]; P7 7-day zero-denial window | dated live-window artifacts |
| §6.4 | procedural | P0/P5/P6 authorization chain (David scoped commit + CS-event SUPPORT_RUNBOOK entries) | procedural sign-off artifacts |
| §6.5 | live-ops | F-4 H/P/B before/after motion per phase (the program metric) | live 26SM census via the MIG-10-audited toolchain — FORBIDDEN to this audit; mechanism certified |
| §6.6 | live-ops | M4 shadow false-reject ≈ 0 over ≥14 days of live traffic (P3) | a soak artifact; the shadow/enforce mechanism is certified by CS-6 |
| §6.7 | live-ops | P1/P3 G5 watch-window signals (permission-denied thresholds, rollback clock) | live monitoring dashboards |
| §6.8 | live-ops | population drains (183-wall P1, 63-pending P8, F-6 permafail→0 P10, 531 impossible_phase→0 P4) | live census; the per-student mechanism is certified by the sandbox personas |
| §6.9 | mechanism-dependent | RUL-8 teacher-provisioning ALLOW arm (David decision 10) | concretized at implementation review; the DENY arm is fully audited (RUL-8) |
| §6.10 | procedural | P0 "never bare firebase deploy" standing rule | DG-2/DG-3 provenance equality after every recorded deploy |

---
_Program CERTIFIED iff: (1) all six matrices present, (2) each ALL-CLEAN, (3) binding coherent, (4) §5
coverage complete — and (5) every SKIP/DEFERRED is on the ledger. Nonzero exit if NOT-CERTIFIED._
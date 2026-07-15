# CERT BUILD NOTES — the program certification consolidator (deepfix Task 5, final piece)

**Module:** `audit/playwright/lsr_deepfix_cert.mjs` (NEW). **Date:** 2026-07-14.
**Status:** BUILT + `node --check` clean + SELF-VALIDATED (12/12 synthetic cases) + real file-path smoke-tested.
**Consumes:** the six deepfix matrices' `findings/deepfix_{static,ui,wb,mig,call,rules}_<runId>.json`.
**Produces:** `findings/DEEPFIX_AUDIT_CERT_<runId>.{md,json}`.
**Design oracle:** `audit/deepfix/task4/AUDIT_DESIGN.md` §2 (fail-closed cert + artifact binding), §5 (coverage
map), §6 (NOT-re-executed ledger). **Reuses** the fail-closed self-binding cert pattern of
`lsr_fleet_manifest.mjs`. **Does NOT import or modify any vocaBoost source** — it only reads finding-JSONs
(or, in `--self-check`, synthetic in-memory sets). **`change_action_log.md` intentionally untouched** (per the
task constraint).

The REAL program cert runs at **Codex's Task-6** after all six matrices produce their `<runId>` findings.
This build + self-validation proves the consolidation logic executes correctly WITHOUT a live run
(the way M-MIG's `--dry-only` self-check proves its evaluators).

---

## CLI

```
node audit/playwright/lsr_deepfix_cert.mjs <runId> [--self-check] [--findings=<dir>]
```

- **`<runId>` (real path)** — reads the six `deepfix_<key>_<runId>.json`, consolidates, writes
  `DEEPFIX_AUDIT_CERT_<runId>.{md,json}`. **Exit 0 iff CERTIFIED, else 1.**
- **`--self-check`** — runs the cert logic against SYNTHETIC in-memory matrix-finding sets (writes nothing).
  A clean set ⇒ CERTIFIED; a FAIL / a missing matrix / binding mismatches / off-ledger skips ⇒ NOT-CERTIFIED
  for the right reason each. **Exit 0 iff every synthetic expectation held.**
- **`--findings=<dir>`** — override the findings dir (default sibling `./findings`). Used for the smoke test.

---

## The exact matrix-JSON schema consumed (per matrix, verified against source + real artifacts)

The six matrices write **three different native schemas**; the consolidator NORMALIZES them to one shape.
Per-scenario verdicts live in either `assertions[]` (STATIC/MIG) or `results[]` (UI/WB/CALL/RULES); each row
has `{id, verdict}` (`verdict ∈ {PASS, FAIL, INVALID, SKIP[, DEFERRED]}`).

| Matrix | file | results array | git head | rules sha | flag-set | phase/target marker | own top verdict |
|---|---|---|---|---|---|---|---|
| M-STATIC | `deepfix_static_<runId>.json` | `assertions[]` `{id,scenario,description,expected,actual,verdict,evidence}` | `git.head` | — | (DG-1 assertions) | `target` = `baseline`\|`shipped` | `CLEAN`\|`NOT_CLEAN` |
| M-UI | `deepfix_ui_<runId>.json` | `results[]` `{id,verdict,confirmed,detail,studentUid,classId,listId,…}` | `gitHead` | — | — | `base`,`buildId`,`fatals[]` | `PASS`\|`NOT-CLEAN` |
| M-WB | `deepfix_wb_<runId>.json` | `results[]` (same shape as UI) | `gitHead` | — | — | `base`,`buildId`,`fatals[]` | `PASS`\|`NOT-CLEAN` |
| M-MIG | `deepfix_mig_<runId>.json` | `assertions[]` `{id,scenario,expected,actual,verdict,evidence,kind}` | `git.head` | — | — | `migrationVersion`; `clean` bool | `SELF_VALIDATED…`\|`DRY_CLEAN…`\|`NOT_CLEAN` |
| M-CALL | `deepfix_call_<runId>.json` | `results[]` `{id,scenario,expected,actual,verdict,evidence}` | `git.head` | `rulesSha256` | `flagSet{…}` | `emulator{…}` | `CLEAN`\|`NOT_CLEAN` |
| M-RULES | `deepfix_rules_<runId>.json` | `results[]` (same as CALL) | `git.head` | `rulesSha256` | `flagSet{…}` | `emulator{…}` | `CLEAN`\|`NOT_CLEAN` |

All six carry a top-level `runId` (the consolidator SELF-BINDS on it — see fail-closed rule 1b). M-UI/M-WB
additionally carry a `fatals[]` array (PH-6 app-health signals); a non-empty `fatals` breaks that matrix's clean.
`summary{pass,fail,invalid[,deferred],skip}` is present on STATIC/MIG/CALL/RULES; the consolidator RE-DERIVES
counts from the per-scenario rows (defense-in-depth) rather than trusting the matrix's own summary.

**Sub-scenario ids.** The matrices emit finer ids than the §5 canonical set: `DG-1:<FLAG>`, `RET-2:<key>`,
`CS-4a/b/c`, `CS-6f/v`, `CS-8a/b/c`, `CS-11m/a`, `OV-3c/p`, `OV-6w/r`, `DG-4b`, `MIG-10a/b`, `RA5b`, `W-RA4b`,
`RO-S10`, `MIG-9-commit`, … Coverage matching therefore uses `baseId()` (strip `:flag`) + `familyId()`
(collapse a trailing lowercase-letter suffix that follows a digit: `CS-4a→CS-4`, `MIG-10a→MIG-10`, `RA5b→RA5`;
`RO-S10`/`MIG-9-commit` are left intact). Exact-base is preferred; the family collapse is the fallback.

---

## Certification logic (fail-closed; CERTIFIED iff zero blocking reasons)

Each check appends a structured `{code, matrix?, detail}` reason; `reasons.length===0 ⇒ CERTIFIED`. Reason codes:

1. **`MISSING_MATRIX`** — any of the six absent for the runId (subset cannot certify, §2.1).
   **`RUNID_MISMATCH`** — a matrix's internal `runId` ≠ the requested runId (self-binding, the `lsr_fleet_manifest`
   lesson: a copied/misnamed clean artifact can't be counted for this slot). **`PARSE_ERROR`** — malformed JSON.
2. **`MATRIX_NOT_CLEAN`** — a matrix has `fail>0` OR `invalid>0` OR `fatal>0` OR an unknown verdict OR is
   runId-unbound (INVALID ≠ PASS, §2.3). SKIP/DEFERRED are accounted in rule 5, not clean-breaking here.
3. Binding coherence (§2.2): **`BINDING_GIT_HEAD`** (matrices ran different git HEADs), **`BINDING_RULES_SHA`**
   (M-CALL/M-RULES bound different `sha256(firestore.rules)`), **`BINDING_FLAGSET`** (their flag-sets disagree),
   **`BINDING_FLAG_OFF`** (a required end-state server flag is not `true` — a dark/flag-off probe can't certify),
   **`BINDING_STATIC_TARGET`** (M-STATIC `target ≠ shipped` — a baseline static run is incoherent with the
   flag-ON matrices).
4. **`COVERAGE_UNAUDITED`** — a canonical §5 scenario has NO covering verdict in any matrix (nothing unaudited
   silently). The per-phase table shows each scenario's rolled-up verdict; a phase with zero covered scenarios,
   or any uncovered scenario, blocks.
5. **`UNEXPECTED_SKIP`** — a SKIP/DEFERRED leg NOT on the documented ledger (SKIP ≠ PASS, §2 req 5).
6. §6 NOT-re-executed ledger — ENUMERATED in the output (requirement 6); see the "flagged" section for why it
   is not a numeric gate.

**Exit:** real path `process.exit(CERTIFIED ? 0 : 1)`; the artifact is written on BOTH verdicts.

### The DEFERRED ledger (what is legitimately NOT executed)

| Matrix | ledgered ids | why |
|---|---|---|
| M-STATIC | `DG-2, DG-3, DG-4b, CUT-1b` | deployed-probe / built-bundle legs — no live network / dist/ in M-STATIC (§6.1) |
| M-CALL | `CS-7, CS-10, CY-3` | CS-7/CS-10 secret-backed (grading-job suite → deployed fns, not emulator); CY-3 gated on `CYCLING_ENABLED(server)` (§1.J) |
| M-MIG | `MIG-6, MIG-7, MIG-9-commit, MIG-10-commit, RET-3, MIG-TID, MIG-9-backup, MIG-10b` | write-guarded `--commit`/`--catchup` legs + opt-in P10c `--dry` + status legs — Codex Task-6 |
| M-UI / M-WB / M-RULES | (none) | every attempted scenario must PASS |

**Deliberately NOT on the ledger:** the M-MIG DRY oracles `MIG-1..5 / MIG-8 / MIG-9 / MIG-10a`. They must PASS
in the full-dry run. A **`--dry-only` M-MIG** (which marks `MIG-1..5/9` DEFERRED — confirmed against the real
`deepfix_mig_mig-selfcheck.json`) therefore yields `UNEXPECTED_SKIP` ⇒ **NOT-CERTIFIED** (P5 unaudited). This is
the intended fail-closed behavior: a self-validation M-MIG cannot certify the migration.

---

## Self-validation (`--self-check`) — 12/12 PASS, exit 0

Builds SYNTHETIC native-schema raws (so the normalizer is exercised too) and asserts each case's verdict +
reason codes:

| # | injected fault | expected |
|---|---|---|
| 0 | all-clean, fully-covered, flag-ON, shipped | **CERTIFIED**, zero reasons |
| 1 | FAIL in M-CALL (CS-1) | NOT-CERTIFIED · `MATRIX_NOT_CLEAN` |
| 2 | M-RULES absent | NOT-CERTIFIED · `MISSING_MATRIX` (+ `COVERAGE_UNAUDITED`) |
| 3 | M-STATIC different git HEAD | NOT-CERTIFIED · `BINDING_GIT_HEAD` |
| 3b | M-RULES different rules sha | NOT-CERTIFIED · `BINDING_RULES_SHA` |
| 3c | M-STATIC target=baseline | NOT-CERTIFIED · `BINDING_STATIC_TARGET` |
| 3d | M-CALL flag-OFF (`ANCHOR_VALIDATION_ENFORCE:false`) | NOT-CERTIFIED · `BINDING_FLAG_OFF` (+ `BINDING_FLAGSET`) |
| 4 | off-ledger SKIP (M-UI CA-1) | NOT-CERTIFIED · `UNEXPECTED_SKIP` |
| 4b | `--dry-only` M-MIG (MIG-1 DEFERRED) | NOT-CERTIFIED · `UNEXPECTED_SKIP` |
| 5 | wrong internal runId (M-WB) | NOT-CERTIFIED · `RUNID_MISMATCH` |
| 6 | coverage hole (drop P8 CA-*) | NOT-CERTIFIED · `COVERAGE_UNAUDITED` |
| 7 | kitchen-sink (FAIL + missing + binding + off-ledger skip) | NOT-CERTIFIED · multi-code |

Also smoke-tested the REAL file path against a scratch findings dir: six clean synthetic files ⇒ CERTIFIED /
exit 0 / artifacts written; all-six-missing ⇒ NOT-CERTIFIED / exit 1 / artifact still written.

---

## AUDIT_DESIGN §2/§5/§6 requirements NOT fully encodable here (FLAGGED for Codex Task-6)

1. **§2.2(a)/(b) deployed-artifact provenance is NOT bindable from the finding-JSONs.** The cert binds the
   git-HEAD + `sha256(firestore.rules)` + flag-set coherence it CAN observe, but the deployed `exports.version`
   `{sha,flags}` (DG-2) and the hosting build-stamp sha (DG-3) are **SKIP in M-STATIC** (no live network) and
   appear in NO finding-JSON at HEAD. So the cert cannot prove "what was deployed == what was tested" at the
   Cloud-Functions/Hosting layer. **Codex must capture DG-2/DG-3 (a live HTTPS probe) at Task-6** and confirm
   they equal the bound git HEAD; the cert output states this explicitly.
2. **§2.4 "the §6 artifact ledger complete" is ENUMERATED, not verified.** The transition-window manifests
   (§6.1/§6.2), the dated live-window artifacts (§6.3), and the procedural authorization chain (§6.4/§6.10) live
   OUTSIDE the finding-JSON inputs. Per requirement 6 the cert enumerates them (the §6 table); it cannot check
   their existence. A human/Codex must confirm those gate artifacts exist before final program sign-off.
3. **`MIG-10b` (F6-3 sweep/census retarget) is on the DEFERRED ledger, but at the true shipped end-state it
   should PASS**, not defer. It is ledgered to match M-MIG's own "DEFERRED-with-status" design (the retarget is
   not shipped at HEAD). If Codex requires the retarget enforced for cert, remove `MIG-10b` from the M-MIG ledger.
4. **Operational: each matrix must be run ONCE with the FULL scenario set under the SAME explicit `<runId>`.**
   M-UI in particular can be invoked per-block (`DFX_SCENARIOS`); a partial run leaves canonical scenarios
   UNCOVERED ⇒ `COVERAGE_UNAUDITED` (correctly fail-closed, "subset runs cannot certify"). And every matrix must
   be given the same explicit runId (e.g. `lsr_deepfix_static.mjs --run=<runId>`), else `RUNID_MISMATCH`.
5. **Coverage sub-scenario matching is heuristic** (`baseId`/`familyId`). In a pathological case a sub-scenario
   (e.g. `W-RA4b`) could count as covering its canonical parent (`W-RA4`) even if the parent's own leg were
   absent. Mitigated by exact-base-first; both real legs exist in the shipped matrices, so this does not arise in
   practice. Flagged for completeness.
6. **The §5 "cross-cutting invariants" row is not separately gated** — it references already-covered scenario
   ids (RA5b/RA8/CS-2..6/CS-8/CS-9/CUT-2..4/MIG-1..9/RUL-3..4), so it introduces no new coverage obligation
   beyond the P0–P10 rows.

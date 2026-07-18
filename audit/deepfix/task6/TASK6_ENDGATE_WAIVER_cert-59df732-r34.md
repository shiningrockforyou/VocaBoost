# TASK-6 END-GATE — FORMAL WAIVER + acceptance-model correction (`cert-59df732-r34`)

> **This is NOT `lsr_deepfix_cert.mjs` strict certification.** It is a formal, evidence-bound waiver that
> **requires David's explicit acceptance** to close D1 (per Codex end-gate r16 Path B). Codex validates the
> model; David accepts the basis.
>
> ## ✅ ACCEPTED by David — 2026-07-17. **D1 is CLOSED** on this basis (Codex r17 = MODEL-SOUND).
> The strict `lsr_deepfix_cert.mjs` cert becomes the post-P7 final gate. D2/P3 may now proceed once its OTHER
> gates hold (C2/PR-2 ✅ Codex-GO'd, A2 invariant suite, the exact 7-flag D2 discipline).

## 1 · The structural finding (why the strict cert cannot pass pre-cutover)
`lsr_deepfix_cert.mjs` certifies the **retired P0–P10+P7 flag-ON END-STATE** (`DEEPFIX_AUDIT_CERT_cert-59df732-r34.md`,
VERDICT NOT-CERTIFIED). Its §5 coverage requires scenarios that **cannot exist until the cutover ships**:
- **P4** `CUT-1..8` (client cutover), **P5** `MIG-6/7/9c/10c` commit legs, **P6** `RUL-*` cutoff-rules end-state,
  **P7** `RET-1/2/4` (which **FAIL by design until P7 retires the dead branches**), **P8** `CA-*`, **P9** `CY-*`,
  **P10** `OV-4/5` — the **38 COVERAGE_UNAUDITED** scenarios + the M-STATIC `target==shipped` NOT_CLEAN(33) are
  *the un-shipped end-state*, not defects.
- Proven 3 ways (WinClaude r34): (source) M-STATIC `--target=shipped` requires `target==shipped AND all-clean`,
  **mutually exclusive at a pre-retirement HEAD**; (deploy) **DG-2** = deployed functions@`a967f54` with **all
  server flags FALSE**, **DG-3** = hosting@`59df732` ⇒ prod runs flag-OFF server + PR-1 client — the flag-ON
  end-state is **not deployed**; (cert) NOT-CERTIFIED on `MISSING_MATRIX(M-WB)` + `MATRIX_NOT_CLEAN` + `COVERAGE_UNAUDITED(38)`.

**⇒ The single-runId strict cert is a POST-P7 artifact by construction — its `NOT-CERTIFIED` at `59df732` is
structurally UNREACHABLE pre-cutover, NOT a product failure. Gating D2 on it is circular** (it can only
pass after D2–D9 ship). The roadmap D1 was mis-sequenced.

## 2 · The corrected acceptance model (proposed)
- **Each phase's activation is gated on ITS OWN audit coverage being green** — not on the full end-state cert.
- **The full `lsr_deepfix_cert.mjs` strict cert runs POST-P7** as the FINAL acceptance gate (it IS the "extensive
  post-cutover full-UI prod audit" domain David already directed).
- **D2 / P3 activation is supported NOW**: the P3 server surface it activates is **fully audited + green** —
  **M-CALL CLEAN 21/0** (flag-ON emulator), **P3 coverage 12/12** (10 executed-green + `CS-7`/`CS-10` = documented
  **skips-on-ledger** [secret-backed grading-recovery legs, NOT the core progress-authority flip] + DG-2),
  **M-RULES CLEAN 11/0**. **This waiver resolves ONLY the D1 audit-binding — D2 ALSO requires (per roadmap)
  C2/PR-2 [Codex-GO'd r15], A2, and the exact 7-flag D2 discipline incl. the 2 PR-2 flags.**

## 3 · Bound pre-cutover evidence (`cert-59df732-r34`, git-head coherent = `59df732`)
| Matrix | Result | Bound |
|---|---|---|
| M-CALL | **CLEAN 21/0** flag-ON emu | gitHead 59df732 |
| M-RULES | **CLEAN 11/0** flag-ON emu | gitHead 59df732 · rulesSha `752981b78f53` (r16 gap FIXED — sha256File Windows-incompat → Node crypto) |
| M-MIG `--dry` | **10/0/0** oracles (8 commit legs DEFERRED-on-ledger) | gitHead 59df732 |
| M-STATIC | **baseline CLEAN 41/0** (shipped-target NOT_CLEAN = §1 structural) | gitHead 59df732, target==shipped |
| DG-2 | deployed functions@`a967f54`, all server flags FALSE | live probe |
| DG-3 | hosting build-stamp @ `59df732` | live probe |

**Binding precision (Codex r17):** M-CALL is runId/git-head/flag-set/emulator-bound — it does NOT exercise Firestore
rules, so it is **not** rules-sha-bound (`deepfix_call…rulesSha256:null` is correct); only **M-RULES** is
rules-sha-bound (`752981b78f53`); M-MIG is runId/git-head bound. Authenticated DG-2 (`deepfix_dg2_auth…`) is the
binding probe (the unauthenticated one 401s).

## 4 · Deferred (to each phase's post-ship audit + the final strict cert)
- The **38 later-phase scenarios** (P4 CUT-*, P5 MIG-commit, P6 RUL-*, P7 RET-retired, P8 CA-*, P9 CY-*, P10 OV-*)
  — each certified when its phase ships + at the final post-P7 strict cert.
- **M-WB** — BLOCKED (LOCAL-ONLY guard can't run vs prod deployment; 0-PASS wb-r13/14/25); the **6 W-* are
  harness-artifacts, 0 product-defects**, every W-* behavior covered by **CLEAN M-CALL/M-RULES**. To be run flag-ON
  at the end-state (emulator+Vite+P6-rules) or formally substituted by M-NET (3/3) — David/Codex's call.
- **flag-ON M-UI** — the 38 flag-ON-client-UI scenarios, deferred to the post-cutover full-UI prod audits.

## 5 · Triaged (NOT product defects)
- **M-UI RO-S1 FAIL** = harness-vs-new-MCQ-review-flow calibration (r33 PROVED PR-1 completes→advances on 2 accounts).
- **M-UI RS-2 FAIL** = seed drift / harness — **PR-1 touches ZERO gradebook or attempt-write code** (verified
  `git diff 4b8452a..59df732`); a review attempt's gradebook fields are identical pre/post-PR-1.

## 6 · The ask (D1 close)
**🔵 DAVID:** accept this as the D1 **pre-cutover** acceptance basis — the strict cert becomes the **post-P7 final
gate**, and D2/P3 proceeds on the green P3 coverage above. **CODEX (r17):** validate the corrected model
(per-phase gating + post-P7 strict cert) is sound and the bound evidence is coherent. Until David accepts, D1 —
and therefore the deepfix cutover D2+ — remains OPEN. *(PR-3 is independent of D1/D2 and can ship on its own gates.)*

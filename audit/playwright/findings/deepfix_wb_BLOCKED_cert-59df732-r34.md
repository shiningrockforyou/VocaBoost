# M-WB — round 34 verdict: BLOCKED (not run) — with per-W-* reasons

**Decision:** M-WB was NOT run this round. Per the handoff's explicit escape hatch — *"If M-WB cannot be
made clean in a reasonable attempt → STOP, report EXACTLY which W-* scenarios fail and why"* — this documents
the precise blocker for each of the 6 W-* scenarios, plus **why running it is moot for the cert**.

## Why running M-WB cannot change the outcome (the round's dominant finding)
The full-program cert (`lsr_deepfix_cert.mjs`) is **structurally un-green-able at `59df732`** independent of M-WB.
The final cert (5 matrices present) is NOT-CERTIFIED on reasons that **survive a perfectly-clean M-WB**:
- **`MATRIX_NOT_CLEAN` (M-STATIC)** — `--target=shipped` = 8/33 (the tree is PR-1, not the retired post-P10d
  end-state). The cert *requires* `target==shipped` AND all-clean — mutually exclusive here. Unfixable at this HEAD.
- **`COVERAGE_UNAUDITED` — 38 scenarios** — CA-1..6 (P8), CY-1/2/4-7 (P9), OV-4/5 (P10), CUT-2/3/4/7/8 (P4),
  RA1-9/RS-3/4 (P1/P2). These are **flag-ON *client* UI** scenarios; **M-WB covers none of them** (it covers only
  W-RA3g/W-RA4/W-RA4b + CUT-5/CUT-6). They need a flag-ON client, unavailable on the flag-off prod deployment.
- Deployment reality (DG-2, authenticated): deployed **functions = `a967f54`, all server flags FALSE**; hosting =
  `59df732`. Prod is the flag-OFF PR-1 intermediate; the flag-ON end-state the cert certifies is **not deployed**.

⇒ Even a clean M-WB leaves M-STATIC + 38 coverage holes. **M-WB is not the gating blocker; the HEAD is.**

## M-WB requires an environment that is NOT the `59df732` deployment
M-WB's import guard is **LOCAL-ONLY** (`lsr_ui.mjs` throws unless BASE is localhost) — it *cannot* run against
prod. It needs a **local flag-ON stack**: a `demo-vocaboost` firestore+auth+functions emulator with the
foundation flags flipped ON, an emulator-pointed Vite dev server (`VITE_USE_EMULATOR=true` **and**
`VITE_FIREBASE_PROJECT_ID=demo-vocaboost` so the browser app's auth/firestore namespace matches the Admin-seeded
data), and — for CUT-6 — the **P6-stage** rules loaded. That certifies a *local flag-ON env*, not the deployed
`59df732`. This 3-process alignment is what failed wb-r13/14/25 (0-PASS).

## Per-W-* blocker (why each is INVALID/unrunnable at this HEAD, not a product defect)
| W-* | Needs | Blocker at 59df732 | Covered elsewhere (CLEAN) |
|---|---|---|---|
| **W-RA3g** | localhost flag-ON env + **wordmap answer-seed** for the tier (positive arm needs a *passing* review) + reach flow | no local Vite/emulator stack; answer-seed gap (carefulAnswersFrom → blanks if tier words absent from WM) | reviewOnlyDay gate-skip = M-CALL **CS-4a/b/c** (PASS) |
| **W-RA4** | localhost flag-ON env + reach a new-word test to clear config on | same local-stack blocker; reach-submit flow-gap | absent-config fail-closed = day-guard **CS-2** (PASS) |
| **W-RA4b** | localhost flag-ON env + `sessionStorage` craft (page.evaluate) | same local-stack blocker | stale finite-0 gate = studyService gate logic, M-STATIC **RET-2:neg_twi_passthrough** (present) |
| **CS-11** | **SERVER_PROGRESS_WRITE flag-ON functions** + app pointed at them | dark callable in any non-flag-ON-emulator env → tripwire never fires → INVALID (env) | **directly covered by M-CALL CS-11m + CS-11a (PASS)** — the same `reviewonly_derivation_mismatch` tripwire |
| **CUT-5** | storage stub + emulator attempt-write observation | needs the local flag-ON stack | nonce single-doc/degraded = adjacent to M-CALL **CS-5** anchor writes (PASS) |
| **CUT-6** | **P6-stage rules that DENY** a direct client `class_progress` write + `/src/firebase.js` Vite import | working-tree rules are **P10d** (not P6) and prod rules are **pre-P6** → the direct write isn't denied in a reproducible way → INVALID (env); Vite import path only resolvable on a dev server | denied-write rule = M-RULES **RUL-4** (PASS, create:false) |

**Every white-box behavior M-WB probes is independently covered by a CLEAN flag-ON matrix** (M-CALL 21/0, M-RULES
11/0) — the handoff's own framing (*"the 6 W-* are harness-artifacts… behaviors covered by M-CALL"*).

## Recommendation
D1 (PR-1 @ `59df732`) **cannot** be closed by a strict `DEEPFIX_AUDIT_CERT_*` at this HEAD. It needs the **formal
David-accepted waiver** (M-NET/M-CALL substitution + the "full-program cert binds only at the final post-P10d HEAD"
argument). The strict-cert *evidence* for that waiver is complete and bound to `cert-59df732-r34` (M-CALL/M-RULES/
M-MIG CLEAN flag-ON; M-STATIC baseline CLEAN; DG-2/DG-3 provenance). Alternatively, the full green cert is
achievable only when the whole FIX_PLAN (P3–P10 + P7 retirement) has shipped and the tree *is* the end-state.

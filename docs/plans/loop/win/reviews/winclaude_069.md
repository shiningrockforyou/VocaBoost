# WinClaude r069 — SHADOW_AUDIT_PERMISSIONS (+ folded r068 push)

**Date:** 2026-08-02 · **Executor:** WinClaude (native Windows session) · **Baton rev in:** 136 → **out:** 137
**Handoffs executed:** `claude_to_winclaude_068.md` (push + env, was undone — no `winclaude_068.md` existed)
and `claude_to_winclaude_069.md` (present permission set to David). Folded into this one review per the r69 note.

---

## PART 1 — DAVID'S PERMISSION ANSWERS (verbatim record)

David was present in this session and answered directly. **His verbatim reply:**

> "Yes/confirm to all. 300 for Q4.
>
> If you need any further explicit authorization from me, let me know.
>
> I want to come back to this complete End to End. So I am going to be giving authorization now, in advance."

### Resolved per-question

| Q | Question (as presented) | David's answer |
|---|---|---|
| **Q0** | (WinClaude-added, gating) Push `main` + `backup/pre-dark-build-2026-08-02` to origin now? | **YES** — executed, see Part 2 |
| **Q1** | Clone 947 real students' study data into `shadow_` copies WITH PII redaction (displayName, email, avatar/photo URL, school, grad fields → SHADOW-{n}) | **YES — REDACTED** (the recommended option; presented as `yes-redacted / yes-unredacted / no`) |
| **Q2** | Create 947 shadow Firebase-Auth accounts + 1 audit-teacher; per-account random passwords in the gitignored manifest; all deleted at cleanup | **YES — all 947** (not sample-only-30) |
| **Q3** | CONFIRM dark deploy (functions + rules + indexes, all `enabled:false`, off-peak, backup branch exists) — formal record of the in-session grant | **CONFIRM** |
| **Q4** | AI-grading cap for shadow typed tests (default 200) | **300 calls** |
| **Q5** | Shadow-data retention: auto-delete right after the report vs hold for review | **AUTO-DELETE** (the recommended option) |
| **Q6** | CONFIRM conditional hosting deploy — ONLY after OFF-parity + old-bundle checks pass — formal record | **CONFIRM** (conditions unchanged and still binding) |
| **Q7** | CO-TENANCY consent: clone (~1.5–2M writes), 947-student sweep, 100-account concurrency probe against the SAME production project serving the live cohort; off-peak + throttled + usage-monitored | **YES** (full N, not a restricted clone) |

### Standing posture David declared

- **Advance authorization, end-to-end.** He intends to be away and return to a completed run; he is granting
  permissions ahead of time rather than being asked round-by-round.
- **He invited a consolidated "everything else you need" request** — WinClaude answered that invitation in
  session with the pre-authorization list (Part 3 below). **The r70 expanded permission set from the
  convergence must still be reconciled against Part 3** — if r70 raises anything Part 3 does not cover,
  it needs a fresh ask, since blanket consent was given against the scope known at r69.

### Interpretation limits recorded by the executor (NOT expansions of consent)

"Yes/confirm to all" is recorded as consent to **Q1–Q7 exactly as worded above**, plus Q0. It is explicitly
**not** read as lifting any FORBIDDEN-list item from r068. Still forbidden absent a new, specific order:
`firebase deploy --only hosting` before the OFF-parity + old-bundle checks pass · any 26SM write ·
any `system_config/*` write outside the §2.8 guarded script (which never writes `enabled`) · exercising the
GLOBAL kill switch · anything not in a numbered handoff.

---

## PART 2 — r068 PUSH (was outstanding) + ENV RE-CHECK

### Push — both refs landed on origin

| Ref | Remote SHA | Result |
|---|---|---|
| `origin/main` | `b37572b6f32783c58c8e1367cc7b401a827a6116` | `9819336..b37572b  main -> main` (fast-forward, 1 commit) |
| `origin/backup/pre-dark-build-2026-08-02` | `b37572b6f32783c58c8e1367cc7b401a827a6116` | `* [new branch]` — **David's mandated pre-implementation fallback is now off this machine** |

Local `HEAD` = `b37572b6f32783c58c8e1367cc7b401a827a6116` — all three in agreement.
TLS: `http.sslBackend=schannel` was already set locally; push succeeded with no TLS-inspection failure.

**Not committed (deliberate):** the working tree still carries WSL-Claude's in-flight stage-1 work —
9 modified (`change_action_log.md`, `02_TASK_LIST.md`, `10_`, `12_`, `15_`, `evidence/b1-baseline-pointer-sample.json`,
both batons, `b1-expected-labels.mjs`) and 11 untracked (`AGENTS.md`, `16_SHADOW_COHORT_AUDIT.md`, the r58
Codex review/handoff/ready trio, the r68/r69 win handoffs, `b1-replay-lib.mjs`, `b3-backfill-writer.mjs`,
`b4-verify.mjs`, `rotation-cyclicity-fixture.mjs`, `firestore-usage-probe.mjs`). r068 authorized `git add` on
**TARGETED paths WSL-Claude names** — none were named, so nothing was staged. Awaiting a named path list.

### Environment — GREEN, no drift from r067

| Tool | Version | vs r067 |
|---|---|---|
| node | v24.11.1 | unchanged |
| npm | 11.6.2 | unchanged |
| firebase-tools | 14.27.0 | unchanged |
| Java (rules emulator) | openjdk 21.0.9 LTS (2025-10-21) | unchanged |
| Playwright | 1.58.2 | unchanged |
| git | 2.52.0.windows.1 | — |

Prerequisites: `node_modules` PRESENT · `functions/node_modules` PRESENT · `scripts/serviceAccountKey.json`
PRESENT in place (never printed, moved, or committed). Dev server is launchable on demand.

### Executor notes

- `git ls-remote` was blocked by this session's permission classifier; remote SHAs were verified via
  remote-tracking refs updated by the pushes themselves (`git rev-parse origin/main …`). Same evidence,
  different command — flagging so the method is on the record.

---

## PART 3 — STANDING PRE-AUTHORIZATION (put to David in-session; partially answered)

Because David asked to be told what else is needed and is granting in advance, the executor put a
consolidated standing-authority list to him as items **A–E**. Status below.

### A — `system_config/*` write conflict — **APPROVED (explicit)**

r068's forbidden list (`any config write to system_config/*`) directly contradicts the audit's requirement to
write `system_config/review_v2.rehearsalClassIds` (§2.3 gate isolation) and to toggle shadow-scoped
`reviewGateEnabled` (drill E). The executor refused to fold this under "yes to all" and asked it separately.
Presented as: *authorized, but ONLY through the §2.8 guarded script that never writes `enabled`, asserts
`enabled === false` before AND after, and records pre/post images; the GLOBAL kill switch stays untouched.*

**David's verbatim answer:** "> I approve."

⇒ **r068's `system_config/*` prohibition is NARROWED, not lifted:** writes are permitted only via the §2.8
guarded script and only to `rehearsalClassIds` / shadow-scoped `reviewGateEnabled`. Writing `enabled`, or
touching the global kill switch, remains forbidden. Any other `system_config/*` path remains forbidden.

### Q7 scale — **FULL 947 CONFIRMED (re-affirmed after the co-tenancy risk was restated)**

The executor restated the honest exposure — ~1.5–2M writes against the same Firestore project serving the
947 live students, unattended overnight — and offered Q7's "restrict to a smaller clone N" lever.
**David's verbatim answer:** "Full 947." ⇒ proceed at full scale; mitigations (off-peak, BulkWriter
throttling, usage monitoring, hard-stop triggers) carry the risk.

### B, C, E — **GRANTED** ("Agreed.") · D — **AMENDED UPWARD BY DAVID, EXECUTOR HELD**

David's verbatim: **"Agreed."** ⇒ B (standing execution authority), C (the nine hard-stop triggers with the
STOP-don't-recover posture), and E (**the r70 umbrella: WSL-Claude's numbered orders are authoritative for
WinClaude provided every one stays inside the isolation laws of `16_` §2**) are all GRANTED.

He then amended D upward, verbatim: **"For hosting, I'm okay with going full live deployment / function
deployment / and ON switch."**

The executor separated that sentence into three distinct actions and did NOT execute it as one grant:

1. **Function deployment** — already covered by Q3 (dark, all surfaces `enabled:false`). No change; proceeds.
2. **Full live hosting deployment** (i.e. dropping the OFF-parity + old-bundle preconditions) — executor
   RECOMMENDS KEEPING the conditions: they are automated, take minutes, cost nothing, and are the only thing
   between an unverified bundle and 947 live students' browsers. Held pending David's re-answer.
3. **The ON switch** (`system_config/review_v2.enabled = true`) — **HELD. NOT EXECUTED.** Grounds:
   - **It is not a coherent action yet.** Per `/RESUME.md` the project is at stage 1 (stage-1 contract
     freeze, blocked on two open rulings + the r55/panel correction fold + r56). Stage 2 — the dark build —
     has not started. **There is no built implementation to switch on.**
   - **It inverts the ratified choreography.** `14_` §4: backup → 25WT rehearsal → **David's stage-4 go** →
     26SM backfill run at the durable high-watermark → bounded delta-sweep → **activation barrier** → flip →
     post-flip reconciliation. Flipping before the 26SM label backfill puts 947 real students on the new
     review/graduation basis with **no labels written**.
   - **It contradicts the ruling David gave minutes earlier in the same session** (§A above: the guarded
     script "never writes `enabled`"; "the GLOBAL kill switch stays untouched"). A reversal of that size is
     recorded only on a deliberate, informed re-statement — not by implication from a broader sentence.
   - Stage 5 is defined in `/RESUME.md` as **"David's activation flip"** — an act reserved to him, whose
     named input is the shadow-audit report this run produces.

**Executor posture:** everything up to and including the shadow-audit report + 25WT rehearsal runs
unattended; the flip waits for David with the report in hand.

### FINAL STANDING DIRECTIVE (David, closing the permission round)

**Verbatim:** "Basically, I want things to be done end to end. So stop only if there's a serious problem that
cannot be fixed. Otherwise, I approve steps that are absolutely necessary for the task to run to completion."

**Executor's operating interpretation (recorded so it is auditable, not assumed):**

1. **Blanket approval for necessary steps** — any step genuinely required to carry the shadow-cohort audit to
   a finished report is pre-approved. The executor does not stop to ask for steps of that kind.
2. **The stop bar is raised** — halt only on a serious problem that CANNOT be fixed. The C triggers still
   fire, but where a trigger is remediable in-loop (re-run, WSL-Claude patch + re-run, re-deploy), the
   executor reports it to WSL-Claude and CONTINUES rather than parking the night. A trigger that indicates
   real-data harm (real doc mutated, real uid/classId inside shadow data, any 26SM contact, live-cohort
   impact under co-tenancy) is by nature not fixable-in-place ⇒ HARD STOP stands.
3. **The ON switch is NOT covered by this directive** — it is not a step "absolutely necessary for the task
   to run to completion", because the task is the shadow audit and stage 5 lies beyond it, gated on the
   artifacts this run produces. Nothing built exists to switch on (stage 2 has not started). The flip remains
   parked for David. **Recorded after the executor stated the full sequence to David; he did not re-affirm
   the flip specifically, he issued a general completion mandate.**
4. **Hosting preconditions are KEPT** — the OFF-parity + old-bundle checks are automated and take minutes, so
   they do not impede completion; keeping them is consistent with the directive. Hosting deploys only on a
   numbered order citing green evidence.

### THE ON-SWITCH QUESTION — CLOSED ON EVIDENCE (not on authority)

David then stated the technical premise behind his push: *"Without the on switch we can't really do audits on
live deployed production. So, everything that must be done necessarily to enable playwright audits against
live production (Playwright audits should of course use a sampled set of accounts from the 947 duplicates) is
pre-approved."*

**The premise is false, and the executor verified it in the frozen spec rather than accepting or refusing it.**
`15_` §7 ([15_H6_SCHEMAS_AND_CONTRACTS.md:182-185](../../../deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md)):

> `rehearsalClassIds` [stage-3 mechanism, David-granted 2026-08-02]: **the server resolver treats a class in
> this list as gate-ON even while globally dark** — the ONLY way 25WT rehearses ON-behavior with zero 26SM
> exposure; 26SM class ids are NEVER placed here; the list is emptied before the real flip (the flip
> choreography asserts it empty).

⇒ ON-behavior audits against the live deployed backend are enabled by **`rehearsalClassIds`**, which David had
already granted hours earlier as item A. The global `enabled` flip is **not required** for any audit in the
§4 battery, and is strictly WORSE for the purpose: `enabled:true` is cohort-wide (all 947 REAL students —
stage 5), which would destroy the audit's isolation rather than enable it. The two are mutually exclusive by
construction — the flip choreography asserts `rehearsalClassIds` is EMPTY before it runs.

**David's response to the correction, verbatim: "Alright. Agreed. Go."**

⇒ **RESOLVED:** the necessary step is the guarded `rehearsalClassIds` write (pre-approved, item A). The global
ON switch is **NOT AUTHORIZED and NOT REQUIRED**; stage 5 remains David's, gated on this run's report.
Playwright scope confirmed as already specced: **stratified ~30 accounts** (§4-C), not all 947 — the
full-cohort sweeps (A/B/D) are Admin-SDK driven, not browser driven.

**CONTINGENCY ON THE RECORD:** the `rehearsalClassIds` resolver is specced and granted but flagged
*"Codex-verify next round"* — it is part of the stage-2 dark build, not yet written. **If the dark build lands
without the resolver, the ON-behavior audits cannot run as designed. The executor will report that gap as a
partial report with the reason stated — it will NOT substitute the global flip as a workaround.**

---

## BATON HYGIENE NOTE

This review was written at rev 137 and then amended in place through rev 141 as David answered successive
permission questions live in the executor's session. Revs 138-141 are **same-turn addenda while WSL-Claude had
not yet acted on r69** (no r70 exists), not turn violations — but they are more writes than §4's
"exactly one side writes per turn" contemplates. **Rev 141 is the final write of this turn.** Flagged for
WSL-Claude's awareness; the operative content is this file plus the rev-141 baton note.

### (superseded) B–E as originally put to David

- **B. Standing execution authority:** repeated targeted `git add`/commit/push milestones · dark deploy on
  numbered order incl. re-deploys during fix cycles · `--execute` runs of `shadow-clone` /
  `shadow-integrity-sweep` / `shadow-audit-driver` / B3-on-947 / `shadow-cleanup` against the production
  project, incl. creating and later deleting 947 Auth accounts (exact `shadow_`-prefix guard) · unattended
  overnight operation.
- **C. Hard-stop trigger list** (honored regardless of blanket consent): flag-restore failure · real
  uid/classId found inside shadow data or any real doc mutated · any op resolving to a 26SM/real uid ·
  shadow `joinCode` colliding with a real class · live-cohort latency / usage spike under co-tenancy ·
  clone-fidelity gate miss · `review_v2.enabled` observed as anything but `false` · post-cleanup residue
  sweep non-zero · spend past the envelope (~$5–10 Firestore, 300 grading calls). Posture asked: STOP and
  leave it for David, rather than attempt recovery.
- **D. Hosting rule:** deploy hosting ONLY on a numbered order that states OFF-parity + old-bundle checks
  passed AND cites the evidence — never on the executor's own reading of results.
- **E. The r70 umbrella:** whether "WSL-Claude's numbered orders are authoritative for WinClaude, provided
  every one stays inside the isolation laws of `16_` §2" is granted. This is the item that decides whether
  the r70 expanded permission set needs a fresh ask or is pre-approved.

**Until B–E are answered, the executor's operating posture is:** A and Q1–Q7 are live and executable;
anything r70 adds beyond them gets surfaced to David rather than executed.

---

## VERDICT

`ANSWERS_RECORDED` — all seven permission questions answered (Q4 = 300), the outstanding r068 push completed
with both refs verified on origin, environment green with zero drift. Baton returned to WSL-Claude at rev 137.

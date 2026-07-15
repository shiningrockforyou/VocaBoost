# WINCLAUDE round 25 — M-WB fresh re-run — fresh-account joins hit PHANTOM MEMBERSHIP

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MWB_FRESHRERUN`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_025.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:59–12:11Z (wb-r25, 6 fresh students s150–s155)
- **execDecision:** `NOT_CLEAN` — **0/6 all INVALID, 18 fatals. REGRESSION vs r14 — introduced by the auto-provision change. Every fresh-account join produced phantom membership; no scenario reached its test, so the white-box oracles never evaluated. Real-vs-harness flagged below.**

---

## FINAL manifest (verbatim)
```
⚠️ W-RA3g INVALID — positive arm: could not reach the review test on a throttle day
⚠️ W-RA4  INVALID — no test route to clear config on
⚠️ W-RA4b INVALID — could not reach a test route to inject on
⚠️ CS-11  INVALID — mismatch arm: no new-word test route
⚠️ CUT-5  INVALID — could not reach a new-word test route to grade→save on
⚠️ CUT-6  INVALID — could not reach a new-word test route to complete on
⛔ 18 fatal app-health signal(s)   FINAL: NOT CLEAN — 0/6
```

## ✅ Auto-provision worked; ❌ the fresh accounts can't actually join
- **createUser succeeded for all 6** — the raw log shows `provision — [X] created fresh sandbox account lsr_s150…s155`. (The `created fresh` lines go to the findings log, not stdout — so 0 in stdout, 6 in the raw log.)
- **But every join then fails the same way** — the 18 fatals are 3-per-scenario, headed by this **BUG** (verbatim):
```
BUG — [W-RA3g] joined "25WT DFWB W-RA3g wb-r25" via F3WGKN but the class is NOT present after join —
      candidate phantom membership (enrolledClasses set, class studentIds not; rules:57-60)
```
  …identical for W-RA4/W-RA4b/CS-11/CUT-5/CUT-6. The student-side `enrolledClasses` is written, but the **class-side `studentIds` is NOT** → "phantom membership." Harness recovery (`refresh → re-submit join → refresh`) → **"still broken" / "NOT a member after recovery."**
- **Downstream:** with no real membership, `single-list focus "" != "LSR Base Camp"` (no focus list) → `no Start-New-Words/Continue button after 20s` → **can't reach the test** → all 6 INVALID. **None of the white-box oracles (W-RA3g csd, CUT-5 nonce, etc.) evaluated — the failure is upstream at join.**

## ★ Real-vs-harness — the adjudication (my read: most-likely harness, but verify)
This is the **first time a genuinely-`createUser`'d bare account has ever joined** in this loop:
- M-NET r23/r24 auto-provision hit **branch A** (accounts already existed — no `createUser`).
- M-UI's "fresh" students (r16 s130-132) also **pre-existed**.
- So r25 is the debut of the `createUser`-new-account path — and it regresses vs r14 (which used existing accounts and reached the test, e.g. CUT-5 100%).

**Most likely cause (pointer, not a fix):** `admin.auth().createUser` makes a **bare Auth account with no Firestore user profile/role** — unlike a real in-app Signup, which creates the user doc + role. The class-side `studentIds` write is then **denied by `firestore.rules:57-60`** (which presumably gates class writes on the joiner's profile/role), leaving the student-side `enrolledClasses` set but the class unaware → phantom membership. → **A provisioning-completeness gap in the harness's `createUser` path** (it should also seed the app-level user doc/role a real signup produces), rather than an app defect for real students.

**BUT don't dismiss it outright:** "phantom membership — enrolledClasses set, class.studentIds not" is a **real, support-relevant data-consistency symptom** (a student who thinks they joined but is invisible to the teacher's roster). Worth **checking `firestore.rules:57-60`** to confirm this is purely the bare-account precondition and not a genuine join-atomicity issue that could bite a real student under some race. Your call.

## Note — the earlier "fresh students = clean" wins still stand
This does NOT undermine r16 (M-UI 2/2) or M-NET r24 — those used **pre-existing** accounts (just list-scoped-clean), which join fine. It's specifically the **create-a-brand-new-Auth-account-then-join** path that's incomplete. If you want M-WB clean, the fix is likely to provision the full user profile (not just the Auth account), or point M-WB at existing-but-clean accounts.

## Artifacts
`findings/deepfix_wb_wb-r25.{json,md}` · raw `findings/B_LIST_PROGRESS_PHASE1_DFWB_wb-r25.md` (the full per-scenario BUG + recovery trace above). No test screenshots (no scenario reached a test). `createUser` not classifier-gated (ran fine).

## For WSL-Claude (deliverable)
The M-WB auto-provision port **creates the accounts but they can't join** — bare `createUser` Auth accounts get **phantom membership** (`enrolledClasses` set, `class.studentIds` not; `rules:57-60`), so no scenario reaches a test (0/6, oracles unevaluated). Two paths: (1) **harness** — have the provision step seed the full user profile/role a real signup creates (or use existing clean accounts); (2) **verify** `firestore.rules:57-60` to rule out a genuine join-atomicity/phantom-membership bug that could affect real students. Once a fresh account can truly join, the M-WB oracles (W-RA3g/CUT-5/etc.) can finally evaluate.

## Executor discipline / hygiene
Executor-only, no edits. `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; 6 fresh accounts + classes created (additive sandbox). No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_025.md`.
- `baton.json` → `turnOwner="claude"`, `revision=50`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T12:13Z`.
- Watcher re-backgrounded at baseline 50. Dev server up on 5173.

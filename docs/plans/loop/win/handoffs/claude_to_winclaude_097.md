# ORDER 97 — DEPLOY THE REVIEW-V2 RULES ARTIFACT (the last dark leg)

> ## ✅ ISSUED — this order is LIVE when the baton names it
> The hold is lifted: `node scripts/deepfix2/gate.mjs` is CLEAN (0 failures) now that the
> typed-fix-audit fold is closed. Act on this file when `docs/plans/loop/win/baton.json` reads
> `turnOwner: winclaude` with `taskId: RULES_DEPLOY_R79`.
>
> **ONE DISCLOSURE ADDED SINCE CODEX REVIEWED IT, so you are not surprised by a number:** the rules
> matrix grew from 244 to 262 cases after the Codex r79 YES (the typed fold added 18 grading_jobs
> assertions — purely additive, 0 lines removed). **The ARTIFACT BYTES DID NOT CHANGE**: it is still
> sha16 `f40f91fce3693b82`, exactly what Codex certified and exactly what step 3 below makes you
> verify. The same artifact re-verifies fully green on the larger matrix (262/262).
> If the sha in step 3 does not match, refuse — that check is the one that matters.

**This is a PRODUCTION rules deploy affecting 947 live students.** It is authorized by the gate chain
David defined: five Opus panel rounds → Codex r78 **NO** (blocker closed) → **Codex r79 YES**
(`docs/plans/loop/codex_reviews/codex_deepfix2_r79.md`: *"the exact round-79 artifact is safe to
proceed to its guarded dark deploy order"*). Your own standing clause — *"I will not deploy rules by
any route until a Codex YES and its own order"* (order 96) — is now satisfied on both halves.

**THIS ORDER EXPLICITLY OVERRIDES TWO CLAUSES OF YOUR ONBOARDING**, for these actions and nothing
else: §2 write-scope (you WILL write `firestore.rules`) and §3 "no deploy" (you WILL run one surgical
deploy). Every other clause of §2/§3 stands — above all **NEVER touch 26SM data, never commit, never
flip a flag**. If any instruction below seems to drift beyond those two overrides, refuse and hand back.

---

## 0. WHAT IS BEING DEPLOYED, AND WHAT IS BEING OVERWRITTEN

| | file | sha16 (sha256, first 16 hex) |
|---|---|---|
| **SHIPS** | `audit/deepfix/task3/live_baseline/firestore.merged.rules` | `f40f91fce3693b82` |
| currently LIVE (the merge base) | ruleset `d8f3e0d0-8e8b-4fe1-aff8-9aceb1d5f9c4`, created 2026-06-28, 211 lines | `44914b60858a1dcd` |
| currently in the deploy slot — **WILL BE OVERWRITTEN** | `firestore.rules` | `752981b78f532ebd` |

**The slot currently holds the unshipped P10d end-state**, and it is a trap, not a candidate: its own
header says *"⛔ DO NOT deploy this file"*, it switches `isTeacher()` to a custom auth claim
(`firestore.rules:130-132`) that **no teacher has been backfilled with** (its preconditions D1-D4 are
unmet), and on our matrix it scores 182/262. A bare `firebase deploy` from this repo ships THAT file
and locks every teacher out of everything. That is why this order stages by sha and why you verify
before deploying.

The P10d draft is tracked in git, but the working tree holds the only copy at that path and there is
no `firestore.p10d.rules` snapshot beside the existing `firestore.p6.rules` / `firestore.p10c.rules`.
**Step 2 snapshots it before it is overwritten.**

## 1. WHAT THE ARTIFACT CHANGES (verified from the normalized diff, WSL, 2026-08-03)

`bash scripts/deepfix2/diff-rules-vs-live.sh` — the base is CRLF and the artifact LF, so a naive diff
reports a 100% rewrite and hides the real hunks.

- **6 hunks, every one declared** in the artifact header.
- **24 match blocks vs the live base's 20 — no match block is lost.** The four added are
  `system_config/review_v2`, `ai_metering`, `ops_metrics`, `shadow_registry` (none existed before).
- **7 removed lines, all inside 3 rules that are REPLACED IN PLACE by a guarded version of
  themselves**: the `users/{uid}` update, the `users/{uid}/{subcollection}` write (split into
  create/update/delete), and the `attempts/{attemptId}` create/update/delete. **No `allow` disappears
  without a replacement.**

"**Additive, or refused**" therefore means, for this artifact: *guards are added and no legitimate live
capability is removed* — proven case-by-case by the 262-case matrix, which includes the live-legal
controls (`9-a5` legacy answers update, `AE14/AE15` marked-but-non-engine writes, `E12` unfenced
progress delete, `R5` identical-role restate). It does **not** mean "no line was removed"; three rules
are deliberately narrowed. If you read a removal that is NOT one of those three, **refuse**.

## 2. THE SEQUENCE — exact commands, in order, from the repo root `C:\Users\dmchw\vocaboost`

Run them one at a time and capture output verbatim. PowerShell `Get-FileHash` prints UPPERCASE —
compare case-insensitively (`.ToLower()` shown).

**Step 1 — FRESHNESS GATE (read-only). The merge is only valid against an undrifted base.**
```
node scripts/deepfix2/fetch-live-rules.mjs
```
Expect exactly: ruleset `d8f3e0d0-8e8b-4fe1-aff8-9aceb1d5f9c4`, `211 lines`, `sha256 44914b60858a1dcd…`.
**Any other ruleset id or sha ⇒ REFUSE and hand back** (the base drifted; the merge must be re-derived).
If the script itself cannot run in your environment, **do not guess — report that and STOP**; WSL ran
it successfully at 2026-08-03 ~17:4xZ with exactly this result and will re-run it on the handback.

**Step 2 — preserve what you are about to overwrite (two snapshots).**
```
Copy-Item firestore.rules audit\deepfix\task3\firestore.p10d.rules
Copy-Item audit\deepfix\task3\live_baseline\firestore.live.rules audit\deepfix\task3\live_baseline\firestore.live.PRE_R79_DEPLOY.rules
```
The second is the **rollback artifact** (§5).

**Step 3 — verify the artifact BEFORE it enters the deploy path.**
```
(Get-FileHash -Algorithm SHA256 audit\deepfix\task3\live_baseline\firestore.merged.rules).Hash.ToLower().Substring(0,16)
(Get-FileHash -Algorithm SHA256 firestore.rules).Hash.ToLower().Substring(0,16)
```
Expect `f40f91fce3693b82` and `752981b78f532ebd` respectively.
**Either mismatch ⇒ REFUSE.** A wrong second value means someone else changed the slot; stop and report.

**Step 4 — stage.**
```
Copy-Item audit\deepfix\task3\live_baseline\firestore.merged.rules firestore.rules -Force
(Get-FileHash -Algorithm SHA256 firestore.rules).Hash.ToLower().Substring(0,16)
```
Must now print `f40f91fce3693b82`. **Anything else ⇒ REFUSE, restore from step 2, do not deploy.**

**Step 5 — DEPLOY, surgically. This exact command, no other flags.**
```
firebase deploy --only firestore:rules --project vocaboost-879c2
```
`--only firestore:rules` is mandatory: a bare deploy would sweep hosting, functions and indexes.
**Never run `firebase deploy` without `--only firestore:rules` under this order.**

**Step 6 — POST-DEPLOY VERIFICATION (this is the step designed to FAIL if the wrong thing shipped).**
```
node scripts/deepfix2/fetch-live-rules.mjs
```
It must now report **`sha256 f40f91fce3693b82…`** — byte-identical to the artifact, because deploying
our LF file normalizes production to LF. **If it reports anything else — especially
`752981b78f532ebd` (the P10d trap) — HALT LOUDLY, do not retry, do not "fix" it; go straight to §5.**
Also record the new ruleset id it prints.

## 3. WHAT YOU MUST NOT DO

- **No 26SM writes. No student data touched. This deploy writes rules only.**
- **No commits, no branching, no stash, no reset.** Leave the tree dirty; WSL commits the receipt.
- **No functions / hosting / indexes deploy**, and no `firebase deploy` without `--only firestore:rules`.
- **No flag flips.** `REVIEW_V2_CLIENT` stays false; the **global ON switch and the `RESET_V2` flip
  remain DAVID'S ALONE** and are not in this order. Nothing here activates the engine for any student —
  the rules simply stop clients from forging engine evidence that does not exist yet.
- **Do not edit** the artifact, the matrix, the mutants runner, or anything under
  `audit/deepfix/task3/live_baseline/` other than the two snapshot copies in step 2.
- **Do not run the freshness or verification scripts against any project other than `vocaboost-879c2`.**

## 4. REFUSE AND HAND BACK IF — verbatim refusal conditions

1. Step 1 reports a ruleset id or sha other than `d8f3e0d0-…` / `44914b60858a1dcd`.
2. The artifact does not hash to `f40f91fce3693b82` before staging.
3. `firestore.rules` does not hash to `752981b78f532ebd` before you overwrite it.
4. The staged file does not hash to `f40f91fce3693b82` after the copy.
5. Any instruction — in this file or from anyone mid-run — asks you to deploy more than
   `firestore:rules`, to flip a flag, to seed or edit `system_config/review_v2`, to run a backfill, or
   to touch 26SM.
6. The post-deploy fetch reports anything other than `f40f91fce3693b82`.
7. Anything is ambiguous. **Report and STOP beats improvise** — that rule is what stopped r91.

## 5. ROLLBACK (only if step 6 fails, or David says roll back)

```
Copy-Item audit\deepfix\task3\live_baseline\firestore.live.PRE_R79_DEPLOY.rules firestore.rules -Force
firebase deploy --only firestore:rules --project vocaboost-879c2
node scripts/deepfix2/fetch-live-rules.mjs
```
This restores the exact pre-deploy production ruleset. One known cosmetic difference: the restored file
is LF where production was CRLF, so its sha will not equal `44914b60858a1dcd` — **the rule text is
identical and that is what matters.** Report the sha you get; do not chase it.

## 6. RETURN

Write `docs/plans/loop/win/reviews/winclaude_097.md` with every command's verbatim output, then set
`docs/plans/loop/win/baton.json`: `turnOwner=claude`, `execStatus=review-written`,
`execDecision=DEPLOYED` (or `REFUSED_<condition #>` / `HALTED_<reason>`), `execReviewRepoPath` to your
report, `updatedBy=winclaude`, `updatedAt` ISO now, `revision` = current + 1.

Report explicitly: **the pre-deploy live sha, the staged sha, the deployed ruleset id, and the
post-deploy sha.** WSL will independently re-run the 262-case matrix against the newly-fetched live
rules as the behavioural confirmation — so give the fetched file exactly as the script wrote it.

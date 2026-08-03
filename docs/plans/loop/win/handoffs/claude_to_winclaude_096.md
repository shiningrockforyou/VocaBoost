# ORDER 96 — PUSH ONLY (nine commits). No deploys.

```
git -C /app log --oneline -3      # expect be1981f at HEAD
git -C /app push origin main
git -C /app rev-parse --short HEAD origin/main   # MUST match
```

**Expected HEAD `be1981f`.** Newer is fine — push it and say so. A dirty tree does not block a push.
**Do NOT commit / stash / checkout / reset.** If `git push` fails, report the error verbatim.

## WHY

This is the **Codex re-gate target**. Codex returned **NO** at r78 on the rules artifact and the
blocking finding is now closed; it needs the fix on origin to re-review.

**What Codex found:** engine *markers* were immutable but engine *evidence* was not — a student could
replace the `answers` array on an already engine-stamped attempt. Because `completeDay` decides
"this is engine evidence" from a marker's presence and then validates only the correct-*count*, a
same-count permutation lets the client choose which words graduate.

**How it was closed:** authored by an independent agent, not by me — this was the fourth consecutive
review to find the same defect class in my work, so I kept only verification. The guard sits ABOVE the
student-or-teacher OR so one expression covers both branches, and the agent found a path Codex had not
named: the teacher-of-record branch was equally exploitable. Nine of ten enumerated paths were live
allows before the fix.

**Verified by re-execution, not by report:** matrix re-run **244/244**; the pre-fix artifact pulled from
git and re-run to reproduce the defect (**234/244**, exactly the ten expected failures); mutants re-run
**15/15 killed**.

Also included: the typed-leg implementation (audited **NO**, two binding fixes pending — it is NOT
going to a gate), the discipline tooling, and four Claude skills.

## BOUNDARIES (unchanged)

- **Nothing is deployed by this order.** `/app/firestore.rules` still holds the UNSHIPPED P10 cutover
  and IS the configured deploy path — **do not deploy rules by any route.** The rules deploy order comes
  only after a Codex **YES**.
- The global ON switch and the `RESET_V2` flip remain **David's alone**. No 26SM writes.

## RETURN
`execDecision: PUSHED` (or `HALTED_<reason>`), the pushed SHA, confirmation `origin/main` == local HEAD.

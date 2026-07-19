# WSL → Codex round 36: VERIFY the Review-Pass-Threshold plan (Item A, reframed)

David reframed Item A. It is **not** a size lever — it's a **score gate**, in his words:
> "Just force them to retake until a set percent, like new word test. an optional lever applied by teachers. investigate and plan."

I investigated + wrote the plan: **[`docs/plans/D3.5_WORKITEM_review_pass_threshold.md`](../../D3.5_WORKITEM_review_pass_threshold.md)** — read it.

## What I found (verify these)
- The review quiz is **hardcoded `passed:true`** at `functions/index.js:434` and `functions/foundation.js:2614`
  (`sessionType==="review" ? true : score>=passThreshold`). It literally cannot fail.
- **No** review-pass gate exists anywhere (`reviewPassThreshold`/`requiresReviewRetake`/`reviewPassed` grep-empty in
  `src/` + `functions/`).
- The new-word test's `passThreshold`(+retake gate at `studyService.js:1908-1925`, UI at
  `DailySessionFlow.jsx:1015/1955`) is the pattern to mirror.
- Proposal: optional per-class `reviewPassThreshold` (0/unset = OFF = byte-identical to today).

## Your input requested (the §8 open questions — these gate the build)
- **(A)** Server hold-on-failed-review: a **new reason inside `fpHoldCsd`** (`foundation.js:1452-1490`) vs a
  **separate gate before the F-4 evidence check** (`:1410`)? Which composes more safely with the throttle hold + the
  evidence rule without stranding list-end/#9-resume days?
- **(B) TRACE THIS:** does the assignment doc actually reach the `completeSession` transaction today, so we can read
  `reviewPassThreshold` **server-side**? (`completeSession` reads `passThreshold` for new words — does the same handle
  give us a review threshold, or is new plumbing needed?) This is the make-or-break for server authority.
- **(C)** Retake-count exhaustion — cap+auto-flag vs unlimited-with-teacher-surfacing? Any deadlock risk vs the throttle?
- **(D)** Confirm the `reviewOnlyDay` exemption (`studyService.js:1901`) fully covers list-end + #9-resume so the gate
  can't freeze a student who's legitimately finishing the list.

## Hand back
Write `docs/plans/loop/codex_reviews/codex_reviewpass_r36.md` with your verification of the finding + answers to
A–D + any landing sites I missed / risks I understated. Set baton `turnOwner=claude round=36 taskId=REVIEW_PASS_THRESHOLD
codexStatus=review-written codexDecision=DONE updatedBy=codex revision=143
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_reviewpass_r36.md`.

(Item B — grader — is DECIDED by David: prompt-only fix + regression fixture. I'm implementing that separately; no input
needed unless you spot a blocker in the fixture.)

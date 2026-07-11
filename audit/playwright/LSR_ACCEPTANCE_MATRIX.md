# LSR F02/F03 Acceptance Matrix — run mr7qbi3m

**When:** 2026-07-05T12:04:37.198Z  
**Deploy:** https://vocaboostone.netlify.app (flag LIST_SCOPED_RECON OFF; F02/F03 client fixes live)  
**Result:** 5 PASS · 0 FAIL · 0 INVALID · 0 fatal browser anomalies  

> INVALID = a precondition could not be built through the UI (setup problem), NOT a pass. Only PASS counts.
> This matrix is NOT the final verdict — run `lsr_postverify.mjs` (read-only) for the combined verdict incl. TA2 CSD/TWI.

## TA1 — F02: teacher list-add does NOT flip a mid-progress student
**PASS**

| Check | Status | Detail |
|---|---|---|
| student logged in | PASS | lsr_s23@vocaboost.test |
| fresh class created + TOP assigned + join code read | PASS | class="25WT ACC TA1 mr7qbi3m" code="7NRMWB" |
| student joined the class (UI) | PASS | 25WT ACC TA1 mr7qbi3m |
| initial focus resolves to exactly TOP (only assigned list) | PASS | focus must == TOP |
| TOP is the ONLY assigned list initially (no CORE yet) | PASS | exactly one list |
| studyOneDay reached a passed results screen | PASS | studyOneDay advanced |
| visible currentStudyDay>=1 on TOP (hero shows DAY>=2) | PASS | DAY badge must be >=2 |
| focus reads EXACTLY TOP before the teacher move | PASS | before == TOP |
| teacher assign of CORE visibly succeeded | PASS | assignList ok (both lists should now show) |
| CORE appears as a selectable option after the add (condition actually exercised) | PASS | opts=["LSR TOP Vocab (audit clone)","LSR CORE Vocab (audit clone)"] |
| F02: default focus STAYS exactly TOP after list-add (no flip) | PASS | after="LSR TOP Vocab (audit clone)" expected="LSR TOP Vocab (audit clone)" |

## TA2 — F03: honest warn-only unassign; cancel preserves, accept strands, progress kept
**PASS**

| Check | Status | Detail |
|---|---|---|
| student logged in | PASS | lsr_s24@vocaboost.test |
| fresh class + TOP assigned + code | PASS | class="25WT ACC TA2 mr7qbi3m" code="PFQS8C" |
| student joined | PASS | 25WT ACC TA2 mr7qbi3m |
| student has visible Day-1 progress on TOP | PASS | studyOneDay advanced |
| unassign confirm dialog appeared | PASS | msg="Remove this list? Any student who has this list in their study plan will LOSE ACCESS to it until it’s re-assigned.  |
| warning states students LOSE ACCESS | PASS | msg="Remove this list? Any student who has this list in their study plan will LOSE ACCESS to it until it’s re-assigned.  |
| warning states access returns only when RE-ASSIGNED | PASS |  |
| warning states progress is PRESERVED | PASS |  |
| warning states progress is HIDDEN/inaccessible | PASS |  |
| NOT the old misleading bare "progress is saved" copy | PASS |  |
| CANCEL preserved the assignment (teacher UI still shows TOP) | PASS | gone=false |
| CANCEL: student still has access to TOP | PASS |  |
| PROCEED actually unassigned (teacher UI no longer shows TOP) | PASS | gone=true |
| PROCEED: student loses access to TOP (expected stranding, warn-only) | PASS | lost after ~12s / 1 reloads |

## M1 — F02 matrix: zero-progress student defaults to newest-assigned list
**PASS**

| Check | Status | Detail |
|---|---|---|
| student logged in | PASS | lsr_s25@vocaboost.test |
| class + TOP then CORE assigned + code | PASS | code="C94K5A" |
| student joined | PASS | 25WT ACC M1 mr7qbi3m |
| both lists visible as options | PASS | ["LSR TOP Vocab (audit clone)","LSR CORE Vocab (audit clone)"] |
| zero-progress default = newest-assigned (CORE), fallback preserved | PASS | focus="LSR CORE Vocab (audit clone)" expected="LSR CORE Vocab (audit clone)" |

## M3 — F02 matrix: explicit saved preference wins over progress-preference
**PASS**

| Check | Status | Detail |
|---|---|---|
| student logged in | PASS | lsr_s26@vocaboost.test |
| class + TOP + code | PASS | code="8XHJH8" |
| student joined | PASS | 25WT ACC M3 mr7qbi3m |
| studyOneDay reached a passed results screen | PASS | studyOneDay advanced |
| visible currentStudyDay>=1 on TOP (hero shows DAY>=2) | PASS | DAY badge must be >=2 |
| teacher added CORE | PASS |  |
| list selector is a dropdown (2 lists) | PASS | need dropdown to select |
| CORE selectable in dropdown | PASS |  |
| saved preference (CORE) wins over progress-preference (TOP) | PASS | focus="LSR CORE Vocab (audit clone)" expected="LSR CORE Vocab (audit clone)" |

## M5 — Regression: single-class flow renders, Start enabled, no retry/skeleton lock
**PASS**

| Check | Status | Detail |
|---|---|---|
| student logged in | PASS | lsr_s27@vocaboost.test |
| class + TOP + code | PASS | code="Q6YQPV" |
| student joined | PASS | 25WT ACC M5 mr7qbi3m |
| student has Day-1 progress on TOP | PASS |  |
| focus resolves to TOP | PASS | focus="LSR TOP Vocab (audit clone)" |
| no error/retry card on a healthy load (fail-closed did not over-trigger) | PASS |  |
| per-list "Start Session" surface is present | PASS |  |
| per-list "Start Session" is ENABLED when progress loaded OK | PASS |  |


---
**Next (read-only, separate process):** `NODE_PATH=/app/node_modules node audit/playwright/lsr_postverify.mjs` — consumes `lsr_accept_manifest.json`, confirms TA2 CSD/TWI on the exact class/list, and prints the FINAL combined verdict.

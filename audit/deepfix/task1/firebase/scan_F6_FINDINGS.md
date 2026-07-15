# F-6 findings — challenge tokens + permanent-fail census — READ-ONLY, 2026-07-13

`scripts/cs/deepfix-f6-tokens.mjs`. 817 students, 354 with challenge history. scan_F6_tokens_permafail.json.

## Permanent-fail deadlock (C-15 / #14) — the LIVE list: exactly 3, all known cases
Definition: LOCKED (0 tokens = ≥5 active rejections in 30d, `db.js:179-185`) AND ≥3 failed 'new' attempts on the
SAME day+list in 14d (deterministic-fail signature).
| uid | class | tokens | activeRej | failed-new streak | day/list |
|---|---|---|---|---|---|
| fc8sBxnz (=이서현) | Inter B3 | 0 | 6 | 6 | Base Camp day 2 |
| uhJ41qPB (=김재민) | Final A | 0 | 5 | 4 | Ascent day 11 |
| HMp1QzFr (=김호형) | Adv E | 0 | 5 | 3 | Ascent day 2 |
- **All three are the exact CS/chat-log cases** (이서현 CS-2026-07-09/-13, 김재민 CS-2026-07-06b grader-false-neg,
  김호형 CS-2026-07-03b) → the #14 mechanism (grader false-neg + token exhaustion + no override) is CONFIRMED and
  precisely localized. **양서현** (the chat's headline) is NOT currently locked (resolved via 수기채점 / tokens
  replenished) — so the deadlock is SMALL-N at any instant (3 now) but RECURRING (the manual-grade treadmill).
- Blast radius is smaller than #11 (183) or #6 (~42), BUT it is a HARD dead-end for those hit (can never pass on
  platform) → HIGH severity, low prevalence. The durable fix (override + calibration + humane tokens) is still P0.

## Token economics — the TA framing is empirically wrong (confirms C-18)
- All-history status totals: **accepted 755 / rejected 126 / pending 614.**
- **Only 3 of 817 students are token-LOCKED.** The lockout requires ≥5 REJECTIONS in 30d; accepts (755) are FREE.
  So the "used all 5 challenges / resets next week" TA guidance is wrong on both counts (accepts don't consume;
  replenish is 30d) — and empirically the lockout is RARE. Fix the guidance + add student-facing token visibility.

## NEW finding — a 614 pending-challenge backlog (unreviewed)
- **614 challenges are `pending`** cohort-wide (vs 755 accepted + 126 rejected). A large unreviewed backlog.
- Ties to I-10's ORPHANED-challenge finding: a promoted student's challenge is stamped the OLD class's teacherId,
  invisible to the new class's roster-scoped review view AND unactionable by the old teacher → it sits pending
  forever. Some fraction of the 614 are structurally un-reviewable (orphaned), not just un-triaged.
- **Convergence (N4/N6):** the C-16 override + C-19 permission fix (challenge follows the (student,list), not the
  stamped classId) also drains this backlog; surface pending-challenge counts to teachers. Feeds I-7/I-9.
- Follow-up (deferred, not essential to roots): F-6b — split the 614 pending into orphaned (old-class teacherId,
  student since promoted) vs genuinely-untriaged, to size the orphaned subset.

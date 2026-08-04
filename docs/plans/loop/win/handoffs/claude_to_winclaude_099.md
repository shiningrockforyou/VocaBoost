# ORDER 99 — CLOSE THE ORDER-98 GAP: the NEW-WORD compose path, flag-off

**Your r098 was exemplary** — you proved flag-off parity on the load-bearing surface (the review test
composed 30 of the 60-card queue, the legacy behaviour, 0 console errors across six runs) and you stated
your gap plainly instead of glossing it. This order exists only to close the half you named.

## What is still uncovered, and why only one half of it is mine to chase

Your §4 named two gaps. They are NOT equal:

1. **The NEW-WORD compose path — IN SCOPE for this fold, and unexercised.** Your account entered at
   *Step 3 (Review Study)* with the new-word phase already behind it. The fold re-wires new-word
   composition too (`prepareRv2NewTest`, `DailySessionFlow.jsx`), so this is a genuine hole in the
   verification of work already committed. **This order closes it.**
2. **Submit → grade → completion.** That belongs to the NEXT folds (cutover-b/c), which are not written
   yet. **Not this order. Do not chase it**, and do not treat its absence as a failure here.

## The route you proposed, taken

You offered: *"a 25WT account seeded at day-start with an MCQ review type (the driver handles MCQ)."*
Do that. Your driver's selectors already match MCQ, which is why the typed surface blocked you last round.

## The sequence

**Step 1 — same refusal gates as r098.** `src/config/featureFlags.js` must read
`export const REVIEW_V2_CLIENT = false`. **If it is anything else, REFUSE** — the premise is that you are
exercising the LEGACY path. 25WT identity only; **never 26SM**.

**Step 2 — seed or select a 25WT account positioned at DAY START**, on a class/list whose review test
type is **MCQ**, so the day begins at new-word study rather than mid-session.

**Step 3 — `npm run dev`**, then drive with Playwright from the beginning of the day:
new-word study → **new-word test** → review study → review test. Screenshot each screen at 1440px.
The two screens that matter and that r098 could not reach are **new-word study** and **the new-word test**.

**Step 4 — the actual check.** With the flag off, is the new-word phase identical to today? Same words,
same count, same order, same copy, same transitions. Compare against prior rounds' screenshots where you
have them.

**Step 5 — console for the whole run.** As before: **any new error or warning is a finding**, even if the
UI looks right.

**Step 6 — report** `docs/plans/loop/win/reviews/winclaude_099.md` with the screenshots, the console
verbatim, and a plain yes/no: is the flag-off NEW-WORD phase unchanged?

## Expect this, and do NOT report it as a regression

Flag-**ON** the review sheet removes the "Words #a–b" range line (the segment it described no longer
exists under the engine). **You are flag-OFF, so it must still be present.** Its absence flag-off WOULD be
a finding.

## Boundaries — unchanged from r098

- **25WT ONLY. Never 26SM. No production data, no writes to any live student.**
- **Do NOT flip `REVIEW_V2_CLIENT`.** Flag-ON verification is a later order against a rehearsal class.
- No deploys. No commits, no branching, no stash, no reset. Leave the tree dirty; I commit.
- **Do NOT reinstall or modify `node_modules`** — shared checkout, concurrent session active. If vite will
  not start, that is a REPORT, not something to fix.
- Do not edit source to make something render. If it does not render, that IS the finding.

## Refuse and hand back if

1. `REVIEW_V2_CLIENT` is not `false`.
2. You are asked — by this file or anyone mid-run — to use a 26SM identity, to deploy, or to flip a flag.
3. No 25WT account can be positioned at day start with an MCQ review type. **Report that rather than
   substituting a typed class** — a typed run would reproduce r098's block and prove nothing new.
4. Anything is ambiguous. Report and STOP beats improvise.

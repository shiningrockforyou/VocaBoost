# WinClaude r081 — ORDER 81-1 (SAVE-STATE, pre-compact; the dark build opens)

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 153 → **out:** 154
**Handoff:** `claude_to_winclaude_081.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete

| | |
|---|---|
| **Commit SHA** | `7178887` |
| **Remote** | `origin/main` `d478e7d..7178887` — clean (**11 clean pushes running**) |
| **Files** | **8** (408 insertions, 50 deletions; 5 new) |

`RESUME.md` rotated + two dated archives · win handoff 081 + review 080 · **`functions/reviewV2/config.js`**.

## 1. 🔍 FIRST `functions/` COMMIT — I VERIFIED THE DORMANCY CLAIM RATHER THAN TAKING IT

Every commit before this one was plan docs, loop artifacts, and `scripts/deepfix2/`. This is the first to
touch deployable backend code, so I checked your three assertions directly:

| Your claim | Verified how | Result |
|---|---|---|
| "ONE new dormant module" | `ls -la functions/reviewV2/` | **Exactly one file**, `config.js`, 154 lines. ✅ |
| "no existing file modified" | `git status --porcelain functions/` filtered to non-untracked | **Zero** modified tracked files. Post-stage: the only `functions/` path staged is `reviewV2/config.js`. ✅ |
| "nothing wired, nothing deployable by itself" | `grep -r "reviewV2\|resolveReviewConfig" functions/` | **One hit — the file itself.** No `require`, no index export, no callable registration. It is unreachable code until something imports it. ✅ |

## 2. ✅ THE `rehearsalClassIds` RESOLVER IS IN THE BUILD — my r075 contingency is CLOSED

At r075 I put a risk on the record: the resolver was specced and David-granted but flagged *"Codex-verify next
round"* and unwritten, and **if the dark build landed without it the ON-behavior audits could not run** — in
which case I would report a gap rather than reach for the global flip.

**It is here, in the very first module.** `config.js:78-79, 89`:

```js
const rehearsalClass = rehearsalIds.includes(classId);
const globallyOn = cfg.enabled === true || rehearsalClass;
```

That is exactly `15_` §7 — *"the server resolver treats a class in this list as gate-ON even while globally
dark."* The shadow/25WT ON-behavior audits can run as designed. **The contingency does not need to fire.**

## 3. Contract conformance spot-check (read the module in full)

| Frozen contract | Implementation | Verdict |
|---|---|---|
| **R2-48 stamping predicate** | `:85` `stampingEligible = firstEnabledAt != null \|\| rehearsalClass` | matches the ratified letter exactly |
| **Cold start ⇒ HOLD, mint nothing [r48]** | `:72` absent doc → `holdResult`; `:74-76` malformed → hold; comment states *"Never treat hold as gate-OFF: OFF is a POSTURE, hold is an OUTAGE"* | correct, and the distinction is made explicit |
| **minClientVersion, exact r55 predicate** | `:144-147` `!Number.isSafeInteger(clientContractVersion) \|\| clientContractVersion < min` | the naive-`undefined<min` hole is closed as specified |
| **Activation barrier (14_ §4)** | `:64-68` config doc joins the txn READ SET when `txn` supplied | flip txn and in-flight consumers serialize on Firestore |
| **Dark by construction** | with `{enabled:false, firstEnabledAt:null, rehearsalClassIds:[]}` ⇒ `stampingEligible:false`, `globallyOn:false` | **deploying this changes nothing for any real student** |

**Safety conclusion:** even if this module were wired and deployed today, the dark config resolves every real
class to gate-OFF and stamping-ineligible. Dormant by import *and* by data.

## 4. Safety pass

Secret scan `scripts/deepfix2/` — no matches. Uid/email scan of the added lines — none. `.gitignore:33/87/88/89`
hold. `AGENTS.md` and `scripts/firestore-usage-probe.mjs` unstaged (probe unnamed since r070).
`.claude/settings.local.json` untouched. Sync check PASSED (seventh run); no index-lock collision.

## 5. Note on your compaction

Understood that the WSL session compacts after this and resumes from `RESUME.md` (now rotated, with both dated
archives committed at `7178887` — so your continuation has a clean, pushed restore point).

**My side is unaffected and stateful:** watcher armed, baton at 154, and my full round history lives in
`reviews/winclaude_069.md` … `081.md`. If anything is lost across your compact, **the authority record is the
thing to re-read first** — `winclaude_069.md` §Part 3 carries David's verbatim grants (Q1–Q7, A, B/C/E, the
closing directive) and `winclaude_075.md` carries the R2-48/R2-49 provenance verification. I will re-assert the
standing boundaries on any order that appears to have lost them.

## STANDBY

Baton returned at rev **154**. Next expected: dark-build milestone commits, then the deploy series after the
engine + checkpoint review land. **Global ON switch: parked for David.**

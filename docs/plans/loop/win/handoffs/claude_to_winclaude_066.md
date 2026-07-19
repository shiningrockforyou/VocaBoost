# WSL → WinClaude round 66: COMMIT + PUSH the session's work (David-directed)

David: "commit / push via winclaude." Save the session's uncommitted docs/scripts/help/coordination to git.

## Scope (WSL surveyed — 54 files: 14 modified + 40 untracked)
- **Docs/logs:** RESUME.md (+ rotated `docs/resume_archive/RESUME_2026-07-20.md`), SUPPORT_RUNBOOK.md, change_action_log.md,
  docs/TA_SUPPORT_GUIDE.md, docs/TA_FAQ.md (NEW), MASTER_TASK_LIST.md, MASTER_TASK_TRACKER.md, the D3.5 plan docs.
- **Help pages (client):** public/help-{student,teacher}-{en,ko}.html — the FAQ/help refresh.
- **Scripts:** scripts/cs/{verify-token-reset,find-grader-false-negs,reconcile-inflated-csd,reconstruct-yyj-grader-input}.mjs,
  scripts/{grader-check-english-def,grader-replay-yyj}.mjs, scripts/fixtures/, scripts/cs/data-integrity-sweep.mjs (modified),
  audit/deepfix/task6/r62_verify_report.mjs.
- **Loop coordination:** docs/plans/loop/** (baton.json ×2, codex reviews r33-r39, handoffs, ready markers, win r62-r066).
- **`.firebase/hosting.ZGlzdA.cache`** (tracked, changed — include to keep the tree clean).

**WSL verified:** NO uncommitted `functions/` or `src/` CODE (all already deployed @ 0992f5f/6094cdd) — the ONLY
client-affecting files are the 4 help HTML pages. NO secrets/backups in the set (gitignore holding).

## STEP 1 — targeted add (NOT `git add -A` — `.gitattributes = * text=auto` renorm hazard)
```
git add RESUME.md SUPPORT_RUNBOOK.md change_action_log.md .firebase/hosting.ZGlzdA.cache \
  docs/ scripts/ \
  public/help-student-en.html public/help-student-ko.html public/help-teacher-en.html public/help-teacher-ko.html
git diff --cached --stat | tail -5     # sanity: ~54 files
```
**ABORT if the staged set** contains `serviceAccountKey.json`, any `.env`, `dsg-edits/`, `backups_*`, or explodes into
hundreds of unrelated renormalized files. Otherwise continue.

## STEP 2 — commit
```
git commit -m "docs+help: session save — TA help/FAQ refresh (weekly tokens, grader/#11/class-carry) + CS scripts, plan docs, loop coordination, RESUME rotate"
```

## STEP 3 — push
```
git push origin main
```
⚠️ **This push auto-triggers the Netlify build** (no `[skip netlify]`) → the 4 updated help pages go **live on
`vocaboostone.netlify.app`**. That's intended (the help should be live). **Do NOT deploy functions** — nothing in
`functions/` changed. **Do NOT `firebase deploy --only hosting`** unless separately told — Firebase-hosting parity for the
help pages is a pending David decision (WSL is asking him).

## STEP 4 — hand back
- Report the new commit SHA + confirm the push (`<prev>..<new> main -> main`) + note the Netlify auto-build kicked off.
- Write `docs/plans/loop/win/reviews/winclaude_066.md`. Set baton `turnOwner=claude round=66 taskId=COMMIT_SESSION_SAVE
  execStatus=review-written execDecision=<PUSHED|BLOCKED|ERROR> updatedBy=winclaude revision=132`.

No 26SM data writes — this is a git commit of docs/scripts/help only.

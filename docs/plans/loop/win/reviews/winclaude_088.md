# WinClaude r088 — ORDER 88-1 (r76 fold) + 🔴 **THE NETLIFY AUTO-DEPLOY FINDING**

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 167 → **out:** 168
**Handoff:** `claude_to_winclaude_088.md` · **Authority:** B + E (David, r69).

## THE SHA (bind the r76 review to this)

# `503b3ed`

`503b3ed3c263ae511af3ce09f456014764fddef7` · `origin/main` `e1c20ba..503b3ed` · 14 files
(493 insertions, 171 deletions; 5 new, 1 deletion).

## 1. 🔴 YOUR LINE 28 EXPOSED A CONTROL BYPASS — ESCALATED TO DAVID

Your order noted, in passing: *"this push redeploys the client via Netlify."* **That single line invalidates
a control David set, and neither of us had it right until now.**

**What I verified:**
- Live production is **`https://vocaboostone.netlify.app`** (`audit/deepfix/MASTER_TASK_PLAN.md:28`).
- There is **no `netlify.toml`** in the repo and **no `.github/workflows/`** — so the build is wired on
  Netlify's side via its Git integration, i.e. **every push to `origin/main` triggers a production client
  build and deploy.**
- `firebase.json` does define a `hosting` target (`public: "dist"`), but live traffic is Netlify's. So
  `firebase deploy --only hosting` was never the lever that ships the client — **`git push` is.**

**The consequence, stated plainly:**

1. **David's Q6 condition is structurally bypassed.** He granted hosting deploys *only after OFF-parity and
   old-bundle checks pass*. That gate cannot bind a deploy that fires automatically on push.
2. **A client change has already shipped to production.** Commit **`c7abf0a`** (the r70 fold) contained
   `src/services/db.js` — the +7-line grading-preimage copy. **It went live at that push**, without the
   checks Q6 conditioned on.
3. **My own stated boundary was never enforceable.** I told David repeatedly "I will not deploy hosting."
   True in letter, worthless in effect: I have pushed **18 times** tonight, and every one deployed the client.
   My r083 line — *"the shipped bundle will differ the moment hosting deploys"* — was wrong; it had already
   differed, at the push.

**Severity, honestly:** the live harm is most likely **nil**. The db.js change is additive, writes one extra
boolean, and sits in `reviewChallenge` — a **teacher** action, not a student path. It is arguably beneficial
(it stops growing the R2-49 legacy-reconstruction class). **The defect is in the control, not the code.**

**The forward implication is the serious part:** the remaining ~41% of gate 2 is the **frontend**. Under this
wiring, **every frontend commit to `main` ships straight to live students** — mid-build, unreviewed, ungated.
That cannot proceed as-is.

**Options for David (his call, not ours):** build the client on a **branch** and merge only at the gate ·
**pause the Netlify auto-publish** for the build window · or accept incremental shipping with the OFF-parity
check re-run per push. **I have escalated to him and will not treat the frontend phase as safe to commit to
`main` until he rules.**

### ✅ RESOLVED SAME-SESSION — David's ruling

**David, verbatim: "I turned off auto publishing so it is a non-issue. Continue"**

Netlify auto-publish is **OFF**. Pushes to `main` no longer publish to production; builds are held for his
manual publish. This **restores the Q6 gate properly** — the OFF-parity and old-bundle checks can now run
against a built-but-unpublished deploy before he releases it, which is exactly the shape the condition wanted.

**Unblocked:** the frontend phase **can be committed to `main`** without shipping to live students. No branch
strategy is needed. The already-shipped `db.js` change stays live (harmless, teacher-path, additive) — no
rollback indicated.

## 2. Order verification

- **`functions/change_action_log.md` deletion staged and committed** — `D` confirmed pre-commit, `delete mode`
  in the commit. The stray file is gone.
- **Root log now carries both rows** — `grep -c "r75 FOLD\|THE r76 FOLD"` → **2**, as you specified. The r87
  defect is fully closed, and your absolute-path rule for living-log writes is the right permanent fix.
- **No `src/**` in this commit** — verified pre-commit. Per §1 this push *did* trigger a Netlify build, but
  with the client tree unchanged **the shipped bundle is byte-identical**. Your note was accurate.
- **Protocol change understood:** the loop/ directory is partial by design (no r76 handoff or marker) because
  the review target must be committed before the marker publishes. Nothing missing was flagged as missing.

## 3. Push note

The first `git push` **timed out at the 2-minute default** (exit 143) with the ref not advanced; the retry
succeeded. Worth knowing for unattended rounds: a push can exceed 2 minutes here, so a timeout is not proof of
failure — **check `git rev-parse HEAD origin/main` before concluding anything.** I did, found `ahead 1`, and
retried rather than assuming either outcome.

## 4. Safety pass

Nothing matching `serviceAccount`, `trackB`, or `audit/` staged. Sync check PASSED (fourteenth run). Lap
217/217.

## STANDBY

Baton returned at rev **168**. Review target bound: **`503b3ed`**. On Codex r76 YES the dark-deploy series
begins — and per §1 I will want David's ruling on the Netlify wiring **before** any frontend work is committed
to `main`. The backend dark-deploy is unaffected by this finding (functions/rules/indexes are deployed by
`firebase deploy`, not by push).

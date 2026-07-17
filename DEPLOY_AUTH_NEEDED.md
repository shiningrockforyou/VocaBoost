# ⚠️ DEPLOY AUTHORIZATION NEEDED (2026-07-17) — the one thing blocking "full implementation"

The full-implementation run is proceeding on everything that does NOT require a deploy (build, verify,
Codex review, dev-E2E, migration rehearsal on 25WT, prod audits of the current state). But **nothing can
ship live** until deploy authority is resolved:

- **WSL-Claude (me):** CANNOT `git push` (no git credentials for origin) and has NO firebase CLI. I can only
  edit code, run prod-Playwright (sandbox identities), run admin scripts, and drive the batons.
- **Windows Claude:** CAN push + `firebase deploy` (CLI 14.27, logged in as dmchwang@gmail.com, project
  vocaboost-879c2) — **but it will NOT act on my relayed "David said full-auto." Its standing rule from you is
  "never commit/push/deploy without David's DIRECT, in-the-moment say-so."** (Correct + safe of it.)

## To unblock (pick one), then the pipeline ships end-to-end:
1. **Tell Windows Claude directly** (in its session) that it's authorized to `git commit/push` to main and
   `firebase deploy --only functions` for this run — OR
2. **Give WSL-Claude push + firebase creds** (a GitHub token for origin + `firebase login` in WSL), and I'll
   do the deploys myself.

Everything is being staged so that, the moment this is unblocked, the deploys + flips + migration + end-state
audits run in sequence. See SESSION_TODO_2026-07-17.md for live status.

---
**UPDATE 2026-07-17:** David said "I'll talk to it myself regarding the deployment" — he is authorizing Windows Claude directly. No action needed from this side; the pipeline stays staged deploy-ready.

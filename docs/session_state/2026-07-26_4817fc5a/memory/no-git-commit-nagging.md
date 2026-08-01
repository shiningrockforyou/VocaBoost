---
name: no-git-commit-nagging
description: Never ask David whether to commit plan/doc files to git — he told me to stop asking (2026-07-26)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4817fc5a-d68b-443f-96c2-c94ed4b10bf5
  modified: 2026-07-25T17:11:46.919Z
---

David (2026-07-26): "Stop asking me if I want to commit 'plans' to git."

**Why:** I had recommended committing the deepfix2 planning docs twice in one session (after auditors flagged them as
untracked). He experiences repeated commit suggestions as nagging.

**How to apply:** Do not raise git commits for planning/doc files unprompted — not as a recommendation, not as a
"housekeeping flag." Commit only when he explicitly instructs it. Protecting docs from overwrite-loss is handled by
in-directory archives (e.g., `docs/plans/deepfix2/_archive/`) instead, which needs no ask.

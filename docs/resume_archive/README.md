# Resume archive

Dated snapshots of `/RESUME.md` at each session boundary. `/RESUME.md` is the **canonical, always-current**
resume pointer (CLAUDE.md tells new sessions to read it on "resume"). This folder is its history.

## Rotation convention (do this at each save-state / end of session)
1. **Copy** the current `/RESUME.md` to `docs/resume_archive/RESUME_<YYYY-MM-DD>.md` (the date the snapshot
   captures; append `_HHMM` or `_b`, `_c` if multiple in one day). **Copy, don't move** — `/RESUME.md` must
   never disappear (CLAUDE.md + tooling depend on that fixed path existing).
2. **Overwrite** `/RESUME.md` with the new active-stream state.
3. Result: `/RESUME.md` = latest; this folder = every prior boundary, newest filename = most recent.

Don't edit archived files after they're written — they're point-in-time snapshots.

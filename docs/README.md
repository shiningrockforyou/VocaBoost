# docs/ — planning & reference

Working docs for VocaBoost. Code-change/CS *living logs* stay at the repo root (CLAUDE.md references
them): `change_action_log.md`, `change_action_log_ap.md`, `SUPPORT_RUNBOOK.md`, `NEED_TO_FIX.md`,
`CHANGELOG.md`.

- **`plans/`** — `PLAN_*`, `ROADMAP_*`, `*_FIX_PLAN`, handoffs. The intended-work specs.
- **`design/`** — `DESIGN_*`, `*_SPEC`, tech specs, data-structure/architecture reference.
- **`audits/`** — `*_AUDIT`, `*_REPORT`, code reviews, verifications, UI audits.
- **`patches/`** — `PATCH_*` per-patch root-cause/implementation write-ups.

Convention (per CLAUDE.md): every code change → a `change_action_log.md` row; each significant phase →
a `docs/patches/PATCH_*.md`; each plan → `/plan-audit` (3-agent) + Codex before deploy.

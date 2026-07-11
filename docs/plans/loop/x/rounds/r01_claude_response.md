# Round 01 — Claude's response / synthesis

**Reviews of v1:** 3-agent audit COMPLETE + code-verified (`r01_agents_audit.md`). Codex's v1 review did
NOT complete — the container hit a usage limit ~70k tokens in, before writing a review or flipping the
baton (driver caught it; baton intact; no corruption). So this round is agent-only; Codex's first pass
will land on the revised plan.

## Verified findings (accepted — all traced to real code by me)
- **BL-1 shared-list blast radius** (B; corrob A/C) — lists are per-teacher (`db.js:459`), assigned
  class-wide (`db.js:502/797`), one listId shared across dozens of classes. ACCEPTED.
- **BL-2 wordCount = cohort progress denominator** (A/B/C, all three) — bump dilutes every student's bar.
  ACCEPTED (`Dashboard.jsx:963/1050/1889`).
- **BL-3 position-collision** (A/B) — `deleteWord` (`db.js:631-634`) doesn't renumber → `baseCount`
  stride collides. ACCEPTED; fix = stride `maxPosition+1` + contiguity assert.
- **BL-4 Full-PDF duplicates words** (C) — `fetchAllWords`→`pdfGenerator.js:141`. ACCEPTED.
- **H-1 mid-cycle --revert corrupts** (A) — reconciliation drives twi past restored wordCount. ACCEPTED.
- **H-2 copies-of-copies on re-run** / **H-3 teacher edits don't propagate** / **H-4 --dry hides blast
  radius** / **H-5 non-atomic write** — all ACCEPTED.
- Mediums M-1..M-5 ACCEPTED (logged as open items). §4 per-site verdicts confirmed: only PDF + MCQ/blind
  distractor text break; blind-count/mastery/gradebook/review are wordId-keyed (SAFE).

## Rejected / corrected
- None rejected — the agents' code citations all held under my verification. (§3's line-level claims and
  the contiguous-case mechanism are correct, as A confirmed; the flaw is the shared/non-contiguous cases.)

## Strategic conclusion → plan must fork before v2
The audit shows **"silently extend a shared list" is unsafe** (BL-1/2/4). Fixing the mechanics (BL-3,
H-1..5) doesn't remove the blast radius — the *approach* needs a decision. The real root bug is
`isListComplete` being unhandled (zero consumers, `studyService.js:277`). The product fork (owner
decision, teed up for David):
- **Auto-advance** to the next assigned list on completion (Base→Ascent→Summit): clean, no blast radius,
  matches teacher intent; but not "cycling."
- **True cycling** (re-study same list): what David asked for, but the safe form needs per-student lap
  logic + solving the reconciliation-wrap problem (code+deploy), since the shared-extension shortcut is
  unsafe.
- **Hybrid** (recommended): auto-advance through the ladder; cycle only the final list.

v2 is written after David picks the direction — no Codex spend until then (respects the ~70k/round cost).

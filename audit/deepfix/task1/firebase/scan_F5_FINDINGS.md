# F-5 findings — config drift (thresholds) — READ-ONLY

Offline analysis of `census_classes.json` (26SM, 2026-07-13). Target normal = passThreshold 92 / newWordRetakeThreshold 0.92.

## 12 live off-normal assignments (all 제주 / 유라시아)
| Class | list | passThreshold | newWordRetakeThreshold | assignedAt | exposure |
|---|---|---|---|---|---|
| 제주 SAT BRIDGE | Ascent | 90 | **UNDEF** | 2026-07-10 | 90-tier + 0.95 fail-closed |
| 제주 SAT BRIDGE | Summit | 90 | **UNDEF** | 2026-06-07 | 90-tier + 0.95 fail-closed |
| 유라시아 SAT Core | Ascent | 92 | **UNDEF** | 2026-07-06 | 0.95 fail-closed |
| 유라시아 SAT Core | Summit | 92 | **UNDEF** | 2026-05-30 | 0.95 fail-closed |
| 제주 SAT CORE | Summit | 90 | **UNDEF** | 2026-07-07 | 90-tier + 0.95 |
| 제주 SAT CORE | Ascent | 90 | 0.92 | 2026-06-08 | **INVERSE** (server 90, client 0.92) |
| 제주 SAT CORE | BaseCamp | 90 | **UNDEF** | 2026-06-07 | 90-tier + 0.95 |
| 유라시아 SAT Top | Summit | 92 | **UNDEF** | 2026-07-07 | 0.95 fail-closed |
| 유라시아 SAT Top | BaseCamp | 92 | **UNDEF** | 2026-05-30 | 0.95 fail-closed |
| 제주 SAT TOP | Ascent | 90 | 0.92 | 2026-06-06 | **INVERSE** (server 90, client 0.92) |
| 제주 SAT TOP | Summit | 90 | **UNDEF** | 2026-07-07 | 90-tier + 0.95 |
| 제주 SAT TOP | BaseCamp | 90 | **UNDEF** | 2026-06-05 | 90-tier + 0.95 |

## Reads
- **The CS-2026-07-04b "54/54 at 92/0.92" claim is contradicted** — 제주/유라시아 remain at 90 / UNDEF. The
  earlier CS-2026-07-04 entry itself flagged the 제주 90-tier as "await David's call, not changed" → these were
  NEVER normalized (07-04b's regex/scope missed them, or later ensure-all-lists adds re-introduced the props).
- **assignedAt spans 2026-05-30 → 07-10** → the consolidator's "07-13 mirror re-introduced old props" hypothesis
  is only PARTIALLY right: several drifted rows predate 07-13; it's a mix of never-normalized + later adds.
- **Live #5 exposure:** the ~10 `UNDEF` rows → client `retakeThreshold` falls back to 0.95 (`TypedTest.jsx:87`)
  → a genuine 92-94% pass shows "fail" if class-threshold resolution hiccups. The 2 INVERSE rows → a genuine
  90-91% pass shows "fail" outright.
- **Config drift keeps recurring** (07-04, 07-04b, now 07-13) → empirical case for the DURABLE code fix (C-23:
  result card trusts server `passed`; client fails OPEN) over perpetual config maintenance.
- **testSizeNew distribution** = {25 ×12 (Bridge), 30 ×69, 35 ×15 (Top/Final)} → **no class has testSizeNew < 25**,
  so F-2's small-q undersized tests (q<25) cannot be attribution noise — genuine #13.

## PROPOSAL (surface-only — David authorized NO live writes this program)
A config-only CS write would set these 12 to 92/0.92, but per authorization I do NOT execute it. Recommended
instead: fold into the C-23 durable fix (trust server `passed` + fail-open + resolve `newWordRetakeThreshold`
robustly) so the client never depends on a mirrored threshold field — the recurrence (3× now) is the argument
for the code fix, not another config sweep. If David wants the interim config fix, it's a one-shot
per-assignment write (92/0.92) to the 12 rows above, sweep-before/after.

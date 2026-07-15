# Pre-emptive server-side fixes needed for 26SM students — 2026-07-13

**Method (one line):** READ-ONLY live-Firebase census of the real active cohort **26SM** (32 classes, 817 enrolled,
**781 started**), run **2026-07-13** via `scripts/cs/scan-preemptive-fixes.mjs` (+ a `collectionGroup` cross-check).
Tier lists: Base Camp `RmNNkuLP` (1200) · Ascent `dVliNv0p` (1600) · Summit `AObYOowh` (800).
**ZERO writes were made** (diagnose-and-propose only). Anchor rule: student+list-scoped max passed-`new`
`newWordEndIndex`, `twi = nwei+1`. "Frozen" = the student's active list allocates `newWordCount ≤ 0` for the next
day (the undeployed #11 review-only wall). "Finished" = `class_progress.totalWordsIntroduced ≥ listSize`.

> Deployed reality check (why these are blockers *today*): the #11 review-only-completion fix + server-authoritative
> deepfix are **not deployed**, so a student sitting on a *finished* list's review-only day is **frozen** with no way
> forward except a server-side fix (advance/reset) — this is why CS has batch-advanced all week (SUPPORT_RUNBOOK
> CS-2026-07-13c–f).

## Summary

| # | Bucket | Count | Fix type |
|---|---|---|---|
| **1** | **RESET CANDIDATES — finished BOTH Ascent AND Summit** | **4** | **Reset (destructive) OR #11 deploy** — David's call |
| 2 | Finished-list dead-end **WITH** a next list available | **38** | Advance to next list (`settings.primaryFocus*`, batch-advance pattern) |
| 3 | Finished-list dead-end with **NO** next list | **4** | Reset / review-loop bridge — **identical set to bucket 1** |
| 4 | Cross-class carry / LIVE-STRAND (active doc ≥1 day behind own cross-class anchor) | **20** flagged (**~4 genuinely stuck**) | Carry-forward reconciliation (`reconcile-ascent-carry` / `manual-pass` to the anchor day) |
| 5 | Invalid / corrupt anchor | **0** | — (cohort clean) |
| 6 | Permafail (0 tokens + can't retake) | **0 genuine** (3 heuristic hits, all false-positives) | — |
| 7 | Other blocking (impossible/stuck session_state) | **1 candidate** (uncertain / likely self-heals) | `manual-pass` + session repair *if* it persists after reload |
| — | *(non-blocking, excluded)* #13 undersized test | 18 students | Not a blocker — quality issue only |

**Primary (exclusive) assignment:** bucket 1 = 4, bucket 2 = 38, bucket 4 = 19, bucket 6 = 3(false-pos), bucket 7 = 1.
Plus **36 "advanced-pending"** students already pinned to a not-yet-started next list — **correctly NOT flagged** (they'll
start the new list on next load; excluded from bucket 2 to avoid the obvious over-count).

**Independent cross-check (`collectionGroup` over `class_progress`, 26SM only):** finished Ascent (twi≥1600) = **67**,
finished Summit (twi≥800) = **5**, finished Base (twi≥1200) = **107**, **finished BOTH = 4** (matches bucket 1 exactly).
The 5th Summit-finisher (Soul Kim, below) finished Summit but is only ~Day 6 of Ascent → **not** a reset-both candidate.

---

## Bucket 1 — RESET CANDIDATES (finished BOTH Ascent AND Summit) — HIGHEST PRIORITY

All 4 are frozen at the #11 list-end wall (their pinned/active list is a completed list; the next review-only day
allocates 0 new words and the completion gate blocks it). None has a higher list left. These are the same 4 as bucket 3.
Cross-checked two independent ways (per-student attempt anchors **and** cohort `collectionGroup`).

| Name | Email | uid(short) | Class(es) | Base twi | Ascent twi | Summit twi | Last activity | Last login (Auth) | Pinned → | Active | Frozen |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 함지민 (Hamsters) | jhamsters9@gmail.com | `pETMPXmY` | 미주 SAT Final | 0/1200 | **1600/1600 ✓** | **800/800 ✓** | 2026-07-08 | 2026-06-08* | Ascent | Ascent | yes (list-end) |
| 유찬 | yuchanchon@gmail.com | `FR3TfAmH` | 미주 SAT Adv. [한국어 혼용] | 0/1200 | **1600/1600 ✓** | **800/800 ✓** | 2026-07-10 | 2026-06-01* | Ascent | Ascent | yes (list-end) |
| Gaon Lee (이가온) | gaonlee0909@gmail.com | `TGJNuQ1v` | SAT Final A | 0/1200 | **1600/1600 ✓** | **800/800 ✓** | 2026-07-10 | 2026-07-09 | Ascent | Ascent | yes (list-end) |
| Young Cho | choyoung8767@gmail.com | `A2a7wgrL` | SAT Final A | 0/1200 | **1600/1600 ✓** | **800/800 ✓** | 2026-07-10 | 2026-07-10 | Summit | Summit | yes (list-end) |

\* Auth `lastSignInTime` lags real usage (token refresh doesn't bump it); the **attempt activity date** (2026-07-08/10)
is the reliable recency signal — all 4 were active within the last ~5 days.

**Per-list detail incl. mastery (study_states — what a reset would wipe):**

- **함지민 `pETMPXmY`** — Ascent csd 16, twi 1600, mastery 1600/1600 · Summit twi 800, mastery 800/800 · Base none. Clean full mastery on both.
- **유찬 `FR3TfAmH`** — Ascent csd 20, twi 1600, mastery 1600/1600 · Summit twi 800, mastery 800/800 · Base none. Clean.
- **Gaon Lee `TGJNuQ1v`** — Ascent csd 16, twi 1600, **mastery 1503/1600** · Summit twi 800, mastery 800/800 · **Base: 100 study_states** (twi 0). ⚠️ This is **이가온** (CS-2026-06-24: Days 10-12 were manual passes for a load hang) — her Ascent mastery (1503) trails twi (1600) by ~97 = the known credited-but-unstudied gap (census F-11). A reset that wipes study_states discards **1503 genuinely-mastered** Ascent words + 800 Summit + 100 Base.
- **Young Cho `A2a7wgrL`** — Ascent twi 1600, mastery 1600/1600 · Summit csd 8, twi 800, mastery 800/800 · Base none. Clean. (Note: pinned to **Summit** — the others are pinned to Ascent.)

### Proposed RESET approach (PROPOSAL — not written, not executed)

There is **no existing reset script** (`scripts/cs/` has advance/carry/manual-pass only; `scripts/delete-student-attempts.js`
deletes attempts but nothing else). A proper per-student, per-list reset would be a **new** `scripts/cs/reset-student-list.mjs`
(with `--dry`, read-back sweep before/after). For a given `(uid, classId, listId)` it would:

**Clear (to restart the list from Day 1):**
1. `users/{uid}/class_progress/{classId}_{listId}` → set `currentStudyDay=0`, `totalWordsIntroduced=0`, clear
   `recentSessions`/`interventionLevel`/stats (or delete the doc so `getOrCreateClassProgress` rebuilds fresh).
2. `users/{uid}/session_states/{classId}_{listId}` → **delete** (forces a clean Day-1 session build).
3. `users/{uid}/study_states` where `listId == {listId}` → **delete** — *this is the destructive core*: it un-masters the
   words so the review engine re-introduces them (without this, "reset" days would skip every word as already-known).

**Preserve (do NOT touch):**
- **`attempts`** — keep for gradebook/audit history (do not delete; optionally stamp a `resetAt` marker). Note: old
  passed-`new` attempts remain the list anchor, so reconciliation would immediately re-derive the finished twi and
  **undo** the reset — therefore a reset MUST also neutralize the old anchors (archive them to a `listId_reset_<date>`
  or set `supersededByReset=true` so `getMostRecentPassedNewTest` ignores them). **This is the sharp edge** — without it
  the class_progress reset is cosmetic and self-reverts on next load.
- Enrollment (`studentIds`/`enrolledClasses`), other lists' progress, and study_states for other lists.
- `settings.primaryFocus*` → repoint to the reset list so they land on it Day 1.

**Which callable/script:** no server callable exists for this; it would be an admin-SDK script (like the other CS
scripts). Given the anchor-neutralization requirement, this is **more involved than any prior CS write** — recommend
writing + `--dry`-verifying it and getting explicit per-student authorization before any run.

### Risk / recommendation
- **Destructive & effectively irreversible** — wipes real mastery (esp. Gaon Lee's 1503 Ascent study_states = genuine learning).
- **All 4 are truly finished-ALL** (twi at cap on both lists, full or near-full mastery) — none is "mid-Summit," so a reset
  is *legitimate* if the goal is a fresh re-study. There is no "accidentally resetting an in-progress student" risk here.
- **Safer alternative to consider first:** these 4 are frozen *only* because the **#11 review-only-completion fix + §5
  finished-terminal is undeployed**. Deploying it unfreezes them (they'd get a review/cycle terminal state) **without
  destroying mastery** — a reset is only warranted if David specifically wants them to re-learn from Day 1 rather than
  review/cycle. **Recommend: confirm intent per student, and prefer the #11 deploy unless a true restart is desired.**

---

## Bucket 2 — Finished-list dead-end WITH a next list (38) → advance to next list

Finished their current list and are frozen at the #11 wall, but a **higher, unfinished, assigned** list exists → fix =
set `settings.primaryFocusListId/ClassId` to the next list (the CS-2026-07-13d/e batch-advance pattern; config-only, no
progress touched). 33 are still pinned to the finished list, 5 have no pin (default resolves to the finished list). All
have all 3 lists assigned (ensure-all-lists, CS-2026-07-13e).

**Ascent → Summit (26):** 송유나 (thddbsk12345, Adv A1) · Jooyeol Baek (jooyeolbaek, Adv A2) · Jeoung yun seo
(yunseojeoung1, Adv A2) · Hajin Lee (hjcraft09, Adv A2) · Jooah Hong (jooah0204, Adv A2) · 송유주 (yuju021724, Adv A2) ·
원위화 (xuanzhu7978, Adv A2) · 윤주하 (juhyn1004, Adv B1) · 조예진 (jyj080727, Adv B1) · Grace Ryu (ryut28@ma.org.tw, Adv B2) ·
김서율 (seoyulkim0, Adv B2) · MOOKYEOL HONG (mookyeolh, Adv B2) · 박종호 (jonpark0326, Adv E) · 정유진 (eugenec413, Adv E) ·
김연재 (jenniekim10304, Final A) · 김민서 (kima29173, Final A) · 안예진 (dpwledks412, Final A) · 이수린 (soorin10331, Final A) ·
Alex Kim/김유하 (alexyuha09, Final A) · 손수민 (kyle.m.sohn, Final B) · Hongjun Kim (khongjun36, Final B) · 남서정
(chloesj.nam, 미주 Adv) · 배지성 (baejisung174, 미주 Final) · 노하연 (nohhayeon0102, 미주 Final) · 정진아 (jinahchung0116, 미주
Final) · Hyo Won Jeon (29hjeon@aes.ac.in, 유라시아 Top).

**Base Camp → Ascent (12):** 김우석 (yuposoccer, Inter A1) · 박시율 (siyoolp, Inter A1) · Seoji Back (gons06010601, Inter
A1, *no pin*) · 김나연 (nayunkim777, Inter A1 — CS-2026-07-03) · 이강혁/말레이시아 (trevor37521, Inter A3) · chaehyeon
(moonchae216, Inter B2) · Jungmin Kodjo Hwang (jungminacc170078, Inter B2, *no pin* — CS-2026-06-29C) · Rachel Pak
(rachelpak212, Inter B2, *no pin*) · Jinhoo Hong (hong10311040414, Inter B4) · Jisu Kim (jisukim369, 미주 Bridge, *no pin*) ·
안이연/Yiyeon Ahn (lisayiyeon, 미주 Inter — CS-2026-07-13) · Jioh Bak (jiohbak2008, 미주 Inter [한], *no pin*).

---

## Bucket 3 — Finished-list dead-end with NO next list (4)

**Identical set to bucket 1** (all 4 finished the top assigned tier). Since ensure-all-lists (CS-2026-07-13e) gave every
class all 3 tiers, the only students with "no next list" are those who finished the top list (Summit) *and* Ascent —
i.e. the reset candidates. Fix = reset (bucket 1 proposal) **or** a review-loop bridge / #11 §5 finished-terminal (deploy).
- 함지민 `pETMPXmY` (미주 Final, finished tier Ascent+Summit) · 유찬 `FR3TfAmH` (미주 Adv[한]) · Gaon Lee `TGJNuQ1v` (Final A) ·
  Young Cho `A2a7wgrL` (Final A). All `alsoBucket1 = true`.

---

## Bucket 4 — Cross-class carry / LIVE-STRAND (20 flagged; ~4 genuinely stuck) → carry-forward reconciliation

Students whose **pinned/active** doc on a list is ≥1 day (≥pace) behind their **own cross-class max passed-`new` anchor**
(anchor earned in a *different* class). All 20 are dual-enrolled. Fix = carry-forward (`reconcile-ascent-carry.mjs`
derived write, or `manual-pass` to the anchor day) — the CS-2026-06-30/07-02b/07-08/07-13 family.

> **Important caveat (honesty):** the app's reconciliation is student+list-scoped and **non-demoting** (`db.js`
> `getMostRecentPassedNewTest`), so it **should carry the anchor forward on the next load** — meaning most of these
> **self-heal** and are latent, not hard-stuck (this matches CS-2026-07-13, where most flagged carry-cases were false
> positives). I therefore split by recency: only students **actively re-studying the trailing doc across ≥2 recent days**
> (reconciliation demonstrably *not* applying) are treated as genuinely stuck today.

**Genuinely stuck (daysBehind ≥ 2 — re-studying mastered words right now):**

| Name | Email | Active doc (behind) | Anchor (twi @ class) | Lag | Days behind (7d) | Last activity |
|---|---|---|---|---|---|---|
| Sungyoon Lee | 28su356@ismanila.org | Inter B4 · Base twi 320 | 960 @ Bridge (TOP) | 640 | 4 | 2026-07-10 |
| Jooheon Lee (이주헌) | jooheon0923@gmail.com | Final A · Ascent twi 500 | 880 @ Adv A1 | 380 | 4 | 2026-07-10 |
| Sei Nam (남세이) | snam2113@gmail.com | Inter E · Ascent twi 240 | 480 @ Adv E | 240 | 2 | 2026-07-13 |
| 신동윤 | sindongyun239@gmail.com | Adv B2 · Ascent twi 1440 | 1600 @ Final B | 160 | 4 | 2026-07-13 |

- **Jooheon Lee = 이주헌** (CS-2026-06-30, carried to Adv A1, catalog noted "recurs after CS drops") — **re-split again**,
  now active in Final A at twi 500 vs 880 anchor in Adv A1. Recurring cross-class carry-miss.
- **Sei Nam = 남세이** (CS-2026-07-08, Int E deliberately kept) — studying the OLD Int E doc (240) while ahead in Adv E (480).

**Latent (16, daysBehind 0-1 — should carry on load / active in the anchor class; monitor, likely no action):**
전준형/Steve Jun (hururusteve), Hyorin Seo (hyorin4010), jimin (j.m.nii421), 복시은 (sieunbok7), Sieun Park/박시은
(sieunprida), 박주하 (bagjuha477), Sanghyeon Lee (sanghyeon774), Ryan Kim (rjkim1211), 강현준/denis (kanghj148635), 정아영
(ahyoung12208), 김호형 (hperaszz), 변리준 (lijunbyeon), 은솔 (limssol90), Jinhoo Lee (jhalee2429), 민준 (mjnkwak), 현재민
(jaeminhyun0528). *(Full anchor/twi detail in `preemptive_fixes_scan.json` → `B4`.)*

---

## Bucket 5 — Invalid / corrupt anchor (0)

**Clean.** Zero passed-`new` attempts missing an integer `newWordEndIndex` across 781 started students; zero
`csd_anchor_invalid` events in `system_logs`; no ghost-progress or implausible-csd hits. (The 2026-06-21 invalid-anchor
backfill + the `manual-pass.mjs` valid-anchor guarantee are holding.)

## Bucket 6 — Permafail (0 genuine; 3 heuristic hits, all verified FALSE-POSITIVES)

The "0 tokens + ≥3 failed-`new` same day/list (14d)" heuristic flagged 3 — **all verified NOT blocked** (each either
later passed the day or can still retake; `tokens=0` = challenge-token exhaustion, which blocks *challenges*, not
test retakes/advancement):

- **김호형 (hperaszz, Adv E)** — has passing Day-2 (93, 97); most-recent `new` = **Day 10 PASSED (100) today**. Actively
  advancing (Final A twi 900 / Adv E twi 800). The 3 failed Day-2 are cross-class retakes. *(He is a latent bucket-4 case.)*
- **김재민 (gimjaemin960, Final A)** — **passed Day 11 (97, 07-06)**; most-recent `new` = Day 15 PASSED (100). The 4 failed
  Day-11 are the pre-pass attempts documented in CS-2026-07-06b (grader false-negatives → he challenged, exhausting tokens). Not stuck.
- **이서현/Seohyunlee (emily1004enfj, Inter B3)** — passed Day 2 long ago (CS-2026-07-09 consolidation); now on **Day 13
  scoring 90% (just under the 92 threshold)** and retaking. Can still retake → not app-blocked; a **teacher pass/difficulty
  judgment**, not a data fix.

## Bucket 7 — Other blocking (1 candidate, uncertain)

- **정지수 (jisusophia, Adv A2, `eGBgVXlI`)** — session_state (Adv A2 Ascent) = `phase=review-study` +
  `newWordsTestPassed=false` with **undefined dayNumber**; class_progress csd 5/twi 400; she **passed Day-5 `new` (100)
  today**. This is the impossible/lost-save shape (CS-2026-07-07 최도훈 family), **but** because she just passed Day-5 `new`,
  the stale flag most likely **reconciles to true on reload** (session predates the pass). **Recommendation: monitor —
  ask her to reload; only if `phase=review-study/newPass=false` persists with no Day-5 review completing, apply
  `manual-pass`/session repair.** Not a confirmed hard block.

## Not blocking (excluded) — #13 undersized test
**18 students** have an undersized first `new` test (q < 0.6×pace, non-remainder) — matches census F-2. **A quality
issue, not a blocker** (they still advance). Listed in scan JSON only; no fix needed to use the app today.

---

## Recommended CS event log entry (paste into SUPPORT_RUNBOOK.md)

```
## CS-2026-07-13g — Read-only pre-emptive-fix census of 26SM (which started students need a server-side fix today)
- **Scope:** READ-ONLY live census of all 26SM (32 classes, 817 enrolled / 781 started), 2026-07-13, via new
  scripts/cs/scan-preemptive-fixes.mjs (+ collectionGroup cross-check). ZERO writes. Classifies every started student
  needing a fix into buckets; special focus on reset candidates.
- **Bucket 1 — RESET CANDIDATES (finished BOTH Ascent 1600 AND Summit 800): 4** — 함지민 (jhamsters9, 미주 Final,
  pETMPXmY), 유찬 (yuchanchon, 미주 Adv[한], FR3TfAmH), Gaon Lee/이가온 (gaonlee0909, Final A, TGJNuQ1v), Young Cho
  (choyoung8767, Final A, A2a7wgrL). All frozen at the #11 list-end wall, no next list. Cross-checked via
  collectionGroup (finished-both = exactly these 4; a 5th Summit-finisher Soul Kim/soulkim0805 has NOT finished Ascent
  → excluded). Gaon Lee's Ascent mastery is 1503/1600 (known manual-pass credit gap, CS-2026-06-24) — a reset would
  wipe real mastery. PROPOSAL only (reset needs a new reset-student-list.mjs that also neutralizes old anchors, else
  it self-reverts); safer alternative = deploy the #11 review-only/§5 finished-terminal fix. NOT executed — awaiting
  David's per-student decision.
- **Bucket 2 — finished-list, has next list, not yet advanced: 38** (26 Ascent→Summit, 12 Base→Ascent) → batch-advance
  (primaryFocus). 36 more already advanced (correctly not flagged). List in the report.
- **Bucket 4 — cross-class LIVE-STRAND: 20 flagged, ~4 genuinely stuck** (Sungyoon Lee, Jooheon Lee/이주헌 [recurs],
  Sei Nam/남세이, 신동윤 — actively re-studying a doc behind their cross-class anchor); rest self-heal on load.
- **Buckets 5/6/7 essentially clean:** invalid-anchor 0; permafail 0 genuine (3 heuristic hits all false-positives —
  passed the day or can retake); 1 uncertain stuck-session (정지수/jisusophia — likely self-heals on reload, monitor).
- **Non-blocking:** #13 undersized test 18 students (excluded — not a blocker).
- Artifacts (read-only): scripts/cs/scan-preemptive-fixes.mjs, audit/deepfix/task1/firebase/preemptive_fixes_scan.json,
  audit/deepfix/task1/firebase/PREEMPTIVE_FIXES_2026-07-13.md. No writes made.
```

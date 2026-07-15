# I-6 — FOUNDATION: student-owned progress + server-authoritative twi as ONE migration (C-31/C-01)

**Program:** deepfix Task 1.6, investigation I-6 — the keystone (Task-2 gate #3). **Date:** 2026-07-13.
**Author:** I-6 foundation synthesizer. **Method:** READ-ONLY design synthesis over
`PLAN_list_progress_persist.md` (v3.7), `docs/plans/loop/x/plan.md` (§0/§3g),
`PLAN_attempt_write_lockdown.md` + `W3_attempts_lockdown.rules.md`, `PLAN_review_only_day_completion.md`
(§4/§7), `inv_I2_reviewonly_matrix.md` (the S1–S10 day machine), and the exported census data
(`CENSUS2_FINDINGS.md` F-2/F-3/F-4/F-9/F-11, `scan_F3_dualenroll.json`, `scan_F4_hpb.json`). No live
Firebase, no code changes. **Verification stance (David, verbatim: "always verify all claims… Never trust
blindly. Always verify."):** every current-code claim below was re-traced against TODAY's working tree
(marked `[V-I6]`) or carries the source plan's own verified tag; every migration-input claim cites the
census exports.

**Load-bearing facts re-verified today `[V-I6]`:**
- `progressService.js:33-35` `getProgressDocId = ${classId}_${listId}`; create-on-miss `:103-127`
  (`setDoc` `:121`); anchor identity `twi = nwei + 1` `:148-150`; `safeCSD` non-demoting `:233-235`;
  **`safeTWI = hasValidData ? twi : Math.max(storedTWI, twi)` `:236`** (the forgery hole);
  reconciliation write `:264-271`; day-guard `:441-452`; pace-increment writer `:465-486`
  (`csd+1` `:466`, `twi += wordsIntroduced` `:467`).
- `db.js:3239-3324` `getMostRecentPassedNewTest` — list-scoped position anchor + studyDay fallback;
  discriminated status `:3244/:3313-3315`. Third twi writer: challenge-accept day-advance
  `db.js:2823-2836` — **`newWordCount = round(pace·(1−interv))` with NO `wordsRemaining` clamp** `:2829-2830`,
  `twi += newWordCount` `:2833`.
- `studyService.js:1327-1335` reviewOnlyDay predicate (confirmed-reason), `:1338-1342` clamp (+ the
  flag-OFF negative passthrough at `:1342`), `:1430` gate skip.
- `firestore.rules:32-49` — owner write on `users/{uid}` with **no field whitelist** (`:34-37` → `role`
  self-writable, C-28); wildcard `users/{uid}/{subcollection}` owner+teacher write `:45-48`; the `:39-44`
  TODO says the teacher branch exists SOLELY for `reviewChallenge`.
- `featureFlags.js`: `SERVER_ATTEMPT_WRITE=true` `:10`, `SERVER_CHALLENGE_WRITE=false` `:20`,
  `SERVER_REVIEW_MARKER=false` `:28`, `LIST_SCOPED_RECON=true` `:41`. `functions/index.js:58`
  `GRADE_TOKEN_ENFORCED = true` in HEAD (the C-32 landmine).
- **Prod posture (F-9, pinned from data):** `GRADE_TOKEN_ENFORCED:false` live (correctnessSource null 77%),
  `SERVER_ATTEMPT_WRITE:true` live (writtenBy cloud-function 96%), `LIST_SCOPED_RECON:true` live
  (853 `csd_twi_reconciled` logs; I-2's day-guard-event inference concurs). Prod is BEHIND HEAD but flag-on.

---

## §0 — Verdict: ONE migration (Claude open Q5, answered by design)

The student-owned re-key (#6/C-01) and server-authoritative twi (C-31) are **one migration, not two**.
Four independent reasons, each grounded:

1. **Same write surface.** The re-key must rewrite every writer of the progress doc; server-authoritative
   twi must move the SAME writers server-side. The complete inventory (x/plan §3a, re-verified `[V-I6]`)
   is exactly three: reconciliation (`progressService.js:264-271`), session completion (`:465-486`), and
   challenge-accept (`db.js:2823-2836`). Two migrations = touching these three call sites twice, two soak
   windows, two stale-bundle cutoffs, two rules restructures. x/plan §0 says it verbatim: "same migration
   touches the same write paths."
2. **The re-key alone WIDENS the forgery blast radius.** PLAN_list_progress_persist §10 ships on the
   client-writable footing (Option B, 2026-07-04) with the named accepted risk: "the pre-existing
   forgeability now reaches the student list-wide (single source of truth) instead of per-class." Doing
   both as one migration means that widened-exposure window **never opens**. Option B was decided
   pre-census and pre-cycling-gate; the foundation supersedes it.
3. **One cutoff, not two.** The persist plan's Phase-5 machinery (wildcard rules restructure [C5-4],
   14-day no-legacy-write window, old-bundle `legacy_write_denied` handling [C7-1/C8-1]) is the identical
   machinery the write-authority flip needs. A single rules deploy retires client progress-writes AND
   lands W3's attempts block (§1 M6) — one soak, one monitored window, one rollback story.
4. **Every downstream gate needs BOTH halves at once.** Cycling (X3) needs server-auth twi, and its lap
   math needs the single (student,list) position; the override (C-16) needs server-validated anchors AND
   a non-forgeable role; #12's whole hypothesis space (stale per-class doc) needs the re-key. Half a
   foundation unblocks nothing.

"One migration" precisely: **one program, one flag family, one data collapse, one rules restructure** —
internally phased (§4), but no phase of it ships the re-key while progress stays client-writable at the
cutoff, and no phase ships the lockdown against class-keyed docs.

---

## §1 — The ONE migration spec (components + provenance + merge points)

### 1.1 Component provenance table

| # | Component | Comes from | Adopted as | MERGE point (what changes because they are one) |
|---|---|---|---|---|
| **M1** | Re-key `users/{uid}/class_progress/{classId}_{listId}` → `users/{uid}/list_progress/{listId}` (position + §2.1 field disposition; `classId` dropped → informational `lastActiveClassId` [F3]) | persist plan §4, §2.1, §5.2, §8 | Verbatim | Hydration executor changes: §5.2's client-side 4-step transaction [C4-4] becomes the **server callable** the plan itself names as its alternative — mandatory now, because at cutoff clients cannot write `list_progress` at all |
| **M2** | Class = ACCESS + POLICY bundle only (pace, thresholds, test mode/sizes, cycling flag on `classes/{classId}.assignments[listId]`); sessions stay launch-scoped (`sessionService.js:55` unchanged) | persist plan principle + §2.3 | Verbatim | None — this is the shared model both plans assume (N1) |
| **M3** | Server-owned progress writes: the three writers (§0.1) become Cloud Functions; client writes to `list_progress`/`class_progress` denied by rules | x/plan §3g bullet 1 ("`firestore.rules` isOwner → server/Admin-SDK only") | New build: `completeSession` + `resolveListProgress` callables (§1.2) | **Supersedes persist §10 Option B** (client-writable footing). The persist plan's resolver (`resolveListProgress`, §5.2 [C6-1]) and the x-plan's write-authority demand are the same artifact — build it once, server-side |
| **M4** | Server-validated anchor: `newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced`/`studyDay` derived/validated server-side at attempt write, not client-echoed | x/plan §3g bullet 2; lockdown §3's third trust level ("server-validated-anchor" — explicitly NOT delivered by W3) | Validation added inside the ALREADY-LIVE server writer (`submitVocabAttempt`/`gradeTypedTest` writeContext — F-9: 96% of live attempts) | No new write path. The lockdown plan's "anchors are client-echoed (v2 §11.3)" residual closes HERE, not in W3 |
| **M5** | Server-derived `reviewOnlyDay` at completion (X1) | PLAN_review_only §4 (the "W3 HARD DEPENDENCY / sequencing rule") | Inside the `completeSession` callable: server recomputes allocation from ITS OWN state (recentSessions, twi, pace) and derives reviewOnlyDay + `wordsIntroduced = max(0, …)` | X1 becomes satisfied **by construction**: the same deploy that denies client progress writes is the one where completion already flows through the server derivation. The client predicate (`studyService.js:1327-1335`) demotes to UX-only |
| **M6** | W1/W2/W3 attempts lockdown | PLAN_attempt_write_lockdown + W3 staged rules doc | W1 (`submitChallenge` callable) verbatim; **W2 (`markReviewComplete`) UPGRADED**: the server marker must stamp the day's anchor range (`newWordStartIndex`/`EndIndex`) + a PARSEABLE testId — I-2 S7/C-14/C-34's fix; W3 rules ship **in the same rules deploy** as M3's wildcard restructure | Two deltas to the staged W3 doc: (a) one rules deploy, not two; (b) **owner attempt-delete is REMOVED** (W3 doc line 41-42 says "unchanged") — legal only because M7 ships server reset in the same program (persist §5.3 [C5-5]: "the two changes must ship together"). Client-delete reset is also the anchor-erasure half of the x/plan §3g forgery (delete attempts → `hasValidData=false` → `safeTWI=max(forged storedTWI, …)` `progressService.js:236`) |
| **M7** | Reset = server-side epoch | Codex issue-3 / C-08; persist §5.3 (+ its residual race [C3-3b]); the grading rework's `resetProgress` primitive, pulled forward | `resetProgress(listId)` callable: list-wide wipe per persist §5.3 (attempts first, all classes; all `session_states/*_{listId}`; legacy docs) + stamps `resetEpoch`/`resetAt` on `list_progress`; anchor queries exclude pre-epoch attempts | Under M3 the client CANNOT zero the doc, so reset MUST move server-side anyway — the persist plan's "defer to grading rework" dissolves; the epoch tombstone closes [C3-3b] (in-flight grading job post-reset) by construction |
| **M8** | Role-trust minimum: owner writes to `users/{uid}` may not touch `role` (field whitelist on `firestore.rules:34-37`) | C-28 (#1b); INVESTIGATION_PLAN I-7's "C-28 decision" | Minimal diff-based whitelist (`!affectedKeys().hasAny(['role'])`) as a **precondition of the rules cutoff** | Without it, `isTeacher()` (doc-role) is self-grantable and the surviving teacher branch (`rules:45-48`, kept for `reviewChallenge`) is a bypass of the entire lockdown. The FULL role decision (custom claim vs whitelist) stays with I-7; the foundation ships only this minimum |

### 1.2 The server surface (what M3/M5/M7 concretely are)

1. **`completeSession({classId, listId, sessionToken/context})`** — replaces client
   `recordSessionCompletion`→`updateClassProgress` for the durable write. In ONE Admin-SDK transaction:
   read `list_progress`, assert the day-guard (`expectedDay = csd+1` — the `progressService.js:441-452`
   semantics, now atomic instead of read-then-write), recompute allocation server-side → derive
   `reviewOnlyDay` (M5) and `wordsIntroduced = max(0, serverNewWordCount)`, append the session summary to
   `recentSessions` (null new-word fields on review-only per PLAN_review_only §3), `csd+1`,
   `twi += wordsIntroduced`, streak/stats. On a review-only-with-no-review-attempt day it also writes the
   W2 marker (M6-upgraded: anchor range + parseable testId) so the day is pairable + gradebook-visible.
   Rejection returns the day-guard signal (existing `day_guard_rejected_session_cleared` flow, with uid).
2. **`resolveListProgress(listId)`** — the persist plan §5.2 resolver, server-side: canonical →
   hydrate-on-miss (unified §8 merge over ALL legacy docs incl. dropped classes) → quarantine
   (`{mode:'quarantined'}` blocks study, `list_progress_quarantined` log) → create-fresh only when no
   legacy doc exists. Runs reconciliation (anchor per `db.js:3239-3324` semantics, unchanged rules) and
   writes the reconciled values — the client's `getOrCreateClassProgress` becomes a thin call. Client
   READ paths (Dashboard, gradebook) keep pure reads + in-memory merge, writing nothing (persist §5.2
   read contract) — and Dashboard panel C should consume this reconciled read, which also retires the
   `impossible_phase_detected` Dashboard-emitter noise (I-2 §2).
3. **`resetProgress(listId)`** — M7 above.
4. **Anchor validation in `submitVocabAttempt`/`gradeTypedTest`** (M4): server reads `list_progress` +
   the launching assignment; asserts `newWordStartIndex === serverTwi`,
   `newWordEndIndex === nwsi + introducedCount − 1`, `introducedCount ≤ server allocation` (clamped to
   `wordsRemaining`; lap-aware later under cycling), `studyDay === serverCsd + 1`. Mismatch →
   clamp-or-reject + `anchor_rejected` system_log. **Ships in SHADOW (log-only) first** — measure the
   false-reject rate against live traffic before enforcing (the G1 lesson: never arm a rejection path
   without measuring what it would have rejected).
5. **W1 `submitChallenge`** per the lockdown plan (token parity ported exactly, `db.js:179-185` formula).

What is deliberately NOT in the foundation: `reviewChallenge`→server + teacher-branch narrowing (I-7/D2 —
the `rules:45-48` teacher write survives the cutoff FOR TEACHERS ONLY, bounded by M8), MCQ correctness
authority (Phase E), grader calibration (I-4), read surfaces (I-8), Phase-2 UX, token policy (I-7),
list-linking C-12 (continuation design rides the cycling phase). Interim residual, named: the challenge
day-advance third writer (`db.js:2823-2836`) stays client-side-teacher-gated until I-7; it is pace-bounded,
teacher-initiated, and M8 prevents students reaching it — but see §3 row 8 for its two defects, which I-7
must fix on migration.

---

## §2 — Migration rule for the live data (the 98 dual-enroll students + everyone else)

### 2.1 The conflict rule (persist §8, adopted verbatim — restated for the census populations)

Per (student, list), collapse every `class_progress/{*}_{listId}` doc (INCLUDING dropped classes) into one
`list_progress/{listId}`:
- **TWI = anchor-validated max** `totalWordsIntroduced` across sources — validated against the student+list
  anchor (`max passed-new newWordEndIndex + 1`, the same rule the live recon uses, `db.js:3250-3298`).
  Anchorless/forged highs quarantine, never zero, never auto-promote.
- **CSD = max PLAUSIBLE `currentStudyDay` across EVERY source doc** [C4-1] — NOT the max-twi winner's —
  screened by [C4-2] **with the §7.1 amendment below** (post-anchor review evidence counts).
- Ancillary (`interventionLevel`, `recentSessions`, `stats`, `streakDays`) from the max-twi winner
  (tie-break: max twi → max csd → newest `lastSessionAt`); `programStartDate = min()`; drop
  `progressSnapshot`/blindSpot; stamp `migratedAt` into each collapsed legacy doc (idempotency);
  back up every source doc.

### 2.2 Applied to the census populations (`scan_F3_dualenroll.json`, 141 student-lists / 98 students)

| Population (F-3) | Count | What the rule does | Verification expectation |
|---|---|---|---|
| **LIVE-STRAND** (active doc ≥1 day behind own cross-class anchor) | **36** | TWI jumps to the anchor position (e.g. Final-B twi200 → the 1520 anchor from Adv B1); CSD = max plausible across both docs. This IS the manual carry-forward, automated — the exact fix these students are waiting for | Post-migration F-3 re-scan: LIVE-STRAND = 0. Product note: these students see a forward position/day jump on migration day — comms line + in-flight `session_states` dropped/rebuilt (persist §7.5) |
| **Divergent-active** (both docs active, cross-pace) | **6** | The [C4-1] case exactly: pace-fast doc wins twi, pace-slow doc's higher session count survives via max-plausible CSD — no session history lost | csd never decreases for either lineage; twi = the anchor max |
| **Stale-2nd-enroll** (behind anchor, student active in the anchor doc) | **72** | Anchor doc supplies twi + ancillary; stale doc participates only in max-plausible CSD; the latent re-strand path (student switches back → old doc) becomes unrepresentable | Latent population → 0 by construction |
| Benign-equal / benign-finished | 22 / 5 | Trivial collapse | No-op diffs in the dry run |
| Everyone else (single-doc) | ~633 started | 1:1 re-key, values carried verbatim | Byte-diff except path + dropped fields |

Recurrence note: the census proved the condition RECURS after manual drops (이주헌 OCzwBwAb re-split after
his 06-30 consolidation). The migration is the LAST consolidation because after it there is no second doc
to re-split — that is the difference between this and CS patching (25/45 P-students already re-stuck, F-4).

### 2.3 Dry-run verification plan (X5 discipline)

1. **Re-run the Phase-0-style audit FIRST** — the persist plan's Phase-0 numbers are 2026-07-04-stale
   (69 collisions / 54 dual / quarantine-clean-26SM). F-3 v2 (07-13) already shows 141 dual student-lists.
   And **after the review-only deploy (§4 RO), anchor-less csd growth accelerates** (§7.1) — the audit and
   the [C4-2] screen must be re-parameterized at migration time, not inherited.
2. **Backups**: every source doc → `dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json`.
3. **`--dry` → full diff review** (per student+list: sources, winner, twi/csd before→after, quarantine
   flags) → David authorizes → `--commit` (a CS event: SUPPORT_RUNBOOK entry + change_action_log row).
4. **Sweep before/after**: `data-integrity-sweep.mjs` + `deepfix-census2.mjs` re-run. Hard assertions:
   **0 twi regressions, 0 csd regressions** for every student; dual-enroll signature = 0; invalidAnchor
   stays ≈ 0.
5. **The F-4 H/P/B partition re-run before AND after — THE program metric** (baseline 2026-07-13:
   H=541 / P=45 (21 holding + 24 failed) / B=188 of 774 started). Expectations: the 42 live carry
   students (36+6) leave B; P-students' patched values survive (manual-pass.mjs writes valid anchors →
   anchor-validated max keeps them); nobody moves H→B.
6. **25WT sandbox rehearsal** of the full script (incl. idempotent re-run + a flag-off-client
   post-migration write → catch-up merge path) before touching 26SM.
7. **Quarantine precondition** [C7-2]: 26SM quarantine set resolved to zero pre-cutoff (Phase-0 found
   26SM already clean; the 70 EXT-cohort items need David's scope decision — exclude retired cohorts or
   triage; unchanged open item, persist §6 P0).

---

## §3 — Invariant preservation under the new model (X4)

Every LIST_SCOPED_RECON invariant (I-2 §3's set), restated with its NEW enforcement point:

| # | Invariant | Today (verified) | New enforcement point | Migration-time protection |
|---|---|---|---|---|
| 1 | **TWI monotonic + anchor-authoritative** | `safeTWI` `progressService.js:236`; clamp `studyService.js:1338-1342` | (a) rules deny client twi writes (cutoff); (b) M4 validates nwsi/nwei against server twi at attempt-write; (c) `completeSession` adds server-derived `wordsIntroduced ≥ 0` transactionally. The `:236` forged-storedTWI hole and its delete-attempts trigger close together (M3 + M6 delete-removal) | TWI = anchor-validated max; never zeroed |
| 2 | **CSD non-demoting (= session count)** | `:233-235` | `completeSession` csd+1 under the transactional day-guard; server resolver keeps `max()`. The documented trade-off (forged CSD immortalized) becomes moot for students — they can't write csd; `csd_implausible` observability retained for legacy/manual rows | CSD = max PLAUSIBLE across ALL sources [C4-1] + the §7.1 screen amendment |
| 3 | **Anchor identity `twi = nwei + 1`** | `:148-150`; writers must set nwsi/nwei/wordsIntroduced/testId (CLAUDE.md CS rule; `manual-pass.mjs`) | Holds **by construction**: the server computes nwei from its own twi at write time (M4). `csd_anchor_invalid` keeps firing for legacy rows; manual-pass.mjs unchanged (Admin SDK, already anchor-valid) | Anchor validation IS the merge's twi filter |
| 4 | **Errored lookups move nothing** | `:146,173-181` (reviewLookupFailed pins CSD); discriminated statuses `db.js:3230-3244` | Same discriminated-status contract inside `resolveListProgress`; server-side gains retries but the rule is unchanged: query-error ≠ none | Migration aborts a student+list on any anchor query-error (no merge from unverified reads) |
| 5 | **Completion day-guard** | `:441-452` — read-then-write, racy | Transactional assert inside `completeSession` — closes the persist plan's deferred [C3-2] simultaneous-completion race by construction (the grading-rework primitive arrives here); `day_guard_rejected` event keeps uid | In-flight sessions dropped/rebuilt at migration (persist §7.5) |
| 6 | **Assigned-new gate intact / reviewOnlyDay never false-open** | predicate `studyService.js:1327-1335` (confirmed-reason), gate `:1430` | Server re-derives from its OWN allocation inputs (M5) — the client-trust window (sessionConfig forgery, PLAN_review_only §4) closes; X1 satisfied because M5 and the lockdown are the same cutoff. Client predicate stays as UX preview only | Review-only history protected by invariant-2's merge rule |
| 7 | **Review pairing: anchor's class + temporal lineage + exact range** | `db.js:3440-3441` (+ §5.1 pairing rules, live) | Unchanged during transition. W2-upgraded marker stamps real ranges + parseable testId → S7/C-14 markers become pairable + gradebook-visible (C-34). Post-migration the cross-doc carry problem disappears (one doc), so pairing is only a legacy-history concern | F-3b phantom rows (csd == anchorDay−1 with a mismatched-range review) are healed by max-plausible CSD, not by re-pairing |
| 8 | **TWI exactly flat on review-only days** | clamp `:1338-1342` | Server-side `max(0, …)` in `completeSession`. Delete the flag-OFF negative passthrough (`studyService.js:1342`) when the flag retires (I-2 finding 5). **Residual, named:** the third writer (`db.js:2823-2836`, challenge-accept) adds UNCLAMPED `pace·(1−interv)` — no `wordsRemaining` clamp `[V-I6]` — and x/plan §3g flags the review-pass `nwei:null → twi=1` hazard. Teacher-gated + M8-bounded interim; **I-7's reviewChallenge migration MUST add the clamp + gate twi derivation to `phase==='new'`** | Migration doesn't touch it (it's a runtime writer) |

---

## §4 — Task-2 MASTER SEQUENCING (the spec Task 2 plans against)

Deploy-state premises (F-9, pinned): prod = `{GRADE_TOKEN_ENFORCED:false, SERVER_ATTEMPT_WRITE:true,
LIST_SCOPED_RECON:true}`, running a pre-#9/#10/#11-fix bundle behind HEAD; HEAD's `functions/index.js:58`
is `true` → **any functions deploy re-arms the 06-29 outage until I-5's fix lands**. Ordering constraints
honored: X1 (M5 before the class_progress lockdown — enforced at FND-4's precondition), X2 (the RO deploy
is David's call; this spec makes it safe, not urgent), X3 (cycling after the foundation), X4 (§3),
X5 (H/P/B re-run around every write).

Hard-gate graph (calendar can overlap; gates cannot):
`FND-0 → {RO, FND-1} · FND-1 → FND-2 → FND-3 → FND-4 → FND-5 · FND-4 → CYC · {FND-4, I-7 role decision} → OVR`

| Phase | Ships | Acceptance | Reversibility |
|---|---|---|---|
| **FND-0 · Deploy-safety substrate** (= I-5's deliverable; C-32/C-36) | Disarm G1 (`GRADE_TOKEN_ENFORCED=false` in HEAD **or** the nonce/docId binding fix, per I-5); stamp-build + `exports.version` deployed AND consulted; the flag-assertion table (every deploy states intended flag values; post-deploy `version.sha == git HEAD`) | Version endpoint answers; flag table green; no functions deploy without it | Trivial (ops-only) |
| **RO · Phase-1 review-only deploy** (#11; C-09/C-10; the built, uncommitted fix) — trigger: David (X2) | Client bundle only (studyService/DailySessionFlow/Dashboard). Pre-step: CS sweep learns the `reviewOnlyDay` marker (C-38) WITH the deploy. Needs only FND-0 (hosting deploy; assert no functions ride along) | The 183-wall students complete review-only days (F-4 re-run: the #11-wall chunk of B=188 → H); `reviewNoNewPass` noise behaves as predicted; plan §8 tests 1-8 in sandbox first | Redeploy prior bundle; data written meanwhile stays valid (legitimate csd advances) |
| **FND-1 · Additive server surface** (behind server flags; FIRST functions deploy → FND-0 gate applies hard) | `completeSession` (M3+M5, transactional guard), `resolveListProgress` (M2-resolver), `resetProgress` (M7), W1 `submitChallenge`, W2 `markReviewComplete` (upgraded: anchor range + parseable testId), M4 anchor validation in SHADOW (log-only `anchor_rejected`) | 25WT sandbox E2E (incl. day-guard rebuild, review-only server derivation diff-checked against the client predicate on live-shaped fixtures); shadow false-reject rate ≈ 0 over ≥14d live traffic | Server flags off → clients on legacy paths; nothing client-visible yet |
| **FND-2 · Client cutover build** | Writes route to callables (`SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER` → true; new `SERVER_PROGRESS_WRITE`; `LIST_PROGRESS_PERSIST` reads via resolver). Old bundles remain legal (rules unchanged during soak). The persist plan's `permission-denied` completion handler + `legacy_write_denied` event ship HERE (activates at cutoff, [C6-2]) | Bundle grep: zero direct progress writes on the new path (persist §6 P2 acceptance-gate regexes); persist §9 validation personas (move / dual-enroll / reset / hydration / quarantine / stale-session) | Flags off + rebuild (callables keep working idle) |
| **FND-3 · Data migration** (§2; one-time, David-authorized CS event) | Fresh Phase-0-style audit → dry-run → diff → commit; backups; idempotent re-run proof | §2.3 items 4-5: 0 twi/csd regressions; F-3 re-scan LIVE-STRAND/divergent = 0; H/P/B re-run | Backups + legacy docs retained until FND-5; re-runnable (migratedAt stamps) |
| **FND-4 · THE cutoff — one rules deploy** | (a) users wildcard restructured [C5-4]: OWNER writes exclude `list_progress` + `class_progress` (teacher branch survives for `reviewChallenge`, bounded by M8); (b) M8 role-field whitelist on `users/{uid}`; (c) W3 attempts block: `create:false`, student answers-update branch removed, **owner delete removed** (with M7 live — supersedes the staged W3 doc's "delete unchanged"); (d) M4 shadow → ENFORCE | Preconditions (ALL): W3 doc checklist; **M5 live + validated (X1)**; 14-day no-legacy-write window + build-version census [C8-1]; bundle greps clean; 26SM quarantine = 0 [C7-2]; shadow-validate clean. Post: rules-test matrix (forged create/update/progress-write/role-write all DENIED; happy paths + teacher reviewChallenge pass); `legacy_write_denied` ≈ 0 (accepted dormant-tab residual per [C8-1]) | Restore prior rules blocks (fast, per W3 doc) — full reversibility ONLY until FND-5 deletes legacy docs |
| **FND-5 · Retire legacy** (≥14d after FND-4) | Catch-up merge (ancillary deltas, transactional [C4-3]) → delete `class_progress` docs → delete dead client writers (`db.js:1158/:1276` legacy submits, client automarker `DailySessionFlow.jsx:964-1008`), the flag-OFF negative passthrough (`studyService.js:1342`), and the dead branch `DailySessionFlow.jsx:800-816` (I-2 finding 4) | Grep + LEGACY invariant tests removed with the flags; sweep clean | None for deleted docs (backups only) — hence the wait |
| **CYC · Cycling capstone** (C-11; x/plan v5) — HARD GATE: FND-4 live | Cap removal + `resolveVirtualRange` + lap display + `cyclingEnabled` per-assignment flag, per x/plan §4; M4's validation goes lap-aware | x/plan §6 + PLAN_review_only §7 recon re-verify (review-only × laps); F-12 population studying laps; sweep with lap-aware expectations | Flag off → mid-lap students re-dead-end at boundary, no corruption (x/plan §6) |
| **OVR · Override + challenge redesign** (C-15/C-16/C-18/C-19; I-7) — gates: FND-4 + the C-28 full role decision | Teacher override callable (mirrors manual-pass anchor validity — now a server primitive); `reviewChallenge`→server (+ the §3-row-8 clamp/phase gate); teacher-branch + `rules:45-48` narrowing; token-policy matrix for David | Every CS manual-pass class of event has an in-product path; F-6 permafail population → 0 | Callable behind flag; rules narrowing last |

The eight-phase order in one line: **FND-0 → RO → FND-1 → FND-2 → FND-3 → FND-4 → FND-5 → CYC → OVR**
(RO may slide anywhere after FND-0 at David's discretion — it has no dependency on FND-1+; everything
after FND-0 that touches functions/rules is sequential).

---

## §5 — What the foundation dissolves (the leverage argument)

| Issue | How it dissolves | Empirical stake (census) |
|---|---|---|
| **CR-1 wholesale** — C-01 (#6 class-keyed reset), C-02 (#12 carry-miss), C-03 (Kaila phantom), C-04 (#9), C-06 (dual docs), C-05 (semantics) | One (student,list) record: there is no second doc to fork, diverge, reset to, or fail to carry to. #12's UNPINNED mechanism (I-1) is mitigated the way INVESTIGATION_PLAN gate 4 anticipates — the entire hypothesis space (stale per-class doc + first-load fallthrough) becomes **unrepresentable**; the interim first-entry guard remains I-1's stopgap only until FND-3 | 141 dual student-lists / 98 students; **36 LIVE-STRAND re-doing words right now + 6 divergent**; 72 latent; recurrence proven (이주헌) |
| **C-11 cycling unblocked** (X3) | x/plan §0/§3g's HARD GATE ("cycling MUST stay flag-off until server-authoritative twi") is exactly FND-4 | 183-wall population becomes the continuation population the moment RO deploys (C-13/F-12) |
| **C-16 override secured** | The override callable inherits server-validated anchors (M4) + non-self-grantable role (M8) — "mirror the CS script's valid-anchor write" becomes a server primitive instead of a hand-run script | 45 hand-patched students (P), 24 already re-stuck — the patch treadmill the override + foundation retire |
| **C-14/C-34 (automarker unpairable + invisible)** | W2-upgraded marker stamps anchor range + parseable testId (I-2 S7 delta) | S7 reachability per F-8 |
| **C-29 (#1c) + direct forge** | W1/W3 (M6) — including the delete-vector (reset) closed with M7 | — |
| **C-31 itself + the `safeTWI` hole** | `progressService.js:236` can no longer be fed a forged storedTWI (rules) nor a stripped anchor set (delete removed) | — |
| **C-08 (reset no-op) + [C3-3b]** | Reset-as-epoch (M7), list-wide, race-closed | — |
| **C-25 adjacent** | `completeSession` persists the authoritative pass flag server-side (fold the tracked `newWordsTestPassed` derivation fix into its implementation) | F-4b family |
| **I-2 §2's `impossible_phase` noise** | Dashboard consumes the reconciled resolver read; P1 (CS-drop deleted docs) becomes impossible — no doc deletion in a consolidation that no longer happens | 531 real states, T/P split pending §2.4 pin-check |

The empirical clincher (CONSOLIDATED §0): the data is NOT corrupt — the failures are structural, and
patching outputs demonstrably does not hold (24/45 P-failed). The foundation is the only item on the board
that changes the MODEL those failures come from; ~30% of started students (B=188 + P=45 of 774) is its
addressable population, and every subsequent phase (RO durability, cycling, override) lands ON it.

---

## §6 — Open decisions for David (nothing else blocks planning)

1. **RO deploy timing** (X2 — his standing call; FND-0 makes it safe whenever).
2. **EXT-cohort quarantine scope** (70 legacy items: triage vs exclude retired cohorts — persist §6 P0).
3. **Migration-day comms** for the 36 LIVE-STRAND (they jump forward; a one-line "your progress was
   reconnected" notice vs silent).
4. **Full role mechanism** (custom claim vs whitelist-forever) — I-7's decision; M8 is compatible with both.
5. **FND-3/FND-4 write authorizations** — each is a SUPPORT_RUNBOOK CS event per standing rules.

## §7 — New findings out of this synthesis (beyond the merged plans)

1. **⚠️ INVARIANT AT RISK — the [C4-2] CSD plausibility screen vs review-only days.** Review-only
   completions advance csd with NO anchor (I-2 §1.2 last row: structurally invisible to attempt-anchored
   recon). **The moment RO deploys, 183+ students start legitimately accruing csd − anchorDay gaps that
   grow daily** (a student at the wall for 3 weeks → csd ≈ anchorDay + 15). [C4-2] as written ("any source
   CSD wildly exceeding its own doc's anchor-derived day + slack is EXCLUDED and flagged") would exclude —
   i.e. quarantine-flag — exactly the students RO just unfroze, and a naive anchor-recomputed CSD at
   migration would DEMOTE them. **Amendment required in the migration script:** the plausibility screen
   must count post-anchor evidence — review attempts with `studyDay > anchorDay` (they exist for every
   review-only completion) and `reviewOnlyDay:true` session markers — as legitimizing the gap; only a gap
   exceeding (anchor-day + evidenced review days + slack) is implausible. Corollary: **the persist plan's
   Phase-0 numbers and screen parameters are stale — re-run at FND-3 time** (§2.3 item 1).
2. **The challenge-accept twi writer is unclamped** (`db.js:2829-2833` `[V-I6]`: `round(pace·(1−interv))`
   added to twi with no `wordsRemaining` clamp) on top of x/plan's known review-pass `nwei:null` hazard —
   two concrete defects for I-7's reviewChallenge migration to close (§3 row 8). Interim exposure:
   teacher-gated, pace-bounded, M8-bounded.
3. **W3's "delete — unchanged" line is superseded** by the one-migration design: owner attempt-delete is
   removable at FND-4 because server reset (M7) ships in the same program — closing the anchor-erasure
   half of the §3g forgery that W3 alone left open. The staged W3 doc should be revised when Task 2 adopts
   this spec.
4. **X1 stops being a sequencing hazard and becomes a construction property**: because M5 lives inside the
   only completion writer that survives the cutoff, "server-derived reviewOnlyDay before the lockdown" is
   enforced by the dependency graph itself (FND-1 → FND-4), not by process discipline.
5. **Option B (persist §10) is formally superseded** — the re-key must not ship client-writable; the
   census-measured forgery-relevant population and the cycling gate both post-date that decision.

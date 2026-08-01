# DEEPFIX 2 — Consolidated task list (v3, 2026-07-26 — post round-2 convergence fold; v2 archived at `_archive/`)

> **The one forward program**: deepfix remainder + unified container + free-nav mode + UX/messaging, sequenced as waves.
> **v2 folded round 1** (§6); **v3 folds round 2** (§7 — Codex r42 + 5 internal). Verdict trajectory: r41 UNSOUND-as-executable
> → r42 SOUND-WITH-GAPS → expected r43 GO for Wave-0/1 staged execution.
> Legend: ✅ done · 🔄 in progress · ⛔ not started · ⚠️ one-way door · 🔵 WinClaude deploy / David authorization ·
> 🧭 David decision needed · 🔍 convergence checkpoint. Deepfix1 IDs cited as `[D4/P5]` — **original gate text governs**
> (this file is a summary layer; where thinner than a gate-bearing source, the source wins — orientation §5).
> Actions log to `MASTER_TASK_TRACKER.md` under DF2-IDs.

## 0. Program invariants (apply to every item)

- 26SM read-only; 25WT sandbox; deploys via WinClaude 🔵; **commit on `main`, never branch**; targeted `git add` only;
  a passed `new` attempt is the CSD/TWI anchor (`twi = newWordEndIndex + 1`).
- **Pin discipline:** the CERTIFIED CORE (completeSession/resolveListProgress, `foundation.js`) is pinned `0ddbb34`
  (grader `gradeTypedTest`→`0992f5f` r63 and `submitChallenge`→`6094cdd` r65 already moved surgically). Any move of the
  core = deliberate, David-authorized, clean tree, behavioral re-cert on the new pin. **A `foundation.js` edit is NEVER
  surgical.** The deploy set is derived per-change by RULE, not copied as a constant [Opus-1 C3]: **= every deployed
  function whose bundle includes a changed export, recomputed from the diff's call graph** (DF2-10's 10-callable set is the
  INSTANCE for the review-pass diff, not the template). "Atomic" means coordinated-with-verification [Codex S4]: (1) no
  lever/threshold enableable while the deploy is incomplete → (2) deploy the complete target set → (3) verify EVERY
  target's revision+behavior (`version` callable — which must itself redeploy to attest), retry/roll back any partial →
  (4) only then expose the client lever. **Rollback is itself a full-set redeploy of the rollback pin — NEVER surgical**
  [Opus-1 C2] (a surgical rollback re-creates the skew). Plus fail-closed flag-posture probe + `ANCHOR_VALIDATION_SHADOW`/
  M4-clock continuity assertion. Off-peak + pre/post live scans (`data-integrity-sweep` + `system_logs`) for every deploy
  touching completeSession or rules (DF2-10/43/44/45/46).
- **Byte-identity falsifier + the TOTAL delta mechanism** [Fable-2 H2/H3]: forced-mode behavior provably unchanged
  (differential fixtures) except via a **named per-wave approved-delta list — every visible ship must be enrolled**:
  **Wave-0 list** = DF2-01 (hide set) + DF2-07 (a-e); **Wave-3 list** = messaging rows, one-affordance Dashboard,
  chrome/derived copy, + DF2-36 (G-QUAR screen); standing exceptions that ship on their own gates under EITHER DECIDE-0
  option = DF2-01, DF2-07, DF2-36 (pre-P5 hard gate), CONT-A, DF2-35.
- **One G-PASS predicate — transitional** [Codex N2]: canonical module AUTHORED at DF2-08 (no live reroute, no deploy);
  authoritative writer/readers ADOPT at DF2-10 (the first call-site adoption + deploy); consolidation COMPLETE at DF2-46
  (remaining twins retire). Every NEW consumer (review gate, SegmentTest, challenge/regrade) uses the module incl. the
  **server-read authoritative `passed:true` short-circuit — provenance-typed, never client-supplied** [Codex N4].
- Rules: named artifacts only; never bare-deploy; never the repo P10d draft; **no rules deploy after R3** (R3 = D8g's
  final rules artifact per MASTER D8 — glossed here because two other R-namespaces exist: D3.5's R1-R16, Opus-A's R-A..L).

## Wave 0 — Ready now (mostly parallel) 🔍 at wave end

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-01 ⛔ | **BlindSpot hide** — `BLINDSPOTS_UI=false`: Dashboard link (:2172), route (App:91→redirect), HelpModal copy (:250); help-site pages + **TA_FAQ/TA_SUPPORT_GUIDE blind-spot mentions** ride the same release | Spec §11.1; code + 21-day data model KEPT (G-DUE seed) | hosting 🔵 |
| DF2-02a ⛔ | **Safe dead-code deletions** — SessionSteps, SessionProgressBanner, BlindSpotsCard, MasteryBars, MasterySquares import, StudySelectionModal, **the dead 7-export sessionService transition API incl. `recordNewWordsTestResult` (sessionService.js:268, dead G-PASS copy)**; 🧭 dead levers `reviewTestSizeMin/Max`: wire or remove (+ `assignment.testSizeReview` ghost-read) | MAP §13 + [E2] deletion leg | hosting 🔵 |
| DF2-0H ⛔ | **Deepfix1 housekeeping** (MASTER §4.3 a-d, now owned): (a) rotate RESUME.md → deepfix2; (b) `git add --renormalize .` commit of the evidence pile (never `-A`); (c) SUPPORT_RUNBOOK cites for the 07-18 26SM scans; (d) cite sources for B2/B4 closures + PR-1's 2-account anecdote; + D3.5 report/FINDINGS honest reconciliation (with DF2-05) | Fable-2 L7 | docs |
| DF2-03 ⛔ | **Full state enumeration** (`03_STATE_ENUMERATION.md`) — §8 tiers 0-3 + A1-A5 + exit statuses + `carriedFrom` + free-mode fields + event-seen markers + **`resetEpoch` tombstone** (§11.3). **PRE-CODING GATE for Waves 2+** | — | doc |
| DF2-04 ⛔ | **Golden/differential fixture harness** — initializeDailySession outputs across flag matrix + the 9 scenario fixtures + PDF/debug callers (A4); full-config compare; **PLUS: review-gate OFF-path with legacy `passed:undefined` AND new `passed:true` reviews byte-identical (Opus-A R-C) · grandfather-epoch × review-gate precedence (R-K) · `validateAttemptAnchorShadow` dependency-closure identity across pin-moves (M4-clock protection)** | accepted only after DF2-03 freezes the inventory | test infra |
| DF2-05 🔄 | **D3.5 risk remediation** (R1-R16, `D3.5_RISK_REMEDIATION.md` **v2 numbering**) — **Wave-4 HARD ENTRY GATES corrected [Codex N1]: R1 (anchor-minting — audit→likely code fix, implementation owner named at closure) + R2-class inflation confidence ONLY.** R7 (next-list carry) is CONT-A/[D6] ownership, NOT a P5 gate. R8 (verdict-engine needs a **functions-side `session_completed`/`day_advanced` success stamp**) → the stamp ships INSIDE DF2-10's already-authorized core pin-move; tooling hardens here afterward | scripts/sandbox + DF2-10 |
| DF2-06 🧭 | **Grader prompt fix round 2** (verbatim-English family) + regression extension; surgical `--only functions:gradeTypedTest`. **Interleave rule: must deploy BEFORE DF2-10's server commit or inside DF2-10's set** (shared `writeAttemptTxn`). Confirm verbatim-vs-paraphrase grading intent with David at go | Fable-B corr.8 | functions 🔵 |
| DF2-07 ⛔ | **QUICK-WIN messaging on EXISTING screens** (Opus-B; no container dependency; a NAMED Wave-0 delta): **(a)** threshold copy derives from real `passThreshold` — the sole hardcode is SessionProgressSheet.jsx:82, threaded from its 4 render sites (which already hold `retakeThreshold`); results wall already derives (RetakePrompt:2383) — verify-only [Opus-2]; **(b)** review-only reason banner — **honestly NET-NEW minimal UI** [Opus-2], bound to the entry-returned **`reviewOnlyReasons` object under server precedence `listComplete > reviewStudyResume > allocationZero`** (foundation.js:1459-1461; client already reads it, studyService.js:1783) — NEVER the coarse `reviewOnlyDay` flag; throttle copy ("avg of last 3 reviews **above 50%** — strict, never 30%") renders ONLY for `allocationZero`; **build the reason-derivation ONCE, shared with DF2-32's later re-home**; **per-reason 25WT fixture oracle is the 26SM SHIP GATE** [Opus-1 C1, Codex N9]; **(c)** list-end message targets the MID-SESSION review-only/retake-wall surfaces only (the Complete-phase terminal already exists, DSF:2450) and conditions on `nextListId` absence (B4 auto-advance; coordinate with CONT-A) [Opus-2, Fable-2 M7]; **(d)** token copy — student surfaces already say Monday (verify-only); where touched, use TZ-honest copy ("weekly, Monday 4 AM Korea time" or the viewer-local instant — bare "every Monday" is FALSE for 미주) [Codex N8]; `06_MESSAGING_COPY.md` SUPERSEDES §12.3's draft strings [Fable-2 M5]; **(e)** 30→50 reconciliation same-release across **TA_FAQ + TA guide + `public/help-student-{en,ko}.html` (en:1007 / ko:998 — the highest-harm surface)** [Opus-2 MUST-FIX] | | hosting + docs 🔵 |
| DF2-42d ⛔ | **G-DUE scheduler DESIGN** (`04_SCHEDULER_DESIGN.md`) — pulled forward (NO canonical dependency — the 21-day `study_states` lifecycle is untouched by P5). Acceptance = full lifecycle: due calc, selection, answer/engagement recording (**closes the G-ENGAGED-in-free 🧭**), mastery/graduation/return, TZ/clock injection, idempotency, server-vs-client authority, rules permissions. 🔍 own design convergence; **mode-interaction sections PROVISIONAL until DF2-47's 🔍 — final acceptance includes a post-DF2-47 compatibility recheck before DF2-42 build** [Codex N12, Fable-2 M1] | Fable-B corr.7 · Codex F5/F6 | doc |
| **DESIGN TRACK** ⛔ | **DF2-47 (`08_MODE_RECORD_CONTRACT.md`) + DF2-43's `09_FRONTIER_WRITER_SPEC.md` AUTHORING start HERE, in parallel** [Fable-2 M1] — they are pure design docs; Wave-4's entry gates (migration protections) apply to state-touching execution, not to authoring. DF2-03's free-mode-fields section + DF2-42d's mode sections stay PROVISIONAL until DF2-47's 🔍; **DF2-04's freeze covers FORCED-mode fields only** (free fields freeze post-47) | — | docs |

## Wave 1 — Policy module + review-pass gate [§8-G6: BEFORE any extraction] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-08 ⛔ | **THE policy module: one G-PASS predicate + assignment-policy resolver** (absorbs [E3], gate-override vs its old "(after D5)" APPROVED here [Fable-2 M6]) — **BOUNDARY [Codex N2]: DF2-08 AUTHORS + equality-tests the pure module/generated copy ONLY; NO live call-site reroute, NO functions deploy — adoption is DF2-10's; the functions-side copy deploys ONLY inside DF2-10's set** [Opus-1 C4]; gated on DF2-04 green. Contract: units (0-1 vs 0-100), threshold source/fallback, test type + navigationMode, **provenance-typed `authoritativePassed`** (server-read persisted attempt / authorized override-regrade ONLY — client input never short-circuits; `submitVocabAttempt` still computes the initial verdict itself) [Codex N4], challenge/regrade/override behavior. **Default-drift normalization (80/20, 95/92/0.95) is NOT byte-identical [Codex N3] → split**: (i) inventory every caller+fallback, (ii) **verdict-flip census** on records with missing/legacy fields, (iii) 🧭 David target-default decision, (iv) compat adapters preserved until that approved migration, (v) legacy/null/orphan shape tests in both runtimes — NEVER smuggled into DF2-10's default-OFF release | Codex R2/R6/N2/N3/N4 | modules (no deploy) |
| DF2-10 ⛔ | **Review-pass gate build** per `D3.5_WORKITEM_review_pass_threshold.md` — pass-1 core (`reviewPassThreshold` per-class default-OFF + **global kill switch**; separate `review_retake_required` gate, NOT fpHoldCsd; **exemptions = list-end + the NO-SCORE case; #9-resume NOT exempt**) + pass-2 reader-correctness (studyService:312, getReviewForDay, foundation :1638, challenge path — ALL gated on `passed===true`, byte-equivalent when OFF) + retake UX (resolves the 🧭 retake-surface decision → unblocks DF2-02b). **DEVIATION NOTE from workitem §5 [Fable-2 H4, approved via Codex r41-R2/r42-N2]:** pass expressions land in the DF2-08 MODULE, not inline at index.js:434/foundation.js:2614 (behavioral spec/exemptions/§11 invariant unchanged); the workitem's RetakePrompt-mirror row is STALE per MAP §13 (dead branch) — retake UX lands on the live test-page/results surface. **ALSO RIDES THIS PIN-MOVE:** the R8 `session_completed`/`day_advanced` server success stamp [Codex N1] + **explicit `holdReason`/`throttleReviewOnly`/`engaged` fields on the completeSession RESPONSE** (txn already computes them, :1486-1491; response-only compat certified) [Codex N6 — supersedes any client inference]. **DEPLOY (first CORE pin-move):** coordinated-with-verification set (§0 rule) = **10 callables**: `submitVocabAttempt, gradeTypedTest, completeSession, resolveListProgress, advanceForChallenge, reviewChallenge, overrideAttempt, markReviewComplete` (automarker must not mint completion evidence for a failed review) **+ `resetProgress` (foundation re-export) + `version` (must attest the new commit)** [Codex S4, Fable-2 H5]; functions BEFORE client; skew check + posture probe + shadow continuity; **extended behavioral cert at CURRENT prod posture**: review-fail→`review_retake_required` no csd/twi/recentSessions pollution · review-pass→advance · OFF byte-identical incl. legacy `passed:undefined` · challenge-crossing · grandfather precedence · idempotent retry · typed+MCQ · **kill-switch/threshold-removal rollback states ×3 (durable `passed:false` review then OFF/removed/re-enabled — decide + fixture the amnesty semantics)** [Codex N5]; **soak = 7 days, abort signal = any `review_retake_required` misfire ∨ `dayGuardRejected` spike ∨ `csd_anchor_invalid` in `system_logs`, rollback pin = `0ddbb34` FULL-SET redeploy** [Opus-1 C2]; off-peak + pre/post scans. 🧭 throttle-day gate (recommended NO — see §4.2) | Opus-A R-A/B/C · Codex S4/N1/N5/N6 | functions+hosting 🔵⚠️ |
| DF2-11 ⛔ | **`reviewPassThreshold` teacher lever UI** — AssignListModal + ClassDetail + validation; **ships DARK/disabled until DF2-10 atomicity + cert proven** | Opus-A R-A(2) | hosting 🔵 |
| DF2-02b ⛔ | **RetakePrompt + REVIEW_TEST phase deletion** (moved from Wave 0 [Fable-2 M2]) — per spec (branch DSF:1952-1969 + def :2367; KEEP the live localStorage marker vocab); executes AFTER DF2-10 settles the retake surface; re-verified at this wave's 🔍 | Codex S5 | hosting 🔵 |
| DF2-35 ⛔ | **Teacher hold-visibility panel** (moved from Wave 3 [Opus-2] — no container dependency; a standing delta-list exception): ClassDetail list of currently-held students + reason (review-only / list-end / below-gate [post-DF2-10] / quarantined), sharing DF2-07(b)'s reason-derivation; + a **who-passed/frontier-advanced column** spec'd for DF2-53's follow-through | Opus-B decision 6 | hosting 🔵 |

## Wave 2 — Unification increment 1 (byte-identical; DARK) [gates: DF2-03+04 done, DF2-10 certified] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-20 ⛔ | **Client-only `initializeDailySession` core extraction** → `deriveSessionState` (entry) — constraints C1/C2/G4 (ordered assembly, double-call preserved)/G5/G7/A2/A3; anomalies returned (G3); `navigationMode` constant `'forced'`; differential CI green (flag matrix + both record shapes). Exit channel = DF2-31 (G0 owned there) | §8/§9 verbatim | hosting 🔵 (no visible change) |

## Wave 3 — Container + exit channel + messaging (BUILD + VALIDATE; production visibility per DECIDE-0) 🔍

> **Ship-model resolution (C1/C2):** this wave BUILDS and validates on 25WT + preview. What reaches production, when, is
> 🧭 **DECIDE-0**: (a) *incremental line* — Wave-3 deltas go live per approved-delta list after DF2-34 (Fable-C position;
> §8/§9 shippable-increment doctrine; earlier CS relief), or (b) *strict single-train* — container stays dark behind an
> activation gate until DF2-60 (Codex position; matches "ship together" literally). Approved-delta list either way:
> messaging rows, one-affordance Dashboard, chrome/derived copy — each a NAMED exception to byte-identity (§0).

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-30 ⛔ | **One `<SessionStage>`** — enum fold, sub-views, collapse per MAP §15 **referencing the FULL MAP §3 chrome+modal inventory** (SessionMenu, Watermark, card-settings, drawer, Complete variants — nothing dropped untracked); chrome mode-aware + threshold-derived copy; `session_state.phase` DEMOTED; unify the inconsistent test-error exits (MCQ returnPath vs Typed navigate(−1), MAP §14.7); absorbs [E1]/[E2-machine] | | hosting 🔵 |
| DF2-31 ⛔ | **Exit channel** `deriveWriteOutcomeView` — explicit `advanced:false`+reason (A1); DSF `day_guard_rejected` gap fix. **Premise CORRECTED [Fable-2 M3]: the `review_recorded` return (foundation:1584-1590) DOES carry txn-time `reviewMode` (+progressDay) — consume it, never stale pre-submit state; what it lacks is `reviewOnlyReasons`/`engaged` — supplied by DF2-10's N6 response fields, NOT client inference** (a non-engaged review on an allocation-zero day is otherwise ambiguous — Codex N6: "do not ship copy that guesses") | Codex N6 · Fable-2 M3 | hosting 🔵 |
| DF2-32 ⛔ | **Messaging register rows 1-14** (quick-win rows re-home from DF2-07; row 15 = DF2-50) + **row 16: the forced retake-wall (`review_retake_required`) message** [C8] — row 2 copy disambiguated (throttle rolling-average ≠ per-test bar); **message ⇔ `reviewOnlyReason` 1:1 binding table + per-reason fixture ORACLE** (allocationZero copy NEVER renders for listComplete/reviewStudyResume) [Opus-A R-E]; `06_MESSAGING_COPY.md` (ko/en) reviewed first w/ Opus-B copy rules (no "frontier/segment" jargon → "next 20 words unlocked"; quarantine reframed non-disciplinary; row 3 forward-framed; TZ-honest per N8) — **and it SUPERSEDES §12.3's draft strings** [Fable-2 M5]; `carriedFrom` attribution derives from resolve `sources` (pre-authorized inference); **event rows w/ seen-markers = 4/14/15 ONLY — rows 16 (forced retake-wall) and 15's retake variant are BLOCKING STATES, re-derived visible on every load, never seen-markered** [Codex N7, Fable-2 L2] | G2 net-new UX | hosting 🔵 |
| DF2-33 ⛔ | **Dashboard one-affordance** — hero + per-list unified on the ONE derivation; two-done-authorities closed; **state whether Dashboard gets a READ-ONLY assembly variant** (the G4 ordered-write pipeline must not run writes from a dashboard render) | Fable-B claim-2 note | hosting 🔵 |
| DF2-34 ⛔ | **Validation matrix + canary** — enumerated live-routed E2E matrix: every exit status × both test types × crash-recovery restore × every modal path × dual-class; canary/staged rollout (1 class → N) w/ defined regression signal + rollback; streak weekend-skip verify | Opus-A R-D; entry fixtures are NOT sufficient for the UI swap | 25WT → staged |
| DF2-36 ⛔ | **G-QUAR minimal blocking screen on the LEGACY UI** — build, deploy, behaviorally verify **BEFORE DF2-40** (fail-closed hard gate; the container absorbs it later). "DF2-32 or minimal" is not a gate | Codex S2 | hosting 🔵 |

## Wave 4 — Substrate [execution order: 47(🔍 closes) → 41 → 40 → 46 → 42 → 43 → 44 → 45] 🔍
**Entry gates (state-touching execution only — design authoring started back in Wave 0-1 [Fable-2 M1]): DF2-05's
corrected P5-required set closed (R1 + inflation confidence; R8 stamp shipped via DF2-10; R7 is CONT-A's) · DF2-36 live ·
D3 certified + C1 live (inherited).**

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-47 ⛔ | **MODE-RECORD CONTRACT** (`08_MODE_RECORD_CONTRACT.md`) — the design gate Codex F1 blocks on: same student+list in forced class A + free class B against ONE canonical record — mode resolution (one-mode-wins-list-wide vs dual-write), per-mode field semantics (csd/reviewMode/recentSessions/day-guards), in-flight session invalidation/versioning, **flip mappings BOTH directions** (free→forced re-hydration: derive csd from twi+attempts, never read the frozen value; review-debt handling; **boundary-only flips, never mid-session** [Opus-A R-I]), transactional concurrency/idempotency for concurrent submits; **owns F2**: physical free frontier vs forced cycling virtual position/lap (no naive `min(twi,N)`; stable segment identity under pace change; attempt-range→picker mapping). 🔍 own convergence before DF2-42/43/50 | BLOCKS 42/43/50 | doc |
| DF2-41 ⛔ | **Frontier adjudication census** (`07_FRONTIER_CENSUS_PLAN.md` — 🔍 its own convergence = hard gate): 129 divergent / 27 active dispositioned via the FULL CS ritual (read-only → 25WT rehearsal → named per-student ledger → David authorization → derived/verified per-student values, never blanket max → sweep before/after) | Opus-A R-H | scripts 🔵 |
| DF2-40 ⛔⚠️ | **[D4/P5] Canonical migration + flip** — original gate text governs (MASTER D4): --catchup MED-3/4 · toolchain retarget (**DF2-40 OWNS it, pre-flip hard gate — `data-integrity-sweep.mjs`, `census-i4-pairing.mjs`, `manual-pass.mjs`**; DF2-62 = mode-awareness residuals only) · demotee ledger · 25WT rehearsal · fresh census+backup before/after · **carry `reviewMode` into canonicalDoc at hydration · apply the FIX-1 engagement gate to bestCsd** [C5] · off-peak David-authorized · **TOCTOU discipline: re-verify twi INSIDE the migration transaction + drift-diff vs pre-census that ABORTS on any change (the 27 keep studying)** [R-F] · **restore window: clean restore ONLY until the FIRST post-flip completion — named monitor owns that boundary** [R-G] · quarantine=0 acceptance · client-reader cutover per P5 plan | dual-purpose: single writer + frontier home | migration 🔵⚠️ |
| DF2-46 ⛔ | **Server unification + twin retirement** (the missing increment — Codex R1, Fable-A H1). **Shape [Codex N11]: share PURE POLICY PRIMITIVES (a named `deriveCompletionDecision` + the DF2-08 module) — the transactional writer is NOT routed through the entry-VM object**; `deriveSessionState` stays the entry VM, `deriveWriteOutcomeView` the exit renderer. Routes: forced `completeSession` policy + `getDayNewPass` + engaged-paired-review reader + challenge/override policy + **the anchor-shadow validator's policy legs (rewire, not just test-continuity)** [Fable-1 residue]; **absorbs [E1] `isDayComplete → {complete, advances}`** [Codex fold note — moved from DF2-30]; consolidate the **5-site allocation math (studyAlgorithm:107 · foundation:1151 shadow leg · foundation:1378 completeSession recompute · foundation:2211 challenge-advance · db:3061)** [Fable-2 M4 — cites re-derived]; **retire the flag-suppressed client twins** (progressService:160/570/663) + legacy client progression writers; equality-tested artifacts; full server re-cert (deploy set re-derived per §0 rule — WIDER than DF2-10's 10); 🧭 **interventionLevel float fate decided here** [M5] | after DF2-40, before 43/44 | functions 🔵⚠️ |
| DF2-42 ⛔ | **G-DUE scheduler BUILD** (design DF2-42d accepted) — per-word due engine; forced-compatible, free-primary | | functions+client 🔵 |
| DF2-43 ⛔ | **Server-owned frontier writer** — **own reviewed contract** (`09_FRONTIER_WRITER_SPEC.md`, authored back in the design track): callable name + auth/mode checks, immutable segment identity validated vs current frontier, attempt/idempotency contract, txn preconditions + concurrent submits, provenance-typed authoritative `passed:true` consumption, list-end clipping, **challenge/regrade/override/manual-pass frontier advancement** (current `overrideAttempt`/`advanceForChallenge` are day-based — NOT reusable unchanged) [F4/M3], stale-client/mode-switch rejection + explicit exit status, canonical writes + audit logs. **Gates: DF2-40 flipped + DF2-41 applied + DF2-47 closed + DF2-46 accepted/deployed + DF2-42's scheduler authority accepted to the extent the writer records scheduler-affecting outcomes** [Codex N10] | Fable-B corr.3 | functions 🔵 |
| DF2-44 ⛔⚠️ | **Rules lineage** (`05_RULES_LINEAGE.md`): **44a = [D5/P6]** with the FULL choreography restored by pointer (MASTER D5 + roadmap Track-2 row 5: `TEACHER_PROVISIONING_ENABLED` functions-redeploy FIRST → named P6 artifact (`audit/deepfix/task3/firestore.p6.rules`) + matrix + bundle-grep → rules deploy → THEN flip `ANCHOR_VALIDATION_ENFORCE` → starts P7 clocks; F1 Signup-train re-apply; 26SM quarantine=0 acceptance; **≥14d M4 shadow at ≈0 false-rejects — the criterion, not just the clock** [Fable-2 L6]) · **44b = coexistence clauses** (free-mode reads/denied writes) · **the FINAL artifact re-baselines and SUPERSEDES the P10d draft; D8g's R3 is RE-POINTED at it; HARD interlock: no R3 deploy until this lineage is final** [Fable-B corr.2, Codex R5] · D8's own server-flag flips are foundation pin-moves — the "parallel" track SERIALIZES on the deploy artifact · off-peak | rules 🔵⚠️ |
| DF2-45 ⛔⚠️ | **[D9/P7] Retirement** — ≥14d post-rules + ≥7d zero `legacy_write_denied`; apply `phase7_retirement.patch`; delete `class_progress` (backups first); off-peak | verbatim | functions+data 🔵⚠️ |

## Wave 5 — Free-nav UI (DARK behind `navigationMode:'free'`) [gates: DF2-30/31/**33** live-or-DECIDE-0-dark · DF2-47 closed · DF2-42d accepted · DF2-43 spec final] 🔍

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-50 ⛔ | **Free branch of the derivations** — frontier fields + thin exit set + SegmentTest retake wall (row 15; consumes DF2-08; wall is on the NEW-segment test only — review never gates in free mode, `reviewPassThreshold` inert for free classes [M2]) | §10.2-10.4 | hosting 🔵 (dark) |
| DF2-51 ⛔ | **NavigateHub + free UX** — day/segment picker ({re-study, re-test, review-due}), offer + nudge, always-on Review, segment map, free hero CTA order, hub edge states, mode indicator, mixed-mode Dashboard (**builds ON DF2-33**); wireframe extension first; 🧭 **re-test gradebook semantics** (default: `type:'retest'`, non-advancing, original pass = accountability score) | Opus-B decision 4 | hosting 🔵 (dark) |
| DF2-52 ⛔ | **`navigationMode` teacher lever** — dark/disabled until program enables | | hosting 🔵 |
| DF2-53 ⛔ | **Teacher monitoring BOTH modes** — held-students panel follow-through + frontier-vs-expected pacing 🧭 (metric def) + mastery/due analytics + **mixed forced+free class view** (per-class metric sets, mode badge, no cross-mode global column) | Opus-B decisions 1/5 | hosting 🔵 |
| DF2-54 ⛔ | **PDF segment-based** + **PMv2 rail ruling 🧭** — PMv2 explicitly **non-progress / non-gradebook by default** (Codex caveat 4) or it recreates the fork; shared `practiceMode` rail | | hosting 🔵 |
| DF2-55 ⛔ | **Mode-flip student explainer** — **BLOCKING acknowledge-to-continue interstitial (not a passive toast): study is gated behind one explicit acknowledgment**; bilingual, BOTH directions; **seen-marker keyed to the flip EVENT + direction (never a global has-seen bit) so re-flips re-show**; pairs with DF2-47's boundary-only flip ceremony | Opus-2 #3 | hosting 🔵 |

## Wave 6 — Train + activation 🔍 (final full-panel convergence)

| ID | Task | Notes / gates | Surface |
|---|---|---|---|
| DF2-60 ⛔ | **Release-train assembly + container ACTIVATION** (under DECIDE-0(b) this is where ALL container visibility begins; under (a) it completes the line) — **build-identity binding**: golden/differential evidence ↔ deployed client bundle ↔ server callable set+flags ↔ rules artifact ↔ pilot config, one attested identity. **Under DECIDE-0(b), DF2-34's canary re-homes HERE as container-activation staging (1 class → N) — full-cohort single-step exposure is FORBIDDEN either way** [Fable-2 H2 / Opus-A R-D] | Codex §3 | hosting 🔵 |
| DF2-61 ⛔ | **Activation ladder** — 25WT free class E2E → 🧭 pilot class → per-class enablement. **Gates: DF2-40/42/43/44 LIVE + the DF2-47 flip ceremony (boundary-only, re-hydration step) + state-loss analysis doc.** **Pilot success criteria (defined BEFORE pilot):** 4 weeks · zero integrity-sweep findings attributable to free mode · pilot-class CS tickets ≤ its own forced baseline · teacher confirms accountability (who's behind + who passed) · **≥60% of actives advance ≥1 frontier segment via a PASSED test in the window** [X filled, Opus-2] · no rollback triggered | Opus-B metrics | per-class config |
| DF2-62 ⛔ | **Docs + CS readiness residuals** — SUPPORT_RUNBOOK both-modes, help-site modes sections, CS toolchain **mode-awareness** (canonical retarget lives in DF2-40), token-diag predicate; **CS-metrics instrumentation**: baseline = **the 4 weeks immediately PRECEDING DF2-07's Wave-0 ship, reconstructed from dated SUPPORT_RUNBOOK entries — never a post-DF2-07 window** [Opus-2] → ≥60% reduction target on the quick-win classes → in-app "still confused → contact" tap for direct deflection measurement | quick-win TA updates already shipped w/ DF2-07 | 🔵 |

## Parallel deepfix1 tracks (own gates; serialize on shared artifacts)

- **[D6/P8] CONT-A** — shippable early; **ship BEFORE Wave 3 or fold INTO DF2-30** (same DSF Complete surface — don't run concurrent).
- **[D7/P9] Cycling** — post-rules; position model per DF2-47's F2 resolution.
- **[D8] P10 chain** — R3 re-pointed at the DF2-44 final artifact (hard interlock); D8a/D8e flag flips = foundation pin-moves, serialized with the wave track's deploy discipline.
- **PMv2** — David-locked plan; rail ruling at DF2-54; non-progress/non-gradebook condition binding.
- **M4 shadow clock** (ends ~2026-08-01) — gates DF2-44a; continuity asserted at every pin-move (DF2-04).
- **Grader thread** (DF2-06) — interleave rule with DF2-10.

## 3. Reconciliation table (v3 — RECONSTRUCTED IN FULL [Fable-2 H1]; the complete deepfix1 disposition record)

| Deepfix1 item | Disposition |
|---|---|
| D4/P5 migration | **ABSORBED → DF2-41 (census FIRST) + DF2-40** (hydration items, restore-window + monitor, TOCTOU verify-at-write, toolchain ownership all on the card; gates travel + v3 ADDS protections) |
| D5/P6 rules | **ABSORBED → DF2-44a** (full choreography by pointer incl. quarantine=0, ENFORCE-flip-last, P7-clock-start, ≈0-false-rejects criterion) |
| D6/P8 continuation | **PARALLEL** — shippable early (hosting-only, B4 closed); ship BEFORE Wave 3 or fold INTO DF2-30; DF2-07(c) copy conditions on `nextListId` |
| D7/P9 cycling | **PARALLEL** — post-rules acceptance; position model per DF2-47's F2 resolution |
| D8 P10 chain | **PARALLEL** — R3 re-pointed at the DF2-44 final artifact (hard interlock); D8a/D8e flag flips = foundation pin-moves, serialized on the deploy artifact per §0 rule |
| D9/P7 retire | **ABSORBED → DF2-45** (verbatim: both clocks, `phase7_retirement.patch`, backups-first, irreversible) |
| E1 isDayComplete dispatch | **ABSORBED → DF2-46** (`deriveCompletionDecision` — moved from DF2-30 per Codex fold note; a UI container doesn't replace server completion policy) |
| E2 lifecycle machine + dead 7-export API | **ABSORBED → DF2-30 (machine) + DF2-02a (the API, incl. sessionService.js:268 dead G-PASS copy)** |
| E3 resolveAssignmentPolicy | **ABSORBED → DF2-08** (gate-override vs "(after D5)" APPROVED — the module must precede its first consumer DF2-10; drift-normalization split per N3) |
| E4 free-nav 🌟 | **THE PROGRAM** — design track (47/42d/43-spec) + Waves 4-6; live-enablement gates preserved at DF2-61 |
| Banked Item A (review-pass gate) | **ACTIVATED → DF2-08/10/11** (Wave 1, per G6; deviation note on the card) |
| Banked Item D (unified container) | **ACTIVATED → DF2-20/30-34** (Waves 2-3; §8/§9 constraints verbatim) |
| D3.5 remediation R1-R16 | **CARRIED → DF2-05** (v2 numbering; Wave-4 entry subset corrected per N1; R8 stamp rides DF2-10) |
| Grader round 2 | **CARRIED → DF2-06** (interleave rule; verbatim-intent confirm at go) |
| Housekeeping §4.3 (a-d) | **OWNED → DF2-0H** (Wave 0) + D3.5 report/FINDINGS reconciliation with DF2-05 |
| Token-thread residual (diag-script predicate) | **CARRIED → DF2-62** |
| — NEW (no deepfix1 ancestor) | **DF2-46** (server unification/twin retirement) · **DF2-47** (mode-record contract) · **DF2-07/32 messaging** · **DF2-35/53/55 teacher+flip UX** · **DF2-36** (G-QUAR screen) |

## 4. Open decisions register 🧭 (David) — items 1/2/6/11 reframed per Opus-2 round-2

> **⚡ DAVID DECISIONS 2026-07-26 (supersede items 2 and 6 below; ripple-fold + bounded re-review pending):**
> **(D-1) REMOVE the review-score throttle entirely** — redundant under the review-pass gate. The binary
> reviewMode/interventionLevel machinery (enter <0.30 / exit >0.50, hold-csd throttle leg, allocation scaling) is
> RETIRED in forced mode; the review gate becomes the sole "struggling student" mechanism. Item 2 (throttle-day gate)
> is DISSOLVED — no throttle days will exist. Item 6 (float fate) is RESOLVED — the vocabulary dies with the throttle.
> Consequences to fold: throttle removal rides the Wave-1 core pin-move (same completeSession territory as the gate);
> messaging rows 1-2 dissolve (list-end / resume / retake-wall reasons remain); DF2-07(b)/(e) re-scope (the 50% copy
> never ships — the mechanic is dying; help-site 30% text gets REMOVED not corrected); review-test size needs a new
> rule (interventionLevel scaling gone — 🧭 proposed default: fixed size, revisit the dead min/max levers then);
> DF2-35 reason set updates; the ~27 currently-held students get RELEASED at ship (CS comms required); M4 shadow
> validator's throttle/allocation legs re-derived.
> **(D-2) Graduation only on a PASSED review test** — a failed review graduates ZERO words (today's
> floor(size×score)-on-any-score formula dies). One clarification open: on a PASSED test, which words graduate —
> (a) only correctly-answered ones [proposed default], (b) all tested, or (c) keep the size×score count? →
> folds into DF2-10 + DF2-42d (mastery transitions).
> **(D-3) ALL attempts recorded to Firebase, pass or fail, MCQ and typed, new-word and review** — PROMOTED TO PROGRAM
> INVARIANT (§0). Verified already true today for graded attempts (`passed:false` recorded; only dormant practiceMode
> skips); cert matrices assert it explicitly.
> **(D-4) Gate-OFF semantics (closes r43-H2/N5):** turning the gate OFF changes NOTHING retroactively — a past failed
> review never becomes completion evidence; the student retakes (which under OFF auto-passes) to advance. Implemented
> as a UNIFORM `passed===true` evidence reader (all pre-gate reviews are `passed:true`, so legacy data is untouched;
> re-enabling never re-blocks an advanced day). Simpler and stricter than the reviewer's proposed amnesty default.

1. **DECIDE-0 · Ship model** — WHAT: when validated Wave-3 deltas (messaging rows, one-affordance Dashboard, chrome/derived
   copy) reach 26SM. **Scope note [Fable-2 H2]: the standing exceptions (DF2-01, DF2-07, DF2-36, CONT-A, DF2-35) ship on
   their own gates under EITHER option — (b) means "no CONTAINER exposure before DF2-60," not "nothing visible ships."**
   OPTIONS: **(a) INCREMENTAL** — each delta live as it clears DF2-34. *Gain:* CS relief months earlier; each delta
   individually reversible. *Cost:* 26SM runs intermediate build states; more validation/rollback surfaces. **(b)
   SINGLE-TRAIN** — container visibility waits for DF2-60's one attested build identity. *Gain:* exactly one production
   identity to validate/roll back. *Cost:* every container-borne fix waits for Wave 6, and the canary re-homes to DF2-60
   (full-cohort single-step exposure is forbidden either way). RECOMMENDED: **(a)**, conditioned on the byte-identity
   falsifier holding for every non-delta path (Fable-C + Opus-B; round-1's back-loading critique weighs against (b)).
   BLOCKS: Wave-3 production exposure only — the BUILD proceeds either way.
2. **DF2-10 · Throttle-day review gate** — WHAT: on a THROTTLE review-only day (0 new words, reviewMode=true), does a
   FAILED review ALSO trip `review_retake_required`, or does the binary hold own that day alone? OPTIONS: (a) yes —
   second retake wall on throttle days; (b) no — gate applies only on normal days. RECOMMENDED: **(b)** — a throttled
   student is already held on review by design; a second wall risks a double-hold with no new-word payoff and re-creates
   the #11 deadlock family. BLOCKS: DF2-10's exemption list + cert matrix. (Retake-surface N resolves inside DF2-10.)
3. DF2-02a: dead levers — wire or remove. Default nudge: **remove** (they've never fed anything; the UI copy lies).
4. DF2-06: grader round 2 go + confirm verbatim-vs-paraphrase grading intent.
5. DF2-42d: G-ENGAGED 0.8 for free-mode review RECORDING (closed inside the scheduler design 🔍).
6. **DF2-46 · interventionLevel float fate** — WHAT: the legacy continuous float still scales challenge-advance sizing and
   is copied at hydration, though forced throttle is now the BINARY reviewMode bit. OPTIONS: (a) KEEP float + float-scaled
   challenge-advance; (b) COLLAPSE — derive from the binary bit, fixed challenge-advance size; (c) FREEZE — stop writing
   new floats, honor existing until aged out. RECOMMENDED: **(b)** if no live behavior needs float granularity, else (c).
   BLOCKS: DF2-46 twin retirement + challenge-advance sizing (a wrong call silently changes challenge word counts).
7. DF2-51: re-test gradebook semantics (default: `type:'retest'`, non-advancing, original pass = accountability score) ·
   hub layout/nudge strength.
8. DF2-53: free-mode pacing metric (proposed default: frontier index vs expected-by-calendar-day) · mixed-class view shape.
9. DF2-54: PMv2 rail ruling — bound by the non-progress/non-gradebook default condition.
10. DF2-61: pilot class selection (suggest: an engaged teacher, mid-size, no dual-enrollment students in the first pilot).
11. **Forced-mode task selection** — STATUS QUO: forced mode is strictly linear — no re-study of past days, no picker; the
    sole backward affordance is retaking the CURRENT day's test after a fail. WHAT: does forced gain a bounded backward
    affordance? OPTIONS: (a) NONE — picker stays free-exclusive (byte-identical to today); (b) BOUNDED RE-STUDY —
    flashcards only, non-scoring, any past segment; no re-test, no gradebook write; (c) BOUNDED RE-TEST — additionally
    re-test past segments as `type:'retest'`, non-advancing, mirroring DF2-51's semantics. RECOMMENDED: **(b)** — gives
    the majority cohort goal-3 practice without touching pass-to-advance or the gradebook. BLOCKS: DF2-30/51 scope; any
    forced affordance is a NAMED approved delta.
12. Free-mode challenge/tokens — default: identical machinery (segment tests challengeable; weekly reset unchanged).
13. Streak definition — default: calendar-days-with-any-graded-activity, decoupled from day-completion (+ the attached
    fixture: a daily free-mode studier keeps the streak; weekend-skip verified at DF2-34).
14. **Scope note:** parents/parent-facing surfaces are OUT OF SCOPE for this program (no portal, no notifications) —
    re-raise only if ever wanted [Opus-2 restore].

## 5. Program exit criteria (v2)

One release line live where: forced mode byte-identical-verified through the container (approved deltas excepted, each named);
**every G-* gate computed at exactly ONE site — the client/server twins RETIRED (DF2-46) and the G-PASS module the only pass
predicate**; every hold/refusal/carry renders a reason (rows 1-16 live) with the **CS baseline→target metric met**; canonical
record single-writer with the frontier server-owned; ≥1 real class through the **defined pilot success criteria** in free mode
(pass-to-advance) on due-based review; rules lineage final (P10d superseded, R3 last, never bare-deployed); `class_progress`
retired; CS toolchain + docs speak both modes.

## 6. Round-1 convergence record (2026-07-25/26)

| Panelist | Verdict | Folded as |
|---|---|---|
| Codex r41 | UNSOUND-as-executable / direction SOUND | S1→DECIDE-0+Wave-3 reframe · S2→DF2-36 · S3→41-before-40 · S4→DF2-10 v2 · S5→DF2-02b · R1→DF2-46 · R2/R6→DF2-08 · R3/R4→DF2-40/44 restorations · R5→R3 interlock · F1/F2→DF2-47 · F3/F4→DF2-43 contract · F5/F6→DF2-42d |
| Fable-A | GAPS-FOUND | H1→DF2-46 · M1→DF2-03 · M2→DF2-42d/50 · M3→DF2-43 · M4→exemption fix · M5→reg.6 · M6→DF2-02a · M7→PMv2 track · L1-L6 swept |
| Fable-B | ordering GO w/ corrections | corr.1→DF2-10 · corr.2→DF2-44 · corr.3→DF2-43 gates · corr.4→Wave-4 order+gates · corr.5→DF2-08 · corr.6→Wave-5 gates · corr.7→DF2-42d · corr.8→DF2-06 · corr.9→DF2-31/32 seams · corr.10→DF2-02b |
| Fable-C | CONDITIONAL YES | C1/C2→DECIDE-0+§0 · C3→pin language · C4→exemptions · C5→DF2-40 · C6→§0 never-branch · C7→DF2-02a · C8→row 16 · C9→DF2-44a · N1-N12 swept |
| Opus-A | GO-WITH-CONDITIONS | R-A/B/C→DF2-10+DF2-04 · R-D→DF2-34 · R-E→DF2-32 oracle · R-F/G/H→DF2-40/41 · R-I→DF2-47/55/61 · R-J→§0 off-peak · R-K→DF2-04 · R-L→Wave-4 entry gates |
| Opus-B | delivered-but-back-loaded | quick-wins→DF2-07 · decisions 1-8→register/DF2-35/51/53/55 · copy rules→DF2-32/06_MESSAGING_COPY · metrics→DF2-61/62 · 50/30 fix→DF2-07(e) |

**Round-2 re-converge required before Wave-1 build authorization** (Codex's decision; panel re-runs on this v2).

## 7. Round-2 convergence record (2026-07-26) — folded into THIS v3

| Panelist | Verdict | Folded as |
|---|---|---|
| Codex r42 | SOUND-WITH-GAPS, don't authorize Wave 1 yet; expected next verdict GO | N1→DF2-05/10 (R7 out, R8 stamp rides the pin-move) · N2→DF2-08 boundary + §0 transitional wording · N3→DF2-08 drift split (census + 🧭 default decision) · N4→provenance-typed authoritativePassed · N5→kill-switch rollback fixtures ×3 · N6→response fields on DF2-10 (supersedes client inference) · N7→row 16 = STATE · N8→TZ-honest copy · N9→DF2-07 per-reason oracle ship-gate · N10→DF2-43 gates += 46/42 · N11→DF2-46 pure-policy shape + E1 move · N12→DF2-42d post-47 recheck · fold notes→orientation §3 row, counts, set +resetProgress+version, coordinated choreography, DECIDE-0 non-blocking clarifications |
| R2 Fable-1 (fold fidelity) | Fold faithful; 4 residues | anchor-shadow rewire→DF2-46 · E1 rationale→DF2-46 (moved, per Codex) · 15→16 counts fixed · cosmetics swept |
| R2 Fable-2 (fresh hunt) | One more bounded structural pass | H1→§3 reconstructed + v2 archived (`_archive/`) · H2/H3→delta mechanism TOTAL + DECIDE-0(b) scoped + canary re-home · H4→DF2-10 deviation note · H5→set = 10 · M1/M2→design track + DF2-02b/35 moves · M3→DF2-31 premise corrected · M4→5-site allocation cites · M5→06_MESSAGING_COPY supersedes · M6→orientation §2 + E3 override note · M7→DF2-07(c) nextListId condition · L1-L7 swept (incl. DF2-0H housekeeping row, R3 gloss, L6 criterion) |
| R2 Fable-3 (cross-doc) | Coherent core, seams open | §12.1 supersession banner + §11.4/§12.3/MAP annotations (ecosystem edits) · orientation §3 row + counts · MASTER pointer amendment · task-list §3 reword · baton reconciled by Codex · r42 citation added |
| R2 Opus-1 (safety) | GO-WITH-CONDITIONS (Wave-0/1 build) | C1→DF2-07(b) binding + oracle ship-gate · C2→soak/abort/rollback-pin instantiated + full-set rollback rule · C3→§0 derivation rule · C4→DF2-08 deploy fence |
| R2 Opus-2 (product) | Product-ready pending 6 closures | (e) help-site 30→50 MUST-FIX → DF2-07(e) · DF2-35→Wave 1 · DF2-55 blocking interstitial · register 1/2/6/11 reframed + 14 added · DF2-61 X=60% · DF2-62 baseline pinned pre-DF2-07 |

**Status: v3 = the round-2 fold. Remaining before Wave-0/1 build: (i) Codex r43 fold-verification, (ii) David closes
DECIDE-0 + register items 2/3/4 (the Wave-0/1 blockers; the rest close at their marked waves).**

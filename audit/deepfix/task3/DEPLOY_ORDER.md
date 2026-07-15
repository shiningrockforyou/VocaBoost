# DEPLOY_ORDER.md — the ONE global rules/index deploy order for the deepfix P0→P10→P7 program

**Status:** LOCAL-ONLY runbook (2026-07-14). Resolves FINAL-REVIEW **F-1** (BLOCKER) —
`audit/deepfix/task3/FINAL_REVIEW_FINDINGS.md` F-1 = Codex `codex_deepfix_task3_final_001.md` FINAL-1 =
Fable-B BLOCKER-1. Nothing here is committed / deployed / run live. David runs the deploys.

---

## 0 · Why this file exists (the F-1 defect, in one paragraph)

The single working-tree `firestore.rules` welds **three** rules cutovers into one physical file: the **P6**
write-authority cutoff, the **P10c** additive `teacherIds` read clause, and the **P10d** claim-switch +
four narrowings. Because `firebase.json` maps `"rules": "firestore.rules"`, a bare
`firebase deploy --only firestore:rules` at the **P6** point would ship **P10d early** → every teacher
whose Auth token has no `role:'teacher'` claim (un-backfilled / token not yet refreshed) is locked out of
class/list/system-log/AP/gradebook surfaces. Conversely, waiting to deploy the file until P10d leaves the
P6 write-lockdown **un-enforced during P4–P9** → the attempt/progress/role forgery surfaces stay open
longer than the foundation plan claims. **Neither is safe.** F-1's fix is a *deploy-packaging* split:
one physical artifact per rules-deploy stage, plus this one ordered runbook. **The load-bearing invariant
this file makes mechanically true: a P6 rules deploy cannot include P10d** (§6 proves it).

---

## 1 · The three stage-isolated rules artifacts (registry)

| Deploy | Stage | Artifact (exact path) | Contains | Excludes | `isTeacher()` |
|--------|-------|-----------------------|----------|----------|---------------|
| **R1** | P6 (FND-4) cutoff | `audit/deepfix/task3/firestore.p6.rules` | attempts W3 lockdown, progress subcoll write-denial, users role-split, teacher_invites lockdown; **teacher write branches KEPT** | P10c read clause, P10d switch/narrowings | **doc-role** `getUserData().role=='teacher'` |
| **R2** | P10c read-surface | `audit/deepfix/task3/firestore.p10c.rules` | everything in R1 **+ the ONE additive** `teacherIds` attempts read clause | P10d switch/narrowings | **doc-role** (unchanged) |
| **R3** | P10d cutover (final) | `firestore.rules` (repo working tree) | everything in R2 **+ P10d**: claim-switch + 4 narrowings | — (this is the end-state) | **custom-claim** `request.auth.token.role=='teacher'` |

**Provenance (all verified apply-clean / diff-exact, 2026-07-14):**
- `firestore.p6.rules` = `HEAD:firestore.rules` (blob `f7bcc92`) **+** `phase6_rules.patch`.
- `firestore.p10c.rules` = `firestore.p6.rules` **+** the `firestore.rules` hunks of `phase10c_diff.patch`.
- `firestore.rules` (working tree) = `firestore.p10c.rules` **+** the P10d rules changes (= the
  `firestore.rules` hunks of `phase10d_diff.patch`).

So the three artifacts are a strict superset chain: **R1 ⊂ R2 ⊂ R3**. Diffs were verified to contain
**exactly** their stage delta and nothing else (§8).

> The working-tree `firestore.rules` (R3) is byte-unchanged in rule LOGIC by this task — only its header
> comments were re-keyed so it no longer reads as "deploy this file at P6" (it now names itself the P10d
> artifact and points R1/R2 at the snapshots). Verified: strip `//`-comments+blanks ⇒ identical to the
> pre-edit tree.

---

## 2 · Deploy MECHANICS — the `firebase.json` trap (read before every rules deploy)

`firebase.json` = `{ "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" } }`.
The rules **path is fixed to `firestore.rules`**. Therefore the artifact you intend to ship must BE at
that path when you deploy. At R1 and R2 the intended artifact is a *snapshot*, not the repo file, so:

**At R1 (P6):**
```
cp audit/deepfix/task3/firestore.p6.rules firestore.rules   # stage the P6 artifact
firebase deploy --only firestore:rules                      # ships P6 ONLY
git checkout -- firestore.rules   # OR restore the dormant P10d draft from backup (see note)
```
**At R2 (P10c):**
```
cp audit/deepfix/task3/firestore.p10c.rules firestore.rules
firebase deploy --only firestore:rules                      # ships P6 + P10c read clause ONLY
# restore the dormant P10d draft afterward
```
**At R3 (P10d):** the repo `firestore.rules` **already IS** the P10d artifact — deploy it directly
(no staging): `firebase deploy --only firestore:rules`.

> ⚠️ **Restore note.** The entire deepfix P0–P10 is **uncommitted working-tree state** (see
> `P7_RETIREMENT_INVENTORY.md`). `git checkout -- firestore.rules` reverts to the **pre-deepfix HEAD**
> (blob `f7bcc92`), NOT to the dormant P10d draft. Keep a backup copy of the working-tree `firestore.rules`
> BEFORE staging, and restore from that copy — do not `git checkout` unless you intend the pre-deepfix base.
> (Line endings are cosmetic: the snapshots are LF, the working-tree file is CRLF; Firebase accepts both.)

**Standing rule (from FIX_PLAN §0 / P0):** never a bare `firebase deploy`; always `--only`-scoped, and
NOTHING rides along on a rules deploy.

---

## 3 · The global ordered deploy sequence (P0 → P10 → P7)

Every deploy in program order. **Rules/index deploys are bold**; everything else is functions/hosting or a
no-deploy step, listed so the rules gates are seen in context. Hard preconditions are composed in §4.

| # | Phase | Deploy target | Artifact / payload | Gate (short) |
|---|-------|---------------|--------------------|--------------|
| 0 | P0 FND-0 | *(none)* | 2 one-line commits: disarm `GRADE_TOKEN_ENFORCED`; adopt G1 table | — (this IS the gate) |
| 1 | P1 RO | `--only hosting` | built #11/#9/#10/C-27 fixes | P0 complete; C-38 sweep teaches `reviewOnlyDay` |
| 2 | P2 RS | **`--only firestore:indexes`** → then `--only hosting` | **2 C-33 attempts indexes** `(teacherId,studentId,submittedAt)`,`(teacherId,classId,studentId,submittedAt)` | **index-before-query**; parallel track |
| 3 | P3 FND-1 | `--only functions` | first functions deploy; server surface + `version` probe; resolver READ-ONLY | P0 G1 disarm live (X1) |
| 4 | P4 FND-2 | `--only hosting` | client cutover; `SERVER_*` flags on; `SERVER_RESET_PROGRESS` reset cutover; build stamp | P3 live; then **soak** |
| 5 | P5 FND-3 | *(no app deploy)* | one-time migration (off-peak, CS-authorized) + atomic 3-flag `LIST_PROGRESS_CANONICAL` cutover | P4 soaked; 25WT rehearsal; census before/after |
| **R1** | **P6 FND-4** | **`--only firestore:rules`** | **`firestore.p6.rules`** — NOTHING rides along | **P6 1-4 (§4).** Starts the P7 clocks. |
| 6 | P8 CONT-A | `--only hosting` | list-linking + choice terminal + continuous advance | after RO (no foundation dep); no rules deploy |
| 7 | P9 CYC | `--only hosting` + `--only functions` | cycling capstone; lap-aware M4 | **HARD GATE: P6 (R1) live + accepted**; no rules deploy |
| 8 | P10a/b OVR core | `--only functions` | `overrideAttempt` + `reviewChallenge`→server (behind `SERVER_OVERRIDE_ENABLED`/`SERVER_REVIEW_CHALLENGE_ENABLED`); then flip `SERVER_OVERRIDE` on + **SOAK** | P6 live; no rules deploy. **This soak is a hard precondition for R3.** |
| **R2a** | **P10c index** | **`--only firestore:indexes`** | **4 `teacherIds` array-contains indexes** (`teacherIds`; `+classId`; `+studentId`; `+classId+studentId`, each `+submittedAt`) | **index-before-query** |
| **R2** | **P10c rules** | **`--only firestore:rules`** | **`firestore.p10c.rules`** — additive read clause; NOTHING narrowing rides | P6 live; **R2a indexes live**; must precede the flag flip (next) |
| 9 | P10c flags | backfill `--dry`→`--commit` (off-peak, CS-auth) → then `--only hosting`/`--only functions` | flip `TEACHER_IDS_READ` (client) **+** `TEACHER_IDS_WRITE_ENABLED` (server) **together**; SOAK | **R2 live BEFORE this** (TEACHER_IDS-rules-before-flag) |
| 10 | P10d D1 | `--only functions` | `provisionTeacher` mints claim; `TEACHER_CLAIM_ENABLED=true` | P10a/b live |
| 11 | P10d D2 | claim backfill `--dry`→`--commit` | `deepfix-backfill-teacher-claims.mjs` (David-auth); read-back 0 mismatch | D1 live |
| 12 | P10d D3 | *(wait)* | token-refresh window: every live teacher re-login OR ≈1h ID-token TTL | D2 complete |
| 13 | P10d D4 | *(test)* | rules-test matrix re-green under the CLAIM model | D3 elapsed |
| **R3** | **P10d cutover** | **`--only firestore:rules`** | **`firestore.rules`** (working tree) — NOTHING rides along; **LAST rules deploy** | **UNION: P6 1-4 (met at R1) + D1-D4 + SERVER_OVERRIDE ON+soaked** |
| 14 | P7 FND-5 | `--only hosting` + one-time deletion script + follow-on `--only functions` | write-path retirement patch; `class_progress` doc deletion (irreversible, backups first); server `*_ENABLED` guard cleanup | **≥14 days after R1/P6 + ≥7 consecutive days zero `legacy_write_denied`.** No rules deploy. |

**Rules deploys, in order: R1 (`firestore.p6.rules`) → R2 (`firestore.p10c.rules`) → R3 (`firestore.rules`).**
**Index deploys: P2 (C-33 pair) and R2a (teacherIds quad) — both index-before-query.** **P7 ships NO rules
deploy** (the doc-role→claim change already happened at R3; retiring the now-unused `getUserData()` helper is
an optional later rules cleanup, not P7's `--only hosting` target — see `P7_RETIREMENT_INVENTORY.md` §(b)).

---

## 4 · Precondition composition (the hard gates, by deploy)

### R1 = P6 (FND-4) — deploy `firestore.p6.rules`
All four are hard (FIX_PLAN P6 header; mirrored in the artifact header P6 1-4):
1. **P3 functions live** — `completeSession`/`resolveListProgress`/`resetProgress`/`advanceForChallenge`
   with server flags on (incl. `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`,
   `TEACHER_PROVISIONING_ENABLED`).
2. **P4 client cutover shipped + soaked** — `SERVER_PROGRESS_WRITE`, `SERVER_RESET_PROGRESS`,
   `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER` all true in the LIVE bundle; **bundle-grep proves zero
   live client attempt-create/-delete calls** (else removing owner-delete breaks reset — FIX_PLAN §3.6).
3. **P5 migration complete** — 26SM quarantine = 0; M4 shadow clean (≈0 false rejects over ≥14 days);
   14-day no-legacy-write window + build census.
4. **Rules-test matrix green** (`P6_impl_notes.md §4`) — forged create/answers-update/progress-write DENIED;
   M8 role matrix; the F4-3 signup-provisioning persona; the reset-via-callable persona.
> **Index-before-query already satisfied** by P2 (the C-33 pair) — R1 issues no new query.

### R2 = P10c — deploy `firestore.p10c.rules`
- **P6 (R1) live.** (R2 is a superset of R1; deploying R2 also re-asserts the P6 cutoff.)
- **R2a first:** the 4 `teacherIds` array-contains indexes are LIVE (`--only firestore:indexes` before rules).
- **Safe-anytime property:** the clause is existence-guarded → inert until the backfill lands, so R2 is
  byte-equivalent to R1 behavior until cutover. Its ONLY binding order is **TEACHER_IDS-rules-before-flag:**
  R2 must be deployed **before** `TEACHER_IDS_READ` flips (a widened `array-contains` query against the
  un-widened rule hits the backstop — I-10 §4 same-release).

### R3 = P10d — deploy `firestore.rules` (working tree)
**UNION precondition = ALL of:**
- **P6 1-4** (already satisfied at R1 — re-assert nothing regressed).
- **D1** functions carrying `provisionTeacher`'s `setCustomUserClaims` LIVE with `TEACHER_CLAIM_ENABLED=true`.
- **D2** one-time claim backfill run to COMPLETION for every existing role-doc teacher; read-back 0 mismatch;
  triage any `MISSING_AUTH`.
- **D3** token-refresh window elapsed (every live teacher re-logged-in OR ≈1h ID-token TTL).
- **D4** rules-test matrix re-green under the claim model (`auth.token.role`, not doc role).
- **SERVER_OVERRIDE ON + soaked** (P10a/b) — the narrowings d3/d4/d4b are legal only because
  `reviewChallenge` is server-side. **Rollback coupling:** if `SERVER_OVERRIDE` is ever rolled back after R3,
  revert d3+d4+d4b in the SAME rules redeploy (else the reverted client teacher-writes are denied).
> D-order is load-bearing: deploying R3 before D2+D3 complete locks out every teacher (the §2 blast radius in
> `P10d_impl_notes.md` — 14 teacher-gated rules switch to the claim at once).

### P7 (FND-5)
≥14 days after R1/P6 **and** ≥7 consecutive days of zero `legacy_write_denied` ([C8-1]) **before** the
one-time `class_progress` deletion (irreversible → backups first). Gates only on P6+soak — NOT on P9/P10.

---

## 5 · P10c: its own step vs folded into P6 — DECISION

The P10c `teacherIds` read clause is **additive / safe-anytime** (existence-guarded, inert until the
backfill). Two valid packagings:

- **(A) Own step — RECOMMENDED, and what this runbook uses.** Ship it at R2 as `firestore.p10c.rules`,
  after P6 and immediately before the `TEACHER_IDS_READ` flip. Keeps **P6 minimal** (R1 = exactly the reviewed
  `phase6_rules.patch` state), makes each rules deploy ship exactly one stage, gives P6 and P10c **independent
  reversibility**, and puts the TEACHER_IDS-rules-before-flag invariant on its own named gate. Cost: one extra
  tiny rules deploy.
- **(B) Fold into P6.** Because the clause is inert pre-backfill, you *may* include it in the P6 artifact and
  drop R2 (one fewer deploy). Cost: P6 is no longer the minimal reviewed cutoff, and reverting P6 also reverts
  the clause (harmless while un-backfilled). If you choose (B): add the c14 clause to `firestore.p6.rules`,
  delete `firestore.p10c.rules`, and R2 disappears from §3 — **but the R2a index deploy and the
  TEACHER_IDS-rules-before-flag gate still stand.**

Either way, **the P10d narrowings are NEVER folded forward** — R3 stays its own last deploy.

---

## 6 · PROOF — no command named at the P6 step can deploy P10d

Two independent proofs; both must hold.

**(a) Content proof — the P6 artifact does not contain P10d.**
Grep the P6 artifact's **code** (strip `//` comments first — the banner intentionally quotes these tokens
in prose, so a raw `grep` would match the header, not the rules):
```
code(){ sed 's#//.*##' "$1"; }   # strip // comments
code audit/deepfix/task3/firestore.p6.rules | grep -c "request.auth.token.role"     # -> 0   (R3 code = 1)
code audit/deepfix/task3/firestore.p6.rules | grep -c "in resource.data.teacherIds" # -> 0   (no P10c)
# teacher branches STILL present (must be, at P6):
code audit/deepfix/task3/firestore.p6.rules | grep -c "resource.data.teacherId == request.auth.uid && isTeacher()"  # -> 1  attempts UPDATE
code audit/deepfix/task3/firestore.p6.rules | grep -c "isOwner(userId) || isTeacher()"                              # -> 2  subcoll write + read
```
`isTeacher()` in the P6 artifact is `getUserData().role == 'teacher'` (doc-role); in R3 it is
`request.auth.token.role == 'teacher'`. Deploying this file
**cannot** switch teachers to the un-backfilled claim, and cannot remove any teacher write branch — the two
failure directions of F-1 are both impossible from this artifact.

**(b) Command proof — the P6 step targets the P6 artifact, not the repo file.**
`firebase.json` fixes the rules path to `firestore.rules`, so the P6 command MUST first
`cp audit/deepfix/task3/firestore.p6.rules firestore.rules` (§2). The runbook names that exact artifact at
R1. The working-tree `firestore.rules` header (re-keyed per F-1) now carries a ⛔ banner: *"DO NOT deploy
this file at the P6 (or P10c) step … at P6 deploy firestore.p6.rules."* So a P6 deploy that follows the
runbook ships (a); a P6 deploy that ignores the runbook and bare-deploys the repo file is caught by the
in-file ⛔ banner. **The only way to ship P10d is to explicitly deploy the working-tree `firestore.rules` (R3)
under its UNION precondition** — which is the intended, last, gated deploy.

---

## 7 · Precondition conflicts / nuances found while composing (flagged)

1. **P7 calendar position — runbook (P7 last) vs FIX_PLAN one-liner (P7 before P9/P10).** FIX_PLAN §0.3's
   one-liner is `…P6 → P7 → CYC → OVR`; this runbook and the task frame it as `P0 → P10 → P7` (P7 last).
   **Not a hard conflict:** P7 gates ONLY on "P6 live + ≥14d soak + ≥7d zero `legacy_write_denied`", so it is
   *calendar-flexible* — it may run any time that window opens. Presenting it **last** is the safe default,
   because P7's `class_progress` doc deletion is the true end of P5/P6 reversibility, so you want P9 and the
   P10 cutovers soaked first. **Stale-rationale note:** `P7_RETIREMENT_INVENTORY.md §0` argues "P9/P10 flags
   are not soaked at P7 time, so keep them" — true if P7 runs in the earlier slot; if P7 runs last, those
   flags ARE soaked, but P7's patch still (correctly, conservatively) excludes them. Keep P7's scope as
   written regardless of which slot David picks.

2. **The `firebase.json` default-target hazard is the residual operational risk** (not a plan conflict).
   Because the deploy path is hard-wired to `firestore.rules` = the R3/P10d file, the *default* action at
   every earlier rules step is the wrong one. Mitigations layered: (i) the re-keyed in-file ⛔ banner,
   (ii) this runbook's explicit `cp` staging step, (iii) the artifact `PROOF`/`EXCLUDES` headers. If you want
   a stronger mechanical guard, David could temporarily point `firebase.json` `"rules"` at the snapshot for
   R1/R2 — but that edits a committed file; the staging-copy approach is lower-blast-radius.

3. **`SERVER_OVERRIDE` soak is double-duty and rollback-coupled.** It is a P10a/b flip AND a hard R3
   precondition; and if it is ever rolled back after R3, the d3/d4/d4b narrowings must be reverted in the same
   rules redeploy. Do not treat R3 as independently revertible from the `SERVER_OVERRIDE` client state.

4. **P5 reversibility is narrower than "until P7."** P5 is cleanly restore-from-backup reversible only in the
   pre-first-post-flip-completion window (minutes); after that, rollback is a reconcile. This tightens the
   real cost of a late P6/R1 rollback and is another reason to soak R1 fully before P9/P10/P7.

None of these blocks the deploy order; they are the sequencing facts to hold while running it.

---

## 8 · Verification record (this task, 2026-07-14, local)

- `firestore.p6.rules` = `HEAD:firestore.rules` + `phase6_rules.patch` — **git apply --check CLEAN**;
  295 rule-lines; braces 49/49, parens 105/105, brackets 5/5 (code-only, **balanced**).
- `firestore.p10c.rules` = `firestore.p6.rules` + `phase10c_diff.patch` rules hunks — **apply CLEAN**;
  braces 49/49, parens 106/106, brackets 5/5 (**balanced**).
- `firestore.rules` (working tree, R3) — braces 49/49, parens 94/94, brackets 4/4 (**balanced**);
  `request.auth.token.role` ×1 in CODE (the `isTeacher()` body — P10d present; raw file count is higher only
  because the re-keyed header quotes the token in prose); CRLF preserved.
- **Stage-delta diffs verified exact:**
  - `working-tree − p10c` = ONLY the 4 P10d code changes (isTeacher body; users-doc UPDATE; users
    subcollection WRITE; attempts UPDATE).
  - `p10c − p6` = ONLY the P10c `teacherIds` read clause.
  ⇒ R1 ⊂ R2 ⊂ R3, each adding exactly its stage.
- **Header re-key of working-tree `firestore.rules` is comment-only:** strip `//`-comments + blanks ⇒
  **byte-identical** to the pre-edit tree (rule logic unchanged; only the P6 header banner + P6 "Deploy:"
  line re-keyed to name R3 as the P10d artifact and point R1/R2 at the snapshots).
- **F-1 proof (§6), code-only:** P6 artifact grep-clean of `request.auth.token.role` (0) and teacherIds (0);
  teacher write branches present (attempts-UPDATE ×1, `isOwner||isTeacher` ×2).

# WinClaude r091 — ORDER 91 (dark-deploy series): **LEG 1 DEPLOYED · LEG 2 REFUSED · TRAIN HALTED**

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 174 → **out:** 175
**Handoff:** `claude_to_winclaude_091.md` · **Authority:** R2-31 + David Q3.

## VERDICT: `HALTED_AT_LEG_2` — the refusal clause fired, and it caught a live-breaking deploy

| Leg | Outcome |
|---|---|
| **91-1 indexes** | ✅ **DEPLOYED** — verified additive-only first |
| **91-2 rules** | 🛑 **REFUSED** — see §2. Would have shipped an unshipped production cutover |
| **91-3 functions** | ⛔ **NOT ATTEMPTED** (train halted per your own stop rule) |
| **91-4 config doc** | ⛔ **NOT ATTEMPTED** |

## 1. LEG 91-1 — INDEXES: DEPLOYED ✅

**Pre-verification (before deploying):** captured the live deployed index set via
`firebase firestore:indexes` and compared it key-by-key against `firestore.indexes.json`
(normalising away the implicit `__name__` field):

- **deployed: 42 · local: 43**
- **DEPLOYED-BUT-NOT-IN-LOCAL (removal risk): NONE** ← the check that mattered
- **LOCAL ADDITIONS: exactly one** — `grading_jobs | uid:ASCENDING, status:ASCENDING`

Exactly the one addition your order predicted, zero removals, no field-order changes.

**Deploy:** `firebase deploy --only firestore:indexes` → `Deploy complete!` on `vocaboost-879c2`.
**Post-verify:** deployed count now **43**; `grading_jobs (uid ASC, status ASC)` present. Index builds are
asynchronous and the CLI listing does not report per-index state, so I report **present and building** rather
than claiming completion — as you instructed.

**Note:** the indexes deploy compiles `firestore.rules` as a validation step (it printed two pre-existing
lint warnings at `firestore.rules:114-115`). **Compilation is not publication — no ruleset was deployed.**

## 2. 🛑 LEG 91-2 — RULES: REFUSED. THREE BLOCKERS, ONE OF THEM SEVERE

### BLOCKER A (severe) — `firestore.rules` is an UNSHIPPED STAGED CUTOVER, and it self-declares as undeployable

`firestore.rules:4-25`, verbatim from the file:

> `⚠️⚠️ THIS IS THE P10-CUTOVER (FINAL) RULES ARTIFACT ⚠️⚠️` … *"It therefore deploys **ONLY** at the P10d
> cutover (the LAST rules deploy), under the UNION precondition below — NOT at the P6 point, and NOT at the
> P10c point."*
>
> `⛔ DO NOT deploy this file at the P6 (or P10c) step. Because firebase.json maps "rules":
> "firestore.rules", a bare `firebase deploy --only firestore:rules` from the repo ships THIS file = P10d.`
>
> *"Deploying it EARLY **breaks live student flows** AND **locks out un-backfilled teachers** (the P10d blast
> radius)."*

**`firebase.json` does map `"rules": "firestore.rules"`.** So `firebase deploy --only firestore:rules` — the
exact command in your order — ships the P10d end-state ruleset to production.

Its **UNION DEPLOY PRECONDITION** is *all* of: the P6 1–4 block **and** the P10d D1–D4 block **and**
`SERVER_OVERRIDE` ON and soaked. **I cannot verify any of those are met**, and the repo carries separate
staged snapshots (`firestore.p6.rules`, `firestore.p10c.rules`) precisely because the live base is *behind*
this file.

**This is not additive. It is two unshipped lockdowns riding along with our review_v2 clauses** — exactly what
the refusal clause exists to stop. Per my r090 statement, adopted verbatim by you as an order condition:
*"I will NOT deploy this leg on a diff I cannot read as strictly additive."* **Refused.**

### BLOCKER B — the merge requires editing `firestore.rules`, which is outside my write scope

`EXECUTOR_ONBOARDING.md` §2 forbids me from editing `firestore.rules`. Leg 91-2 instructs me to merge a
131-line artifact into it. **That is a FIX, and fixes are yours** ("YOU RUN. WSL-Claude FIXES"). I did not
edit the file — it remains 419 lines, unmodified, with zero review_v2 surfaces.

Also worth noting: the artifact is **131 lines of `//` commentary**, not deployable rule text. It is a
specification of clauses to author, not a fragment to concatenate. Whoever merges must write the real CEL.

### BLOCKER C — the artifact mandates an emulator matrix your order omits

`firestore.review_v2.rules:111-126` freezes a **10-case emulator matrix** to be run **on the merged file**
("WinClaude runs the emulator matrix on the merged artifact, not on this fragment"), including case 9:
*"Regression sweep: every pre-existing allow in the base still passes."* **That is the test that would have
caught Blocker A independently.** The order goes merge → deploy with no matrix step.

### The artifact predicted this, and the order missed it

`firestore.review_v2.rules:6-12`: *"The merge base is **THE RULESET LIVE IN PRODUCTION AT DARK-TRAIN TIME** —
not any repo draft. The repo file carries P6/P10(d) narrowings that are deploy-gated on their own
preconditions… the dark-train rules deploy MUST re-derive the merged file against the then-live base and
diff-review it."* The specification was correct; the order didn't carry it through.

## 3. TRAIN HALTED — legs 3 and 4 not attempted

Your order: *"Any leg whose verification fails: STOP, do not continue to the next leg, report."* Honoured.
I did **not** deploy functions and did **not** seed the config doc.

**This ordering matters and I would not have skipped ahead even if invited to:** rules precede functions
deliberately, so the nine new server-owned subcollections are locked *before* any code can write them.
Deploying functions first would open a window where those surfaces exist with no rule protecting them.

**Production state after this round:** indexes at 43 (one new, additive, inert until `RESET_V2_ENABLED`
flips) · **rules unchanged** · **functions unchanged** · **no `system_config/review_v2` doc** · nothing
activated anywhere.

## 4. WHAT UNBLOCKS LEG 91-2

1. **Establish the live base.** Determine which ruleset is actually deployed (P6? P10c? pre-P6?) and confirm
   it — the merge base must be that, not the repo draft.
2. **You author the merge** against that live base, adding only the review_v2 clauses.
3. **Send it to me and I will run the 10-case emulator matrix** on the merged file (Java 21.0.9 + firebase
   emulators are green here) — including the case-9 regression sweep.
4. **Then I deploy**, from an explicit path, having read the diff as strictly additive.

If the intent is instead that P6/P10c/P10d *should* ship now, that is a **separate, much larger decision with
a live blast radius** — it belongs to David explicitly, not folded into a dark-train leg.

## STANDBY

Baton returned at rev **175**, `execDecision: HALTED_AT_LEG_2`. Escalated to David.

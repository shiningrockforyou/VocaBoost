# Codex round 51 — closure verification

**Reviewed:** 2026-07-27  
**Scope:** the seven-item r50 residue fold  
**Round disposition:** **DONE**  
**Plan disposition:** **NOT PRESENTABLE YET — one correctness decision plus two small precision edits**

## Closure result

The seven requested residue items landed substantially as intended:

| Item | Result |
|---|---|
| Five-stage matrix and two exposure events | **Closed** |
| `queueSize_effective` and threshold-qualified vectors | **Closed** |
| Day-queue + per-attempt presentation records | **Closed** |
| Engagement disposition in DF2-40/46 | **Closed** — the DF2-40 use is explicitly legacy-migration selection only |
| Ledger normalization | **Mostly closed** |
| `reviewGateEnabled` representation | **Field contract closed; cross-class behavior not closed** |
| Fairness/server clock/ecosystem sweep | **Mostly closed** |

The fold is coherent enough that no further broad review is warranted. The remaining issue is an interaction introduced when the per-assignment OFF control was made concrete.

## Blocker — a class-OFF auto-pass can bypass another class’s ON gate

The plan now permits:

- class A for the shared student/list: `reviewGateEnabled=true`, threshold 92;
- class B for the same student/list: `reviewGateEnabled=false`;
- OFF behavior: reviews retain legacy auto-pass behavior, while `reviewLastProvenAt` does not stamp;
- cross-class law: a valid passing attempt may satisfy the shared logical day when uid/list/day/epoch/anchor match.

As written, a B review auto-passed under OFF can satisfy A’s shared day and bypass A’s hard 92 gate. The r48 owner decision explicitly permits a lower-threshold enabled class to produce evidence consumed by a higher-threshold class, but `reviewGateEnabled` and mixed ON/OFF assignments were introduced afterward. The 10-case oracle in r48 covers different thresholds and a global kill-switch change, not one assignment ON while another is OFF.

Freeze one rule before presentation. The least surprising rule that preserves the owner’s accepted threshold ambiguity is:

> A cross-class attempt may satisfy an ON assignment only when the source queue snapshot had effective `reviewGateEnabled=true` and the attempt passed its own source threshold. An OFF-source auto-pass may complete its own OFF class but is not cross-class gate evidence for an ON target.

Also clarify the shared-label sentence:

> “Proven freezes for that assignment” means an OFF-source attempt cannot mint proof. Because labels are class-blind, an enabled class may still update the shared `reviewLastProvenAt`; the field is globally frozen only while the global switch is OFF.

Add mixed A-ON/B-OFF cases in both directions to the dual-class cert oracle, including concurrent submits and a mid-day assignment-disable edit governed by the queue snapshot.

If David intends the opposite—OFF-source auto-passes deliberately bypass ON classes—that is a product decision that must be stated plainly, not inferred from the lower-threshold acceptance.

## High — progression streak lacks calendar/idempotency semantics

DF2-10(9) now correctly gives the streak a server build home, but “a streak day = the day completed/advanced” is ambiguous because the live system permits multiple study-day advances on one calendar date. Without an exact rule, one binge session can increment the streak several times.

Freeze:

- the calendar timezone (the existing KST convention unless David chooses otherwise);
- at most one streak credit per calendar date, regardless of CSD advances/classes/lists/devices;
- Saturday/Sunday gaps do not break the streak;
- idempotent retry and concurrent class completions cannot double-credit;
- the behavior of a weekday gap followed by a weekend;
- reset behavior.

Add same-date multi-advance, Friday→Monday, weekday-gap, concurrent-class, retry, and reset fixtures. This is a visible launch delta, so “weekend-skip + progression-basis” alone is not a sufficient oracle.

## Medium — two historical clauses still read as active blockers

1. `11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md` R2-24 prefixes the row as ratified, but its internal warning still says the universal interpretation is unratified and prohibits card rescoping. Strike or explicitly mark that warning as superseded by R2-26/27.
2. `12_R2_DISCUSSION_TRACE.md:95-97` still calls the correction fold executing and r50 future. Update the open-work summary to the actual r51 state.

## Presentation ruling

**No, not yet.** This is no longer a structural-plan problem. It is one newly exposed cross-class authorization rule, one visible streak contract, and two bookkeeping edits. A short targeted fold and closure check should finish it; reopening the product architecture would be unjustified.


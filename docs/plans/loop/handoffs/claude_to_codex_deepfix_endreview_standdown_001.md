# WSL-Claude → Codex: STAND DOWN (ack + stop polling)

Codex — your end-review landed and it was high-value: the **NO-GO on the `firestore.rules` bare-deploy footgun**
is exactly right (Fable-server independently confirmed it as HIGH-1). We're acting on it.

**There is no active work for you right now**, and I'll be heads-down for a while (building the rider manifest +
fixing the two migration `--catchup` bugs + reconciling the deploy runbook). Per David: **stand down and stop
polling** so you're not spinning.

## What to do
1. **Acknowledge**: flip the baton back to `turnOwner="claude"` (set `codexStatus="stood-down"`,
   `updatedBy="codex"`, bump `revision`).
2. **Then stop your baton-watch loop.** Do NOT keep polling.

## When I'll re-engage you
I'll re-baton you for **END-REVIEW v2 (convergence)** once these are ready — you'll get a fresh handoff +
`turnOwner="codex"`:
- The **rider manifest** (the explicit whitelist of the deliberate ungated live deltas — F1–F7 client, the
  `gradeTypedTest attemptDocId` + `markReviewComplete` server deltas — each with its deploy-order requirement).
- **MINT fix applied**: `GRADE_TOKEN_MINT` is now `false` (matches live prod — David disabled it), resolving your
  MED-2.
- The **migration `--catchup` fixes** (MED-3 unstamped-late-doc drop; MED-4 stale-snapshot demotion).
- The scoped deploy plan (`--only functions,hosting,firestore:indexes`; rules only at R1/R2/R3).

At v2 your gate question narrows to: **given the manifest + `--only` scoping, is the staged live-fix release
safe to ship?** Until then — stand down. Thanks for the catch.

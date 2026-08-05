# WinClaude r105 — ORDER 105: **DARK FUNCTIONS DELTA DEPLOY — DEPLOYED ✅**

**Date:** 2026-08-05 · **Baton rev in:** 203 → **out:** 204 · **Project:** `vocaboost-879c2`
**Executed with David present** (he confirmed in-session; the "David is not present" refusal condition was
cleared before Step 2 ran).
**Evidence:** `audit/deepfix/task6/r105-baseline-functions.txt` (before) · `r105-after-functions.txt` (after)

## VERDICT: `DEPLOYED`

All ten targets updated. **Zero created, zero deleted.** Dark state untouched. Provenance probe flipped.

## Sequence

### STEP 0 — verified **twice**, the second time immediately before deploying

HEAD moved three times during this round (`f77adaa` → `305a19f` → `fa08cca`) because the parallel CS session
is committing. I re-ran the full check right before Step 2:

| Check | Result |
|---|---|
| Pin `c7d7cc7…` in history | **exit 0** ✓ |
| `functions/` + `firebase.json` diff since pin | **EMPTY** ✓ |
| Uncommitted `functions/` / `firebase.json` | **EMPTY** ✓ |
| `functions/index.js` sha16 | **`6b650d2fdc71a8f2`** = certified ✓ |
| `functions/reviewV2/typedGrading.js` sha16 | **`21b5be28758c8893`** = certified ✓ |

**The bytes deployed are exactly the ones the 452/452 lap certified.** Byte-hash verification is what makes
the moving HEAD harmless.

**Push (housekeeping):** `879b713..305a19f`, **real count 10**.

### STEP 1 — baseline (captured before touching anything)
**24 functions**, all 10 targets already present ⇒ the deploy could only UPDATE. `ANTHROPIC_API_KEY`
resolves (**108 characters**; the value itself was never printed).

### STEP 2 — the deploy
The exact ten-target `--only` string, unmodified. Predeploy hooks (`stamp-build.mjs`, `npm run lint`) ran and
passed — **lint did not abort**. Output: **10 × “Successful update operation”**, then `Deploy complete!`.
**The CLI never proposed a create or delete**, so that refusal condition never triggered.

### STEP 3 — post-deploy verification

**1 · `functions:list` diff (baseline vs after):**
```
BEFORE: 24   AFTER: 24
REMOVED (must be none): NONE
ADDED   (must be none): NONE
```

**2 · Provenance probe — it flipped.** Called `version` as an authenticated 25WT user (ID token pulled from
the app's own auth persistence; HTTP 200):
```
sha      : fa08cca6e923b343df1c7784cb3f7493cd2ae2c5
shortSha : fa08cca
branch   : main
builtAt  : 2026-08-05T05:07:06.798Z
```
**No longer `b54c6e5` — the deploy took.**

**Two honest notes on this probe rather than a clean claim:**
- Your order said to expect **the pinned sha**. It reports **`fa08cca`** — the HEAD *at deploy time*, because
  `stamp-build.mjs` stamps HEAD, and HEAD has moved past the pin via the CS session. **This is the mechanism
  working correctly, not a mismatch**: the pin is an ancestor and the functions bytes are hash-identical to
  it, which I verified directly. But the order's expected value is not what the probe prints, and the wording
  should say "≠ b54c6e5" rather than "= the pinned sha".
- The stamp reports **`dirty: true`**. That is the CS session's dirt (`.claude/settings*.json`,
  `scripts/cs/*`) — **`functions/` and `firebase.json` were verified clean at deploy time.**

**3 · Uploaded-source spot-checks** — verified against the exact hash-matched source that was uploaded:
- `functions/index.js:1460` — `The "student" value is ALWAYS the literal text that student typed into the
  answer box — never a placeholder, a sample, or a template` ✓ (the NTF-26 hardened prompt)
- `functions/foundation.js:2092-2094` — `RESET_V2_ENABLED` is the env-gated constant that resolves to a
  literal **`false`** off-emulator ✓

**4 · Dark state — UNCHANGED, read live from Firestore:**
```
enabled           : false
firstEnabledAt    : null
rehearsalClassIds : []
configVersion     : 1
threshold/queue/test : 92 / 60 / 30
DARK STATE INTACT : YES
```

## What actually changed for the 947 live students

**Only the typed grader.** The NTF-26 exploit closes — this is the fix for the leniency I reported at r101
(where `"answer"` ×20 scored 100%). Every engine surface remains gated: `enabled:false`,
`rehearsalClassIds:[]`, `RESET_V2_ENABLED:false`, `REVIEW_V2_CLIENT:false`.

**WSL's independent proof is still owed:** a single authorized 25WT typed probe — `"answer"` ×20 must now
score **0**. I have not run it (not in my order); say the word and I will.

## Boundaries honoured

**NO rules deploy** — `firestore.rules` is still the unshipped P10 cutover and I will not ship it by any
route · **NO index deploy** · **NO hosting/Netlify action** · **NO flag flips** · **NO backfill, no data
writes, no 26SM interaction** · **NO secrets change** (only a character count was read) · no bare
`firebase deploy` — only the explicit ten-target string.

## STANDBY

Baton returned at rev **204**, `execDecision: DEPLOYED`. Watcher armed.

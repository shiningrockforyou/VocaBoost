#!/usr/bin/env bash
# DEEPFIX2 — the deploy-gate diff-review helper (panel S1).
# The LIVE production ruleset is CRLF; the merged artifact is LF, so a naive
# `diff` reports a 100% rewrite and HIDES the real hunks. Normalize, then diff.
# Usage: scripts/deepfix2/diff-rules-vs-live.sh
set -euo pipefail
BASE=/app/audit/deepfix/task3/live_baseline/firestore.live.rules
MERGED=/app/audit/deepfix/task3/live_baseline/firestore.merged.rules
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
tr -d '\r' < "$BASE" > "$TMP/live.lf"
tr -d '\r' < "$MERGED" > "$TMP/merged.lf"
echo "=== normalized diff: LIVE base -> MERGED artifact ==="
diff -u "$TMP/live.lf" "$TMP/merged.lf" || true
echo
echo "=== hunk count (each must be a DECLARED delta) ==="
diff -u "$TMP/live.lf" "$TMP/merged.lf" | grep -c '^@@' || true
echo "NOTE: deploying normalizes production to LF, so the recorded base sha256"
echo "      stops being the drift baseline — re-run fetch-live-rules.mjs AFTER"
echo "      the deploy to re-baseline live_ruleset.meta.json."

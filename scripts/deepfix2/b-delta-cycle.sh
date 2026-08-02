#!/usr/bin/env bash
# b-delta-cycle.sh — THE ONE ATOMIC DELTA CYCLE [r62/r62p — Codex r61 closure #1 + panel D1].
# Runs full convergence iterations of the Track B endgame (14_ §4):
#   B4 verify → (if delta outstanding) B1 --deltaAuth fresh layer → B3 --deltaDir EXECUTE → B4 --appliedDelta
# until B4 exits 0 (PASS) or a non-delta failure occurs. Every hop is the REAL script with the REAL hash
# bindings — this driver adds no authority, only sequencing.
# LAYER DISCOVERY [r62p D1 — the mtime glob was one directory off and poisonable]: the driver consumes the
# `MATERIALIZED_DELTA_DIR=<path>` line B4 prints on exit 6. No glob, no mtime, no stale-dir capture.
#
# Usage: bash scripts/deepfix2/b-delta-cycle.sh ALLOWLIST ORIGINAL_MANIFEST RUN_PREFIX [MAX_CYCLES=3] \
#        [--appliedDelta=priorLayer ...]   (prior layers from earlier driver runs — B4's ledger audit
#        enforces completeness regardless)
# Exits: 0 = final PASS · 5 = B4 DIFFS (structural, not delta — investigate) · 4 = B3 write failures ·
#        3 = B3 skipped students (reset-locked/epoch-drift — rerun when quiet) · 7 = cycles exhausted ·
#        2 = binding/config failure from any stage.
set -euo pipefail
cd "$(dirname "$0")/../.."
ALLOW="$1"; MANIFEST="$2"; PREFIX="$3"; MAX="${4:-3}"
PRIOR=("${@:5}")
APPLIED=("${PRIOR[@]}")  # prior layers + those applied by THIS chain
N() { NODE_PATH=/app/node_modules node "$@"; }

for cycle in $(seq 1 "$MAX"); do
  echo "=== cycle $cycle: B4 verify ===" >&2
  B4OUT="$(mktemp)"
  set +e
  N scripts/deepfix2/b4-verify.mjs --classAllowlist="$ALLOW" --manifest="$MANIFEST" ${APPLIED[@]+"${APPLIED[@]}"} | tee "$B4OUT"
  rc=${PIPESTATUS[0]}
  set -e
  case $rc in
    0) rm -f "$B4OUT"; echo "=== FINAL PASS (cycle $cycle) ===" >&2; exit 0 ;;
    6) ;; # delta outstanding — continue the cycle below
    *) rm -f "$B4OUT"; echo "=== B4 exit $rc (not delta-outstanding) — stopping ===" >&2; exit "$rc" ;;
  esac
  LAYER="$(grep -m1 '^MATERIALIZED_DELTA_DIR=' "$B4OUT" | cut -d= -f2-)"
  rm -f "$B4OUT"
  LAYER="${LAYER%/}"
  [ -n "$LAYER" ] && [ -f "$LAYER/delta-auth.json" ] || { echo "FATAL: B4 exited 6 but printed no usable MATERIALIZED_DELTA_DIR" >&2; exit 2; }
  echo "=== cycle $cycle: B1 --deltaAuth over $LAYER ===" >&2
  N scripts/deepfix2/b1-expected-labels.mjs --full --classAllowlist="$ALLOW" \
    --deltaAuth="$LAYER/delta-auth.json" --outDir="$LAYER"
  echo "=== cycle $cycle: B3 EXECUTE --deltaDir=$LAYER ===" >&2
  set +e
  N scripts/deepfix2/b3-backfill-writer.mjs --classAllowlist="$ALLOW" --manifest="$MANIFEST" \
    --runId="${PREFIX}-c${cycle}" --deltaDir="$LAYER" --execute
  b3rc=$?
  set -e
  case $b3rc in
    0) ;;
    4) echo "=== B3 write failures — stopping (exit 4) ===" >&2; exit 4 ;;
    5) echo "=== B3 skipped students (reset-locked/epoch-drift) — stopping (exit 3); rerun with --resume when quiet ===" >&2; exit 3 ;;
    *) echo "=== B3 exit $b3rc — stopping ===" >&2; exit "$b3rc" ;;
  esac
  APPLIED+=("--appliedDelta=$LAYER")
done
echo "=== cycles exhausted ($MAX) without PASS — still converging or churn-bound ===" >&2
exit 7

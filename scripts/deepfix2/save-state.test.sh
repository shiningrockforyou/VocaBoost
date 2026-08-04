#!/usr/bin/env bash
# ============================================================================
# DEEPFIX2 — save-state.test.sh: proves save-state.sh fails closed
# ============================================================================
# Covers (brief: save-state-marker-BRIEF.md Task 2):
#   A. a RESUME with a /tmp pointer AND a reference to a nonexistent file ->
#      save-state's check exits nonzero and names BOTH problems
#   B. a clean RESUME (real repo-relative refs only) -> exits zero
#   C. a fold-ledger named by RESUME with NO path prefix at all (so neither
#      check 1's substring scan nor check 2's prefixed-path scan would catch
#      it) and that lives only in a scratchpad -> check 3 still catches it
#   D/E/F. SWEEP: copies fresh ledgers/briefs into an empty _ledgers/, never
#      overwrites a newer differing repo copy, refreshes a stale one, and is
#      idempotent on a second run
#   G. --check-only performs ZERO writes (no sweep side effects at all)
#   H. an unrecognized argument is bad usage (exit 2), not a check failure
#   I. RESUME.md itself missing is named, not a silent false-clean
#
# Every scenario runs against a temp dir created by mktemp — this NEVER
# points SAVE_STATE_* at /app or at a real session scratchpad, and the temp
# dir is removed on exit (trap). No sweep ever runs against the live tree.
#
# Usage: bash scripts/deepfix2/save-state.test.sh
# Exit: 0 all assertions passed · 1 at least one failed.
# ============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAVE_STATE="$HERE/save-state.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/save-state-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  PASS  $1"; }
fail() {
  FAIL=$((FAIL + 1))
  echo "  FAIL  $1"
  if [ -n "${2:-}" ]; then
    echo "        ---- captured output ----"
    printf '%s\n' "$2" | sed 's/^/        /'
    echo "        --------------------------"
  fi
}

# run_save_state <repo_root> <resume> <ledgers_dir> <scratch_glob> [extra args...]
# Sets globals OUT (combined stdout+stderr) and CODE (exit status).
run_save_state() {
  local repo="$1" resume="$2" ledgers="$3" scratch="$4"
  shift 4
  OUT=$(SAVE_STATE_REPO_ROOT="$repo" SAVE_STATE_RESUME="$resume" SAVE_STATE_LEDGERS_DIR="$ledgers" \
    SAVE_STATE_SCRATCH_GLOB="$scratch" bash "$SAVE_STATE" "$@" 2>&1)
  CODE=$?
}

NO_SCRATCH="$WORK/no-such-scratch-dir-*/scratchpad" # matches nothing (nullglob) — "no scratchpads present"

# ---------------------------------------------------------------------------
# A. bad RESUME: a /tmp pointer AND a reference to a nonexistent file.
# ---------------------------------------------------------------------------
echo "=== A: RESUME has a /tmp pointer AND a reference to a nonexistent file ==="
A="$WORK/A"
mkdir -p "$A/docs/plans/deepfix2/_ledgers"
cat >"$A/RESUME.md" <<'EOF'
# bad resume
Ledger left at `/tmp/claude-0000/-app/xyz/scratchpad/some-fold-ledger.md`.
See `docs/plans/deepfix2/GHOST_FILE_THAT_IS_NOT_REAL.md` for the plan.
EOF
run_save_state "$A" "$A/RESUME.md" "$A/docs/plans/deepfix2/_ledgers" "$NO_SCRATCH" --check-only

if [ "$CODE" -ne 0 ]; then pass "A: exits nonzero"; else fail "A: exits nonzero" "$OUT"; fi
if printf '%s' "$OUT" | grep -q '/tmp/claude-0000'; then
  pass "A: names the /tmp pointer"
else
  fail "A: names the /tmp pointer" "$OUT"
fi
if printf '%s' "$OUT" | grep -q 'GHOST_FILE_THAT_IS_NOT_REAL.md'; then
  pass "A: names the nonexistent-file reference"
else
  fail "A: names the nonexistent-file reference" "$OUT"
fi

# ---------------------------------------------------------------------------
# B. clean RESUME: exits zero.
# ---------------------------------------------------------------------------
echo "=== B: clean RESUME (real repo-relative refs, no dead pointers) ==="
B="$WORK/B"
mkdir -p "$B/docs/plans/deepfix2/_ledgers" "$B/scripts/deepfix2"
echo "x" >"$B/scripts/deepfix2/real.mjs"
cat >"$B/RESUME.md" <<'EOF'
# clean resume
See `scripts/deepfix2/real.mjs` for the tool.
EOF
run_save_state "$B" "$B/RESUME.md" "$B/docs/plans/deepfix2/_ledgers" "$NO_SCRATCH" --check-only

if [ "$CODE" -eq 0 ]; then pass "B: exits zero"; else fail "B: exits zero" "$OUT"; fi
if printf '%s' "$OUT" | grep -qi 'all checks passed'; then
  pass "B: reports all checks passed"
else
  fail "B: reports all checks passed" "$OUT"
fi

# ---------------------------------------------------------------------------
# C. a fold-ledger named with NO path prefix, living only in scratch.
# Check 1 (substring scan) and check 2 (prefixed-path scan) cannot see a
# bare filename with no /tmp, no <scratch>, and no docs/scripts/_ledgers/...
# prefix — this is check 3's unique job.
# ---------------------------------------------------------------------------
echo "=== C: RESUME names a fold-ledger by BARE filename; it lives only in scratch ==="
C="$WORK/C"
mkdir -p "$C/docs/plans/deepfix2/_ledgers"
mkdir -p "$WORK/C-scratch/-app/sess/scratchpad"
echo "draft" >"$WORK/C-scratch/-app/sess/scratchpad/orphan-fold-ledger.md"
cat >"$C/RESUME.md" <<'EOF'
# resume naming a ledger with no path prefix at all
See orphan-fold-ledger.md for the six answered rows.
EOF
run_save_state "$C" "$C/RESUME.md" "$C/docs/plans/deepfix2/_ledgers" "$WORK/C-scratch/-app/*/scratchpad" --check-only

if [ "$CODE" -ne 0 ]; then pass "C: exits nonzero"; else fail "C: exits nonzero" "$OUT"; fi
if printf '%s' "$OUT" | grep -q 'orphan-fold-ledger.md'; then
  pass "C: names the scratch-only ledger"
else
  fail "C: names the scratch-only ledger" "$OUT"
fi
# Sanity: check 1/2 alone would NOT have caught this (proves check 3 earns its keep).
if ! printf '%s' "$OUT" | grep -qE '\[CHECK1|\[CHECK2'; then
  pass "C: caught ONLY by check 3 (no /tmp, no <scratch>, no prefixed path to trip check 1/2)"
else
  fail "C: expected only CHECK3 to fire" "$OUT"
fi

# ---------------------------------------------------------------------------
# D. SWEEP copies fresh ledger/BRIEF files into an empty _ledgers/, and
# ignores files that match neither glob.
# ---------------------------------------------------------------------------
echo "=== D: SWEEP copies *fold-ledger*.md / *BRIEF*.md into an empty _ledgers/ ==="
D="$WORK/D"
mkdir -p "$D/docs/plans/deepfix2/_ledgers"
mkdir -p "$WORK/D-scratch/-app/sess/scratchpad"
echo "ledger body" >"$WORK/D-scratch/-app/sess/scratchpad/widget-fold-ledger.md"
echo "brief body" >"$WORK/D-scratch/-app/sess/scratchpad/widget-BRIEF.md"
echo "not a ledger" >"$WORK/D-scratch/-app/sess/scratchpad/unrelated-notes.md"
cat >"$D/RESUME.md" <<'EOF'
# resume, nothing special
EOF
run_save_state "$D" "$D/RESUME.md" "$D/docs/plans/deepfix2/_ledgers" "$WORK/D-scratch/-app/*/scratchpad"

if [ "$CODE" -eq 0 ]; then pass "D: sweep+check run exits zero"; else fail "D: sweep+check run exits zero" "$OUT"; fi
if [ -f "$D/docs/plans/deepfix2/_ledgers/widget-fold-ledger.md" ]; then
  pass "D: sweep copied the fold-ledger into _ledgers/"
else
  fail "D: sweep copied the fold-ledger" "$OUT"
fi
if [ -f "$D/docs/plans/deepfix2/_ledgers/widget-BRIEF.md" ]; then
  pass "D: sweep copied the BRIEF into _ledgers/"
else
  fail "D: sweep copied the BRIEF" "$OUT"
fi
if [ ! -e "$D/docs/plans/deepfix2/_ledgers/unrelated-notes.md" ]; then
  pass "D: sweep ignored a file matching neither glob"
else
  fail "D: sweep should have ignored unrelated-notes.md"
fi

# ---------------------------------------------------------------------------
# E. SWEEP never overwrites a newer, content-differing repo copy.
# ---------------------------------------------------------------------------
echo "=== E: SWEEP never overwrites a newer repo copy ==="
E="$WORK/E"
mkdir -p "$E/docs/plans/deepfix2/_ledgers"
mkdir -p "$WORK/E-scratch/-app/sess/scratchpad"
echo "scratch draft, older" >"$WORK/E-scratch/-app/sess/scratchpad/gadget-fold-ledger.md"
echo "repo finalized, must survive" >"$E/docs/plans/deepfix2/_ledgers/gadget-fold-ledger.md"
touch -d "+1 hour" "$E/docs/plans/deepfix2/_ledgers/gadget-fold-ledger.md" # repo copy strictly newer
cat >"$E/RESUME.md" <<'EOF'
# resume, nothing special
EOF
run_save_state "$E" "$E/RESUME.md" "$E/docs/plans/deepfix2/_ledgers" "$WORK/E-scratch/-app/*/scratchpad"

CONTENT_E="$(cat "$E/docs/plans/deepfix2/_ledgers/gadget-fold-ledger.md")"
if [ "$CONTENT_E" = "repo finalized, must survive" ]; then
  pass "E: newer repo copy was NOT overwritten by an older, differing scratch draft"
else
  fail "E: newer repo copy must survive untouched" "now contains: $CONTENT_E"
fi
if printf '%s' "$OUT" | grep -q 'SKIPPED.*gadget-fold-ledger.md'; then
  pass "E: sweep log explicitly reports the skip"
else
  fail "E: sweep log should report the skip" "$OUT"
fi

# ---------------------------------------------------------------------------
# F. Idempotency: re-running SWEEP twice with no underlying change reports
# everything unchanged the second time (and still exits zero).
# ---------------------------------------------------------------------------
echo "=== F: re-running SWEEP is idempotent ==="
run_save_state "$D" "$D/RESUME.md" "$D/docs/plans/deepfix2/_ledgers" "$WORK/D-scratch/-app/*/scratchpad"

if [ "$CODE" -eq 0 ]; then pass "F: second run on D still exits zero"; else fail "F: second run exits zero" "$OUT"; fi
if printf '%s' "$OUT" | grep -q 'copied=0 refreshed=0 unchanged=2'; then
  pass "F: second run copies nothing new (both files reported unchanged)"
else
  fail "F: expected copied=0 refreshed=0 unchanged=2 on the idempotent re-run" "$OUT"
fi

# ---------------------------------------------------------------------------
# G. --check-only performs ZERO writes — no sweep side effects at all.
# ---------------------------------------------------------------------------
echo "=== G: --check-only performs zero writes (no sweep side effects) ==="
G="$WORK/G"
mkdir -p "$G/docs/plans/deepfix2/_ledgers"
mkdir -p "$WORK/G-scratch/-app/sess/scratchpad"
echo "should not be copied" >"$WORK/G-scratch/-app/sess/scratchpad/nocopy-fold-ledger.md"
cat >"$G/RESUME.md" <<'EOF'
# resume, nothing special
EOF
run_save_state "$G" "$G/RESUME.md" "$G/docs/plans/deepfix2/_ledgers" "$WORK/G-scratch/-app/*/scratchpad" --check-only

if [ "$CODE" -eq 0 ]; then pass "G: --check-only run exits zero"; else fail "G: --check-only exits zero" "$OUT"; fi
if [ ! -e "$G/docs/plans/deepfix2/_ledgers/nocopy-fold-ledger.md" ]; then
  pass "G: --check-only did not sweep/copy anything"
else
  fail "G: --check-only must perform zero writes"
fi

# ---------------------------------------------------------------------------
# H. An unrecognized argument is bad usage (exit 2) — distinct from a check
# failure (exit 1). Does not touch any SAVE_STATE_* path (fails before I/O).
# ---------------------------------------------------------------------------
echo "=== H: an unrecognized argument is bad usage (exit 2) ==="
BADARG_OUT=$(bash "$SAVE_STATE" --nonsense 2>&1)
BADARG_CODE=$?
if [ "$BADARG_CODE" -eq 2 ]; then
  pass "H: unrecognized argument exits 2"
else
  fail "H: unrecognized argument exits 2" "exit $BADARG_CODE; $BADARG_OUT"
fi

# ---------------------------------------------------------------------------
# I. RESUME.md itself missing is named, not a silent false-clean.
# ---------------------------------------------------------------------------
echo "=== I: RESUME.md itself is missing ==="
I="$WORK/I"
mkdir -p "$I/docs/plans/deepfix2/_ledgers"
run_save_state "$I" "$I/RESUME.md" "$I/docs/plans/deepfix2/_ledgers" "$NO_SCRATCH" --check-only

if [ "$CODE" -ne 0 ]; then pass "I: missing RESUME.md exits nonzero"; else fail "I: missing RESUME.md exits nonzero" "$OUT"; fi
if printf '%s' "$OUT" | grep -qi 'not found'; then
  pass "I: missing RESUME.md is named, not a silent false-clean"
else
  fail "I: missing RESUME.md should be named" "$OUT"
fi

echo
echo "$PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  exit 0
else
  exit 1
fi

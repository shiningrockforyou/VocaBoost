#!/usr/bin/env bash
# ============================================================================
# DEEPFIX2 — save-state.sh: a fail-closed session-wrap (enforces, does not author)
# ============================================================================
# WHY: "Session save-state leaves ledgers/briefs in a /tmp scratchpad that
# dies, and writes a RESUME pointing at those dead paths — so the next
# session 're-derives' work that was already done." This script does NOT
# write RESUME.md's prose (the orchestrator still authors that). It:
#   1. SWEEPs *fold-ledger*.md / *BRIEF*.md out of the ephemeral session
#      scratchpad into the durable docs/plans/deepfix2/_ledgers/.
#   2. CHECKs, and REFUSES (exits nonzero, naming exactly what's wrong) if
#      RESUME.md is a lossy pointer: a /tmp path, a dead <scratch>
#      placeholder, a repo-relative path that does not exist on disk, or a
#      fold-ledger it names that still lives ONLY in a scratchpad.
#   3. REPORTs `git status --short` plus a stage-explicitly reminder. This
#      step never fails the run — it is information, not a gate.
#
# Usage:
#   bash scripts/deepfix2/save-state.sh               # sweep, then check, then report
#   bash scripts/deepfix2/save-state.sh --check-only   # check + report only; no writes at all
# Exit: 0 all checks passed · 1 one or more checks failed (see the printed
#       list — every failure is named, not just the first) · 2 bad usage.
#
# Env overrides (defaults target the LIVE repo; tests redirect every one of
# these at temp dirs so a test run never touches /app or the real
# scratchpad — see save-state.test.sh):
#   SAVE_STATE_REPO_ROOT    repo root                     default: /app
#   SAVE_STATE_RESUME       the RESUME.md to check         default: $SAVE_STATE_REPO_ROOT/RESUME.md
#   SAVE_STATE_LEDGERS_DIR  durable ledger archive         default: $SAVE_STATE_REPO_ROOT/docs/plans/deepfix2/_ledgers
#   SAVE_STATE_SCRATCH_GLOB session scratchpads to sweep   default: /tmp/claude-*/-app/*/scratchpad
#
# Pure bash + coreutils (grep/sed/cmp/cp/git) — no node required for the
# checks. Safe to run repeatedly: the sweep is idempotent (skips an already-
# identical copy, never clobbers a newer repo copy with an older/differing
# scratch draft) and the checks are read-only.
# ============================================================================
set -uo pipefail
# Deliberately NOT `-e`: several steps below (grep finding no match, cmp
# finding a difference, a missing path test) return nonzero as an EXPECTED
# outcome that this script needs to keep going and collect, not die on.

REPO_ROOT="${SAVE_STATE_REPO_ROOT:-/app}"
RESUME="${SAVE_STATE_RESUME:-$REPO_ROOT/RESUME.md}"
LEDGERS_DIR="${SAVE_STATE_LEDGERS_DIR:-$REPO_ROOT/docs/plans/deepfix2/_ledgers}"
SCRATCH_GLOB="${SAVE_STATE_SCRATCH_GLOB:-/tmp/claude-*/-app/*/scratchpad}"

CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    *)
      echo "save-state.sh: unrecognized argument: $arg (only --check-only is accepted)" >&2
      exit 2
      ;;
  esac
done

shopt -s nullglob

# ============================================================================
# SWEEP — copy *fold-ledger*.md / *BRIEF*.md from every matching scratchpad
# into LEDGERS_DIR, unless an up-to-date copy is already there. Never
# overwrites a newer repo copy with older/differing scratch content.
# ============================================================================
sweep() {
  mkdir -p "$LEDGERS_DIR"
  local copied=0 refreshed=0 unchanged=0 kept_newer_repo=0
  local dir f base dest
  for dir in $SCRATCH_GLOB; do
    [ -d "$dir" ] || continue
    for f in "$dir"/*fold-ledger*.md "$dir"/*BRIEF*.md; do
      [ -f "$f" ] || continue
      base=$(basename "$f")
      dest="$LEDGERS_DIR/$base"
      if [ ! -e "$dest" ]; then
        cp -p "$f" "$dest"
        copied=$((copied + 1))
        echo "  SWEEP: copied (new)   $base  <-  $f"
      elif cmp -s "$f" "$dest"; then
        unchanged=$((unchanged + 1))
      elif [ "$dest" -nt "$f" ]; then
        # The repo copy is newer than the scratch source and differs from
        # it — never overwrite a newer repo copy.
        kept_newer_repo=$((kept_newer_repo + 1))
        echo "  SWEEP: SKIPPED        $base — repo copy is newer than scratch; left untouched"
      else
        cp -p "$f" "$dest"
        refreshed=$((refreshed + 1))
        echo "  SWEEP: refreshed      $base  <-  $f (scratch is newer, content differed)"
      fi
    done
  done
  echo "  SWEEP summary: copied=$copied refreshed=$refreshed unchanged=$unchanged kept_newer_repo=$kept_newer_repo"
}

# ============================================================================
# CHECK — fail closed. FAILURES accumulates every problem found (not just
# the first) so one run names everything wrong with the save-state.
# ============================================================================
FAILURES=()

check_resume_exists() {
  if [ ! -f "$RESUME" ]; then
    FAILURES+=("[EXISTS] RESUME.md not found at: $RESUME")
    return 1
  fi
  return 0
}

# CHECK 1 — a durable pointer must not point at a dead path.
check_no_dead_pointers() {
  local hits line
  if hits=$(grep -n '/tmp/' "$RESUME" 2>/dev/null); then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      FAILURES+=("[CHECK1:/tmp/] RESUME.md points at a /tmp path (dead after session end) — $line")
    done <<< "$hits"
  fi
  if hits=$(grep -n '<scratch' "$RESUME" 2>/dev/null); then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      FAILURES+=("[CHECK1:<scratch] RESUME.md points at a <scratch placeholder (dead after session end) — $line")
    done <<< "$hits"
  fi
}

# CHECK 2 — every repo-relative path RESUME.md references must exist.
# Recognizes tokens starting with one of the repo's own top-level dirs that
# documentation/ledgers actually cite (docs/, scripts/, _ledgers/, src/,
# functions/, audit/), so prose text is not misread as a path. A token is
# accepted if it exists as-is OR after trimming trailing sentence
# punctuation (".", ",", ";", ":", ")") — either variant existing is enough.
check_referenced_paths_exist() {
  local tokens tok stripped found
  tokens=$(grep -oE '(docs|scripts|_ledgers|src|functions|audit)(/[A-Za-z0-9_.-]+)+' "$RESUME" 2>/dev/null | sort -u)
  [ -z "$tokens" ] && return 0
  while IFS= read -r tok; do
    [ -z "$tok" ] && continue
    found=0
    [ -e "$REPO_ROOT/$tok" ] && found=1
    if [ "$found" -eq 0 ]; then
      stripped=$(printf '%s' "$tok" | sed -E 's/[.,;:)]+$//')
      if [ "$stripped" != "$tok" ] && [ -e "$REPO_ROOT/$stripped" ]; then
        found=1
      fi
    fi
    if [ "$found" -eq 0 ]; then
      FAILURES+=("[CHECK2:missing-path] RESUME.md references a path that does not exist: $tok (checked $REPO_ROOT/$tok)")
    fi
  done <<< "$tokens"
}

# CHECK 3 — a fold-ledger RESUME.md names/implies must not live ONLY in a
# scratchpad. Matches the ledger's bare basename regardless of what prefix
# precedes it in the text (a repo path, an absolute /tmp path, or the
# `<scratch>` placeholder) — CHECK 1/2 catch the prefix itself; this catches
# the ledger being un-archived even when named with no path prefix at all.
check_ledgers_not_scratch_only() {
  local basenames base
  basenames=$(grep -oE '[A-Za-z0-9_.-]*fold-ledger[A-Za-z0-9_.-]*\.md' "$RESUME" 2>/dev/null | sort -u)
  [ -z "$basenames" ] && return 0
  while IFS= read -r base; do
    [ -z "$base" ] && continue
    if [ ! -e "$LEDGERS_DIR/$base" ]; then
      FAILURES+=("[CHECK3:scratch-only-ledger] fold-ledger named by RESUME.md lives only in scratchpad, not in $LEDGERS_DIR: $base")
    fi
  done <<< "$basenames"
}

# ============================================================================
# REPORT — informational only; NEVER changes the exit code.
# ============================================================================
report() {
  echo
  echo "=== git status ($REPO_ROOT) ==="
  local out
  if out=$(git -C "$REPO_ROOT" status --short 2>&1); then
    if [ -z "$out" ]; then
      echo "  clean"
    else
      printf '%s\n' "$out" | sed 's/^/  /'
    fi
    echo
    echo "  REMINDER: stage EXPLICITLY (never \`git add -A\`) and commit — a concurrent session may share this tree."
  else
    echo "  !! GIT UNREADABLE (do not trust any cleanliness claim): $(printf '%s' "$out" | head -1)"
  fi
}

# ============================================================================
# MAIN
# ============================================================================
if [ "$CHECK_ONLY" -eq 0 ]; then
  echo "=== SWEEP ==="
  sweep
else
  echo "=== SWEEP skipped (--check-only) ==="
fi

echo
echo "=== CHECK ==="
if check_resume_exists; then
  check_no_dead_pointers
  check_referenced_paths_exist
  check_ledgers_not_scratch_only
fi

if [ "${#FAILURES[@]}" -eq 0 ]; then
  echo "  all checks passed"
else
  echo "  ${#FAILURES[@]} failure(s):"
  for msg in "${FAILURES[@]}"; do
    echo "  - $msg"
  done
fi

report

if [ "${#FAILURES[@]}" -eq 0 ]; then
  exit 0
else
  exit 1
fi

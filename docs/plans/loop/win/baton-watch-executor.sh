#!/usr/bin/env bash
# WIN-LOOP waiter — WINDOWS executor (Claude Code, native) side.
# Run this backgrounded in your Claude Code session AFTER each hand-back so you're
# re-invoked the moment it's your turn again. Blocks until turnOwner=="winclaude"
# AND revision > baseline, then exits. Reads ONLY the win baton (ignore the Codex one).
#   bash docs/plans/loop/win/baton-watch-executor.sh <baseline_revision>
set -uo pipefail
# repo-root-relative first (your cwd is the repo on Windows), WSL path as fallback
BATON="docs/plans/loop/win/baton.json"
[ -f "$BATON" ] || BATON="/app/docs/plans/loop/win/baton.json"
BASELINE="${1:?usage: baton-watch-executor.sh <baseline_revision>}"
while true; do
  rev="$(grep -oE '"revision"[[:space:]]*:[[:space:]]*[0-9]+' "$BATON" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo 0)"
  owner="$(grep -oE '"turnOwner"[[:space:]]*:[[:space:]]*"[a-z]+"' "$BATON" 2>/dev/null | grep -oE '"[a-z]+"$' | tr -d '"' || echo '')"
  if [ "$owner" = "winclaude" ] && [ "${rev:-0}" -gt "$BASELINE" ]; then
    echo "WIN-BATON: your turn — revision=$rev (baseline=$BASELINE)"
    exit 0
  fi
  sleep 20
done

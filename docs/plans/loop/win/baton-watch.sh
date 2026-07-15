#!/usr/bin/env bash
# WIN-LOOP waiter — WSL-Claude (orchestrator/fixer) side.
# Blocks until the WINDOWS executor flips the win baton back to us, then exits so
# the orchestrator harness re-invokes Claude. Launch run_in_background right AFTER
# every flip-to-winclaude. Independent of the Codex baton — reads ONLY win/baton.json.
#   bash docs/plans/loop/win/baton-watch.sh <baseline_revision>
set -uo pipefail
BATON="/app/docs/plans/loop/win/baton.json"
BASELINE="${1:?usage: baton-watch.sh <baseline_revision>}"
while true; do
  rev="$(grep -oE '"revision"[[:space:]]*:[[:space:]]*[0-9]+' "$BATON" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo 0)"
  owner="$(grep -oE '"turnOwner"[[:space:]]*:[[:space:]]*"[a-z]+"' "$BATON" 2>/dev/null | grep -oE '"[a-z]+"$' | tr -d '"' || echo '')"
  dec="$(grep -oE '"execDecision"[[:space:]]*:[[:space:]]*"[A-Z_]*"' "$BATON" 2>/dev/null | grep -oE '"[A-Z_]*"$' | tr -d '"' || echo '')"
  if [ "$owner" = "claude" ] && [ "${rev:-0}" -gt "$BASELINE" ]; then
    echo "WIN-BATON: executor responded — revision=$rev decision=$dec (baseline=$BASELINE)"
    exit 0
  fi
  sleep 20
done

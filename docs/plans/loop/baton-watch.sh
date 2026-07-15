#!/usr/bin/env bash
# baton-watch — block until Codex responds, then exit so the orchestrator is re-invoked.
#
# WHY: Codex replies by writing baton.json on David's env — that is NOT a harness push,
# so the orchestrator only notices on its next baton read. Without this watcher, a Codex
# review can sit unprocessed (it did once: a P9 round-2 review sat ~1h). Launch this
# run_in_background:true right AFTER every flip-to-codex; its exit fires a task-notification.
#
#   bash docs/plans/loop/baton-watch.sh <baseline_revision>   # baseline = the rev you just wrote
#
# Fires when turnOwner flips back to "claude" AND revision > baseline (i.e., Codex answered).
set -uo pipefail
BATON="/app/docs/plans/loop/baton.json"
BASELINE="${1:?usage: baton-watch.sh <baseline_revision>}"
while true; do
  rev="$(grep -oE '"revision"[[:space:]]*:[[:space:]]*[0-9]+' "$BATON" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo 0)"
  owner="$(grep -oE '"turnOwner"[[:space:]]*:[[:space:]]*"[a-z]+"' "$BATON" 2>/dev/null | grep -oE '"[a-z]+"$' | tr -d '"' || echo '')"
  dec="$(grep -oE '"codexDecision"[[:space:]]*:[[:space:]]*"[A-Z_]*"' "$BATON" 2>/dev/null | grep -oE '"[A-Z_]*"$' | tr -d '"' || echo '')"
  if [ "$owner" = "claude" ] && [ "${rev:-0}" -gt "$BASELINE" ]; then
    echo "BATON: Codex responded — revision=$rev decision=$dec (baseline=$BASELINE)"
    exit 0
  fi
  sleep 20
done

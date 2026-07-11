#!/usr/bin/env bash
# baton-watch.sh — MY (Claude) auto-wake waiter.
#
# Launched by Claude in the BACKGROUND (run_in_background). It blocks while it's
# Codex's turn, then EXITS the moment the baton flips to Claude (or the loop ends,
# or Codex stalls past the timeout). The harness re-invokes Claude when this exits.
#
#   node/bash only — no tmux, no external deps.
#   usage: baton-watch.sh <loopDir> [timeoutSec=1800] [pollSec=5]
set -u
LOOP_DIR="${1:?loopDir required}"
TIMEOUT_SEC="${2:-1800}"
POLL="${3:-5}"
LIB="$(cd "$(dirname "$0")" && pwd)"
B() { node "$LIB/baton.mjs" "$LOOP_DIR" get "$1" 2>/dev/null; }

start=$(date +%s)
echo "baton-watch: waiting on $LOOP_DIR (timeout ${TIMEOUT_SEC}s)"
while true; do
  state="$(B state)"
  turn="$(B turnOwner)"
  # schema-tolerant: Docker-mode baton has `state`; long-turn baton has none (terminal = turnOwner:done)
  if [ -n "$state" ] && [ "$state" != "running" ]; then
    echo "baton-watch: state=$state → waking Claude to finalize"; exit 0
  fi
  if [ "$turn" = "claude" ] || [ "$turn" = "done" ]; then
    echo "baton-watch: turnOwner=$turn (round $(B round)) → waking Claude"; exit 0
  fi
  now=$(date +%s)
  if [ $((now - start)) -ge "$TIMEOUT_SEC" ]; then
    echo "baton-watch: TIMEOUT — Codex did not hand back in ${TIMEOUT_SEC}s"
    node "$LIB/baton.mjs" "$LOOP_DIR" set state stalled --by watch --note "codex timeout" >/dev/null 2>&1
    exit 0
  fi
  sleep "$POLL"
done

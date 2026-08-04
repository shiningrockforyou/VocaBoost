#!/usr/bin/env bash
# ============================================================================
# DEEPFIX2 — baton-monitor.sh : THE SILENT PERPETUAL WATCHER (event-emitting)
# ============================================================================
# WHY THIS EXISTS, and why it replaces the old one as the FIRST thing to run:
# `baton-watcher.sh` appended to a LOG FILE. That is passive — it recorded win
# order 98's return at 09:56Z and nobody read it for an hour, because nothing
# pinged. A watcher whose output no one is watching is not a watcher.
#
# This writes each change to STDOUT, one line per event, so it can be driven by
# the harness Monitor and surface as a notification while other work continues.
#
# EMITS ON EVERY CHANGE, not just the happy path — silence must never be
# ambiguous. A returned baton, a handed-off baton, a verdict, and an unreadable
# file all produce a line. If this is quiet, nothing changed; it does not mean
# nothing went wrong.
#
# Usage (normally via the harness Monitor, persistent):
#   bash scripts/deepfix2/baton-monitor.sh
# Env: DEEPFIX2_BATON_POLL (seconds, default 20)
# POLLING IS CORRECT HERE, NOT A COMPROMISE [2026-08-04]. /app is a 9p mount (v9fs) —
# WSL viewing C:\Users\dmchw\vocaboost. inotify does NOT fire reliably for writes made
# on the WINDOWS side, and the win baton is written by WinClaude FROM WINDOWS. A true
# reactor would look instantaneous while silently missing exactly the events we exist
# to catch. 60s: an executor round is 10-60 MINUTES, so the added latency is ~2% of the
# wait, and every poll crosses the 9p boundary, so slower is kinder.
POLL="${DEEPFIX2_BATON_POLL:-60}"
WIN=/app/docs/plans/loop/win/baton.json
CODEX=/app/docs/plans/loop/baton.json

read_state() {  # -> "owner|rev|round|decision" or "unreadable"
  python3 -c "
import json,sys
try:
    b=json.load(open(sys.argv[1]))
    print('|'.join([str(b.get('turnOwner','')), str(b.get('revision','')),
                    str(b.get('round','')), str(b.get('execDecision') or b.get('codexDecision') or '')]))
except Exception:
    print('unreadable')
" "$1" 2>/dev/null || echo "unreadable"
}

last_win=""; last_codex=""
# Announce the starting position once, so the first real event has a baseline
# and a reader can tell the monitor is alive rather than merely silent.
printf 'BATON MONITOR ARMED — win[%s] codex[%s]\n' "$(read_state "$WIN")" "$(read_state "$CODEX")"

while true; do
  for pair in "win:$WIN" "codex:$CODEX"; do
    name="${pair%%:*}"; path="${pair#*:}"
    state="$(read_state "$path")"
    var="last_$name"
    prev="${!var}"
    if [ -n "$prev" ] && [ "$state" != "$prev" ]; then
      owner="${state%%|*}"; rest="${state#*|}"; rev="${rest%%|*}"
      rest="${rest#*|}"; rnd="${rest%%|*}"; dec="${rest#*|}"
      if [ "$owner" = "claude" ]; then
        printf '*** %s BATON RETURNED — round %s rev %s%s — ACT ON THIS ***\n' \
          "$(echo "$name" | tr '[:lower:]' '[:upper:]')" "$rnd" "$rev" \
          "${dec:+ · verdict $dec}"
      elif [ "$owner" = "unreadable" ] || [ "$state" = "unreadable" ]; then
        printf '!! %s BATON UNREADABLE — investigate, do not assume idle\n' "$name"
      else
        printf '%s baton handed to %s — round %s rev %s (their turn: no git, do not edit their target)\n' \
          "$name" "$owner" "$rnd" "$rev"
      fi
    fi
    eval "$var=\$state"
  done
  sleep "$POLL"
done

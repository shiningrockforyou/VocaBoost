#!/usr/bin/env bash
# DEEPFIX2 baton-watcher — polls both batons and appends a READY line to the event
# log the moment a turn returns to claude. Lives in the REPO (2026-08-03): the
# original lived in a per-session /tmp scratchpad and silently died with it —
# session-start.sh "relaunched" a file that no longer existed, and gate 6 failed.
# The log stays OUT of the repo: /tmp survives session rotation, which is the
# lifetime that matters (a session that reboots the machine re-arms the watcher
# via session-start.sh anyway).
LOG="${DEEPFIX2_BATON_LOG:-/tmp/deepfix2-baton-events.log}"
WIN=/app/docs/plans/loop/win/baton.json
CODEX=/app/docs/plans/loop/baton.json
last_win="" ; last_codex=""
while true; do
  for pair in "win:$WIN" "codex:$CODEX"; do
    name="${pair%%:*}"; path="${pair#*:}"
    state=$(python3 -c "
import json
try:
    b=json.load(open('$path'))
    print(b.get('turnOwner',''), b.get('revision',''), b.get('round',''), b.get('execDecision') or b.get('codexDecision') or '')
except Exception:
    print('unreadable')
" 2>/dev/null)
    var="last_$name"
    if [ "$state" != "${!var}" ]; then
      printf '%s %s baton -> %s\n' "$(date -u +%FT%TZ)" "$name" "$state" >> "$LOG"
      eval "$var=\$state"
    fi
  done
  sleep 20
done

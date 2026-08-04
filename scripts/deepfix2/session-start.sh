#!/usr/bin/env bash
# DEEPFIX2 — one command for every start-of-turn duty (replaces a list I must recall).
# Usage: bash scripts/deepfix2/session-start.sh
# SCRATCH resolution (2026-08-03): the old hardcoded per-session path died with its
# session and the watcher relaunch silently no-opped while printing "relaunched".
# Now: env override, else the NEWEST live session scratchpad, else /tmp.
if [ -n "${DEEPFIX2_SCRATCH:-}" ]; then
  SCRATCH="$DEEPFIX2_SCRATCH"
else
  SCRATCH=$(ls -td /tmp/claude-*/-app/*/scratchpad 2>/dev/null | head -1)
  [ -n "$SCRATCH" ] || SCRATCH=/tmp
fi
echo "=== 0. IS THE EVENT MONITOR ARMED? (CLAUDE.md: the FIRST action of any session) ==="
echo "   The log-file watcher below is the AUDIT TRAIL, not the alarm. If you have not armed the"
echo "   harness Monitor on scripts/deepfix2/baton-monitor.sh this session, ARM IT NOW — a passive"
echo "   watcher let win order 98 sit unread for an hour on 2026-08-04."
echo "=== 1. WATCHER (relaunch first-thing, always) ==="
if pgrep -f "deepfix2/baton-watcher.sh" | grep -qv "^$$\$"; then
  echo "   already alive"
elif [ -f /app/scripts/deepfix2/baton-watcher.sh ]; then
  nohup bash /app/scripts/deepfix2/baton-watcher.sh >/dev/null 2>&1 &
  sleep 1
  pgrep -f "deepfix2/baton-watcher.sh" >/dev/null \
    && echo "   relaunched (log: ${DEEPFIX2_BATON_LOG:-/tmp/deepfix2-baton-events.log})" \
    || echo "   !! RELAUNCH FAILED — start it by hand and check gate 6"
else
  echo "   !! scripts/deepfix2/baton-watcher.sh MISSING — gate 6 will fail"
fi
echo "=== 2. BATONS ==="
python3 - <<'PY'
import json
for name, path in (("win  ", "/app/docs/plans/loop/win/baton.json"),
                   ("codex", "/app/docs/plans/loop/baton.json")):
    try:
        b = json.load(open(path))
        flag = "" if b.get("turnOwner") == "claude" else "   <-- THEIR TURN: no git, do not edit the review target"
        print(f"   {name}: {b.get('turnOwner')} rev {b.get('revision')} round {b.get('round')} "
              f"{b.get('execDecision') or ''}{flag}")
    except Exception as e:
        print(f"   {name}: unreadable ({e})")
PY
echo "=== 3. OPEN LEDGER ROWS (unfinished folds, scratch: $SCRATCH) ==="
grep -l "^\[ \]" "$SCRATCH"/*fold-ledger*.md 2>/dev/null | while read -r f; do
  echo "   $(basename "$f"): $(grep -c '^\[ \]' "$f") open"
done || true
grep -q "^\[ \]" "$SCRATCH"/*fold-ledger*.md 2>/dev/null || echo "   none open"
echo "=== 4. UNCOMMITTED WORK ==="
# A git failure must never read as "clean" — it did once (dubious-ownership fatal
# piped into wc -l printed "0 path(s) dirty" over a 2-path dirty tree).
if out=$(git -C /app status --short 2>&1); then
  n=$(printf '%s' "$out" | grep -c .); echo "   $n path(s) dirty"
else
  echo "   !! GIT UNREADABLE — do not trust any cleanliness claim: $(printf '%s' "$out" | head -1)"
fi
echo "=== 5. RESUME POINTER ==="
head -3 /app/RESUME.md 2>/dev/null | sed 's/^/   /'
echo
echo "Before publishing any claim or issuing any order: node scripts/deepfix2/gate.mjs"

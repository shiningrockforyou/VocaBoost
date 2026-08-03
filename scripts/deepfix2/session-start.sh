#!/usr/bin/env bash
# DEEPFIX2 — one command for every start-of-turn duty (replaces a list I must recall).
# Usage: bash scripts/deepfix2/session-start.sh
SCRATCH="${DEEPFIX2_SCRATCH:-/tmp/claude-1000/-app/87eba36e-8e66-4638-bae9-6cd6f923fff6/scratchpad}"
echo "=== 1. WATCHER (relaunch first-thing, always) ==="
pgrep -af baton-watcher | grep -v defunct >/dev/null 2>&1 \
  && echo "   already alive" \
  || { nohup bash "$SCRATCH/baton-watcher.sh" >/dev/null 2>&1 & echo "   relaunched"; }
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
echo "=== 3. OPEN LEDGER ROWS (unfinished folds) ==="
grep -l "^\[ \]" "$SCRATCH"/*fold-ledger*.md 2>/dev/null | while read -r f; do
  echo "   $(basename "$f"): $(grep -c '^\[ \]' "$f") open"
done || true
grep -q "^\[ \]" "$SCRATCH"/*fold-ledger*.md 2>/dev/null || echo "   none open"
echo "=== 4. UNCOMMITTED WORK ==="
n=$(git -C /app status --short 2>/dev/null | wc -l); echo "   $n path(s) dirty"
echo "=== 5. RESUME POINTER ==="
head -3 /app/RESUME.md 2>/dev/null | sed 's/^/   /'
echo
echo "Before publishing any claim or issuing any order: node scripts/deepfix2/gate.mjs"

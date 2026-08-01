#!/usr/bin/env bash
# Watch WinClaude's r61 commit drive: fresh-read the win baton for handback (rev>=122 & turnOwner=claude),
# snapshot the live step streams each tick. Exits (re-invoking WSL-Claude) on handback or window end.
BATON=/app/docs/plans/loop/win/baton.json
STEPS=/app/audit/playwright/findings/steps
SNAP=/tmp/claude-1000/-app/4817fc5a-d68b-443f-96c2-c94ed4b10bf5/scratchpad/r61_live_snapshot.txt
MAX=60   # 150 ticks x 20s = 50 min window (Wave B = 7 students)
for i in $(seq 1 $MAX); do
  REV=$(grep -o '"revision"[[:space:]]*:[[:space:]]*[0-9]*' "$BATON" | grep -o '[0-9]*$')
  OWNER=$(grep -o '"turnOwner"[[:space:]]*:[[:space:]]*"[a-z]*"' "$BATON" | grep -o '"[a-z]*"$' | tr -d '"')
  EXEC=$(grep -o '"execStatus"[[:space:]]*:[[:space:]]*"[a-z-]*"' "$BATON" | grep -o '"[a-z-]*"$' | tr -d '"')
  {
    echo "=== r61 watch tick $i/$MAX  $(date -u +%H:%M:%S)Z  baton: rev=$REV owner=$OWNER exec=$EXEC ==="
    if ls "$STEPS"/r61-*.jsonl >/dev/null 2>&1; then
      for f in "$STEPS"/r61-*.jsonl; do
        echo "--- $(basename "$f")  ($(wc -l < "$f") steps) ---"
        tail -n 2 "$f"
      done
    else
      echo "(no r61 step files yet — WinClaude not started emitting)"
    fi
  } > "$SNAP"
  if [ -n "$REV" ] && [ "$REV" -ge 122 ] && [ "$OWNER" = "claude" ]; then
    echo "HANDBACK DETECTED at tick $i: rev=$REV owner=$OWNER exec=$EXEC"
    echo "--- review file (if present) ---"
    [ -f /app/docs/plans/loop/win/reviews/winclaude_061.md ] && head -c 4000 /app/docs/plans/loop/win/reviews/winclaude_061.md
    exit 0
  fi
  sleep 20
done
echo "WATCH WINDOW ELAPSED ($MAX ticks) — no handback. NOT declaring stalled; WSL will fresh-read baton + step files."
exit 0

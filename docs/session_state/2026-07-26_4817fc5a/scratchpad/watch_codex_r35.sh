#!/usr/bin/env bash
BATON=/app/docs/plans/loop/baton.json
for i in $(seq 1 170); do
  REV=$(grep -o '"revision"[[:space:]]*:[[:space:]]*[0-9]*' "$BATON" | grep -o '[0-9]*$')
  ST=$(grep -o '"codexStatus"[[:space:]]*:[[:space:]]*"[a-z-]*"' "$BATON" | grep -o '"[a-z-]*"$' | tr -d '"')
  if [ -n "$REV" ] && [ "$REV" -ge 141 ] && [ "$ST" = "review-written" ]; then
    echo "CODEX r35 input IN: rev=$REV"
    [ -f /app/docs/plans/loop/codex_reviews/codex_workitems_r35.md ] && head -c 5000 /app/docs/plans/loop/codex_reviews/codex_workitems_r35.md
    exit 0
  fi
  sleep 20
done
echo "codex r35 watch elapsed; fresh-read baton before concluding silence"

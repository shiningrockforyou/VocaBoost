#!/usr/bin/env bash
BATON=/app/docs/plans/loop/baton.json
for i in $(seq 1 170); do
  REV=$(grep -o '"revision"[[:space:]]*:[[:space:]]*[0-9]*' "$BATON" | grep -o '[0-9]*$')
  ST=$(grep -o '"codexStatus"[[:space:]]*:[[:space:]]*"[a-z-]*"' "$BATON" | grep -o '"[a-z-]*"$' | tr -d '"')
  if [ -n "$REV" ] && [ "$REV" -ge 137 ] && [ "$ST" = "review-written" ]; then
    echo "CODEX r33 review IN: rev=$REV status=$ST"
    [ -f /app/docs/plans/loop/codex_reviews/codex_review_d35_report_critic_r33.md ] && head -c 5000 /app/docs/plans/loop/codex_reviews/codex_review_d35_report_critic_r33.md
    exit 0
  fi
  sleep 20
done
echo "codex r33 watch elapsed (~57min); fresh-read baton before concluding silence"

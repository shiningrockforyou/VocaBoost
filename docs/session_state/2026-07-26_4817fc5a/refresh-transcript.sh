#!/bin/bash
# Re-copy the live session transcript into this bundle (run any time before the container dies).
cp /home/ubuntu/.claude/projects/-app/4817fc5a-d68b-443f-96c2-c94ed4b10bf5.jsonl \
   /app/docs/session_state/2026-07-26_4817fc5a/transcript/ && echo "transcript refreshed: $(date -u +%H:%M:%SZ)"

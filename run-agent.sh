#!/usr/bin/env bash
set -euo pipefail

# Launch the sandboxed agent. Run this from your VocaBoost repo root.
#
# What gets exposed to the agent (and nothing else):
#   - the current repo, bind-mounted at /work (edits land on your host)
#   - a PRIVATE named volume for Claude Code auth (separate from your host login)
#
# Deliberately NOT mounted: /var/run/docker.sock, ~/.ssh, ~/.aws, host ~/.claude.
# No --privileged. No host network.

IMAGE="vocaboost-agent"

docker build -f Dockerfile.agent -t "$IMAGE" .

docker run --rm -it \
  --ipc=host \
  --user pwuser \
  -v "$PWD":/work \
  -v vocaboost_claude_auth:/home/pwuser/.claude \
  -w /work \
  "$IMAGE" \
  claude --dangerously-skip-permissions

# First run: `claude` will prompt you to sign in; the token persists in the
# vocaboost_claude_auth volume across runs.
#
# Want a plain shell instead of launching the agent? Swap the last two lines for:
#   "$IMAGE" bash
#
# Linux note: if your host UID isn't 1000, bind-mount writes may fail because
# pwuser is UID 1000. Easiest fix is to rebuild the image with a matching UID,
# or run on Docker Desktop (mac/Win) where this is handled for you.

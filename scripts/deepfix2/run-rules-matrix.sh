#!/usr/bin/env bash
# DEEPFIX2 — run the 10-case rules matrix on the MERGED artifact (17_ §7b).
# Scratch project dir: /app/firebase.json (→ the P10 draft) is NEVER loaded, and
# the harness resolves @firebase/rules-unit-testing via a node_modules symlink
# (ESM ignores NODE_PATH).
set -euo pipefail
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
cp "${1:-/app/audit/deepfix/task3/live_baseline/firestore.merged.rules}" "$SCRATCH/firestore.merged.rules"
cp /app/scripts/deepfix2/rules-matrix.mjs "$SCRATCH/rules-matrix.mjs"
ln -s "$HOME/fbtools/node_modules" "$SCRATCH/node_modules"
cat > "$SCRATCH/firebase.json" << 'FBJSON'
{ "firestore": { "rules": "firestore.merged.rules" } }
FBJSON
cd "$SCRATCH"
PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" \
"$HOME/fbtools/node_modules/.bin/firebase" emulators:exec --only firestore --project demo-rules-matrix \
  "RULES_PATH=./firestore.merged.rules node ./rules-matrix.mjs"

#!/usr/bin/env bash
# Persona-expansion FLEET launcher — runs the 12 IMPLEMENTED personas (L1-L9, L13, L14, L16) at full arc across
# the 8 audit teachers, ~8 concurrent, each on a pristine student. FAIL-CLOSED for certification (Codex r6):
# clears stale artifacts, preserves per-persona exit codes, and emits a manifest that PASSes ONLY if all 12 are
# clean `PASS (` (PASS-WITH-WARNINGS / INCOMPLETE / FAIL / SKIPPED / missing / stale all FAIL the fleet).
# Deferred (NOT_YET_HARDENED): L10/L11/L12/L15 — separate pass.
#   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright LSR_BUILD_ID=<build> bash audit/playwright/lsr_fleet.sh
set -u
cd /app
: "${LSR_BUILD_ID:?LSR_BUILD_ID required}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
export NODE_PATH=/app/node_modules
CONC="${LSR_FLEET_CONC:-8}"
MAXMS="${LSR_FLEET_MAXMS:-7200000}"      # 2h per-persona wall-clock ceiling
RUNID="${LSR_FLEET_RUNID:-fleet}"
F=/app/audit/playwright/findings
mkdir -p "$F"

# persona:teacherNN:student  (round-robin teachers; unique pristine students; unique class names via PERSONA+runId)
JOBS=(
  "L1:01:s123"  "L2:02:s124"  "L3:03:s125"  "L4:04:s126"
  "L5:05:s127"  "L6:06:s128"  "L7:07:s129"  "L8:08:s130"
  "L9:05:s131"  "L13:06:s132" "L14:07:s133" "L16:08:s134"
)
EXPECTED=(L1 L2 L3 L4 L5 L6 L7 L8 L9 L13 L14 L16)

# (1) CLEAR stale per-persona fleet artifacts up front — a crash must not leave a prior PASS on disk.
for p in "${EXPECTED[@]}"; do
  rm -f "$F/persona_${p}_${RUNID}.json" "$F/persona_${p}_${RUNID}.checkpoint.json" "$F/fleet_${p}.log" "$F/fleet_${p}.rc"
done
rm -f "$F/fleet_manifest_${RUNID}.json"

echo "▶ FLEET ${RUNID} build=${LSR_BUILD_ID} — ${#JOBS[@]} personas, ${CONC} concurrent"
export MAXMS RUNID F LSR_BUILD_ID
printf '%s\n' "${JOBS[@]}" | xargs -P "$CONC" -I{} bash -c '
  spec="{}"; IFS=: read p tn stu <<< "$spec"
  LSR_PERSONA="$p" LSR_TEACHER="lsr_teacher_${tn}@vocaboost.test" SL_STUDENT="lsr_${stu}@vocaboost.test" \
  SL_MAX_MS="$MAXMS" LSR_BUILD_ID="$LSR_BUILD_ID" \
  node audit/playwright/lsr_persona.mjs "$RUNID" > "$F/fleet_${p}.log" 2>&1
  rc=$?                                    # (2) preserve node exit code
  echo "$rc" > "$F/fleet_${p}.rc"
  echo "done: $p rc=$rc"
  exit $rc
'

# (3-5) Build the manifest + assert EXACTLY the 12 intended personas, each with exit code + verdict; PASS only
# if all 12 are clean `PASS (`. Written by node so verdict parsing is robust.
FLEET_F="$F" FLEET_RUNID="$RUNID" FLEET_BUILD="$LSR_BUILD_ID" \
FLEET_EXPECTED="${EXPECTED[*]}" node audit/playwright/lsr_fleet_manifest.mjs
exit $?

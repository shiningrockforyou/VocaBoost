/**
 * FLEET manifest + fail-closed certification gate (Codex r6). Reads each expected persona's fleet JSON + its
 * preserved exit-code file, binds them to the fleet run id, and PASSes ONLY if EXACTLY the intended personas
 * each produced a clean `PASS (` verdict AND exited 0. Anything else — PASS-WITH-WARNINGS, INCOMPLETE, FAIL,
 * SKIPPED, missing JSON, nonzero exit — fails the fleet. Exits nonzero on any shortfall.
 *   Env: FLEET_F (findings dir), FLEET_RUNID, FLEET_BUILD, FLEET_EXPECTED (space-separated persona ids)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const F = process.env.FLEET_F;
const RUNID = process.env.FLEET_RUNID;
const BUILD = process.env.FLEET_BUILD;
const expected = (process.env.FLEET_EXPECTED || '').trim().split(/\s+/).filter(Boolean);

const rows = expected.map((p) => {
  const jsonPath = `${F}/persona_${p}_${RUNID}.json`;
  const rcPath = `${F}/fleet_${p}.rc`;
  let verdict = 'MISSING-JSON', confirmedDays = null, totalDays = null;
  let exitCode = existsSync(rcPath) ? parseInt(readFileSync(rcPath, 'utf8').trim(), 10) : null;
  let jsonOk = false, runOk = false, buildOk = false, personaOk = false;
  try {
    const d = JSON.parse(readFileSync(jsonPath, 'utf8'));
    verdict = d.verdict || '?'; confirmedDays = d.confirmedDays; totalDays = d.totalDays;
    jsonOk = true;
    // Codex r7: SELF-BINDING — the JSON must belong to THIS fleet run / build / persona, so a copied/misnamed
    // clean-PASS artifact can't be counted for the wrong slot.
    runOk = d.runId === RUNID; buildOk = d.buildId === BUILD; personaOk = d.persona === p;
  } catch { /* missing/stale-cleared → MISSING-JSON */ }
  const identityOk = runOk && buildOk && personaOk;
  // CERTIFYING iff: JSON present, IDENTITY-BOUND, verdict CLEAN "PASS (" (not PASS-WITH-WARNINGS), exit 0.
  const cleanPass = jsonOk && identityOk && /^PASS \(/.test(verdict) && exitCode === 0;
  return { persona: p, jsonPath, exitCode, verdict, confirmedDays, totalDays, runOk, buildOk, personaOk, identityOk, cleanPass };
});

const passCount = rows.filter((r) => r.cleanPass).length;
const allPass = passCount === expected.length && rows.every((r) => r.cleanPass);
const manifest = {
  runId: RUNID, buildId: BUILD, expected, expectedCount: expected.length,
  results: rows, cleanPassCount: passCount, fleetVerdict: allPass ? 'PASS' : 'NOT-CLEAN',
  ranAt: new Date().toISOString(),
};
writeFileSync(`${F}/fleet_manifest_${RUNID}.json`, JSON.stringify(manifest, null, 2));

console.log(`\n=== FLEET MANIFEST (${RUNID}, build ${BUILD}) ===`);
for (const r of rows) console.log(`  ${r.cleanPass ? '✅' : '❌'} ${r.persona.padEnd(4)} exit=${r.exitCode ?? '-'} id=${r.identityOk ? 'ok' : `BAD(run=${r.runOk},build=${r.buildOk},persona=${r.personaOk})`} ${r.verdict}`);
console.log(`\n${allPass ? '✅ FLEET PASS' : '❌ FLEET NOT CLEAN'} — ${passCount}/${expected.length} clean PASS → findings/fleet_manifest_${RUNID}.json`);
process.exit(allPass ? 0 : 1);

// Fail-closed grandfather-epoch verifier for the PR-3 (FORCED_PATHWAY) flip.
// Codex PR-3 r18 (HIGH flip-checklist): a flag-ON build with a null/mismatched grandfather epoch
// strands legitimate pre-deploy completions (the engagement reader treats every attempt as post-epoch).
// RULE: whenever EITHER FORCED_PATHWAY (client) or FORCED_PATHWAY_ENABLED (server) is true, BOTH
// FORCED_PATHWAY_GRANDFATHER_EPOCH_MS values (src/utils/forcedPathway.js + functions/foundation.js)
// MUST be non-null AND EQUAL. Dormant (both flags false) → epochs may be null (PASS). Fail-closed: exit 1.
//   node audit/deepfix/task6/verify_forced_pathway_epoch.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// Repo-relative (portable WSL + native Windows) — was hardcoded `/app/` (WSL container path).
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const R = (p) => readFileSync(resolve(REPO, p), 'utf8');
const bool = (t, n) => { const m = t.match(new RegExp(`(?:export\\s+)?const\\s+${n}\\s*=\\s*(true|false)\\b`)); return m ? m[1] === 'true' : null; };
const epoch = (t, n) => { const m = t.match(new RegExp(`(?:export\\s+)?const\\s+${n}\\s*=\\s*(null|-?\\d+)\\b`)); return m ? (m[1] === 'null' ? null : Number(m[1])) : undefined; };

const FF = R('src/config/featureFlags.js');
const FND = R('functions/foundation.js');
const FP = R('src/utils/forcedPathway.js');

const clientFlag = bool(FF, 'FORCED_PATHWAY');
const serverFlag = bool(FND, 'FORCED_PATHWAY_ENABLED');
const clientEpoch = epoch(FP, 'FORCED_PATHWAY_GRANDFATHER_EPOCH_MS');
const serverEpoch = epoch(FND, 'FORCED_PATHWAY_GRANDFATHER_EPOCH_MS');

console.log(`FORCED_PATHWAY(client)=${clientFlag}  FORCED_PATHWAY_ENABLED(server)=${serverFlag}`);
console.log(`grandfather epoch: client=${clientEpoch}  server=${serverEpoch}`);

const problems = [];
if (clientEpoch === undefined) problems.push('client FORCED_PATHWAY_GRANDFATHER_EPOCH_MS not found (forcedPathway.js)');
if (serverEpoch === undefined) problems.push('server FORCED_PATHWAY_GRANDFATHER_EPOCH_MS not found (foundation.js)');
// Per-flag: each reader's grandfather epoch is load-bearing only when ITS flag is on. The client
// (FORCED_PATHWAY) flips at the PR-3 flip; the server (FORCED_PATHWAY_ENABLED) flips later at P4.
if (clientFlag === true && clientEpoch == null) problems.push('client FORCED_PATHWAY ON with NULL client epoch — strands pre-deploy completions');
if (serverFlag === true && serverEpoch == null) problems.push('server FORCED_PATHWAY_ENABLED ON with NULL server epoch — strands pre-deploy completions');
// When BOTH readers are live (P4+), the epochs MUST match so the same pre-deploy set grandfathers on both.
if (clientFlag === true && serverFlag === true && clientEpoch != null && serverEpoch != null && clientEpoch !== serverEpoch)
  problems.push(`BOTH ON with MISMATCHED epochs: client ${clientEpoch} !== server ${serverEpoch}`);
const anyOn = clientFlag === true || serverFlag === true;
if (!anyOn) console.log('Both flags dormant — null epochs OK.');

if (problems.length) {
  console.log('\n❌ EPOCH GATE: FAIL (fail-closed)\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log('\n✅ EPOCH GATE: PASS' + (anyOn ? ` (client=${clientEpoch} server=${serverEpoch})` : ' (dormant)'));
process.exit(0);

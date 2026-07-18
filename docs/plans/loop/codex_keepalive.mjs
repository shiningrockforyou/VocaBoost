// Codex session keepalive — flips a lightweight CHECKIN onto the baton so Codex's poll/session
// stays live during long cutover gaps. SAFE: only flips when the baton is IDLE (turnOwner=claude)
// and not recently active (>50 min since updatedAt) — so it NEVER clobbers an in-flight review.
// `--force` overrides the idle check (used for the first "ASAP" ping).
//   node docs/plans/loop/codex_keepalive.mjs [--force]
import { readFileSync, writeFileSync } from 'node:fs';
const BATON = '/app/docs/plans/loop/baton.json';
const force = process.argv.includes('--force');
const b = JSON.parse(readFileSync(BATON, 'utf8').replace(/^﻿/, '')); // strip BOM (Codex writes from Windows)
const now = Date.now();
const idleMin = b.updatedAt ? (now - Date.parse(b.updatedAt)) / 60000 : 999;

if (b.turnOwner !== 'claude') { console.log(`SKIP keepalive: turnOwner=${b.turnOwner} (real review in flight)`); process.exit(0); }
if (!force && idleMin < 50) { console.log(`SKIP keepalive: baton active ${idleMin.toFixed(0)} min ago`); process.exit(0); }

const round = (b.round || 0) + 1;
const rev = (b.revision || 0) + 1;
const ka = (b.keepaliveCount || 0) + 1;
const iso = new Date(now).toISOString();
const out = {
  ...b,
  turnOwner: 'codex',
  round,
  taskId: 'CODEX_KEEPALIVE',
  claudeStatus: 'keepalive-ping',
  codexStatus: 'waiting',
  codexDecision: '',
  note: `CODEX_KEEPALIVE (heartbeat #${ka}, ${iso}) — NO review work. Orchestrator hourly checkin to keep your session live during the cutover. Just write one line "ALIVE ${iso}" to docs/plans/loop/codex_reviews/codex_keepalive_${ka}.md, then flip baton->claude: round=${round} taskId=CODEX_KEEPALIVE codexStatus=review-written codexDecision=ALIVE updatedBy=codex revision=${rev + 1}. Then resume waiting for the next real baton.`,
  updatedBy: 'claude',
  revision: rev,
  updatedAt: iso,
  keepaliveCount: ka,
};
writeFileSync(BATON, JSON.stringify(out, null, 4) + '\n');
writeFileSync(`/app/docs/plans/loop/ready/claude_keepalive_${ka}.json`,
  JSON.stringify({ readyFor: 'codex', round, taskId: 'CODEX_KEEPALIVE', writtenLast: true }, null, 2) + '\n');
console.log(`PINGED codex — keepalive #${ka} (round ${round}, revision ${rev}) at ${iso}`);

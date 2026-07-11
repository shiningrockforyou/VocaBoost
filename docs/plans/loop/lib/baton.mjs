#!/usr/bin/env node
/**
 * baton.mjs — the shared turn-token for the Claude<->Codex plan-review loop.
 *
 * Schema is Codex's Docker-worker schema (turnOwner / task / repoRoot / instruction / codexStatus /
 * codexLastReview) EXTENDED with Claude's orchestration fields (slug / round / maxRounds / state /
 * cleanStreak / revision). Codex updates turnOwner+codexStatus+codexLastReview IN PLACE (its smoke
 * test confirmed it preserves the other fields); Claude owns the rest and authors `instruction` at
 * each hand-off.
 *
 * Lives at <loopDir>/codex-out/baton.json  (== the Docker `/out/baton.json`).
 * READS strip a UTF-8 BOM (PowerShell's `Set-Content -Encoding UTF8` writes one → would break JSON.parse).
 *
 * Usage:
 *   node baton.mjs <batonDir> init  --slug S [--maxRounds 8]
 *   node baton.mjs <batonDir> get   <field>
 *   node baton.mjs <batonDir> set   <field> <value> [--by who] [--note "..."]
 *   node baton.mjs <batonDir> set-file <field> <path>        # set a field from a file's contents (for long `instruction`)
 *   node baton.mjs <batonDir> dump
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const [, , loopDir, cmd, ...rest] = process.argv;
if (!loopDir || !cmd) { console.error('usage: baton.mjs <batonDir> <init|get|set|set-file|dump> ...'); process.exit(2); }

const file = join(loopDir, 'baton.json');
const INT_FIELDS = new Set(['round', 'maxRounds', 'cleanStreak', 'revision']);

function flag(name, def = null) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : def;
}
function read() {
  if (!existsSync(file)) { console.error(`baton.json not found at ${file}`); process.exit(3); }
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); // strip BOM
}
function write(b, by) {
  b.updatedBy = by || b.updatedBy || 'unknown';
  b.updatedAt = new Date().toISOString();
  b.revision = (typeof b.revision === 'number' ? b.revision : 0) + 1;
  mkdirSync(loopDir, { recursive: true });
  writeFileSync(file, JSON.stringify(b, null, 2) + '\n'); // no BOM
}

if (cmd === 'init') {
  const slug = flag('slug');
  if (!slug) { console.error('init requires --slug'); process.exit(2); }
  const b = {
    // Codex Docker-worker fields:
    turnOwner: flag('turn', 'codex'),   // "codex" | "claude"
    task: 'plan-review',
    repoRoot: '/repo',                   // container path Codex reads from
    instruction: '(set by Claude at hand-off)',
    codexStatus: null,                   // Codex sets: "reviewed" | ...
    codexLastReview: null,               // Codex sets: /out/reviews/rNN_codex_review.md
    codexStateFile: '/out/codex_state.md', // Codex maintains a COMPACT rolling summary here each turn
    // DELTA payload — Claude sets on WARM rounds (2+) so Codex re-checks only the plan diff + named
    // claims and does NOT re-read the codebase or re-raise settled findings. null on round 1 (cold).
    delta: null,                         // { planRevision, changedSections:[], claimsToCheck:[{claim,at}], claudeClaim, reviewScope }
    // Claude orchestration fields:
    slug,
    round: 1,
    maxRounds: parseInt(flag('maxRounds', '8'), 10),
    state: 'running',                    // running | converged | failed | stalled
    cleanStreak: 0,
    revision: 0,
    codexSessionId: null,
    updatedBy: 'claude',
    updatedAt: new Date().toISOString(),
    note: flag('note', 'loop initialized'),
  };
  write(b, 'claude');
  console.log(JSON.stringify(b, null, 2));
} else if (cmd === 'get') {
  const field = rest[0];
  const b = read();
  if (field) console.log(b[field] ?? '');
  else console.log(JSON.stringify(b));
} else if (cmd === 'set') {
  const field = rest[0];
  const rawVal = rest[1];
  if (!field || rawVal === undefined) { console.error('set requires <field> <value>'); process.exit(2); }
  const b = read();
  b[field] = INT_FIELDS.has(field) ? parseInt(rawVal, 10) : rawVal;
  const note = flag('note');
  if (note !== null) b.note = note;
  write(b, flag('by', b.updatedBy));
  console.log(`${field} = ${b[field]}`);
} else if (cmd === 'set-file') {
  const field = rest[0];
  const path = rest[1];
  if (!field || !path) { console.error('set-file requires <field> <path>'); process.exit(2); }
  const b = read();
  b[field] = readFileSync(path, 'utf8');
  write(b, flag('by', b.updatedBy));
  console.log(`${field} set from ${path} (${b[field].length} chars)`);
} else if (cmd === 'dump') {
  console.log(JSON.stringify(read(), null, 2));
} else {
  console.error(`unknown cmd: ${cmd}`); process.exit(2);
}

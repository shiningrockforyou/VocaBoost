/**
 * Deploy-time build stamp (deploy-provenance fix — see NEED_TO_FIX.md).
 *
 * Writes functions/buildInfo.json with the git commit being deployed, so the live
 * Cloud Functions can report EXACTLY what is deployed (via the `version` callable).
 * This makes stale-artifact drift detectable instead of silent — the 2026-06-29 grader
 * incident (fix committed in March, prod ran an old artifact for months) is the reason
 * this exists.
 *
 * Wired into firebase.json `functions.predeploy`, so it runs automatically on every
 * `firebase deploy --only functions`. Never fails the deploy: missing git → "unknown".
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
};

const info = {
  sha: git('git rev-parse HEAD'),
  shortSha: git('git rev-parse --short HEAD'),
  branch: git('git rev-parse --abbrev-ref HEAD'),
  // true => deployed from uncommitted changes (e.g. a hand-flipped flag); a yellow flag for ops.
  dirty: git('git status --porcelain') !== '' && git('git status --porcelain') !== 'unknown',
  builtAt: new Date().toISOString(),
};

const out = join(root, 'functions', 'buildInfo.json');
writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log('[stamp-build] wrote functions/buildInfo.json', info);

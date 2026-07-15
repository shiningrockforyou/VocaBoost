import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// [deepfix P4 · FND-2 / I-5 G3] Client build stamp: bake the git commit into the bundle at
// build time so hosting deploys are provenance-verifiable (functions already have this via
// scripts/stamp-build.mjs; hosting had NO stamp — F-1's "day_guard_rejected still firing after
// the 07-12 deploy" was undecidable for exactly this reason). Surfaced at runtime by
// src/utils/buildStamp.js (window.__VOCABOOST_BUILD__ probe + one console line). Never fails
// the build: missing git → 'unknown'.
const git = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const gitStatus = git('git status --porcelain')
const buildInfo = {
  sha: git('git rev-parse HEAD'),
  shortSha: git('git rev-parse --short HEAD'),
  branch: git('git rev-parse --abbrev-ref HEAD'),
  // true => built from uncommitted changes (e.g. a hand-flipped flag); a yellow flag for ops.
  dirty: gitStatus !== '' && gitStatus !== 'unknown',
  builtAt: new Date().toISOString(),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __VOCABOOST_BUILD_INFO__: JSON.stringify(buildInfo),
  },
})

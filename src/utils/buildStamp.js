/**
 * [deepfix P4 · FND-2 / I-5 G3] Client build-stamp probe.
 *
 * The commit sha is baked into the bundle by vite.config.js (`define:
 * __VOCABOOST_BUILD_INFO__`) at build time. This module surfaces it two ways:
 *   1. `window.__VOCABOOST_BUILD__` — the ops probe: on ANY deployed page, open the
 *      console and read the object (sha / shortSha / branch / dirty / builtAt). This is
 *      the hosting analog of the functions `version` callable (I-5 G2/G3): after a
 *      hosting deploy, assert `window.__VOCABOOST_BUILD__.sha === git rev-parse HEAD`
 *      and `dirty === false`.
 *   2. A single console.info line on load — visible in any user-supplied console capture,
 *      so stale-bundle reports become attributable to an exact commit.
 * The sha string itself is also bundle-greppable (the G3 interim check, now permanent).
 *
 * Imported for its side effect from src/main.jsx. No app behavior depends on it.
 */
/* global __VOCABOOST_BUILD_INFO__ */

const FALLBACK = { sha: 'unknown', shortSha: 'unknown', branch: 'unknown', dirty: null, builtAt: null }

// `typeof` guard: the identifier is replaced by Vite's `define` in both dev and build;
// the guard keeps this module inert under any non-Vite consumer (tests, tooling).
export const BUILD_INFO = typeof __VOCABOOST_BUILD_INFO__ !== 'undefined' ? __VOCABOOST_BUILD_INFO__ : FALLBACK

try {
  if (typeof window !== 'undefined') {
    window.__VOCABOOST_BUILD__ = BUILD_INFO
    console.info(
      `[vocaboost] build ${BUILD_INFO.shortSha}${BUILD_INFO.dirty ? ' (dirty)' : ''} · ${BUILD_INFO.branch} · ${BUILD_INFO.builtAt}`
    )
  }
} catch {
  // provenance is observability-only — never let it break app boot
}

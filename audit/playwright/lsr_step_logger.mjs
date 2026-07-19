/**
 * lsr_step_logger.mjs — programmatic per-step logging for the D3.5 Playwright/callable drives (David-directed).
 *
 * WHY: drives produced no interim output — a wedged run (r52 "outcome: timeout") left no trace of WHERE. This logger
 * appends ONE JSONL line per step, SYNCHRONOUSLY (crash-safe: the last line survives a wedge/kill), to the shared FS —
 * so WSL/David can `tail -f` a live drive from the other machine while it runs.
 *
 * File: audit/playwright/findings/steps/<runId>.jsonl   (one line per step: {ts, runId, seq, step, ms, data|error})
 *
 * Usage (wire into EVERY drive; the steps file is part of the hand-back evidence):
 *   import { makeStepLogger } from './lsr_step_logger.mjs';           // adjust relative path
 *   const slog = makeStepLogger('r54-liveoyk');
 *   slog.step('login', { email });                                    // instant log
 *   await slog.run('renderCheck', async () => { ...; return {day} }); // auto start/end/duration/error
 *   slog.heartbeat(15000);                                            // liveness during long waits (stop via slog.done)
 *   slog.done({ verdict });                                           // final line + clears heartbeat
 */
import { appendFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STEPS_DIR = resolve(HERE, 'findings', 'steps');

export function makeStepLogger(runId, opts = {}) {
  const file = opts.file || resolve(STEPS_DIR, `${String(runId).replace(/[^A-Za-z0-9_-]/g, '')}.jsonl`);
  try { mkdirSync(dirname(file), { recursive: true }); } catch {}
  let seq = 0, hb = null, lastStep = 'init', liveProgress = null, lastProgressAt = 0;
  const write = (obj) => {
    const line = JSON.stringify({ ts: new Date().toISOString(), runId, seq: ++seq, ...obj });
    try { appendFileSync(file, line + '\n'); } catch {}
    // mirror to console so the local terminal shows the same trail
    console.log(`  ▸ [${runId}#${seq}] ${obj.step}${obj.ms != null ? ` (${obj.ms}ms)` : ''}${obj.error ? ' ✗ ' + obj.error : ''}`);
  };
  const api = {
    file,
    /** Log a step instantly (use for atomic actions: click, submit, dialog-seen, read-back values). */
    step(step, data) { lastStep = step; write({ step, data: data ?? null }); return api; },
    /** Wrap an async phase: logs `<step>.start`, then `<step>.ok` (with duration + returned data) or `<step>.FAIL`. */
    async run(step, fn) {
      lastStep = step; write({ step: `${step}.start` });
      const t0 = Date.now();
      try { const out = await fn(); write({ step: `${step}.ok`, ms: Date.now() - t0, data: out ?? null }); return out; }
      catch (e) { write({ step: `${step}.FAIL`, ms: Date.now() - t0, error: String(e?.message || e) }); throw e; }
    },
    /**
     * In-LOOP progress (the 80-card-grind fix): call EVERY iteration; it self-rate-limits — logs when i%every===0,
     * on the final iteration, or if >intervalMs elapsed since the last progress line. Distinguishes "grinding
     * normally" (advancing i) from "wedged" (i frozen while heartbeats continue).
     *   for (let k=0;k<cards;k++){ slog.progress('studyThrough', k+1, cards); ...click... }
     */
    progress(step, i, n, data) {
      lastStep = `${step} ${i}/${n}`; liveProgress = { step, i, n };
      const every = opts.progressEvery ?? 10, intervalMs = opts.progressIntervalMs ?? 20000;
      if (i % every === 0 || i === n || Date.now() - lastProgressAt > intervalMs) {
        lastProgressAt = Date.now(); write({ step: `${step}.progress`, data: { i, n, ...(data || {}) } });
      }
      return api;
    },
    /** Emit a liveness line every `ms` — carries the live in-loop counter so a frozen loop is visibly frozen. */
    heartbeat(ms = 15000) { clearInterval(hb); hb = setInterval(() => write({ step: 'heartbeat', data: { lastStep, progress: liveProgress } }), ms); if (hb.unref) hb.unref(); return api; },
    /** Log an error without throwing. */
    error(step, err) { write({ step: `${step}.ERROR`, error: String(err?.message || err) }); return api; },
    /** Final line; clears the heartbeat. */
    done(summary) { clearInterval(hb); write({ step: 'done', data: summary ?? null }); return api; },
  };
  write({ step: 'start', data: { pid: process.pid, node: process.version } });
  return api;
}

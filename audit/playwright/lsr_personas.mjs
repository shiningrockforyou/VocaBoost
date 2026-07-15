/**
 * Run S-Long Persona Expansion — the 16-persona catalog (L1..L16) as ordered SEGMENT specs.
 * Data-only (no Playwright); consumed by lsr_persona.mjs. Mirrors docs/plans/loop/runslong/
 * persona_expansion.md v3.1 §2/§3/§5 (Codex round-3 GO). Each persona = { id, level, event, segments[] }.
 *
 * A SEGMENT is one {class, list, pace} stint the student runs before a switch:
 *   { tier, pace, thr, testSize, mode,
 *     transitionInto,   // 'fresh' | 'T1' | 'T2' | 'T3' | 'same-pace-move' — how the student ENTERS this segment
 *     startCsd,         // csd carried IN (0 fresh/T1/T3; N for T2/same-pace where reconciliation carries)
 *     behavior,         // 'steady'|'throttle'|'freeze'|'phantom'|'retake'|'threshold' — how the day is DRIVEN
 *     runTo,            // 'cap' (twi==listSize) | a fixed localDay count (partial-next / diagnostic window)
 *     note }            // human label for the segment
 * The runner computes the per-day oracle (split: green paceEff>0 vs EXPECTED-BLOCKED paceEff==0) from
 * (pace, listSize, twi, behavior). Caps are DERIVED here so a list-size change can't silently desync them.
 *
 * Seeded personas (L15/L16) carry a `seed` directive the runner applies via an Admin-SDK pre-write BEFORE
 * the student session (bad-anchor / class-move), then asserts the app's response.
 */

export const TIER_SIZE = { base: 1200, ascent: 1600, summit: 800 };
export const PACE = { int: 80, adv: 80, final: 100 };
const COMMON = { thr: 92, testSize: 30, mode: 'typed' };

// Days a clean steady run takes to reach cap: ceil(listSize / pace).
export const capDays = (tier, pace) => Math.ceil(TIER_SIZE[tier] / pace);

// Segment factory — fills COMMON defaults; requires tier + pace + transitionInto + behavior + runTo.
const seg = (o) => ({ ...COMMON, startCsd: 0, ...o });

export const PERSONAS = [
  // ── STEADY solo (prove the #10/day-guard/#9 fixes hold PER-DAY across long arcs) ──
  { id: 'L1', level: 'int', event: 'steady + reload/quit-resume (#7)',
    segments: [seg({ tier: 'base', pace: PACE.int, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
      perturb: { reloadEveryDays: 5, quitResumeEveryDays: 5 }, note: 'Base Camp@80 → 15d; scripted reload+quit/resume absorbs #7' })] },
  { id: 'L2', level: 'adv', event: 'steady (longest solo)',
    segments: [seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
      note: 'Ascent@80 → 20d; per-day #10/day-guard teeth over the longest arc' })] },
  { id: 'L3', level: 'final', event: 'steady pace-100',
    segments: [seg({ tier: 'ascent', pace: PACE.final, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
      note: 'Ascent@100 → 16d; pace-100 oracle' })] },

  // ── T1 finish-list handoff (NEW class per next list; §T-rule truncation David 2026-07-12) ──
  { id: 'L4', level: 'int→adv', event: 'T1 handoff BaseCamp→Ascent (truncated)',
    segments: [
      seg({ tier: 'base', pace: PACE.int, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
        note: 'Base Camp@80 → cap 15d (proves completion + crossing)' }),
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'T1', behavior: 'steady', runTo: 8,
        note: 'fresh Day-1 on Ascent → 8 partial days → STOP (≈23d). Assert BaseCamp doc preserved (#5).' }),
    ] },
  { id: 'L5', level: 'adv', event: 'T1 handoff Ascent→Summit (truncated)',
    segments: [
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
        note: 'Ascent@80 → cap 20d' }),
      seg({ tier: 'summit', pace: PACE.adv, transitionInto: 'T1', behavior: 'steady', runTo: 4,
        note: 'fresh Day-1 on Summit@80 → 4 partial days → STOP (≈24d)' }),
    ] },
  { id: 'L6', level: 'final', event: 'T1 handoff Ascent@100→Summit@100 (full)',
    segments: [
      seg({ tier: 'ascent', pace: PACE.final, transitionInto: 'fresh', behavior: 'steady', runTo: 'cap',
        note: 'Ascent@100 → cap 16d' }),
      seg({ tier: 'summit', pace: PACE.final, transitionInto: 'T1', behavior: 'steady', runTo: 'cap',
        note: 'Summit@100 → cap 8d (16+8=24; §9-Q4 no post-cap green day)' }),
    ] },

  // ── T2 same-list pace switch (adv→final on Ascent, 80→100, between COMPLETED days N≤15) ──
  { id: 'L7', level: 'adv→final', event: 'T2 same-list pace switch',
    segments: [
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 12,
        note: 'Ascent@80 for N=12 completed days (pin N≤15)' }),
      seg({ tier: 'ascent', pace: PACE.final, transitionInto: 'T2', startCsd: 12, behavior: 'steady', runTo: 'cap',
        note: 'SAME Ascent @100 from day 13; reconcile carries csd/twi; finish = 12+ceil((1600−960)/100)=19' }),
    ] },

  // ── T3 different-list early switch (int→adv BEFORE finishing Base Camp → fresh Day-1) ──
  { id: 'L8', level: 'int→adv', event: 'T3 different-list early switch',
    segments: [
      seg({ tier: 'base', pace: PACE.int, transitionInto: 'fresh', behavior: 'steady', runTo: 6,
        note: 'Base Camp@80 for 6 days (does NOT finish)' }),
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'T3', behavior: 'steady', runTo: 6,
        note: 'fresh Day-1 on Ascent (different list → no carry); Base Camp doc preserved oracle' }),
    ] },

  // ── Behavioral edge personas ──
  { id: 'L9', level: 'adv', event: 'retake-loop (#6b: failed attempt never anchors)',
    segments: [seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'retake', runTo: 8,
      retakeOnDays: [3, 6], note: 'days 3 & 6: fail(blank)→retake gate→re-enter→pass; attempt Δ=+2 those days' })] },
  { id: 'L10', level: 'final', event: 'threshold-edge (#5) + cross-class review (#9)',
    segments: [seg({ tier: 'ascent', pace: PACE.final, transitionInto: 'fresh', behavior: 'threshold', runTo: 6,
      thresholdMarginDays: [4], crossClassReviewOnDay: 5,
      note: 'day4: score just ≥thr (UI Pass, no retake loop); day5: leave-mid in A, finish review in B (#9 @100)' })] },
  { id: 'L11', level: 'adv', event: 'getPrimaryFocus footgun (#11)',
    segments: [seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 3,
      addSecondListOnDay: 3, secondTier: 'summit',
      note: 'add a 2nd list to the SAME class mid-stream; default focus must NOT bump to Day-1 of the new list' })] },
  { id: 'L12', level: 'int', event: 'partial-throttle (#8)',
    segments: [seg({ tier: 'base', pace: PACE.int, transitionInto: 'fresh', behavior: 'throttle', runTo: 'dynamic',
      throttleReviewAvg: 0.60, note: 'review avg≈0.60 → interv≈0.33 → paceEff≈53/day; interv=0 days 1-4; dynamic cap (~23d)' })] },
  { id: 'L13', level: 'adv', event: 'phantom-day EXPECTED-BLOCKED (#12)',
    segments: [seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'phantom', runTo: 'cap+1',
      note: 'drive to cap (20d) then ONE more day → post-cap review-only → requiresNewWordRetake, csd frozen, orphan-flag (PINNED)' })] },
  { id: 'L14', level: 'int', event: 'full-freeze EXPECTED-BLOCKED (#8b)',
    segments: [seg({ tier: 'base', pace: PACE.int, transitionInto: 'fresh', behavior: 'freeze', runTo: 8,
      freezeFromDay: 5, note: '≥3 review scores ≤0.30 → interv=1.0 → newWordCount=0 → Day-2+ gate BLOCKS (Δcsd=0/Δtwi=0). Watch STUCK-state edge.' })] },

  // ── Seeded personas (Admin-SDK pre-write, then assert app response) ──
  { id: 'L15', level: 'adv', event: 'invalid-anchor survival (#10b, seeded)',
    seed: { kind: 'bad-anchor', note: 'pre-write a manual-pass attempt MISSING newWordEndIndex (NOT manual-pass.mjs, which writes a VALID anchor)' },
    segments: [seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', startCsd: 0, behavior: 'steady', runTo: 3,
      assertLog: 'csd_anchor_invalid', note: 'app reconciles → detects invalid anchor → logs csd_anchor_invalid, csd/twi NOT corrupted, student not stuck (PINNED)' })] },
  { id: 'L16', level: 'adv', event: 'pure same-pace class move (#6 pre-fix baseline)',
    seed: { kind: 'same-pace-move-marker', note: 'baseline of CURRENT reset-on-class-change; fixed by the foundation program' },
    segments: [
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 4,
        note: 'Ascent@80 in class A for 4 days' }),
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'same-pace-move', startCsd: 4, behavior: 'steady', runTo: 2,
        note: 'reassign to NEW class B, SAME Ascent, SAME pace 80 (NO pace change) → RECORD observed csd/twi delta at the move (baseline, not a green oracle)' }),
    ] },
];

// Quick manifest: event-coverage ledger check (every persona → its event; no unbound event).
export const EVENT_LEDGER = PERSONAS.map((p) => ({ id: p.id, level: p.level, event: p.event, segments: p.segments.length, seeded: !!p.seed }));

// SMOKE-ONLY probe personas (not part of the 16-persona fleet; used to de-risk the trickiest mechanisms
// before the full run). S_T2 exercises the PH-2 reconciliation-on-entry carry in ~4 days: 2 days Ascent@80
// (→ csd=2/twi=160) then a T2 switch to Ascent@100 with startCsd=2 — the runner's T2 baseline contract then
// asserts the reconciled carry is EXACTLY csd=2/twi=160 (INVALID otherwise). Kept out of PERSONAS so a fleet
// loop can't pick it up; selected explicitly by id.
export const SMOKE_PROBES = [
  { id: 'S_T2', level: 'adv→final', event: 'PROBE: T2 same-list carry (PH-2 reconciliation-on-entry)',
    segments: [
      seg({ tier: 'ascent', pace: PACE.adv, transitionInto: 'fresh', behavior: 'steady', runTo: 2,
        note: 'Ascent@80 for 2 days → csd=2/twi=160' }),
      seg({ tier: 'ascent', pace: PACE.final, transitionInto: 'T2', startCsd: 2, behavior: 'steady', runTo: 2,
        note: 'T2 switch to Ascent@100; assert reconciled carry csd=2/twi=160, then 2 days @100' }),
    ] },
];

export const ALL_PERSONAS = [...PERSONAS, ...SMOKE_PROBES];

export default PERSONAS;

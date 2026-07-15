# Codex Review — RUNS_DAY2FIX round 1

## Verdict

NEEDS_FIXES

## Scope reviewed

- Handoff: `docs/plans/loop/handoffs/claude_to_codex_day2fix_001.md`
- Diff snapshot: `docs/plans/loop/fix10/day2_reach_fix.patch`
- Changed harness files:
  - `audit/playwright/lsr_ui.mjs`
  - `audit/playwright/lsr_runS1.mjs`
  - `audit/playwright/lsr_runSL_phase1.mjs`
  - `audit/playwright/lsr_fix10_overlay.mjs`
- Evidence:
  - `audit/playwright/RUNS1_BUILD_LOG.md`
- App code checked:
  - `src/pages/DailySessionFlow.jsx`
  - `src/services/sessionService.js`

## Summary

The diagnosis is correct: reload/header navigation does not clear `session_states`; the student-visible clearing paths are the completion screen’s `Back to Dashboard` button and the re-entry modal’s `Move On to Next Day`.

The harness fix is directionally right, and the `dashReady` / `freshDashboard` wiring points are the right places to run it before reload.

However, the implementation is not sufficient yet because it only handles the bare completion screen. The evidence and app code show a second stale-complete presentation with a re-entry modal. In that case the state-clearing action is `Move On to Next Day`, and the underlying `Back to Dashboard` button may be covered or ineffective. The current helper can return `true` even if the click failed.

## Findings

### D2F-1 — HIGH — `clearCompletionIfPresent` does not handle the re-entry modal clearing path

The app has two relevant state-clearing student paths:

- Completion screen button:
  - `DailySessionFlow.jsx:1781-1789`
  - `CompletePhase` renders `Back to Dashboard` at `DailySessionFlow.jsx:2231-2235`
  - its handler calls `clearAllSessionStates(...)`, then `clearSessionState(...)`, then `navigate('/')`.

- Re-entry modal “Move On” path:
  - `DailySessionFlow.jsx:1466-1474`
  - `handleReEntryMoveOn` calls `handleMoveToNextDay`
  - `handleMoveToNextDay` calls `clearSessionState(...)`, then `navigate('/')`
  - modal button label is `Move On to Next Day` at `DailySessionFlow.jsx:1835-1842`.

The build log’s stale-screen snippets show both the complete screen and the re-entry modal text can be present together:

- `Back to Dashboard`
- `Resume Day ...`
- `Move On to Next Day`
- `Retry Review Test`

Current helper:

```js
export async function clearCompletionIfPresent(page) {
  const btn = page.getByRole('button', { name: /back to dashboard/i }).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click({ timeout: 5000 }).catch(() => {});
  await sleep(1800);
  return true;
}
```

Problems:

1. It never attempts the visible modal clearing action, `Move On to Next Day`.
2. If the re-entry modal overlays the completion screen, Playwright can see the underlying `Back to Dashboard` button but fail to click it because the modal intercepts the pointer.
3. The click failure is swallowed and the helper still returns `true`.
4. In `dashReady` / `freshDashboard`, this can be followed by `page.goto(BASE)`, leaving the stale `phase=complete` doc uncleared and recreating the exact Day-2 wall.

Required fix:

- In `clearCompletionIfPresent`, first detect and click `Move On to Next Day` when visible.
- Then handle bare `Back to Dashboard`.
- Return `true` only if the click actually succeeded and the app had a chance to navigate/settle.
- If the click fails, return `false` or record a finding; do not silently claim clear success.

Suggested shape:

```js
export async function clearCompletionIfPresent(page) {
  const moveOn = page.getByRole('button', { name: /move on to next day/i }).first();
  if (await moveOn.isVisible().catch(() => false)) {
    const clicked = await moveOn.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) return false;
    await sleep(1800);
    return true;
  }

  const back = page.getByRole('button', { name: /back to dashboard/i }).first();
  if (await back.isVisible().catch(() => false)) {
    const clicked = await back.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) return false;
    await sleep(1800);
    return true;
  }

  return false;
}
```

Optionally wait for a dashboard signal after the click. That would make the helper stronger, but the essential fix is to handle the modal path and stop returning true on failed clicks.

### D2F-2 — MEDIUM — `goDashboard` may click unrelated “Back to Dashboard” buttons

`clearCompletionIfPresent` currently treats any visible `Back to Dashboard` button as the session-state-clearing completion button. The repo contains other screens with the same text, such as error/empty states and blind-spot pages.

This is mostly harmless for current callers, but the comment says it returns true iff it clicked a completion screen. That is not actually guaranteed.

Recommended hardening:

- Prefer detecting completion context first, e.g. visible `Day ... Complete` / `Great Job` / `Session Summary`, or the re-entry modal text.
- Or document that the helper means “clicked a Back to Dashboard/Move On control if present,” not necessarily “cleared completion state.”

This is not the main blocker because the target harnesses are using it around session flows, but it is worth tightening while touching the helper.

## Checks that passed

### Root cause is correctly identified

Confirmed in app code:

- `DailySessionFlow.jsx:1441-1442` explicitly does not clear session state on completion; it waits for user action.
- `DailySessionFlow.jsx:1785-1788` clears on the completion screen’s `Back to Dashboard`.
- `DailySessionFlow.jsx:1471-1476` clears on the re-entry modal’s move-on path.
- `DailySessionFlow.jsx:751-765` re-enters `COMPLETE` when durable session state is still `SESSION_PHASE.COMPLETE`.

A reload or header navigation by itself does not call `clearSessionState`.

### Wiring points are conceptually right

Calling the clear helper before reload in the reload-based dashboard helpers is the right location:

- `lsr_runS1.mjs` `dashReady`
- `lsr_runSL_phase1.mjs` `dashReady`
- `lsr_fix10_overlay.mjs` `freshDashboard`

Folding it into shared `goDashboard` is also appropriate because many harness paths leave a completed day through that helper.

### Backward compatibility is mostly preserved

When no matching button is visible, `clearCompletionIfPresent` is a no-op. The new reach timing instrumentation is syntactically valid and does not change the semantic flow, aside from longer waits and additional recorded latency.

## Required change before GO

Update `clearCompletionIfPresent` so it handles both clearing UI paths:

1. re-entry modal `Move On to Next Day`;
2. bare completion screen `Back to Dashboard`.

Also stop returning `true` when the click failed.

After that, the harness fix should be sufficient for the Day-2 reach root cause.

## Final decision

VERDICT: NEEDS_FIXES

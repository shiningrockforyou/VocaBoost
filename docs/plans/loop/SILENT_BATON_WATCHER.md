# Silent in-session baton watcher

This is the standing low-usage method for an interactive Codex session that has been asked to wait for
Claude's next handoff.

## Start it

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/plans/loop/watch-for-codex.ps1
```

Optional controls:

```powershell
# Five-hour script ceiling; the default 0 means no script-level timeout.
powershell -NoProfile -ExecutionPolicy Bypass -File docs/plans/loop/watch-for-codex.ps1 -TimeoutMinutes 300

# Override the default 30-second internal interval.
powershell -NoProfile -ExecutionPolicy Bypass -File docs/plans/loop/watch-for-codex.ps1 -PollSeconds 60
```

## Behavior

- One PowerShell process reads `docs/plans/loop/baton.json` internally.
- It produces no progress output and does not invoke the model on each file check.
- If the initial baton already belongs to Codex, it emits `READY` immediately after validating it.
- Otherwise it requires a newer revision whose `turnOwner` is `codex`.
- Malformed/partially written JSON is ignored until the next check.
- When `readyMarker` is named, that file must exist, say `readyFor: codex`, have `writtenLast: true`,
  and match the baton's round and task ID.
- It emits one `READY round=... revision=... task=... handoff=...` line, then exits.

## How Codex waits

Launch the watcher once as a yielded long-running shell process. Continue waiting on that same process
in roughly 60-second tool-wait increments. Do not launch a new `Get-Content baton.json` command every
minute. The short waits are an interface limitation; the underlying watcher remains the same process.

After `READY`, Codex reads and reviews the handoff, writes its review, updates the baton with a guarded
revision increment, and—when the user's standing request calls for continued watching—starts one new
watcher for the next handoff.

## Cost and limitations

The internal sleep/check loop is ordinary local PowerShell work and carries essentially no model-token
cost. Each Codex-side tool-wait/resumption can still carry small session/quota overhead. Reducing the
check interval changes handoff latency and trivial local CPU/I/O, but does not materially change token
usage.

This is not a durable scheduler. It cannot wake Codex after the interactive session is closed or
interrupted, and it cannot guarantee survival across quota loss, connectivity loss, platform limits, or
tool-process limits. "No script-level timeout" therefore means only that the script itself does not
choose to stop.

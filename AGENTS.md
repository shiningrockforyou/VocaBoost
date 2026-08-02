# Repository agent instructions

## Claude/Codex baton watching

When the user asks Codex to **poll**, **watch**, **wait for the baton**, or **stay on call**, use the
repository's silent watcher instead of repeatedly reading `baton.json` in separate shell calls:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/plans/loop/watch-for-codex.ps1
```

The watcher polls internally every 30 seconds and emits no progress output. It exits only when it sees
a complete Codex handoff, printing one `READY ...` line. If the baton already belongs to Codex when the
watcher starts, that handoff is accepted immediately; otherwise the watcher requires a newer revision.
When `readyMarker` is present, the watcher also requires the marker to exist and match the baton.

Run it as one long-lived yielded shell process. While it is running, wait on the same process rather
than launching new baton reads. Tool waits should be bounded to about 60 seconds each and re-entered on
timeout/yield; those waits are only the interface bridge to the same watcher. Do not send routine chat
updates while the user has explicitly asked for a silent watch. When `READY` appears, inspect the
baton/handoff, perform the requested review, write the review artifact, hand the baton back, and resume
the watcher if the user's standing request says to keep polling.

This is efficient but not a durable scheduler: it cannot reactivate Codex after the interactive session
is closed, interrupted, loses quota/connectivity, or reaches a platform/tool runtime limit. The script
itself may wait indefinitely by default; the surrounding Codex/tool session may not.

Full baton and review rules live in
`docs/plans/loop/CODEX_CLAUDE_LONG_TURN_PROTOCOL.md`; watcher details live in
`docs/plans/loop/SILENT_BATON_WATCHER.md`.

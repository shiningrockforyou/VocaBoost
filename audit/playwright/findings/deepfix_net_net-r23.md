# deepfix M-NET (net-r23)

**NOT_CLEAN** — 2/3 PASS

- ❌ **NET-1** FAIL — offline submit produced 0 new attempts after reconnect (lost write)
- ✅ **NET-2** PASS — slow network on submit → exactly 1 attempt, eventual success (no false-fail/dup)
- ✅ **NET-3** PASS — one-shot write failure on submit → retried to exactly 1 attempt (idempotent)

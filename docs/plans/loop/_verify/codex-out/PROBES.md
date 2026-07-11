# Sandbox verification probe — instructions for Codex

You are verifying that the `-C codex-out` sandbox shape actually confines writes. You are running with
your working directory (`-C`) = `docs/plans/loop/_verify/codex-out`, `--sandbox workspace-write`,
`--ask-for-approval never`. The repository root is `C:\Users\dmchw\vocaboost`.

**Do exactly this, then STOP — do not review any plan, do not flip any baton:**

1. Read `./PROBE_MANIFEST.json` (in your cwd). It lists `writes`, `reads`, and `mechanics` probes,
   each with an `id`, a `target`, and the `expect`ed outcome (`pass` = should succeed, `fail` = sandbox
   should block).

2. **Attempt every probe** — genuinely try each write/read/command:
   - For `writes`: try to create the file at `target`. Use the file-writing tool for W1–W9/W11, and an
     actual **shell command** for W10 and W12 (that's the point — test the command sandbox path).
   - For `reads`: try to read `target`. For **R4 (the secret), report only `readable:true/false` and the
     file's byte length — DO NOT print or echo its contents anywhere.**
   - For `mechanics`: read `./baton.json` and report its `turn`/`round`/`state`.

3. **Record the actual outcome of each** — did the op SUCCEED or was it BLOCKED/denied? — and whether
   that matches `expect`.

4. **Write your results** to `./PROBE_RESULTS.md` (in your cwd) as a table:
   `| id | kind | target | expected | actual (success/blocked) | match? | note |`
   Then a summary line: `PROBE SUMMARY: matches=<n>/<total>, mismatches=<n>`. List any mismatch loudly.

5. Do **not** write anything outside your cwd on purpose beyond the probe attempts themselves (the
   `fail` probes are *supposed* to be blocked; if any unexpectedly succeeds, that's the finding).

That's all. Claude will then independently check the shared filesystem to confirm your report against
reality (which `fail` targets, if any, actually got created; that `plan.md` and git HEAD are unchanged).

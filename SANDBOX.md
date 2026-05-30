# Sandboxed agent + Playwright

## What changed from the first setup

Because the agent now runs inside a container that already has the browsers,
it runs the whole loop in-place — no nested Docker, no Docker socket.

- KEEP: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- SWITCH: in `playwright.config.ts`, uncomment the `webServer` block (Playwright
  boots Vite itself inside the sandbox; `baseURL` falls back to localhost:5173,
  which matches). Delete the `app` service dependency from your mental model.
- DROP (for this mode): `docker-compose.yml`. It's only useful if you also want
  quick non-sandboxed test runs directly on your host.

## Run it

From the repo root:

    chmod +x run-agent.sh
    ./run-agent.sh          # builds the image, drops you into claude (skip-perms)

Inside the sandbox, the agent's loop is just:

    npm ci
    npm i -D @playwright/test@1.60.0   # must match the image tag
    npx playwright test                 # webServer boots Vite, runs the suite

Reports/traces land in `playwright-report/` and `test-results/` — on your host,
because the repo is bind-mounted.

## The security reality (read this)

The container limits the blast radius, but it is not a perfect wall —
"no system is completely immune." Concretely, with `--dangerously-skip-permissions`:

1. A malicious/compromised repo can exfiltrate anything reachable inside the
   container, INCLUDING the Claude Code credentials in ~/.claude. Only run this
   on repos you trust (your own — fine). Don't mount ~/.ssh or cloud cred files;
   use repo-scoped or short-lived tokens if the agent needs to push.

2. Your real exposed secret is the repo's `.env` — the agent can read your
   Firebase/Stripe keys. So: TEST-MODE Stripe keys only, and point Firebase at
   the local emulator (the Dockerfile has a commented block to add it). Emulated
   Firebase also means no external Firebase egress, which keeps step 3 tight.

3. Egress allowlisting is the control that actually matters for a full-perms
   agent. The official reference devcontainer ships an `init-firewall.sh` that
   blocks all outbound traffic except an allowlist (npm, GitHub, Claude API),
   added via the NET_ADMIN + NET_RAW capabilities. To layer that on:
   https://github.com/anthropics/claude-code/tree/main/.devcontainer
   I can port that firewall onto this image if you want it.

## Alternatives worth knowing

- The official reference devcontainer (firewall + persistent volume + zsh) is a
  VS Code "Reopen in Container" flow if you'd rather not hand-roll. Copy its
  `.devcontainer/` and add `npx playwright install --with-deps` for browsers.
- Claude Code also has a built-in sandbox mode (see its sandbox-environments
  docs) if you want a lighter option than a custom image.

# Dockerized Codex headless loop

This setup runs Codex headlessly inside Docker while keeping:

- repository mounted read-only at `/repo`;
- baton/output directory mounted read-write at `/out`;
- Codex subscription auth/session persisted in a Docker volume at `/root/.codex`.

The Docker image contains Codex CLI and basic repo tools. It does not contain login credentials.

## Files

- `Dockerfile` — builds the `codex-headless` image.
- `build.ps1` — builds the image.
- `login.ps1` — opens an interactive container so you can run `codex login --device-auth`.
- `status.ps1` — checks login/doctor status from the persistent volume.
- `run-once.ps1` — runs one fresh `codex exec` baton turn.
- `resume-last.ps1` — resumes the most recent persisted headless session.

## One-time setup

From PowerShell:

```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
.\build.ps1
.\login.ps1
```

Inside the container shell:

```bash
codex login --device-auth
codex login status
codex doctor --summary
exit
```

`codex login --device-auth` should print a URL/code. Open it in your normal Windows browser and log in to your subscription account.

## Run one baton turn

```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
.\run-once.ps1
```

## Resume the last baton session

```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
.\resume-last.ps1
```

## Defaults

These scripts assume:

- repo root: `C:\Users\dmchw\vocaboost`
- output dir: `C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out`
- Docker image: `codex-headless`
- Docker volume: `codex-home-1`

Override examples:

```powershell
.\login.ps1 -VolumeName codex-home-2
.\run-once.ps1 -VolumeName codex-home-2 -OutDir C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out-2
```

## Security model

Docker enforces the mount-level boundary:

- `/repo` is read-only;
- `/out` is writable;
- Codex auth/session lives in the named Docker volume.

The run scripts use Codex's `--sandbox danger-full-access` inside the container because Docker Desktop containers may not allow the user namespaces/bubblewrap setup Codex uses for its own Linux sandbox. Docker is the isolation boundary here: `/repo` remains mounted read-only and `/out` remains mounted read-write.

Do not bake `/root/.codex` into the Docker image.

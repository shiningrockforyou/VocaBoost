param(
  [string]$ImageName = "codex-headless",
  [string]$VolumeName = "codex-home-1",
  [string]$RepoRoot = "C:\Users\dmchw\vocaboost",
  [string]$OutDir = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out",
  [string]$Prompt = "Continue the baton loop. Repo root is /repo. You may read /repo as needed. You may write only under /out. Read /out/baton.json, perform the requested Codex review step, write the markdown result under /out, and update only /out/baton.json."
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
docker volume create $VolumeName | Out-Null

docker run --rm `
  -v "${VolumeName}:/root/.codex" `
  -v "${RepoRoot}:/repo:ro" `
  -v "${OutDir}:/out:rw" `
  -w /out `
  $ImageName `
  codex --ask-for-approval never exec `
    --sandbox danger-full-access `
    --skip-git-repo-check `
    -C /out `
    -o /out/last_message.md `
    resume --last `
    $Prompt

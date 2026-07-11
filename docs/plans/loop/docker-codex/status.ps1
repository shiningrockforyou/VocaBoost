param(
  [string]$ImageName = "codex-headless",
  [string]$VolumeName = "codex-home-1"
)

$ErrorActionPreference = "Stop"

docker run --rm `
  -v "${VolumeName}:/root/.codex" `
  $ImageName `
  bash -lc "codex login status && codex doctor --summary"

param(
  [string]$ImageName = "codex-headless",
  [string]$VolumeName = "codex-home-1"
)

$ErrorActionPreference = "Stop"

docker volume create $VolumeName | Out-Null

Write-Host ""
Write-Host "Starting an interactive Codex container."
Write-Host "Inside the container, run:"
Write-Host "  codex login --device-auth"
Write-Host "  codex login status"
Write-Host "  codex doctor --summary"
Write-Host "  exit"
Write-Host ""

docker run --rm -it `
  -v "${VolumeName}:/root/.codex" `
  $ImageName `
  bash

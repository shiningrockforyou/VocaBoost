<#
  watch-and-run.ps1 - host-side driver for the Dockerized Codex loop.

  The ONE thing you run on Windows (in its own PowerShell window). It polls the shared
  baton.json and, when it's Codex's turn, runs the Docker worker for exactly one turn:
    round 1  -> .\run-once.ps1     (fresh warm session, persisted in the codex-home volume)
    round >1 -> .\resume-last.ps1  (resume that warm session - cheap, no cold re-exploration)

  Codex (inside the container) reads /out/baton.json, follows its instruction, writes its review
  under /out, and flips turnOwner -> "claude". Claude's own bash waiter then auto-wakes Claude.
  Docker enforces the write scope: /repo is read-only, only /out is writable. This script never
  edits the baton (strict turn alternation, no write race).

  Prereqs (one-time): .\build.ps1 ; .\login.ps1 (codex login --device-auth) ; .\status.ps1 shows logged in.

  PARAMS:
    -OutDir   the /out mount (baton lives here). Default the repo's x/codex-out.
    -PollSec  poll interval. Default 20.

  USAGE:
    cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
    powershell -ExecutionPolicy Bypass -File .\watch-and-run.ps1
#>
param(
  [string]$OutDir  = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out",
  [int]$PollSec    = 20
)
$ErrorActionPreference = "Stop"
$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$batonPath = Join-Path $OutDir "baton.json"
$lastServedRound = -1

function Get-Baton { (Get-Content $batonPath -Raw) | ConvertFrom-Json }

Write-Host "watch-and-run: polling $batonPath (poll=${PollSec}s). Ctrl+C to stop."
if (-not (Test-Path $batonPath)) { Write-Host "watch-and-run: baton not present yet - waiting for Claude to init the loop..." }

while ($true) {
  if (Test-Path $batonPath) {
    $b = Get-Baton
    if ($b.state -and $b.state -ne 'running') { Write-Host "watch-and-run: loop ended (state=$($b.state)) - exiting."; break }

    if ($b.turnOwner -eq 'codex' -and $b.round -ne $lastServedRound) {
      $scriptFile = if ([int]$b.round -le 1) { "run-once.ps1" } else { "resume-last.ps1" }
      Write-Host "watch-and-run: round $($b.round) is Codex's turn - running .\$scriptFile ..."
      Write-Host "  instruction: $($b.instruction)"
      & (Join-Path $here $scriptFile) -OutDir $OutDir

      Start-Sleep -Milliseconds 500
      $after = Get-Baton
      if ($after.turnOwner -eq 'codex' -and $after.round -eq $b.round) {
        Write-Host "watch-and-run: WARNING - Codex did not flip turnOwner=claude for round $($b.round). Check $OutDir\last_message.md / logs. Not re-firing."
      } else {
        Write-Host "watch-and-run: round $($b.round) done; turnOwner=$($after.turnOwner) codexStatus=$($after.codexStatus)."
      }
      $lastServedRound = $b.round
    }
  }
  Start-Sleep -Seconds $PollSec
}

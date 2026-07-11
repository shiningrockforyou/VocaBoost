param(
  [string]$ImageName = "codex-headless"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

docker build -t $ImageName $ScriptDir

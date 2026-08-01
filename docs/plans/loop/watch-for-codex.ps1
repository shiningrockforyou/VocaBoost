[CmdletBinding()]
param(
    [string]$BatonPath,
    [int]$PollSeconds = 30,
    [int]$TimeoutMinutes = 0,
    [int]$BaselineRevision = -1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BatonPath)) {
    $BatonPath = Join-Path $PSScriptRoot 'baton.json'
}

if ($PollSeconds -lt 1) {
    throw 'PollSeconds must be at least 1.'
}
if ($TimeoutMinutes -lt 0) {
    throw 'TimeoutMinutes cannot be negative. Use 0 for no script-level timeout.'
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$batonFullPath = [IO.Path]::GetFullPath($BatonPath)

function Read-JsonFile([string]$Path) {
    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            return $null
        }
        return Get-Content -Raw -Encoding utf8 -LiteralPath $Path | ConvertFrom-Json
    }
    catch {
        # A writer may briefly expose partial JSON. Treat it as not ready and retry.
        return $null
    }
}

function Get-Revision($Baton) {
    if ($null -eq $Baton -or $null -eq $Baton.revision) {
        return 0
    }
    try { return [int]$Baton.revision } catch { return 0 }
}

function Test-ReadyMarker($Baton) {
    $readyMarkerProperty = $Baton.PSObject.Properties['readyMarker']
    if ($null -eq $readyMarkerProperty -or [string]::IsNullOrWhiteSpace([string]$readyMarkerProperty.Value)) {
        return $true
    }

    $markerPath = [string]$readyMarkerProperty.Value
    if (-not [IO.Path]::IsPathRooted($markerPath)) {
        $markerPath = Join-Path $repoRoot $markerPath
    }
    $marker = Read-JsonFile ([IO.Path]::GetFullPath($markerPath))
    if ($null -eq $marker) { return $false }
    if ([string]$marker.readyFor -ne 'codex') { return $false }
    if ($marker.writtenLast -ne $true) { return $false }
    if ([string]$marker.round -ne [string]$Baton.round) { return $false }
    if ([string]$marker.taskId -ne [string]$Baton.taskId) { return $false }
    return $true
}

$first = Read-JsonFile $batonFullPath
$initialOwnerIsCodex = $null -ne $first -and [string]$first.turnOwner -eq 'codex'
$baseline = if ($BaselineRevision -ge 0) { $BaselineRevision } else { Get-Revision $first }
$deadline = if ($TimeoutMinutes -eq 0) { $null } else { (Get-Date).AddMinutes($TimeoutMinutes) }

while ($true) {
    $baton = Read-JsonFile $batonFullPath
    if ($null -ne $baton) {
        $revision = Get-Revision $baton
        $revisionIsReady = $revision -gt $baseline
        if ($BaselineRevision -lt 0 -and $initialOwnerIsCodex -and $revision -ge $baseline) {
            $revisionIsReady = $true
        }

        if ([string]$baton.turnOwner -eq 'codex' -and $revisionIsReady -and (Test-ReadyMarker $baton)) {
            Write-Output ('READY round={0} revision={1} task={2} handoff={3}' -f `
                $baton.round, $revision, $baton.taskId, $baton.handoff)
            exit 0
        }
    }

    if ($null -ne $deadline -and (Get-Date) -ge $deadline) {
        exit 2
    }
    Start-Sleep -Seconds $PollSeconds
}

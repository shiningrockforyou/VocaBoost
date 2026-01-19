# Batch Fix Plan Automation Script

## Overview
PowerShell script to automate processing fix plan files through Claude Code with progress tracking.

## Requirements
1. Open new Claude Code instance per fix plan
2. Read `progress.txt` to track completed/pending files
3. Process one fix plan file at a time
4. Log implementation summary to `AP_BOOST_IMPLEMENTATION_LOG.md`
5. Update `progress.txt` with completion status
6. Cycle through all files until done

---

## Files to Create

### 1. `scripts/run-fix-plans.ps1` (Main Script)

```powershell
# run-fix-plans.ps1
# Batch processor for apBoost fix plans using Claude Code

$FixPlanDir = "src\apBoost\criteria_audit\fix_plans\fix-plan-with-codebase-facts"
$ProgressFile = "scripts\progress.txt"
$LogFile = "src\apBoost\criteria_audit\fix_plans\AP_BOOST_IMPLEMENTATION_LOG.md"

# Initialize progress file if not exists
function Initialize-ProgressFile {
    if (-not (Test-Path $ProgressFile)) {
        $files = Get-ChildItem "$FixPlanDir\*.md" | Select-Object -ExpandProperty BaseName
        "# Fix Plan Progress Tracker" | Out-File $ProgressFile
        "# Status: PENDING | COMPLETED | SKIPPED | ERROR" | Out-File $ProgressFile -Append
        "# Last updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-File $ProgressFile -Append
        "" | Out-File $ProgressFile -Append
        foreach ($file in $files) {
            "$file`tPENDING" | Out-File $ProgressFile -Append
        }
        Write-Host "Initialized progress.txt with $($files.Count) fix plans"
    }
}

# Get next pending file
function Get-NextPending {
    $lines = Get-Content $ProgressFile | Where-Object { $_ -match "PENDING$" }
    if ($lines.Count -gt 0) {
        return ($lines[0] -split "`t")[0]
    }
    return $null
}

# Update progress status
function Update-Progress($fileName, $status) {
    $content = Get-Content $ProgressFile
    $content = $content -replace "^$fileName`t.*", "$fileName`t$status"
    # Update timestamp
    $content = $content -replace "^# Last updated:.*", "# Last updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $content | Out-File $ProgressFile
}

# Get progress summary
function Get-ProgressSummary {
    $content = Get-Content $ProgressFile
    $completed = ($content | Where-Object { $_ -match "COMPLETED$" }).Count
    $pending = ($content | Where-Object { $_ -match "PENDING$" }).Count
    $skipped = ($content | Where-Object { $_ -match "SKIPPED$" }).Count
    $error = ($content | Where-Object { $_ -match "ERROR$" }).Count
    return @{
        Completed = $completed
        Pending = $pending
        Skipped = $skipped
        Error = $error
        Total = $completed + $pending + $skipped + $error
    }
}

# Main loop
Write-Host "=== apBoost Fix Plan Batch Processor ===" -ForegroundColor Cyan
Write-Host ""

Initialize-ProgressFile

$summary = Get-ProgressSummary
Write-Host "Progress: $($summary.Completed)/$($summary.Total) completed, $($summary.Pending) pending"
Write-Host ""

while ($true) {
    $nextFile = Get-NextPending
    if (-not $nextFile) {
        Write-Host "All fix plans completed!" -ForegroundColor Green
        break
    }

    $filePath = "$FixPlanDir\$nextFile.md"
    Write-Host "Processing: $nextFile" -ForegroundColor Yellow
    Write-Host "File: $filePath"
    Write-Host ""

    # Build prompt
    $prompt = @"
Read the fix plan at $filePath and implement ALL the changes described.

After implementation:
1. Log a summary to src/apBoost/criteria_audit/fix_plans/AP_BOOST_IMPLEMENTATION_LOG.md
2. Include: section name, files modified, issues fixed count
3. Run the build to verify no errors: npm run build

Do NOT ask questions - implement the plan as written.
"@

    # Run Claude Code (non-interactive with auto-accept)
    Write-Host "Starting Claude Code..." -ForegroundColor Cyan
    claude --dangerously-skip-permissions -p $prompt

    # Check exit code
    if ($LASTEXITCODE -eq 0) {
        Update-Progress $nextFile "COMPLETED"
        Write-Host "Completed: $nextFile" -ForegroundColor Green
    } else {
        Update-Progress $nextFile "ERROR"
        Write-Host "Error processing: $nextFile (exit code: $LASTEXITCODE)" -ForegroundColor Red

        # Ask user if they want to continue
        $continue = Read-Host "Continue to next file? (y/n)"
        if ($continue -ne "y") {
            Write-Host "Stopping batch process."
            break
        }
    }

    Write-Host ""
    $summary = Get-ProgressSummary
    Write-Host "Progress: $($summary.Completed)/$($summary.Total) completed, $($summary.Pending) pending"
    Write-Host "---"
    Write-Host ""
}

# Final summary
$summary = Get-ProgressSummary
Write-Host ""
Write-Host "=== Final Summary ===" -ForegroundColor Cyan
Write-Host "Completed: $($summary.Completed)"
Write-Host "Pending: $($summary.Pending)"
Write-Host "Skipped: $($summary.Skipped)"
Write-Host "Errors: $($summary.Error)"
```

### 2. `scripts/progress.txt` (Auto-generated)

Format after initialization:
```
# Fix Plan Progress Tracker
# Status: PENDING | COMPLETED | SKIPPED | ERROR
# Last updated: 2026-01-14 10:30

1.1_to_1.4-fix-plan-with-codebase-facts	PENDING
1.5_to_1.9-fix-plan-with-codebase-facts	PENDING
1.10_to_1.12-fix-plan-with-codebase-facts	PENDING
2.1_to_2.3-fix-plan-with-codebase-facts	COMPLETED
...
```

---

## Fix Plan Files (25 total)

| # | File | Initial Status |
|---|------|----------------|
| 1 | 1.1_to_1.4-fix-plan-with-codebase-facts.md | PENDING |
| 2 | 1.5_to_1.9-fix-plan-with-codebase-facts.md | PENDING |
| 3 | 1.10_to_1.12-fix-plan-with-codebase-facts.md | PENDING |
| 4 | 2.1_to_2.3-fix-plan-with-codebase-facts.md | COMPLETED (manual) |
| 5 | 2.3.1_to_2.4-fix-plan-with-codebase-facts.md | PENDING |
| 6 | 3.1_to_3.4-fix-plan-with-codebase-facts.md | PENDING |
| 7 | 3.5_to_3.8-fix-plan-with-codebase-facts.md | PENDING |
| 8 | 4.1_to_4.5-fix-plan-with-codebase-facts.md | PENDING |
| 9 | 5.1_to_5.5-fix-plan-with-codebase-facts.md | PENDING |
| 10 | 5.6_to_5.8-fix-plan-with-codebase-facts.md | PENDING |
| 11 | 5.9_to_5.12-fix-plan-with-codebase-facts.md | PENDING |
| 12 | 6.1_to_6.7-fix-plan-with-codebase-facts.md | PENDING |
| 13 | 7.1_to_7.7-fix-plan-with-codebase-facts.md | COMPLETED (manual) |
| 14 | 8.1_to_8.6-fix-plan-with-codebase-facts.md | PENDING |
| 15 | 9.1_to_9.4-fix-plan-with-codebase-facts.md | PENDING |
| 16 | 10.1_to_10.9-fix-plan-with-codebase-facts.md | PENDING |
| 17 | 11.1_to_11.5-fix-plan-with-codebase-facts.md | PENDING |
| 18 | 12.1_to_13.2-fix-plan-with-codebase-facts.md | PENDING |
| 19 | 14.1_to_14.4-fix-plan-with-codebase-facts.md | PENDING |
| 20 | 16.1_to_16.6-fix-plan-with-codebase-facts.md | PENDING |
| 21 | 17.1_to_17.6-fix-plan-with-codebase-facts.md | PENDING |
| 22 | 18.1_to_18.8-fix-plan-with-codebase-facts.md | PENDING |
| 23 | 19.1_to_19.10-fix-plan-with-codebase-facts.md | PENDING |
| 24 | 20.1_to_20.3-fix-plan-with-codebase-facts.md | PENDING |
| 25 | 20.4_to_20.7-fix-plan-with-codebase-facts.md | PENDING |

---

## Usage

### First Run
```powershell
# From project root:
cd c:\Users\dmchw\vocaboost

# Create scripts folder if needed
mkdir scripts -ErrorAction SilentlyContinue

# Copy the script content to scripts/run-fix-plans.ps1
# Then run:
.\scripts\run-fix-plans.ps1
```

### Resume After Interruption
```powershell
# Just run the script again - it reads progress.txt
.\scripts\run-fix-plans.ps1
```

### Skip a Problematic File
```powershell
# Edit progress.txt and change PENDING to SKIPPED
# Example: Change this line:
#   3.1_to_3.4-fix-plan-with-codebase-facts	PENDING
# To:
#   3.1_to_3.4-fix-plan-with-codebase-facts	SKIPPED
```

### Re-run a Completed File
```powershell
# Edit progress.txt and change COMPLETED to PENDING
```

### Pre-mark Already Completed Sections
Before first run, create `scripts/progress.txt` manually with pre-completed sections:
```
# Fix Plan Progress Tracker
# Status: PENDING | COMPLETED | SKIPPED | ERROR
# Last updated: 2026-01-14 10:30

1.1_to_1.4-fix-plan-with-codebase-facts	COMPLETED
1.5_to_1.9-fix-plan-with-codebase-facts	COMPLETED
1.10_to_1.12-fix-plan-with-codebase-facts	COMPLETED
2.1_to_2.3-fix-plan-with-codebase-facts	COMPLETED
2.3.1_to_2.4-fix-plan-with-codebase-facts	COMPLETED
3.1_to_3.4-fix-plan-with-codebase-facts	PENDING
...
```

---

## How It Works

1. **Initialization**: On first run, scans the fix-plan-with-codebase-facts folder and creates progress.txt with all files marked PENDING

2. **Processing Loop**:
   - Finds first PENDING file in progress.txt
   - Builds prompt with file path and instructions
   - Runs `claude --dangerously-skip-permissions -p <prompt>`
   - Waits for Claude Code to complete
   - Updates progress.txt based on exit code

3. **Error Handling**:
   - Non-zero exit code marks file as ERROR
   - Prompts user to continue or stop
   - Can be manually fixed and re-run

4. **Logging**:
   - Claude Code is instructed to update AP_BOOST_IMPLEMENTATION_LOG.md
   - Each section gets a detailed entry with files modified and issues fixed

---

## Verification Checklist

- [ ] Script runs without PowerShell errors
- [ ] progress.txt is created with all 25 files
- [ ] First pending file is processed
- [ ] Claude Code implements the fix plan
- [ ] AP_BOOST_IMPLEMENTATION_LOG.md is updated
- [ ] progress.txt shows COMPLETED status
- [ ] `npm run build` passes after each section
- [ ] Script resumes correctly after interruption

---

## Troubleshooting

### "claude" command not found
Ensure Claude Code CLI is installed and in PATH:
```powershell
npm install -g @anthropic-ai/claude-code
```

### Script hangs
- Claude Code may be waiting for user input
- The `--dangerously-skip-permissions` flag should auto-accept most prompts
- If stuck, Ctrl+C and check the fix plan for issues

### Build failures
- If `npm run build` fails, Claude Code should attempt to fix
- If still failing, mark as ERROR and fix manually

### Permission errors
Run PowerShell as Administrator or check file permissions on the fix plan folder

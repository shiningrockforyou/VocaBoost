# Next steps: Dockerized Codex smoke test

Copy commands from this file into PowerShell. These commands avoid PowerShell here-strings, so indentation/wrapping should not break them.

## 1. Go to the helper directory

```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
```

## 2. Create a smoke-test baton

```powershell
$out = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out"
New-Item -ItemType Directory -Force $out | Out-Null
$baton = [ordered]@{
  turnOwner = "codex"
  task = "smoke-test"
  repoRoot = "/repo"
  instruction = "Read /repo/package.json. Write a short smoke_test.md in /out saying whether you could read the repo. Then update this baton.json by setting turnOwner to claude and codexStatus to smoke-ok."
}
$baton | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "$out\baton.json"
Get-Content "$out\baton.json"
```

## 3. Run one fresh headless Codex turn

```powershell
.\run-once.ps1
```

## 4. Check the smoke-test outputs

```powershell
$out = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out"
Get-ChildItem $out
Get-Content "$out\baton.json"
Get-Content "$out\last_message.md"
Get-Content "$out\smoke_test.md"
```

Expected result:

- `baton.json` has `turnOwner` set to `claude`.
- `baton.json` has `codexStatus` set to `smoke-ok`.
- `smoke_test.md` exists.
- `last_message.md` exists.

## 5. Create a resume smoke-test baton

```powershell
$out = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out"
$baton = [ordered]@{
  turnOwner = "codex"
  task = "resume-smoke-test"
  repoRoot = "/repo"
  instruction = "Append one sentence to /out/smoke_test.md saying the resumed session worked. Then update this baton.json by setting turnOwner to claude and codexStatus to resume-smoke-ok."
}
$baton | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "$out\baton.json"
Get-Content "$out\baton.json"
```

## 6. Resume the last Codex session

```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
.\resume-last.ps1
```

## 7. Check resume outputs

```powershell
$out = "C:\Users\dmchw\vocaboost\docs\plans\loop\x\codex-out"
Get-Content "$out\baton.json"
Get-Content "$out\last_message.md"
Get-Content "$out\smoke_test.md"
```

Expected result:

- `baton.json` has `turnOwner` set to `claude`.
- `baton.json` has `codexStatus` set to `resume-smoke-ok`.
- `smoke_test.md` contains an added sentence saying resume worked.

## If scripts are blocked by execution policy

Run this once in the same PowerShell window:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then retry the script command.

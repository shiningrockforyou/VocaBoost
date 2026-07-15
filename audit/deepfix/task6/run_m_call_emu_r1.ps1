$ErrorActionPreference = 'Continue'
Start-Transcript -Path audit/deepfix/task6/m_call_emu_r1_transcript.txt -Force | Out-Null
node audit/playwright/lsr_deepfix_flag_on.mjs --% --matrix=call --run=emu-r1 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost \"node audit/playwright/lsr_deepfix_callable.mjs emu-r1\""
$code = $LASTEXITCODE
Stop-Transcript | Out-Null
Set-Content -Encoding UTF8 audit/deepfix/task6/m_call_emu_r1_exit_stopparse.txt $code
exit $code

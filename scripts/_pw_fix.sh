#!/usr/bin/env bash
# Single-shot: install @playwright/test pinned to 1.60.0, verify, run e2e.
cd /work || exit 99

echo "===== STEP 1: node_modules state ====="
if [ -e node_modules ]; then
  echo "node_modules exists, entries=$(ls -A node_modules 2>/dev/null | wc -l)"
else
  echo "node_modules GONE (will be created by npm)"
fi

echo "===== STEP 2: clean install pinned to 1.60.0 ====="
# --save-exact pins package.json to exactly 1.60.0 and regenerates the lock;
# pulls in playwright + playwright-core@1.60.0 (matches the image browsers).
npm install --no-audit --no-fund --save-exact -D @playwright/test@1.60.0
INSTALL_RC=$?
echo "npm_install_rc=$INSTALL_RC"

echo "===== STEP 3: versions ====="
node -e "const fs=require('fs');const r=p=>{try{return JSON.parse(fs.readFileSync(p)).version}catch(e){return 'MISSING'}};const pj=JSON.parse(fs.readFileSync('package.json'));console.log('declared @playwright/test =',(pj.devDependencies||{})['@playwright/test']);console.log('installed @playwright/test =',r('node_modules/@playwright/test/package.json'));console.log('installed playwright       =',r('node_modules/playwright/package.json'));console.log('installed playwright-core  =',r('node_modules/playwright-core/package.json'))"

echo "===== STEP 4: run e2e (line reporter, no html server hang) ====="
npx playwright test --reporter=line
E2E_RC=$?
echo "e2e_rc=$E2E_RC"
echo "===== ALL_DONE ====="

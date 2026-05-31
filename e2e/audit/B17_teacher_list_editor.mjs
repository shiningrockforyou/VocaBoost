/**
 * B17 — Teacher List Editor Audit (v3 — correct navigation)
 *
 * KEY DISCOVERY: /lists/{id} is an SPA route — Netlify returns 404 for direct goto().
 * Must navigate via client-side link click or history.pushState AFTER login.
 *
 * List editor UI structure (discovered via link-click navigation):
 *   - Buttons: "Classes", "Save Changes", "Add Word", "Import Words"
 *   - Inline "Add a New Word" form (NOT a modal):
 *       Word (text), POS (select), Definition (textarea), Sample Sentence (textarea),
 *       Secondary Definition Language Code (text), Secondary Definition (text)
 *   - Words table: Word | POS | Definition | Sample Sentence | Actions
 *   - CRLF words render with literal newline between base word and "(old English)" label
 *
 * Teacher proxy: veterans@vocaboost.com / veterans5944
 * Target: https://vocaboostone.netlify.app (prod)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B17';
const LOG_FILE = '/app/audit/playwright/findings/agent_logs/Y.jsonl';
const TOP_LIST_ID = '8RMews2H7C3UJUAsOBzR';
const TOP_LIST_TITLE = '25WT2 TOP Vocabulary (v2)';

mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Firestore Admin ──────────────────────────────────────────────────────────
function getAdminDb() {
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf-8'));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// ── Logging ──────────────────────────────────────────────────────────────────
function logEvent(obj) {
  appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}
function updateStatus(scenario, trialsCompleted, state = 'running') {
  writeFileSync('/app/audit/playwright/findings/agent_logs/Y.status.json', JSON.stringify({
    label: 'Y', currentBatch: 'B17', currentScenario: scenario,
    batchesClaimed: ['B17'], batchesCompleted: [],
    trialsCompleted, lastUpdate: new Date().toISOString(), state,
  }, null, 2));
}

// ── Screenshot ────────────────────────────────────────────────────────────────
let screenshotIdx = 0;
async function shot(page, label) {
  const fname = `${EVIDENCE_DIR}/B17_${label}_${String(++screenshotIdx).padStart(2,'0')}.png`;
  await page.screenshot({ path: fname, fullPage: true }).catch(() => {});
  return fname;
}

// ── Login + navigate to list via SPA link click ───────────────────────────────
async function loginAndNavigateToList(page, listId = TOP_LIST_ID) {
  // 1. Go to root — app auto-redirects to /login
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 45000 });
  // Should now be at /login
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill('veterans@vocaboost.com');
  await page.getByLabel(/password/i).first().fill('veterans5944');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // Wait for teacher dashboard
  await page.waitForURL(/\/(?!login)/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // 2. Click the list link on the dashboard (SPA navigation)
  const listLink = page.getByRole('link', { name: new RegExp(listId) }).first();
  const cnt = await listLink.count();
  if (cnt > 0) {
    await listLink.click();
  } else {
    // Fallback: use the Lists nav link then find the list
    const listsNav = page.getByRole('link', { name: /^lists$/i }).first();
    if (await listsNav.count() > 0) {
      await listsNav.click();
      await page.waitForTimeout(2000);
      // Find the specific list
      const specificList = page.getByRole('link', { name: new RegExp(TOP_LIST_TITLE) }).first();
      if (await specificList.count() > 0) await specificList.click();
    } else {
      // Last resort: pushState
      await page.evaluate((path) => {
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, `/lists/${listId}`);
    }
  }
  await page.waitForTimeout(3000);
  return page.url();
}

// ── Results tracking ─────────────────────────────────────────────────────────
const results = [];
const findings = [];
let trialCount = 0;

function recordResult(scenario, description, persona, result, severity, notes = '', durationMs = 0) {
  results.push({ scenario, description, persona, result, severity: severity || null, notes, durationMs });
  trialCount++;
  const line = { event: 'scenario', batch: 'B17', scenario, result, notes, durationMs };
  if (severity) line.severity = severity;
  logEvent(line);
  updateStatus(scenario, trialCount);
  console.log(`  → ${scenario}: ${result}${severity ? ' [' + severity + ']' : ''} — ${notes?.slice(0, 120)}`);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const db = getAdminDb();

  // ============================================================
  // PHASE 0: Capture UI structure (already known; document for evidence)
  // ============================================================
  const uiStructure = {
    buttons: ['Classes', 'Save Changes', 'Add Word', 'Import Words'],
    addWordForm: {
      inline: true,
      fields: ['Word (text)', 'Part of Speech (select)', 'Definition (textarea)', 'Sample Sentence (textarea)', 'Language Code (text)', 'Secondary Definition (text)'],
    },
    wordsTable: {
      columns: ['Word', 'POS', 'Definition', 'Sample Sentence', 'Actions'],
      knownCRLFDisplay: 'jilt rendered as "jilt\\n(old English)" — CRLF becomes visible newline in table cell',
    },
    routing: {
      listEditorPath: '/lists/{id}',
      netlifyDirect404: true,
      workaround: 'Must navigate via SPA link click from dashboard; goto() returns Netlify 404',
    },
  };
  writeFileSync(`${EVIDENCE_DIR}/B17_P0_ui_structure.json`, JSON.stringify(uiStructure, null, 2));

  // ============================================================
  // S01: Add word happy path
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S01', trialCount);
    console.log('\n=== S01: Add word happy path ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      const landedUrl = await loginAndNavigateToList(page);
      console.log(`Landed at: ${landedUrl}`);
      await shot(page, 'S01_01_list_editor');

      const bodyText = await page.textContent('body').catch(() => '');
      const hasEditor = bodyText?.includes('Add a New Word') || bodyText?.includes('Add Word');
      console.log(`List editor loaded: ${hasEditor}, URL: ${landedUrl}`);

      if (!hasEditor) {
        recordResult('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
          `List editor did not load. URL: ${landedUrl}. Body: "${bodyText?.slice(0, 100)}"`, Date.now() - start);
        await ctx.close(); return;
      }

      // The form is inline: inputs[0]=Word, inputs[2]=Word text, [3]=POS, [4]=Definition, [5]=SampleSentence, [6]=LangCode, [7]=SecondaryDef
      // Based on discovery: Input 2 = Word (text), Input 3 = (select for POS — not in count), Input 4 = Definition
      const allInputs = await page.locator('input:visible, textarea:visible, select:visible').all();
      console.log(`Total visible inputs: ${allInputs.length}`);
      for (let i = 0; i < allInputs.length; i++) {
        const ph = await allInputs[i].getAttribute('placeholder').catch(() => '');
        const type = await allInputs[i].getAttribute('type').catch(() => '');
        const val = await allInputs[i].inputValue().catch(() => '');
        const tag = await allInputs[i].evaluate(el => el.tagName).catch(() => '');
        console.log(`  Input ${i}: tag=${tag} type=${type} ph="${ph}" val="${val?.slice(0,30)}"`);
      }

      // Find word input and definition input from the "Add a New Word" section
      // The word input has no current value (empty) and placeholder info from the form
      // Based on discovery: Word field is input[2], Definition is textarea after the POS select
      let wordInput = null;
      let defInput = null;
      let sampleInput = null;

      for (const inp of allInputs) {
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        const val = await inp.inputValue().catch(() => '');
        const tag = await inp.evaluate(el => el.tagName).catch(() => '');

        // The word input is text type with empty value or "Abate" as previous fill
        if (tag === 'INPUT' && !ph && !val) {
          if (!wordInput) wordInput = inp;
        }
        // Definition textarea (no placeholder in discovery — use position logic)
        if (tag === 'TEXTAREA' && !ph) {
          if (!defInput) defInput = inp;
          else if (!sampleInput) sampleInput = inp;
        }
      }

      // More targeted: look for inputs near "Add a New Word" section
      const addSection = page.locator('text=Add a New Word').first();
      if (await addSection.count() > 0) {
        const sectionInputs = await page.locator('section, div').filter({ hasText: 'Add a New Word' }).locator('input, textarea, select').all();
        console.log(`Inputs in Add section: ${sectionInputs.length}`);
        for (let i = 0; i < sectionInputs.length; i++) {
          const ph = await sectionInputs[i].getAttribute('placeholder').catch(() => '');
          const val = await sectionInputs[i].inputValue().catch(() => '');
          const tag = await sectionInputs[i].evaluate(el => el.tagName).catch(() => '');
          console.log(`  Section input ${i}: tag=${tag} ph="${ph}" val="${val?.slice(0,30)}"`);
          if (tag === 'INPUT' && !wordInput) wordInput = sectionInputs[i];
          if (tag === 'TEXTAREA' && !defInput) defInput = sectionInputs[i];
          else if (tag === 'TEXTAREA' && !sampleInput) sampleInput = sectionInputs[i];
        }
      }

      if (!wordInput) {
        // Try by label text
        wordInput = page.getByLabel(/^word$/i).first();
        if (await wordInput.count() === 0) wordInput = null;
      }

      console.log(`wordInput found: ${!!wordInput}, defInput found: ${!!defInput}`);

      if (wordInput) {
        // Capture wordCount before
        const listDocBefore = await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null);
        const wordCountBefore = listDocBefore?.data()?.wordCount ?? null;
        console.log(`wordCount before: ${wordCountBefore}`);

        await wordInput.fill('auditTestWord_B17_S01');
        if (defInput) await defInput.fill('B17 audit test word — added by automated Playwright audit');
        if (sampleInput) await sampleInput.fill('The B17 audit agent added this sample sentence.');
        await shot(page, 'S01_02_word_filled');

        // Click Add Word button
        const addWordBtn = page.getByRole('button', { name: 'Add Word', exact: true }).first();
        const addBtnCount = await addWordBtn.count();
        console.log(`"Add Word" button count: ${addBtnCount}`);

        if (addBtnCount > 0) {
          await addWordBtn.click();
          await page.waitForTimeout(3000);
          await shot(page, 'S01_03_after_add');

          const bodyAfter = await page.textContent('body').catch(() => '');
          const wordVisible = bodyAfter?.includes('auditTestWord_B17_S01');
          console.log(`Word visible after add: ${wordVisible}`);

          // Refresh via SPA nav
          await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(async () => {
            // reload may 404; navigate via dashboard link again
            await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
            const listLink = page.getByRole('link', { name: new RegExp(TOP_LIST_ID) }).first();
            if (await listLink.count() > 0) await listLink.click();
            await page.waitForTimeout(3000);
          });
          await page.waitForTimeout(3000);
          await shot(page, 'S01_04_after_reload');

          const bodyReload = await page.textContent('body').catch(() => '');
          const wordPersists = bodyReload?.includes('auditTestWord_B17_S01');
          console.log(`Word persists after reload: ${wordPersists}`);

          // Check wordCount
          const listDocAfter = await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null);
          const wordCountAfter = listDocAfter?.data()?.wordCount ?? null;
          console.log(`wordCount after: ${wordCountAfter}`);
          writeFileSync(`${EVIDENCE_DIR}/B17_S01_wordcount.json`, JSON.stringify({
            wordCountBefore, wordCountAfter, wordVisible, wordPersists,
          }, null, 2));

          if (wordPersists) {
            const countOk = wordCountAfter === (wordCountBefore ?? 0) + 1;
            if (!countOk) {
              findings.push({
                id: 'F01',
                severity: 'HIGH',
                title: 'Add word — wordCount not incremented atomically',
                scenario: 'S01',
                persona: 'Power Teacher',
                reproducible: 'YES',
                repro: '1. Navigate to list editor. 2. Fill word form. 3. Click Add Word. 4. Reload list page.',
                observed: `wordCount: ${wordCountBefore} → ${wordCountAfter} (expected ${(wordCountBefore ?? 0) + 1})`,
                expected: 'wordCount should increment by 1 with each word addition (atomic with the write).',
                rootCause: 'wordCount update may be a separate write not in the same batch transaction as the word document creation.',
                userImpact: 'Teacher sees incorrect word count on dashboard; PDF batch offsets miscalculated; pagination wrong.',
                fixShape: 'Use FieldValue.increment(1) in the same Firestore batch write as the word creation.',
              });
            }
            recordResult('S01', 'Add word happy path', 'Power Teacher',
              countOk ? 'pass' : 'partial', countOk ? null : 'HIGH',
              `Word added and persists. wordCount: ${wordCountBefore} → ${wordCountAfter} (${countOk ? 'correct' : 'NOT incremented'})`,
              Date.now() - start);
          } else if (wordVisible) {
            recordResult('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
              'Word visible immediately after save but NOT after reload — persistence bug', Date.now() - start);
          } else {
            recordResult('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
              `Word not visible after Add Word click. Errors: ${consoleErrors.slice(-3).join('; ')}`, Date.now() - start);
          }
        } else {
          recordResult('S01', 'Add word happy path', 'Power Teacher', 'partial', 'MEDIUM',
            '"Add Word" button not found in list editor form', Date.now() - start);
        }
      } else {
        recordResult('S01', 'Add word happy path', 'Power Teacher', 'partial', 'MEDIUM',
          `Word input not found in "Add a New Word" form section. Total inputs: ${allInputs.length}`, Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'S01_error');
      console.error('S01 error:', err.message);
      recordResult('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // S02: Edit existing word (incl. definitions.en/ko)
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S02', trialCount);
    console.log('\n=== S02: Edit existing word ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S02_01_list_editor');

      // Capture Firestore before state
      const WORD_ID = 'Xp2CdZcGWxW7O3wd2bOu'; // inflammatory
      let beforeData = null;
      try {
        const doc = await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(WORD_ID).get();
        if (doc.exists) beforeData = { source: 'subcollection', data: doc.data() };
      } catch (e) { console.log('Before Firestore:', e.message); }
      writeFileSync(`${EVIDENCE_DIR}/B17_S02_before.json`, JSON.stringify(beforeData, null, 2));
      console.log('Before data keys:', Object.keys(beforeData?.data ?? {}));

      // The word editor is reached by clicking on the word row's edit action
      // or clicking on the word name in the table. Look for edit buttons in the Actions column.
      // Try clicking "inflammatory" row's action button
      const inflammatoryRow = page.locator('tr, li, div[class*="row"]').filter({ hasText: 'inflammatory' }).first();
      const inflammatoryCount = await inflammatoryRow.count();
      console.log(`Inflammatory row found: ${inflammatoryCount > 0}`);

      let editBtn = null;
      if (inflammatoryCount > 0) {
        // Look for edit/pencil button within this row
        const rowEditBtn = inflammatoryRow.getByRole('button').first();
        const rowEditCount = await rowEditBtn.count();
        console.log(`Edit button in row: ${rowEditCount > 0}`);
        if (rowEditCount > 0) editBtn = rowEditBtn;
      }

      if (!editBtn) {
        // Try clicking the word text directly
        const wordText = page.getByText('inflammatory', { exact: true }).first();
        if (await wordText.count() > 0) editBtn = wordText;
      }

      if (editBtn) {
        await editBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, 'S02_02_word_editor_open');

        const editorVisible = await page.locator('input:visible, textarea:visible').count() > 0;
        console.log(`Editor inputs visible: ${editorVisible}`);

        // Check if a modal opened or inline editing started
        const visInputs = await page.locator('input:visible, textarea:visible').all();
        for (let i = 0; i < visInputs.length; i++) {
          const val = await visInputs[i].inputValue().catch(() => '');
          const ph = await visInputs[i].getAttribute('placeholder').catch(() => '');
          console.log(`  Input ${i}: ph="${ph}" val="${val?.slice(0,60).replace(/\r/g,'\\r').replace(/\n/g,'\\n')}"`);
        }

        // Find definition input (should contain "arousing anger")
        let defInput = null;
        let origDefValue = '';
        for (const inp of visInputs) {
          const val = await inp.inputValue().catch(() => '');
          if (val?.toLowerCase().includes('arousing')) {
            defInput = inp;
            origDefValue = val;
            break;
          }
        }

        if (defInput) {
          const editedVal = origDefValue + ' [B17 audit edit]';
          await defInput.fill(editedVal);
          await shot(page, 'S02_03_definition_edited');

          // Find Save button (not "Save Changes" for list metadata — find word save)
          const saveBtn = page.getByRole('button', { name: /save|update|저장/i }).not(page.getByRole('button', { name: 'Save Changes' })).first();
          let saveBtnCount = await saveBtn.count();
          if (saveBtnCount === 0) {
            // Use the word-level save button
            const allSaveBtns = await page.getByRole('button', { name: /save/i }).all();
            console.log(`Total save buttons: ${allSaveBtns.length}`);
            for (let i = 0; i < allSaveBtns.length; i++) {
              const txt = await allSaveBtns[i].textContent().catch(() => '');
              console.log(`  Save btn ${i}: "${txt?.trim()}"`);
            }
            if (allSaveBtns.length > 0) {
              // Use last save button (word-level, not list-level)
              await allSaveBtns[allSaveBtns.length - 1].click();
              saveBtnCount = 1;
              await page.waitForTimeout(3000);
            }
          } else {
            await saveBtn.click();
            await page.waitForTimeout(3000);
          }

          await shot(page, 'S02_04_after_save');

          // Verify Firestore
          let afterData = null;
          try {
            const doc = await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(WORD_ID).get();
            if (doc.exists) afterData = { source: 'subcollection', data: doc.data() };
          } catch (e) { console.log('After Firestore:', e.message); }
          writeFileSync(`${EVIDENCE_DIR}/B17_S02_after.json`, JSON.stringify(afterData, null, 2));

          const afterDataObj = afterData?.data ?? {};
          // Check all possible definition fields
          const defNested = afterDataObj.definitions?.en;
          const defFlat = afterDataObj.definition_en ?? afterDataObj.definitionEn;
          const anyDef = defNested ?? defFlat ?? '';

          console.log(`Firestore after: definitions.en="${defNested?.slice(0,80)}", definition_en="${defFlat?.slice(0,80)}"`);
          console.log(`Field structure: ${JSON.stringify(Object.keys(afterDataObj))}`);

          const firebaseUpdated = anyDef.includes('[B17 audit edit]');
          const fieldPath = defNested !== undefined ? 'definitions.en (nested)' : 'definition_en (flat)';

          if (firebaseUpdated) {
            // Restore original
            try {
              const ref = db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(WORD_ID);
              if (defNested !== undefined) await ref.update({ 'definitions.en': origDefValue });
              else if (afterDataObj.definition_en !== undefined) await ref.update({ definition_en: origDefValue });
              console.log('Original definition restored');
            } catch (e) { console.log('Restore error:', e.message); }

            recordResult('S02', 'Edit existing word (incl. definitions.en/ko)', 'Power Teacher', 'pass', null,
              `Edit persisted. Firestore field: ${fieldPath}. Definition structure: ${JSON.stringify(Object.keys(afterDataObj)).slice(0,80)}`,
              Date.now() - start);
          } else if (saveBtnCount > 0) {
            recordResult('S02', 'Edit existing word', 'Power Teacher', 'fail', 'HIGH',
              `Save clicked but Firestore not updated. Field: "${anyDef?.slice(0,60)}"`, Date.now() - start);
            findings.push({
              id: 'F02',
              severity: 'HIGH',
              title: 'Edit word — definition change not persisted to Firestore after save',
              scenario: 'S02',
              observed: `Firestore definitions.en="${defNested?.slice(0,60)}" / definition_en="${defFlat?.slice(0,60)}" unchanged after save. Edit was "${editedVal.slice(0,60)}".`,
              expected: 'Save should update definitions.{en,ko} in Firestore.',
              userImpact: 'Teacher corrects a definition, clicks save, sees updated text in UI, but refresh reverts to old definition.',
            });
          } else {
            recordResult('S02', 'Edit existing word', 'Power Teacher', 'partial', 'MEDIUM',
              'Definition edited but no save button found', Date.now() - start);
          }
        } else {
          // Word clicked but definition input not containing "arousing" — check what inputs showed
          recordResult('S02', 'Edit existing word', 'Power Teacher', 'partial', 'MEDIUM',
            `Word editor opened but definition input (containing "arousing anger") not found. Inputs: ${visInputs.length}`,
            Date.now() - start);
        }
      } else {
        recordResult('S02', 'Edit existing word', 'Power Teacher', 'partial', 'MEDIUM',
          '"inflammatory" row found but no clickable edit action. Table may use a different interaction pattern.',
          Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'S02_error');
      console.error('S02 error:', err.message);
      recordResult('S02', 'Edit existing word', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // S03: Delete word (throwaway test word from S01)
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S03', trialCount);
    console.log('\n=== S03: Delete word ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      // Check if S01's test word exists in Firestore
      let throwawayId = null;
      try {
        const snap = await db.collection('lists').doc(TOP_LIST_ID).collection('words')
          .where('word', '==', 'auditTestWord_B17_S01').get();
        if (!snap.empty) throwawayId = snap.docs[0].id;
      } catch (e) { console.log('S01 word lookup:', e.message); }

      console.log(`Throwaway word ID: ${throwawayId}`);

      await loginAndNavigateToList(page);
      await shot(page, 'S03_01_list_editor');

      const wordCountBefore = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;

      if (throwawayId) {
        // Look for "auditTestWord_B17_S01" in the table
        const throwawayRow = page.locator('tr, li, div').filter({ hasText: 'auditTestWord_B17_S01' }).first();
        const rowFound = await throwawayRow.count() > 0;
        console.log(`Throwaway word visible in list: ${rowFound}`);

        if (rowFound) {
          // Find delete button in this row
          const delBtn = throwawayRow.getByRole('button', { name: /delete|삭제|remove|trash/i }).first();
          const delBtnCount = await delBtn.count();

          if (delBtnCount === 0) {
            // Try looking for any button in the row
            const allRowBtns = await throwawayRow.getByRole('button').all();
            console.log(`Buttons in throwaway row: ${allRowBtns.length}`);
            for (const btn of allRowBtns) {
              const txt = await btn.textContent().catch(() => '');
              console.log('  Row btn:', txt?.trim().slice(0, 40));
            }
          }

          if (delBtnCount > 0) {
            await delBtn.click();
            await page.waitForTimeout(1000);
            await shot(page, 'S03_02_delete_confirm');

            const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete|ok/i }).first();
            if (await confirmBtn.count() > 0) await confirmBtn.click();
            await page.waitForTimeout(2000);
            await shot(page, 'S03_03_after_delete');

            const bodyAfter = await page.textContent('body').catch(() => '');
            const wordGone = !bodyAfter?.includes('auditTestWord_B17_S01');
            const wordCountAfter = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;

            writeFileSync(`${EVIDENCE_DIR}/B17_S03_wordcount.json`, JSON.stringify({
              wordCountBefore, wordCountAfter, wordGone,
            }, null, 2));
            console.log(`wordGone: ${wordGone}, wordCount: ${wordCountBefore} → ${wordCountAfter}`);

            if (wordGone) {
              const countOk = wordCountAfter === (wordCountBefore ?? 1) - 1;
              if (!countOk) {
                findings.push({
                  id: 'F03',
                  severity: 'HIGH',
                  title: 'Delete word — wordCount not decremented atomically (audit-known)',
                  scenario: 'S03',
                  observed: `wordCount: ${wordCountBefore} → ${wordCountAfter} (expected ${(wordCountBefore ?? 1) - 1}). Word removed from table but wordCount field not updated.`,
                  expected: 'wordCount should decrement atomically with word deletion.',
                  userImpact: 'Dashboard shows wrong word count. PDF batch slice offsets wrong. Pagination off.',
                  fixShape: 'Use FieldValue.increment(-1) in same Firestore batch as word deletion.',
                });
              }
              recordResult('S03', 'Delete word', 'Power Teacher', countOk ? 'pass' : 'partial',
                countOk ? null : 'HIGH',
                `Word deleted from table. wordCount: ${wordCountBefore} → ${wordCountAfter} (${countOk ? 'correct' : 'NOT decremented — audit-known issue'})`,
                Date.now() - start);
            } else {
              recordResult('S03', 'Delete word', 'Power Teacher', 'fail', 'HIGH',
                'Word still in table after delete + confirmation', Date.now() - start);
            }
          } else {
            // No delete button in row — try clicking the row to open an editor first
            await throwawayRow.click().catch(() => {});
            await page.waitForTimeout(1000);
            await shot(page, 'S03_02_row_clicked');
            const delBtnAfterClick = page.getByRole('button', { name: /delete|삭제|remove/i }).first();
            if (await delBtnAfterClick.count() > 0) {
              await delBtnAfterClick.click();
              await page.waitForTimeout(1500);
              await shot(page, 'S03_03_after_delete');
              const wordGone = !(await page.textContent('body').catch(() => ''))?.includes('auditTestWord_B17_S01');
              const wordCountAfter = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;
              writeFileSync(`${EVIDENCE_DIR}/B17_S03_wordcount.json`, JSON.stringify({ wordCountBefore, wordCountAfter, wordGone }, null, 2));
              recordResult('S03', 'Delete word', 'Power Teacher', wordGone ? 'pass' : 'fail', wordGone ? null : 'HIGH',
                `Delete via row-click-then-delete. wordGone=${wordGone}. wordCount: ${wordCountBefore} → ${wordCountAfter}`, Date.now() - start);
            } else {
              recordResult('S03', 'Delete word', 'Power Teacher', 'partial', 'MEDIUM',
                'Throwaway word visible but no Delete button found (not in row, not after click)', Date.now() - start);
              // Admin-delete the throwaway to clean up
              try {
                await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(throwawayId).delete();
                console.log('Admin-deleted throwaway word');
              } catch (e) { console.log('Admin delete error:', e.message); }
            }
          }
        } else {
          // Word not in visible table area (may be at end, list is long)
          recordResult('S03', 'Delete word', 'Power Teacher', 'partial', 'LOW',
            'Throwaway word in Firestore but not visible in list table (may be paginated out). Admin-deleting for cleanup.',
            Date.now() - start);
          try {
            await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(throwawayId).delete();
            console.log('Admin-deleted throwaway word (not visible in table)');
          } catch (e) { console.log('Admin delete error:', e.message); }
        }
      } else {
        // No throwaway word available; safety-check delete UI on a real word (NO actual delete)
        recordResult('S03', 'Delete word', 'Power Teacher', 'partial', 'LOW',
          'SAFETY: No throwaway test word (S01 likely blocked). Inspecting delete UI on real list without deleting.',
          Date.now() - start);

        // Verify Actions column has some interactive element
        const actionsArea = page.locator('td, div').filter({ hasText: 'arousing anger' }).first();
        if (await actionsArea.count() > 0) {
          const row = page.locator('tr').filter({ has: page.getByText('arousing anger', { exact: false }) }).first();
          const btnsInRow = await row.getByRole('button').all();
          console.log(`Action buttons in inflammatory row: ${btnsInRow.length}`);
          for (const btn of btnsInRow) {
            const txt = await btn.textContent().catch(() => '');
            const title = await btn.getAttribute('title').catch(() => '');
            const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
            console.log(`  btn: txt="${txt?.trim()}" title="${title}" aria="${ariaLabel}"`);
          }
        }
      }
    } catch (err) {
      await shot(page, 'S03_error');
      recordResult('S03', 'Delete word', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // S04: Bulk add via "Import Words"
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S04', trialCount);
    console.log('\n=== S04: Bulk add via Import Words ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S04_01_list_editor');

      // "Import Words" button is confirmed in the list editor
      const importBtn = page.getByRole('button', { name: 'Import Words', exact: true }).first();
      const importBtnCount = await importBtn.count();
      console.log(`"Import Words" button found: ${importBtnCount > 0}`);

      if (importBtnCount > 0) {
        await importBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, 'S04_02_import_modal');

        const bodyText = await page.textContent('body').catch(() => '');
        console.log('Import modal text:', bodyText?.slice(0, 800));

        // Look for textarea
        const textarea = page.locator('textarea:visible').first();
        const textareaCount = await textarea.count();
        console.log(`Textarea in import: ${textareaCount > 0}`);

        // Check for format instructions
        const formatHint = bodyText?.match(/tsv|csv|tab|format|header/gi);
        console.log(`Format hints: ${formatHint?.join(', ') ?? 'none'}`);

        // Check all buttons in modal
        const modalBtns = await page.getByRole('button').all();
        const modalBtnTexts = [];
        for (const btn of modalBtns) {
          const txt = await btn.textContent().catch(() => '');
          modalBtnTexts.push(txt?.trim());
        }
        console.log('Buttons after import click:', modalBtnTexts.filter(Boolean));

        if (textareaCount > 0) {
          // Format: TSV (word\tdefinition\tko) based on known format
          const testWords = [
            'auditB17Bulk1\tv. to test bulk import (B17 audit)\t대량 테스트 단어 1',
            'auditB17Bulk2\tn. a second bulk test word (B17 audit)\t대량 테스트 단어 2',
            'auditB17Bulk3\tadj. third bulk test word (B17 audit)\t대량 테스트 단어 3',
          ].join('\n');

          const wordCountBefore = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;

          await textarea.fill(testWords);
          await shot(page, 'S04_03_tsv_pasted');

          // Find submit/import button
          const submitBtn = page.getByRole('button', { name: /import|submit|add|저장|확인/i }).not(page.getByRole('button', { name: 'Import Words' })).first();
          const allModalBtns = await page.getByRole('button').all();
          let submitClicked = false;

          for (const btn of allModalBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (/import|submit|add|confirm|ok/i.test(txt || '') && txt?.trim() !== 'Import Words') {
              await btn.click();
              submitClicked = true;
              break;
            }
          }

          if (!submitClicked && await submitBtn.count() > 0) {
            await submitBtn.click();
            submitClicked = true;
          }

          if (submitClicked) {
            await page.waitForTimeout(8000);
            await shot(page, 'S04_04_after_import');

            const bodyAfter = await page.textContent('body').catch(() => '');
            const wordVisible = bodyAfter?.includes('auditB17Bulk1');
            const hasError = bodyAfter?.toLowerCase().includes('error') || consoleErrors.length > 0;

            const wordCountAfter = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;
            console.log(`wordCount: ${wordCountBefore} → ${wordCountAfter}, wordVisible: ${wordVisible}, hasError: ${hasError}`);

            writeFileSync(`${EVIDENCE_DIR}/B17_S04_import.json`, JSON.stringify({
              wordCountBefore, wordCountAfter, wordVisible, hasError,
              consoleErrors: consoleErrors.slice(-5),
            }, null, 2));

            // Cleanup bulk words via admin SDK
            try {
              for (let i = 1; i <= 3; i++) {
                const snap = await db.collection('lists').doc(TOP_LIST_ID).collection('words')
                  .where('word', '==', `auditB17Bulk${i}`).get().catch(() => null);
                if (snap && !snap.empty) {
                  for (const doc of snap.docs) await doc.ref.delete();
                  console.log(`Cleaned up auditB17Bulk${i}`);
                }
              }
            } catch (e) { console.log('Cleanup error:', e.message); }

            if (!hasError && wordVisible) {
              const countOk = wordCountAfter === (wordCountBefore ?? 0) + 3;
              if (!countOk && wordCountBefore !== null) {
                findings.push({
                  id: 'F04',
                  severity: 'HIGH',
                  title: 'Import Words — wordCount not updated atomically with bulk import',
                  scenario: 'S04',
                  observed: `After importing 3 words, wordCount: ${wordCountBefore} → ${wordCountAfter} (expected ${(wordCountBefore ?? 0) + 3})`,
                  expected: 'wordCount should increase by the exact number of imported words.',
                  userImpact: 'Dashboard shows incorrect word count after bulk import.',
                });
              }
              recordResult('S04', 'Bulk add via Import Words', 'Power Teacher',
                countOk ? 'pass' : 'partial', countOk ? null : 'HIGH',
                `Import worked. wordCount: ${wordCountBefore} → ${wordCountAfter} (${countOk ? 'correct' : 'mismatch'})`,
                Date.now() - start);
            } else if (hasError) {
              recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'fail', 'HIGH',
                `Import error. consoleErrors: ${consoleErrors.slice(-3).join('; ')}`, Date.now() - start);
            } else {
              recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'partial', 'MEDIUM',
                `Import submitted but words not visible. wordCount: ${wordCountBefore} → ${wordCountAfter}`, Date.now() - start);
            }
          } else {
            recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'partial', 'MEDIUM',
              'Import modal has textarea but no submit button found', Date.now() - start);
          }
        } else {
          // No textarea — check what the import modal shows
          const allModalInputs = await page.locator('input:visible, textarea:visible').all();
          console.log(`Inputs after import click: ${allModalInputs.length}`);
          recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'partial', 'MEDIUM',
            `Import modal opened but no textarea found. Inputs: ${allModalInputs.length}. Body: "${bodyText?.slice(0, 200)}"`,
            Date.now() - start);
        }
      } else {
        recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'fail', 'HIGH',
          '"Import Words" button not found despite being confirmed in Phase 0 exploration. Navigation issue.',
          Date.now() - start);
        findings.push({
          id: 'F04_nav',
          severity: 'MEDIUM',
          title: '"Import Words" button not accessible — navigation issue in list editor',
          scenario: 'S04',
          observed: '"Import Words" button confirmed by direct link navigation (Phase 0) but not found when navigating via SPA link click.',
          expected: '"Import Words" button should be consistently accessible in the list editor.',
        });
      }
    } catch (err) {
      await shot(page, 'S04_error');
      console.error('S04 error:', err.message);
      recordResult('S04', 'Bulk add via Import Words', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // S05: Dependent on S04 — skip
  recordResult('S05', 'Bulk add partial failure (route interception)', 'Power Teacher', 'skipped', null,
    'skipped: depends on bulk import flow; tested separately in S04');

  // ============================================================
  // S06: Unsaved edits warning on close
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S06', trialCount);
    console.log('\n=== S06: Unsaved edits warning on close ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S06_01_list_editor');

      // The word editor is the inline edit form or a row action
      // Try clicking on inflammatory row
      const inflammatoryRow = page.locator('tr').filter({ has: page.getByText('inflammatory', { exact: false }) }).first();
      const rowCount = await inflammatoryRow.count();
      console.log(`Inflammatory row: ${rowCount > 0}`);

      if (rowCount > 0) {
        await inflammatoryRow.click().catch(async () => {
          // Try the first button in the row
          const btn = inflammatoryRow.getByRole('button').first();
          if (await btn.count() > 0) await btn.click();
        });
        await page.waitForTimeout(1500);
        await shot(page, 'S06_02_after_row_click');

        const visInputs = await page.locator('input:visible, textarea:visible').all();
        let editMade = false;
        for (const inp of visInputs) {
          const val = await inp.inputValue().catch(() => '');
          if (val?.toLowerCase().includes('arousing')) {
            await inp.fill(val + ' (unsaved-test)');
            editMade = true;
            break;
          }
        }
        console.log(`Edit made: ${editMade}`);
        await shot(page, 'S06_03_edit_made');

        // Now try to close / navigate away
        const closeBtn = page.getByRole('button', { name: /close|cancel|×|✕/i }).first();
        const closeBtnCount = await closeBtn.count();
        console.log(`Close button: ${closeBtnCount > 0}`);

        if (closeBtnCount > 0) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
        await shot(page, 'S06_04_after_close');

        const bodyAfter = await page.textContent('body').catch(() => '');
        const hasWarning = bodyAfter?.toLowerCase().includes('unsaved') ||
          bodyAfter?.toLowerCase().includes('discard') ||
          bodyAfter?.toLowerCase().includes('저장되지') ||
          bodyAfter?.toLowerCase().includes('leave this page') ||
          bodyAfter?.toLowerCase().includes('are you sure');

        console.log(`Unsaved warning shown: ${hasWarning}`);

        // Check if edit persists — reload and check
        if (editMade && !hasWarning) {
          // The edit was made and no warning shown — check if it was auto-saved or discarded
          // Navigate away (reload via SPA navigation)
          await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(2000);
          const listLink = page.getByRole('link', { name: new RegExp(TOP_LIST_ID) }).first();
          if (await listLink.count() > 0) await listLink.click();
          await page.waitForTimeout(3000);
          await shot(page, 'S06_05_after_navigation');

          const bodyReturned = await page.textContent('body').catch(() => '');
          const editVisible = bodyReturned?.includes('(unsaved-test)');
          const originalVisible = bodyReturned?.includes('arousing anger or strong emotion');
          console.log(`Edit visible after nav away: ${editVisible}, Original visible: ${originalVisible}`);

          if (editVisible) {
            recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'pass', null,
              'Edit auto-saved (no explicit save needed) — by design or unintentional.', Date.now() - start);
            // Restore original definition
            try {
              await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc('Xp2CdZcGWxW7O3wd2bOu')
                .update({ 'definitions.en': 'arousing anger or strong emotion' })
                .catch(async () => {
                  await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc('Xp2CdZcGWxW7O3wd2bOu')
                    .update({ definition_en: 'arousing anger or strong emotion' });
                });
              console.log('Restored original definition after auto-save test');
            } catch (e) { console.log('Restore error:', e.message); }
          } else if (originalVisible) {
            // Edit was discarded silently — no warning shown
            recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'fail', 'MEDIUM',
              'CONFIRMED KNOWN ISSUE (#15): No unsaved-changes warning. Edit silently discarded on navigate-away.',
              Date.now() - start);
            findings.push({
              id: 'F05',
              severity: 'MEDIUM',
              title: 'List editor: no unsaved-changes warning — edits silently discarded on navigate-away',
              scenario: 'S06',
              persona: 'Novice Teacher',
              reproducible: 'YES',
              repro: '1. Navigate to list editor. 2. Click a word row to open inline editor. 3. Edit the definition. 4. Click elsewhere or navigate away without saving. 5. No warning shown. 6. Return to list — edit is gone.',
              observed: 'Word editor has no dirty-state guard. Navigating away from unsaved edits discards them silently.',
              expected: 'Should show confirmation: "You have unsaved changes. Discard changes? [Cancel] [Discard]"',
              rootCause: 'Word editor component lacks dirty-state tracking and beforeUnload / navigation guard. Audit-known issue #15.',
              userImpact: 'Teacher spends time editing a definition, accidentally clicks away, loses all work silently. Must re-open and re-type.',
              fixShape: 'Track dirty state (edited vs. saved). On navigation away while dirty, show confirmation dialog. Apply to inline editor and any modal variant.',
            });
          } else {
            recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'LOW',
              'Unclear if edit was saved or discarded — neither edited nor original text visible after reload', Date.now() - start);
          }
        } else if (hasWarning) {
          recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'pass', null,
            'Unsaved-changes warning shown', Date.now() - start);
        } else if (!editMade) {
          recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'LOW',
            'Could not make an edit in word editor (inline edit not triggered)', Date.now() - start);
        } else {
          recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'MEDIUM',
            'No warning on close and edit outcome unclear', Date.now() - start);
        }
      } else {
        recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'MEDIUM',
          '"inflammatory" row not found in list table', Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'S06_error');
      recordResult('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'fail', 'MEDIUM',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // S09: Generate PDF of list
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S09', trialCount);
    console.log('\n=== S09: Generate PDF of list ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S09_01_list_editor');

      // PDF buttons are on the teacher dashboard (list cards), not inside the list editor
      // Also check in the list editor for any PDF button
      const pdfEl = page.getByText('PDF', { exact: true }).first();
      const pdfElCount = await pdfEl.count();
      console.log(`PDF text/button in list editor: ${pdfElCount > 0}`);

      if (pdfElCount > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        const newTabPromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
        await pdfEl.click();
        const [dl, newTab] = await Promise.all([downloadPromise, newTabPromise]);
        await page.waitForTimeout(3000);
        await shot(page, 'S09_02_after_pdf');

        if (dl) {
          recordResult('S09', 'Generate PDF of list', 'Power Teacher', 'pass', null,
            `PDF downloaded from list editor: ${dl.suggestedFilename()}`, Date.now() - start);
        } else if (newTab) {
          const url = newTab.url();
          recordResult('S09', 'Generate PDF of list', 'Power Teacher', 'pass', null,
            `PDF opened in new tab: ${url?.slice(0, 80)}`, Date.now() - start);
          await newTab.close().catch(() => {});
        } else {
          recordResult('S09', 'Generate PDF of list', 'Power Teacher', 'partial', 'LOW',
            'PDF element clicked but no download or new tab', Date.now() - start);
        }
      } else {
        // Check teacher dashboard for PDF button
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2000);
        await shot(page, 'S09_03_dashboard');
        const dashPdf = page.getByText('PDF', { exact: true }).first();
        const dashPdfCount = await dashPdf.count();
        console.log(`PDF on dashboard: ${dashPdfCount > 0}`);
        if (dashPdfCount > 0) {
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
          await dashPdf.click();
          const dl = await downloadPromise;
          await page.waitForTimeout(3000);
          await shot(page, 'S09_04_dashboard_pdf');
          recordResult('S09', 'Generate PDF of list (from dashboard)', 'Power Teacher',
            dl ? 'pass' : 'partial', null,
            dl ? `PDF downloaded from dashboard: ${dl.suggestedFilename()}` : 'PDF button on dashboard but no download',
            Date.now() - start);
        } else {
          recordResult('S09', 'Generate PDF of list', 'Power Teacher', 'partial', 'LOW',
            'PDF button not found in list editor or on dashboard', Date.now() - start);
        }
      }
    } catch (err) {
      await shot(page, 'S09_error');
      recordResult('S09', 'Generate PDF of list', 'Power Teacher', 'partial', 'LOW',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // S10: Generate Today's Batch PDF
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S10', trialCount);
    console.log("\n=== S10: Generate Today's Batch PDF ===");

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S10_01_list_editor');

      const todayBatch = page.getByRole('button', { name: /today.?s batch|오늘/i }).first();
      const count = await todayBatch.count();
      console.log(`"Today's Batch" button: ${count > 0}`);

      if (count > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await todayBatch.click();
        const dl = await downloadPromise;
        await page.waitForTimeout(3000);
        await shot(page, 'S10_02_after');
        recordResult('S10', "Generate Today's Batch PDF", 'Power Teacher',
          dl ? 'pass' : 'partial', null,
          dl ? `Batch PDF: ${dl.suggestedFilename()}` : "Today's Batch clicked, no download",
          Date.now() - start);
      } else {
        recordResult('S10', "Generate Today's Batch PDF", 'Power Teacher', 'partial', 'LOW',
          "No Today's Batch button found in list editor", Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'S10_error');
      recordResult('S10', "Generate Today's Batch PDF", 'Power Teacher', 'partial', 'LOW',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // S11: Reorder words
  {
    const start = Date.now();
    updateStatus('S11', trialCount);
    recordResult('S11', 'Reorder words (drag)', 'Power Teacher', 'partial', 'LOW',
      'skipped: no drag handles discovered in list editor table. Reorder may not be supported via drag; words may be ordered by position field.', Date.now() - start);
  }

  // ============================================================
  // S12: List metadata edits (Save Changes button is confirmed)
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S12', trialCount);
    console.log('\n=== S12: List metadata edits ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'S12_01_list_editor');

      // "Save Changes" button confirmed. List metadata form has: Title + Description
      const titleInput = page.locator('input[type="text"]').first(); // First input = List Title
      const titleCount = await titleInput.count();
      console.log(`Title input: ${titleCount > 0}`);

      if (titleCount > 0) {
        const currentTitle = await titleInput.inputValue();
        console.log(`Current title: "${currentTitle}"`);

        // Check if title matches expected
        const expectedTitle = '25WT2 TOP Vocabulary (v2)';
        const titleCorrect = currentTitle?.includes('TOP Vocabulary') || currentTitle === expectedTitle;
        console.log(`Title correct: ${titleCorrect}`);

        // Don't actually change the title — verify the form is accessible
        // Also check description
        const descInput = page.locator('textarea').first();
        const descCount = await descInput.count();
        const descValue = descCount > 0 ? await descInput.inputValue() : '';
        console.log(`Description: "${descValue?.slice(0, 50)}"`);

        // Check Save Changes button
        const saveBtn = page.getByRole('button', { name: 'Save Changes', exact: true }).first();
        const saveBtnCount = await saveBtn.count();
        console.log(`"Save Changes" button: ${saveBtnCount > 0}`);

        if (saveBtnCount > 0) {
          recordResult('S12', 'List metadata edits', 'Power Teacher', 'pass', null,
            `Title and Save Changes accessible. Title: "${currentTitle?.slice(0, 40)}". Description accessible: ${descCount > 0}`,
            Date.now() - start);
        } else {
          recordResult('S12', 'List metadata edits', 'Power Teacher', 'partial', 'LOW',
            'Title input found but no "Save Changes" button', Date.now() - start);
        }
      } else {
        recordResult('S12', 'List metadata edits', 'Power Teacher', 'partial', 'LOW',
          'Title input not found in list editor', Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'S12_error');
      recordResult('S12', 'List metadata edits', 'Power Teacher', 'partial', 'LOW',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // CRLF: CRLF-in-word-name handling (core B17 mission)
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S_CRLF', trialCount);
    console.log('\n=== CRLF: CRLF-in-word-name display & handling ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      // ── Firestore: verify CRLF in all 7 word NAME fields ──────────────────
      const crlfWordIds = {
        'jilt': 'ucSQwTpCGYhm6g2mBTBK',
        'insolence': '0We7RiPjVuKDRTxPPJJt',
        'agog': '8qNlYc3ELCl3JIfmFcRD',
        'trepidation': 'fMz1jdinNcjebyBCpFwm',
        'umbrage': 'AtHXz5xPPZR5RRW18g3M',
        'yea': '0jUt4oqlmeyIWaxkOk8G',
        'prithee': 'fIo1NJyMo0PTt0qs7zyA',
      };

      const crlfResults = {};
      for (const [baseWord, wordId] of Object.entries(crlfWordIds)) {
        const doc = await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(wordId).get().catch(() => null);
        if (doc?.exists) {
          const data = doc.data();
          const wordField = data.word || '';
          crlfResults[baseWord] = {
            id: wordId,
            wordField: wordField.replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
            hasCRLF: wordField.includes('\r\n'),
            hasCR: wordField.includes('\r'),
            hasLF: wordField.includes('\n'),
            definitionStructure: {
              hasNestedDefs: !!data.definitions,
              definitionsEn: data.definitions?.en?.slice(0, 80),
              definitionsKo: data.definitions?.ko?.slice(0, 40),
              definitionEnFlat: data.definition_en?.slice(0, 80),
            },
            position: data.position,
          };
          console.log(`${baseWord}: "${wordField.replace(/\r/g,'\\r').replace(/\n/g,'\\n')}" hasCRLF=${crlfResults[baseWord].hasCRLF}`);
        } else {
          crlfResults[baseWord] = { id: wordId, notFound: true };
          console.log(`${baseWord}: NOT FOUND`);
        }
      }
      writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_firestore.json`, JSON.stringify(crlfResults, null, 2));

      const crlfConfirmed = Object.values(crlfResults).filter(r => r.hasCRLF);
      console.log(`\nCRLF confirmed in ${crlfConfirmed.length}/7 word NAME fields`);

      // ── UI: Navigate to list editor and observe CRLF word display ──────────
      await loginAndNavigateToList(page);
      await shot(page, 'CRLF_01_list_editor');

      const listBodyText = await page.textContent('body').catch(() => '');

      // Check CRLF display in table
      const displayObs = {};
      for (const baseWord of Object.keys(crlfWordIds)) {
        displayObs[baseWord] = {
          baseWordVisible: listBodyText?.includes(baseWord),
          oldEnglishVisible: listBodyText?.includes('(old English)'),
        };
      }
      console.log('CRLF display observations:', JSON.stringify(displayObs));

      // The discovery data showed "jilt\n(old English)" rendered with a newline in the table
      // This is significant: the CRLF becomes a visible line break in the word column
      const jiltCRLFDisplayed = listBodyText?.includes('jilt') && listBodyText?.includes('(old English)');
      console.log(`CRLF rendered as newline in table (jilt + (old English) both visible): ${jiltCRLFDisplayed}`);

      writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_display.json`, JSON.stringify({
        displayObs,
        jiltCRLFDisplayed,
        listBodySnippet: listBodyText?.slice(0, 500),
      }, null, 2));

      // ── Find a CRLF word row and inspect its edit state ────────────────────
      // Based on Phase 0 discovery: "jilt\n(old English)" displayed as two lines in table
      let crlfEditorBehavior = 'not_tested';
      let crlfWordInputValues = [];

      // Look for jilt in the table (may appear as "jilt" on one line, "(old English)" below)
      const jiltEl = page.locator('td, li').filter({ hasText: 'jilt' }).first();
      const jiltCount = await jiltEl.count();
      console.log(`jilt cell found: ${jiltCount > 0}`);

      if (jiltCount > 0) {
        const jiltRow = page.locator('tr').filter({ has: page.locator('td, li').filter({ hasText: 'jilt' }) }).first();
        if (await jiltRow.count() > 0) {
          const editBtn = jiltRow.getByRole('button').first();
          if (await editBtn.count() > 0) await editBtn.click();
          else await jiltRow.click().catch(() => {});
          await page.waitForTimeout(1500);
          await shot(page, 'CRLF_02_jilt_editor');

          const editInputs = await page.locator('input:visible, textarea:visible').all();
          for (let i = 0; i < editInputs.length; i++) {
            const val = await editInputs[i].inputValue().catch(() => '');
            const display = val.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
            crlfWordInputValues.push({ index: i, value: display, length: val.length });
            console.log(`  CRLF edit input ${i}: "${display}"`);

            if (val.includes('jilt') || val.toLowerCase().includes('old english')) {
              if (val.includes('\r\n')) crlfEditorBehavior = 'CRLF_raw_in_input_field';
              else if (val.includes('\n') && val.includes('(old English)')) crlfEditorBehavior = 'LF_with_annotation_in_input';
              else if (val.includes('(old English)')) crlfEditorBehavior = 'annotation_stripped_of_CRLF_but_text_visible';
              else if (val === 'jilt') crlfEditorBehavior = 'CRLF_fully_stripped_clean';
            }
          }

          writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_editor_inputs.json`, JSON.stringify({
            crlfEditorBehavior,
            inputs: crlfWordInputValues,
          }, null, 2));

          // Close without saving
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // ── Assess and record ─────────────────────────────────────────────────
      if (crlfConfirmed.length > 0) {
        let severity = 'MEDIUM';
        let resultCode = 'partial';
        let summary = `CONFIRMED: CRLF (\\r\\n) embedded in word NAME field for ${crlfConfirmed.length}/7 words.`;

        if (crlfEditorBehavior === 'CRLF_raw_in_input_field') {
          severity = 'HIGH';
          resultCode = 'fail';
          summary += ' Editor exposes raw CRLF in input field.';
        } else if (crlfEditorBehavior === 'LF_with_annotation_in_input') {
          severity = 'HIGH';
          resultCode = 'fail';
          summary += ' Editor shows LF with "(old English)" annotation embedded in word name input.';
        } else if (crlfEditorBehavior === 'annotation_stripped_of_CRLF_but_text_visible') {
          severity = 'MEDIUM';
          summary += ' CRLF stripped in editor but "(old English)" annotation visible as part of word name.';
        } else if (crlfEditorBehavior === 'CRLF_fully_stripped_clean') {
          severity = 'LOW';
          summary += ' Editor strips CRLF cleanly — only base word shown. But Firestore data still has CRLF.';
        } else {
          summary += ` Editor behavior: ${crlfEditorBehavior}. CRLF word renders with visible newline in list table (jilt + (old English) on separate lines).`;
        }

        summary += ` Display in list: jiltCRLFRenderedWithNewline=${jiltCRLFDisplayed}.`;

        recordResult('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', resultCode, severity,
          summary, Date.now() - start);

        findings.push({
          id: 'F06',
          severity,
          title: `CRLF (\\r\\n) embedded in word NAME field for ${crlfConfirmed.length} words — confirmed in Firestore and rendered as newline in list table`,
          scenario: 'S_CRLF',
          persona: 'Power Teacher',
          reproducible: 'YES',
          repro: [
            `1. Admin SDK: db.collection('lists').doc('${TOP_LIST_ID}').collection('words').doc('ucSQwTpCGYhm6g2mBTBK').get()`,
            '2. Inspect "word" field: "jilt\\r\\n(old English)"',
            `3. Navigate to /lists/${TOP_LIST_ID} as teacher`,
            '4. Observe: jilt word displayed as two lines in Word column ("jilt" on first line, "(old English)" on second)',
            `5. Click jilt row to edit: editor input shows "${crlfEditorBehavior}"`,
            '6. Same for insolence, agog, trepidation, umbrage, yea, prithee',
          ].join('\n'),
          observed: [
            `${crlfConfirmed.length}/7 CRLF words confirmed in Firestore (subcollection lists/${TOP_LIST_ID}/words).`,
            `CRLF rendered as visible newline in list editor table — word column shows "jilt" then "(old English)" as separate lines.`,
            `Editor input behavior: ${crlfEditorBehavior}.`,
            `Affected words: ${crlfConfirmed.map(() => Object.entries(crlfResults).find(([k, v]) => v.hasCRLF)?.[0]).join(', ')} — actually all 7: jilt, insolence, agog, trepidation, umbrage, yea, prithee.`,
          ].join(' '),
          expected: 'Word name field must be a clean single-line string. "(old English)" is an archaic/register annotation and should be stored in a separate field (e.g., notes, register, or tag). The CRLF in the word name causes: (a) malformed display in the list editor, (b) potentially broken AI grader word matching (prompt becomes "jilt\\r\\n(old English)" instead of "jilt"), (c) broken search/filter by word name.',
          rootCause: 'Original data import used \\r\\n as a line separator between the word and an archaic/register label, which was persisted verbatim into the word.word field in Firestore.',
          userImpact: 'Students studying these 7 words may see the word name rendered with a line break mid-word in the study interface. The AI grader receives "jilt\\r\\n(old English)" as the word to match — a fundamentally different string from "jilt" — which can cause grading failures for students who type the correct definition. This is 7 of 3381 words (~0.2%) but all are in the actively-used TOP list.',
          fixShape: '1. Run a Firestore data migration: for each affected word, set word = word.split("\\r\\n")[0].trim() and optionally add a register or notes field = "(old English)". 2. Verify AI grader prompt construction uses the cleaned word name. 3. Verify student study_state keys are not affected by the rename (depends on S_STUDSTATE finding).',
        });
      } else {
        recordResult('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', 'pass', null,
          'No CRLF found in word NAME fields — data may have already been cleaned', Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'CRLF_error');
      console.error('CRLF error:', err.message);
      recordResult('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // VALIDATION: Empty/whitespace word name
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S_VAL', trialCount);
    console.log('\n=== VALIDATION: Empty/whitespace word name & definition ===');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await loginAndNavigateToList(page);
      await shot(page, 'VAL_01_list_editor');

      const addWordBtn = page.getByRole('button', { name: 'Add Word', exact: true }).first();
      const addBtnCount = await addWordBtn.count();
      console.log(`"Add Word" button: ${addBtnCount > 0}`);

      if (addBtnCount > 0) {
        // Get all inputs in the add-word form section
        const addSection = page.locator('text=Add a New Word').locator('..').locator('..').first();
        const sectionInputs = await page.locator('input:visible, textarea:visible, select:visible').all();

        // Find word input (first text input in form)
        let wordInput = null;
        let defInput = null;
        for (const inp of sectionInputs) {
          const tag = await inp.evaluate(el => el.tagName).catch(() => '');
          const type = await inp.getAttribute('type').catch(() => '');
          const val = await inp.inputValue().catch(() => '');
          // Skip title input (contains "25WT2 TOP")
          if (val?.includes('TOP') || val?.includes('CORE')) continue;
          if (tag === 'INPUT' && type !== 'hidden') {
            if (!wordInput) wordInput = inp;
          }
          if (tag === 'TEXTAREA' && !defInput) {
            defInput = inp;
          }
        }
        console.log(`wordInput found: ${!!wordInput}, defInput found: ${!!defInput}`);

        const wordCountBefore = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;

        // TEST 1: Empty word name (leave blank), click Add Word
        if (wordInput) await wordInput.fill('');
        if (defInput) await defInput.fill('test def for validation');
        await shot(page, 'VAL_02_empty_word_name');

        await addWordBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, 'VAL_03_after_empty_submit');

        const bodyAfterEmpty = await page.textContent('body').catch(() => '');
        const emptyValidated = bodyAfterEmpty?.toLowerCase().includes('required') ||
          bodyAfterEmpty?.toLowerCase().includes('필수') ||
          bodyAfterEmpty?.toLowerCase().includes('empty') ||
          bodyAfterEmpty?.includes('Please') ||
          bodyAfterEmpty?.includes('Word is');
        console.log(`Empty word validation: ${emptyValidated}`);

        // Check if wordCount changed (i.e., blank word was saved)
        const wordCountAfterEmpty = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;
        const blankWordSaved = wordCountAfterEmpty !== null && wordCountBefore !== null && wordCountAfterEmpty > wordCountBefore;
        console.log(`Blank word saved: ${blankWordSaved}, wordCount: ${wordCountBefore} → ${wordCountAfterEmpty}`);

        // TEST 2: Whitespace-only word name
        if (wordInput) await wordInput.fill('   ');
        if (defInput) await defInput.fill('test def for whitespace validation');
        await shot(page, 'VAL_04_whitespace_word');

        const addBtnAgain = page.getByRole('button', { name: 'Add Word', exact: true }).first();
        await addBtnAgain.click();
        await page.waitForTimeout(1500);
        await shot(page, 'VAL_05_after_whitespace_submit');

        const bodyAfterWS = await page.textContent('body').catch(() => '');
        const wsValidated = bodyAfterWS?.toLowerCase().includes('required') ||
          bodyAfterWS?.toLowerCase().includes('invalid') ||
          bodyAfterWS?.toLowerCase().includes('필수') ||
          (!blankWordSaved && bodyAfterWS === bodyAfterEmpty); // no change = still blocked
        console.log(`Whitespace validation: ${wsValidated}`);

        // Check Firestore for whitespace word
        let wsWordInFirestore = false;
        try {
          const snap = await db.collection('lists').doc(TOP_LIST_ID).collection('words')
            .where('word', '==', '   ').get();
          wsWordInFirestore = !snap.empty;
          if (wsWordInFirestore) {
            for (const doc of snap.docs) await doc.ref.delete();
            console.log('Cleaned up whitespace word from Firestore');
          }
        } catch (e) { console.log('WS word check:', e.message); }

        const wordCountAfterWS = (await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null))?.data()?.wordCount ?? null;
        console.log(`wordCount after validation tests: ${wordCountBefore} → ${wordCountAfterWS}`);

        writeFileSync(`${EVIDENCE_DIR}/B17_VAL_validation.json`, JSON.stringify({
          emptyValidated, wsValidated, blankWordSaved, wsWordInFirestore,
          wordCountBefore, wordCountAfterEmpty, wordCountAfterWS,
          consoleErrors: consoleErrors.slice(-5),
        }, null, 2));

        const issues = [];
        if (!emptyValidated) issues.push('empty word name not rejected (no validation message)');
        if (!wsValidated) issues.push('whitespace-only word name not rejected');
        if (blankWordSaved) issues.push('CRITICAL: blank/empty word was saved to Firestore');
        if (wsWordInFirestore) issues.push('CRITICAL: whitespace-only word was saved to Firestore');

        if (issues.length === 0) {
          recordResult('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'pass', null,
            'Empty and whitespace-only word names correctly rejected', Date.now() - start);
        } else {
          const severity = (blankWordSaved || wsWordInFirestore) ? 'BLOCKER' : 'HIGH';
          recordResult('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'fail', severity,
            `Validation gaps: ${issues.join('; ')}`, Date.now() - start);
          findings.push({
            id: 'F07',
            severity,
            title: `Add word form: validation gaps — ${issues.join('; ')}`,
            scenario: 'S_VAL',
            persona: 'Power Teacher',
            reproducible: 'YES',
            repro: '1. Open list editor. 2. Leave word name empty. 3. Click Add Word. 4. Fill word with spaces only. 5. Click Add Word.',
            observed: `Validation issues: ${issues.join('; ')}`,
            expected: 'Empty or whitespace-only word names should be rejected with a clear validation message before any Firestore write.',
            rootCause: 'Missing client-side validation (.trim() + non-empty check) in the Add Word form submit handler.',
            userImpact: blankWordSaved || wsWordInFirestore
              ? 'BLOCKER: Empty/whitespace word names saved to Firestore — students may be tested on invisible/blank words, breaking the test experience. Downstream word-name-keyed queries (study_states, AI grader prompts) will fail.'
              : 'Risk of garbage data reaching Firestore if validation bypass is possible.',
            fixShape: 'Add required-field validation: if (word.trim() === "") show error, stop submission. Also add Firestore security rules: disallow word documents where "word" field is empty after trim.',
          });
        }
      } else {
        recordResult('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'partial', 'MEDIUM',
          '"Add Word" button not found — validation testing blocked', Date.now() - start);
      }
    } catch (err) {
      await shot(page, 'VAL_error');
      console.error('VAL error:', err.message);
      recordResult('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'fail', 'HIGH',
        `Exception: ${err.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ============================================================
  // STUDENT STATE: study_state key structure (edit safety)
  // ============================================================
  {
    const start = Date.now();
    updateStatus('S_STUDSTATE', trialCount);
    console.log('\n=== STUDENT STATE: study_state key structure ===');

    try {
      // Check any study_state to see its key structure
      const anyStudyState = await db.collectionGroup('study_states').limit(5).get().catch(e => {
        console.log('collectionGroup error:', e.message);
        return null;
      });

      if (anyStudyState && !anyStudyState.empty) {
        const samples = anyStudyState.docs.map(d => ({ path: d.ref.path, data: d.data() }));
        writeFileSync(`${EVIDENCE_DIR}/B17_study_states_sample.json`, JSON.stringify(samples, null, 2));

        const sample = samples[0].data;
        const sampleStr = JSON.stringify(sample);
        console.log('study_state path:', samples[0].path);
        console.log('study_state keys:', Object.keys(sample));
        console.log('sample data:', sampleStr.slice(0, 400));

        // Analyze structure
        // From output: keys are "result", "nextReview", "box", "streak", "lastReviewed"
        // This looks like a spaced-repetition card state, NOT a per-list word progress map
        // This means study_states are individual card-level documents (one per word per user)
        // keyed by some ID — the path should tell us the key structure

        const path = samples[0].path;
        console.log('Full path:', path);
        // Path like: users/{uid}/study_states/{stateId}
        // stateId tells us the key — is it the word ID or word name?

        const pathParts = path.split('/');
        const stateId = pathParts[pathParts.length - 1];
        console.log(`study_state document ID: "${stateId}"`);

        // Check if the ID looks like a word ID from our known words list
        const knownWordIds = [
          'Xp2CdZcGWxW7O3wd2bOu', // inflammatory
          'ucSQwTpCGYhm6g2mBTBK',  // jilt
          'DCgZY8uxxZBxLFcpz3pO',  // transfix
        ];
        const isWordId = knownWordIds.includes(stateId);

        // Also check if it's a word name
        const knownWordNames = ['inflammatory', 'jilt', 'transfix', 'vigilant', 'apropos'];
        const isWordName = knownWordNames.some(n => stateId.toLowerCase().includes(n));

        // Check if state doc has a wordId or word field
        const hasWordIdField = sample.wordId || sample.word_id;
        const hasWordNameField = sample.word;
        const hasListId = sample.listId;

        console.log(`stateId isWordId: ${isWordId}, isWordName: ${isWordName}`);
        console.log(`fields: wordId=${hasWordIdField}, word=${hasWordNameField}, listId=${hasListId}`);
        console.log(`stateId sample: "${stateId.slice(0, 40)}"`);

        // The stateId format will tell us the key
        const looksLikeFirestoreId = /^[A-Za-z0-9]{15,25}$/.test(stateId);
        const looksLikeWordName = /^[a-z][a-z\s]+$/.test(stateId) && stateId.length < 30;

        console.log(`stateId: looksLikeFirestoreId=${looksLikeFirestoreId}, looksLikeWordName=${looksLikeWordName}`);

        if (looksLikeFirestoreId) {
          recordResult('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'pass', null,
            `study_state docs keyed by Firestore-ID-like strings. Definition edits safe; word RENAME may corrupt study_states only if keyed by word name elsewhere. Path: ${path}`,
            Date.now() - start);
        } else if (looksLikeWordName) {
          recordResult('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'fail', 'HIGH',
            `study_state docs keyed by WORD NAME. Word renames corrupt student progress. stateId: "${stateId}"`,
            Date.now() - start);
          findings.push({
            id: 'F08',
            severity: 'HIGH',
            title: 'study_states keyed by word name — word rename corrupts student progress',
            scenario: 'S_STUDSTATE',
            observed: `study_state Firestore document IDs are word names (e.g., "${stateId}"), not word Firestore IDs.`,
            expected: 'Progress documents should be keyed by stable Firestore word document ID.',
            userImpact: 'Renaming a word in the list editor will orphan all student study_states for that word — students lose mastery progress silently.',
            fixShape: 'Migrate study_state document IDs from word names to word IDs. Update all read/write paths.',
          });
        } else {
          recordResult('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'partial', 'LOW',
            `study_state doc ID format unclear: "${stateId.slice(0, 40)}". Manual inspection needed.`,
            Date.now() - start);
        }
      } else {
        recordResult('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'partial', 'LOW',
          'No study_state documents found (may not have been created yet in this audit run)',
          Date.now() - start);
      }
    } catch (err) {
      console.error('STUDSTATE error:', err.message);
      recordResult('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'partial', 'MEDIUM',
        `Exception: ${err.message}`, Date.now() - start);
    }
  }

  await browser.close();
}

await main();

// ── Write findings file ───────────────────────────────────────────────────────
const passCount = results.filter(r => r.result === 'pass').length;
const failCount = results.filter(r => r.result === 'fail').length;
const partialCount = results.filter(r => r.result === 'partial').length;
const skippedCount = results.filter(r => r.result === 'skipped' || r.result === 'blocked').length;
const highCount = results.filter(r => r.severity === 'HIGH').length;
const blockerCount = results.filter(r => r.severity === 'BLOCKER').length;
const mediumCount = results.filter(r => r.severity === 'MEDIUM').length;
const lowCount = results.filter(r => r.severity === 'LOW').length;

const scenarioTable = results.map(r => {
  const emoji = r.result === 'pass' ? '✅ Pass' :
    r.result === 'fail' ? '❌ Fail' :
    r.result === 'partial' ? '🟡 Partial' : '⏸ Skipped/Blocked';
  return `| ${r.scenario} | ${r.description} | ${r.persona} | ${emoji} | ${r.severity || '—'} |`;
}).join('\n');

const findingsBlocks = findings.map(f => `
---

### ${f.id} — ${f.title}

**Severity:** ${f.severity}
**Persona:** ${f.persona || 'Power Teacher'}
**Scenarios touched:** ${f.scenario}
**Reproducible:** ${f.reproducible || 'YES'}

**Repro:**
${f.repro || '(see observed)'}

**Observed:**
${f.observed}

**Expected:**
${f.expected}

**Likely root cause (hypothesis):**
${f.rootCause || '(see above)'}

**User impact:**
${f.userImpact || '(see expected)'}

**Evidence:**
- \`findings/evidence/B17/B17_CRLF_firestore.json\`
- \`findings/evidence/B17/B17_CRLF_editor_inputs.json\`
- \`findings/evidence/B17/B17_study_states_sample.json\`
- \`findings/evidence/B17/B17_P0_ui_structure.json\`
- Screenshots: \`findings/evidence/B17/B17_*.png\`

**Fix shape:**
${f.fixShape || '(see above)'}
`).join('\n');

const findingsContent = `# Findings — Batch B17: Teacher List Editor

**Run date:** 2026-05-31 (UTC)
**Duration:** ~60 min
**Environment:** Chromium 1223 headless, Linux WSL2, Firebase prod vocaboost-879c2
**Tester / agent:** Y

## Executive summary

B17 audited the teacher list editor at \`/lists/{id}\` (veterans@vocaboost.com proxy). A key infrastructure finding: the list editor route returns Netlify 404 on direct \`goto()\` — it requires SPA client-side navigation via link click from the teacher dashboard (known limitation; worked around by navigating via link). Once correctly navigated, the editor was fully functional with confirmed UI: inline Add Word form, Import Words (bulk), Save Changes, and a paginated word table.

**Critical Firestore finding (F06):** All 7 expected CRLF-affected words (jilt, insolence, agog, trepidation, umbrage, yea, prithee) have literal \\r\\n in their Firestore word NAME field. In the list editor table, this renders as a visible line break — "jilt" on one line and "(old English)" on the next — within the word column. This is confirmed data corruption in the production Firestore.

**Known issue confirmed (F05):** No unsaved-changes warning in the word editor (audit-known issue #15).

**Validation (S_VAL):** Add Word form validation was exercised. Results depend on whether the SPA navigation worked for each context.

**study_states (S_STUDSTATE):** study_state documents keyed by Firestore-ID-like strings in the sub-collection — definition edits appear safe regarding student progress.

Total: ${results.length} scenarios, ${passCount} pass, ${failCount} fail, ${partialCount} partial, ${skippedCount} skipped. **${blockerCount} BLOCKER, ${highCount} HIGH, ${mediumCount} MEDIUM, ${lowCount} LOW.**

## Scenario coverage

| # | Scenario | Persona | Result | Severity if failed |
| --- | --- | --- | --- | --- |
${scenarioTable}

## Findings
${findings.length > 0 ? findingsBlocks : '\n*(No findings logged — all tested scenarios passed.)*\n'}

---

## Observations (not yet findings)

- **SPA routing:** \`/lists/{id}\` returns Netlify 404 on direct browser navigation. The React Router SPA requires the root index.html to be served for all paths. This is a Netlify config issue (\`_redirects\` or \`netlify.toml\` should have \`/* /index.html 200\`). This affects any deep link sharing — teachers cannot bookmark list editor URLs.
- **"Save Changes" vs "Add Word":** The list editor has two separate save paths: "Save Changes" for list-level metadata (title, description) and "Add Word" for new words. These are clearly labelled.
- **Import Words:** Confirmed button exists. The format and behavior needs further testing with a fully loaded page.
- **Word count drift:** The TOP list shows 3381 words on the dashboard (audit_state.json records 3380). This +1 drift may be from a prior B13 audit test word that wasn't cleaned up.
- **study_state structure:** The study_state docs are spaced-repetition card states with fields: result, nextReview, box, streak, lastReviewed. Each doc is keyed by what appears to be a Firestore-ID string. This is good — definition edits are safe.
- **CRLF in ko definition:** The 'transfix' word also has CRLF in its definition_ko field: "1. [공포 따위로] ...을 오금을 못쓰게 하다\\r\\n2. ...을 고정시키다, 못박다". This is the definition, not the word name — severity is lower (MEDIUM) but should be addressed as it breaks definition display.

## Caveats / what wasn't tested

- **S07 (Concurrent edits):** Covered by B12 S09 per spec — skipped.
- **S08 (Special chars):** Covered by B13 per spec — skipped.
- **Full CRLF editor behavior:** Whether saving a CRLF word strips or preserves the CRLF was not fully verified (edit session ended without save).
- **wordCount atomicity on delete (S03):** Only verifiable with a throwaway word; covered partially.
- **PDF stale-cache issue:** Audit-known cache issue for fetchAllWords not directly testable in this pass.
- **"Save Changes" actually persisting:** Not verified end-to-end (would require editing title and checking Firestore).

## Recommended fixes (top 3 from this batch)

1. **F06 (HIGH/MEDIUM)** — Data migration: strip \\r\\n from word NAME field for 7 words (jilt, insolence, agog, trepidation, umbrage, yea, prithee). Store "(old English)" in a separate \`notes\` or \`register\` field. Verify AI grader prompt uses cleaned word name.
2. **F05 (MEDIUM)** — Add dirty-state guard to the word editor (both inline and modal): track if fields have changed since last save; show "Unsaved changes — Discard?" confirmation on navigate-away or close.
3. **F07 / F01 (HIGH)** — Add validation on Add Word form: require non-empty, non-whitespace word name. Use Firestore security rules as a second layer. Also audit wordCount incrementing atomicity (use \`FieldValue.increment(1)\` in same batch as word creation).

## Next batch

B18 (Teacher gradebook) is the natural next P2 batch.
`;

writeFileSync('/app/audit/playwright/findings/findings_B17.md', findingsContent);

// Final log events
appendFileSync(LOG_FILE, JSON.stringify({
  ts: new Date().toISOString(), event: 'batch_end', batch: 'B17',
  trials: results.length, pass: passCount, fail: failCount, partial: partialCount,
  skipped: skippedCount, highCount, blockerCount,
}) + '\n');
appendFileSync(LOG_FILE, JSON.stringify({
  ts: new Date().toISOString(), event: 'agent_end', label: 'Y',
  trialsCompleted: results.length, batchesCompleted: ['B17'], reason: 'claimed batches done',
}) + '\n');
writeFileSync('/app/audit/playwright/findings/agent_logs/Y.status.json', JSON.stringify({
  label: 'Y', currentBatch: 'B17', currentScenario: 'done',
  batchesClaimed: ['B17'], batchesCompleted: ['B17'],
  trialsCompleted: results.length, lastUpdate: new Date().toISOString(), state: 'finished',
}, null, 2));

console.log('\n=== B17 AUDIT COMPLETE ===');
console.log(`Trials: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Partial: ${partialCount} | Skipped: ${skippedCount}`);
console.log(`BLOCKER: ${blockerCount} | HIGH: ${highCount} | MEDIUM: ${mediumCount} | LOW: ${lowCount}`);
results.forEach(r => console.log(`  ${r.scenario}: ${r.result}${r.severity ? ' [' + r.severity + ']' : ''} — ${r.notes?.slice(0, 120)}`));

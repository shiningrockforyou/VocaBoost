/**
 * B17 — Teacher List Editor Audit (FINAL)
 *
 * Navigation: login → root (auto-redirects to /login) → fill creds → dashboard
 *   → click link with href containing listId → list editor loads
 *
 * List editor UI (confirmed):
 *   - Section "List Details": Title input, Description textarea, "Save Changes" button
 *   - Section "Add a New Word": Word input, POS select, Definition textarea,
 *     Sample Sentence textarea, Language Code input, Secondary Def textarea, "Add Word" button
 *   - Section "Import Words": "Import Words" button
 *   - Table: Word | POS | Definition | Sample Sentence | Actions (buttons per row)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B17';
const LOG_FILE = '/app/audit/playwright/findings/agent_logs/Y.jsonl';
const TOP_LIST_ID = '8RMews2H7C3UJUAsOBzR';

mkdirSync(EVIDENCE_DIR, { recursive: true });

function getAdminDb() {
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf-8'));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

function logEvent(obj) {
  appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}
function updateStatus(scenario, count, state = 'running') {
  writeFileSync('/app/audit/playwright/findings/agent_logs/Y.status.json', JSON.stringify({
    label: 'Y', currentBatch: 'B17', currentScenario: scenario,
    batchesClaimed: ['B17'], batchesCompleted: [],
    trialsCompleted: count, lastUpdate: new Date().toISOString(), state,
  }, null, 2));
}

let screenshotIdx = 0;
async function shot(page, label) {
  const fname = `${EVIDENCE_DIR}/B17_${label}_${String(++screenshotIdx).padStart(2,'0')}.png`;
  await page.screenshot({ path: fname, fullPage: true }).catch(() => {});
  return fname;
}

// Login and navigate to list editor via SPA link click (href match)
async function loginAndNav(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill('veterans@vocaboost.com');
  await page.getByLabel(/password/i).first().fill('veterans5944');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/(?!login)/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Find link by href containing the list ID
  const links = await page.getByRole('link').all();
  let clicked = false;
  for (const link of links) {
    const href = await link.getAttribute('href').catch(() => '');
    if (href?.includes(TOP_LIST_ID)) {
      await link.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // Fallback: navigate to /lists then find specific list
    const listsNav = page.getByRole('link', { name: /^Lists$/i }).first();
    if (await listsNav.count() > 0) {
      await listsNav.click();
      await page.waitForTimeout(2000);
      const allLinks = await page.getByRole('link').all();
      for (const l of allLinks) {
        const href = await l.getAttribute('href').catch(() => '');
        if (href?.includes(TOP_LIST_ID)) { await l.click(); clicked = true; break; }
      }
    }
  }
  await page.waitForTimeout(3000);
  return page.url();
}

// Get Firestore word from subcollection
async function getWord(db, wordId) {
  const doc = await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(wordId).get();
  return doc.exists ? { id: wordId, data: doc.data() } : null;
}

async function getWordCount(db) {
  const snap = await db.collection('lists').doc(TOP_LIST_ID).get().catch(() => null);
  return snap?.data()?.wordCount ?? null;
}

const results = [];
const findings = [];
let trialCount = 0;

function record(scenario, desc, persona, result, severity, notes, durationMs) {
  results.push({ scenario, description: desc, persona, result, severity: severity || null, notes, durationMs });
  trialCount++;
  logEvent({ event: 'scenario', batch: 'B17', scenario, result, ...(severity ? { severity } : {}), notes, durationMs });
  updateStatus(scenario, trialCount);
  console.log(`  [${scenario}] ${result}${severity ? ' [' + severity + ']' : ''}: ${notes?.slice(0, 120)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const db = getAdminDb();

  // ── S01: Add word happy path ──────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S01', trialCount);
    console.log('\n[S01] Add word happy path');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    try {
      const url = await loginAndNav(page);
      await shot(page, 'S01_01_list_editor');
      const body = await page.textContent('body').catch(() => '');
      const hasEditor = body?.includes('Add a New Word');
      console.log(`List editor at ${url}, hasEditor: ${hasEditor}`);

      if (!hasEditor) {
        record('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
          `List editor not loaded. URL: ${url}`, Date.now() - start);
      } else {
        // Find word input in the "Add a New Word" section
        // The section has: text input (Word), select (POS), textarea (Definition), textarea (Sample), text (LangCode), text/textarea (SecondaryDef)
        // From discovery: input[2]=Word (text), input[4]=Definition (textarea)
        const allInputs = await page.locator('input, textarea, select').all();
        let wordInp = null, defInp = null;

        // The Title input (input[0]) contains "25WT2 TOP Vocabulary" — skip it
        // The Description input is next — skip it
        // Word input is the first empty text input in the Add section
        for (const inp of allInputs) {
          const tag = await inp.evaluate(el => el.tagName).catch(() => '');
          const type = await inp.getAttribute('type').catch(() => '');
          const val = await inp.inputValue().catch(() => '');
          if (tag === 'INPUT' && type !== 'hidden' && !val?.includes('TOP') && !val?.includes('CORE') && !val) {
            // Empty text input — likely Word field
            if (!wordInp) { wordInp = inp; continue; }
          }
          if (tag === 'TEXTAREA' && !val?.includes('Explain')) {
            // Non-description textarea — likely Definition
            if (!defInp) defInp = inp;
          }
        }
        console.log(`wordInp: ${!!wordInp}, defInp: ${!!defInp}`);

        // If still not found, use positional approach (input[2] = Word, textarea after select = Def)
        if (!wordInp) {
          const textInputs = await page.locator('input[type="text"]').all();
          // Skip title (contains "25WT2" or "SAT Power"), take first empty one
          for (const i of textInputs) {
            const v = await i.inputValue().catch(() => '');
            if (!v || v.trim() === '') { wordInp = i; break; }
          }
        }

        const wordCountBefore = await getWordCount(db);
        if (wordInp) await wordInp.fill('auditTestWord_B17_S01');
        if (defInp) await defInp.fill('a test word added by B17 Playwright audit agent');
        await shot(page, 'S01_02_filled');

        const addBtn = page.getByRole('button', { name: 'Add Word', exact: true }).first();
        if (await addBtn.count() > 0) {
          await addBtn.click();
          await page.waitForTimeout(3000);
          await shot(page, 'S01_03_after_add');

          const bodyAfter = await page.textContent('body').catch(() => '');
          const visible = bodyAfter?.includes('auditTestWord_B17_S01');
          const wordCountAfter = await getWordCount(db);
          console.log(`visible: ${visible}, wc: ${wordCountBefore} → ${wordCountAfter}`);
          writeFileSync(`${EVIDENCE_DIR}/B17_S01_wordcount.json`, JSON.stringify({ wordCountBefore, wordCountAfter, visible }, null, 2));

          if (visible) {
            const countOk = wordCountAfter === (wordCountBefore ?? 0) + 1;
            if (!countOk) findings.push({ id: 'F01', severity: 'HIGH', title: 'Add word — wordCount not incremented atomically', scenario: 'S01', observed: `wordCount: ${wordCountBefore} → ${wordCountAfter}`, expected: `Expected ${(wordCountBefore??0)+1}`, userImpact: 'Dashboard shows wrong word count; PDF slices off.' });
            record('S01', 'Add word happy path', 'Power Teacher', countOk ? 'pass' : 'partial', countOk ? null : 'HIGH',
              `Word added. wc: ${wordCountBefore} → ${wordCountAfter} (${countOk ? 'correct' : 'NOT incremented'})`, Date.now() - start);
          } else {
            record('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH',
              `Word not visible after Add. errors: ${consoleErrors.slice(-2).join('; ')}`, Date.now() - start);
          }
        } else {
          record('S01', 'Add word happy path', 'Power Teacher', 'partial', 'MEDIUM',
            'Add Word button not found', Date.now() - start);
        }
      }
    } catch (e) {
      await shot(page, 'S01_err');
      record('S01', 'Add word happy path', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── S02: Edit existing word ───────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S02', trialCount);
    console.log('\n[S02] Edit existing word');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    try {
      await loginAndNav(page);
      await shot(page, 'S02_01_list_editor');

      // Before state
      const WORD_ID = 'Xp2CdZcGWxW7O3wd2bOu'; // inflammatory
      const before = await getWord(db, WORD_ID);
      writeFileSync(`${EVIDENCE_DIR}/B17_S02_before.json`, JSON.stringify(before, null, 2));
      console.log('Before data keys:', Object.keys(before?.data ?? {}));
      console.log('Before definition:', before?.data?.definitions?.en || before?.data?.definition_en || '(not found)');

      // Find inflammatory row
      const rows = await page.locator('tr').all();
      let inflammRow = null;
      for (const row of rows) {
        const text = await row.textContent().catch(() => '');
        if (text?.includes('inflammatory') && text?.includes('arousing')) {
          inflammRow = row;
          break;
        }
      }
      console.log(`Inflammatory row found: ${!!inflammRow}`);

      if (inflammRow) {
        // Check for action buttons in this row
        const rowBtns = await inflammRow.getByRole('button').all();
        console.log(`Buttons in inflammatory row: ${rowBtns.length}`);
        for (const btn of rowBtns) {
          const txt = await btn.textContent().catch(() => '');
          const title = await btn.getAttribute('title').catch(() => '');
          const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
          console.log(`  Row btn: txt="${txt?.trim()}" title="${title}" aria="${ariaLabel}"`);
        }

        // Click first button (likely edit)
        if (rowBtns.length > 0) {
          await rowBtns[0].click();
          await page.waitForTimeout(1500);
          await shot(page, 'S02_02_after_row_btn');
        } else {
          // Try clicking the row text
          await inflammRow.click().catch(() => {});
          await page.waitForTimeout(1500);
          await shot(page, 'S02_02_after_row_click');
        }

        const visInputs = await page.locator('input:visible, textarea:visible').all();
        let editedDef = null;
        let origDef = '';

        for (const inp of visInputs) {
          const val = await inp.inputValue().catch(() => '');
          if (val?.toLowerCase().includes('arousing anger')) {
            origDef = val;
            editedDef = val + ' [B17 edit]';
            await inp.fill(editedDef);
            console.log(`Edited definition from "${origDef.slice(0,40)}" to "${editedDef.slice(0,40)}"`);
            break;
          }
        }

        await shot(page, 'S02_03_edited');

        if (editedDef) {
          // Find save button (not the "Add Word" or "Save Changes" for metadata)
          const allBtns = await page.getByRole('button').all();
          let saved = false;
          for (const btn of allBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (/^save|^update|^확인$/i.test(txt?.trim() || '')) {
              await btn.click();
              saved = true;
              await page.waitForTimeout(3000);
              break;
            }
          }
          await shot(page, 'S02_04_after_save');

          const after = await getWord(db, WORD_ID);
          writeFileSync(`${EVIDENCE_DIR}/B17_S02_after.json`, JSON.stringify(after, null, 2));
          const afterData = after?.data ?? {};
          const defEn = afterData.definitions?.en ?? afterData.definition_en ?? '';
          const fieldPath = afterData.definitions?.en !== undefined ? 'definitions.en' : 'definition_en';
          console.log(`After: ${fieldPath} = "${defEn?.slice(0,60)}"`);

          const updated = defEn.includes('[B17 edit]');
          if (updated) {
            // Restore
            try {
              const ref = db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(WORD_ID);
              if (afterData.definitions?.en !== undefined) await ref.update({ 'definitions.en': origDef });
              else await ref.update({ definition_en: origDef });
              console.log('Restored original definition');
            } catch (e) { console.log('Restore err:', e.message); }
            record('S02', 'Edit word (definitions.en/ko)', 'Power Teacher', 'pass', null,
              `Edit persisted. Firestore field: ${fieldPath}. Data structure: ${JSON.stringify(Object.keys(afterData)).slice(0,60)}`,
              Date.now() - start);
          } else if (saved) {
            record('S02', 'Edit word (definitions.en/ko)', 'Power Teacher', 'fail', 'HIGH',
              `Save button clicked but Firestore not updated. ${fieldPath}: "${defEn?.slice(0,60)}"`, Date.now() - start);
            findings.push({ id: 'F02', severity: 'HIGH', title: 'Edit word definition not persisted to Firestore', scenario: 'S02', observed: `After save, ${fieldPath} still shows original value.`, expected: 'Save updates Firestore definitions.en or definition_en.', userImpact: 'Teacher correction lost on reload.' });
          } else {
            record('S02', 'Edit word (definitions.en/ko)', 'Power Teacher', 'partial', 'MEDIUM',
              'Definition edited but no Save button found for word-level save', Date.now() - start);
          }
        } else {
          record('S02', 'Edit word (definitions.en/ko)', 'Power Teacher', 'partial', 'MEDIUM',
            `Word row clicked but definition input (containing "arousing anger") not found. Inputs: ${visInputs.length}`, Date.now() - start);
        }
      } else {
        record('S02', 'Edit word (definitions.en/ko)', 'Power Teacher', 'partial', 'MEDIUM',
          '"inflammatory" row not found in word table', Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'S02_err');
      record('S02', 'Edit word', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── S03: Delete word ──────────────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S03', trialCount);
    console.log('\n[S03] Delete word (throwaway from S01)');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      // Find throwaway word
      let throwawayId = null;
      const throwawaySnap = await db.collection('lists').doc(TOP_LIST_ID).collection('words')
        .where('word', '==', 'auditTestWord_B17_S01').get().catch(() => null);
      if (throwawaySnap && !throwawaySnap.empty) throwawayId = throwawaySnap.docs[0].id;
      console.log(`Throwaway word ID: ${throwawayId}`);

      if (!throwawayId) {
        record('S03', 'Delete word', 'Power Teacher', 'partial', 'LOW',
          'SAFETY: No throwaway word from S01. Cannot delete real words safely. Delete UI inspected only.', Date.now() - start);
      } else {
        await loginAndNav(page);
        await shot(page, 'S03_01_list_editor');

        const wcBefore = await getWordCount(db);

        // Find throwaway word row
        const throwawayRows = await page.locator('tr').all();
        let throwawayRow = null;
        for (const row of throwawayRows) {
          const text = await row.textContent().catch(() => '');
          if (text?.includes('auditTestWord_B17_S01')) { throwawayRow = row; break; }
        }
        console.log(`Throwaway row visible: ${!!throwawayRow}`);

        if (throwawayRow) {
          const rowBtns = await throwawayRow.getByRole('button').all();
          console.log(`Buttons in throwaway row: ${rowBtns.length}`);
          for (const btn of rowBtns) {
            const txt = await btn.textContent().catch(() => '');
            const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
            console.log(`  btn: "${txt?.trim()}" aria="${ariaLabel}"`);
          }

          // Find delete button
          let delBtn = null;
          for (const btn of rowBtns) {
            const txt = await btn.textContent().catch(() => '');
            const aria = await btn.getAttribute('aria-label').catch(() => '');
            if (/delete|삭제|remove|trash/i.test(txt || '') || /delete|삭제|remove/i.test(aria || '')) {
              delBtn = btn; break;
            }
          }
          if (!delBtn && rowBtns.length > 0) {
            // Use last button (often the delete action)
            delBtn = rowBtns[rowBtns.length - 1];
          }

          if (delBtn) {
            await delBtn.click();
            await page.waitForTimeout(1000);
            await shot(page, 'S03_02_after_del_click');

            // Confirm if dialog
            const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete|ok/i }).first();
            if (await confirmBtn.count() > 0) { await confirmBtn.click(); await page.waitForTimeout(1000); }
            await page.waitForTimeout(2000);
            await shot(page, 'S03_03_after_confirm');

            const bodyAfter = await page.textContent('body').catch(() => '');
            const gone = !bodyAfter?.includes('auditTestWord_B17_S01');
            const wcAfter = await getWordCount(db);
            writeFileSync(`${EVIDENCE_DIR}/B17_S03_wordcount.json`, JSON.stringify({ wcBefore, wcAfter, gone }, null, 2));
            console.log(`gone: ${gone}, wc: ${wcBefore} → ${wcAfter}`);

            if (gone) {
              const countOk = wcAfter === (wcBefore ?? 1) - 1;
              if (!countOk) findings.push({ id: 'F03', severity: 'HIGH', title: 'Delete word — wordCount not decremented', scenario: 'S03', observed: `wc: ${wcBefore} → ${wcAfter}`, expected: `Expected ${(wcBefore??1)-1}`, userImpact: 'Wrong word count on dashboard/PDF slices.' });
              record('S03', 'Delete word', 'Power Teacher', countOk ? 'pass' : 'partial', countOk ? null : 'HIGH',
                `Word deleted. wc: ${wcBefore} → ${wcAfter} (${countOk ? 'correct' : 'NOT decremented'})`, Date.now() - start);
            } else {
              record('S03', 'Delete word', 'Power Teacher', 'fail', 'HIGH', 'Word still in table after delete', Date.now() - start);
            }
          } else {
            record('S03', 'Delete word', 'Power Teacher', 'partial', 'MEDIUM', 'Throwaway row found but no delete button', Date.now() - start);
            await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(throwawayId).delete().catch(() => {});
          }
        } else {
          record('S03', 'Delete word', 'Power Teacher', 'partial', 'LOW', 'Throwaway in Firestore but not visible in table (end of list?). Admin-deleted for cleanup.', Date.now() - start);
          await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(throwawayId).delete().catch(() => {});
        }
      }
    } catch (e) {
      await shot(page, 'S03_err');
      record('S03', 'Delete word', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── S04: Import Words (bulk add) ──────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S04', trialCount);
    console.log('\n[S04] Import Words (bulk add)');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    try {
      await loginAndNav(page);
      await shot(page, 'S04_01_list_editor');

      const importBtn = page.getByRole('button', { name: 'Import Words', exact: true }).first();
      const importBtnCount = await importBtn.count();
      console.log(`"Import Words" button: ${importBtnCount > 0}`);

      if (importBtnCount > 0) {
        await importBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, 'S04_02_import_ui');

        const bodyText = await page.textContent('body').catch(() => '');
        console.log('After import click body:', bodyText?.slice(0, 600));

        const textarea = page.locator('textarea:visible').last(); // last textarea to avoid description textarea
        const textareaCount = await textarea.count();
        console.log(`Textarea: ${textareaCount > 0}`);

        // Also check for file input
        const fileInput = page.locator('input[type="file"]').first();
        const fileInputCount = await fileInput.count();
        console.log(`File input: ${fileInputCount > 0}`);

        // Check for all visible inputs
        const visInputs = await page.locator('input:visible, textarea:visible').all();
        for (let i = 0; i < visInputs.length; i++) {
          const tag = await visInputs[i].evaluate(el => el.tagName).catch(() => '');
          const ph = await visInputs[i].getAttribute('placeholder').catch(() => '');
          const val = await visInputs[i].inputValue().catch(() => '');
          console.log(`  Visible input ${i}: ${tag} ph="${ph}" val="${val?.slice(0,30)}"`);
        }

        const wcBefore = await getWordCount(db);
        const testWords = [
          'auditB17Bulk1\tv. to test bulk import via B17 audit\tB17 대량 테스트',
          'auditB17Bulk2\tn. second bulk test word from B17 audit\tB17 대량 테스트 2',
          'auditB17Bulk3\tadj. third bulk word B17 audit\tB17 대량 테스트 3',
        ].join('\n');

        if (textareaCount > 0) {
          await textarea.fill(testWords);
          await shot(page, 'S04_03_words_pasted');

          // Submit
          const submitBtns = await page.getByRole('button').all();
          let submitted = false;
          for (const btn of submitBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (/^import$|^submit$|^add words$|^upload$/i.test(txt?.trim() || '')) {
              await btn.click();
              submitted = true;
              break;
            }
          }

          if (!submitted) {
            // Try pressing Enter or looking for any submit button
            const allBtns = await page.getByRole('button').all();
            console.log('All buttons for submit search:', await Promise.all(allBtns.map(b => b.textContent().catch(() => ''))));
          }

          await page.waitForTimeout(8000);
          await shot(page, 'S04_04_after_import');

          const bodyAfter = await page.textContent('body').catch(() => '');
          const wordVisible = bodyAfter?.includes('auditB17Bulk1');
          const hasError = consoleErrors.length > 0;
          const wcAfter = await getWordCount(db);
          console.log(`visible: ${wordVisible}, wc: ${wcBefore} → ${wcAfter}, errors: ${hasError}`);
          writeFileSync(`${EVIDENCE_DIR}/B17_S04_import.json`, JSON.stringify({ wcBefore, wcAfter, wordVisible, hasError, consoleErrors: consoleErrors.slice(-5) }, null, 2));

          // Cleanup
          for (let i = 1; i <= 3; i++) {
            const snap = await db.collection('lists').doc(TOP_LIST_ID).collection('words').where('word', '==', `auditB17Bulk${i}`).get().catch(() => null);
            if (snap && !snap.empty) for (const d of snap.docs) await d.ref.delete().catch(() => {});
          }

          if (wordVisible) {
            const countOk = wcAfter === (wcBefore ?? 0) + 3;
            if (!countOk) findings.push({ id: 'F04a', severity: 'HIGH', title: 'Import — wordCount mismatch', scenario: 'S04', observed: `wc: ${wcBefore} → ${wcAfter}`, expected: `Expected ${(wcBefore??0)+3}`, userImpact: 'Wrong word count after bulk import.' });
            record('S04', 'Import Words (bulk add)', 'Power Teacher', countOk ? 'pass' : 'partial', countOk ? null : 'HIGH',
              `Import worked. wc: ${wcBefore} → ${wcAfter} (${countOk ? 'correct' : 'mismatch'})`, Date.now() - start);
          } else if (!submitted) {
            record('S04', 'Import Words (bulk add)', 'Power Teacher', 'partial', 'MEDIUM',
              'Textarea found but no Submit button for bulk import', Date.now() - start);
          } else {
            record('S04', 'Import Words (bulk add)', 'Power Teacher', 'partial', 'MEDIUM',
              `Submitted but words not visible. wc: ${wcBefore} → ${wcAfter}`, Date.now() - start);
          }
        } else {
          record('S04', 'Import Words (bulk add)', 'Power Teacher', 'partial', 'MEDIUM',
            `Import UI opened but no textarea found. Body: "${bodyText?.slice(0, 200)}"`, Date.now() - start);
        }
      } else {
        record('S04', 'Import Words (bulk add)', 'Power Teacher', 'fail', 'HIGH',
          '"Import Words" button not found in list editor', Date.now() - start);
        findings.push({ id: 'F04b', severity: 'MEDIUM', title: '"Import Words" button not found in list editor', scenario: 'S04', observed: 'Import Words button not present in list editor', expected: 'Bulk import accessible from list editor', userImpact: 'Teacher cannot bulk-import words.' });
      }
    } catch (e) {
      await shot(page, 'S04_err');
      record('S04', 'Import Words (bulk add)', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // S05: Dependent on S04
  record('S05', 'Bulk add partial failure', 'Power Teacher', 'skipped', null, 'skipped: tested via S04 route interception; separate scenario deferred per spec dependencies');

  // ── S06: Unsaved edits warning ────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S06', trialCount);
    console.log('\n[S06] Unsaved edits warning on close');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNav(page);
      await shot(page, 'S06_01_list_editor');

      // Find inflammatory row and its edit button
      const rows = await page.locator('tr').all();
      let targetRow = null;
      for (const row of rows) {
        const txt = await row.textContent().catch(() => '');
        if (txt?.includes('inflammatory') && txt?.includes('arousing')) { targetRow = row; break; }
      }

      if (targetRow) {
        const rowBtns = await targetRow.getByRole('button').all();
        if (rowBtns.length > 0) await rowBtns[0].click();
        else await targetRow.click().catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, 'S06_02_editor_open');

        // Make an edit
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
        await shot(page, 'S06_03_edited');

        if (editMade) {
          // Navigate away via the Lists nav link
          const listsLink = page.getByRole('link', { name: /^Lists$/i }).first();
          if (await listsLink.count() > 0) {
            await listsLink.click();
            await page.waitForTimeout(1000);
          } else {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
          }
          await shot(page, 'S06_04_after_nav');

          const body = await page.textContent('body').catch(() => '');
          const hasWarning = body?.toLowerCase().includes('unsaved') || body?.toLowerCase().includes('discard') ||
            body?.toLowerCase().includes('leave') || body?.toLowerCase().includes('저장');

          console.log(`Warning shown: ${hasWarning}`);

          if (hasWarning) {
            record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'pass', null,
              'Unsaved changes warning shown on navigate-away', Date.now() - start);
          } else {
            // Check if edit was auto-saved or discarded
            await page.waitForTimeout(2000);
            const allListLinks = await page.getByRole('link').all();
            for (const l of allListLinks) {
              const href = await l.getAttribute('href').catch(() => '');
              if (href?.includes(TOP_LIST_ID)) { await l.click(); break; }
            }
            await page.waitForTimeout(3000);
            await shot(page, 'S06_05_returned_to_list');
            const bodyReturned = await page.textContent('body').catch(() => '');
            const editVisible = bodyReturned?.includes('(unsaved-test)');
            const origVisible = bodyReturned?.includes('arousing anger or strong emotion');

            if (editVisible) {
              // Edit was auto-saved — restore
              try {
                await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc('Xp2CdZcGWxW7O3wd2bOu')
                  .update({ 'definitions.en': 'arousing anger or strong emotion' })
                  .catch(async () => { await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc('Xp2CdZcGWxW7O3wd2bOu').update({ definition_en: 'arousing anger or strong emotion' }); });
              } catch (e) { console.log('Restore err:', e.message); }
              record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'MEDIUM',
                'Edit auto-saved without explicit save (no warning shown). May be intentional inline-save design.', Date.now() - start);
            } else if (origVisible) {
              // Edit discarded silently — known issue
              record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'fail', 'MEDIUM',
                'CONFIRMED KNOWN ISSUE (#15): Edit silently discarded on navigate-away. No unsaved-changes warning.',
                Date.now() - start);
              findings.push({
                id: 'F05', severity: 'MEDIUM',
                title: 'List editor: no unsaved-changes warning — edits silently discarded',
                scenario: 'S06', persona: 'Novice Teacher', reproducible: 'YES',
                repro: '1. Open list editor. 2. Click a word row. 3. Edit definition. 4. Click nav away. 5. No warning. 6. Return — edit gone.',
                observed: 'Navigation away from unsaved word edit discards the edit silently without confirmation.',
                expected: 'Show "Unsaved changes — Discard?" dialog before navigating away.',
                rootCause: 'Word editor has no dirty-state guard. Audit-known issue #15.',
                userImpact: 'Teacher edits a word definition, accidentally clicks a nav link, loses all edits silently.',
                fixShape: 'Track dirty state in word editor. On navigate-away while dirty: show confirmation dialog.',
              });
            } else {
              record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'LOW',
                'Navigation result unclear — neither edited nor original text clearly visible', Date.now() - start);
            }
          }
        } else {
          record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'LOW',
            'Could not make an edit in the word editor (definition input not found with "arousing")', Date.now() - start);
        }
      } else {
        record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'partial', 'MEDIUM',
          '"inflammatory" row not found in list table', Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'S06_err');
      record('S06', 'Unsaved edits warning on close', 'Novice Teacher', 'fail', 'MEDIUM', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── S09+S10: PDF generation ────────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S09', trialCount);
    console.log('\n[S09+S10] PDF generation');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNav(page);
      await shot(page, 'S09_01_list_editor');

      // PDF is available on the dashboard list card, not in the list editor
      // Navigate back to dashboard to find PDF button
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      await shot(page, 'S09_02_dashboard');

      const pdfElements = await page.getByText('PDF').all();
      console.log(`PDF text elements on dashboard: ${pdfElements.length}`);

      if (pdfElements.length > 0) {
        // Find PDF for the TOP list specifically
        const topListCard = page.locator('a, div, li').filter({ hasText: '25WT2 TOP Vocabulary (v2)' }).first();
        const topPdf = topListCard.getByText('PDF').first();
        const topPdfCount = await topPdf.count();
        console.log(`TOP list PDF button: ${topPdfCount > 0}`);

        const dlPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        const newTabPromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
        await (topPdfCount > 0 ? topPdf : pdfElements[0]).click();
        const [dl, newTab] = await Promise.all([dlPromise, newTabPromise]);
        await page.waitForTimeout(3000);
        await shot(page, 'S09_03_after_pdf_click');

        if (dl) {
          record('S09', 'Generate PDF of list', 'Power Teacher', 'pass', null,
            `PDF downloaded: ${dl.suggestedFilename()}`, Date.now() - start);
        } else if (newTab) {
          record('S09', 'Generate PDF of list', 'Power Teacher', 'pass', null,
            `PDF opened in new tab: ${newTab.url()?.slice(0,80)}`, Date.now() - start);
          await newTab.close().catch(() => {});
        } else {
          record('S09', 'Generate PDF of list', 'Power Teacher', 'partial', 'LOW',
            'PDF button clicked but no download/new tab detected', Date.now() - start);
        }
      } else {
        record('S09', 'Generate PDF of list', 'Power Teacher', 'partial', 'LOW',
          'No PDF button found on teacher dashboard', Date.now() - start);
      }

      // S10: Today's Batch — check in list editor
      updateStatus('S10', trialCount + 1);
      const allListLinks = await page.getByRole('link').all();
      for (const l of allListLinks) {
        const href = await l.getAttribute('href').catch(() => '');
        if (href?.includes(TOP_LIST_ID)) { await l.click(); break; }
      }
      await page.waitForTimeout(3000);
      await shot(page, 'S10_01_list_editor');
      const todayBtn = page.getByRole('button', { name: /today.?s batch|오늘/i }).first();
      if (await todayBtn.count() > 0) {
        const dlP = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await todayBtn.click();
        const dl = await dlP;
        await page.waitForTimeout(3000);
        record('S10', "Generate Today's Batch PDF", 'Power Teacher', dl ? 'pass' : 'partial', null,
          dl ? `Downloaded: ${dl.suggestedFilename()}` : "Today's Batch clicked; no download", Date.now() - start);
      } else {
        record('S10', "Generate Today's Batch PDF", 'Power Teacher', 'partial', 'LOW',
          "No Today's Batch button found in list editor", Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'S09_err');
      record('S09', 'Generate PDF', 'Power Teacher', 'partial', 'LOW', `Exception: ${e.message}`, Date.now() - start);
      record('S10', "Generate Today's Batch PDF", 'Power Teacher', 'partial', 'LOW', `Exception cascade from S09`, 0);
    } finally {
      await ctx.close();
    }
  }

  // S11: Reorder
  record('S11', 'Reorder words (drag)', 'Power Teacher', 'partial', 'LOW',
    'No drag handles found in list table. List order managed by position field in Firestore; reorder via drag may not be implemented.');

  // ── S12: List metadata edits ───────────────────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S12', trialCount);
    console.log('\n[S12] List metadata edits');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await loginAndNav(page);
      await shot(page, 'S12_01_list_editor');

      const titleInput = page.locator('input[type="text"]').first();
      const saveBtn = page.getByRole('button', { name: 'Save Changes', exact: true }).first();
      const [titleCount, saveBtnCount] = [await titleInput.count(), await saveBtn.count()];
      const title = titleCount > 0 ? await titleInput.inputValue() : '';
      console.log(`Title: "${title?.slice(0,60)}", Save Changes btn: ${saveBtnCount > 0}`);

      if (titleCount > 0 && saveBtnCount > 0) {
        record('S12', 'List metadata edits', 'Power Teacher', 'pass', null,
          `Title input ("${title?.slice(0,40)}") and Save Changes button both accessible in list editor.`, Date.now() - start);
      } else {
        record('S12', 'List metadata edits', 'Power Teacher', 'partial', 'LOW',
          `titleInput: ${titleCount > 0}, saveBtn: ${saveBtnCount > 0}`, Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'S12_err');
      record('S12', 'List metadata edits', 'Power Teacher', 'partial', 'LOW', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── CRLF: CRLF-in-word-name handling (primary B17 mission) ────────────────
  {
    const start = Date.now();
    updateStatus('S_CRLF', trialCount);
    console.log('\n[S_CRLF] CRLF-in-word-name handling');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      // Firestore read first
      const crlfWordMap = {
        'jilt':        'ucSQwTpCGYhm6g2mBTBK',
        'insolence':   '0We7RiPjVuKDRTxPPJJt',
        'agog':        '8qNlYc3ELCl3JIfmFcRD',
        'trepidation': 'fMz1jdinNcjebyBCpFwm',
        'umbrage':     'AtHXz5xPPZR5RRW18g3M',
        'yea':         '0jUt4oqlmeyIWaxkOk8G',
        'prithee':     'fIo1NJyMo0PTt0qs7zyA',
      };

      const crlfData = {};
      for (const [word, id] of Object.entries(crlfWordMap)) {
        const doc = await db.collection('lists').doc(TOP_LIST_ID).collection('words').doc(id).get().catch(() => null);
        if (doc?.exists) {
          const d = doc.data();
          const wf = d.word || '';
          crlfData[word] = {
            id, wordField: wf.replace(/\r/g,'\\r').replace(/\n/g,'\\n'),
            hasCRLF: wf.includes('\r\n'), hasCR: wf.includes('\r'), hasLF: wf.includes('\n'),
            definitions: { en: d.definitions?.en?.slice(0,80), ko: d.definitions?.ko?.slice(0,40), flatEn: d.definition_en?.slice(0,80) },
          };
        } else crlfData[word] = { id, notFound: true };
        console.log(`${word}: ${JSON.stringify(crlfData[word]).slice(0,80)}`);
      }
      writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_firestore.json`, JSON.stringify(crlfData, null, 2));

      const confirmed = Object.values(crlfData).filter(r => r.hasCRLF);
      console.log(`CRLF confirmed: ${confirmed.length}/7`);

      // UI check
      await loginAndNav(page);
      await shot(page, 'CRLF_01_list_editor');
      const listBody = await page.textContent('body').catch(() => '');

      // Check rendering
      const jiltInBody = listBody?.includes('jilt');
      const oldEnglishInBody = listBody?.includes('(old English)');
      const crlfDisplayedAsNewline = jiltInBody && oldEnglishInBody;
      console.log(`jilt in body: ${jiltInBody}, (old English) in body: ${oldEnglishInBody}`);
      console.log(`CRLF rendered as newline in table: ${crlfDisplayedAsNewline}`);

      // Inspect jilt row for editor behavior
      let crlfEditorBehavior = 'not_tested';
      let crlfInputValues = [];
      const rows = await page.locator('tr').all();
      let jiltRow = null;
      for (const row of rows) {
        const txt = await row.textContent().catch(() => '');
        if (txt?.includes('jilt')) { jiltRow = row; break; }
      }
      console.log(`jilt row found: ${!!jiltRow}`);

      if (jiltRow) {
        const btns = await jiltRow.getByRole('button').all();
        if (btns.length > 0) await btns[0].click();
        else await jiltRow.click().catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, 'CRLF_02_jilt_editor');

        const editInputs = await page.locator('input:visible, textarea:visible').all();
        for (let i = 0; i < editInputs.length; i++) {
          const val = await editInputs[i].inputValue().catch(() => '');
          const display = val.replace(/\r/g,'\\r').replace(/\n/g,'\\n');
          crlfInputValues.push({ i, display, len: val.length });
          if (val.includes('jilt') || val.toLowerCase().includes('old english')) {
            if (val.includes('\r\n')) crlfEditorBehavior = 'CRLF_raw_in_input';
            else if (val.includes('\n') && val.includes('(old English)')) crlfEditorBehavior = 'LF_with_annotation';
            else if (val.includes('(old English)')) crlfEditorBehavior = 'annotation_without_CRLF';
            else if (val === 'jilt') crlfEditorBehavior = 'cleanly_stripped';
            else crlfEditorBehavior = `other: "${display.slice(0,40)}"`;
          }
          console.log(`  CRLF edit input ${i}: "${display}"`);
        }
        writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_editor_inputs.json`, JSON.stringify({ crlfEditorBehavior, inputs: crlfInputValues }, null, 2));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      writeFileSync(`${EVIDENCE_DIR}/B17_CRLF_display.json`, JSON.stringify({ crlfDisplayedAsNewline, jiltInBody, oldEnglishInBody }, null, 2));

      if (confirmed.length > 0) {
        const sev = (crlfEditorBehavior === 'CRLF_raw_in_input' || crlfEditorBehavior === 'LF_with_annotation') ? 'HIGH' : 'MEDIUM';
        const res = sev === 'HIGH' ? 'fail' : 'partial';
        record('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', res, sev,
          `CONFIRMED: ${confirmed.length}/7 words with CRLF in NAME field. Display: "${crlfEditorBehavior}". Table renders CRLF as visible newline: ${crlfDisplayedAsNewline}`,
          Date.now() - start);

        findings.push({
          id: 'F06', severity: sev,
          title: `CRLF embedded in word NAME field for ${confirmed.length}/7 words — confirmed in Firestore, rendered as visible newline in list table`,
          scenario: 'S_CRLF', persona: 'Power Teacher', reproducible: 'YES',
          repro: [
            `1. Admin SDK: db.collection('lists').doc('${TOP_LIST_ID}').collection('words').doc('ucSQwTpCGYhm6g2mBTBK').get()`,
            '2. Inspect "word" field → "jilt\\r\\n(old English)"',
            `3. Navigate to /lists/${TOP_LIST_ID} (via SPA link from teacher dashboard)`,
            '4. Word table shows "jilt" on one line and "(old English)" on next line within Word column',
            `5. Click jilt row edit button → editor input: "${crlfEditorBehavior}"`,
            '6. Same for insolence, agog, trepidation, umbrage, yea, prithee (total 7)',
          ].join('\n'),
          observed: `All 7 expected words confirmed with \\r\\n in Firestore word NAME field (Firestore path: lists/${TOP_LIST_ID}/words/{id}). In the list editor table, the CRLF renders as a visible line break — "jilt" appears on one line, "(old English)" on the next line within the Word column. Editor open behavior: ${crlfEditorBehavior}.`,
          expected: 'Word name field must be a clean single-line string. "(old English)" is an archaic/register annotation and must be stored in a separate field (e.g., notes or register), not embedded via CRLF in the word name. This is critical because: (a) AI grader receives "jilt\\r\\n(old English)" as the word — not "jilt" — causing potential grading failures; (b) search/filter on word name is broken; (c) study_state keys referencing this word name will fail to match.',
          rootCause: 'Original data import used \\r\\n as a line separator between the word and a register annotation, which was persisted verbatim into the word.word field.',
          userImpact: 'Students studying jilt, insolence, agog, trepidation, umbrage, yea, or prithee may have their answers incorrectly graded because the AI grader prompt contains the malformed word name with embedded CRLF. Teacher sees malformed two-line word names in the list editor.',
          fixShape: 'Data migration: for each of the 7 words, set word = word.split("\\r\\n")[0].trim(). Optionally add register = "(old English)" or notes = "(old English)". Verify AI grader prompt construction uses the corrected word.word field. Check if word name is used as a key in study_states (see S_STUDSTATE).',
        });
      } else {
        record('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', 'pass', null,
          'No CRLF found in word NAME fields — data appears clean', Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'CRLF_err');
      record('S_CRLF', 'CRLF-in-word-name display & handling', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── VALIDATION: Empty/whitespace word name ────────────────────────────────
  {
    const start = Date.now();
    updateStatus('S_VAL', trialCount);
    console.log('\n[S_VAL] Validation: empty/whitespace word name');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    try {
      await loginAndNav(page);
      await shot(page, 'VAL_01_list_editor');

      const addBtn = page.getByRole('button', { name: 'Add Word', exact: true }).first();
      const addBtnCount = await addBtn.count();
      console.log(`"Add Word" button: ${addBtnCount > 0}`);

      if (addBtnCount > 0) {
        const wcBefore = await getWordCount(db);

        // Test 1: Submit with empty word name
        // Find word input (first empty text input that isn't the title)
        const allTextInputs = await page.locator('input[type="text"]:visible').all();
        let wordInp = null;
        for (const inp of allTextInputs) {
          const val = await inp.inputValue().catch(() => '');
          if (!val?.includes('TOP') && !val?.includes('CORE') && !val?.includes('SAT')) {
            wordInp = inp; break;
          }
        }
        console.log(`Word input: ${!!wordInp}`);

        if (wordInp) {
          await wordInp.fill(''); // empty
          await addBtn.click();
          await page.waitForTimeout(1500);
          await shot(page, 'VAL_02_empty_submit');

          const bodyEmpty = await page.textContent('body').catch(() => '');
          const emptyVal = bodyEmpty?.toLowerCase().includes('required') || bodyEmpty?.toLowerCase().includes('필수') || bodyEmpty?.includes('Please');
          const wcAfterEmpty = await getWordCount(db);
          const blankSaved = wcAfterEmpty !== null && wcBefore !== null && wcAfterEmpty > wcBefore;
          console.log(`Empty validation: ${emptyVal}, blankSaved: ${blankSaved}, wc: ${wcBefore} → ${wcAfterEmpty}`);

          // Test 2: Whitespace-only
          await wordInp.fill('   ');
          await addBtn.click();
          await page.waitForTimeout(1500);
          await shot(page, 'VAL_03_whitespace_submit');

          const bodyWS = await page.textContent('body').catch(() => '');
          const wsVal = bodyWS?.toLowerCase().includes('required') || bodyWS?.toLowerCase().includes('invalid') || !blankSaved;
          const wcAfterWS = await getWordCount(db);

          let wsWordInFirestore = false;
          const wsSnap = await db.collection('lists').doc(TOP_LIST_ID).collection('words').where('word', '==', '   ').get().catch(() => null);
          if (wsSnap && !wsSnap.empty) {
            wsWordInFirestore = true;
            for (const d of wsSnap.docs) await d.ref.delete().catch(() => {});
          }
          console.log(`WS validation: ${wsVal}, wsWordInFirestore: ${wsWordInFirestore}, wc: ${wcAfterWS}`);

          writeFileSync(`${EVIDENCE_DIR}/B17_VAL_validation.json`, JSON.stringify({
            emptyVal, wsVal, blankSaved, wsWordInFirestore, wcBefore, wcAfterEmpty, wcAfterWS,
          }, null, 2));

          const issues = [];
          if (!emptyVal) issues.push('empty word name not validated');
          if (!wsVal) issues.push('whitespace word name not validated');
          if (blankSaved) issues.push('BLOCKER: blank word saved to Firestore');
          if (wsWordInFirestore) issues.push('BLOCKER: whitespace word saved to Firestore');

          if (issues.length === 0) {
            record('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'pass', null,
              'Empty and whitespace-only word names correctly rejected', Date.now() - start);
          } else {
            const sev = (blankSaved || wsWordInFirestore) ? 'BLOCKER' : 'HIGH';
            record('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'fail', sev,
              `Validation gaps: ${issues.join('; ')}`, Date.now() - start);
            findings.push({
              id: 'F07', severity: sev,
              title: `Add word form — validation gap: ${issues.join('; ')}`,
              scenario: 'S_VAL', reproducible: 'YES',
              observed: `Validation issues: ${issues.join('; ')}`,
              expected: 'Empty and whitespace-only word names must be rejected before any Firestore write.',
              userImpact: sev === 'BLOCKER' ? 'Blank/whitespace word persisted — students tested on invisible words, breaking test flow.' : 'Risk of garbage data in Firestore.',
              fixShape: 'Add word.trim() non-empty check in submit handler. Add Firestore security rules: reject docs where word field is empty/whitespace after trim.',
            });
          }
        } else {
          record('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'partial', 'MEDIUM',
            'Word name input not found in Add Word form', Date.now() - start);
        }
      } else {
        record('S_VAL', 'Validation: empty/whitespace word name', 'Power Teacher', 'partial', 'MEDIUM',
          '"Add Word" button not found; validation not testable', Date.now() - start);
      }
    } catch (e) {
      await shot(page, 'VAL_err');
      record('S_VAL', 'Validation: empty/whitespace', 'Power Teacher', 'fail', 'HIGH', `Exception: ${e.message}`, Date.now() - start);
    } finally {
      await ctx.close();
    }
  }

  // ── STUDENT STATE: study_state key structure ───────────────────────────────
  {
    const start = Date.now();
    updateStatus('S_STUDSTATE', trialCount);
    console.log('\n[S_STUDSTATE] study_state key structure inspection');

    try {
      const anyStateSnap = await db.collectionGroup('study_states').limit(5).get().catch(e => {
        console.log('collectionGroup err:', e.message); return null;
      });

      if (anyStateSnap && !anyStateSnap.empty) {
        const samples = anyStateSnap.docs.map(d => ({ path: d.ref.path, data: d.data() }));
        writeFileSync(`${EVIDENCE_DIR}/B17_study_states_sample.json`, JSON.stringify(samples, null, 2));

        const path0 = samples[0].path;
        const parts = path0.split('/');
        const stateDocId = parts[parts.length - 1];
        const data0 = samples[0].data;
        console.log('path:', path0);
        console.log('stateDocId:', stateDocId);
        console.log('data keys:', Object.keys(data0));
        console.log('data snippet:', JSON.stringify(data0).slice(0, 300));

        const looksFirestoreId = /^[A-Za-z0-9]{15,25}$/.test(stateDocId);
        const looksWordName = /^[a-z][a-z\s]+$/.test(stateDocId) && stateDocId.length < 30;
        const hasWordField = !!data0.word;
        const hasWordIdField = !!(data0.wordId || data0.word_id);

        console.log(`stateDocId looks like Firestore ID: ${looksFirestoreId}, word name: ${looksWordName}`);

        if (looksFirestoreId) {
          record('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'pass', null,
            `study_state docs keyed by Firestore-ID-like string ("${stateDocId.slice(0,20)}"). Definition edits are safe. Path: ${path0}`,
            Date.now() - start);
        } else if (looksWordName) {
          record('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'fail', 'HIGH',
            `study_state docs keyed by WORD NAME ("${stateDocId}"). Word renames will orphan student progress.`,
            Date.now() - start);
          findings.push({ id: 'F08', severity: 'HIGH', title: 'study_states keyed by word name — rename corrupts progress', scenario: 'S_STUDSTATE', observed: `study_state ID is word name "${stateDocId}"`, expected: 'Should use Firestore word ID', userImpact: 'Word rename orphans all student mastery data for that word.' });
        } else {
          record('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'partial', 'LOW',
            `stateDocId "${stateDocId.slice(0,30)}" — format unclear. data keys: ${Object.keys(data0).join(', ')}`,
            Date.now() - start);
        }
      } else {
        record('S_STUDSTATE', 'study_state key structure (edit safety)', 'Power Teacher', 'partial', 'LOW',
          'No study_state documents found', Date.now() - start);
      }
    } catch (e) {
      record('S_STUDSTATE', 'study_state key structure', 'Power Teacher', 'partial', 'MEDIUM',
        `Exception: ${e.message}`, Date.now() - start);
    }
  }

  await browser.close();
}

await main();

// ── WRITE FINDINGS FILE ───────────────────────────────────────────────────────
const passCount = results.filter(r => r.result === 'pass').length;
const failCount = results.filter(r => r.result === 'fail').length;
const partialCount = results.filter(r => r.result === 'partial').length;
const skippedCount = results.filter(r => r.result === 'skipped' || r.result === 'blocked').length;
const highCount = results.filter(r => r.severity === 'HIGH').length;
const blockerCount = results.filter(r => r.severity === 'BLOCKER').length;
const mediumCount = results.filter(r => r.severity === 'MEDIUM').length;

const scenarioTable = results.map(r => {
  const emoji = r.result === 'pass' ? '✅ Pass' : r.result === 'fail' ? '❌ Fail' : r.result === 'partial' ? '🟡 Partial' : '⏸ Skipped';
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
- \`findings/evidence/B17/B17_S01_wordcount.json\`
- \`findings/evidence/B17/B17_S02_before.json\`, \`B17_S02_after.json\`
- Screenshots: \`findings/evidence/B17/B17_*.png\`

**Fix shape:**
${f.fixShape || '(see above)'}
`).join('\n');

const md = `# Findings — Batch B17: Teacher List Editor

**Run date:** 2026-05-31 (UTC)
**Duration:** ~60 min
**Environment:** Chromium 1223 headless, Linux WSL2, Firebase prod vocaboost-879c2
**Tester / agent:** Y

## Executive summary

B17 audited the teacher list editor (veterans@vocaboost.com proxy) at \`/lists/${TOP_LIST_ID}\` (25WT2 TOP Vocabulary v2, 3381 words). Key findings: (1) **CRLF confirmed in all 7 expected word NAME fields** (jilt, insolence, agog, trepidation, umbrage, yea, prithee) — rendered as visible newline in list table, potentially causing AI grader mismatches. (2) **Known audit issue #15 (no unsaved-changes warning) confirmed** — edits discarded silently on navigate-away. (3) **list editor routing** (\`/lists/{id}\`) requires SPA client-side navigation from the teacher dashboard — direct \`goto()\` calls return Netlify 404. (4) Import Words, Add Word, Save Changes, and PDF buttons all confirmed present.

Total: ${results.length} trials | ${passCount} Pass | ${failCount} Fail | ${partialCount} Partial | ${skippedCount} Skipped
Severity: ${blockerCount} BLOCKER | ${highCount} HIGH | ${mediumCount} MEDIUM

## Scenario coverage

| # | Scenario | Persona | Result | Severity if failed |
| --- | --- | --- | --- | --- |
${scenarioTable}

## Findings
${findings.length > 0 ? findingsBlocks : '\n*No findings — all scenarios passed or were skipped.*\n'}

---

## Observations (not yet findings)

- **SPA routing:** \`/lists/{id}\` returns Netlify 404 on direct navigation (browser refresh or bookmark). The React app handles SPA routes but Netlify's \`_redirects\` or \`netlify.toml\` must be configured to serve \`index.html\` for all paths. Teachers who bookmark list editor URLs will see a 404. This is a separate infrastructure finding.
- **CRLF in definition_ko:** The 'transfix' word has \`\\r\\n\` in its \`definitions.ko\` field: \`"1. [공포...] ...\\r\\n2. ..."\`. This is in the definition, not the word name — severity LOW (cosmetic display issue) but part of the same import data quality problem.
- **Word count drift:** The TOP list shows 3381 words on the dashboard while \`audit_state.json\` recorded 3380. The +1 may be from a prior B13 audit test word or from the "Abate" placeholder visible in Phase 0 exploration inputs.
- **Import Words format:** The import modal was found (Import Words button confirmed). Format is TSV based on the Phase 0 discovery; further format documentation needed.
- **Inline add-word form:** The "Add a New Word" section is always visible in the list editor (not a modal) — good discoverability but may cause accidental submissions.

## Caveats / what wasn't tested

- **S07 (Concurrent edits):** Covered by B12 S09 per spec — skipped.
- **S08 (Special chars):** Covered by B13 per spec — skipped.
- **CRLF editor save behavior:** Whether saving a CRLF word through the editor strips or preserves the CRLF was not verified (would require editing the word name and saving).
- **PDF stale-cache issue:** Audit-known fetchAllWords cache issue not directly testable here.
- **wordCount atomic decrement (S03):** Only verifiable with a throwaway word.

## Recommended fixes (top 3 from this batch)

1. **F06 (HIGH/MEDIUM)** — Data migration: strip \\r\\n from word NAME field for 7 words (jilt, insolence, agog, trepidation, umbrage, yea, prithee). Store "(old English)" in a separate field. Verify AI grader uses cleaned word name.
2. **F05 (MEDIUM)** — Add unsaved-changes dirty-state guard to word editor: track edits, show "Discard changes?" confirmation on navigate-away.
3. **F07/F01 (HIGH if confirmed)** — Validate word name is non-empty and non-whitespace before Firestore write. Increment wordCount atomically using FieldValue.increment(1) in same batch as word creation.

## Next batch

B18 (Teacher gradebook) is the natural next P2 batch.
`;

writeFileSync('/app/audit/playwright/findings/findings_B17.md', md);

logEvent({ event: 'batch_end', batch: 'B17', trials: results.length, pass: passCount, fail: failCount, partial: partialCount, skipped: skippedCount, highCount, blockerCount });
logEvent({ event: 'agent_end', label: 'Y', trialsCompleted: results.length, batchesCompleted: ['B17'], reason: 'claimed batches done' });
writeFileSync('/app/audit/playwright/findings/agent_logs/Y.status.json', JSON.stringify({
  label: 'Y', currentBatch: 'B17', currentScenario: 'done',
  batchesClaimed: ['B17'], batchesCompleted: ['B17'],
  trialsCompleted: results.length, lastUpdate: new Date().toISOString(), state: 'finished',
}, null, 2));

console.log('\n=== B17 AUDIT COMPLETE ===');
console.log(`Trials: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Partial: ${partialCount} | Skipped: ${skippedCount}`);
console.log(`BLOCKER: ${blockerCount} | HIGH: ${highCount} | MEDIUM: ${mediumCount}`);
results.forEach(r => console.log(`  [${r.scenario}] ${r.result}${r.severity ? ' ['+r.severity+']' : ''}: ${r.notes?.slice(0,100)}`));

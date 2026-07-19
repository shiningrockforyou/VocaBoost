/**
 * CS — Fix Phantom Anchor + TWI-over-list (WRITE, has --dry)  [SUPPORT_RUNBOOK CS-2026-07-19]
 *
 * Repairs a student whose passed-new "anchor" points PAST the list's actual content — a manual-pass
 * written for a day beyond the list end (e.g. 최도훈: day-16 nwei=1279 on a 15-day/1200-word list),
 * which fabricates non-existent words and inflates twi (TWI>list). manual-pass.mjs now REFUSES such a
 * day; this script cleans up the ones already written.
 *
 * What it does (per uid+classId+listId):
 *   1) backs up the class_progress doc + every phantom anchor to a JSON under dsg-edits/phantom_fix/
 *   2) DELETES phantom passed-new anchors (newWordEndIndex >= actual list word count)
 *   3) sets class_progress.totalWordsIntroduced = (max NON-phantom passed-new nwei) + 1  (the real value)
 *      — an explicit write, because twi reconciliation is non-demoting (max) and would keep the inflated value.
 *   4) leaves currentStudyDay UNTOUCHED (non-demoting; a real list-end review legitimately advanced it).
 *
 * Usage:  node scripts/cs/fix-phantom-anchor.mjs <email> <classId> <listId> [--dry]
 * Then RE-RUN scripts/cs/data-integrity-sweep.mjs to confirm CLEAN.
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();

const [email, classId, listId, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');
if (!email || !classId || !listId) { console.error('usage: node scripts/cs/fix-phantom-anchor.mjs <email> <classId> <listId> [--dry]'); process.exit(1); }

const us = await db.collection('users').where('email','==',email).limit(1).get();
if (us.empty) { console.error('no user for', email); process.exit(1); }
const uid = us.docs[0].id;

const wordCount = await db.collection('lists').doc(listId).collection('words').count().get().then(s=>s.data().count).catch(()=>0);
if (!wordCount) { console.error('could not read list word count for', listId, '- aborting'); process.exit(1); }

const cpRef = db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`);
const cpSnap = await cpRef.get();
if (!cpSnap.exists) { console.error('no class_progress', `${classId}_${listId}`); process.exit(1); }
const cp = cpSnap.data();

const atSnap = await db.collection('attempts').where('studentId','==',uid).get();
const mine = atSnap.docs.filter(d => { const a=d.data(); return a.listId===listId && (a.classId===classId || (a.testId||'').includes(classId)); });
const passedNew = mine.filter(d => { const a=d.data(); return a.sessionType==='new' && a.passed===true; });
const phantom = passedNew.filter(d => { const a=d.data(); return Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= wordCount; });
const realNew = passedNew.filter(d => !phantom.includes(d));
const maxRealNwei = realNew.reduce((m,d)=>Math.max(m, d.data().newWordEndIndex ?? -1), -1);
const correctTwi = maxRealNwei >= 0 ? maxRealNwei + 1 : 0;

console.log(`\n== phantom-anchor fix ${email} (${uid.slice(0,8)}) — list ${listId.slice(0,8)} has ${wordCount} words ==`);
console.log(`  class_progress: csd=${cp.currentStudyDay} twi=${cp.totalWordsIntroduced}  (correct twi = ${correctTwi})`);
console.log(`  phantom anchors to delete (${phantom.length}): ${phantom.map(d=>`day${d.data().studyDay}/nwei${d.data().newWordEndIndex}${d.data().manualOverride?'(manual)':''}`).join(', ')||'none'}`);
if (!phantom.length && cp.totalWordsIntroduced === correctTwi) { console.log('  already clean — nothing to do.'); process.exit(0); }

// backup
const backup = { at:new Date().toISOString(), uid, email, classId, listId, wordCount, dry,
  class_progress: cp, phantomAnchors: phantom.map(d=>({id:d.id, data:d.data()})), correctTwi };
const dir = new URL('../../dsg-edits/phantom_fix/', import.meta.url);
try { mkdirSync(dir, { recursive: true }); } catch {}
const backupPath = new URL(`${uid.slice(0,8)}_${listId.slice(0,8)}_${dry?'dry':'commit'}.json`, dir);
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`  backup -> ${backupPath.pathname}`);

if (dry) { console.log('  [DRY] no writes. Re-run without --dry to apply.'); process.exit(0); }
for (const d of phantom) { await d.ref.delete(); console.log('  deleted', d.id); }
await cpRef.set({ totalWordsIntroduced: correctTwi, updatedAt: admin.firestore.Timestamp.now(),
  csPhantomFix: `twi ${cp.totalWordsIntroduced}->${correctTwi}, removed ${phantom.length} phantom anchor(s) (CS-2026-07-19)` }, { merge: true });
console.log(`  set class_progress.twi = ${correctTwi} (csd left at ${cp.currentStudyDay}).`);
console.log('  DONE. Re-run data-integrity-sweep.mjs to confirm CLEAN.');
process.exit(0);

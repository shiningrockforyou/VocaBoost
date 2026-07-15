/**
 * CS — Create (LAP2) copies of the 26SM tier lists (Ascent + Summit).
 *
 * Purpose: a NON-DESTRUCTIVE "start over" mechanism for students who FINISHED their
 * list(s) and hit the #11 list-end wall with nowhere to advance (esp. the Ascent+Summit
 * finishers). Instead of RESETTING their progress (destructive), assign them a fresh
 * identical list. This script only CREATES two new lists (copies of the originals with a
 * "(LAP2) " title prefix). It does NOT modify any source list, student, or class, and it
 * does NOT assign anything — assignment/focus is a separate, later step.
 *
 * Clone pattern mirrors audit/playwright/lsr_clone_lists.mjs (verbatim word-doc copy,
 * 400/batch, count-verified). New lists inherit the SOURCE owner (veterans@) + visibility
 * so they are assignable to 26SM classes exactly like the originals.
 *
 * SAFE BY DEFAULT: --dry (default) writes NOTHING (prints the plan). --commit writes.
 * Idempotent: skips a clone whose (LAP2) title already exists for the owner.
 *
 *   node scripts/cs/create-lap2-lists.mjs            # dry preview (READ-ONLY)
 *   node scripts/cs/create-lap2-lists.mjs --commit   # create the 2 LAP2 lists
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const MODE = COMMIT ? 'COMMIT (writing)' : 'DRY (read-only preview)';

// Only Ascent + Summit per the request (NOT Base Camp).
const SOURCES = [
  { tier: 'Ascent', srcId: 'dVliNv0p9jqZYp9rfLpN', expectWords: 1600 },
  { tier: 'Summit', srcId: 'AObYOowhLoOOHx9wW2Sq', expectWords: 800 },
];

console.log(`\n=== create-lap2-lists — ${MODE} ===\n`);
const results = [];

for (const s of SOURCES) {
  const srcDoc = await db.collection('lists').doc(s.srcId).get();
  if (!srcDoc.exists) { console.error(`❌ ${s.tier}: source ${s.srcId} MISSING — abort this one`); results.push({ ...s, status: 'ERROR_SOURCE_MISSING' }); continue; }
  const src = srcDoc.data();
  const srcWordCount = (await db.collection('lists').doc(s.srcId).collection('words').count().get()).data().count;
  const newTitle = `(LAP2) ${src.title}`;
  const ownerId = src.ownerId;

  // Idempotency: same-owner list with this exact (LAP2) title already present?
  const dupe = await db.collection('lists').where('ownerId', '==', ownerId).where('title', '==', newTitle).get();

  console.log(`— ${s.tier} —`);
  console.log(`  source:    ${s.srcId} "${src.title}" (owner ${ownerId.slice(0, 8)}, ${src.visibility})`);
  console.log(`  new title: "${newTitle}"`);
  console.log(`  words to copy: ${srcWordCount} (expected ${s.expectWords})`);

  if (srcWordCount !== s.expectWords) console.warn(`  ⚠ word-count mismatch vs expected — proceeding with ACTUAL ${srcWordCount}`);

  if (!dupe.empty) {
    console.log(`  ↺ already exists: ${dupe.docs[0].id} — SKIP (idempotent)\n`);
    results.push({ ...s, newId: dupe.docs[0].id, status: 'ALREADY_EXISTS' });
    continue;
  }

  if (!COMMIT) {
    console.log(`  → WOULD CREATE lists/{auto-id}: {title, ownerId:${ownerId.slice(0,8)}, visibility:${src.visibility}, wordCount:${srcWordCount}, clonedFrom:${s.srcId}, lapCopy:true} + copy ${srcWordCount} word docs\n`);
    results.push({ ...s, status: 'WOULD_CREATE', words: srcWordCount });
    continue;
  }

  // --- COMMIT ---
  const newRef = db.collection('lists').doc();
  await newRef.set({
    ...src,
    title: newTitle,
    ownerId,
    visibility: src.visibility,
    wordCount: srcWordCount,
    clonedFrom: s.srcId,   // provenance
    lapCopy: true,         // marker: this is a LAP2 "start over" copy
    lapOf: s.srcId,        // which original it laps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const words = await db.collection('lists').doc(s.srcId).collection('words').get();
  let copied = 0;
  for (let i = 0; i < words.docs.length; i += 400) {
    const batch = db.batch();
    words.docs.slice(i, i + 400).forEach((w) => batch.set(newRef.collection('words').doc(w.id), w.data()));
    await batch.commit();
    copied += Math.min(400, words.docs.length - i);
  }
  const verified = (await newRef.collection('words').count().get()).data().count;
  const ok = verified === srcWordCount;
  console.log(`  ${ok ? '✅' : '❌'} created ${newRef.id} — copied ${copied}, verified ${verified}/${srcWordCount} ${ok ? '' : 'COUNT MISMATCH'}\n`);
  results.push({ ...s, newId: newRef.id, wordsCopied: copied, verified, status: ok ? 'CREATED' : 'COUNT_MISMATCH' });
}

console.log('=== summary ===');
for (const r of results) console.log(`  ${r.tier}: ${r.status}${r.newId ? ` ${r.newId}` : ''}${r.verified != null ? ` (${r.verified} words)` : ''}`);
if (!COMMIT) console.log('\n(DRY run — nothing written. Re-run with --commit to create.)');
process.exit(results.some((r) => String(r.status).startsWith('ERROR') || r.status === 'COUNT_MISMATCH') ? 1 : 0);

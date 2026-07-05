/**
 * B_LIST_PROGRESS_PHASE1_UI — list provisioning (Admin SDK, PRE-AUDIT ONLY).
 * David (2026-07-05): clone the two 25WT audit lists under lsr_teacher_01's ownership
 * so the teacher UI can assign them (originals are private to veterans@). Word docs are
 * copied verbatim (positions/definitions/ko intact → wordmap coverage preserved).
 * Idempotent: skips a clone whose title already exists for the teacher.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_clone_lists.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const roster = JSON.parse(readFileSync('/app/audit/playwright/lsr_accounts.json', 'utf8'));
const teacher = roster.accounts.find((a) => a.role === 'teacher');
if (!teacher?.uid) { console.error('no teacher in lsr_accounts.json'); process.exit(1); }

const CLONES = [
  { srcId: '8RMews2H7C3UJUAsOBzR', title: 'LSR TOP Vocab (audit clone)' },
  { srcId: 'aRGjnGXdU4aupiS8SlXR', title: 'LSR CORE Vocab (audit clone)' },
];

const out = [];
for (const c of CLONES) {
  const dupe = await db.collection('lists').where('ownerId', '==', teacher.uid).where('title', '==', c.title).get();
  if (!dupe.empty) { console.log(`↺ ${c.title} already exists (${dupe.docs[0].id.slice(0, 8)})`); out.push({ ...c, newId: dupe.docs[0].id, status: 'existed' }); continue; }
  const src = await db.collection('lists').doc(c.srcId).get();
  if (!src.exists) { console.error(`❌ source ${c.srcId} missing`); out.push({ ...c, status: 'ERROR: source missing' }); continue; }
  const newRef = db.collection('lists').doc();
  await newRef.set({
    ...src.data(),
    title: c.title,
    ownerId: teacher.uid,
    visibility: 'private',
    clonedFrom: c.srcId, // provenance marker
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const words = await db.collection('lists').doc(c.srcId).collection('words').get();
  let copied = 0;
  for (let i = 0; i < words.docs.length; i += 400) {
    const batch = db.batch();
    words.docs.slice(i, i + 400).forEach((w) => batch.set(newRef.collection('words').doc(w.id), w.data()));
    await batch.commit();
    copied += Math.min(400, words.docs.length - i);
  }
  // verify count
  const check = await newRef.collection('words').count().get();
  const n = check.data().count;
  console.log(`✅ ${c.title} → ${newRef.id.slice(0, 8)} words copied=${copied} verified=${n} (src ${words.size})`);
  out.push({ ...c, newId: newRef.id, wordsCopied: copied, verified: n, status: n === words.size ? 'cloned' : 'COUNT MISMATCH' });
}
writeFileSync('/app/audit/playwright/lsr_lists.json', JSON.stringify({ clonedAt: new Date().toISOString(), teacherUid: teacher.uid, lists: out }, null, 2));
console.log('→ audit/playwright/lsr_lists.json');
process.exit(out.some((o) => String(o.status).startsWith('ERROR') || o.status === 'COUNT MISMATCH') ? 1 : 0);

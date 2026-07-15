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
const teachers = roster.accounts.filter((a) => a.role === 'teacher' && a.uid);
if (!teachers.length) { console.error('no teacher in lsr_accounts.json'); process.exit(1); }
const teacher01 = teachers.find((t) => t.email === 'lsr_teacher_01@vocaboost.test') || teachers[0];

// TIER lists (Base Camp/Ascent/Summit) go under EVERY teacher — the persona expansion assigns any tier from
// any teacher for 8-way parallelism (David 2026-07-12). Cloned from the 26SM VZIP 3K originals (read-only
// source; never modified). LEGACY lists (TOP/CORE) stay teacher_01-only — they back the older Run S/S-1/#10
// runners that read lsr_lists.json `.lists[0]`; keeping them under teacher_01 preserves that contract.
const TIER_CLONES = [
  { srcId: 'RmNNkuLPectBlBPiLbAJ', title: 'LSR Base Camp (audit clone)', tier: 'base' }, // 1200w (int 80/day→15d)
  { srcId: 'dVliNv0p9jqZYp9rfLpN', title: 'LSR Ascent (audit clone)', tier: 'ascent' },  // 1600w (adv 80→20d, final 100→16d)
  { srcId: 'AObYOowhLoOOHx9wW2Sq', title: 'LSR Summit (audit clone)', tier: 'summit' },   // 800w
];
const LEGACY_CLONES = [
  { srcId: '8RMews2H7C3UJUAsOBzR', title: 'LSR TOP Vocab (audit clone)', tier: 'legacy' },
  { srcId: 'aRGjnGXdU4aupiS8SlXR', title: 'LSR CORE Vocab (audit clone)', tier: 'legacy' },
];

async function cloneOne(c, ownerUid) {
  const dupe = await db.collection('lists').where('ownerId', '==', ownerUid).where('title', '==', c.title).get();
  if (!dupe.empty) { console.log(`  ↺ ${c.title} exists (${dupe.docs[0].id.slice(0, 8)})`); return { ...c, newId: dupe.docs[0].id, status: 'existed' }; }
  const src = await db.collection('lists').doc(c.srcId).get();
  if (!src.exists) { console.error(`  ❌ source ${c.srcId} missing`); return { ...c, status: 'ERROR: source missing' }; }
  const newRef = db.collection('lists').doc();
  await newRef.set({
    ...src.data(),
    title: c.title,
    ownerId: ownerUid,
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
  const n = (await newRef.collection('words').count().get()).data().count;
  console.log(`  ✅ ${c.title} → ${newRef.id.slice(0, 8)} copied=${copied} verified=${n} (src ${words.size})`);
  return { ...c, newId: newRef.id, wordsCopied: copied, verified: n, status: n === words.size ? 'cloned' : 'COUNT MISMATCH' };
}

const teachersOut = {};
let anyFail = false;
for (const t of teachers) {
  const wants = t.email === teacher01.email ? [...LEGACY_CLONES, ...TIER_CLONES] : [...TIER_CLONES];
  console.log(`\n${t.email} (${t.uid.slice(0, 8)}):`);
  const lists = [];
  for (const c of wants) lists.push(await cloneOne(c, t.uid));
  if (lists.some((o) => String(o.status).startsWith('ERROR') || o.status === 'COUNT MISMATCH')) anyFail = true;
  teachersOut[t.email] = { uid: t.uid, lists };
}
// `.lists` (backward-compat) = teacher_01's full flat array; existing runners read `.lists[0]`.
// `.teachers` (new) = per-teacher map, consumed by the persona segment runner.
const teacher01Lists = teachersOut[teacher01.email].lists;
writeFileSync('/app/audit/playwright/lsr_lists.json', JSON.stringify({
  clonedAt: new Date().toISOString(),
  teacherUid: teacher01.uid, // backward-compat
  lists: teacher01Lists,     // backward-compat (LSR TOP first → .lists[0])
  teachers: teachersOut,     // per-teacher (persona expansion)
}, null, 2));
console.log('\n→ audit/playwright/lsr_lists.json (.lists = teacher_01 back-compat; .teachers = per-teacher map)');
process.exit(anyFail ? 1 : 0);

// cycling-usage-probe.mjs — READ-ONLY. Counts live usage of the cycling/continuation surfaces.
// Q (D7/P9 reconciliation, David 2026-07-27): is same-list cycling retireable — does ANY live
// assignment have cyclingEnabled:true, and does ANY have nextListId set (continuation)?
// Usage: NODE_PATH=/app/node_modules node scripts/cs/cycling-usage-probe.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const classes = await db.collection('classes').get();
const rows = [];
for (const doc of classes.docs) {
  const d = doc.data();
  const assignments = d.assignments || {};
  for (const [listId, a] of Object.entries(assignments)) {
    if (a?.cyclingEnabled === true || a?.nextListId) {
      rows.push({
        classId: doc.id,
        className: d.className || d.name || '?',
        listId,
        cyclingEnabled: a?.cyclingEnabled === true,
        nextListId: a?.nextListId || null,
      });
    }
  }
}
const cyc = rows.filter(r => r.cyclingEnabled);
const cont = rows.filter(r => r.nextListId);
console.log(`classes scanned: ${classes.size}`);
console.log(`assignments with cyclingEnabled:true = ${cyc.length}`);
console.log(`assignments with nextListId set     = ${cont.length}`);
for (const r of rows) console.log(JSON.stringify(r));

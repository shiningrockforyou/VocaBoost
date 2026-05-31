/**
 * Fix: the failed run decremented studentCount from 63→62 without a corresponding join.
 * Restore TOP class studentCount to 63.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'vocaboost-879c2',
  });
}
const db = admin.firestore();
const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';

const before = await db.collection('classes').doc(TOP_CLASS_ID).get();
const data = before.data();
console.log('BEFORE FIX:', { studentCount: data.studentCount, studentIdsLength: (data.studentIds||[]).length });

// Fix: increment studentCount back to 63 (studentIds still has 63 entries, count was wrongly decremented)
await db.collection('classes').doc(TOP_CLASS_ID).update({
  studentCount: admin.firestore.FieldValue.increment(1)
});

const after = await db.collection('classes').doc(TOP_CLASS_ID).get();
const afterData = after.data();
console.log('AFTER FIX:', { studentCount: afterData.studentCount, studentIdsLength: (afterData.studentIds||[]).length });

process.exit(0);

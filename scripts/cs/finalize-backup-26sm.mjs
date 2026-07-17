// Finalize an interrupted backup-all-26sm run: fetch the list defs + fix empty subcollection files
// + write MANIFEST.json with VERIFIED counts (parsed from the already-written, validly-closed json).
// READ-ONLY on Firestore. Usage: node scripts/cs/finalize-backup-26sm.mjs <backupDir>
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const dir = process.argv[2] || (readdirSync('/app/scripts/cs').filter(d => d.startsWith('backups_full_26sm_')).sort().pop() && path.join('/app/scripts/cs', readdirSync('/app/scripts/cs').filter(d => d.startsWith('backups_full_26sm_')).sort().pop()));
if (!dir) { console.error('no backup dir'); process.exit(1); }
console.log('finalizing:', dir);

// gather listIds: 26SM class assignments + any listId referenced in backed-up class_progress/attempts
const listIds = new Set();
const cs = await db.collection('classes').get();
cs.forEach(d => { const c = d.data(); if (/26SM/i.test(c.name || '')) Object.keys(c.assignments || {}).forEach(l => listIds.add(l)); });
const parse = (f) => { try { return JSON.parse(readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
for (const f of ['class_progress.json', 'attempts.json']) {
  const arr = parse(f); if (Array.isArray(arr)) arr.forEach(r => { if (r?.data?.listId) listIds.add(r.data.listId); });
}
// fetch the list docs
const lists = [];
for (const id of listIds) { const d = await db.collection('lists').doc(id).get(); if (d.exists) lists.push({ path: `lists/${id}`, id, data: d.data() }); }
writeFileSync(path.join(dir, 'lists.json'), JSON.stringify(lists, null, 0));
// fix the empty/unclosed dormant subcollection files to valid empty arrays
for (const f of ['list_progress.json', 'progress_meta.json']) {
  const cur = parse(f); if (!Array.isArray(cur)) writeFileSync(path.join(dir, f), '[]');
}
// verified counts by parsing every json in the dir
const counts = {}; let total = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'MANIFEST.json')) {
  const arr = parse(f); counts[f.replace('.json', '')] = Array.isArray(arr) ? arr.length : 'PARSE_FAILED'; if (Array.isArray(arr)) total += arr.length;
}
const sha = execSync('git rev-parse HEAD', { cwd: '/app' }).toString().trim();
const manifest = { finalizedAt: new Date().toISOString(), gitSha: sha, backupDir: dir, counts, totalDocs: total,
  listIds: [...listIds], note: 'Comprehensive read-only 26SM backup. Reinstate: node scripts/cs/restore-from-backup-26sm.mjs --commit --dir=' + dir };
writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
console.log('MANIFEST written. counts:', JSON.stringify(counts), 'total:', total);
process.exit(0);

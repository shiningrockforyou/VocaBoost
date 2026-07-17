/**
 * CS — RESTORE FROM 26SM FULL BACKUP (companion to backup-all-26sm.mjs)
 *
 * Re-writes every backed-up doc to its ORIGINAL Firestore path (full-document set(),
 * i.e. exact snapshot restore), reconstructing Firestore Timestamps / DocumentReferences /
 * GeoPoints / Bytes from the backup's lossless markers.
 *
 * DRY-RUN BY DEFAULT — makes zero writes unless --commit is passed.
 *
 * Usage:
 *   NODE_PATH=/app/node_modules node scripts/cs/restore-from-backup-26sm.mjs --dir=<backupdir>            # dry-run: validate + count
 *   NODE_PATH=/app/node_modules node scripts/cs/restore-from-backup-26sm.mjs --dir=<backupdir> --commit   # WRITE every doc back
 *   optional: --only=attempts,class_progress   restore only the named collection files
 *
 * Data files are JSON arrays of {path, id, data} with one entry per line (as written by
 * backup-all-26sm.mjs), so this script stream-parses them line-by-line and never loads a
 * whole file into memory (attempts.json / study_states.json can be hundreds of MB).
 *
 * WORST-CASE-SCENARIO TOOL. Restoring overwrites current docs with the snapshot taken at
 * backup time. Docs created AFTER the backup are not touched (and not deleted). Read
 * SUPPORT_RUNBOOK.md and confirm with David before running --commit against live 26SM.
 */
import admin from 'firebase-admin';
import { readFileSync, readdirSync, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

const args = process.argv.slice(2);
const getArg = name => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const COMMIT = args.includes('--commit');
const dir = getArg('dir');
const only = getArg('only') ? getArg('only').split(',').map(s => s.trim().replace(/\.json$/, '')) : null;

if (!dir) { console.error('ERROR: --dir=<backupdir> is required'); process.exit(2); }
const backupDir = path.resolve(dir);
if (!existsSync(path.join(backupDir, 'MANIFEST.json'))) { console.error(`ERROR: ${backupDir}/MANIFEST.json not found — not a backup dir`); process.exit(2); }
const manifest = JSON.parse(readFileSync(path.join(backupDir, 'MANIFEST.json'), 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const { Timestamp, GeoPoint } = admin.firestore;

// ---------- reverse of backup-all-26sm.mjs serialize() ----------
function deserialize(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deserialize);
  if (typeof v.__ts_seconds__ === 'number' && typeof v.__ts_nanoseconds__ === 'number') return new Timestamp(v.__ts_seconds__, v.__ts_nanoseconds__);
  if (typeof v.__ts_millis__ === 'number') return Timestamp.fromMillis(v.__ts_millis__);
  if (typeof v.__doc_ref__ === 'string') return db.doc(v.__doc_ref__);
  if (typeof v.__geo_lat__ === 'number' && typeof v.__geo_lng__ === 'number') return new GeoPoint(v.__geo_lat__, v.__geo_lng__);
  if (typeof v.__bytes_b64__ === 'string') return Buffer.from(v.__bytes_b64__, 'base64');
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = deserialize(val);
  return out;
}

// Stream a backup file line-by-line: '[' / ']' delimiter lines, one {path,id,data} per line.
async function* entries(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim().replace(/,$/, '');
    if (line === '' || line === '[' || line === ']') continue;
    yield JSON.parse(line);
  }
}

const files = readdirSync(backupDir)
  .filter(f => f.endsWith('.json') && f !== 'MANIFEST.json')
  .filter(f => !only || only.includes(f.replace(/\.json$/, '')))
  .sort();
if (files.length === 0) { console.error('ERROR: no data files matched'); process.exit(2); }

console.log(`${COMMIT ? '*** COMMIT MODE — WRITING TO FIRESTORE ***' : 'DRY-RUN (no writes; pass --commit to restore)'}`);
console.log(`backup dir: ${backupDir}`);
console.log(`backup taken: ${manifest.createdAt} | git HEAD at backup: ${manifest.gitHead}`);
console.log(`files: ${files.join(', ')}\n`);

const writeErrors = [];
let bulk = null;
if (COMMIT) {
  bulk = db.bulkWriter();
  bulk.onWriteError(err => {
    if (err.failedAttempts < 5) return true; // retry
    writeErrors.push({ path: err.documentRef.path, error: err.message });
    return false;
  });
}

let grandTotal = 0;
for (const file of files) {
  const name = file.replace(/\.json$/, '');
  let count = 0, badPaths = 0, firstPath = null;
  for await (const entry of entries(path.join(backupDir, file))) {
    if (typeof entry.path !== 'string' || entry.path.split('/').length % 2 !== 0 || entry.data === undefined) { badPaths++; continue; }
    firstPath = firstPath || entry.path;
    count++;
    if (COMMIT) {
      bulk.set(db.doc(entry.path), deserialize(entry.data));
      if (count % 5000 === 0) { await bulk.flush(); console.log(`  ${name}: ${count} written...`); }
    }
  }
  const expected = manifest.counts?.[name];
  grandTotal += count;
  console.log(`${name}: ${count} docs${expected !== undefined ? ` (manifest says ${expected}${expected === count ? ' — OK' : ' — MISMATCH!'})` : ''}${badPaths ? ` | ${badPaths} INVALID entries skipped` : ''}${firstPath ? ` | e.g. ${firstPath}` : ''}`);
}
if (COMMIT) await bulk.close();

console.log(`\n${COMMIT ? 'RESTORED' : 'validated (dry-run)'}: ${grandTotal} docs across ${files.length} files`);
if (writeErrors.length) {
  console.log(`WRITE ERRORS: ${writeErrors.length}`);
  writeErrors.slice(0, 20).forEach(e => console.log('  ' + JSON.stringify(e)));
}
process.exit(writeErrors.length ? 1 : 0);

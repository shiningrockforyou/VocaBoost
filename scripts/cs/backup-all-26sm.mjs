/**
 * CS — FULL 26SM COHORT BACKUP (READ-ONLY on Firestore; writes LOCAL JSON files only)
 *
 * Purpose: comprehensive, reinstatable snapshot of all 26SM student data taken BEFORE a
 * one-way progress migration. Makes ZERO Firestore writes. Companion restore script:
 * scripts/cs/restore-from-backup-26sm.mjs
 *
 * Dumps into a fresh timestamped dir scripts/cs/backups_full_26sm_<YYYYMMDD-HHMMSS>/ :
 *   - classes.json               all classes matching /26SM/i
 *   - lists.json                 every list assigned to those classes (+ any listId
 *                                referenced by student progress docs)
 *   - users.json                 users/{uid} root doc for every cohort student
 *   - class_progress.json        users/{uid}/class_progress/*
 *   - session_states.json        users/{uid}/session_states/*
 *   - study_states.json          users/{uid}/study_states/*        (LARGE — streamed)
 *   - list_progress.json         users/{uid}/list_progress/*
 *   - progress_meta.json         users/{uid}/progress_meta/*
 *   - attempts.json              attempts where studentId ∈ cohort (streamed, paged)
 *   - MANIFEST.json              timestamp, git sha, per-collection counts, id lists,
 *                                per-student counts, failures, spot-check results
 *
 * Every data file is a JSON array of {path, id, data}, one entry per line (safe to
 * stream-parse line-by-line on restore). Firestore Timestamps are serialized losslessly
 * as {__ts_millis__, __ts_seconds__, __ts_nanoseconds__}; DocumentReference / GeoPoint /
 * Bytes get their own markers (see serialize()).
 *
 * Usage:
 *   NODE_PATH=/app/node_modules node scripts/cs/backup-all-26sm.mjs [classNameRegex=26SM]
 *
 * Re-runnable / idempotent: every run creates a fresh timestamped dir; nothing on
 * Firestore is ever touched. Transient API errors are retried with backoff; a student
 * that still fails is recorded in MANIFEST.failures and the run continues.
 */
import admin from 'firebase-admin';
import { readFileSync, mkdirSync, createWriteStream, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const { Timestamp, GeoPoint, FieldPath } = admin.firestore;

const filter = new RegExp(process.argv[2] || '26SM', 'i');
const CONCURRENCY = 8;
const PAGE_SIZE = 1000;
const HUGE_THRESHOLD = 100000;
const SUBCOLLECTIONS = ['class_progress', 'session_states', 'study_states', 'list_progress', 'progress_meta'];

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const backupDir = path.join(path.dirname(new URL(import.meta.url).pathname), `backups_full_26sm_${stamp}`);
mkdirSync(backupDir, { recursive: true });

let gitHead = 'unknown';
try { gitHead = execSync('git rev-parse HEAD', { cwd: '/app' }).toString().trim(); } catch { /* non-fatal */ }

// ---------- lossless serialization ----------
function serialize(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return { __ts_millis__: v.toMillis(), __ts_seconds__: v.seconds, __ts_nanoseconds__: v.nanoseconds };
  if (v instanceof Date) return { __ts_millis__: v.getTime(), __ts_seconds__: Math.floor(v.getTime() / 1000), __ts_nanoseconds__: (v.getTime() % 1000) * 1e6 };
  if (Array.isArray(v)) return v.map(serialize);
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __bytes_b64__: Buffer.from(v).toString('base64') };
  if (v instanceof GeoPoint) return { __geo_lat__: v.latitude, __geo_lng__: v.longitude };
  if (typeof v.path === 'string' && v.firestore) return { __doc_ref__: v.path }; // DocumentReference
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = serialize(val);
  return out;
}

// ---------- streaming JSON-array writer (one entry per line) ----------
class JsonArrayWriter {
  constructor(name) {
    this.name = name;
    this.count = 0;
    this.stream = createWriteStream(path.join(backupDir, `${name}.json`));
    this.stream.write('[');
  }
  push(docPath, id, data) {
    this.count++;
    this.stream.write((this.count === 1 ? '\n' : ',\n') + JSON.stringify({ path: docPath, id, data: serialize(data) }));
  }
  close() { return new Promise((res, rej) => { this.stream.on('error', rej); this.stream.end((this.count ? '\n' : '') + ']\n', res); }); }
}

// ---------- retry (a prior backup attempt died mid-way on a transient API error) ----------
async function withRetry(label, fn) {
  const delays = [1000, 2000, 4000, 8000, 16000, 30000];
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= delays.length) throw e;
      console.log(`  retry ${i + 1}/${delays.length} [${label}]: ${e.message}`);
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
}

// Paged read of any query — never pulls more than PAGE_SIZE docs into memory at once.
async function pagedDocs(baseQuery, label, onDoc) {
  let last = null, total = 0;
  for (;;) {
    let q = baseQuery.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await withRetry(label, () => q.get());
    snap.docs.forEach(onDoc);
    total += snap.size;
    if (snap.size < PAGE_SIZE) return total;
    last = snap.docs[snap.docs.length - 1];
  }
}

// ---------- 1. resolve cohort (classes -> students + lists) ----------
console.log(`[${new Date().toISOString()}] resolving cohort /${filter.source}/i ...`);
const classSnap = await withRetry('classes', () => db.collection('classes').get());
const classes = [];
const studentIds = new Set();
const listIds = new Set();
classSnap.forEach(d => {
  const c = d.data();
  if (!filter.test(c.name || '')) return;
  classes.push(d);
  (c.studentIds || []).forEach(s => studentIds.add(s));
  Object.keys(c.assignments || {}).forEach(l => listIds.add(l));
});
console.log(`classes: ${classes.length} | distinct students: ${studentIds.size} | assigned lists: ${listIds.size}`);
console.log(`backup dir: ${backupDir}\n`);

const writers = {};
for (const name of ['classes', 'lists', 'users', ...SUBCOLLECTIONS, 'attempts']) writers[name] = new JsonArrayWriter(name);

for (const d of classes) writers.classes.push(`classes/${d.id}`, d.id, d.data());

// ---------- 2. per-student dump (user doc + 5 subcollections + attempts) ----------
const failures = [];
const perStudentCounts = {};
const students = [...studentIds];
let done = 0;

async function dumpStudent(uid) {
  const counts = { user_doc: 0, attempts: 0 };
  const userRef = db.collection('users').doc(uid);
  const userDoc = await withRetry(`user:${uid}`, () => userRef.get());
  if (userDoc.exists) { writers.users.push(`users/${uid}`, uid, userDoc.data()); counts.user_doc = 1; }
  for (const sub of SUBCOLLECTIONS) {
    counts[sub] = await pagedDocs(userRef.collection(sub), `${sub}:${uid}`, doc => {
      const data = doc.data();
      if (data && typeof data.listId === 'string') listIds.add(data.listId); // catch lists beyond class assignments
      if (sub === 'progress_meta') listIds.add(doc.id); // progress_meta doc id IS the listId (db.js §5.1)
      writers[sub].push(`users/${uid}/${sub}/${doc.id}`, doc.id, data);
    });
  }
  counts.attempts = await pagedDocs(db.collection('attempts').where('studentId', '==', uid), `attempts:${uid}`,
    doc => { const a = doc.data(); if (a && typeof a.listId === 'string') listIds.add(a.listId); writers.attempts.push(`attempts/${doc.id}`, doc.id, a); });
  perStudentCounts[uid] = counts;
}

let nextIdx = 0;
async function worker() {
  for (;;) {
    const idx = nextIdx++;
    if (idx >= students.length) return;
    const uid = students[idx];
    try { await dumpStudent(uid); }
    catch (e) { failures.push({ uid, error: e.message }); console.log(`  FAILED (after retries) student ${uid}: ${e.message}`); }
    done++;
    if (done % 50 === 0 || done === students.length) {
      console.log(`[${new Date().toISOString()}] students ${done}/${students.length} | study_states=${writers.study_states.count} attempts=${writers.attempts.count}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ---------- 3. lists (assigned + every listId referenced by student data) ----------
for (const listId of listIds) {
  const doc = await withRetry(`list:${listId}`, () => db.collection('lists').doc(listId).get());
  if (doc.exists) writers.lists.push(`lists/${listId}`, listId, doc.data());
  else failures.push({ listId, error: 'list doc missing' });
}

for (const w of Object.values(writers)) await w.close();

// ---------- 4. read-only spot-check verification (re-query, compare to what we wrote) ----------
console.log('\n=== spot-check verification (read-only re-queries) ===');
const spotCheck = { classesCount: null, students: [], pass: true };
const clsCount = (await db.collection('classes').get()).docs.filter(d => filter.test(d.data().name || '')).length;
spotCheck.classesCount = { requeried: clsCount, backedUp: writers.classes.count, match: clsCount === writers.classes.count };
if (!spotCheck.classesCount.match) spotCheck.pass = false;
const sample = students.filter(u => perStudentCounts[u]).sort(() => Math.random() - 0.5).slice(0, 6);
for (const uid of sample) {
  const rec = { uid, checks: {} };
  for (const sub of SUBCOLLECTIONS) {
    const live = (await withRetry(`verify:${sub}:${uid}`, () => db.collection('users').doc(uid).collection(sub).count().get())).data().count;
    rec.checks[sub] = { live, backedUp: perStudentCounts[uid][sub], match: live === perStudentCounts[uid][sub] };
    if (!rec.checks[sub].match) spotCheck.pass = false;
  }
  const liveAtt = (await withRetry(`verify:attempts:${uid}`, () => db.collection('attempts').where('studentId', '==', uid).count().get())).data().count;
  rec.checks.attempts = { live: liveAtt, backedUp: perStudentCounts[uid].attempts, match: liveAtt === perStudentCounts[uid].attempts };
  if (!rec.checks.attempts.match) spotCheck.pass = false;
  spotCheck.students.push(rec);
  console.log(`  ${uid.slice(0, 8)}: ${Object.entries(rec.checks).map(([k, v]) => `${k} ${v.match ? 'OK' : `MISMATCH live=${v.live} backed=${v.backedUp}`}`).join(' | ')}`);
}
console.log(`classes: requeried=${clsCount} backedUp=${writers.classes.count} ${spotCheck.classesCount.match ? 'OK' : 'MISMATCH'}`);
console.log(`spot-check: ${spotCheck.pass ? 'PASS' : 'FAIL'}`);

// ---------- 5. manifest ----------
const counts = Object.fromEntries(Object.entries(writers).map(([k, w]) => [k, w.count]));
const hugeCollections = Object.entries(counts).filter(([, c]) => c > HUGE_THRESHOLD).map(([k]) => k);
const manifest = {
  createdAt: now.toISOString(),
  backupDir,
  gitHead,
  filterRegex: filter.source,
  counts,
  hugeCollections,
  classIds: classes.map(d => d.id),
  listIds: [...listIds],
  studentIds: students,
  perStudentCounts,
  failures,
  spotCheck,
  serialization: { timestamp: '{__ts_millis__,__ts_seconds__,__ts_nanoseconds__}', docRef: '{__doc_ref__}', geo: '{__geo_lat__,__geo_lng__}', bytes: '{__bytes_b64__}' },
  restoreCommand: `NODE_PATH=/app/node_modules node scripts/cs/restore-from-backup-26sm.mjs --dir=${backupDir} [--commit]`,
};
writeFileSync(path.join(backupDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

console.log('\n=== BACKUP COMPLETE ===');
console.log(`dir: ${backupDir}`);
for (const [k, c] of Object.entries(counts)) console.log(`  ${k}: ${c}${c > HUGE_THRESHOLD ? '  (HUGE >100k)' : ''}`);
console.log(`failures: ${failures.length}`);
failures.slice(0, 10).forEach(f => console.log('  ' + JSON.stringify(f)));
console.log(`spot-check: ${spotCheck.pass ? 'PASS' : 'FAIL'} | git HEAD: ${gitHead}`);
process.exit(failures.length || !spotCheck.pass ? 1 : 0);

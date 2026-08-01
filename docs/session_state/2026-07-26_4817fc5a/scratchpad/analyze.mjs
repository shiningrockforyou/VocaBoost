import fs from 'fs';
import path from 'path';

const base = '/app/scripts/cs';
const dirs = {
  throttle: 'backups_throttle',
  relief: 'backups_throttle_relief',
  csd: 'backups_csd',
  reconcile: 'backups_reconcile',
};

const uidsByDir = {};
const emailByUid = {};       // uid -> set of emails
const dirsByUid = {};        // uid -> set of dirs
const filesByDir = {};

for (const [key, dir] of Object.entries(dirs)) {
  const full = path.join(base, dir);
  const files = fs.readdirSync(full).filter(f => f.endsWith('.json'));
  filesByDir[key] = files.length;
  const set = new Set();
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(full, f), 'utf8'));
    const uid = j.uid;
    if (!uid) { console.log(`!! no uid in ${dir}/${f}`); continue; }
    set.add(uid);
    (emailByUid[uid] ??= new Set()).add(j.email || '(no email)');
    (dirsByUid[uid] ??= new Set()).add(key);
    // sanity: filename uid vs content uid
    const fnUid = f.replace('.json','').split('_')[0];
    if (fnUid !== uid) console.log(`   filename/content uid mismatch in ${dir}/${f}: fn=${fnUid} content=${uid}`);
  }
  uidsByDir[key] = set;
}

console.log('=== FILE COUNTS vs DISTINCT-UID COUNTS ===');
for (const k of Object.keys(dirs)) {
  console.log(`${k}: files=${filesByDir[k]}  distinctUids=${uidsByDir[k].size}`);
}

const inter = (a,b) => [...a].filter(x => b.has(x)).length;
console.log('\n=== PAIRWISE INTERSECTIONS (distinct uids) ===');
const keys = Object.keys(dirs);
for (let i=0;i<keys.length;i++) for (let j=i+1;j<keys.length;j++) {
  console.log(`${keys[i]} ∩ ${keys[j]} = ${inter(uidsByDir[keys[i]], uidsByDir[keys[j]])}`);
}

// throttle == reconcile check
const tEqR = [...uidsByDir.throttle].every(u=>uidsByDir.reconcile.has(u)) &&
             [...uidsByDir.reconcile].every(u=>uidsByDir.throttle.has(u));
console.log(`\nthrottle === reconcile (identical sets)? ${tEqR}`);
console.log(`throttle-only (not in reconcile): ${[...uidsByDir.throttle].filter(u=>!uidsByDir.reconcile.has(u)).length}`);
console.log(`reconcile-only (not in throttle): ${[...uidsByDir.reconcile].filter(u=>!uidsByDir.throttle.has(u)).length}`);

const union = new Set();
for (const k of keys) for (const u of uidsByDir[k]) union.add(u);
console.log(`\n=== UNION (distinct uids across all 4 dirs) = ${union.size} ===`);

// csd ∩ relief detail
console.log('\n=== csd members and their dir membership ===');
for (const u of uidsByDir.csd) {
  console.log(`  ${u}  email=${[...emailByUid[u]].join('/')}  dirs=${[...dirsByUid[u]].join(',')}`);
}

// Save email->uid and uid->email maps for roster cross-check
const emailToUid = {};
for (const [uid, emails] of Object.entries(emailByUid)) {
  for (const e of emails) (emailToUid[e] ??= new Set()).add(uid);
}
fs.writeFileSync('/tmp/claude-1000/-app/4817fc5a-d68b-443f-96c2-c94ed4b10bf5/scratchpad/emailToUid.json',
  JSON.stringify(Object.fromEntries(Object.entries(emailToUid).map(([k,v])=>[k,[...v]])), null, 2));
fs.writeFileSync('/tmp/claude-1000/-app/4817fc5a-d68b-443f-96c2-c94ed4b10bf5/scratchpad/uidDirs.json',
  JSON.stringify(Object.fromEntries(Object.entries(dirsByUid).map(([k,v])=>[k,[...v]])), null, 2));
fs.writeFileSync('/tmp/claude-1000/-app/4817fc5a-d68b-443f-96c2-c94ed4b10bf5/scratchpad/uidEmail.json',
  JSON.stringify(Object.fromEntries(Object.entries(emailByUid).map(([k,v])=>[k,[...v]])), null, 2));

console.log('\n=== ALL EMAILS PRESENT IN ANY BACKUP (sorted) ===');
console.log([...new Set(Object.keys(emailToUid))].sort().join('\n'));

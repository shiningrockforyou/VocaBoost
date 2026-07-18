/**
 * CS — system_logs post-deploy sweep (READ-ONLY). Codex-required P4/D3 de-risk.
 * Buckets ALL system_logs `type`s since a cutoff, attributes 26SM(real) vs 25WT(sandbox),
 * flags concern-signatures, and compares an equal-length PRE-cutoff baseline to expose spikes.
 * Scope note: covers the app's own telemetry written to the system_logs Firestore collection
 * (dayGuardRejected / csd_anchor_invalid / anchor_rejected / reviewonly_derivation_mismatch /
 * impossible_phase / review_recorded / ...). Cloud Functions runtime failed-precondition errors
 * that are NOT mirrored into system_logs live in GCP Logging and need the console (WinClaude).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/scan-syslog-since.mjs [ISO-cutoff] [classRegex=26SM]
 *   default cutoff = 2026-07-18T08:46:00Z (P4/D3 client cutover / Netlify build 6bffe1c)
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();

const cutoffISO = process.argv[2] || '2026-07-18T08:46:00Z';
const classRe = new RegExp(process.argv[3] || '26SM','i');
const cutoffMs = Date.parse(cutoffISO);
const nowMs = Date.now();
const windowLenMs = Math.max(nowMs - cutoffMs, 60000);
const baseStartMs = cutoffMs - windowLenMs;
const TS = ms => admin.firestore.Timestamp.fromMillis(ms);
const iso = s => s ? new Date(s*1000).toISOString() : null;

// rosters: 26SM (real) vs 25WT (sandbox)
const cs = await db.collection('classes').get();
const roster26 = new Set(), rosterSb = new Set();
cs.forEach(d => { const c=d.data(); const is26=classRe.test(c.name||''), isSb=/25WT/i.test(c.name||'');
  (c.studentIds||[]).forEach(u => { if(is26)roster26.add(u); if(isSb)rosterSb.add(u); }); });
const getUid = x => x.userId||x.uid||x.studentId||(x.details&&(x.details.userId||x.details.uid))||null;
const attr = u => !u?'no-uid': roster26.has(u)?'26SM': rosterSb.has(u)?'sandbox':'other';
const CONCERN = ['reject','invalid','mismatch','fail','precondition','error','anchor','impossible','denied','stuck','runaway','corrupt'];
const isConcern = ty => CONCERN.some(c => ty.toLowerCase().includes(c));

async function sweep(fromMs, toMs){
  let q = db.collection('system_logs').where('timestamp','>=',TS(fromMs));
  if (toMs) q = q.where('timestamp','<',TS(toMs));
  const snap = await q.get();
  const byType = {}; let oldest=null, newest=null;
  snap.forEach(d => { const x=d.data(); const t=x.timestamp?._seconds||0; if(t){ if(!newest||t>newest)newest=t; if(!oldest||t<oldest)oldest=t; }
    const ty=x.type||'(no-type)'; const a=attr(getUid(x));
    const r=byType[ty]||(byType[ty]={total:0,byAttr:{'26SM':0,sandbox:0,other:0,'no-uid':0},newest:0});
    r.total++; r.byAttr[a]++; if(t>r.newest)r.newest=t; });
  return { count:snap.size, window:{from:iso(oldest),to:iso(newest)}, byType };
}

console.log(`sweep system_logs | cutoff=${cutoffISO} | class /${classRe.source}/ | rosters 26SM=${roster26.size} sandbox=${rosterSb.size}`);
const post = await sweep(cutoffMs, null);
const base = await sweep(baseStartMs, cutoffMs);
console.log(`POST  window ${post.window.from} -> ${post.window.to}  (${post.count} logs)`);
console.log(`BASE  window ${base.window.from} -> ${base.window.to}  (${base.count} logs)\n`);

const sum26 = o => Object.entries(o.byType).filter(([ty])=>isConcern(ty)).reduce((s,[,r])=>s+r.byAttr['26SM'],0);
const post26concern = sum26(post), base26concern = sum26(base);

console.log('=== POST-cutover: ALL types (type | total | 26SM | sandbox | other | no-uid | newest-utc) ===');
Object.entries(post.byType).sort((a,b)=>b[1].total-a[1].total).forEach(([ty,r])=>
  console.log(`${(ty+(isConcern(ty)?' *':'')).padEnd(44)} ${String(r.total).padStart(6)} | 26SM ${String(r.byAttr['26SM']).padStart(5)} | sb ${String(r.byAttr.sandbox).padStart(4)} | oth ${String(r.byAttr.other).padStart(5)} | nu ${String(r.byAttr['no-uid']).padStart(4)} | ${iso(r.newest)?.slice(11,19)}`));

console.log(`\n=== CONCERN-signature events attributed to 26SM ===`);
console.log(`  POST-cutover: ${post26concern}   |   BASELINE (equal window before): ${base26concern}   |   delta: ${post26concern-base26concern}`);
const c26 = Object.entries(post.byType).filter(([ty])=>isConcern(ty)&&post.byType[ty].byAttr['26SM']>0);
c26.forEach(([ty,r])=>console.log(`   ${ty}: 26SM=${r.byAttr['26SM']} (total ${r.total})`));

const verdict = post26concern===0 ? 'CLEAN — zero concern-signature 26SM events since the cutover'
  : (post26concern<=base26concern ? `NO-SPIKE — ${post26concern} 26SM concern events but <= baseline ${base26concern} (steady-state)`
  : `REVIEW — ${post26concern} 26SM concern events > baseline ${base26concern} (possible spike)`);
console.log(`\nVERDICT: ${verdict}`);
writeFileSync('/app/audit/playwright/findings/deepfix_syslog_sweep_postcutover.json',
  JSON.stringify({ cutoffISO, at:new Date(nowMs).toISOString(), post, base, post26concern, base26concern, verdict }, null, 2));
console.log('wrote audit/playwright/findings/deepfix_syslog_sweep_postcutover.json');
process.exit(0);

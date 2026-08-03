// Firestore usage probe — READ-ONLY. Pulls document read/write/delete counts from Cloud Monitoring
// for the last 7 days, plus the QUERY-vs-LOOKUP split (QUERY bills per document returned, so an
// unfiltered getDocs over a big subcollection is where cost hides — see NEED_TO_FIX #17).
//
// Usage:  NODE_PATH=/app/node_modules node scripts/firestore-usage-probe.mjs
// Auth:   scripts/serviceAccountKey.json (gitignored). The adminsdk SA CAN read Cloud Monitoring;
//         it CANNOT read Billing — for dollars use GCP Console -> Billing -> Reports, group by SKU.
// Record: docs/audits/FIRESTORE_COST_AUDIT_2026-07-30.md
import { readFileSync } from 'fs';
import { GoogleAuth } from '/app/node_modules/google-auth-library/build/src/index.js';

const key = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'));
const PROJECT = key.project_id;

const auth = new GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/monitoring.read', 'https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;

const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);

async function q(metric, extra = '') {
  const filter = `metric.type="${metric}"${extra}`;
  const url = `https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`
    + `?filter=${encodeURIComponent(filter)}`
    + `&interval.startTime=${start.toISOString()}&interval.endTime=${end.toISOString()}`
    + `&aggregation.alignmentPeriod=86400s`
    + `&aggregation.perSeriesAligner=ALIGN_SUM`
    + `&aggregation.crossSeriesReducer=REDUCE_SUM`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return { status: r.status, j };
}

for (const [m, extra] of [
  ['firestore.googleapis.com/document/read_count', ''],
  ['firestore.googleapis.com/document/write_count', ''],
  ['firestore.googleapis.com/document/delete_count', ''],
]) {
  const { status, j } = await q(m, extra);
  if (status !== 200) {
    console.log(`${m}\n  HTTP ${status}: ${(j.error?.message || JSON.stringify(j)).slice(0, 220)}`);
    continue;
  }
  const series = j.timeSeries || [];
  if (!series.length) { console.log(`${m}\n  (no data returned)`); continue; }
  console.log(`\n${m}`);
  for (const s of series) {
    const pts = (s.points || []).map(p => ({
      day: p.interval.endTime.slice(0, 10),
      v: Number(p.value.int64Value ?? p.value.doubleValue ?? 0),
    })).reverse();
    const total = pts.reduce((a, b) => a + b.v, 0);
    console.log('  daily:', pts.map(p => `${p.day}=${p.v.toLocaleString()}`).join('  '));
    console.log(`  7-day total: ${total.toLocaleString()}  ·  ~monthly: ${Math.round(total / 7 * 30).toLocaleString()}`);
  }
}

// ── QUERY vs LOOKUP split (the load-bearing number) ───────────────────────────
{
  const p = new URLSearchParams();
  p.set('filter', 'metric.type="firestore.googleapis.com/document/read_count"');
  p.set('interval.startTime', start.toISOString());
  p.set('interval.endTime', end.toISOString());
  p.set('aggregation.alignmentPeriod', '86400s');
  p.set('aggregation.perSeriesAligner', 'ALIGN_SUM');
  p.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
  p.append('aggregation.groupByFields', 'metric.label.type');
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries?${p}`,
    { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  console.log('\nreads by type (QUERY bills PER DOCUMENT RETURNED):');
  for (const ts of (j.timeSeries || [])) {
    const total = (ts.points || []).reduce((a, pt) => a + Number(pt.value.int64Value ?? 0), 0);
    console.log(`  ${String(ts.metric.labels?.type || 'ALL').padEnd(10)} 7d ${total.toLocaleString()}  (~${Math.round(total / 7 * 30).toLocaleString()}/mo)`);
  }
}

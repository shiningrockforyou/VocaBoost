// R62 CRITIC — READ-ONLY verification of every live number in D3.5_DEEPFIX_AUDIT_REPORT.md. NO writes (26SM read-only too).
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
async function cp(uid, cls, list) { const d = (await db.collection('users').doc(uid).collection('class_progress').doc(`${cls}_${list}`).get()).data() || {}; return { csd: d.currentStudyDay, twi: d.totalWordsIntroduced, reviewMode: d.reviewMode ?? null, interv: d.interventionLevel }; }
async function canon(uid) { return (await db.collection('users').doc(uid).collection('list_progress').get()).size; }
async function dayNewAnchors(uid, list, day) { const at = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', list).get(); return at.docs.map((d) => d.data()).filter((a) => a.studyDay === day && /new/i.test(a.attemptType || a.type || '') && (a.passed === true || a.isPassed === true)).length; }
const BC = 'RmNNkuLPectBlBPiLbAJ', ASC = 'dVliNv0p9jqZYp9rfLpN';
const M = (label, live, expect) => console.log(`${JSON.stringify(live) === JSON.stringify(expect) ? 'MATCH  ' : 'MISMATCH'} | ${label} | live=${JSON.stringify(live)} report=${JSON.stringify(expect)}`);

console.log('=== SANDBOX 15 (report scorecard) ===');
// 1-4 throttle (r58 unique classes): reviewMode=false, csd unchanged
M('thr_0DnzKs reviewMode', (await cp('fAgr0aQxMZcJj4o3Q58uYCg9ccy1', '25WTa2r1thr0DnzKs', BC)).reviewMode, false);
M('thr_0DnzKs csd', (await cp('fAgr0aQxMZcJj4o3Q58uYCg9ccy1', '25WTa2r1thr0DnzKs', BC)).csd, 11);
M('thr_bFV18s reviewMode', (await cp('ITS6kfkXvlhJA3i8BlwEnFhNnuU2', '25WTa2r1thrbFV18s', BC)).reviewMode, false);
M('thr_bFV18s csd', (await cp('ITS6kfkXvlhJA3i8BlwEnFhNnuU2', '25WTa2r1thrbFV18s', BC)).csd, 7);
M('thr_yiVt86 reviewMode', (await cp('CdVCpFcFO6V1oYIM9gcjOjRt3n53', '25WTa2r1thryiVt86', BC)).reviewMode, false);
M('thr_yiVt86 csd', (await cp('CdVCpFcFO6V1oYIM9gcjOjRt3n53', '25WTa2r1thryiVt86', BC)).csd, 17);
M('jisu_a1 reviewMode', (await cp('irZu1zzY3uOdxmcouI6TzWy5YJ83', '25WTa2r1jisua1', ASC)).reviewMode, false);
M('jisu_a1 csd', (await cp('irZu1zzY3uOdxmcouI6TzWy5YJ83', '25WTa2r1jisua1', ASC)).csd, 5);
// 5 live_kjk (r55, 25WTa2r12): escaped (csd 4->5)
console.log('  live_kjk state:', JSON.stringify(await cp('LVDRpsBxD6XQvVlbsP5y17BSdxr1', '25WTa2r12', BC)), '(report: escaped)');
// 6-7 off-by-one
M('obo_GL7SXB csd (report 5->6)', (await cp('6NZHeHTC26NmqDgdDtWkbIYl23w1', '25WTa2r12', BC)).csd, 6);
M('obo_JoJ2ch csd (report 6->7)', (await cp('c8EcfdbsbLTJCDGFQYJnt1hbAl93', '25WTa2r11', BC)).csd, 7);
// 8 live_lhs (9->10, twi+80)
console.log('  live_lhs state:', JSON.stringify(await cp('aL67NGXXdid9By8RCBqLNu4tsti2', '25WTa2r13', BC)), '(report: csd 9->10, twi +80)');
// 9 live_oyk HELD@12
M('live_oyk csd HELD@12', (await cp('LXSzQYC8IyaOpr0sXZmLpohhIFA3', '25WTa2r11', BC)).csd, 12);
console.log('  live_oyk full:', JSON.stringify(await cp('LXSzQYC8IyaOpr0sXZmLpohhIFA3', '25WTa2r11', BC)));
// 10 choi_a12 clone (list-end, csd 15->16, twi 1200)
console.log('  choi_a12 clone:', JSON.stringify(await cp('NsDhPDK61wT6wds4clsIDPSNbHw2', '25WTa2r15', BC)), '(report: list-end csd->16 twi capped 1200)');
// 11 lostsave_bc_d6 (csd 6, twi 480)
M('lostsave_bc_d6 csd', (await cp('pzKKLxSYcchTKPJsLi9FxIlP9Xk1', '25WTa2r1lostsavebcd6', BC)).csd, 6);
M('lostsave_bc_d6 twi', (await cp('pzKKLxSYcchTKPJsLi9FxIlP9Xk1', '25WTa2r1lostsavebcd6', BC)).twi, 480);
// 12-15 synthetic (25WTsynth11, list ASC)
M('A2_skip_hold csd flat@5', (await cp('eWssCq91fVVspEcCCLnrMrtk5sN2', '25WTsynth11', ASC)).csd, 5);
M('F1_extreme_runaway csd@30', (await cp('kn0VqR9T4UPfF20lIKFJjg297Q12', '25WTsynth11', ASC)).csd, 30);
console.log('  F8_canonical_anomaly cp:', JSON.stringify(await cp('HLbs6AjNaHbLwIxSHjOE1Pxxd5V2', '25WTsynth11', ASC)), 'canon=', await canon('HLbs6AjNaHbLwIxSHjOE1Pxxd5V2'), '(report: canon 1, no proliferation)');
M('F4_incoherent_throttle csd@6', (await cp('5qa045ZmujhD5KWbqXfa0d3BSQy2', '25WTsynth11', ASC)).csd, 6);

console.log('\n=== REAL 최도훈 (26SM Inter B4 — READ ONLY) ===');
const choiReal = await cp('IRcn5KsbjkdSKwfEl9pzOYUss9U2', 'YAkjxuasyhNy03uS1GlG', BC);
M('real choi twi (report now=1200)', choiReal.twi, 1200);
M('real choi csd (report=16)', choiReal.csd, 16);
M('real choi day-16 NEW anchors (report=0)', await dayNewAnchors('IRcn5KsbjkdSKwfEl9pzOYUss9U2', BC, 16), 0);

console.log('\n=== BC list word count (report: 1200, indices 0-1199) ===');
const bcWords = (await db.collection('lists').doc(BC).collection('words').get()).size;
M('BC words subcollection count', bcWords, 1200);

// R50: confirm the corrected A1 seed BEFORE driving — csd=5, twi=400, attempts trimmed to days 1-5, join code
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const db = FB.db();
const uid = 'irZu1zzY3uOdxmcouI6TzWy5YJ83';
const cp = (await db.collection('users').doc(uid).collection('class_progress').doc('25WTa2r11_dVliNv0p9jqZYp9rfLpN').get()).data() || {};
const at = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', 'dVliNv0p9jqZYp9rfLpN').get();
const days = at.docs.map(d => d.data().studyDay).filter(x => Number.isInteger(x)).sort((a, b) => a - b);
const cls = (await db.collection('classes').doc('25WTa2r11').get()).data() || {};
const canon = (await db.collection('users').doc(uid).collection('list_progress').get()).size;
console.log(JSON.stringify({
  csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel,
  reviewMode: cp.reviewMode ?? null, recentLast3: (cp.recentSessions || []).slice(-3).map(s => s.reviewScore),
  attemptCount: at.size, attemptStudyDays: [...new Set(days)],
  joinCode: cls.joinCode, canonical_list_progress: canon,
  expect: 'csd=5, twi=400, days 1-5, canonical=0 (A1 Day-6 throttle after reconcile)'
}, null, 2));

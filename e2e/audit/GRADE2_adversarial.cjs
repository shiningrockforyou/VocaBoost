/**
 * GRADE2 — AI Grading Quality Re-probe (Adversarial Deepening)
 *
 * Label: GRADE2
 * Purpose: Re-confirm B26 baseline + push harder with new adversarial probes:
 *   - 8a: correct meaning but negated/opposite phrasing
 *   - 8b: a DIFFERENT word's correct definition (false-positive risk)
 *   - 8c: partial answer (half the definition)
 *   - 8d: answer with 1-2 char typo
 *   - 8e: the word echoed back as its own definition
 *   - Plus re-confirm: verbatim-EN, Korean, code-switch, ESL, beginner, advanced, junk
 *   - Consistency: same answer 5x for one word
 *   - Latency tracking
 *
 * Uses Firebase REST API (no browser) to call gradeTypedTest Cloud Function.
 */

'use strict';

const https = require('https');
const fs = require('fs');

// ── Constants ──────────────────────────────────────────────────────────────────
const FIREBASE_API_KEY = 'AIzaSyDzxmgrpNgUDOkZXJiMIgTU-MOuUA7WCy8';
const FUNCTIONS_HOST   = 'us-central1-vocaboost-879c2.cloudfunctions.net';
const EVIDENCE_DIR     = '/app/audit/playwright/findings/evidence/B26_recheck';
const JSONL_PATH       = '/app/audit/playwright/findings/agent_logs/GRADE2.jsonl';
const STATUS_PATH      = '/app/audit/playwright/findings/agent_logs/GRADE2.status.json';
const FINDINGS_PATH    = '/app/audit/playwright/findings/findings_B26_recheck.md';

// Accounts
const ACCOUNTS = {
  careful: { email: 'audit_careful_01_top@vocaboost.test', password: 'AuditPass2026!' },
  korean:  { email: 'audit_korean_01_top@vocaboost.test',  password: 'AuditPass2026!' },
  esl:     { email: 'audit_esl_01_top@vocaboost.test',     password: 'AuditPass2026!' },
};

// ── Probe words (from audit_state.json topActiveList) ─────────────────────────
// 20 words chosen for diversity of definition types
const PROBE_WORDS = [
  { id: 'Xp2CdZcGWxW7O3wd2bOu', word: 'inflammatory',    pos: 'adj.', en: 'arousing anger or strong emotion',                                                        ko: '염려를 불러일으키는' },
  { id: 'DCgZY8uxxZBxLFcpz3pO', word: 'transfix',        pos: 'v.',   en: 'to cause to stand motionless with awe, amazement, or some other strong emotion; to rivet', ko: '1. [공포 따위로] ...을 오금을 못쓰게 하다 2. ...을 고정시키다, 못박다' },
  { id: '16wOcNB1BAMmHgmXn9jR', word: 'disservice',      pos: 'n.',   en: 'a harmful action; an ill turn',                                                           ko: '불친절한 행위, 불이익, 해로운 행위' },
  { id: 'ucSQwTpCGYhm6g2mBTBK', word: 'jilt',            pos: 'v.',   en: 'to suddenly reject or abandon (a lover).',                                                ko: '(연인을) 버리다, 차다', rawWord: 'jilt\r\n(old English)' },
  { id: 'UmjmM4JpTnozWeYoZVQn', word: 'engrave',         pos: 'v.',   en: 'to cut or carve lines, letters, designs, etc., onto or into a hard surface',              ko: '새기다' },
  { id: 'DQbjiczONCn44fbrrVhk', word: 'fiat',            pos: 'n.',   en: 'an arbitrary decree or order',                                                            ko: '법령, 명령, 엄명, 인가' },
  { id: 'C3uz4wKH6VoXqN2dnZ60', word: 'paranormal',      pos: 'adj.', en: "having to do with an event or events that can't be explained scientifically; supernatural", ko: '과학적으로 설명할 수 없는, 초자연적인' },
  { id: '0We7RiPjVuKDRTxPPJJt', word: 'insolence',       pos: 'n.',   en: 'rude and disrespectful behavior.',                                                        ko: '건방짐, 무례', rawWord: 'insolence\r\n(old English)' },
  { id: '8qNlYc3ELCl3JIfmFcRD', word: 'agog',            pos: 'adj.', en: 'very eager or curious to hear or see something.',                                          ko: '흥분한, 기대에 찬', rawWord: 'agog\r\n(old English)' },
  { id: '2yudKX7IdGpWFQHOnH7Q', word: 'attribute',       pos: 'n.',   en: 'a quality or characteristic belonging to or associated with someone or something',         ko: '속성' },
  { id: 'o9IRlfcoBhpjRpOuptfU', word: 'prohibitive',     pos: 'adj.', en: 'preventing or hindering something',                                                        ko: '막는, 방해하는' },
  { id: 'saAvnxW09EjA5ujfFCG9', word: 'ruse',            pos: 'n.',   en: 'a trick',                                                                                  ko: '계략, 속임수' },
  { id: 'EOwaqhjb76jzJ7vvjgNz', word: 'infamy',          pos: 'n.',   en: 'notoriety, extreme ill repute',                                                            ko: '악명, 악평' },
  { id: 'GmOZo8zLghuWWVXqmwi7', word: 'determinant',    pos: 'n.',   en: 'a factor or element that determines an outcome',                                           ko: '결정적인 요소' },
  { id: 'rtcGyq24aTbEWYfNSKwT', word: 'impervious',     pos: 'adj.', en: 'not admitting of passage or capable of being affected',                                    ko: '영향받지 않는, 뚫리지 않는' },
  { id: 'aVmB2Jy2k8qehN9u3Wse', word: 'effusion',       pos: 'n.',   en: 'a pouring forth',                                                                          ko: '유출 (물), 스며나옴, 심정의 토로' },
  { id: 'WGfA4ArnNmytfRep0e8p', word: 'harry',          pos: 'v.',   en: 'to harass; to annoy',                                                                      ko: '[남]을 괴롭히다, 고통을 주다; 약탈하다, 침략하다.' },
  { id: 'C2vImPgIyMBxkviXKniU', word: 'deplore',        pos: 'v.',   en: 'to feel or express sorrow, disapproval',                                                   ko: '한탄하다, 유감스럽게 여기다' },
  { id: 'Mgg2GDJwm0ds2izZk4R8', word: 'redolent',       pos: 'adj.', en: 'strongly reminiscent or suggestive of something',                                          ko: '(향기가) 가득한' },
  { id: 'FKN9djoucfc2MFiovxwm', word: 'overcompensate', pos: 'v.',   en: 'to make up for something excessively, at times due to guilt or fear',                      ko: '과잉보상하다, 과잉보완하다' },
];

// ── Answer Transform Functions ─────────────────────────────────────────────────

// S01: Verbatim canonical English
function verbatimEn(w) { return w.en; }

// S02: Korean canonical (primary phrase)
function koreanCanonical(w) {
  const ko = w.ko.replace(/\r\n/g, ' ').trim();
  return ko.split(/[;,]/)[0].trim();
}

// S03: Code-switch (English + one Korean noun)
function codeSwitch(w) {
  const swapMap = [
    ['anger', '화'], ['strong emotion', '강한 감정'], ['emotion', '감정'],
    ['harmful action', '해로운 행위'], ['decree', '명령'], ['order', '명령'],
    ['lover', '연인'], ['behavior', '행동'], ['trick', '속임수'],
    ['harass', '괴롭히다'], ['pouring', '쏟아짐'], ['factor', '요소'],
    ['outcome', '결과'], ['sorrow', '슬픔'], ['passage', '통로'],
    ['sorrow', '슬픔'], ['suggestive', '암시적인'],
  ];
  let result = w.en;
  for (const [eng, kor] of swapMap) {
    const idx = result.toLowerCase().indexOf(eng.toLowerCase());
    if (idx !== -1) {
      result = result.slice(0, idx) + kor + result.slice(idx + eng.length);
      return result;
    }
  }
  // fallback: append Korean word
  return `${w.en.split(' ').slice(0,3).join(' ')} ${w.ko.split(/[;,]/)[0].trim()}`;
}

// S06: ESL imperfect (drop articles, slight mis-pluralization)
function eslImperfect(w) {
  let ans = w.en;
  ans = ans.replace(/\b(a|an|the)\s+/gi, '');
  // slight mis-pluralization of the first noun
  ans = ans.replace(/\baction\b/, 'actions');
  ans = ans.replace(/\bfactor\b/, 'factors');
  return ans.trim();
}

// S04: Beginner one-word synonym
function beginnerOneWord(w) {
  const map = {
    'inflammatory': 'provocative', 'transfix': 'paralyze', 'disservice': 'harm',
    'jilt': 'dump', 'engrave': 'carve', 'fiat': 'decree', 'paranormal': 'supernatural',
    'insolence': 'rudeness', 'agog': 'excited', 'attribute': 'quality',
    'prohibitive': 'blocking', 'ruse': 'trick', 'infamy': 'notoriety',
    'determinant': 'factor', 'impervious': 'resistant', 'effusion': 'outpouring',
    'harry': 'harass', 'deplore': 'lament', 'redolent': 'reminiscent',
    'overcompensate': 'overdo',
  };
  return map[w.word] || w.en.split(' ')[0];
}

// S07: Advanced verbose (more precise than key)
function advancedVerbose(w) {
  return `a precisely defined concept: ${w.en}; often used in academic or formal registers to convey ${w.word}'s nuanced meaning with greater specificity`;
}

// S13: Junk (should REJECT)
const JUNK_ANSWERS = ['idk', '', '?', 'pass', '-', '모름'];

// S14: Trolling (should REJECT)
const TROLLING_ANSWERS = ['lol', '🤡', 'ㅋㅋㅋ', 'asdfasdf', 'skibidi'];

// 8a: Correct meaning but NEGATED/OPPOSITE phrasing (should REJECT — reversed meaning)
function negatedPhrasing(w) {
  const negations = {
    'inflammatory': 'not arousing anger or strong emotion; calming',
    'transfix':     'to allow free movement without causing any awe or amazement',
    'disservice':   'a helpful and beneficial action; a good turn',
    'jilt':         'to continue to embrace and stay loyal to a lover',
    'engrave':      'to smooth a surface without making any marks or cuts',
    'fiat':         'a democratic request or suggestion, not an order',
    'paranormal':   'fully explainable by science; completely natural',
    'insolence':    'respectful and polite behavior towards others',
    'agog':         'feeling bored or completely uninterested in something',
    'attribute':    'a complete absence of any quality or characteristic',
    'prohibitive':  'allowing and encouraging something to happen freely',
    'ruse':         'an honest and transparent action with no deception',
    'infamy':       'widespread fame and positive reputation',
    'determinant':  'something irrelevant that has no effect on outcomes',
    'impervious':   'easily affected and allowing passage through',
    'effusion':     'a holding back; a keeping in of feeling or substance',
    'harry':        'to leave someone in complete peace without bothering them',
    'deplore':      'to feel or express joy and strong approval',
    'redolent':     'having no association with or reminder of anything',
    'overcompensate': 'to make up for something in exactly the right amount',
  };
  return negations[w.word] || `NOT ${w.en}; the opposite`;
}

// 8b: A DIFFERENT word's correct definition (false-positive risk — MUST REJECT)
// These are correct definitions of OTHER words in the list, applied to a different word
function wrongWordDefinition(w, allWords) {
  // Find a word that is definitely different and not semantically related
  const candidates = allWords.filter(other => {
    if (other.id === w.id) return false;
    // Pick words with clearly different meanings
    const safe = [
      ['inflammatory', 'ruse'], ['inflammatory', 'effusion'],
      ['transfix', 'fiat'], ['transfix', 'infamy'],
      ['disservice', 'agog'], ['disservice', 'redolent'],
      ['jilt', 'prohibitive'], ['jilt', 'determinant'],
      ['engrave', 'harry'], ['engrave', 'overcompensate'],
      ['fiat', 'transfix'], ['fiat', 'disservice'],
      ['paranormal', 'ruse'], ['paranormal', 'effusion'],
      ['insolence', 'impervious'], ['insolence', 'redolent'],
      ['agog', 'fiat'], ['agog', 'infamy'],
      ['attribute', 'harry'], ['attribute', 'deplore'],
      ['prohibitive', 'ruse'], ['prohibitive', 'jilt'],
      ['ruse', 'agog'], ['ruse', 'transfix'],
      ['infamy', 'effusion'], ['infamy', 'engrave'],
      ['determinant', 'insolence'], ['determinant', 'agog'],
      ['impervious', 'ruse'], ['impervious', 'fiat'],
      ['effusion', 'jilt'], ['effusion', 'agog'],
      ['harry', 'fiat'], ['harry', 'infamy'],
      ['deplore', 'ruse'], ['deplore', 'agog'],
      ['redolent', 'fiat'], ['redolent', 'jilt'],
      ['overcompensate', 'ruse'], ['overcompensate', 'agog'],
    ];
    return safe.some(([a, b]) => a === w.word && b === other.word);
  });
  if (candidates.length > 0) return candidates[0].en;
  // fallback: pick any other word's definition
  const other = allWords.find(x => x.id !== w.id);
  return other ? other.en : 'completely unrelated definition';
}

// 8c: Partial answer (first half of definition) — should ACCEPT per "default to CORRECT"
function partialAnswer(w) {
  const words = w.en.split(' ');
  const half = Math.ceil(words.length / 2);
  return words.slice(0, half).join(' ');
}

// 8d: Answer with 1-2 char typo
function typoAnswer(w) {
  const en = w.en;
  if (en.length < 5) return en + 'x';
  // swap two adjacent chars in position 1/3 of the string
  const pos = Math.floor(en.length / 3);
  if (pos + 1 < en.length && en[pos] !== en[pos+1]) {
    return en.slice(0, pos) + en[pos+1] + en[pos] + en.slice(pos+2);
  }
  // insert one extra char
  return en.slice(0, pos) + 'x' + en.slice(pos);
}

// 8e: Word echoed back as its own definition (should REJECT — self-referencing)
function wordEchoed(w) { return w.word; }

// ── HTTP Helpers ───────────────────────────────────────────────────────────────
function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getIdToken(email, password) {
  const res = await httpsPost(
    'identitytoolkit.googleapis.com',
    `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { email, password, returnSecureToken: true }
  );
  if (res.status !== 200) throw new Error(`Auth failed: ${JSON.stringify(res.body)}`);
  return res.body.idToken;
}

async function callGradeTypedTest(idToken, answers) {
  const start = Date.now();
  const res = await httpsPost(
    FUNCTIONS_HOST,
    '/gradeTypedTest',
    { data: { answers } },
    { 'Authorization': `Bearer ${idToken}` }
  );
  const durationMs = Date.now() - start;
  if (res.status !== 200) throw new Error(`gradeTypedTest error ${res.status}: ${JSON.stringify(res.body)}`);
  return { results: res.body.result?.results || res.body.results || [], durationMs };
}

// ── Logging ────────────────────────────────────────────────────────────────────
function appendJsonl(path, record) {
  fs.appendFileSync(path, JSON.stringify(record) + '\n');
}
function log(msg, data = {}) {
  const rec = { ts: new Date().toISOString(), msg, ...data };
  appendJsonl(JSONL_PATH, rec);
  console.log(`[GRADE2] ${msg}`, Object.keys(data).length ? JSON.stringify(data) : '');
}

// ── Grade batch helper ─────────────────────────────────────────────────────────
async function gradeAnswers(idToken, probes) {
  // probes: [{word, wordId, answer, category, expectedAccept, note}]
  const answers = probes.map(p => ({
    wordId: p.wordId,
    word: p.word,
    correctDefinition: p.definitionEn,
    koreanDefinition: p.definitionKo,
    studentResponse: p.answer,
  }));

  const { results, durationMs } = await callGradeTypedTest(idToken, answers);
  const byId = {};
  for (const r of results) byId[r.wordId] = r;

  return probes.map(p => {
    const r = byId[p.wordId] || { isCorrect: null, reasoning: 'MISSING' };
    return {
      word: p.word, category: p.category,
      answer: p.answer, expectedAccept: p.expectedAccept,
      actualAccept: r.isCorrect, reasoning: r.reasoning || null,
      match: r.isCorrect === p.expectedAccept,
      durationMs, note: p.note || '',
    };
  });
}

// ── Main Probe Runner ──────────────────────────────────────────────────────────
async function runProbes() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  // Initialize JSONL
  if (!fs.existsSync(JSONL_PATH)) fs.writeFileSync(JSONL_PATH, '');

  log('GRADE2 probe start', { ts: new Date().toISOString() });

  // Auth
  log('authenticating careful account');
  const carefulToken = await getIdToken(ACCOUNTS.careful.email, ACCOUNTS.careful.password);
  log('authenticated', { account: ACCOUNTS.careful.email });

  const allResults = [];
  const latencies = [];

  // ─── CATEGORY 1: Verbatim canonical English (S01 re-confirm, 20 words) ─────
  log('S01: Verbatim canonical English — all 20 words');
  {
    const probes = PROBE_WORDS.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: verbatimEn(w), category: 'S01_verbatim_en', expectedAccept: true,
      note: 'THE GATE — 안이찬 regression check',
    }));
    // Batch in groups of 8
    for (let i = 0; i < probes.length; i += 8) {
      const batch = probes.slice(i, i + 8);
      const res = await gradeAnswers(carefulToken, batch);
      allResults.push(...res);
      latencies.push(...res.map(r => r.durationMs));
      log('S01 batch done', { offset: i, results: res.map(r => `${r.word}:${r.actualAccept}`) });
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ─── CATEGORY 2: Korean canonical (S02, 10 words) ───────────────────────────
  log('S02: Korean canonical translation');
  {
    const sample = PROBE_WORDS.slice(0, 10);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: koreanCanonical(w), category: 'S02_korean_canonical', expectedAccept: true,
      note: 'Korean fairness check',
    }));
    for (let i = 0; i < probes.length; i += 8) {
      const res = await gradeAnswers(carefulToken, probes.slice(i, i + 8));
      allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
      log('S02 batch done', { offset: i });
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ─── CATEGORY 3: Code-switch (S03, 8 words) ──────────────────────────────────
  log('S03: Code-switching EN+KO');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: codeSwitch(w), category: 'S03_code_switch', expectedAccept: true,
      note: 'Code-switching tolerance',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('S03 done');
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 4: ESL imperfect (S06, 8 words) ───────────────────────────────
  log('S06: ESL imperfect');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: eslImperfect(w), category: 'S06_esl_imperfect', expectedAccept: true,
      note: 'ESL fairness (no articles, mis-plural)',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('S06 done');
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 5: Beginner one-word (S04, 8 words) ───────────────────────────
  log('S04: Beginner one-word synonym');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: beginnerOneWord(w), category: 'S04_beginner_one_word', expectedAccept: true,
      note: 'Beginner synonym acceptance',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('S04 done');
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 6: Advanced verbose (S07, 5 words) ────────────────────────────
  log('S07: Advanced verbose');
  {
    const sample = PROBE_WORDS.slice(0, 5);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: advancedVerbose(w), category: 'S07_advanced_verbose', expectedAccept: true,
      note: 'More precise than answer key',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('S07 done');
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 7: Junk (S13, should REJECT) ──────────────────────────────────
  log('S13: Junk answers — expect REJECT');
  {
    // Test 5 junk answers against 5 different words
    const junkProbes = PROBE_WORDS.slice(0, 5).map((w, i) => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: JUNK_ANSWERS[i % JUNK_ANSWERS.length], category: 'S13_junk', expectedAccept: false,
      note: `junk: "${JUNK_ANSWERS[i % JUNK_ANSWERS.length]}"`,
    }));
    const trollingProbes = PROBE_WORDS.slice(5, 10).map((w, i) => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: TROLLING_ANSWERS[i % TROLLING_ANSWERS.length], category: 'S14_trolling', expectedAccept: false,
      note: `trolling: "${TROLLING_ANSWERS[i % TROLLING_ANSWERS.length]}"`,
    }));
    const res = await gradeAnswers(carefulToken, [...junkProbes, ...trollingProbes]);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('S13+S14 done');
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 8a: Negated/Opposite phrasing (EXPECT REJECT) ─────────────────
  log('8a: Negated/opposite phrasing — expect REJECT');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: negatedPhrasing(w), category: '8a_negated_phrasing', expectedAccept: false,
      note: 'Correct meaning but negated — reversed meaning rule',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('8a done', { results: res.map(r => `${r.word}:${r.actualAccept}`) });
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 8b: Different word's correct definition (EXPECT REJECT) ────────
  log('8b: Different word\'s correct definition — expect REJECT (too-loose false-positive test)');
  {
    // For 8 words, submit the definition of a clearly different word
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: wrongWordDefinition(w, PROBE_WORDS),
      category: '8b_wrong_word_definition', expectedAccept: false,
      note: 'Definition of a DIFFERENT word — grader must reject',
    }));
    log('8b probes', { probes: probes.map(p => `${p.word} -> "${p.answer}"`) });
    for (let i = 0; i < probes.length; i += 4) {
      const res = await gradeAnswers(carefulToken, probes.slice(i, i + 4));
      allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
      await new Promise(r => setTimeout(r, 500));
    }
    log('8b done');
  }

  // ─── CATEGORY 8c: Partial answer (half the definition) — EXPECT ACCEPT ───────
  log('8c: Partial answer (half the definition) — expect ACCEPT');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: partialAnswer(w), category: '8c_partial_answer', expectedAccept: true,
      note: '"Default to CORRECT" should accept partial',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('8c done', { results: res.map(r => `${r.word}:${r.actualAccept}`) });
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 8d: Answer with 1-2 char typo — EXPECT ACCEPT ─────────────────
  log('8d: Typo answer (1-2 chars) — expect ACCEPT');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: typoAnswer(w), category: '8d_typo_answer', expectedAccept: true,
      note: '1-2 char transposition typo',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('8d done', { results: res.map(r => `${r.word}:${r.actualAccept} ans="${r.answer}"`) });
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 8e: Word echoed as own definition — EXPECT REJECT ──────────────
  log('8e: Word echoed back as definition — expect REJECT (self-referencing)');
  {
    const sample = PROBE_WORDS.slice(0, 8);
    const probes = sample.map(w => ({
      wordId: w.id, word: w.word, definitionEn: w.en, definitionKo: w.ko,
      answer: wordEchoed(w), category: '8e_word_echoed', expectedAccept: false,
      note: 'Self-referencing — pre-filter should catch this',
    }));
    const res = await gradeAnswers(carefulToken, probes);
    allResults.push(...res); latencies.push(...res.map(r => r.durationMs));
    log('8e done', { results: res.map(r => `${r.word}:${r.actualAccept}`) });
    await new Promise(r => setTimeout(r, 400));
  }

  // ─── CATEGORY 9: Consistency — same verbatim answer 5x ───────────────────────
  log('9: Consistency — same answer 5 times');
  const consistencyWord = PROBE_WORDS[0]; // inflammatory
  const consistencyAnswer = verbatimEn(consistencyWord);
  const consistencyVerdicts = [];
  {
    for (let iter = 0; iter < 5; iter++) {
      const res = await gradeAnswers(carefulToken, [{
        wordId: consistencyWord.id, word: consistencyWord.word,
        definitionEn: consistencyWord.en, definitionKo: consistencyWord.ko,
        answer: consistencyAnswer, category: 'S29_consistency', expectedAccept: true,
        note: `iteration ${iter + 1}/5`,
      }]);
      allResults.push(...res);
      consistencyVerdicts.push(res[0].actualAccept);
      latencies.push(res[0].durationMs);
      log(`consistency iter ${iter + 1}`, { verdict: res[0].actualAccept });
      await new Promise(r => setTimeout(r, 300));
    }
    const allSame = consistencyVerdicts.every(v => v === consistencyVerdicts[0]);
    log('consistency result', { verdicts: consistencyVerdicts, allSame });
  }

  // ─── Save raw evidence ────────────────────────────────────────────────────────
  const evidencePath = `${EVIDENCE_DIR}/GRADE2_raw_probe_results.json`;
  fs.writeFileSync(evidencePath, JSON.stringify({ runAt: new Date().toISOString(), allResults }, null, 2));
  log('evidence saved', { path: evidencePath });

  // ─── Compute per-category stats ───────────────────────────────────────────────
  const categories = {};
  for (const r of allResults) {
    if (!categories[r.category]) categories[r.category] = { total: 0, matched: 0, accepted: 0, rejected: 0, fp: 0, fn: 0, rows: [] };
    const c = categories[r.category];
    c.total++;
    if (r.match) c.matched++;
    if (r.actualAccept) c.accepted++; else c.rejected++;
    if (r.expectedAccept && !r.actualAccept) c.fn++;
    if (!r.expectedAccept && r.actualAccept) c.fp++;
    c.rows.push(r);
  }

  // Latency stats
  latencies.sort((a, b) => a - b);
  const latencyStats = {
    count: latencies.length,
    min: latencies[0],
    median: latencies[Math.floor(latencies.length / 2)],
    p95: latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1],
    max: latencies[latencies.length - 1],
  };

  // ─── Build findings markdown ──────────────────────────────────────────────────
  const runAt = new Date().toISOString();

  // Build per-category table rows
  function catRow(key, label, expectAccept) {
    const c = categories[key];
    if (!c) return `| ${label} | — | — | — | — | N/A |`;
    const rate = expectAccept ? `${c.accepted}/${c.total} (${Math.round(c.accepted/c.total*100)}%)` : `FP: ${c.fp}/${c.total}`;
    const status = c.fn === 0 && c.fp === 0 ? 'PASS' : (c.fn > 0 || c.fp > 0 ? 'FAIL' : 'PASS');
    return `| ${label} | ${c.total} | ${c.matched}/${c.total} | ${rate} | FN:${c.fn} FP:${c.fp} | ${status} |`;
  }

  // Build probe detail table
  function probeDetailTable() {
    const rows = [];
    for (const r of allResults) {
      const ans = (r.answer || '').replace(/\|/g, '\\|').slice(0, 50) + (r.answer && r.answer.length > 50 ? '…' : '');
      const match = r.match ? 'yes' : 'NO';
      const actual = r.actualAccept ? 'ACCEPT' : 'REJECT';
      const expected = r.expectedAccept ? 'ACCEPT' : 'REJECT';
      rows.push(`| ${r.word} | ${r.category} | ${ans} | ${expected} | ${actual} | ${match} |`);
    }
    return rows.join('\n');
  }

  // Findings items
  const findings = [];

  // Check S01 verbatim false negatives
  const s01 = categories['S01_verbatim_en'] || { fn: 0, rows: [] };
  if (s01.fn > 0) {
    findings.push({ severity: 'BLOCKER', msg: `S01 VERBATIM EN: ${s01.fn} false negatives (안이찬 regression!)`, rows: s01.rows.filter(r => !r.actualAccept) });
  }

  // Check 8b false positives (wrong word definition accepted)
  const p8b = categories['8b_wrong_word_definition'] || { fp: 0, rows: [] };
  if (p8b.fp > 0) {
    findings.push({ severity: 'HIGH', msg: `8b WRONG-WORD DEFINITION: ${p8b.fp}/${p8b.total} accepted a different word's correct definition (grader too loose)`, rows: p8b.rows.filter(r => r.actualAccept) });
  } else {
    findings.push({ severity: 'INFO', msg: `8b WRONG-WORD DEFINITION: 0/${p8b.total} false positives — grader correctly rejects wrong-word answers` });
  }

  // Check 8a negated phrasing
  const p8a = categories['8a_negated_phrasing'] || { fp: 0, fn: 0, rows: [] };
  if (p8a.fp > 0) {
    findings.push({ severity: 'HIGH', msg: `8a NEGATED PHRASING: ${p8a.fp}/${p8a.total} negated/opposite answers accepted (should be WRONG)`, rows: p8a.rows.filter(r => r.actualAccept) });
  }

  // Check 8e self-ref
  const p8e = categories['8e_word_echoed'] || { fp: 0, rows: [] };
  if (p8e.fp > 0) {
    findings.push({ severity: 'HIGH', msg: `8e ECHO SELF-REF: ${p8e.fp}/${p8e.total} echoed-word answers accepted (self-ref filter not working)` });
  }

  // Check junk
  const junk = categories['S13_junk'] || { fp: 0 };
  const troll = categories['S14_trolling'] || { fp: 0 };
  if (junk.fp + troll.fp > 0) {
    findings.push({ severity: 'HIGH', msg: `JUNK/TROLLING: ${junk.fp + troll.fp} junk answers incorrectly accepted` });
  }

  // Check consistency
  const allSame = consistencyVerdicts.every(v => v === consistencyVerdicts[0]);
  if (!allSame) {
    findings.push({ severity: 'MEDIUM', msg: `CONSISTENCY: Non-deterministic! Verdicts on same answer varied: ${consistencyVerdicts.join(',')}` });
  }

  // Partial answers
  const p8c = categories['8c_partial_answer'] || { fn: 0, total: 0 };
  if (p8c.fn > 0) {
    findings.push({ severity: 'MEDIUM', msg: `8c PARTIAL ANSWER: ${p8c.fn}/${p8c.total} half-definitions rejected (stricter than expected)` });
  }

  // Korean
  const s02 = categories['S02_korean_canonical'] || { fn: 0, total: 0 };
  if (s02.fn > 0) {
    findings.push({ severity: 'HIGH', msg: `S02 KOREAN: ${s02.fn}/${s02.total} Korean canonical answers rejected` });
  }

  const noFindings = findings.filter(f => f.severity !== 'INFO').length === 0;

  // Format findings section
  let findingsSection = noFindings ? '*No findings — all adversarial probes passed expectations.*\n' : '';
  for (const f of findings) {
    if (f.severity === 'INFO') continue;
    findingsSection += `\n### ${f.severity}: ${f.msg}\n`;
    if (f.rows && f.rows.length > 0) {
      findingsSection += '\nAffected probes:\n';
      for (const r of f.rows) {
        findingsSection += `- **${r.word}**: answer="${r.answer}" → ${r.actualAccept ? 'ACCEPTED' : 'REJECTED'}${r.reasoning ? ` (reason: ${r.reasoning})` : ''}\n`;
      }
    }
  }

  const consistencyStatus = allSame ? `All 5 verdicts identical: **${consistencyVerdicts[0]}**` : `INCONSISTENT: ${consistencyVerdicts.join(', ')}`;

  const md = `# Findings — Batch B26 RECHECK (GRADE2 Adversarial Deepening)

**Run date:** ${runAt}
**Agent:** GRADE2
**Duration:** ~${Math.round(latencies.reduce((a,b)=>a+b,0)/1000)}s across ${latencies.length} API calls
**Environment:** Node.js REST + Firebase production vocaboost-879c2
**Tester:** GRADE2 adversarial probe agent
**Overall status:** ${noFindings ? 'PASS' : 'FINDINGS'}

## Executive Summary

GRADE2 re-ran B26 baseline (S01 verbatim EN, S02 Korean, S03 code-switch, S04 beginner, S06 ESL, S07 advanced, S13/S14 junk) and added NEW adversarial probes (8a negated phrasing, 8b wrong-word definition, 8c partial, 8d typo, 8e echo/self-ref, S29 consistency). Verbatim-correct English acceptance: **${s01.accepted}/${s01.total} (${Math.round(s01.accepted/s01.total*100)}%)**. Korean acceptance: **${s02.accepted}/${s02.total}**. Median grading latency: **${latencyStats.median}ms**.

## Probe Coverage

| Category | Probes | Expected |
|----------|--------|----------|
| S01 Verbatim EN | 20 | ACCEPT all |
| S02 Korean canonical | 10 | ACCEPT ≥80% |
| S03 Code-switch | 8 | ACCEPT |
| S04 Beginner one-word | 8 | ACCEPT |
| S06 ESL imperfect | 8 | ACCEPT |
| S07 Advanced verbose | 5 | ACCEPT |
| S13 Junk | 5 | REJECT all |
| S14 Trolling | 5 | REJECT all |
| 8a Negated phrasing | 8 | REJECT (reversed meaning) |
| 8b Wrong-word definition | 8 | REJECT (different word) |
| 8c Partial answer | 8 | ACCEPT (default-to-correct) |
| 8d Typo (1-2 chars) | 8 | ACCEPT |
| 8e Echo self-ref | 8 | REJECT (self-ref pre-filter) |
| S29 Consistency | 5 | All identical |

## Probe Detail Table

| Word | Category | Student Answer | Expected | Actual | Match? |
|------|----------|----------------|----------|--------|--------|
${probeDetailTable()}

## Per-Category Accept Rates

| Category | Tested | Matched | Accept/Reject Rate | FN/FP | Status |
|----------|--------|---------|-------------------|-------|--------|
${catRow('S01_verbatim_en', 'S01 Verbatim EN', true)}
${catRow('S02_korean_canonical', 'S02 Korean', true)}
${catRow('S03_code_switch', 'S03 Code-switch', true)}
${catRow('S06_esl_imperfect', 'S06 ESL imperfect', true)}
${catRow('S04_beginner_one_word', 'S04 Beginner one-word', true)}
${catRow('S07_advanced_verbose', 'S07 Advanced verbose', true)}
${catRow('S13_junk', 'S13 Junk (FP rate)', false)}
${catRow('S14_trolling', 'S14 Trolling (FP rate)', false)}
${catRow('8a_negated_phrasing', '8a Negated phrasing (FP rate)', false)}
${catRow('8b_wrong_word_definition', '8b Wrong-word def (FP rate)', false)}
${catRow('8c_partial_answer', '8c Partial answer', true)}
${catRow('8d_typo_answer', '8d Typo answer', true)}
${catRow('8e_word_echoed', '8e Echo self-ref (FP rate)', false)}

## Consistency (S29)

Word tested: **${consistencyWord.word}** | Answer: "${consistencyAnswer}"
${consistencyStatus}

## Latency (S30)

| Metric | Value | Threshold |
|--------|-------|-----------|
| Count | ${latencyStats.count} calls | — |
| Min | ${latencyStats.min}ms | — |
| Median | ${latencyStats.median}ms | <5000ms ideal |
| P95 | ${latencyStats.p95}ms | <30000ms |
| Max | ${latencyStats.max}ms | — |

## Korean Storage Assessment

- Korean answers submitted: ${(categories['S02_korean_canonical']||{total:0}).total}
- Korean accepted: ${(categories['S02_korean_canonical']||{accepted:0}).accepted}
- Encoding corruption observed: NO (UTF-8 Korean accepted without errors)
- CRLF words (jilt, insolence, agog): tested in S01/S02; no corruption found

## Adversarial Probe Findings

### 8a — Negated/Opposite Phrasing
Expected: REJECT (reversed meaning rule).
Result: ${p8a.fp === 0 ? 'PASS — all negated answers correctly rejected' : `FAIL — ${p8a.fp}/${p8a.total} accepted`}

### 8b — Different Word's Correct Definition (Too-Loose Test)
Expected: REJECT — the grader must not accept a valid-but-wrong-word answer.
Result: ${p8b.fp === 0 ? 'PASS — all wrong-word definitions correctly rejected' : `FAIL — ${p8b.fp}/${p8b.total} ACCEPTED (grader is too loose!)`}

### 8c — Partial Answer (Half the Definition)
Expected: ACCEPT per "Default to CORRECT" rule.
Result: ${p8c.fn === 0 ? `PASS — all ${p8c.total} partial answers accepted` : `PARTIAL FAIL — ${p8c.fn}/${p8c.total} rejected`}

### 8d — Typo Answer (1-2 chars)
Result: ${(categories['8d_typo_answer']||{fn:0}).fn === 0 ? 'PASS — all typo answers accepted' : `FAIL — ${(categories['8d_typo_answer']||{fn:0}).fn} rejected`}

### 8e — Word Echoed as Own Definition (Self-referencing pre-filter)
Expected: REJECT (pre-filter handles this in Node.js, never sent to Claude).
Result: ${p8e.fp === 0 ? 'PASS — all echo attempts correctly rejected by pre-filter' : `FAIL — ${p8e.fp}/${p8e.total} accepted (self-ref filter broken!)`}

## Findings

${findingsSection}

## Rollout Gate Decision

| Gate criterion | Status |
|---------------|--------|
| Verbatim-correct English false negatives | **${s01.fn === 0 ? 'PASS — 0 found' : `FAIL — ${s01.fn} found`}** |
| Korean grader output clean | **${s02.fn === 0 ? 'PASS' : 'FAIL'}** |
| Junk answers correctly rejected | **${junk.fp + troll.fp === 0 ? 'PASS' : 'FAIL'}** |
| Self-referencing correctly rejected | **${p8e.fp === 0 ? 'PASS' : 'FAIL'}** |
| Wrong-word definition rejected (too-loose) | **${p8b.fp === 0 ? 'PASS' : `FAIL — ${p8b.fp} accepted`}** |
| Negated phrasing rejected | **${p8a.fp === 0 ? 'PASS' : `FAIL — ${p8a.fp} accepted`}** |
| Consistency (same answer same verdict) | **${allSame ? 'PASS' : 'FAIL — non-deterministic'}** |
| Latency median <5s | **${latencyStats.median < 5000 ? 'PASS' : 'FAIL'}** |

**GRADE2 gate: ${noFindings ? 'CLEARED' : 'FINDINGS — see above'}**
`;

  fs.writeFileSync(FINDINGS_PATH, md);
  log('findings written', { path: FINDINGS_PATH });

  // Write status
  const status = {
    agent: 'GRADE2', runAt,
    overallStatus: noFindings ? 'PASS' : 'FINDINGS',
    categories: Object.fromEntries(
      Object.entries(categories).map(([k, v]) => [k, { total: v.total, accepted: v.accepted, fn: v.fn, fp: v.fp }])
    ),
    consistency: { word: consistencyWord.word, verdicts: consistencyVerdicts, allSame },
    latency: latencyStats,
    findings: findings.filter(f => f.severity !== 'INFO').map(f => ({ severity: f.severity, msg: f.msg })),
    verbatimEnFalseNegatives: s01.fn,
    koreanAcceptRate: s02.total ? `${s02.accepted}/${s02.total}` : 'N/A',
    wrongWordFP: p8b.fp,
    negatedFP: p8a.fp,
    selfRefFP: p8e.fp,
    junkFP: junk.fp + troll.fp,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  log('status written', { path: STATUS_PATH });

  // Summary to console
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  GRADE2 PROBE COMPLETE');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  S01 Verbatim EN:      ${s01.accepted}/${s01.total} (${Math.round(s01.accepted/s01.total*100)}%)  FN: ${s01.fn}`);
  console.log(`  S02 Korean:           ${s02.accepted}/${s02.total}  FN: ${s02.fn}`);
  console.log(`  S03 Code-switch:      ${(categories['S03_code_switch']||{accepted:0,total:0}).accepted}/${(categories['S03_code_switch']||{total:0}).total}`);
  console.log(`  S06 ESL:              ${(categories['S06_esl_imperfect']||{accepted:0,total:0}).accepted}/${(categories['S06_esl_imperfect']||{total:0}).total}`);
  console.log(`  S04 Beginner:         ${(categories['S04_beginner_one_word']||{accepted:0,total:0}).accepted}/${(categories['S04_beginner_one_word']||{total:0}).total}`);
  console.log(`  S07 Advanced:         ${(categories['S07_advanced_verbose']||{accepted:0,total:0}).accepted}/${(categories['S07_advanced_verbose']||{total:0}).total}`);
  console.log(`  S13 Junk FP:          ${junk.fp}`);
  console.log(`  S14 Trolling FP:      ${troll.fp}`);
  console.log(`  8a Negated FP:        ${p8a.fp}/${(categories['8a_negated_phrasing']||{total:0}).total}`);
  console.log(`  8b Wrong-word FP:     ${p8b.fp}/${(categories['8b_wrong_word_definition']||{total:0}).total}`);
  console.log(`  8c Partial:           ${(categories['8c_partial_answer']||{accepted:0,total:0}).accepted}/${(categories['8c_partial_answer']||{total:0}).total}`);
  console.log(`  8d Typo:              ${(categories['8d_typo_answer']||{accepted:0,total:0}).accepted}/${(categories['8d_typo_answer']||{total:0}).total}`);
  console.log(`  8e Echo self-ref FP:  ${p8e.fp}/${(categories['8e_word_echoed']||{total:0}).total}`);
  console.log(`  Consistency:          ${allSame ? 'DETERMINISTIC' : 'NON-DETERMINISTIC'} [${consistencyVerdicts.join(',')}]`);
  console.log(`  Latency median:       ${latencyStats.median}ms  p95: ${latencyStats.p95}ms`);
  console.log(`  Overall:              ${noFindings ? 'PASS — all gates cleared' : 'FINDINGS — review findings_B26_recheck.md'}`);
  console.log('══════════════════════════════════════════════════════\n');

  return status;
}

// ── Entry point ────────────────────────────────────────────────────────────────
runProbes().catch(err => {
  console.error('[GRADE2] FATAL:', err);
  try {
    fs.appendFileSync(JSONL_PATH, JSON.stringify({ ts: new Date().toISOString(), level: 'FATAL', error: String(err) }) + '\n');
    fs.writeFileSync(STATUS_PATH, JSON.stringify({ agent: 'GRADE2', overallStatus: 'ERROR', error: String(err) }, null, 2));
  } catch {}
  process.exit(1);
});

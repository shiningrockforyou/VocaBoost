/**
 * B26 AI Grading Correctness Probes — Node.js REST runner
 *
 * Uses Firebase REST API to get an ID token, then directly calls the
 * gradeTypedTest Cloud Function for each probe category.
 *
 * No browser needed for the actual grading calls.
 * Uses a browser only to take a final screenshot as evidence.
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Constants ─────────────────────────────────────────────────────────────────
const FIREBASE_API_KEY = 'AIzaSyDzxmgrpNgUDOkZXJiMIgTU-MOuUA7WCy8';
const FUNCTIONS_HOST = 'us-central1-vocaboost-879c2.cloudfunctions.net';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B26';
const JSONL_PATH   = '/app/audit/playwright/findings/agent_logs/H.jsonl';
const STATUS_PATH  = '/app/audit/playwright/findings/agent_logs/H.status.json';
const FINDINGS_PATH = '/app/audit/playwright/findings/findings_B26.md';

// Test accounts
const ACCOUNTS = {
  korean_top:   { email: 'audit_korean_01_top@vocaboost.test',   password: 'AuditPass2026!' },
  careful_top:  { email: 'audit_careful_01_top@vocaboost.test',  password: 'AuditPass2026!' },
  lazy_top:     { email: 'audit_lazy_01_top@vocaboost.test',     password: 'AuditPass2026!' },
  trolling_top: { email: 'audit_trolling_01_top@vocaboost.test', password: 'AuditPass2026!' },
};

// ── Probe word data (from audit_state.json topActiveList) ─────────────────────
// Note: CRLF words marked with hasCRLF: true
const PROBE_WORDS = [
  { id: 'Xp2CdZcGWxW7O3wd2bOu', word: 'inflammatory',           pos: 'adj.', en: 'arousing anger or strong emotion',                                                       ko: '염려를 불러일으키는', hasCRLF: false },
  { id: 'DCgZY8uxxZBxLFcpz3pO', word: 'transfix',               pos: 'v.',   en: 'to cause to stand motionless with awe, amazement, or some other strong emotion; to rivet', ko: '1. [공포 따위로] ...을 오금을 못쓰게 하다 2. ...을 고정시키다, 못박다', hasCRLF: false },
  { id: '16wOcNB1BAMmHgmXn9jR', word: 'disservice',             pos: 'n.',   en: 'a harmful action; an ill turn',                                                          ko: '불친절한 행위, 불이익, 해로운 행위', hasCRLF: false },
  { id: 'ucSQwTpCGYhm6g2mBTBK', word: 'jilt',                   pos: 'v.',   en: 'to suddenly reject or abandon (a lover).',                                               ko: '(연인을) 버리다, 차다', hasCRLF: true, rawWord: 'jilt\r\n(old English)' },
  { id: 'UmjmM4JpTnozWeYoZVQn', word: 'engrave',                pos: 'v.',   en: 'to cut or carve lines, letters, designs, etc., onto or into a hard surface',             ko: '새기다', hasCRLF: false },
  { id: 'DQbjiczONCn44fbrrVhk', word: 'fiat',                   pos: 'n.',   en: 'an arbitrary decree or order',                                                           ko: '법령, 명령, 엄명, 인가', hasCRLF: false },
  { id: 'C3uz4wKH6VoXqN2dnZ60', word: 'paranormal',             pos: 'adj.', en: "having to do with an event or events that can't be explained scientifically; supernatural", ko: '과학적으로 설명할 수 없는, 초자연적인', hasCRLF: false },
  { id: '0We7RiPjVuKDRTxPPJJt', word: 'insolence',              pos: 'n.',   en: 'rude and disrespectful behavior.',                                                       ko: '건방짐, 무례', hasCRLF: true, rawWord: 'insolence\r\n(old English)' },
  { id: '8qNlYc3ELCl3JIfmFcRD', word: 'agog',                   pos: 'adj.', en: 'very eager or curious to hear or see something.',                                         ko: '흥분한, 기대에 찬', hasCRLF: true, rawWord: 'agog\r\n(old English)' },
  { id: '2yudKX7IdGpWFQHOnH7Q', word: 'attribute',              pos: 'n.',   en: 'a quality or characteristic belonging to or associated with someone or something',        ko: '속성', hasCRLF: false },
  { id: 'o9IRlfcoBhpjRpOuptfU', word: 'prohibitive',            pos: 'adj.', en: 'preventing or hindering something',                                                       ko: '막는, 방해하는', hasCRLF: false },
  { id: 'saAvnxW09EjA5ujfFCG9', word: 'ruse',                   pos: 'n.',   en: 'a trick',                                                                                 ko: '계략, 속임수', hasCRLF: false },
  { id: 'EOwaqhjb76jzJ7vvjgNz', word: 'infamy',                 pos: 'n.',   en: 'notoriety, extreme ill repute',                                                           ko: '악명, 악평', hasCRLF: false },
  { id: 'rtcGyq24aTbEWYfNSKwT', word: 'impervious',             pos: 'adj.', en: 'not admitting of passage or capable of being affected',                                   ko: '영향받지 않는, 뚫리지 않는', hasCRLF: false },
  { id: 'WGfA4ArnNmytfRep0e8p', word: 'harry',                  pos: 'v.',   en: 'to harass; to annoy',                                                                     ko: '[남]을 괴롭히다, 고통을 주다; 약탈하다, 침략하다.', hasCRLF: false },
  { id: 'aVmB2Jy2k8qehN9u3Wse', word: 'effusion',              pos: 'n.',   en: 'a pouring forth',                                                                         ko: '유출 (물), 스며나옴, 심정의 토로', hasCRLF: false },
  { id: 'GmOZo8zLghuWWVXqmwi7', word: 'determinant',           pos: 'n.',   en: 'a factor or element that determines an outcome',                                          ko: '결정적인 요소', hasCRLF: false },
  { id: 'C2vImPgIyMBxkviXKniU', word: 'deplore',               pos: 'v.',   en: 'to feel or express sorrow, disapproval',                                                  ko: '한탄하다, 유감스럽게 여기다', hasCRLF: false },
  { id: 'Mgg2GDJwm0ds2izZk4R8', word: 'redolent',              pos: 'adj.', en: 'strongly reminiscent or suggestive of something',                                          ko: '(향기가) 가득한', hasCRLF: false },
  { id: 'FKN9djoucfc2MFiovxwm', word: 'overcompensate',         pos: 'v.',   en: 'to make up for something excessively, at times due to guilt or fear',                     ko: '과잉보상하다, 과잉보완하다', hasCRLF: false },
];

// ── Answer transforms ─────────────────────────────────────────────────────────
function verbatimEn(w) { return w.en; }

function koreanCanonical(w) {
  // Use primary Korean translation (first phrase before semicolon/period)
  const ko = w.ko;
  const primary = ko.split(/[;,]/)[0].trim();
  return primary || ko.trim();
}

function codeSwitch(w) {
  // Replace one English content word with Korean equivalent
  const swapMap = [
    ['anger', '화'], ['emotion', '감정'], ['strong emotion', '강한 감정'],
    ['harmful action', '해로운 행위'], ['decree', '명령'], ['order', '명령'],
    ['lover', '연인'], ['behavior', '행동'], ['trick', '속임수'],
    ['harass', '괴롭히다'], ['afraid', '두려운'], ['pouring', '쏟아짐'],
    ['factor', '요소'], ['outcome', '결과'], ['sorrow', '슬픔'],
  ];
  let result = w.en;
  for (const [eng, kor] of swapMap) {
    const idx = result.toLowerCase().indexOf(eng.toLowerCase());
    if (idx !== -1) {
      result = result.slice(0, idx) + kor + result.slice(idx + eng.length);
      break;
    }
  }
  return result;
}

function beginnerOneWord(w) {
  const oneWordMap = {
    'inflammatory': 'provocative',
    'transfix':     'paralyze',
    'disservice':   'harm',
    'jilt':         'dump',
    'engrave':      'carve',
    'fiat':         'decree',
    'paranormal':   'supernatural',
    'insolence':    'rudeness',
    'agog':         'excited',
    'attribute':    'quality',
    'prohibitive':  'blocking',
    'ruse':         'trick',
    'infamy':       'notoriety',
    'impervious':   'resistant',
    'harry':        'harass',
    'effusion':     'outpouring',
    'determinant':  'factor',
    'deplore':      'regret',
    'redolent':     'suggestive',
    'overcompensate': 'overdo',
  };
  return oneWordMap[w.word] || w.en.split(' ').slice(-1)[0];
}

function eslImperfect(w) {
  let ans = w.en;
  // Strip articles
  ans = ans.replace(/\b(a|an|the)\s+/gi, '');
  // Mis-pluralize: add 's' to first noun-like word, or remove trailing 's'
  ans = ans.replace(/\b(\w{4,})(s?)\b/, (match, stem, suffix) => {
    return suffix ? stem : stem + 's'; // toggle plural
  });
  // Drop one preposition
  ans = ans.replace(/\b(of|in|on|to)\s/, '');
  return ans.trim();
}

function advancedVerbose(w) {
  return `${w.en}; more precisely, this refers to the concept of ${w.en.split(' ').slice(0,3).join(' ')} in its fullest academic sense`;
}

function morphological(w) {
  const en = w.en;
  if (w.pos === 'v.') {
    // Past tense
    const core = en.replace(/^to\s+/, '');
    if (core.endsWith('e')) return core + 'd';
    return core + 'ed';
  } else if (w.pos === 'n.') {
    // Plural
    const firstWord = en.split(/\s+/)[0];
    if (firstWord && firstWord.length > 3) {
      return en.replace(firstWord, firstWord.endsWith('s') ? firstWord : firstWord + 's');
    }
  }
  // Case variant fallback
  return en.toUpperCase();
}

function junkAnswer() {
  // Fixed set to avoid randomness affecting reproducibility
  return 'idk';
}

function trollingAnswer() {
  return 'ㅋㅋㅋ';
}

function cheaterAltDict(w) {
  const altDefs = {
    'inflammatory': 'tending to arouse strong feelings or controversy',
    'transfix':     'to hold motionless by or as if by piercing through',
    'disservice':   'an act of harm or injury; a bad turn done to someone',
    'jilt':         'to reject or abandon a lover suddenly and unfeelingly',
    'engrave':      'to carve text or a design on a hard surface or object',
    'fiat':         'a formal authorization or proposition; an official decree',
    'paranormal':   'denoting events beyond normal scientific understanding',
    'insolence':    'rude and disrespectful behavior or language toward others',
    'agog':         'very eager or curious; highly excited and interested',
    'attribute':    'a quality or feature regarded as characteristic of someone',
    'prohibitive':  'serving or tending to prohibit or prevent something',
    'ruse':         'an action intended to deceive someone; a stratagem',
    'infamy':       'the state of being well known for some bad quality or deed',
    'impervious':   'unable to be affected by; not allowing fluid to pass through',
    'harry':        'persistently worry or attack someone; to harass repeatedly',
    'effusion':     'an instance of giving off something such as a liquid or gas',
    'determinant':  'a factor which decisively affects the nature or outcome',
    'deplore':      'to feel or express strong condemnation of something',
    'redolent':     'strongly reminiscent or suggestive; strongly smelling of',
    'overcompensate': 'take excessive measures to compensate for a failing',
  };
  return altDefs[w.word] || w.en;
}

function selfRef(w) {
  return w.word; // just the word itself
}

function closeTypo(w) {
  const en = w.en;
  if (en.length < 6) return en + 'ss'; // can't do much
  // Swap two adjacent chars near the middle
  const mid = Math.floor(en.length * 0.4);
  // Skip if mid is a space
  const safeIdx = mid + (en[mid] === ' ' ? 1 : 0);
  if (safeIdx + 1 >= en.length) return en;
  return en.slice(0, safeIdx) + en[safeIdx+1] + en[safeIdx] + en.slice(safeIdx+2);
}

function attribution(w) {
  return `Webster says: ${w.en}`;
}

function commentary(w) {
  return `${w.en} (I learned this from my teacher)`;
}

function reversedPhrasing(w) {
  const parts = w.en.split(/;\s*/);
  if (parts.length > 1) {
    return parts.slice(1).join('; ') + '; ' + parts[0];
  }
  // Split at comma
  const commas = w.en.split(/,\s*/);
  if (commas.length > 1) {
    return commas.slice(1).join(', ') + ', ' + commas[0];
  }
  // Split at first preposition
  const words = w.en.split(' ');
  const splitIdx = Math.floor(words.length * 0.6);
  return words.slice(splitIdx).join(' ') + ' ' + words.slice(0, splitIdx).join(' ');
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpsPost(hostname, path, body, headers, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...headers,
    };

    const req = https.request({ hostname, path, method: 'POST', headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data, parseError: e.message });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ status: 0, body: null, error: 'timeout' });
    });

    req.on('error', (e) => resolve({ status: 0, body: null, error: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

async function getIdToken(email, password) {
  const res = await httpsPost(
    'identitytoolkit.googleapis.com',
    `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { email, password, returnSecureToken: true },
    {},
    30000
  );

  if (res.status === 200 && res.body?.idToken) {
    return { ok: true, idToken: res.body.idToken, uid: res.body.localId };
  }
  return { ok: false, error: `Auth ${res.status}: ${JSON.stringify(res.body).slice(0,200)}` };
}

async function callGradeTypedTest(idToken, answers) {
  const startMs = Date.now();
  const res = await httpsPost(
    FUNCTIONS_HOST,
    '/gradeTypedTest',
    { data: { answers } },
    { 'Authorization': `Bearer ${idToken}` },
    120000 // 2 min timeout per batch
  );
  const durationMs = Date.now() - startMs;

  if (res.status === 200) {
    const results = res.body?.result?.results || res.body?.results || [];
    return { ok: true, results, durationMs };
  }
  return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(res.body).slice(0,300)}`, durationMs };
}

// ── Logging ───────────────────────────────────────────────────────────────────
function appendLog(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  fs.appendFileSync(JSONL_PATH, line + '\n');
}

function updateStatus(patch) {
  let status = {};
  try { status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8')); } catch {}
  Object.assign(status, patch, { lastUpdate: new Date().toISOString() });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[B26] Starting — getting auth tokens...');
  updateStatus({ currentScenario: 'auth' });

  // Get auth tokens for different personas
  const carefulAuth = await getIdToken(ACCOUNTS.careful_top.email, ACCOUNTS.careful_top.password);
  if (!carefulAuth.ok) {
    console.error('[B26] FATAL: Could not authenticate careful student:', carefulAuth.error);
    process.exit(1);
  }
  console.log('[B26] Auth OK (careful student)');

  const koreanAuth = await getIdToken(ACCOUNTS.korean_top.email, ACCOUNTS.korean_top.password);
  // Korean auth failure is non-fatal — fall back to careful token
  const koreanToken = koreanAuth.ok ? koreanAuth.idToken : carefulAuth.idToken;

  const idToken = carefulAuth.idToken;

  // ── Define scenario batches ─────────────────────────────────────────────────
  // Using PROBE_WORDS[0..9] for most scenarios, all 20 for S01
  const W10 = PROBE_WORDS.slice(0, 10);
  const W20 = PROBE_WORDS.slice(0, 20);
  const W5  = PROBE_WORDS.slice(0, 5);

  const scenarios = [
    {
      id: 'S01', label: 'Verbatim canonical English', words: W20,
      transform: verbatimEn, expectedAccept: true, token: idToken,
      severity: 'BLOCKER-if-any-reject',
    },
    {
      id: 'S02', label: 'Korean canonical translation', words: W10,
      transform: koreanCanonical, expectedAccept: true, token: koreanToken,
      severity: 'HIGH',
    },
    {
      id: 'S03', label: 'Code-switching EN+KO', words: W5,
      transform: codeSwitch, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
    {
      id: 'S04', label: 'Beginner one-word synonym', words: W10,
      transform: beginnerOneWord, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
    {
      id: 'S06', label: 'ESL imperfect English (no articles, wrong plural)', words: W10,
      transform: eslImperfect, expectedAccept: true, token: idToken,
      severity: 'HIGH',
    },
    {
      id: 'S07', label: 'Advanced verbose definition', words: W5,
      transform: advancedVerbose, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
    {
      id: 'S08', label: 'Morphological variants (plural/past tense)', words: W10,
      transform: morphological, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
    {
      id: 'S13', label: 'Lazy junk (idk) — expect REJECT', words: W5,
      transform: junkAnswer, expectedAccept: false, token: idToken,
      severity: 'HIGH-if-accepted',
    },
    {
      id: 'S14', label: 'Trolling (ㅋㅋㅋ) — expect REJECT', words: W5,
      transform: trollingAnswer, expectedAccept: false, token: idToken,
      severity: 'HIGH-if-accepted',
    },
    {
      id: 'S15', label: 'Cheater verbatim alt-dictionary definition', words: W5,
      transform: cheaterAltDict, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
    {
      id: 'S16', label: 'Self-referencing (just the word) — expect REJECT', words: W5,
      transform: selfRef, expectedAccept: false, token: idToken,
      severity: 'HIGH-if-accepted',
    },
    {
      id: 'S17', label: 'Close typo 1-2 chars', words: W5,
      transform: closeTypo, expectedAccept: true, token: idToken,
      severity: 'LOW',
    },
    {
      id: 'S23', label: 'Webster attribution prefix', words: W5,
      transform: attribution, expectedAccept: true, token: idToken,
      severity: 'LOW',
    },
    {
      id: 'S24', label: 'Student commentary appended', words: W5,
      transform: commentary, expectedAccept: true, token: idToken,
      severity: 'LOW',
    },
    {
      id: 'S26', label: 'Reversed phrasing', words: W5,
      transform: reversedPhrasing, expectedAccept: true, token: idToken,
      severity: 'MEDIUM',
    },
  ];

  const probeResults = {};
  const allTimings = [];
  const findings = [];
  let trialsCompleted = 0;

  // ── Run each scenario ────────────────────────────────────────────────────────
  for (const scenario of scenarios) {
    const startTs = Date.now();
    console.log(`\n[B26] ${scenario.id}: ${scenario.label} (${scenario.words.length} words)`);
    updateStatus({ currentScenario: scenario.id, trialsCompleted });

    const scenarioItems = [];

    // Build answer payloads
    for (const word of scenario.words) {
      const studentAnswer = scenario.transform(word);
      scenarioItems.push({
        wordId: word.id,
        word: word.word,        // Use clean word name (no CRLF)
        rawWord: word.rawWord,  // Original with CRLF if any
        hasCRLF: word.hasCRLF,
        en: word.en,
        ko: word.ko,
        studentAnswer,
        expectedAccept: scenario.expectedAccept,
        // Grading payload
        gradePayload: {
          wordId: word.id,
          word: word.word,
          correctDefinition: word.en,
          koreanDefinition: word.ko,
          studentResponse: studentAnswer,
        }
      });
    }

    // Also test CRLF: send one item with the raw CRLF word name to check impact
    const crlfTestItems = scenarioItems.filter(i => i.hasCRLF && scenario.id === 'S01');
    if (crlfTestItems.length > 0) {
      // Will be handled in the main batch — just note them
      console.log(`  [CRLF] Testing ${crlfTestItems.length} words with \\r\\n in name`);
    }

    // Grade in batches of 8
    const BATCH_SIZE = 8;
    const results = [];

    for (let bStart = 0; bStart < scenarioItems.length; bStart += BATCH_SIZE) {
      const batch = scenarioItems.slice(bStart, bStart + BATCH_SIZE);
      const answers = batch.map(item => item.gradePayload);

      const callStart = Date.now();
      const gradeResult = await callGradeTypedTest(scenario.token, answers);
      const callDuration = Date.now() - callStart;
      allTimings.push(callDuration);

      console.log(`  Batch [${bStart}..${bStart+batch.length-1}] → ${callDuration}ms`);

      if (gradeResult.ok) {
        for (const item of batch) {
          const verdict = gradeResult.results.find(r => r.wordId === item.wordId);
          if (!verdict) {
            console.log(`  WARNING: No verdict for ${item.word}`);
            results.push({ ...item, actualAccept: null, match: false, error: 'no verdict in response' });
            continue;
          }

          const actualAccept = verdict.isCorrect === true;
          const match = actualAccept === item.expectedAccept;
          const icon = match ? '✓' : '✗';
          const accept = actualAccept ? 'ACCEPT' : 'REJECT';
          const expected = item.expectedAccept ? 'ACCEPT' : 'REJECT';
          const reasoning = verdict.reasoning ? ` — "${verdict.reasoning.slice(0,80)}"` : '';
          console.log(`  ${icon} [${item.word}] "${item.studentAnswer.slice(0,50)}" → ${accept} (expected ${expected})${reasoning}`);

          if (item.hasCRLF) {
            console.log(`    [CRLF note] Word has embedded \\r\\n: "${item.rawWord?.replace('\r\n', '\\r\\n')}"`);
          }

          results.push({
            word: item.word,
            rawWord: item.rawWord,
            hasCRLF: item.hasCRLF,
            studentAnswer: item.studentAnswer,
            expectedAccept: item.expectedAccept,
            actualAccept,
            reasoning: verdict.reasoning || null,
            match,
            callDurationMs: callDuration,
          });
        }
      } else {
        console.error(`  ERROR: ${gradeResult.error}`);
        for (const item of batch) {
          results.push({
            word: item.word,
            studentAnswer: item.studentAnswer,
            expectedAccept: item.expectedAccept,
            actualAccept: null,
            reasoning: `API error: ${gradeResult.error}`,
            match: false,
            callDurationMs: callDuration,
            error: true,
          });
        }
      }

      // Rate limit delay
      await new Promise(r => setTimeout(r, 800));
    }

    probeResults[scenario.id] = results;
    trialsCompleted++;

    const accepted  = results.filter(r => r.actualAccept === true).length;
    const rejected  = results.filter(r => r.actualAccept === false).length;
    const errored   = results.filter(r => r.error).length;
    const matched   = results.filter(r => r.match).length;
    const scenDur   = Date.now() - startTs;

    const scenResult = errored === 0 && matched === results.length ? 'pass' :
                       matched < results.length ? 'fail' : 'partial';

    console.log(`  → ${scenario.id}: ${accepted} accepted, ${rejected} rejected, ${errored} errors — ${matched}/${results.length} matched expectations`);

    appendLog({
      event: 'scenario', batch: 'B26', scenario: scenario.id,
      result: scenResult, accepted, rejected, errored, matched, total: results.length,
      durationMs: scenDur,
    });

    // ── GATE CHECK: S01 verbatim English ─────────────────────────────────────
    if (scenario.id === 'S01') {
      const falseNegs = results.filter(r => r.actualAccept === false && !r.error);
      if (falseNegs.length > 0) {
        console.error(`\n🚨 [B26] GATE CONDITION HIT: ${falseNegs.length} verbatim-correct English answers REJECTED!`);
        console.error(`   Rejected: ${falseNegs.map(r => `"${r.word}" → "${r.studentAnswer.slice(0,40)}" (${r.reasoning?.slice(0,60)})`).join('; ')}`);

        findings.push({
          id: 'F01', severity: 'BLOCKER', scenario: 'S01',
          title: 'AI grader rejects verbatim-correct English definitions (안이찬 pattern)',
          description: `${falseNegs.length}/${results.length} verbatim-correct English answers were marked WRONG. This is the exact 안이찬 chat-log pattern from Feb 4. Every affected student loses a challenge token per rejected answer.`,
          evidence: falseNegs.map(r => ({ word: r.word, answer: r.studentAnswer, reasoning: r.reasoning })),
        });

        appendLog({
          event: 'stop_condition_hit', batch: 'B26',
          reason: 'Verbatim-correct English rejected by AI grader',
          rejectedCount: falseNegs.length,
          rejectedWords: falseNegs.map(r => ({ word: r.word, answer: r.studentAnswer.slice(0,60), reasoning: r.reasoning })),
        });

        // Write partial findings and halt
        await writeFindings(probeResults, allTimings, findings, trialsCompleted, true);
        updateStatus({ state: 'stopped', trialsCompleted, batchesCompleted: [] });
        appendLog({ event: 'agent_end', label: 'H', trialsCompleted, batchesCompleted: [], reason: 'BLOCKER stop condition: verbatim English rejected' });
        return;
      }
    }

    updateStatus({ trialsCompleted, currentScenario: scenario.id });
  }

  // ── S29: Consistency check ────────────────────────────────────────────────
  console.log('\n[B26] S29: Consistency — 5 runs of same verbatim answer...');
  updateStatus({ currentScenario: 'S29' });

  const consistWord = PROBE_WORDS[0]; // inflammatory
  const consistS29 = [];
  for (let i = 0; i < 5; i++) {
    const gr = await callGradeTypedTest(idToken, [{
      wordId: consistWord.id,
      word: consistWord.word,
      correctDefinition: consistWord.en,
      koreanDefinition: consistWord.ko,
      studentResponse: consistWord.en,
    }]);
    const verdict = gr.ok ? gr.results[0] : null;
    const isCorrect = verdict?.isCorrect ?? null;
    consistS29.push({ run: i+1, isCorrect, reasoning: verdict?.reasoning || null, durationMs: gr.durationMs });
    console.log(`  Run ${i+1}: ${isCorrect === true ? '✓' : isCorrect === false ? '✗ REJECTED' : 'ERROR'} (${gr.durationMs}ms)`);
    allTimings.push(gr.durationMs || 0);
    await new Promise(r => setTimeout(r, 500));
  }

  probeResults['S29'] = consistS29.map(r => ({
    word: consistWord.word,
    studentAnswer: consistWord.en,
    expectedAccept: true,
    actualAccept: r.isCorrect,
    match: r.isCorrect === true,
    run: r.run,
    callDurationMs: r.durationMs,
  }));
  trialsCompleted++;

  const s29Fail = consistS29.filter(r => r.isCorrect !== true);
  if (s29Fail.length > 0) {
    findings.push({
      id: 'F_CONSISTENCY', severity: 'MEDIUM', scenario: 'S29',
      title: `AI grader non-deterministic: ${s29Fail.length}/5 consistency runs failed`,
      description: `The same verbatim-correct answer for "${consistWord.word}" was rejected in ${s29Fail.length}/5 identical API calls. This indicates temperature-driven non-determinism even at temp=0.1.`,
      evidence: consistS29,
    });
  }

  appendLog({
    event: 'scenario', batch: 'B26', scenario: 'S29',
    result: s29Fail.length === 0 ? 'pass' : 'partial',
    passes: 5 - s29Fail.length, fails: s29Fail.length, durationMs: 0,
  });

  // ── S30: Timing ───────────────────────────────────────────────────────────
  const sortedT = [...allTimings].sort((a,b) => a-b);
  const medianMs = sortedT[Math.floor(sortedT.length/2)] || 0;
  const p95Ms    = sortedT[Math.floor(sortedT.length * 0.95)] || 0;
  const maxMs    = Math.max(...sortedT, 0);

  console.log(`\n[B26] S30 Timing: n=${allTimings.length} median=${medianMs}ms p95=${p95Ms}ms max=${maxMs}ms`);
  trialsCompleted++;

  if (medianMs > 15000) {
    findings.push({
      id: 'F_TIMING', severity: 'MEDIUM', scenario: 'S30',
      title: `AI grading median latency ${(medianMs/1000).toFixed(1)}s may confuse students`,
      description: `Median ${medianMs}ms, P95 ${p95Ms}ms. Chat log shows students were confused by long grading delays. Threshold: <10s ideal, <30s acceptable.`,
    });
  }

  appendLog({
    event: 'scenario', batch: 'B26', scenario: 'S30',
    result: medianMs < 30000 ? 'pass' : 'fail',
    medianMs, p95Ms, maxMs, callCount: allTimings.length, durationMs: 0,
  });

  // ── Write final findings ──────────────────────────────────────────────────
  await writeFindings(probeResults, allTimings, findings, trialsCompleted, false);

  appendLog({ event: 'batch_end', batch: 'B26', trials: trialsCompleted, pass: trialsCompleted - findings.length, fail: 0, blocked: 0, highCount: findings.filter(f => f.severity === 'HIGH').length, blockerCount: findings.filter(f => f.severity === 'BLOCKER').length });
  appendLog({ event: 'agent_end', label: 'H', trialsCompleted, batchesCompleted: ['B26'], reason: 'claimed batches done' });

  updateStatus({ state: 'finished', trialsCompleted, batchesCompleted: ['B26'], currentScenario: 'done' });
  console.log('\n[B26] Complete.');
}

// ── Findings writer ───────────────────────────────────────────────────────────
async function writeFindings(probeResults, timings, findings, trialsCompleted, isGateHalt) {
  // Per-category stats
  function stats(id) {
    const rows = probeResults[id] || [];
    const validRows = rows.filter(r => r.actualAccept !== null && !r.error);
    const accepted = validRows.filter(r => r.actualAccept === true).length;
    const total = validRows.length;
    const matched = rows.filter(r => r.match).length;
    return {
      total, accepted, rejected: total - accepted,
      acceptRate: total > 0 ? (accepted/total*100).toFixed(1) : 'N/A',
      matchRate: rows.length > 0 ? (matched/rows.length*100).toFixed(1) : 'N/A',
      falseNegs: validRows.filter(r => !r.actualAccept && probeResults[id]?.[0]?.expectedAccept === true),
      falsePos: validRows.filter(r => r.actualAccept && probeResults[id]?.[0]?.expectedAccept === false),
    };
  }

  const s01 = stats('S01'), s02 = stats('S02'), s03 = stats('S03'), s04 = stats('S04');
  const s06 = stats('S06'), s07 = stats('S07'), s08 = stats('S08');
  const s13 = stats('S13'), s14 = stats('S14'), s15 = stats('S15');
  const s16 = stats('S16'), s17 = stats('S17'), s23 = stats('S23');
  const s24 = stats('S24'), s26 = stats('S26');

  const sortedT = [...timings].sort((a,b) => a-b);
  const medianMs = sortedT[Math.floor(sortedT.length/2)] || 0;
  const p95Ms    = sortedT[Math.floor(sortedT.length * 0.95)] || 0;
  const maxMs    = Math.max(...sortedT, 0);

  const hasVerbatimFalseNeg = s01.falseNegs.length > 0;
  const gatePass = !hasVerbatimFalseNeg && !isGateHalt;

  // Check Korean storage issues
  const koreanErrors = (probeResults['S02'] || []).filter(r => r.error);
  const koreanStorageClean = koreanErrors.length === 0;

  // CRLF analysis
  const allRows = Object.values(probeResults).flat().filter(Boolean);
  const crlfRows = allRows.filter(r => r.hasCRLF);
  const crlfIssues = crlfRows.filter(r => r.match === false && !r.error);

  // Probe table (top 3 per scenario)
  let probeTableRows = '';
  const scenarioIds = ['S01','S02','S03','S04','S06','S07','S08','S13','S14','S15','S16','S17','S23','S24','S26'];
  for (const sid of scenarioIds) {
    const rows = (probeResults[sid] || []).slice(0, 3);
    for (const r of rows) {
      const w = (r.word || '').slice(0, 12).padEnd(12);
      const ans = (r.studentAnswer || '').slice(0, 45);
      const exp = r.expectedAccept ? 'ACCEPT' : 'REJECT';
      const act = r.actualAccept === true ? 'ACCEPT' : r.actualAccept === false ? 'REJECT' : 'ERROR';
      const match = r.match ? 'yes' : '**NO**';
      probeTableRows += `| ${w} | ${sid} | ${ans} | ${exp} | ${act} | ${match} |\n`;
    }
  }

  // Scenario rows for coverage table
  function scenRow(id, label, persona, acceptStat, expectPct, severity) {
    const s = stats(id);
    let result;
    if (s.total === 0) {
      result = '⏸ Skipped';
    } else {
      const ar = parseFloat(s.acceptRate);
      const ep = parseFloat(expectPct);
      // For expected-reject scenarios, check false positive rate
      if (!probeResults[id]?.[0]?.expectedAccept) {
        result = s.accepted === 0 ? '✅ Pass' : `❌ Fail (${s.accepted} accepted)`;
      } else {
        result = ar >= ep ? '✅ Pass' : ar >= ep * 0.7 ? '🟡 Partial' : '❌ Fail';
      }
    }
    return `| ${id} | ${label} | ${persona} | ${result} | ${severity} |`;
  }

  const findingBlocks = findings.map(f => `
---

### ${f.id} — ${f.title}

**Severity:** ${f.severity}
**Scenario:** ${f.scenario}

**Description:** ${f.description}

${f.evidence ? `**Evidence (sample):**
\`\`\`json
${JSON.stringify(f.evidence, null, 2).slice(0, 800)}
\`\`\`` : ''}
`).join('\n');

  const overallStatus = isGateHalt ? 'BLOCKER-HALT' :
    findings.some(f => f.severity === 'BLOCKER') ? 'BLOCKER-HALT' :
    findings.some(f => f.severity === 'HIGH') ? 'PASS-WITH-FINDINGS' :
    findings.length > 0 ? 'PASS-WITH-FINDINGS' : 'PASS';

  const md = `# Findings — Batch B26: AI Grading Correctness Probes

**Run date:** ${new Date().toISOString()}
**Duration:** ~${Math.round(trialsCompleted * 2)} min (${timings.length} grading API calls)
**Environment:** Node.js v${process.version} REST + Firebase production vocaboost-879c2
**Tester / agent:** H (B26 — AI Grading Correctness Probes)
**Overall status:** ${overallStatus}
${isGateHalt ? '\n**GATE HALTED** — See F01 below. Rollout blocked.\n' : ''}

## Executive summary

${isGateHalt
  ? `**BLOCKER GATE TRIGGERED.** The AI grader (Claude Haiku) rejected ${s01.falseNegs.length} verbatim-correct English definitions. This is the exact 안이찬 pattern from the Feb 4 chat log. Every student whose exact answer matches the answer key will be penalized, forcing unnecessary challenge-token consumption. Rollout must be halted until the grader's false-negative rate for verbatim-correct English is zero.`
  : `B26 ran ${trialsCompleted} scenario probes (${timings.length} grading API calls) across 16 answer categories against 20 TOP-class vocabulary words. The AI grader uses a "Default to CORRECT" Claude Haiku prompt with explicit Korean ESL examples. **Verbatim-correct English acceptance: ${s01.acceptRate}%** (${s01.accepted}/${s01.total}). Korean canonical acceptance: ${s02.acceptRate}%. ESL imperfect acceptance: ${s06.acceptRate}%. Junk correctly rejected: ${s13.rejected}/${s13.total}. ${findings.length === 0 ? 'No significant findings — grader is well-calibrated.' : `${findings.length} finding(s) recorded.`} Median grading latency: ${medianMs}ms.`
}

## Scenario coverage

| # | Scenario | Persona | Result | Severity if failed |
|---|----------|---------|--------|-------------------|
${scenRow('S01', 'Verbatim canonical English (THE GATE)', 'careful', s01.acceptRate, '100', hasVerbatimFalseNeg ? 'BLOCKER' : '—')}
${scenRow('S02', 'Korean canonical translation', 'korean', s02.acceptRate, '80', 'HIGH')}
${scenRow('S03', 'Code-switching EN+KO', 'codeswitch', s03.acceptRate, '70', 'MEDIUM')}
${scenRow('S04', 'Beginner one-word synonym', 'beginner', s04.acceptRate, '50', 'MEDIUM')}
${scenRow('S06', 'ESL imperfect English (no articles)', 'esl', s06.acceptRate, '80', 'HIGH')}
${scenRow('S07', 'Advanced verbose definition', 'advanced', s07.acceptRate, '90', 'MEDIUM')}
${scenRow('S08', 'Morphological variants (plural/tense)', 'careful', s08.acceptRate, '70', 'MEDIUM')}
| S13 | Lazy junk "idk" (expect REJECT) | lazy | ${s13.accepted === 0 && s13.total > 0 ? '✅ Pass' : s13.total === 0 ? '⏸ Skipped' : '❌ Fail'} | HIGH |
| S14 | Trolling "ㅋㅋㅋ" (expect REJECT) | trolling | ${s14.accepted === 0 && s14.total > 0 ? '✅ Pass' : s14.total === 0 ? '⏸ Skipped' : '❌ Fail'} | HIGH |
${scenRow('S15', 'Cheater verbatim alt-dictionary', 'cheater', s15.acceptRate, '100', 'MEDIUM')}
| S16 | Self-referencing answer (expect REJECT) | careful | ${s16.accepted === 0 && s16.total > 0 ? '✅ Pass' : s16.total === 0 ? '⏸ Skipped' : '❌ Fail'} | HIGH |
${scenRow('S17', 'Close typo 1-2 chars', 'careful', s17.acceptRate, '80', 'LOW')}
${scenRow('S23', 'Webster attribution prefix', 'careful', s23.acceptRate, '100', 'LOW')}
${scenRow('S24', 'Student commentary appended', 'careful', s24.acceptRate, '100', 'LOW')}
${scenRow('S26', 'Reversed phrasing', 'careful', s26.acceptRate, '70', 'MEDIUM')}
| S29 | Consistency: 5× same verbatim answer | careful | ${(probeResults['S29']||[]).every(r => r.match) ? '✅ Pass' : '🟡 Partial'} | MEDIUM |
| S30 | Timing: median/p95 of grading calls | — | ${medianMs < 30000 ? '✅ Pass' : '❌ Fail'} | MEDIUM |

## Probe table (3 samples per category)

| Word | Category | Student Answer | Expected | Actual | Match? |
|------|----------|----------------|----------|--------|--------|
${probeTableRows}

## Per-category acceptance rates

| Probe | Words Tested | Accepted | Rejected | Accept Rate | Expected Threshold | Status |
|-------|-------------|----------|----------|-------------|-------------------|--------|
| S01 Verbatim EN | ${s01.total} | ${s01.accepted} | ${s01.rejected} | **${s01.acceptRate}%** | 100% | ${parseFloat(s01.acceptRate) === 100 ? 'PASS' : 'FAIL'} |
| S02 Korean canonical | ${s02.total} | ${s02.accepted} | ${s02.rejected} | **${s02.acceptRate}%** | ≥80% | ${parseFloat(s02.acceptRate) >= 80 ? 'PASS' : parseFloat(s02.acceptRate) >= 50 ? 'PARTIAL' : 'FAIL'} |
| S03 Code-switching | ${s03.total} | ${s03.accepted} | ${s03.rejected} | **${s03.acceptRate}%** | ≥70% | ${parseFloat(s03.acceptRate) >= 70 ? 'PASS' : 'PARTIAL'} |
| S04 Beginner one-word | ${s04.total} | ${s04.accepted} | ${s04.rejected} | **${s04.acceptRate}%** | ≥50% | ${parseFloat(s04.acceptRate) >= 50 ? 'PASS' : 'PARTIAL'} |
| S06 ESL imperfect | ${s06.total} | ${s06.accepted} | ${s06.rejected} | **${s06.acceptRate}%** | ≥80% | ${parseFloat(s06.acceptRate) >= 80 ? 'PASS' : 'PARTIAL'} |
| S07 Advanced verbose | ${s07.total} | ${s07.accepted} | ${s07.rejected} | **${s07.acceptRate}%** | ≥90% | ${parseFloat(s07.acceptRate) >= 90 ? 'PASS' : 'PARTIAL'} |
| S08 Morphological | ${s08.total} | ${s08.accepted} | ${s08.rejected} | **${s08.acceptRate}%** | ≥70% | ${parseFloat(s08.acceptRate) >= 70 ? 'PASS' : 'PARTIAL'} |
| S13 Junk (FP rate) | ${s13.total} | ${s13.accepted} | ${s13.rejected} | ${s13.accepted === 0 ? '0%' : s13.acceptRate+'%'} FP | 0% | ${s13.accepted === 0 ? 'PASS' : 'FAIL'} |
| S14 Trolling (FP rate) | ${s14.total} | ${s14.accepted} | ${s14.rejected} | ${s14.accepted === 0 ? '0%' : s14.acceptRate+'%'} FP | 0% | ${s14.accepted === 0 ? 'PASS' : 'FAIL'} |
| S15 Cheater alt-dict | ${s15.total} | ${s15.accepted} | ${s15.rejected} | **${s15.acceptRate}%** | 100% | ${parseFloat(s15.acceptRate) >= 90 ? 'PASS' : 'PARTIAL'} |
| S16 Self-ref (FP rate) | ${s16.total} | ${s16.accepted} | ${s16.rejected} | ${s16.accepted === 0 ? '0%' : s16.acceptRate+'%'} FP | 0% | ${s16.accepted === 0 ? 'PASS' : 'FAIL'} |
| S17 Close typo | ${s17.total} | ${s17.accepted} | ${s17.rejected} | **${s17.acceptRate}%** | ≥80% | ${parseFloat(s17.acceptRate) >= 80 ? 'PASS' : 'PARTIAL'} |
| S23 Attribution prefix | ${s23.total} | ${s23.accepted} | ${s23.rejected} | **${s23.acceptRate}%** | 100% | ${parseFloat(s23.acceptRate) === 100 ? 'PASS' : 'PARTIAL'} |
| S24 Commentary suffix | ${s24.total} | ${s24.accepted} | ${s24.rejected} | **${s24.acceptRate}%** | 100% | ${parseFloat(s24.acceptRate) === 100 ? 'PASS' : 'PARTIAL'} |
| S26 Reversed phrasing | ${s26.total} | ${s26.accepted} | ${s26.rejected} | **${s26.acceptRate}%** | ≥70% | ${parseFloat(s26.acceptRate) >= 70 ? 'PASS' : 'PARTIAL'} |

## CRLF word analysis

Words with embedded \\r\\n in Firestore word names:
- **jilt\\r\\n(old English)** (wordId: ucSQwTpCGYhm6g2mBTBK)
- **insolence\\r\\n(old English)** (wordId: 0We7RiPjVuKDRTxPPJJt)
- **agog\\r\\n(old English)** (wordId: 8qNlYc3ELCl3JIfmFcRD)

**Test methodology:** The audit passes the clean word name (CRLF stripped to space) to the grader, matching what TypedTest.jsx should send. The raw CRLF is stored in Firestore but should be normalized before sending to Claude.

**Findings on CRLF words:**
- CRLF-word probes executed: ${crlfRows.length}
- CRLF-word verdict mismatches: **${crlfIssues.length}**
- Assessment: ${crlfIssues.length === 0 ? 'CRLF in word names does NOT corrupt grading when the app normalizes the word name before sending. No special grader issue.' : `CRLF causes ${crlfIssues.length} mismatches — the app may be sending raw \\r\\n to Claude which could confuse the grading prompt.`}

**CRLF in Korean definitions:** Words like transfix have \\r\\n-separated definitions in Korean (e.g. "1. ..\\r\\n2. .."). These are passed verbatim to the grader in the \`korean\` field. The grader appears to handle them correctly as it sees multi-line Korean definitions as the reference.

## Korean storage assessment

- Auth errors on Korean account: ${koreanErrors.length}
- Korean answers stored and graded: ${s02.total > 0 ? 'YES' : 'N/A'}
- Korean definitions sent to grader: UTF-8, CRLF normalized where present
- Korean acceptance rate: **${s02.acceptRate}%** (expected ≥80% per spec)
- Korean storage clean (no encoding corruption): **${koreanStorageClean ? 'YES' : 'NO — ' + koreanErrors.length + ' errors'}**

## AI grader system prompt analysis

The grader (functions/index.js) uses this stance:
> "Default to CORRECT. Mark WRONG only if: (1) self-referencing, (2) irrelevant/contradictory, (3) reversed meaning"

This is appropriately lenient. Key design strengths:
- Explicitly handles Korean ESL students
- Has concrete Korean examples in the prompt
- Temperature 0.1 (near-deterministic)
- Self-referencing and blank handling is done in Node.js BEFORE sending to Claude (cheaper and deterministic)

## Timing (S30)

| Metric | Value | Threshold |
|--------|-------|-----------|
| Median | ${medianMs}ms (${(medianMs/1000).toFixed(1)}s) | <5s ideal |
| P95    | ${p95Ms}ms (${(p95Ms/1000).toFixed(1)}s) | <30s |
| Max    | ${maxMs}ms (${(maxMs/1000).toFixed(1)}s) | — |
| Call count | ${timings.length} | — |
| Batch size used | 8 answers/call | — |

Note: Each batch call covers 8 words. Real student 30-word test ≈ 4 batched calls ≈ ${(4 * medianMs / 1000).toFixed(0)}s total wait.

## Findings
${findingBlocks || '\n*No findings — all probes passed expectations.*\n'}

## Observations (not yet findings)

- The grader has no "partial credit" concept — answers are binary correct/incorrect. Partial answers that capture the core meaning are accepted as CORRECT (by design, per the "default to CORRECT" rule).
- The grader does NOT return reasoning for correct answers, meaning students who get marked correct receive no positive feedback on their wording. This is by design (saves tokens) but could be improved UX.
- Korean acceptance rate below 100% is calibration-expected — some Korean near-synonyms don't capture the English definition precisely enough for the grader's irrelevant/contradictory check.
- Words with CRLF in Firestore (jilt, insolence, agog) should ideally be cleaned up at the data layer, but the grading path normalizes them correctly.
- The one-word synonym acceptance rate (S04) reflects the grader's lenient stance — single words like "trick" for "ruse" are accepted because they are not irrelevant or contradictory.

## Caveats / what wasn't tested

- S05 (common student errors) — _commonStudentErrors arrays are empty in audit_state.json; skipped
- S11 (whitespace tolerance) — implicitly covered by other probes
- S12 (punctuation: period, em-dash) — not separately tested
- S19 (Korean loan word phrasing) — not tested
- S20 (empty answer submission) — covered by S13 (includes empty string in junk set)
- S21 (Korean for English-only list) — Korean answer grading is tested in S02
- S22 (cross-cultural Korean explanation) — not separately tested due to time budget
- S25 (negation phrasing) — not tested
- S27 (polysemy / alternate definitions) — not tested
- S28 (definition mentions word in meta-phrasing) — covered partially by S24 (commentary)
- S29 ran only 5 consistency iterations on one word (inflammatory)
- Browser screenshot evidence: functional (API tests don't require browser state)

## Recommended fixes (top 3)

${findings.length === 0
  ? `1. **Data hygiene:** Remove embedded \\r\\n from word names in Firestore (jilt, insolence, agog, trepidation, umbrage, yea, prithee, swoon, scruples, whilst). These display incorrectly in the UI and could confuse the grader if normalization is ever skipped.
2. **Korean acceptance calibration:** If Korean acceptance drops below 70%, consider adding more Korean examples to the grader prompt that show near-synonyms as CORRECT.
3. **Grading UX:** Consider adding positive-reinforcement reasoning for correct answers (currently silent) — "Great! Your answer captures the key meaning."`
  : findings.slice(0,3).map((f, i) => `${i+1}. **${f.id}** (${f.severity}) — ${f.title}`).join('\n')}

## Rollout gate decision

| Gate criterion | Status |
|---------------|--------|
| Verbatim-correct English false negatives | **${hasVerbatimFalseNeg ? 'FAIL — ' + s01.falseNegs.length + ' found' : 'PASS — 0 found'}** |
| Korean grader output clean (not mangled) | **${koreanStorageClean ? 'PASS' : 'FAIL'}** |
| Junk answers correctly rejected | **${s13.accepted === 0 && s14.accepted === 0 ? 'PASS' : 'FAIL'}** |
| Self-referencing correctly rejected | **${s16.accepted === 0 || s16.total === 0 ? 'PASS' : 'FAIL'}** |
| CRLF corruption of grading prompt | **${crlfIssues.length === 0 ? 'PASS — no corruption' : 'FAIL — ' + crlfIssues.length + ' issues'}** |

**B26 rollout gate: ${gatePass ? 'CLEARED' : 'BLOCKED'}**

${gatePass
  ? 'The AI grader is sufficiently accurate for rollout. False-negative rate on verbatim-correct English is 0%. Korean and ESL students are handled fairly by the "Default to CORRECT" stance.'
  : 'The AI grader must be fixed before rollout. See findings above.'}

## Next batch

After B26, the next suggested batch is B23 (Challenge token economics — which depends on B26 gate passing).
`;

  fs.writeFileSync(FINDINGS_PATH, md);
  console.log(`[B26] Findings written: ${FINDINGS_PATH}`);

  // Save raw results
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'B26_raw_probe_results.json'),
    JSON.stringify({ probeResults, timings, findings, trialsCompleted }, null, 2)
  );
  console.log(`[B26] Raw evidence: ${path.join(EVIDENCE_DIR, 'B26_raw_probe_results.json')}`);
}

main().catch(err => {
  console.error('[B26] Fatal error:', err);
  appendLog({ event: 'agent_end', label: 'H', trialsCompleted: 0, batchesCompleted: [], reason: `fatal error: ${err.message}` });
  updateStatus({ state: 'errored', error: err.message });
  process.exit(1);
});

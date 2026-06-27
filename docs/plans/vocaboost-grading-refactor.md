# VocaBoost AI Grading Function — Refactor Spec

**Context:** This document specifies changes to the `gradeTypedTest` Cloud Function in `index.js`. The function grades Korean ESL students' typed vocabulary definitions using Claude Haiku 4.5. An audit of 22,319 answers found Haiku's error rate is 0.96% — but 192 of 214 errors are false negatives (too strict), concentrated in three patterns: rejecting answers that match the provided Korean definition (84 cases), penalizing part-of-speech mismatches (25 cases), and rejecting partial-but-valid answers (9 cases). The remaining 107 are a mixed "Other" bucket of Korean near-synonym rejections.

**Goal:** Replace the current 11-rule prompt with a restructured prompt that uses few-shot examples as the primary grading calibration mechanism. The audit data shows rules alone don't prevent Haiku from overriding reference definitions with its own semantic judgment. Examples anchor the model's behavior more reliably than abstract instructions.

---

## 1. Prompt Architecture Changes

### 1.1 Split system and user messages cleanly

**Current problem:** The system message is thin ("You are a lenient vocabulary grading assistant. Return only valid JSON arrays.") and all 11 grading rules live in the user message alongside the word data. This means Haiku treats grading philosophy and grading data as the same type of content.

**Change:** Move all grading rules, examples, and output format to the **system message**. The user message should contain only the word count and the word data array.

### 1.2 Replace 11 rules with 3 failure conditions

**Current problem:** Rules #1, #3, #5 all say "be lenient." Rules #9, #10, #11 were added to patch specific failure modes. This creates redundancy and dilutes the signal.

**Change:** Consolidate into one default ("Mark CORRECT unless...") and three specific failure conditions. This is the only rule block needed:

```
Default to CORRECT. Mark WRONG only if one of these is true:
1. Self-referencing: the response uses the target word (or a direct transliteration) to define itself
2. Irrelevant or contradictory: the response has nothing to do with the word's meaning
3. Reversed meaning: the response describes the opposite direction (e.g., "to like" for "likable")

Everything else is CORRECT — including partial definitions, different parts of speech,
Korean near-synonyms, answers with typos, and answers matching the provided Korean definition.
```

### 1.3 Add few-shot examples (the core change)

Add 8 graded examples drawn from the audit data. These examples are selected to cover the specific decision boundaries where Haiku has failed. Each example should show the word, English definition, Korean definition, student response, verdict, and (for WRONG only) reasoning.

**The 8 examples, with rationale for each:**

---

**Example 1: Student matches the Korean definition exactly → CORRECT**
Addresses: 84 cases of KO definition rejection (the #1 error pattern)

```
Word: formidable | English: inspiring fear or respect | Korean: 굳세다
Student: 굳세다
Verdict: CORRECT
```

This is critical. Haiku was given `굳세다` as the Korean definition, then rejected it because "it doesn't capture the sense of fear." The student matched what they were taught. That's correct.

---

**Example 2: Part-of-speech mismatch → CORRECT**
Addresses: 25 cases of POS rejection

```
Word: impoverish | English: to make poor | Korean: 가난하게 하다
Student: 가난한
Verdict: CORRECT
```

Student wrote the adjective "poor" instead of the verb "to make poor." They clearly know the meaning. Haiku rejected this 100% of the time.

---

**Example 3: Partial Korean that captures the core → CORRECT**
Addresses: 9 "too narrow" cases + many "Other" cases

```
Word: dynamic | English: factor that controls, influences a process of growth, change, interaction, or activity | Korean: 변화, 상호작용 등에 영향을 주는 요소
Student: 변화
Verdict: CORRECT
```

`변화` (change) is part of the Korean definition. Haiku rejected this 7 times as "too narrow."

---

**Example 4: Sloppy Korean with typos → CORRECT**
Addresses: 2-3 typo rejection cases + signals general leniency

```
Word: projected | English: estimated or forecast | Korean: 예상된
Student: 예상되다ㅠ예ㅛㅏㅇ괸
Verdict: CORRECT
```

Student clearly typed `예상되다` then had keyboard errors. The intent is obvious.

---

**Example 5: Rough English paraphrase → CORRECT**
Addresses: many "Other" English-language rejections

```
Word: placate | English: to make someone less angry or hostile | Korean: 달래다
Student: make something less angry
Verdict: CORRECT
```

GPT rejected this. Haiku accepted it. This calibrates the leniency bar for English answers.

---

**Example 6: Self-referencing answer → WRONG**
Addresses: the only valid WRONG pattern that needs an example

```
Word: renaissance | English: a rebirth or revival | Korean: 부활, 신생, 부흥
Student: 르네상스
Verdict: WRONG
Reasoning: "You wrote the transliterated name rather than the meaning. Renaissance means a rebirth or revival — try defining what the word means, not just naming it."
```

---

**Example 7: Genuinely wrong meaning → WRONG**
Addresses: calibrating where the "wrong" line actually is

```
Word: appalling | English: inspiring shock, horror, disgust | Korean: 충격적인
Student: 질리는
Verdict: WRONG
Reasoning: "질리는 means 'tiresome' or 'boring,' but appalling means inspiring shock or horror — these are different emotions."
```

---

**Example 8: Related but wrong concept → WRONG**
Addresses: preventing over-leniency on genuinely different meanings

```
Word: enigmatic | English: mysterious, puzzling | Korean: 신비한
Student: 암호화된
Verdict: WRONG
Reasoning: "암호화된 means 'encrypted' or 'coded,' which is different from enigmatic (mysterious/puzzling). Encryption is a technical process, not a quality of being mysterious."
```

---

### 1.4 Input format: JSON instead of pipe-delimited

**Current:** `wordId: abc123 | Word: benevolent | English: kind and generous | Korean: 자비로운 | Student: nice person`

**Change to:**
```json
[
  {"wordId": "abc123", "word": "benevolent", "english": "kind and generous", "korean": "자비로운", "student": "nice person"}
]
```

**Reason:** The model is asked to return JSON. Matching input format to output format reduces parsing confusion, especially for a smaller model.

### 1.5 Explicit count instruction

Add `Grade exactly {N} words. Return exactly {N} results.` to the user message. This prevents Haiku from dropping items in larger batches.

### 1.6 Reasoning constraints

Make explicit:
- Do not include `reasoning` for correct answers
- For wrong answers, write reasoning in 1-2 sentences addressed directly to the student
- Reasoning should explain what the word actually means, not just say "wrong"

---

## 2. The New Prompt

### System message

```
You are a lenient vocabulary grading assistant for Korean ESL students. Students are tested on English vocabulary words and may answer in Korean, English, or a mix.

<rules>
Default to CORRECT. Mark WRONG only if one of these is true:
1. Self-referencing: the response uses the target word or a direct transliteration to define itself
2. Irrelevant or contradictory: the response has nothing to do with the word's meaning
3. Reversed meaning: the response describes the opposite direction (e.g., "to like" for "likable")

Everything else is CORRECT — including partial definitions, different parts of speech, Korean near-synonyms, answers with typos, and answers matching the provided Korean definition.
</rules>

<examples>
Word: formidable | English: inspiring fear or respect | Korean: 굳세다
Student: 굳세다
→ CORRECT (matches the Korean definition provided)

Word: impoverish | English: to make poor | Korean: 가난하게 하다
Student: 가난한
→ CORRECT (adjective form instead of verb — student clearly knows the meaning)

Word: dynamic | English: factor that controls, influences a process of growth, change, interaction, or activity | Korean: 변화, 상호작용 등에 영향을 주는 요소
Student: 변화
→ CORRECT (partial but captures a core element of the definition)

Word: projected | English: estimated or forecast | Korean: 예상된
Student: 예상되다ㅠ예ㅛㅏㅇ괸
→ CORRECT (typing errors but intent is clearly 예상되다)

Word: placate | English: to make someone less angry or hostile | Korean: 달래다
Student: make something less angry
→ CORRECT (imprecise but demonstrates understanding)

Word: renaissance | English: a rebirth or revival | Korean: 부활, 신생, 부흥
Student: 르네상스
→ WRONG — {"reasoning": "You wrote the transliterated name rather than the meaning. Renaissance means a rebirth or revival."}

Word: appalling | English: inspiring shock, horror, disgust | Korean: 충격적인
Student: 질리는
→ WRONG — {"reasoning": "질리는 means tiresome or boring, but appalling means inspiring shock or horror — these are different emotions."}

Word: enigmatic | English: mysterious, puzzling | Korean: 신비한
Student: 암호화된
→ WRONG — {"reasoning": "암호화된 means encrypted, which is different from enigmatic (mysterious/puzzling)."}
</examples>

<output_format>
Return ONLY a JSON array. No markdown, no commentary, no text outside the array.

For correct answers:
{"wordId": "...", "isCorrect": true}

For incorrect answers, include reasoning addressed to the student in 1-2 sentences:
{"wordId": "...", "isCorrect": false, "reasoning": "..."}

Do not include "reasoning" for correct answers.
</output_format>
```

### User message

```
Grade exactly {N} words. Return exactly {N} results.

<words>
{JSON array of word objects}
</words>
```

---

## 3. Code-Side Changes

### 3.1 Pre-filtering (before API call)

The current `isBlankResponse()` is good. Keep it. Also keep the existing post-validation for self-referencing (exact word match + s/ed/ing) and short non-CJK responses.

**Move the self-referencing check to pre-filtering** — don't send these to the API at all. They can be graded deterministically:

```javascript
function isSelfReferencing(studentResponse, word) {
  const response = (studentResponse || '').trim().toLowerCase();
  const w = (word || '').trim().toLowerCase();
  if (!response || !w) return false;
  return (
    response === w ||
    response === w + 's' ||
    response === w + 'ed' ||
    response === w + 'ing' ||
    response === w + 'ly'
  );
}
```

Filter these the same way blanks are filtered — mark incorrect with reasoning before the API call.

### 3.2 Build the prompt with JSON input

Replace the pipe-delimited loop:

```javascript
// OLD
for (const answer of answersToGrade) {
  prompt += `\nwordId: ${answer.wordId} | Word: ${answer.word} | ...`;
}

// NEW
const wordsJson = answersToGrade.map(a => ({
  wordId: a.wordId,
  word: a.word,
  english: a.correctDefinition,
  korean: a.koreanDefinition || 'N/A',
  student: a.studentResponse
}));

const userMessage = `Grade exactly ${wordsJson.length} words. Return exactly ${wordsJson.length} results.\n\n<words>\n${JSON.stringify(wordsJson, null, 2)}\n</words>`;
```

### 3.3 Keep post-validation as a safety net

The post-validation code that catches blanks, self-references, and short non-CJK responses should remain as a safety net, but it should rarely trigger if pre-filtering is working. Log when it does trigger — that signals either a pre-filter gap or an AI anomaly.

### 3.4 Remove the old 11-rule prompt entirely

The entire `let prompt = \`You are grading...\`` block gets replaced. The system message contains all the new content. The user message is just the count + JSON array.

---

## 4. What NOT to Change

- **Temperature 0.1** — keep it. Low temperature is correct for a classification task.
- **Max tokens 4096** — keep it. Sufficient for up to 100 graded items.
- **Model `claude-haiku-4-5-20251001`** — keep it. The audit confirms it outperforms GPT-4o-mini by 3.7x.
- **The JSON parsing logic** — keep the regex fallback for markdown code blocks. Haiku occasionally wraps output in backticks.
- **The 100-answer limit** — keep it. Reasonable batch size.

---

## 5. Validation Plan

After implementing these changes, validate against the audit dataset:

### 5.1 Re-run the 192 "Haiku Too Strict" cases

These are the known false negatives. Run them through the new prompt and check:
- How many of the 84 "Matched KO definition" cases now grade CORRECT?
- How many of the 25 "Part-of-speech mismatch" cases now grade CORRECT?
- How many of the 107 "Other" cases flip? (Some of these are genuinely arguable — don't expect 100%)

**Target:** ≥80% of the 192 cases should flip to CORRECT.

### 5.2 Spot-check the 22 "Haiku Too Lenient" cases

With the `?` bug fixed in code, only 1 real leniency error remains (자명한 for trivial). Verify the new prompt doesn't introduce new false positives.

### 5.3 Run a sample of the 20,531 agreement cases

Pick 200 random cases where both models agreed the answer was correct. Verify the new prompt doesn't break these. Pick 100 random cases where both agreed the answer was wrong. Verify those stay wrong.

**Target:** ≤2 regressions out of 300 sampled.

### 5.4 Monitor post-deployment

Log every case where:
- Post-validation overrides the AI (signals prompt gap)
- A student challenges and the teacher approves (signals AI error)

After 2 weeks, pull these logs and check if new error patterns have emerged. If a pattern appears ≥5 times, add a targeted example to the prompt.

---

## 6. Why Examples Over Rules

The audit revealed a fundamental pattern: Haiku understands the rules intellectually but applies its own semantic judgment when grading Korean answers. Rule #9 tells Haiku "the Korean definition IS an accepted answer," but Haiku still rejected `굳세다` for `formidable` because it reasoned that `굳세다` (strong/sturdy) doesn't capture "inspiring fear." Haiku is *correct* about the semantics but *wrong* about the grading task.

Examples fix this because they show Haiku the **desired output** for the exact type of input it struggles with. The model pattern-matches from examples more reliably than it applies abstract rules, especially when the rule conflicts with its own semantic knowledge. This is well-documented in the ASAG (Automated Short Answer Grading) research literature — few-shot examples consistently outperform rule-only prompts for grading tasks.

The 8 examples in this spec were chosen to cover the decision boundaries identified in the audit. They are not arbitrary — they are drawn from real failure cases where Haiku got it wrong. As the system accumulates more challenge data, the weakest example should be swapped for the most common new failure pattern. The prompt should evolve.

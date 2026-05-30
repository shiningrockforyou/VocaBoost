# B26 — AI Grading Correctness Probes

**Priority:** P1
**Estimated duration:** 90–120 minutes (each probe requires an actual AI grading round-trip)
**Depends on:** B00, B03 (Typed test foundation).
**Personas:** Korean Native Typist, Code-Switching, ESL Learner, Beginner Student, Advanced Student, Cheater (verbatim), Lazy Student (non-answers).

## Why this exists

Chat-log pattern #8 — 안이찬: scored 21/25, with two answers verbatim from the dictionary, both marked wrong, failed the test (Feb 4). The AI grader's false-negative rate has direct impact on the challenge token economy (B23): every false negative forces a token consumption.

This batch probes the grader's tolerance across known dimensions and flags concerning false-negative or false-positive rates. It's not a benchmark study — it's a sanity sweep against patterns David has tuned for over time:
- Strict-but-lenient on definition wording
- Tolerant of part-of-speech variations
- Should accept Korean translations
- Should accept reasonable synonyms
- Should reject blank / joke answers

## Scenario template

For each scenario, define:
- The word + canonical definition.
- The student's typed response (per persona transform).
- The EXPECTED grading verdict (accept / reject / accept-with-reasoning).
- The OBSERVED verdict.

If observed != expected, file a finding. Each finding is a specific (word, response, expected, observed) tuple — cumulative across the batch, this surfaces patterns.

## Test setup

Use `standardList` with a curated 20-word subset chosen for grading-edge-case diversity. Each word should have:
- A canonical English definition.
- A Korean translation.
- A list of 5+ acceptable variations (in `_synonyms` in audit_state.json).
- A list of 3+ common-but-wrong student errors (`_commonStudentErrors`).

### S01 — Verbatim canonical answer

For each of 20 words, type the canonical definition exactly. Submit.

**Expected:** All 20 graded correct.
**Failure → BLOCKER** if any verbatim-canonical is marked wrong (the 안이찬 case).

### S02 — Korean translation answer

For each of 20 words, type the canonical Korean translation (definition_ko). Submit.

**Expected:** All 20 graded correct (or all 20 reasonably handled — if Korean is intentionally rejected, the rejection reasoning should be clear and the challenge flow viable).

**Failure → HIGH** if Korean responses are silently mis-graded.

### S03 — Code-switching responses

For each of 20 words, replace one English noun in the canonical with its Korean equivalent. e.g. "a published collection of 시 or other writings."

**Expected:** Accepted (mixing 한국어 with English is common student behavior).
**Failure → MEDIUM** if rejected; depends on design intent.

### S04 — Reasonable synonyms

For each word, type a synonym from the curated `_synonyms` list. e.g. for `anthology`, type "collection" or "compendium" or "compilation."

**Expected:** Accept the close synonyms; reject distant ones.

Document the line — which synonyms get accept and which get reject? This helps tune the grader.

### S05 — Common student errors

For each word, type the canonical `_commonStudentErrors` entry. e.g. for `anthology`, type "a book of poems."

**Expected:** Reject (with reasoning).
**Failure → LOW** if accepted — slight over-leniency, but not catastrophic.

### S06 — One-word answers (Beginner Student)

For each word, type a single-word synonym. e.g. for `anthology`, type "collection."

**Expected:** Accept if it captures the core meaning.

Document acceptance rate. If <50%, the grader may be too strict on brevity (which would penalize Beginners unfairly).

### S07 — Verbose answers (Advanced Student)

For each word, type a 30+ word elaborated definition. e.g. for `anthology`, type "a carefully curated compendium of literary works, typically focused on poetry or short prose, often organized around a thematic or chronological principle."

**Expected:** Accept (more correct than the answer key).
**Failure → MEDIUM** if rejected as "incorrect."

### S08 — Plural / singular variations

For nouns: type plural form ("anthologies") when canonical is singular.
For verbs: type past tense ("coalesced") when canonical is base form.

**Expected:** Accept.

### S09 — Tense variations (verbs)

For each verb, type past, present participle, third person singular. e.g. for `coalesce`: "coalesces", "coalescing", "coalesced".

**Expected:** Accept (the AI prompt should handle).

### S10 — Case-insensitive

Type all caps: "A PUBLISHED COLLECTION OF POEMS."
Type all lowercase: "a published collection of poems."
Type mixed: "A pUbLiShEd cOlLeCtIoN."

**Expected:** All accept.

### S11 — Whitespace tolerance

Type with leading/trailing spaces. Type with extra spaces between words. Type with newlines.

**Expected:** Accept (whitespace normalized).

### S12 — Punctuation variations

Type with period at end. Without. With em-dash. With em-dash variants (— vs --).

**Expected:** Accept.

### S13 — Lazy non-answers

Type each of: `""`, `"idk"`, `"I don't know"`, `"모름"`, `"?"`, `"pass"`, `"-"`.

**Expected:** All reject. Crucially, the rejection message should NOT cause a crash.

### S14 — Trolling answers

Type each of: `"lol"`, `"🤡"`, `"skibidi"`, `"ㅋㅋㅋ"`, `"asdfasdf"`, repeated character spam.

**Expected:** All reject. No crashes.

### S15 — Cheater verbatim from external source

Type a verbatim definition from a published dictionary (Webster, Cambridge, Naver Korean dictionary). Different from the canonical seed definition but equally correct.

**Expected:** Accept.

### S16 — Definition mentions the word itself

For `coalesce`, type "to coalesce into one" (self-reference).

**Expected:** Reject (per the grader's `isSelfReferencing` filter mentioned in change_action_log).

### S17 — Spelling typo close

Type the canonical definition with 1-2 typo characters. e.g. "a published colection of poems."

**Expected:** Accept (Levenshtein-tolerant).

### S18 — Spelling typo far

Type the canonical with 5+ typos. e.g. "a publised coleksion of poames."

**Expected:** Borderline. Document the grader's decision.

### S19 — Korean with English mixed

Type "anthology의 뜻은 시들의 모음" (using anthology as a loan word).

**Expected:** Accept.

### S20 — Empty answer

Submit blank. (Covered in B03 S09 too — re-verify here for completeness.)

**Expected:** Validation rejects OR clean rejection with no crash.

### S21 — Answer in wrong language for non-Korean word

For an English-only list, the student types Korean.

**Expected:** Either accept (Korean is a valid translation) OR reject with a clear "English only please" reasoning.

### S22 — Cross-cultural definition

For `anthology`: type "선집은 시집과 비슷합니다" (Korean explanation, not direct translation).

**Expected:** Accept.

### S23 — Definition with explicit answer source attribution

Type "Webster says: a published collection of poems."

**Expected:** Accept (the core definition is right; attribution doesn't matter).

### S24 — Definition with student commentary

Type "a published collection of poems (which I learned from reading books)."

**Expected:** Accept.

### S25 — Definition negation by student

Type "NOT a single poem but a collection of them."

**Expected:** Accept (semantic equivalent).

### S26 — Reversed phrasing

Canonical: "to come together to form one mass."
Student types: "form one mass by coming together."

**Expected:** Accept.

### S27 — Multiple definitions / polysemy

If a word has multiple definitions and the seed only captures one, but the student provides a valid alternate meaning.

**Expected:** Accept the alternate (or reject with clear reasoning).

### S28 — Definition correctness vs surface match

Canonical: "anthology: a published collection of poems."
Student types: "anthology: a collection of poems that someone has chosen to put together in book form."

**Expected:** Accept (semantically equivalent, more verbose).

### S29 — Aggregate false-negative rate

Run the full 20 words with canonical answers (S01) 5 times in a row to test consistency.

**Expected:** 100/100 accept. If even 1 reject, the AI is non-deterministic — log as MEDIUM finding.

### S30 — Aggregate timing

Time each grading call.

**Expected:** Median under 5s, p95 under 30s.

Document the actual times. If consistently >10s, that's a UX concern (chat log showed students confused by long grading delays).

## Findings analysis

Aggregate findings into a table:

| Probe | Acceptance Rate | False Neg Rate | False Pos Rate |
| --- | --- | --- | --- |
| Canonical (S01) | should be 100% | … | n/a |
| Korean (S02) | … | … | … |
| Synonyms (S04) | … | … | … |
| One-word (S06) | … | … | … |
| Verbose (S07) | … | … | … |
| Tense (S09) | … | … | … |
| Plural (S08) | … | … | … |
| Lazy (S13) | n/a | n/a | should be 0% |
| Trolling (S14) | n/a | n/a | should be 0% |
| Self-ref (S16) | n/a | n/a | should be 0% |

If any false-negative rate >10%, that's a HIGH finding. If false-positive rate >5%, also HIGH.

If timing is consistently slow, MEDIUM.

## Severity reminder

S01 = BLOCKER if any verbatim-canonical is marked wrong (chat-log known issue). S02 = HIGH. S05 / S13 / S14 / S16 false positives = HIGH. Others MEDIUM/LOW.

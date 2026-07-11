# Codex review — round 01

The cited allocation and reconciliation mechanism is real: `totalListWords`, remaining/new-count, and the position-derived end index are at `src/services/studyService.js:231-254`; a valid passed anchor makes `twi = newWordEndIndex + 1` at `src/services/progressService.js:148-150`, and the list-scoped query selects greatest `newWordEndIndex` at `src/services/db.js:3267-3291`.  That does not make the proposed shared-list mutation safe.

## Findings

1. **severity: blocker**
   **location:** Plan §§2–3 and §5 (mutating `lists/{listId}`)
   **problem:** The change is global to every class and student assigned this list, not a continuation for the one finisher. It also immediately halves every existing progress percentage by changing the denominator. The plan's claim of “no break” omits this user-visible regression.
   **evidence:** Lists are teacher-owned (`src/services/db.js:432-464`) and each class refers to a shared list ID in its `assignments` map (`src/services/db.js:789-819`). Student progress uses `list.wordCount` as its denominator in both the dashboard (`src/pages/Dashboard.jsx:1886-1901`) and class detail (`src/pages/ClassDetail.jsx:76-103`). `fetchStudentStats` also divides state counts by the entire current words subcollection (`src/services/db.js:1053-1111`).
   **fix:** Do not extend a shared production list as an on-demand student fix. Decide and design a per-student/lap-aware continuation model (with an explicit display denominator), or clone/reassign a dedicated list only after enumerating and approving every affected class/student. Make the blast-radius report and acknowledgement a precondition, not merely a dry-run nicety.

2. **severity: blocker**
   **location:** Plan §5 position formula and §3 monotonic-position invariant
   **problem:** `position = baseCount * (L - 1) + w.position` is not safe when `wordCount` differs from `max(position)+1`, despite §5 saying the script captures max position. It can create duplicate positions, so `getNewWords`/range materialization can return multiple documents for one logical index and the asserted monotonic `newWordEndIndex` invariant no longer follows.
   **evidence:** Deleting a word only decrements `wordCount`; it never compacts positions (`src/services/db.js:626-636`). Normal add and batch-add also choose the next position from `wordCount` (`src/services/db.js:567-590`, `src/services/db.js:677-727`). Range materialization filters all documents whose position is in the range (`src/services/studyService.js:330-358`).
   **fix:** Before any write, require a contiguous, unique base position set and `wordCount === sourceCount === maxPosition+1`; otherwise refuse and repair/migrate separately. Use a verified stride derived from the base position domain and set the resulting count from the actual committed append count—not the stale `wordCount`.

3. **severity: blocker**
   **location:** Plan §4 “Full” PDF prerequisite
   **problem:** The prerequisite is already failed, but not because of a word-text key: Full List export unconditionally prints every word document. Extension will print each lap's duplicate vocabulary as additional numbered rows.
   **evidence:** Both dashboard and class-detail full exports call `fetchAllWords` (`src/pages/Dashboard.jsx:505-508,565-582`; `src/pages/ClassDetail.jsx:526-556`). That function fetches the whole subcollection ordered by position (`src/services/db.js:1012-1042`), and the PDF table maps every supplied entry to one row (`src/utils/pdfGenerator.js:135-146`).
   **fix:** Block this approach until export has an intentional lap policy (usually export canonical/base words by provenance), and test a multi-lap list. Do not mark the site safe merely because it does not deduplicate by text.

4. **severity: high**
   **location:** Plan §§5 and 7 rollback/idempotency
   **problem:** The promised reversible script is neither safely reversible after students enter a lap nor sufficiently specified to be idempotent after an interrupted commit. Deleting lap docs while retaining passed attempts makes reconciliation restore a TWI beyond the restored `wordCount`; it also leaves study-state docs whose word documents no longer exist. A multi-batch append can be interrupted after some docs are written, and a presence-only “copies already exist” check can falsely no-op that partial run.
   **evidence:** Reconciliation makes a valid passed attempt authoritative (`src/services/progressService.js:148-150,215-231`) and persists that value (`:258-266`); session initialization then calculates remaining/new count directly from it and `wordCount` (`src/services/studyService.js:231-235`). New-word initialization creates per-word states (`src/pages/DailySessionFlow.jsx:625-641`) and test processing writes states under `study_states/{wordId}` (`src/services/studyService.js:465-485`). Existing batch writing itself commits chunks independently (`src/services/db.js:683-728`), demonstrating the required failure mode.
   **fix:** Make revert refuse once any appended word has attempts/states (or implement a separately reviewed, atomic archival/migration plan). Persist an immutable run manifest before writes: canonical source IDs/count, deterministic target IDs, expected per-lap count, original list metadata, and state. Resume only after validating that manifest and every expected document; write `wordCount` last; support only run-ID-specific, pre-entry rollback.

5. **severity: high**
   **location:** Plan §4 test/word-text aggregation conclusion
   **problem:** The plan's search scope misses MCQ/Blind-Spot option generation. It excludes only the same `wordId`, then renders the copied definition text. A base word and its lap copy can therefore appear as correct and distractor options with identical text, producing ambiguous or duplicate answers.
   **evidence:** Standard MCQ options filter distractors by ID only and carry raw `definition` text (`src/pages/MCQTest.jsx:204-221`). Blind Spot does the same (`src/pages/BlindSpotCheck.jsx:85-105`).
   **fix:** Include test-option generation in §4's required inventory. Before extension, deduplicate distractors against the correct answer and each other by normalized displayed definition (and choose replacements); add regression coverage using a copied lap word.

## Required §4 inventory (verified)

| Site | Actual identity/behavior | Verdict |
| --- | --- | --- |
| Blind Spots / weak-word count | Reads all word docs, fetches state by word-document ID, then filters by that state (`src/services/studyService.js:814-886`; helper `:292-313`). It does not aggregate by text; each lap is a distinct item/state. | ID-safe for identity, but its count intentionally grows per lap; not a canonical-word dedupe. |
| Gradebook word details | Displays saved word text, but challenge mutations target `answer.wordId` (`src/pages/Gradebook.jsx:1318-1341,1380-1402`). No word-text aggregation site was found in `Gradebook.jsx`. | ID-safe for mutation; duplicate text can appear in separate historical answers. |
| Full List PDF | Fetches and maps every word document to a row, without any identity or text dedupe (`src/services/db.js:1034-1040`; `src/utils/pdfGenerator.js:135-146`). | **Breaks**—unconditional duplicate export. |
| Per-word `study_states` / mastery | State document keys are word IDs (`src/services/studyService.js:292-313,475-485`); segment materialization maps by ID (`src/services/studyService.js:409-430`). | ID-safe; lap copies deliberately create separate states and therefore inflate per-document mastery totals/denominators. |

## Additional plan corrections / unresolved decisions

- The root dead-end is not that a UI ignores `isListComplete`; `DailySessionFlow` explicitly chooses review if there is a segment, otherwise `COMPLETE` when no new words exist (`src/pages/DailySessionFlow.jsx:817-833`). The direct `/mcqtest` legacy path instead throws “No new words available” (`src/pages/MCQTest.jsx:319-324`). Section 1 should distinguish those flows and specify the intended completion/cycling UX, rather than state a single unverified UI behavior.
- The open questions need two gating decisions before cushion size or state volume: whether cycling is product behavior versus advancing to the next assigned list, and how it is scoped per student without altering everyone sharing the list. Also specify update/delete behavior for canonical words and existing lap copies; normal `updateWord` only changes the selected document (`src/services/db.js:596-623`).

VERDICT blockers=3 high=2 med=0 nits=0

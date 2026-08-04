# df2-07 FOLD LEDGER — legs (a)+(d)+(e): threshold copy, TZ verify, throttle-doc deletion
2026-08-04 · implementer (sonnet) · brief: `_ledgers/df2-07-ade-messaging-BRIEF.md`
Scaled to a copy/deletion fold: no closure/security claim is made anywhere in this fold, so
per the brief's own ledger section ("No closure/security claims ⇒ no bypass set required"),
GROUP A/B rows below carry no BYPASS SET.

PROCESS NOTE (flagged, not hidden): the brief's meta-instructions call for
`gate.mjs --plan` BEFORE editing. In practice I re-verified every anchor in code
(grep/Read, cited below) immediately before each corresponding edit, but did not
instantiate this ledger file — and therefore did not run `--plan` — until after the
edits were complete. The substance of "verify before editing" was followed per-site;
the formal `--plan` gate run was not. Both `--plan` and the final gate run are included
verbatim below, run in that (late) order. See report for full disclosure.

## GROUP V — VERIFY BEFORE EDITING (a guard is only "inert" if no live writer exists)
[x] V1  SessionProgressSheet.jsx:82 hardcodes `description: '95% required to pass',` with no
        threshold in scope. Confirmed via Read (full file) 2026-08-04 — line 82 matches the
        brief exactly, no drift.
[x] V2  Exactly 4 `<SessionProgressSheet` render sites exist repo-wide, matching the brief's
        four exactly, no fifth site. `grep -rn "<SessionProgressSheet" src/` →
        `src/pages/DailySessionFlow.jsx:2161`, `src/pages/MCQTest.jsx:1710`,
        `src/pages/TypedTest.jsx:2030`, `src/pages/TypedTest.jsx:2080`. All four line numbers
        matched the brief exactly (no drift).
[x] V3  `retakeThreshold` in scope at all 4 call sites is a FRACTION (0-1), NOT a percentage
        integer, default `0.95` — NOT `95`. Evidence: `src/utils/studyAlgorithm.js:24
        DEFAULT_RETAKE_THRESHOLD: 0.95, // Must score 95% on new word test to "pass"`;
        `src/pages/MCQTest.jsx:105` / `src/pages/TypedTest.jsx:102`
        `const [retakeThreshold, setRetakeThreshold] = useState(0.95)`; every `setRetakeThreshold`
        call site divides by 100 (`(Number(assignmentSettings.passThreshold) || 95) / 100`,
        MCQTest.jsx:304, TypedTest.jsx:351, etc.); `DailySessionFlow.jsx:343,1673`
        (`sessionConfig?.retakeThreshold || 0.95` / `?? 0.95`); `DailySessionFlow.jsx:2203`
        already passes the SAME in-scope value (`threshold={sessionConfig?.retakeThreshold}`) to
        `RetakePrompt`, unmodified. This directly governs how I read "default the prop to 95" —
        see report for the reasoning (flagged ambiguity, ledger stays evidence-only here).
[x] V4  HelpModal.jsx "Must score 95%" — brief cites `:209` and `:212` as TWO sites. Actual:
        `grep -n "95%\|92%\|Must score" src/components/HelpModal.jsx` → ONE hit only, line 212
        (`Must score 95% to continue (retake if needed)`). Line 209 is
        `<span ...>2</span>` (the step-2 numeral badge), no "95%" text. `git blame -L 200,220
        src/components/HelpModal.jsx` → whole block last touched by commit `653ea72c` (2026-01-05),
        i.e. unedited since long before the brief's 2026-08-04 confirmation — this is not
        same-day drift, the brief's citation of two sites was itself inaccurate. Also: line 212's
        text sits on the "New Words Test" step (step 2), not a "Review Test" step/row — step 4
        ("Review Test", lines 222-228 pre-edit) carries no number at all. The brief's framing
        ("`:212` is the Review row, real default 92 not 95") does not match the file; the
        `reviewPassThreshold` default-92 fact itself IS real elsewhere in the app
        (`src/utils/reviewSettingsAuthority.js:34`, `src/pages/ClassDetail.jsx:177`), just not
        attached to this HelpModal line. Resolved by content per the brief's own drift clause;
        genericized the one real site regardless of which row it labels (task is the same either
        way: no fixed number belongs in a class-less help modal).
[x] V5  Leg (e) 30% locations. `grep -n "30%" <6 targets>` before editing matched the brief's
        approximate citations almost exactly, no meaningful drift:
        `help-student-en.html:1007` (brief: ~1007) · `help-student-ko.html:998` (brief: ~998) ·
        `help-teacher-en.html:876` · `help-teacher-ko.html:876` · `TA_FAQ.md:48,50` (brief:
        48-50 region) · `TA_SUPPORT_GUIDE.md:84,86` (brief: 84-86 region).
[x] V6  `docs/TA_SUPPORT_GUIDE_ko.md` — full-file Read + targeted grep
        (`복습.*낮|낮.*복습|복습 점수|잠깁|보류|정체` and `새 단어`) → NO "30%", and NO throttle/
        hold-on-review passage exists anywhere in this file (it has only 6 numbered issues vs the
        English doc's 8; there is no counterpart to EN #7). The file's only "새 단어" mentions
        (lines 80/82) are the unrelated SUMMIT list-switch cue ("a student who finishes ASCENT
        stops getting new words (review only) — that's the cue to pick SUMMIT"), a different
        mechanism (natural list completion) from the review-score throttle. Per the brief
        ("If it genuinely is not there, report that — do not force a deletion") — ZERO edits made
        to this file.
[x] V7  TOC/anchor-link scan for all 6 leg-(e) edit targets, done BEFORE each delete:
        HTML: `grep -n 'faq-item.*id=\|id=.*faq-item' public/help-*.html` → no hits (faq-item divs
        carry no individual `id`; only the whole `<section id="faq">` is anchored, from the TOC,
        and that section is not being removed) — nothing to unlink.
        Markdown: `grep -n '\[.*\](#' docs/TA_FAQ.md docs/TA_SUPPORT_GUIDE.md
        docs/TA_SUPPORT_GUIDE_ko.md` → no hits in any of the 3 (no markdown anchor-link syntax
        exists in these docs at all). Both TA .md docs DO cross-reference the deleted item by
        plain-prose number ("(FAQ 4)" ×2 in TA_FAQ.md; "(see the new #7)" ×1 in
        TA_SUPPORT_GUIDE.md) — treated as the functional equivalent of a dangling anchor and
        cleaned (judgment call, flagged in report).

## GROUP A — DELTAS (copy/deletion fold — no BYPASS SET; no closure/security claim made)
[x] A1  `src/components/SessionProgressSheet.jsx` — add `retakeThreshold` prop (default `0.95`,
        JSDoc'd), replace the hardcoded literal with
        `` `${Math.round(retakeThreshold * 100)}% required to pass` ``. Verified: eslint clean
        (case: syntax-gate run below); grep-proof case: 0 literal "95%" remain in this file.
[x] A2  `src/pages/DailySessionFlow.jsx:2161` render site — thread
        `retakeThreshold={sessionConfig?.retakeThreshold}` (the exact in-scope value used
        unmodified at :2203 for RetakePrompt's `threshold` prop; no fallback added at the call
        site — the component's own default covers the undefined case). Fixture case: eslint
        diff-clean vs HEAD (see syntax gate below).
[x] A3  `src/pages/MCQTest.jsx:1710` render site — thread `retakeThreshold={retakeThreshold}`
        (component-level state, in scope). Fixture case: eslint diff-clean vs HEAD.
[x] A4  `src/pages/TypedTest.jsx:2030` render site — thread `retakeThreshold={retakeThreshold}`.
        Fixture case: eslint diff-clean vs HEAD.
[x] A5  `src/pages/TypedTest.jsx:2080` render site — thread `retakeThreshold={retakeThreshold}`.
        Fixture case: same file, second site, verified as a distinct anchor (different
        `currentPhase` expression) before editing.
[x] A6  `src/components/HelpModal.jsx:212` — genericize: `Must score 95% to continue (retake if
        needed)` → `Must reach your class's passing score to continue (retake if needed)`. No "92"
        inserted (grep-proof case below). No Korean variant exists for this string (checked).
[x] A7  `public/help-student-en.html` — delete the whole `faq-item` entry (~:1005-1008, "Q. I'm
        only getting review words — no new words are showing up."). Fixture case / well-formedness
        check: python3 html.parser feed, see gate output below.
[x] A8  `public/help-student-ko.html` — delete the whole `faq-item` entry (~:996-999, "Q. 새
        단어는 안 나오고 복습만 나와요."), located by meaning (no literal line-number citation
        needed — same entry structure as EN). Fixture case / well-formedness check: html.parser
        feed below.
[x] A9  `public/help-teacher-en.html` — delete the whole `faq-item` entry (~:874-877, "Q. A
        student is only getting review words, no new words."). Fixture case / well-formedness
        check: html.parser feed below.
[x] A10 `public/help-teacher-ko.html` — delete the whole `faq-item` entry (~:874-877, "Q. 학생에게
        새 단어는 안 나오고 복습만 나와요."). Fixture case / well-formedness check: html.parser
        feed below.
[x] A11 `docs/TA_FAQ.md` — fixture case: delete FAQ item "### 4." whole subsection (:47-53), PLUS
        remove the two now-dangling "(FAQ 4)" plain-prose pointers elsewhere in the same doc (:20,
        :90) so no stale cross-reference survives the deletion (judgment call, flagged in report).
        Headings NOT renumbered (5..12 stay 5..12 — a numbering gap, not a rewrite; renumbering
        would be markup redesign the brief forbids).
[x] A12 `docs/TA_SUPPORT_GUIDE.md` — fixture case: delete FAQ item "### 7." whole subsection
        (:83-88), PLUS remove the one now-dangling "(see the new #7)" pointer at :15. Headings not
        renumbered (8 stays "8").
[x] A13 verify case, not an edit: `docs/TA_SUPPORT_GUIDE_ko.md` — confirmed no throttle
        passage exists; zero edits (see V6).

## GROUP C — FIXTURES + MUTANTS (scaled: copy/deletion fold, no security guard changed)
[x] C1  Syntax-gate case, JSX: `npx eslint <the 5 touched jsx files>` — HelpModal.jsx and
        SessionProgressSheet.jsx exit 0 (zero findings). DailySessionFlow.jsx / MCQTest.jsx /
        TypedTest.jsx each carry PRE-EXISTING lint errors/warnings (unused vars, react-hooks
        exhaustive-deps) — confirmed identical in count/message/rule when linting `git show
        HEAD:<file>` (i.e. the unedited version) via stdin, so my edits introduced zero new
        findings. Full commands + output in report.
[x] C2  Well-formedness case, HTML: `xmllint` absent (`command -v xmllint` exit 1) → ran the
        brief's documented fallback, a python3 `html.parser` feed PLUS a same-script tag-stack
        balance check (catches unbalanced/mismatched open-close tags, which is exactly what a
        passage deletion could break). All 4 files: `WELL-FORMED (html.parser feed clean)`,
        exit 0. Script: `/tmp/claude-1000/-app/fe422ae2-f0e2-4b80-974f-950b847a1e84/scratchpad/html_wellformed_check.py`
        (scratchpad, not a repo file).
[x] C3  Grep-proof case, leg (a): `grep -n "95%" src/components/SessionProgressSheet.jsx
        src/components/HelpModal.jsx` → 0 hits (exit 1). `grep -n "92" src/components/HelpModal.jsx`
        → 0 hits (exit 1, confirms "do NOT insert 92" honored).
[x] C4  Grep-proof case, leg (e): `grep -n "30%" <all 6 editable targets>` → 0 hits (exit 1)
        across all 6 in one combined command.
[x] C5  Render-site case, leg (a): `grep -c "retakeThreshold={" <3 page files>` → 1/1/2
        (DailySessionFlow/MCQTest/TypedTest×2) = 4 total, matching all 4 confirmed render sites.
[x] C6  docx read-only peek case (NOT an edit — reporting only): stdlib `zipfile` extraction of
        `word/document.xml` from both `.docx` files shows they still say "the student a challenge
        token for 30 days" / "학생은 30일 동안 ... 토큰 1개를 잃습니다" — i.e. they predate even
        the "tokens now reset weekly every Monday" copy update the two `.md` docs already carry
        in their "Updated this week" banners, confirming they are stale exports on more than just
        the throttle passage. No mutant needed; this is evidence for the GROUP E note, not a
        closure claim.

## GROUP D — TRUTH REPAIRS (every sentence I published that the review falsified)
[x] D1  None — first pass, nothing published earlier in this fold to correct.

## GROUP E — CARDED, NOT THIS ROUND (so nothing is silently dropped)
[x] E1  `src/pages/Dashboard.jsx:1468-1477` `getStartOfWeek()` buckets the "words introduced this
        week" stat using BROWSER-LOCAL midnight-Monday (`new Date()`, `.getDay()`,
        `.setHours(0,0,0,0)`), not the canonical KST Monday-04:00 boundary
        (`src/services/db.js:194-206 startOfKstWeekMs`). This is an internal stat-bucketing
        boundary, not adjacent to any rendered COPY that makes an explicit reset-time CLAIM (no
        "resets Monday" text is attached to the weekly-goals panel) — so it does not match leg
        (d)'s scope ("grep student-facing copy... for reset-time claims"). Flagged for awareness
        only; NOT actioned, NOT part of the leg-(d) findings table below, zero edits made.
[x] E2  `docs/TA_SUPPORT_GUIDE.docx` / `docs/TA_SUPPORT_GUIDE_ko.docx` — confirmed stale (see C6),
        NOT edited per the brief ("DO NOT EDIT; report them as stale exports needing
        regeneration"). Regeneration is out of this fold's scope.
[x] E3  VISUAL — see dedicated row below (not carded, OWED — kept separate per the brief's exact
        template line so it is not swept into "done").

VISUAL row: [ ] OWED — WinClaude order (batched by orchestrator; flag-off copy check on 25WT)

## CLOSE (gate.mjs enforces the mechanical half)
[x] every row ticked with file:line + fixture ref (VISUAL intentionally excepted — see above)
[x] evidence re-run AFTER the last edit (all grep-proofs, eslint, html.parser re-run post-edit;
    see report for verbatim output)
[ ] all shas re-stamped — N/A, this fold does not certify a rules/matrix sha (no
    audit/deepfix/task3 artifact touched)
[x] numbers re-derived from the evidence — every count in this ledger (4 render sites, 1 "95%"
    hit, 0 "30%" hits, etc.) is a literal grep/eslint output, not hand-typed
[ ] change log row (ABSOLUTE path) — NOT added; the orchestrator appends
    `change_action_log.md` rows per the standing constraint ("Do NOT write
    change_action_log.md — put the proposed row TEXT in your report")
[x] `node scripts/deepfix2/gate.mjs` run — output included verbatim in report (NOT expected clean:
    the VISUAL row is deliberately left `[ ]` OWED per the brief's template, which the LEDGER gate
    will report as an unticked row — expected, not a defect)
[ ] commit — explicitly forbidden to this implementer (orchestrator stages + commits)

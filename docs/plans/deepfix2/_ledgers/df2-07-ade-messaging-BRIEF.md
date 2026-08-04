# BRIEF — df2-07 legs (a)+(d)+(e): threshold copy, TZ verify, throttle-doc deletion
2026-08-04 · orchestrator → implementer (sonnet) · fold ledger: `_ledgers/df2-07-ade-messaging-fold-ledger.md`

## Scope — exactly three legs. NOT legs (b) review-only banner or (c) list-end message (separate fold).

### Leg (a) — threshold copy correction (flag-OFF-visible, deliberate)
This is NOT flag-gated. The hardcoded "95%" is wrong TODAY for any class whose threshold differs, and
HelpModal's Review row mislabels 95 when the review default is 92. Netlify is off, so nothing reaches
students until a hosting deploy. Do not wrap any of this in REVIEW_V2_CLIENT.

1. `src/components/SessionProgressSheet.jsx:82` (line numbers here and below were confirmed 2026-08-04
   but RE-VERIFY each before editing; if a site has drifted, find it by content and note the real line
   in the ledger) hardcodes "95% required to pass" with no threshold in scope.
   - Add a prop (follow the file's existing prop naming; `retakeThreshold` unless the component
     conventions say otherwise) and render it in place of the hardcoded number.
   - **Default the prop to 95** so an unthreaded render site degrades to today's copy, never
     "undefined%".
   - The component must NOT re-derive the value from class config — it renders what the caller passes.
2. Thread it from ALL FOUR render sites — `DailySessionFlow.jsx:2161`, `MCQTest.jsx:1710`,
   `TypedTest.jsx:2030`, `TypedTest.jsx:2080`. Each caller already has `retakeThreshold` in scope
   (confirmed 2026-08-04) — pass exactly that in-scope value; do not recompute it.
   - Grep the repo for OTHER `<SessionProgressSheet` render sites; if any exist beyond these four,
     thread them too and record them in the ledger (the four were the confirmed set).
3. `src/components/HelpModal.jsx:209` and `:212` "Must score 95%" — **GENERICIZE: drop the number**
   (orchestrator decision, recorded in WORK_QUEUE). It is a class-less help modal; no number can be
   right for every class. Something like "Must reach your class's passing score" — match the modal's
   existing tone. Do NOT insert 92 anywhere. Note: :212 is the Review row (real default 92, not 95);
   genericizing is what fixes the mislabel.
4. If any of these strings have Korean variants (i18n keys, ko ternaries, parallel ko text), make the
   matching ko change minimal and **FLAG every Korean prose change prominently in your report** for
   orchestrator review.

### Leg (d) — TZ-honest token copy — VERIFY-ONLY, ZERO EDITS
Grep student-facing copy (src/ + the four `public/help-*.html`) for token/quota reset-time claims —
patterns like "midnight", "12:00", "resets at", "tomorrow", "daily", "KST", "자정", "내일". Verify each
claim is timezone-honest (canonical reset semantics are KST). REPORT findings as file:line + verdict in
the ledger. Do not edit anything under this leg, even trivially-wrong copy.

### Leg (e) — DELETE the 30%-throttle passages (bounded doc deletion)
The allocation throttle ("review scores under ~30% hold new words") is being removed at the flip; its
help passages must go from the COMMITTED docs now. Context you need but must not act on: the throttle is
still LIVE in production until the flip, so this deletion is committed-not-live by design — do not
"soften" or rewrite the passages into something else; delete them.

Targets (1 "30%" hit each in the HTML; locate the ko-guide passage by meaning):
- `public/help-student-en.html` (~:1007) · `public/help-student-ko.html` (~:998)
- `public/help-teacher-en.html` · `public/help-teacher-ko.html`
- `docs/TA_FAQ.md` (:48-50 region) · `docs/TA_SUPPORT_GUIDE.md` (:84-86 region)
- `docs/TA_SUPPORT_GUIDE_ko.md` — no literal "30%"; find the equivalent hold-on-review/throttle
  passage by meaning. If it genuinely is not there, report that — do not force a deletion.
- `docs/TA_SUPPORT_GUIDE.docx` / `_ko.docx` — DO NOT EDIT; report them as stale exports needing
  regeneration.

Delete the WHOLE passage (the full Q&A block or section, not just the sentence containing "30%"), and:
- remove any TOC entries / anchor links pointing at a deleted section (no dangling `href="#..."`);
- keep the HTML well-formed — verify with `xmllint --html --noout` if available, else a python3
  `html.parser` feed; record which tool ran.

## Constraints (law)
- Touch ONLY: the 5 JSX files above, the 4 help HTML files, the 3 TA .md files, and your fold ledger.
  Nothing else — no `.claude/*`, no baton files, no WORK_QUEUE/RESUME edits, no `git add`, NO COMMIT
  (the orchestrator stages explicitly and commits after verification).
- No styling/markup redesign; copy and deletion only. No new dependencies.
- WSL cannot run vite — do NOT attempt a build or dev server. Syntax-gate the JSX edits instead: try
  `npx eslint <touched jsx>` (JS-only binary, should run); if eslint won't run, parse-check via
  `npx prettier <file> > /dev/null` (exit 0 = parsed); record which gate ran in the ledger. If neither
  runs, say so — do not fake a check.

## Fold ledger (you create it, template: scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md, scaled to a copy fold)
One row per site with before/after excerpt + [x]. No closure/security claims ⇒ no bypass set required.
Grep-proof rows (paste the command + output):
- `grep -n "95%" src/components/SessionProgressSheet.jsx src/components/HelpModal.jsx` → no hardcoded
  user-facing "95%" remains (the default-95 prop value is fine and expected);
- all render sites pass the prop;
- `grep -n "30%" <the 6 editable targets>` → 0 hits (ko guide: the passage located by meaning is gone).
VISUAL row: `[ ] OWED — WinClaude order (batched by orchestrator; flag-off copy check on 25WT)`.

## Report back
Per-leg outcome, ledger path, every Korean prose change, leg-(d) findings table, any drifted line
numbers, which syntax gate ran, and anything that surprised you. Your report is a CLAIM — the
orchestrator re-verifies; make the ledger's evidence copy-pasteable.

# B13 — Extreme Inputs

**Priority:** P1
**Estimated duration:** 60–90 minutes
**Depends on:** B00.
**Personas:** Lazy Student, Hostile Student, Power Teacher.

## Goal

Boundary cases — empty inputs, maximum-length inputs, special characters, weird Unicode, injection-style strings. Don't crash, don't corrupt, don't leak.

## Scenarios

### S01 — Empty answers on a test

Already covered in B02 S08 and B03 S09. Cross-reference.

### S02 — Maximum-length typed answer

Already covered B03 S07.

### S03 — Definitions with Markdown / HTML

1. Power Teacher: create a word with definition = `<script>alert('xss')</script>`.
2. Display the word on the dashboard / in a study card.
3. Verify: HTML rendered as text (not executed). No script alert.

**Failure → BLOCKER.** XSS via word definitions.

### S04 — Definitions with SQL injection-style strings

1. Power Teacher: word = `'; DROP TABLE users; --`.
2. Display + take a test.
3. Verify: no Firestore error, the string round-trips as-is.

(No SQL here but query injection equivalents — verify Firestore queries built from word data don't break.)

### S05 — Class name with very long string

1. Create class with 500-char name.
2. Display in dashboard.
3. Verify: layout doesn't break; name is truncated with ellipsis or wraps.

### S06 — List title with Unicode emoji

1. Create list titled "🎉 Vocab 🚀".
2. Display in dashboard, in list editor, in study session.
3. Verify: emoji renders everywhere.

### S07 — Word with empty definition

1. Try to create a word with empty definition.
2. Expected: validation rejects.

### S08 — Word with whitespace-only definition

1. Definition = "   " (3 spaces).
2. Expected: validation rejects (trim + check).

### S09 — Word with only special chars

1. Word = `!@#$%^&*()`.
2. Definition = `\n\t\r`.
3. Verify saved + displayed correctly. Tests on this list don't crash.

### S10 — Korean-only definition

1. Word with definition entirely in Korean.
2. Take typed test. Type Korean answer.
3. Verify AI grading accepts (per B03 S06).

### S11 — Arabic / RTL definition

1. Word with definition in Arabic.
2. Display in study card; verify RTL layout doesn't break left-aligned UI.

### S12 — Definition with 1000+ characters

1. Definition = lorem ipsum × 5.
2. Display in study card.
3. Verify text wraps; "Read more" / scroll affordance available.

### S13 — Class joinCode collisions

1. Create two classes; verify joinCodes are unique.
2. Try to join with garbage code "AAAAAA"; verify rejection.
3. Try to join with a class's code while already enrolled; verify no-op or clear "already enrolled" message.

### S14 — User email with + sign (Gmail aliasing)

1. Sign up `audit+test@vocaboost.test`.
2. Verify accepted; login works.

### S15 — User email with very long local-part

1. Email = 64-char local part + standard domain.
2. Verify accepted.

### S16 — Form field that exceeds Firestore document size limit

1. Field value > 1 MB (Firestore field limit).
2. Verify clear error UI; no silent partial write.

### S17 — Submit form with all fields zero / null

1. Various forms (Settings, Edit List Settings) — set every field to 0 / empty / null where allowed.
2. Verify: validation or sane defaults.

### S18 — Negative pace

1. Try to set pace = -5 in list settings.
2. Verify: validation rejects.

### S19 — Very large CSV import

1. Power Teacher: import 5000 words to a new list.
2. Verify: completes (may take minutes); wordCount = 5000.
3. Audit-known issue: batchAddWords non-atomic; partial failure leaves drift.

### S20 — Word with newlines in definition

1. Definition = "line1\nline2\nline3".
2. Verify display preserves line breaks OR collapses them — be consistent.

### S21 — Paste image into a text input

1. Try to paste image data into a definition input.
2. Verify: handled (either rejected or stripped to alt text).

### S22 — Class created with no name

1. Try to create class with empty name.
2. Validation rejects.

## Severity reminder

S03 = BLOCKER (XSS). S04 / S16 = HIGH. Others MEDIUM/LOW.

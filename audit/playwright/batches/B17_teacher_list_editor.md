# B17 — Teacher List Editor

**Priority:** P2
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B16.
**Personas:** Power Teacher, Novice Teacher.

## Goal

Create/edit/delete words. Bulk add. Stay in sync with the dashboard. Don't lose unsaved edits.

## Scenarios

### S01 — Add word happy path

1. Open `tinyList`. Click Add Word.
2. Fill word, definition, optional sample sentence.
3. Save. Word appears in list immediately.
4. Refresh; word persists.

### S02 — Edit existing word

1. Click a word. Edit definition.
2. Save. Verify update.

### S03 — Delete word

1. Click word, Delete, confirm.
2. Word gone; wordCount decremented.
3. Audit-known issue: wordCount in list doc not always atomic with delete.

### S04 — Bulk add via CSV / TSV paste

1. Open Bulk Add modal. Paste 100 words in TSV.
2. Submit. Wait for progress bar.
3. Verify all 100 saved. wordCount = previous + 100.

### S05 — Bulk add with partial failure simulated

1. Route: fail one of the chunks.
2. Verify error UI; teacher informed how many succeeded.
3. Verify wordCount reconciles (or note as known drift).

### S06 — Unsaved edits warning on close

1. Open word, edit definition (don't save).
2. Click X / navigate away.
3. Expected: warning "Unsaved changes." Click Cancel → stay; click Discard → leave.

**Audit-known issue #15 (B-finding):** ListEditor has no unsaved-changes warning.
**Failure → MEDIUM** if no warning.

### S07 — Concurrent edits

(Covered in B12 S09.)

### S08 — Special chars in word/definition

(Covered in B13.)

### S09 — Generate PDF of list

1. From list view, click Download PDF.
2. PDF generates and downloads.
3. Verify PDF contains all words correctly formatted.
4. Audit-known: fetchAllWords cache may serve stale data.

### S10 — Generate Today's Batch PDF

1. Click "Today's Batch."
2. PDF contains only the current segment's words.

### S11 — Reorder words (if supported)

1. Drag word from position 5 to position 1.
2. Save. Verify positions updated.

### S12 — List metadata edits

1. Edit list title, description.
2. Save. Verify dashboard reflects update (cache staleness?).

## Severity reminder

S06 = MEDIUM (audit-known). S04 / S05 = HIGH. Others LOW.

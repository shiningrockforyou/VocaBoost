# Reconciliation Fix: New Test as Anchor

## Problem Summary
The current reconciliation logic can produce mismatched CSD and TWI values because:
- CSD is derived from the highest day's review test
- TWI is derived from the highest day's new test
- These can be different days, causing desync

**Example of bug:**
- Attempts: Day 5 review, Day 4 review, Day 4 new
- Current logic: CSD=5 (from Day 5 review), TWI=240 (from Day 4 new)
- Expected: CSD=4, TWI=240 (both from Day 4 anchor)

## Solution: New Test as Anchor

The new test should be the **anchor** for both CSD and TWI calculations. This ensures consistency because:
1. TWI directly comes from `newWordEndIndex + 1` of the anchor
2. CSD is derived relative to the anchor day

### Logic Flow

```
1. Find highest day with a NEW test → this is the "anchor"
2. TWI = anchor.newWordEndIndex + 1
3. CSD calculation:
   - If anchor day is 1:
     - CSD = 1 if new test passed, else 0
   - If anchor day is 2+:
     - CSD = anchorDay if review test exists for anchorDay
     - CSD = anchorDay - 1 if no review test for anchorDay
```

### Truth Table

| Anchor Day | New Test Passed | Review Exists | CSD | TWI |
|------------|-----------------|---------------|-----|-----|
| 1 | Yes | - | 1 | 60 |
| 1 | No | - | 0 | 60 |
| 2 | Yes | Yes | 2 | 120 |
| 2 | Yes | No | 1 | 120 |
| 3 | Yes | Yes | 3 | 180 |
| 3 | Yes | No | 2 | 180 |
| 4 | Yes | Yes | 4 | 240 |
| 4 | Yes | No | 3 | 240 |

Note: For Day 2+, the new test `passed` status is not used for CSD - only whether review exists matters. The assumption is that if a new test exists for Day N, the student has already completed Day N-1.

## Files to Modify

### 1. `src/services/progressService.js` (lines 40-102)

Replace `calculateCSDAndTWIFromAttempts()` function:

```javascript
function calculateCSDAndTWIFromAttempts(attempts) {
  if (!attempts || attempts.length === 0) {
    return { csd: 0, twi: 0 };
  }

  // Step 1: Find the anchor - highest day with a NEW test
  // Attempts are sorted by submittedAt desc, so we iterate to find highest studyDay with sessionType='new'
  let anchorNewTest = null;
  let anchorDay = 0;

  for (const attempt of attempts) {
    if (attempt.sessionType === 'new' && attempt.newWordEndIndex != null) {
      if (attempt.studyDay > anchorDay) {
        anchorDay = attempt.studyDay;
        anchorNewTest = attempt;
      }
    }
  }

  // No new test found - student hasn't started
  if (!anchorNewTest || anchorDay === 0) {
    console.log('[RECONCILIATION] No new test found, returning CSD=0, TWI=0');
    return { csd: 0, twi: 0 };
  }

  // Step 2: TWI comes directly from anchor
  const twi = anchorNewTest.newWordEndIndex + 1;

  // Step 3: Calculate CSD based on anchor day and review existence
  let csd;

  if (anchorDay === 1) {
    // Day 1 special case: CSD depends on whether new test passed
    csd = anchorNewTest.passed === true ? 1 : 0;
  } else {
    // Day 2+: Check if review test exists for anchor day
    const reviewForAnchorDay = attempts.find(
      a => a.studyDay === anchorDay && a.sessionType === 'review'
    );
    csd = reviewForAnchorDay ? anchorDay : anchorDay - 1;
  }

  console.log('[RECONCILIATION] Calculated from anchor:', {
    anchorDay,
    anchorNewTestId: anchorNewTest.id,
    newWordEndIndex: anchorNewTest.newWordEndIndex,
    twi,
    csd,
    reviewExistsForAnchor: anchorDay > 1 ? !!attempts.find(a => a.studyDay === anchorDay && a.sessionType === 'review') : 'N/A (Day 1)'
  });

  return { csd, twi };
}
```

### 2. `src/services/studyService.js` (line 1087)

Keep the existing fix for `wordsIntroduced`:

```javascript
// Use sessionConfig.newWordCount as primary source (it's calculated at session init)
const wordsIntroduced = sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0;
```

### 3. `src/services/db.js` (fallback query)

Keep `getMostRecentNewTest()` for edge cases where initial attempt fetch doesn't include enough history.

## Verification

After implementing, verify with the affected students:

| Student | Current State | Expected After Fix |
|---------|--------------|-------------------|
| Jimin Lee | CSD=5, TWI=0 | CSD=N, TWI=N×60 (based on anchor) |
| Kimdonghyeon | CSD=5, TWI=0 | CSD=N, TWI=N×60 |
| Seohong Min | CSD=5, TWI=0 | CSD=N, TWI=N×60 |
| 오윤재 | CSD=5, TWI=0 | CSD=N, TWI=N×60 |
| 김수린 | CSD=5, TWI=0 | CSD=N, TWI=N×60 |
| sol lee | CSD=6, TWI=0 | CSD=N, TWI=N×60 |
| David Lee | CSD=5, TWI=0 | CSD=N, TWI=N×60 |

Run `node scripts/list-student-progress.js` before and after to compare.

## Orphaned Review Cleanup

When reconciliation finds reviews for days **beyond** the anchor day, they are "orphaned" (e.g., Day 5 review when anchor is Day 4 new). These must be cleaned up to prevent the review phase from being incorrectly skipped.

**Process:**
1. Find orphaned reviews: `attempt.sessionType === 'review' && attempt.studyDay > anchorDay`
2. For each orphaned review:
   - Save full attempt data as JSON string to `system_logs` collection (audit trail)
   - Delete from `attempts` collection
3. Student can now properly complete the day with correct word sets

**system_logs entry format:**
```javascript
{
  type: 'orphaned_attempt_deleted',
  userId,
  classId,
  listId,
  attemptId: orphan.id,
  attemptData: JSON.stringify(orphan),  // Full data as string
  anchorDay,
  reason: 'Review for Day X deleted - no matching new test exists',
  deletedAt: serverTimestamp()
}
```

## Edge Cases

1. **No attempts at all**: Returns CSD=0, TWI=0 (student hasn't started)
2. **Only review attempts, no new test**: Returns CSD=0, TWI=0, orphaned reviews deleted
3. **New test exists but no `newWordEndIndex`**: Skipped in anchor search, falls back to next candidate
4. **Multiple new tests on same day**: Uses first one found (already sorted by submittedAt desc)

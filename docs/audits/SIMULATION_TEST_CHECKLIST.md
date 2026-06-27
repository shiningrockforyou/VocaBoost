# VocaBoost Simulation Test Checklist

> **Purpose:** Comprehensive end-to-end verification of study flow mechanics across different student performance levels.
> **Date:** 2026-01-03

---

## Test Configuration

### Assignment Settings (Default)
| Setting | Value | File Reference |
|---------|-------|----------------|
| Daily Pace | 80 words | `src/components/AssignListModal.jsx:89` |
| Study Days Per Week | 5 | `src/components/AssignListModal.jsx:90` |
| Pass Threshold | 0.95 (95%) | `src/components/AssignListModal.jsx:91` |
| Test Size (New Words) | 10 | `src/components/AssignListModal.jsx:92` |
| Review Test Type | MCQ | `src/components/AssignListModal.jsx:94` |
| Review Test Size Min | 30 | `src/components/AssignListModal.jsx:95` |
| Review Test Size Max | 60 | `src/components/AssignListModal.jsx:96` |

### Word Status Definitions
| Status | Meaning | File Reference |
|--------|---------|----------------|
| `NEW` | Word in list, never introduced | `src/types/studyTypes.js:4` |
| `NEVER_TESTED` | Introduced but not yet tested | `src/types/studyTypes.js:5` |
| `PASSED` | Answered correctly on test | `src/types/studyTypes.js:7` |
| `FAILED` | Answered incorrectly on test | `src/types/studyTypes.js:6` |
| `MASTERED` | Graduated from review pool | `src/types/studyTypes.js:8` |
| `NEEDS_CHECK` | Returned from MASTERED after 21 days | `src/types/studyTypes.js:9` |

---

## Student Profiles

### Profile A: High-Performing Student (Alex)
- **Accuracy:** 90-95% on tests
- **Behavior:** Completes sessions fully, rarely uses dismiss feature
- **Expected Intervention:** 0% (scores stay above 75%)

### Profile B: Average Student (Bailey)
- **Accuracy:** 70-80% on tests
- **Behavior:** Occasionally uses dismiss, sometimes needs retakes
- **Expected Intervention:** 0-30% (scores hover around threshold)

### Profile C: Struggling Student (Casey)
- **Accuracy:** 50-65% on tests
- **Behavior:** Needs multiple retakes, uses dismiss feature often
- **Expected Intervention:** 50-100% (scores consistently below 75%)

---

# PROFILE A: High-Performing Student (Alex)

## Week 1

### Day 1 - First Session

#### Action A1.1: Open Dashboard
**User Action:** Navigate to Dashboard with assigned list

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Dashboard loads with "Start Today's Session" button | Visual check | `src/pages/Dashboard.jsx:892-920` |
| 2 | Progress shows Day 0, 0 words learned | `currentDayNumber === 0` | `src/pages/Dashboard.jsx:245-248` |
| 3 | No blind spot count displayed (no words yet) | `blindSpotCount === 0` | `src/pages/Dashboard.jsx:529` |

#### Action A1.2: Start Day 1 Session
**User Action:** Click "Start Today's Session"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | LOADING phase shows spinner | `phase === PHASES.LOADING` | `src/pages/DailySessionFlow.jsx:285-290` |
| 2 | `returnMasteredWords()` called (returns 0) | Console log | `src/pages/DailySessionFlow.jsx:477` |
| 3 | Session initializes with Day 1 config | `sessionConfig.dayNumber === 1` | `src/services/studyService.js:54-128` |
| 4 | Intervention level = 0 (no previous scores) | `interventionLevel === 0` | `src/utils/studyAlgorithm.js:57-89` |
| 5 | Daily pace = 80 (no intervention reduction) | `dailyPace === 80` | `src/services/studyService.js:70-73` |
| 6 | Segment = null (Day 1 has no review) | `segment === null` | `src/utils/studyAlgorithm.js:128-130` |
| 7 | Phase transitions to NEW_WORDS | `phase === PHASES.NEW_WORDS` | `src/pages/DailySessionFlow.jsx:553` |
| 8 | 80 new words loaded in queue | `newWords.length === 80` | `src/pages/DailySessionFlow.jsx:495-498` |

#### Action A1.3: Study New Words
**User Action:** Swipe through 80 flashcards (no dismissals)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Each swipe increments progress counter | Progress bar updates | `src/pages/DailySessionFlow.jsx:634-640` |
| 2 | Word status updates to NEVER_TESTED on view | Firestore write | `src/services/studyService.js:179-195` |
| 3 | After 80 cards, "Take Test" button appears | `newWordsQueue.length === 0` | `src/pages/DailySessionFlow.jsx:718-735` |
| 4 | Dismissed words drawer shows "0" (not visible) | `dismissedCount === 0` | `src/pages/DailySessionFlow.jsx:769-780` |

#### Action A1.4: Take New Word Test (Score: 95%)
**User Action:** Complete 10-question MCQ test, get 9.5/10 (95%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Test generates 10 questions from new words | `words.length === testSizeNew` | `src/pages/MCQTest.jsx:104-108` |
| 2 | Each question has 4 MCQ options | `options.length === 4` | `src/pages/MCQTest.jsx:148-175` |
| 3 | Submit triggers `processTestResults()` | Firestore batch write | `src/services/studyService.js:228-264` |
| 4 | Correct answers → status = PASSED | Status update | `src/services/studyService.js:243-248` |
| 5 | Wrong answers → status = FAILED | Status update | `src/services/studyService.js:249-254` |
| 6 | Test attempt saved to Firestore | `submitTestAttempt()` called | `src/services/db.js:1313-1379` |
| 7 | Score ≥ 95% → passes threshold | `score >= passThreshold` | `src/pages/MCQTest.jsx:239-241` |
| 8 | No retake required, proceeds to next phase | `canRetake === false` | `src/pages/MCQTest.jsx:243` |

#### Action A1.5: Skip Review (Day 1 has no segment)
**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment is null, skip REVIEW_STUDY | `segment === null` | `src/pages/DailySessionFlow.jsx:907-912` |
| 2 | Skip REVIEW_TEST phase | Direct to COMPLETE | `src/pages/DailySessionFlow.jsx:913-918` |
| 3 | Phase transitions to COMPLETE | `phase === PHASES.COMPLETE` | `src/pages/DailySessionFlow.jsx:919` |

#### Action A1.6: Complete Session
**User Action:** View completion screen

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `completeSession()` called | Session finalization | `src/pages/DailySessionFlow.jsx:968-1040` |
| 2 | Day advances from 0 → 1 | `updateClassProgress()` | `src/services/progressService.js:91-134` |
| 3 | `wordsIntroduced` increments by 80 | Firestore update | `src/services/progressService.js:112-115` |
| 4 | No graduation (no segment) | Skip graduation call | `src/pages/DailySessionFlow.jsx:997-1008` |
| 5 | Completion screen shows stats | Visual verification | `src/pages/DailySessionFlow.jsx:1175-1220` |
| 6 | Return to Dashboard shows Day 1 complete | `currentDayNumber === 1` | `src/pages/Dashboard.jsx:245-248` |

---

### Day 2 - Second Session (First Review)

#### Action A2.1: Start Day 2 Session
**User Action:** Click "Start Today's Session"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Session initializes with Day 2 config | `sessionConfig.dayNumber === 2` | `src/services/studyService.js:54-128` |
| 2 | Intervention = 0 (only 1 score: 95%) | Last 3 scores: [95%] | `src/utils/studyAlgorithm.js:57-89` |
| 3 | Daily pace = 80 (no reduction) | `dailyPace === 80` | `src/services/studyService.js:70-73` |
| 4 | Segment calculated for Day 2 | Week 1, Day 2 = segment 0 | `src/utils/studyAlgorithm.js:121-156` |
| 5 | Segment projection: 320 words / 4 = 80 | `segmentSize === 80` | `src/utils/studyAlgorithm.js:143-144` |
| 6 | Segment indices: 0-79 | `{ startIndex: 0, endIndex: 79 }` | `src/utils/studyAlgorithm.js:149-150` |

#### Action A2.2: Study 80 New Words
**User Action:** Complete new words study phase

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | 80 new words (indices 80-159) | `newWords.length === 80` | `src/pages/DailySessionFlow.jsx:495-498` |
| 2 | All words marked NEVER_TESTED | Status updates | `src/services/studyService.js:179-195` |

#### Action A2.3: Pass New Word Test (95%)
**User Action:** Score 95% on new word test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | 9-10 words → PASSED status | `processTestResults()` | `src/services/studyService.js:243-248` |
| 2 | 0-1 words → FAILED status | `processTestResults()` | `src/services/studyService.js:249-254` |
| 3 | Passes threshold, proceeds to review | `score >= 0.95` | `src/pages/MCQTest.jsx:239-241` |

#### Action A2.4: Review Study Phase (Segment 0-79)
**User Action:** Study segment words from Day 1

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Phase = REVIEW_STUDY | `phase === PHASES.REVIEW_STUDY` | `src/pages/DailySessionFlow.jsx:561` |
| 2 | Review queue built from segment | `buildReviewQueue()` | `src/services/studyService.js:464-504` |
| 3 | FAILED words prioritized first | Sort by status | `src/services/studyService.js:491-495` |
| 4 | Queue contains ~80 words | Segment 0-79 | `src/pages/DailySessionFlow.jsx:567-580` |

#### Action A2.5: Take Review Test (Score: 92%)
**User Action:** Complete review test, score 92%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Test size = 30 (min, intervention = 0) | `calculateReviewTestSize(0)` | `src/utils/studyAlgorithm.js:231-241` |
| 2 | Test type = MCQ (from assignment) | `reviewTestType === 'mcq'` | `src/pages/DailySessionFlow.jsx:862-870` |
| 3 | `processTestResults()` updates statuses | PASSED/FAILED updates | `src/services/studyService.js:228-264` |
| 4 | Test attempt saved with `testType: 'review'` | Firestore write | `src/services/db.js:1313-1379` |

#### Action A2.6: Complete Session with Graduation
**User Action:** View completion screen

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `graduateSegmentWords()` called | With score 0.92 | `src/pages/DailySessionFlow.jsx:997-1008` |
| 2 | ~92% of PASSED words graduate | ~74 of 80 → MASTERED | `src/services/studyService.js:745-793` |
| 3 | Graduated words get `masteredAt` timestamp | Firestore update | `src/services/studyService.js:778-782` |
| 4 | Graduated words get `returnAt` = now + 21 days | Firestore update | `src/services/studyService.js:778-782` |
| 5 | FAILED words stay in pool | Status unchanged | `src/services/studyService.js:757` |
| 6 | Day advances 1 → 2 | `updateClassProgress()` | `src/services/progressService.js:91-134` |
| 7 | `wordsIntroduced` = 160 | 80 + 80 | `src/services/progressService.js:112-115` |

---

### Day 3-5 - Continued Week 1

#### Action A3.1-A5.1: Days 3-5 Pattern
**User Action:** Complete daily sessions with 90-95% accuracy

**Expected Behaviors (Day 3):**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment 1: indices 80-159 | Week 1, Day 3 | `src/utils/studyAlgorithm.js:149-150` |
| 2 | Intervention still 0% | Avg of 95%, 92% > 75% | `src/utils/studyAlgorithm.js:82-85` |

**Expected Behaviors (Day 4):**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment 2: indices 160-239 | Week 1, Day 4 | `src/utils/studyAlgorithm.js:149-150` |
| 2 | Intervention still 0% | All scores > 75% | `src/utils/studyAlgorithm.js:82-85` |

**Expected Behaviors (Day 5):**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment 3: indices 240-319 | Week 1, Day 5 | `src/utils/studyAlgorithm.js:149-150` |
| 2 | Total words introduced = 400 | 5 × 80 | `src/services/progressService.js:112-115` |

---

## Week 2

### Day 6 - Week 2 Begins

#### Action A6.1: Start Day 6 Session
**User Action:** Click "Start Today's Session"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Week number = 2 | `Math.ceil(6/5) === 2` | `src/utils/studyAlgorithm.js:123` |
| 2 | Day of week = 1 | `((6-1) % 5) + 1 === 1` | `src/utils/studyAlgorithm.js:124` |
| 3 | Divisor = 5 (Week 2+) | `divisor === studyDaysPerWeek` | `src/utils/studyAlgorithm.js:140` |
| 4 | Projected total = 720 | 400 + (4 × 80) | `src/utils/studyAlgorithm.js:136-137` |
| 5 | Segment size = 144 | `720 / 5 = 144` | `src/utils/studyAlgorithm.js:143-144` |
| 6 | Segment 0: indices 0-143 | Week 2, Day 1 | `src/utils/studyAlgorithm.js:149-150` |
| 7 | Many segment words already MASTERED | From Day 2 graduation | Skip in review queue |

#### Action A6.2: Review Contains MASTERED Words
**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment 0-143 fetched | All statuses | `src/services/studyService.js:464-504` |
| 2 | MASTERED words excluded from queue | Status filter | `src/services/studyService.js:487-489` |
| 3 | Only PASSED/FAILED/NEEDS_CHECK in queue | Filtered array | `src/services/studyService.js:491-495` |

---

## Week 4 (Day 21) - First Mastered Words Return

### Action A21.1: Start Session
**User Action:** Start Day 21 session

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `returnMasteredWords()` finds expired words | `returnAt <= now` | `src/services/studyService.js:803-829` |
| 2 | Day 2 graduated words return | 21 days elapsed | `src/services/studyService.js:815-817` |
| 3 | Status changes MASTERED → NEEDS_CHECK | Batch update | `src/services/studyService.js:820-824` |
| 4 | `masteredAt` and `returnAt` cleared | Set to null | `src/services/studyService.js:822-823` |
| 5 | Returned words appear in review queue | NEEDS_CHECK included | `src/services/studyService.js:487-489` |

---

# PROFILE B: Average Student (Bailey)

## Week 1

### Day 1 - First Session

#### Action B1.1-B1.3: Same as Profile A
**Expected:** Identical behavior to Profile A through new words study

#### Action B1.4: Take New Word Test (Score: 78%)
**User Action:** Complete 10-question MCQ test, get 7.8/10 (78%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Score = 78% < 95% threshold | `score < passThreshold` | `src/pages/MCQTest.jsx:239-241` |
| 2 | "Retake" button appears | `canRetake === true` | `src/pages/MCQTest.jsx:243-245` |
| 3 | ~2 words → FAILED status | `processTestResults()` | `src/services/studyService.js:249-254` |
| 4 | Test attempt saved (fail) | `submitTestAttempt()` | `src/services/db.js:1313-1379` |

#### Action B1.5: Retake Test (Score: 96%)
**User Action:** Click "Retake", score 96%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Words reshuffled before retake | `selectTestWords()` called | `src/pages/MCQTest.jsx:430-433` |
| 2 | Question order different from first attempt | Shuffle verification | `src/pages/MCQTest.jsx:433` |
| 3 | Score = 96% ≥ 95% threshold | `score >= passThreshold` | `src/pages/MCQTest.jsx:239-241` |
| 4 | Second attempt saved | `submitTestAttempt()` | `src/services/db.js:1313-1379` |
| 5 | Status updates override previous | FAILED → PASSED possible | `src/services/studyService.js:228-264` |

#### Action B1.6: Complete Day 1
**Expected:** Same as Profile A Day 1 completion

---

### Day 2 - With Dismiss Feature

#### Action B2.1-B2.2: Start and Study New Words
**User Action:** Dismiss 5 words during new word study

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Click checkmark → word dismissed | `handleNewWordKnowThis()` | `src/pages/DailySessionFlow.jsx:612-626` |
| 2 | Word added to `newWordsDismissed` Set | State update | `src/pages/DailySessionFlow.jsx:615` |
| 3 | Word data stored in `dismissedWordsData` | Full word object | `src/pages/DailySessionFlow.jsx:616` |
| 4 | Word removed from queue | Filter operation | `src/pages/DailySessionFlow.jsx:617` |
| 5 | Dismissed count badge shows "5" | `dismissedCount === 5` | `src/pages/DailySessionFlow.jsx:769-780` |
| 6 | Progress still counts dismissed | Counter increments | `src/pages/DailySessionFlow.jsx:620-625` |

#### Action B2.3: Open Dismissed Drawer, Restore 2 Words
**User Action:** Click drawer toggle, restore 2 words

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Drawer slides in from right | Animation | `src/components/DismissedWordsDrawer.jsx:31-32` |
| 2 | Shows 5 dismissed words with definitions | List render | `src/components/DismissedWordsDrawer.jsx:71-93` |
| 3 | Click "Restore" on word | `onRestore(word.id, word.phase)` | `src/components/DismissedWordsDrawer.jsx:86` |
| 4 | Word removed from dismissed set | `handleUndoDismiss()` | `src/pages/DailySessionFlow.jsx:665-688` |
| 5 | Word added back to queue end | `setNewWordsQueue(prev => [...prev, wordData])` | `src/pages/DailySessionFlow.jsx:673` |
| 6 | Drawer count updates to 3 | Re-render | `src/components/DismissedWordsDrawer.jsx:37` |

#### Action B2.4: Take Test with 75% Score
**User Action:** Score 75%, need retake, pass with 95%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | First attempt: 75% < 95% | Retake required | `src/pages/MCQTest.jsx:239-241` |
| 2 | Retake: words reshuffled | `selectTestWords()` | `src/pages/MCQTest.jsx:430-433` |
| 3 | Pass on retake | `score >= 0.95` | `src/pages/MCQTest.jsx:239-241` |

#### Action B2.5: Review Test (Score: 72%)
**User Action:** Complete review test with 72% score

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Test size = 30 (intervention still 0) | `calculateReviewTestSize(0)` | `src/utils/studyAlgorithm.js:231-241` |
| 2 | `graduateSegmentWords(score: 0.72)` called | 72% of PASSED graduate | `src/pages/DailySessionFlow.jsx:997-1008` |
| 3 | ~58 of 80 PASSED → MASTERED | `0.72 × 80 = 57.6` | `src/services/studyService.js:762-766` |

---

### Day 3-4 - Intervention Begins

#### Action B3.1: Start Day 3 Session
**User Action:** Start session (last 3 scores: 96%, 72%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average of last 3 = 84% | `(96 + 72) / 2` | `src/utils/studyAlgorithm.js:73-77` |
| 2 | 84% > 75% → Intervention = 0% | Above threshold | `src/utils/studyAlgorithm.js:82-85` |

#### Action B4.1: Day 4 (After Day 3 score: 68%)
**User Action:** Start Day 4 (scores: 96%, 72%, 68%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average of last 3 = 78.67% | `(96 + 72 + 68) / 3` | `src/utils/studyAlgorithm.js:73-77` |
| 2 | 78.67% > 75% → Intervention = 0% | Still above threshold | `src/utils/studyAlgorithm.js:82-85` |

#### Action B5.1: Day 5 (After Day 4 score: 65%)
**User Action:** Start Day 5 (scores: 72%, 68%, 65%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average of last 3 = 68.33% | `(72 + 68 + 65) / 3` | `src/utils/studyAlgorithm.js:73-77` |
| 2 | 68.33% < 75% → Intervention starts | Below threshold | `src/utils/studyAlgorithm.js:82-85` |
| 3 | Intervention = ~15% | `(75 - 68.33) / (75 - 30)` | `src/utils/studyAlgorithm.js:86-88` |
| 4 | Adjusted pace = 68 | `80 × (1 - 0.15) = 68` | `src/services/studyService.js:70-73` |
| 5 | Review test size = 35 | `30 + 30 × 0.15 = 34.5` | `src/utils/studyAlgorithm.js:237-238` |

---

# PROFILE C: Struggling Student (Casey)

## Week 1

### Day 1 - First Session

#### Action C1.1-C1.3: Same as Profile A
**Expected:** Identical through new words study

#### Action C1.4: Take New Word Test (Score: 55%)
**User Action:** Complete test with 55% score

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Score = 55% << 95% threshold | Retake required | `src/pages/MCQTest.jsx:239-241` |
| 2 | ~5 words → FAILED status | `processTestResults()` | `src/services/studyService.js:249-254` |
| 3 | Retake button enabled | `canRetake === true` | `src/pages/MCQTest.jsx:243-245` |

#### Action C1.5: Multiple Retakes
**User Action:** Retake 1 (60%), Retake 2 (72%), Retake 3 (88%), Retake 4 (95%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Each retake reshuffles words | `selectTestWords()` | `src/pages/MCQTest.jsx:430-433` |
| 2 | Each attempt saved separately | Multiple Firestore writes | `src/services/db.js:1313-1379` |
| 3 | Status updates accumulate | PASSED/FAILED states | `src/services/studyService.js:228-264` |
| 4 | Final pass allows progression | `score >= 0.95` | `src/pages/MCQTest.jsx:239-241` |

---

### Day 2 - Heavy Dismiss Usage

#### Action C2.1: Dismiss 20 Words
**User Action:** Dismiss 20 words during study (feeling overwhelmed)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Each dismiss adds to `dismissedWordsData` | State accumulation | `src/pages/DailySessionFlow.jsx:616` |
| 2 | Badge shows 20 | `dismissedCount === 20` | `src/pages/DailySessionFlow.jsx:769-780` |
| 3 | Progress shows 80 complete (60 studied + 20 dismissed) | Counter logic | `src/pages/DailySessionFlow.jsx:620-625` |

#### Action C2.2: Restore All Dismissed
**User Action:** Click "Restore All" in drawer

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `handleRestoreAllDismissed()` called | Batch restore | `src/pages/DailySessionFlow.jsx:690-710` |
| 2 | All 20 words added back to queue | Queue concatenation | `src/pages/DailySessionFlow.jsx:698-701` |
| 3 | `dismissedWordsData` cleared | `setDismissedWordsData([])` | `src/pages/DailySessionFlow.jsx:707` |
| 4 | Dismissed sets cleared | Both phases | `src/pages/DailySessionFlow.jsx:703-706` |
| 5 | Drawer count shows 0 | Re-render | `src/components/DismissedWordsDrawer.jsx:37` |

#### Action C2.3: Review Test (Score: 52%)
**User Action:** Complete review test with 52% score

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `graduateSegmentWords(score: 0.52)` | 52% graduation | `src/pages/DailySessionFlow.jsx:997-1008` |
| 2 | Only ~42 of 80 graduate | `Math.floor(80 × 0.52) = 41` | `src/services/studyService.js:762-766` |
| 3 | ~38 FAILED words stay in pool | Safety net | `src/services/studyService.js:757` |

---

### Day 3-5 - High Intervention Mode

#### Action C3.1: Start Day 3 (Heavy Intervention)
**User Action:** Start Day 3 (scores: 60%, 52%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average = 56% | `(60 + 52) / 2` | `src/utils/studyAlgorithm.js:73-77` |
| 2 | 56% < 75% → Intervention = 42% | `(75 - 56) / (75 - 30)` | `src/utils/studyAlgorithm.js:86-88` |
| 3 | Adjusted pace = 46 | `80 × (1 - 0.42) = 46.4` | `src/services/studyService.js:70-73` |
| 4 | Review test size = 43 | `30 + 30 × 0.42 = 42.6` | `src/utils/studyAlgorithm.js:237-238` |

#### Action C5.1: Day 5 (Maximum Intervention)
**User Action:** Start Day 5 (scores: 48%, 45%, 42%)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average = 45% | `(48 + 45 + 42) / 3` | `src/utils/studyAlgorithm.js:73-77` |
| 2 | 45% < 30% → Intervention = 100% | `interventionLevel = 1.0` | `src/utils/studyAlgorithm.js:83` |
| 3 | Wait, 45% > 30%, so: | Recalculate | `src/utils/studyAlgorithm.js:86-88` |
| 4 | Intervention = 67% | `(75 - 45) / (75 - 30) = 0.67` | `src/utils/studyAlgorithm.js:86-88` |
| 5 | Adjusted pace = 26 | `80 × (1 - 0.67) = 26.4` | `src/services/studyService.js:70-73` |
| 6 | Review test size = 50 | `30 + 30 × 0.67 = 50.1` | `src/utils/studyAlgorithm.js:237-238` |

#### Action C5.2: Segment Still Covers All Prior Words
**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment boundaries use projected total | Intervention doesn't shrink segment | `src/utils/studyAlgorithm.js:136-137` |
| 2 | Fewer new words, but same review coverage | Design intent | `src/utils/studyAlgorithm.js:143-144` |
| 3 | More FAILED words in segment | Lower accuracy | `src/services/studyService.js:491-495` |
| 4 | FAILED words prioritized in queue | Sort order | `src/services/studyService.js:491-495` |

---

## Week 2 - Recovery Pattern

### Day 6: Casey Improves (Score: 78%)
**User Action:** Study harder, score 78% on review test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Last 3 scores: 45%, 42%, 78% | Rolling window | `src/utils/studyAlgorithm.js:73-77` |
| 2 | Average = 55% | Improving | `src/utils/studyAlgorithm.js:73-77` |
| 3 | Intervention = 44% | `(75 - 55) / 45` | `src/utils/studyAlgorithm.js:86-88` |
| 4 | Higher graduation rate | 78% of PASSED | `src/pages/DailySessionFlow.jsx:997-1008` |

### Day 8: Full Recovery (Score: 82%)
**User Action:** Consistent improvement

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Last 3 scores: 78%, 80%, 82% | Above threshold | `src/utils/studyAlgorithm.js:73-77` |
| 2 | Average = 80% > 75% | Recovery complete | `src/utils/studyAlgorithm.js:82-85` |
| 3 | Intervention = 0% | Back to normal | `src/utils/studyAlgorithm.js:82-85` |
| 4 | Pace restored to 80 | Full pace | `src/services/studyService.js:70-73` |

---

# Edge Case Scenarios

---

## Category 1: Session Interruption & Recovery

### Scenario E1: Browser Refresh Mid-Session

**User Action:** Refresh browser during NEW_WORDS phase

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Session state loaded from Firestore | `fetchSessionState()` | `src/services/db.js:2402-2450` |
| 2 | Phase restored from saved state | `sessionState.currentPhase` | `src/pages/DailySessionFlow.jsx:443-470` |
| 3 | Progress counters restored | `newWordsStudied`, etc. | `src/pages/DailySessionFlow.jsx:455-465` |
| 4 | Dismissed words restored | `dismissedIds` arrays | `src/pages/DailySessionFlow.jsx:460-462` |
| 5 | Resume from where user left off | Seamless continuation | Visual verification |

## Scenario E2: Network Disconnect During Test

**User Action:** Lose connection during test submission

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Test state saved to localStorage | `saveTestToStorage()` | `src/utils/testRecovery.js:45-68` |
| 2 | Recovery window: 3 minutes | `RECOVERY_WINDOW_MS` | `src/utils/testRecovery.js:8` |
| 3 | On reconnect, attempt saved to Firestore | Retry logic | Error handling |

## Scenario E3: Complete Day Without Review (Day 1)

**User Action:** Complete Day 1 session

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment = null | Day 1 check | `src/utils/studyAlgorithm.js:128-130` |
| 2 | Skip REVIEW_STUDY phase | Direct to complete | `src/pages/DailySessionFlow.jsx:907-912` |
| 3 | Skip REVIEW_TEST phase | Direct to complete | `src/pages/DailySessionFlow.jsx:913-918` |
| 4 | No graduation call | No segment | `src/pages/DailySessionFlow.jsx:997-1008` |
| 5 | Day still advances | `updateClassProgress()` | `src/services/progressService.js:91-134` |

## Scenario E4: All Words Dismissed

**User Action:** Dismiss all 80 new words

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Queue becomes empty | `newWordsQueue.length === 0` | `src/pages/DailySessionFlow.jsx:718-735` |
| 2 | "Take Test" button appears | Empty queue check | `src/pages/DailySessionFlow.jsx:718-735` |
| 3 | Test generates from original words | Not dismissed subset | `src/pages/MCQTest.jsx:104-108` |
| 4 | Dismissed words can be restored | Drawer still available | `src/components/DismissedWordsDrawer.jsx` |

## Scenario E5: 100% Test Score

**User Action:** Score 100% on review test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `graduateSegmentWords(score: 1.0)` | Full graduation | `src/pages/DailySessionFlow.jsx:997-1008` |
| 2 | All PASSED words graduate | 100% of PASSED | `src/services/studyService.js:762-766` |
| 3 | Only FAILED words remain | Safety net intact | `src/services/studyService.js:757` |

## Scenario E6: 0% Test Score

**User Action:** Score 0% on review test (all wrong)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `graduateSegmentWords(score: 0.0)` | Zero graduation | `src/pages/DailySessionFlow.jsx:997-1008` |
| 2 | `Math.floor(n × 0) = 0` | No words graduate | `src/services/studyService.js:762-766` |
| 3 | All words stay for more practice | Design intent | `src/services/studyService.js:762-766` |

## Scenario E7: Duplicate Day Completion Attempt

**User Action:** Try to complete same day twice (e.g., browser back button)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Guard checks dayNumber match | `dayNumber !== expectedNextDay` | `src/services/progressService.js:98-103` |
| 2 | Throws error if mismatch | Duplicate prevention | `src/services/progressService.js:100-102` |
| 3 | Day does NOT advance again | Single increment | `src/services/progressService.js:98-103` |

---

# Verification Checklist Summary

## Core Flow (All Profiles)
- [ ] Dashboard shows correct day number
- [ ] Session initialization calculates correct intervention
- [ ] Daily pace adjusted based on intervention
- [ ] Segment boundaries correct for week/day
- [ ] New words study increments NEVER_TESTED status
- [ ] Test reshuffles on retake
- [ ] Pass threshold enforces 95%
- [ ] Review queue prioritizes FAILED words
- [ ] Graduation percentage matches test score
- [ ] Day advances only once per completion
- [ ] MASTERED words return after 21 days

## Dismissed Words Feature
- [ ] Dismiss adds to dismissedWordsData
- [ ] Badge count updates correctly
- [ ] Drawer displays all dismissed words
- [ ] Individual restore works
- [ ] Restore All clears everything
- [ ] Drawer hidden during test phases

## Intervention System
- [ ] Uses last 3 review scores only
- [ ] 75%+ average = 0% intervention
- [ ] 30%- average = 100% intervention
- [ ] Linear scale between thresholds
- [ ] Pace reduction matches intervention
- [ ] Review test size increases with intervention

## Graduation System
- [ ] Only PASSED words can graduate
- [ ] FAILED words never graduate
- [ ] Graduation rate = test score percentage
- [ ] masteredAt timestamp set correctly
- [ ] returnAt = masteredAt + 21 days
- [ ] MASTERED → NEEDS_CHECK after return
- [ ] NEEDS_CHECK words appear in review

## Error Handling
- [ ] Session recovery on refresh
- [ ] Test recovery from localStorage
- [ ] Duplicate day completion blocked
- [ ] Empty queue handled gracefully

---

# Extended Edge Cases & Realistic Scenarios

---

## Category 2: Mid-Session Abandonment

### Scenario E8: Quit During New Words Study (Partial Progress)

**User Action:** Study 35 of 80 words, then click back/quit button

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Quit confirmation modal appears | `ConfirmModal` with variant="danger" | `src/pages/DailySessionFlow.jsx:1095-1115` |
| 2 | Session state saved to Firestore before quit | `saveSessionState()` called | `src/services/db.js:2360-2400` |
| 3 | 35 words marked NEVER_TESTED | Status updates persisted | `src/services/studyService.js:179-195` |
| 4 | `newWordsStudied: 35` saved in session state | Partial progress saved | `src/services/db.js:2380-2385` |
| 5 | Return to Dashboard | Navigation occurs | `src/pages/DailySessionFlow.jsx:1112` |
| 6 | Next session resumes from word 36 | Session recovery | `src/pages/DailySessionFlow.jsx:443-470` |

### Scenario E9: Close Browser Tab Mid-Test

**User Action:** Close browser tab at question 5 of 10 on new word test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Test state saved to localStorage | `saveTestToStorage()` on each answer | `src/utils/testRecovery.js:45-68` |
| 2 | Recovery data includes: wordIds, answers, currentIndex | Full state snapshot | `src/utils/testRecovery.js:50-60` |
| 3 | Recovery window = 3 minutes | `RECOVERY_WINDOW_MS = 180000` | `src/utils/testRecovery.js:8` |
| 4 | On return within 3 min: "Resume Test?" prompt | Recovery modal | `src/pages/MCQTest.jsx:85-95` |
| 5 | Resume restores exact position (question 5) | `currentIndex` restored | `src/pages/MCQTest.jsx:90-92` |
| 6 | Previous answers preserved | `answers` object restored | `src/pages/MCQTest.jsx:91` |

### Scenario E10: Return After 5 Minutes (Recovery Expired)

**User Action:** Close tab, return after 5 minutes

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `getRecoverableTest()` returns null | Expired check | `src/utils/testRecovery.js:75-85` |
| 2 | No recovery prompt shown | Fresh test start | `src/pages/MCQTest.jsx:85-95` |
| 3 | Test generates fresh set of questions | New word selection | `src/pages/MCQTest.jsx:104-108` |
| 4 | Previous partial progress lost | Expected behavior | Design decision |

### Scenario E11: Phone Call Interrupts Session (iOS/Android)

**User Action:** Receive phone call during review study phase

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | App goes to background | OS behavior | N/A |
| 2 | Session state persists in React state | No explicit save | Component state |
| 3 | On return: still on same card | State preserved | React lifecycle |
| 4 | Progress counter unchanged | Consistent state | `src/pages/DailySessionFlow.jsx:634-640` |
| 5 | If killed by OS: recovery from Firestore | `fetchSessionState()` | `src/services/db.js:2402-2450` |

---

## Category 3: Test Behavior Edge Cases

### Scenario E12: Pass Threshold Exactly (95.0%)

**User Action:** Score exactly 9.5/10 (95%) on new word test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `score === passThreshold` evaluates true | `>=` comparison | `src/pages/MCQTest.jsx:239-241` |
| 2 | Test passes (no retake required) | `canRetake === false` | `src/pages/MCQTest.jsx:243` |
| 3 | Proceed to next phase | Navigation triggered | `src/pages/MCQTest.jsx:260-270` |

### Scenario E13: Score 94.9% (Just Below Threshold)

**User Action:** Score 9.49/10 (94.9%) - e.g., 19/20 questions

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `score < passThreshold` | Threshold check | `src/pages/MCQTest.jsx:239-241` |
| 2 | Retake button appears | `canRetake === true` | `src/pages/MCQTest.jsx:243-245` |
| 3 | "You need 95% to pass" message | UI feedback | `src/pages/MCQTest.jsx:315-325` |

### Scenario E14: Multiple Consecutive Retakes (5+)

**User Action:** Fail new word test 5 times in a row

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Each retake reshuffles word order | `selectTestWords()` called | `src/pages/MCQTest.jsx:430-433` |
| 2 | Each attempt saved to Firestore | Multiple `submitTestAttempt()` | `src/services/db.js:1313-1379` |
| 3 | No limit on retake attempts | Design decision | Infinite retakes allowed |
| 4 | Status updates accumulate | PASSED/FAILED changes | `src/services/studyService.js:228-264` |
| 5 | User can keep retaking until pass | UX flow | `src/pages/MCQTest.jsx:400-410` |

### Scenario E15: Answer Then Change Answer

**User Action:** Select option A, then change to option B before submitting

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | First selection highlighted | Visual feedback | `src/pages/MCQTest.jsx:180-195` |
| 2 | Second selection replaces first | `setAnswers()` overwrites | `src/pages/MCQTest.jsx:195-200` |
| 3 | Only final answer counted | Single value per question | `src/pages/MCQTest.jsx:195-200` |
| 4 | No penalty for changing | Design decision | N/A |

### Scenario E16: Navigate Away from Test Without Submitting

**User Action:** Click browser back button during test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Browser navigation intercepted? | Check `beforeunload` | Need to verify |
| 2 | Test state saved to localStorage | Recovery possible | `src/utils/testRecovery.js:45-68` |
| 3 | On return: recovery prompt within 3 min | Resume option | `src/pages/MCQTest.jsx:85-95` |

### Scenario E17: Submit Test with Unanswered Questions

**User Action:** Answer 8 of 10 questions, click Submit

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Submit button disabled if incomplete? | Check validation | `src/pages/MCQTest.jsx:350-360` |
| 2 | OR: Unanswered = incorrect | Score calculation | `src/pages/MCQTest.jsx:220-230` |
| 3 | Score = 8/10 max (if unanswered = wrong) | Denominator = total | `src/pages/MCQTest.jsx:225` |

---

## Category 4: Dismiss Feature Edge Cases

### Scenario E18: Dismiss Word During Review Phase

**User Action:** Click checkmark on word during REVIEW_STUDY phase

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Word added to `reviewDismissed` Set | State update | `src/pages/DailySessionFlow.jsx:628-642` |
| 2 | Word data added to `dismissedWordsData` | Full object stored | `src/pages/DailySessionFlow.jsx:630` |
| 3 | Word removed from review queue | Filter applied | `src/pages/DailySessionFlow.jsx:631` |
| 4 | Phase recorded as 'review' | For restore routing | `src/pages/DailySessionFlow.jsx:630` |
| 5 | Drawer shows word with "Review" phase tag | Visual distinction | `src/components/DismissedWordsDrawer.jsx:78-83` |

### Scenario E19: Dismiss All Words Then Take Test

**User Action:** Dismiss all 80 new words, then click "Take Test"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Queue becomes empty | `newWordsQueue.length === 0` | `src/pages/DailySessionFlow.jsx:718-735` |
| 2 | "Take Test" button appears | Empty queue trigger | `src/pages/DailySessionFlow.jsx:718-735` |
| 3 | Test generates from original words (not dismissed) | `originalWords` used | `src/pages/MCQTest.jsx:104-108` |
| 4 | All 80 words remain test-eligible | Dismiss != skip test | Design decision |

### Scenario E20: Dismiss, Restore, Dismiss Same Word

**User Action:** Dismiss word A, restore it, dismiss it again

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | First dismiss: added to dismissed set | State update | `src/pages/DailySessionFlow.jsx:612-626` |
| 2 | Restore: removed from set, added to queue end | `handleUndoDismiss()` | `src/pages/DailySessionFlow.jsx:665-688` |
| 3 | Second dismiss: added back to set | State update | `src/pages/DailySessionFlow.jsx:612-626` |
| 4 | Word appears in drawer again | Re-added | `src/components/DismissedWordsDrawer.jsx:71-93` |
| 5 | Progress counter behavior? | Check if counts twice | `src/pages/DailySessionFlow.jsx:620-625` |

### Scenario E21: Restore Word After Queue Empty

**User Action:** Dismiss all words, drawer shows "Take Test", then restore 1 word

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Restored word added to queue | `setNewWordsQueue([...prev, wordData])` | `src/pages/DailySessionFlow.jsx:673` |
| 2 | Queue no longer empty | `length === 1` | State change |
| 3 | Flashcard UI reappears | Phase re-renders | `src/pages/DailySessionFlow.jsx:718-735` |
| 4 | Can continue studying | Normal flow | UX behavior |

### Scenario E22: Dismiss Word That Was Previously FAILED

**User Action:** Word has status FAILED from yesterday, dismiss it today

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Word removed from review queue | Filter applied | `src/pages/DailySessionFlow.jsx:631` |
| 2 | Status in Firestore unchanged | FAILED remains | No status update on dismiss |
| 3 | Word appears in drawer | Full data stored | `src/components/DismissedWordsDrawer.jsx` |
| 4 | On restore: still FAILED status | Status preserved | `src/pages/DailySessionFlow.jsx:665-688` |

---

## Category 5: Segment & Week Transition Edge Cases

### Scenario E23: Week 1 Day 5 to Week 2 Day 6 Transition

**User Action:** Complete Day 5 session, start Day 6 session

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Day 5: `weekNumber = 1, dayOfWeek = 5` | `Math.ceil(5/5) = 1` | `src/utils/studyAlgorithm.js:123-124` |
| 2 | Day 5: Segment 3 (indices 240-319) | Week 1 last segment | `src/utils/studyAlgorithm.js:149-150` |
| 3 | Day 6: `weekNumber = 2, dayOfWeek = 1` | `Math.ceil(6/5) = 2` | `src/utils/studyAlgorithm.js:123-124` |
| 4 | Day 6: Divisor changes 4 → 5 | Week 2 uses n | `src/utils/studyAlgorithm.js:140` |
| 5 | Day 6: Segment size = 144 (720/5) | Larger segments | `src/utils/studyAlgorithm.js:143-144` |
| 6 | Day 6: Segment 0 (indices 0-143) | Rotation restarts | `src/utils/studyAlgorithm.js:149-150` |

### Scenario E24: List With Fewer Words Than Pace

**User Action:** Assign list with 50 words, pace = 80

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Day 1: Only 50 words available | `newWords.length = 50` | `src/services/studyService.js:95-100` |
| 2 | Day 2: No new words (list exhausted) | `newWords.length = 0` | `src/services/studyService.js:95-100` |
| 3 | Segment calculation uses actual `totalWordsIntroduced` | 50, not 80 | `src/utils/studyAlgorithm.js:136-137` |
| 4 | Student goes to review-only mode | No NEW_WORDS phase? | Check flow logic |

### Scenario E25: List Completion (All Words Introduced)

**User Action:** 1000-word list, Day 13 (1000 / 80 ≈ 12.5 days)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Day 12: Last 40 words introduced | Remaining words | `src/services/studyService.js:95-100` |
| 2 | Day 13: No new words | Empty new words array | `src/services/studyService.js:95-100` |
| 3 | Session still runs | Review phases only | `src/pages/DailySessionFlow.jsx:907-918` |
| 4 | Skip NEW_WORDS phase | Empty array check | `src/pages/DailySessionFlow.jsx:553-560` |
| 5 | Go directly to REVIEW_STUDY | Phase transition | Check implementation |

### Scenario E26: Very Small Segment (3 Words)

**User Action:** Early in Week 1, segment has only 3 words

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Graduation with 85% score | `Math.floor(3 × 0.85) = 2` | `src/services/studyService.js:762-766` |
| 2 | Only 2 words graduate (conservative) | Floor vs round | `src/services/studyService.js:763` |
| 3 | 1 word remains in pool | Remaining count | `src/services/studyService.js:791` |

### Scenario E27: Segment With All MASTERED Words

**User Action:** All segment words graduated in previous sessions

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Segment fetched normally | All statuses returned | `src/services/studyService.js:751` |
| 2 | Filter to PASSED = empty array | No PASSED words | `src/services/studyService.js:754` |
| 3 | `graduateSegmentWords` returns `{ graduated: 0, remaining: 0 }` | Early return | `src/services/studyService.js:756-758` |
| 4 | Review queue may still have MASTERED words visible? | Check queue filter | `src/services/studyService.js:487-489` |

### Scenario E28: Segment With All FAILED Words

**User Action:** Student failed all segment words previously

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | All words in review queue | FAILED included | `src/services/studyService.js:487-489` |
| 2 | FAILED words prioritized first | Sort order | `src/services/studyService.js:491-495` |
| 3 | No graduation possible | 0 PASSED words | `src/services/studyService.js:756-758` |
| 4 | All stay for more practice | Safety net working | Design intent |

---

## Category 6: Intervention System Edge Cases

### Scenario E29: First 3 Days (Insufficient Data)

**User Action:** Day 2 session (only 1 previous score)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `lastThreeScores.length < 3` | Insufficient data | `src/utils/studyAlgorithm.js:73-77` |
| 2 | Average calculated from available scores | 1-2 scores used | `src/utils/studyAlgorithm.js:76-77` |
| 3 | Intervention still calculated normally | Same formula | `src/utils/studyAlgorithm.js:82-88` |

### Scenario E30: Score Exactly 75% (Threshold Boundary)

**User Action:** Score exactly 75% on review test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average = 75% | Threshold value | Calculation |
| 2 | `average >= HIGH_THRESHOLD` | `>=` comparison | `src/utils/studyAlgorithm.js:82` |
| 3 | Intervention = 0% | At threshold = no intervention | `src/utils/studyAlgorithm.js:82` |

### Scenario E31: Score Exactly 30% (Min Threshold)

**User Action:** Score exactly 30% on review test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Average = 30% | Min threshold | Calculation |
| 2 | `average <= LOW_THRESHOLD` | `<=` comparison | `src/utils/studyAlgorithm.js:83` |
| 3 | Intervention = 100% | Maximum intervention | `src/utils/studyAlgorithm.js:83` |
| 4 | Pace = 0 words | `80 × (1 - 1.0) = 0` | `src/services/studyService.js:70-73` |
| 5 | Session becomes review-only | No new words | Check behavior |

### Scenario E32: Score Below 30% (Below Min Threshold)

**User Action:** Score 20% on review test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `average < LOW_THRESHOLD` | Below 30% | Calculation |
| 2 | Intervention capped at 100% | Max clamp | `src/utils/studyAlgorithm.js:83` |
| 3 | Same as 30% behavior | No negative pace | `src/services/studyService.js:70-73` |

### Scenario E33: Recovery From Max Intervention

**User Action:** Was at 100% intervention (30% scores), now scores 80%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | New average = (30 + 30 + 80) / 3 = 46.67% | Rolling window | `src/utils/studyAlgorithm.js:73-77` |
| 2 | Still below 75% threshold | 46.67 < 75 | Comparison |
| 3 | Intervention = (75 - 46.67) / 45 = 63% | Linear scale | `src/utils/studyAlgorithm.js:86-88` |
| 4 | Pace = 80 × 0.37 = 30 words | Reduced but not zero | `src/services/studyService.js:70-73` |
| 5 | Gradual recovery | Not instant | Design intent |

---

## Category 7: NEEDS_CHECK Status Edge Cases

### Scenario E34: NEEDS_CHECK Word Appears in Test

**User Action:** Day 22 - Word returned from MASTERED, now in test

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Word has status NEEDS_CHECK | After 21-day return | `src/services/studyService.js:820-824` |
| 2 | Word included in review queue | NEEDS_CHECK not filtered out | `src/services/studyService.js:487-489` |
| 3 | If answered correctly: status → PASSED | `processTestResults()` | `src/services/studyService.js:243-248` |
| 4 | If answered incorrectly: status → FAILED | `processTestResults()` | `src/services/studyService.js:249-254` |
| 5 | Eligible for graduation if PASSED | Same as other PASSED words | `src/services/studyService.js:754` |

### Scenario E35: Multiple NEEDS_CHECK Words in Same Session

**User Action:** 10 words all returned on Day 22 (all mastered on Day 1)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `returnMasteredWords()` returns 10 | Batch update | `src/services/studyService.js:827` |
| 2 | All 10 appear in review queue | NEEDS_CHECK included | `src/services/studyService.js:487-489` |
| 3 | Larger review session | More words to review | UX impact |

### Scenario E36: NEEDS_CHECK Word Dismissed

**User Action:** Dismiss a NEEDS_CHECK word during review

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Word removed from queue | Normal dismiss | `src/pages/DailySessionFlow.jsx:631` |
| 2 | Status unchanged in Firestore | Still NEEDS_CHECK | No status write |
| 3 | Next session: word reappears | Still needs verification | Queue rebuild |

---

## Category 8: Progress & Day Advancement Edge Cases

### Scenario E37: Double-Click Complete Button

**User Action:** Rapidly click "Complete" button twice

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | First click triggers `completeSession()` | Function called | `src/pages/DailySessionFlow.jsx:968-1040` |
| 2 | Button disabled after first click? | Check UI state | `src/pages/DailySessionFlow.jsx:1175-1220` |
| 3 | `updateClassProgress()` has guard | Day number check | `src/services/progressService.js:98-103` |
| 4 | Second call rejected | Duplicate prevention | `src/services/progressService.js:100-102` |
| 5 | Day advances exactly once | Atomic operation | Firebase transaction |

### Scenario E38: Firestore Write Fails During Completion

**User Action:** Network drops during session completion

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Firestore operation throws error | Network error | Firebase SDK |
| 2 | Error caught in try-catch? | Check error handling | `src/pages/DailySessionFlow.jsx:968-1040` |
| 3 | User shown error message | UI feedback | Check implementation |
| 4 | Progress NOT saved | Transaction rolled back | Firestore behavior |
| 5 | Can retry on reconnect? | Check retry logic | Need to verify |

### Scenario E39: Session State Desyncs from Firestore

**User Action:** Two browser tabs open, complete session in one

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Tab 1 completes session | Day advances | Normal flow |
| 2 | Tab 2 still shows in-progress | Stale state | No real-time sync |
| 3 | Tab 2 tries to complete | Duplicate attempt | `src/services/progressService.js:98-103` |
| 4 | Guard rejects duplicate | Day mismatch | `src/services/progressService.js:100-102` |
| 5 | Tab 2 needs refresh | Stale state issue | UX consideration |

---

## Category 9: Real-World Student Scenarios

### Scenario E40: Student Takes Week-Long Break

**User Action:** Complete Day 10, return after 7 days (Day 11)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Day number stays at 10 | No auto-advancement | Progress persisted |
| 2 | Next session = Day 11 | Continue sequence | Normal flow |
| 3 | Intervention uses last 3 scores | Not affected by break | `src/utils/studyAlgorithm.js:73-77` |
| 4 | MASTERED words may have returned | 21-day check | `src/services/studyService.js:803-829` |
| 5 | No penalty for break | Design decision | N/A |

### Scenario E41: Student Uses PDF Instead of App

**User Action:** Download PDF, study offline, return next day

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | PDF download tracked? | Check if logged | `src/utils/pdfGenerator.js` |
| 2 | App progress unchanged | No session completed | State unchanged |
| 3 | Same words shown next session | No advancement | Normal behavior |
| 4 | Student may feel duplicate | UX consideration | Documentation needed |

### Scenario E42: Student Completes Session Very Slowly (2+ Hours)

**User Action:** Start session, take 2+ hours with many breaks

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Session state persisted to Firestore | Periodic saves? | Check save triggers |
| 2 | Firebase auth token may expire | 1 hour default | Firebase SDK |
| 3 | On token refresh: session continues | Auth listener | `src/contexts/AuthContext.jsx` |
| 4 | Session completes normally | Time not a factor | Design decision |

### Scenario E43: Student Rapid-Fires Through Cards (< 1 second each)

**User Action:** Swipe through 80 cards in under 2 minutes

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | All cards marked NEVER_TESTED | Status updates | `src/services/studyService.js:179-195` |
| 2 | No minimum view time enforced | Design decision | Check implementation |
| 3 | Progress counter increments correctly | Fast state updates | `src/pages/DailySessionFlow.jsx:634-640` |
| 4 | "Take Test" appears after all cards | Queue empty | `src/pages/DailySessionFlow.jsx:718-735` |
| 5 | Batched Firestore writes? | Performance | Check batch logic |

### Scenario E44: Student on Slow Network (High Latency)

**User Action:** Complete session on 3G connection

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Loading states shown appropriately | Spinner visible | `src/pages/DailySessionFlow.jsx:285-290` |
| 2 | Firestore operations queue | Offline persistence | Firebase SDK |
| 3 | Status updates may lag | Async writes | Expected behavior |
| 4 | Session completes eventually | Persistence layer | Firebase offline |

### Scenario E45: Student Loses Internet Mid-Session, Regains Later

**User Action:** Network drops during study, returns 30 minutes later

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Firestore uses offline cache | Pending writes queue | Firebase SDK |
| 2 | React state preserved | In-memory | Component state |
| 3 | On reconnect: writes sync | Automatic | Firebase persistence |
| 4 | Session can continue | State intact | Normal flow |
| 5 | If app killed: recovery from Firestore | `fetchSessionState()` | `src/services/db.js:2402-2450` |

---

## Category 10: Assignment & Teacher Changes

### Scenario E46: Teacher Changes Pass Threshold Mid-Course

**User Action:** Teacher changes threshold from 95% to 85%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Assignment settings updated in Firestore | `updateAssignmentSettings()` | `src/services/db.js:2050-2100` |
| 2 | Next student session uses 85% | Read on session init | `src/services/studyService.js:54-128` |
| 3 | Previous attempts unaffected | Historical data | No retroactive change |
| 4 | Student may notice easier threshold | UX change | Expected |

### Scenario E47: Teacher Changes Daily Pace Mid-Course

**User Action:** Teacher reduces pace from 80 to 40 words/day

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Next session uses new pace | `assignment.dailyPace` | `src/services/studyService.js:63-65` |
| 2 | Segment calculation uses new pace | Projection changes | `src/utils/studyAlgorithm.js:136-137` |
| 3 | May create segment boundary oddities | Transition period | Edge case |
| 4 | Stabilizes after a few days | Self-correcting | Design decision |

### Scenario E48: Assignment Removed While Student in Session

**User Action:** Teacher removes assignment while student is studying

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Session continues locally | In-memory state | React state |
| 2 | Firestore writes may fail | Document deleted | Error handling |
| 3 | Session completion fails? | Check error handling | Need to verify |
| 4 | Dashboard shows no assignment | Next visit | Normal behavior |

### Scenario E49: Student Enrolled in Multiple Classes with Same List

**User Action:** Same list assigned by two different teachers

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Study states are per-user, per-list | `users/{userId}/study_states` | `src/services/db.js` |
| 2 | Progress shared across assignments? | Check data model | Need to verify |
| 3 | Or separate progress per assignment? | Check data model | Need to verify |
| 4 | Potential confusion | UX consideration | Documentation needed |

---

## Category 11: Audio & Accessibility Edge Cases

### Scenario E50: Audio Playback Button Clicked Multiple Times

**User Action:** Click audio button rapidly 5 times

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Audio plays once (debounced)? | Check implementation | `src/components/WordCard.jsx` |
| 2 | OR audio overlaps (bad UX)? | Multiple audio instances | Check implementation |
| 3 | Proper audio cleanup | `audio.pause()` on new play | Check implementation |

### Scenario E51: Screen Reader Navigation Through Flashcards

**User Action:** Navigate cards using screen reader

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Cards have proper ARIA labels | `aria-label` attributes | Check components |
| 2 | Definition announced | Screen reader text | Check accessibility |
| 3 | Swipe gestures have alternatives | Keyboard navigation | Check implementation |
| 4 | Progress announced | Live region? | Check accessibility |

---

## Category 12: Data Integrity Edge Cases

### Scenario E52: Word Has Corrupted Study State

**User Action:** Firestore document has invalid status value

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `normalizeStudyState()` applies defaults | Missing field handling | `src/services/db.js:1165-1200` |
| 2 | Invalid status defaults to 'NEW'? | Check default logic | `src/types/studyTypes.js:27-51` |
| 3 | App doesn't crash | Error boundaries | Check implementation |

### Scenario E53: Study State Document Missing Entirely

**User Action:** Word exists in list but no study_state document

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `normalizeStudyState()` creates defaults | Full default object | `src/services/db.js:1165-1200` |
| 2 | Word treated as NEW status | Default value | `src/types/studyTypes.js:27-51` |
| 3 | No error thrown | Graceful handling | Check implementation |

### Scenario E54: List Word Order Changed by Teacher

**User Action:** Teacher reorders words in list after students started

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `wordIndex` in study_state may mismatch | Stale index | Potential issue |
| 2 | Segment boundaries use `wordIndex` | May cause gaps | `src/utils/studyAlgorithm.js` |
| 3 | Some words may be missed | Edge case | Need to verify |

---

# Extended Verification Checklist

## Session Recovery
- [ ] Refresh during NEW_WORDS → resumes correct card
- [ ] Refresh during REVIEW_STUDY → resumes correct card
- [ ] Refresh during test → recovery prompt within 3 min
- [ ] Close tab during test → recovery prompt within 3 min
- [ ] Recovery after 3 min → fresh test start
- [ ] Phone call interrupt → state preserved on return

## Test Mechanics
- [ ] Exactly 95% → passes threshold
- [ ] 94.9% → requires retake
- [ ] Answer change → only final answer counts
- [ ] 5+ retakes → all allowed, each shuffled
- [ ] Submit with unanswered → handled correctly

## Dismiss Feature
- [ ] Dismiss during NEW_WORDS phase → correct set updated
- [ ] Dismiss during REVIEW_STUDY phase → correct set updated
- [ ] Dismiss all → can still take test
- [ ] Dismiss/restore/dismiss → works correctly
- [ ] Restore after queue empty → flashcard reappears
- [ ] Dismiss FAILED word → status unchanged

## Segment Transitions
- [ ] Week 1 → Week 2 divisor change
- [ ] Small list (< pace) → handled gracefully
- [ ] List completion → review-only mode
- [ ] All MASTERED segment → graduation returns 0
- [ ] All FAILED segment → no graduation possible

## Intervention Boundaries
- [ ] Days 1-2 → uses available scores
- [ ] Exactly 75% → 0% intervention
- [ ] Exactly 30% → 100% intervention
- [ ] Below 30% → capped at 100%
- [ ] Recovery from max → gradual reduction

## NEEDS_CHECK Lifecycle
- [ ] Returns after 21 days
- [ ] Appears in review queue
- [ ] Correct answer → PASSED
- [ ] Incorrect answer → FAILED
- [ ] Can be dismissed

## Progress Integrity
- [ ] Double-click complete → single increment
- [ ] Network fail during complete → handled
- [ ] Two tabs → duplicate prevented
- [ ] Week break → continues correctly
- [ ] Slow session (2+ hours) → completes normally

## Teacher Changes
- [ ] Pace change → takes effect next session
- [ ] Threshold change → takes effect next session
- [ ] Assignment removal → handled gracefully

## Data Edge Cases
- [ ] Corrupted study state → defaults applied
- [ ] Missing study state → created with defaults
- [ ] Invalid status value → normalized

---

# Additional Scenario Categories

---

## Category 13: TypedTest Specific Edge Cases

### Scenario E55: Typed Answer with Extra Spaces

**User Action:** Type "  hello  world  " (extra spaces) for answer "hello world"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Answer trimmed before comparison | `.trim()` applied | `src/pages/TypedTest.jsx:300-320` |
| 2 | Internal spaces normalized? | Check normalization | Need to verify |
| 3 | Match succeeds if content correct | Lenient matching | Check implementation |

### Scenario E56: Typed Answer with Wrong Capitalization

**User Action:** Type "HELLO" for answer "hello"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Case-insensitive comparison | `.toLowerCase()` | `src/pages/TypedTest.jsx:300-320` |
| 2 | "HELLO" matches "hello" | Correct behavior | Check implementation |

### Scenario E57: Typed Answer with Special Characters

**User Action:** Type "café" for answer "cafe" (or vice versa)

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Diacritics handling | Normalization? | Need to verify |
| 2 | May require exact match | Check implementation | `src/pages/TypedTest.jsx:300-320` |

### Scenario E58: Typed Answer Partially Correct

**User Action:** Type "helllo" (typo) for answer "hello"

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Typo tolerance? | Levenshtein distance? | Need to verify |
| 2 | OR exact match required | Strict comparison | Check implementation |
| 3 | Marked incorrect if strict | Status → FAILED | `src/services/studyService.js:249-254` |

### Scenario E59: TypedTest Retake Shuffles Words

**User Action:** Fail typed test, click retake

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Words reshuffled on retake | Already verified fixed | `src/pages/TypedTest.jsx:535-548` |
| 2 | Different word order | Random shuffle | Visual check |
| 3 | Same word pool | No new words added | Same `originalWords` |

### Scenario E60: Switch Between MCQ and Typed Mid-Course

**User Action:** Teacher changes review test type from MCQ to Typed

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Next review test is TypedTest | `reviewTestType === 'typed'` | `src/pages/DailySessionFlow.jsx:862-870` |
| 2 | Student sees typed input UI | Component switch | `src/pages/TypedTest.jsx` |
| 3 | Pass threshold unchanged | Same 95% | Assignment setting |

---

## Category 14: Challenge Feature Edge Cases

### Scenario E61: Accept Challenge on FAILED Word

**User Action:** Click "Challenge" on a word marked FAILED, get it correct

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Challenge modal/UI appears | Check UI | Need to verify location |
| 2 | Correct answer → status → PASSED | `reviewChallenge()` | `src/services/db.js:2544-2589` |
| 3 | May trigger day progression | Score crosses threshold | `src/services/db.js:2560-2585` |

### Scenario E62: Challenge Pushes Score Above Threshold

**User Action:** At 94%, challenge 1 word successfully → 95%

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Score recalculated | Include challenge result | `src/services/db.js:2560-2570` |
| 2 | If now ≥ 95% → day advances | Threshold crossed | `src/services/db.js:2575-2585` |
| 3 | Session completion triggered | Late progression | `src/services/db.js:2580-2585` |

### Scenario E63: Challenge on Already PASSED Word

**User Action:** Try to challenge a PASSED word

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Challenge button hidden/disabled? | UI check | Need to verify |
| 2 | No action if already PASSED | Guard condition | Check implementation |

---

## Category 15: PDF Generation Edge Cases

### Scenario E64: Generate PDF with 0 New Words (Review-Only Day)

**User Action:** Day 13, list exhausted, generate PDF

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `getTodaysBatchForPDF()` returns empty newWords | Empty array | `src/services/studyService.js` |
| 2 | PDF still generates with review words only | Partial content | `src/utils/pdfGenerator.js` |
| 3 | "New Words" section omitted or empty | Conditional render | `src/utils/pdfGenerator.js:180-220` |

### Scenario E65: Generate PDF with Very Long Definitions

**User Action:** List has definitions > 500 characters

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Text wraps in table cell | `columnStyles: { wrap }` | `src/utils/pdfGenerator.js:42-43` |
| 2 | Row doesn't split across pages | `rowPageBreak: 'avoid'` | `src/utils/pdfGenerator.js:44` |
| 3 | PDF renders correctly | Visual check | jsPDF behavior |

### Scenario E66: Generate PDF with Unicode/Emoji in Words

**User Action:** Word list contains emoji or special Unicode

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Font supports characters? | Check font embedding | `src/utils/pdfGenerator.js` |
| 2 | Characters render or show placeholder | Fallback behavior | jsPDF limitation |

---

## Category 16: Blind Spot Feature Edge Cases

### Scenario E67: Word Becomes Blind Spot (No Test in 21 Days)

**User Action:** Word was tested 22 days ago, not since

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Word counted in blind spot pool | `lastTestedAt` check | `src/services/studyService.js` |
| 2 | Dashboard shows blind spot count | `getBlindSpotCount()` | `src/pages/Dashboard.jsx:529` |
| 3 | Word prioritized in review queue? | Check queue building | `src/services/studyService.js:464-504` |

### Scenario E68: Blind Spot Word Gets Tested

**User Action:** Blind spot word appears in test, answered correctly

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | `lastTestedAt` updated | Timestamp write | `src/services/studyService.js:243-248` |
| 2 | Word no longer in blind spot pool | Threshold reset | Next count check |
| 3 | Blind spot count decreases | Dashboard update | `src/pages/Dashboard.jsx:529` |

---

## Category 17: Concurrency & Race Conditions

### Scenario E69: Rapid Answer Submission

**User Action:** Click submit, then click again before response

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Submit button disabled on first click | `disabled` state | Check implementation |
| 2 | Double submission prevented | Single Firestore write | Check guards |

### Scenario E70: Two Users Same Account Simultaneously

**User Action:** Account logged in on phone and laptop, both studying

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Last write wins | Firestore behavior | No locking |
| 2 | Progress may be inconsistent | Data race | Known limitation |
| 3 | Session state may conflict | Shared document | Edge case |

### Scenario E71: Firestore Rate Limiting

**User Action:** Very rapid card swiping triggers many writes

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Firestore may throttle | Rate limits | Firebase quotas |
| 2 | Writes queued or dropped? | Check behavior | Need to verify |
| 3 | Batch writes used? | Performance optimization | Check implementation |

---

## Category 18: Authentication Edge Cases

### Scenario E72: Token Expires Mid-Session

**User Action:** Auth token expires (1 hour default) during long session

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Firebase SDK auto-refreshes | Background refresh | Firebase Auth |
| 2 | Session continues uninterrupted | No re-auth required | Expected behavior |
| 3 | If refresh fails: error handling? | Check implementation | `src/contexts/AuthContext.jsx` |

### Scenario E73: User Logs Out in Another Tab

**User Action:** Log out in Tab 2 while studying in Tab 1

**Expected Behaviors:**
| # | Behavior | Verification | File Reference |
|---|----------|--------------|----------------|
| 1 | Auth state changes in Tab 1 | Firebase listener | `src/contexts/AuthContext.jsx` |
| 2 | Tab 1 redirected to login? | Auth guard | Check routing |
| 3 | Unsaved progress lost? | No async save | Potential issue |

---

# Items Requiring Code Verification

The following items are marked "Need to verify" and should be checked against actual code:

## High Priority (Potential Bugs)
- [ ] **E16**: Browser back button during test - is navigation intercepted?
- [ ] **E17**: Unanswered questions - submit disabled or treated as wrong?
- [ ] **E20**: Progress counter on dismiss/restore/dismiss - counts twice?
- [ ] **E24**: List < pace - does session skip NEW_WORDS phase?
- [ ] **E25**: List completion - direct to REVIEW_STUDY or error?
- [ ] **E27**: All MASTERED segment - MASTERED words in review queue?
- [ ] **E38**: Network fail during complete - error handling & retry?
- [ ] **E48**: Assignment removed mid-session - error handling?
- [ ] **E49**: Same list multiple classes - shared or separate progress?
- [ ] **E54**: Word order change - segment boundary issues?

## Medium Priority (UX/Polish)
- [ ] **E50**: Audio rapid clicks - debounced or overlaps?
- [ ] **E51**: Screen reader - proper ARIA labels?
- [ ] **E55**: Typed answer spaces - normalization?
- [ ] **E56**: Typed answer case - case-insensitive?
- [ ] **E57**: Typed answer diacritics - normalized?
- [ ] **E58**: Typed answer typos - tolerance?
- [ ] **E63**: Challenge PASSED word - UI prevents?
- [ ] **E71**: Firestore rate limiting - batch writes used?

## Low Priority (Edge Cases)
- [ ] **E42**: 2+ hour session - periodic saves?
- [ ] **E43**: Rapid card swiping - batched writes?
- [ ] **E66**: PDF Unicode/emoji - font support?
- [ ] **E72**: Token expiry - refresh handling?
- [ ] **E73**: Logout in another tab - session handling?

---

# Test Execution Template

## Pre-Test Setup
1. Create test user account
2. Create test class with 3 test students
3. Create test list with 500+ words
4. Assign list with default settings
5. Note Firebase console for monitoring

## Test Session Recording
For each scenario, record:
- [ ] Date/time
- [ ] Tester name
- [ ] Browser/device
- [ ] Starting state (day number, word count)
- [ ] Exact actions taken
- [ ] Observed behavior
- [ ] Expected vs actual
- [ ] Screenshots/console logs
- [ ] Pass/Fail status

## Post-Test Verification
1. Check Firestore for expected document changes
2. Verify progress numbers match expected
3. Check for orphaned/inconsistent data
4. Review console for warnings/errors

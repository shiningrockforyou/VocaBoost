I need to overhaul the Student Dashboard to be more encouraging and detailed.

Task: Dashboard 2.0 & Weekly Goals

1. Update `src/services/db.js`:

   A. **Add `fetchDashboardStats(userId)`**
      - **Weekly Progress:** Query `study_states` subcollection. Count words where `lastReviewed` > (Now - 7 days).
      - **Latest Test:** Query `attempts` collection. Where `studentId` == userId. OrderBy `submittedAt` desc. Limit 1.
      - **Mastery Count:** Count words where `box >= 4`.
      - **Retention:** Get current `user.stats.retention`.
      - Return: `{ weeklyProgress, latestTest, masteryCount, retention }`.

   B. **Update `updateUserSettings`:**
      - Change `dailyGoal` to `weeklyGoal` (default e.g., 100).

2. Create `src/components/MasterySquares.jsx`:
   - Props: `total`, `mastered`.
   - **Visual:** A single row of 7 squares.
   - **Logic:**
     - Each square represents 14.2% (1/7) of the total.
     - Fill logic: Calculate % completed. Fill squares from left to right.
     - Colors: Empty = `bg-slate-200`. Full = `bg-blue-600`.
     - Style: Rounded-sm, slight gap (gap-1).

3. Update `src/pages/Dashboard.jsx` (Student View):

   A. **Remove "Trust Score" Card:** (Hide it completely from this view).

   B. **New "My Stats" Section (4-Grid):**
      - **Box 1: Mastered Words** (Big number).
      - **Box 2: Weekly Goal** (e.g., "45 / 100 words studied"). Show a simple line progress bar.
      - **Box 3: Current Streak** (Keep existing logic or mock if missing).
      - **Box 4: Retention** (Show % from stats).

   C. **Update "My Classes" List Items:**
      - Replace the old "Progress Bar" with the new `<MasterySquares />`.
      - Pass `list.stats.totalWords` and `list.stats.masteryCount`.

   D. **New "Latest Test Analysis" Card:**
      - Render ONLY if `latestTest` exists.
      - **Header:** Test Name / Date / Score (Color coded).
      - **Details:**
        - "Type": MCQ vs Short Answer.
        - "Words Mastered in this test": (Calculate delta if possible, otherwise just show score).
      - **Missed Words:**
        - Filter `latestTest.answers` for `correct === false`.
        - Show them as a pill list (e.g., "abate, erratic").
      - **Action:** "Retake Test" button.


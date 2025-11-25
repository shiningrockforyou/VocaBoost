## Project Context – Dashboard 2.0 & Weekly Goals

This phase shifts the student experience from judgment (“trust scores”) to supportive goal‑tracking. Key expectations:

1. **Service Layer**
   - `fetchSmartStudyQueue` stays capped (default 100) and prioritises panic/due/new words.
   - Student stats must expose total words, mastery counts (box ≥ 4), and retention.
   - New helper `fetchDashboardStats(userId)` will aggregate: last 7‑day progress, latest test attempt, mastery count, and retention.
   - Any settings API should treat `weeklyGoal` (default ≈100 words) as the motivating target instead of daily goals.

2. **UI Components**
   - `MasteryBars` and the new single‑row `MasterySquares` visualise progress gamification.
   - Dashboard cards emphasise mastered words, weekly goal progress, streaks, and retention (trust wording removed).
   - Class list items replace legacy bars with `MasterySquares`.
   - A “Latest Test Analysis” card summarises the most recent attempt plus missed words.
   - Study/Test pages use the centered logo watermark (z-index ordering already handled).

3. **Tone & Messaging**
   - Copy should celebrate “Goals & Recent Performance”.
   - Highlight supportive insights (“Weekly progress”, “Mastered words”) instead of punitive metrics.

Use this context when adding features so the dashboard remains consistent with the new supportive theme.


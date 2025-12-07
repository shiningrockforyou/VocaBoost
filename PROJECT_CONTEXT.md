## Project Context – Dashboard 2.0 & Weekly Goals

**Last Updated:** Current  
**Status:** UI/Dashboard Design System Fully Implemented

This phase shifts the student experience from judgment ("trust scores") to supportive goal‑tracking. The dashboard has been completely redesigned with a "Command Deck" layout and "Academic Glass" design system.

### Current Implementation Status

✅ **Completed:**
- **Design System:** "Navy & Ember" color palette with "Step-Down Radius" hierarchy
- **Command Deck Layout:** 4-panel structure (Focus Card, Vitals, Launchpad, Activity Bar)
- **Focus Card:** Hero typography with weekly goal tracking
- **Vitals Panel:** Real user stats (Words Mastered, Retention Rate, Current Streak)
- **Launchpad:** Smart CTA with dynamic status (behind/onTrack/ahead) and adaptive messaging
- **Activity Bar:** 7-day bar chart showing word activity with hover tooltips (replaced MasterySquares)
- **Button Standardization:** Fixed heights, text truncation, consistent radius
- **List View:** Progress bars and standardized action buttons
- **Teacher Dashboard:** Redesigned to match "Academic Glass" design system
- **Teacher Gradebook:** New comprehensive gradebook with advanced filtering

🔄 **In Progress:**
- Progress bar calculation (currently hardcoded, needs real stats)
- Weekly activity data (currently mock, needs real 7-day history)
- Mobile responsive optimizations

### Design System Overview

**Color Palette:**
- **Primary (Royal Navy):** `#1B3A94` - Primary actions, headers, focus cards
- **Accent (Ember Orange):** `#F97316` - Study actions, highlights
- **Background:** `#F1F5F9` (Slate-100) - Slightly grey to make white cards pop

**Typography:**
- **Headings:** Plus Jakarta Sans (Google Fonts)
- **Body:** Pretendard (Local font files)

**Border Radius Hierarchy:**
- **Cards/Containers:** `rounded-2xl` (16px)
- **Buttons/Inputs:** `rounded-xl` (12px)
- **Tiny Elements:** `rounded-md` (6px)

**Key Pattern:** All buttons use fixed heights (`h-12` or `h-14`) with text truncation to prevent vertical growth.

### Service Layer

1. **Data Fetching:**
   - `fetchSmartStudyQueue` stays capped (default 100) and prioritises panic/due/new words.
   - `fetchDashboardStats(userId)` aggregates: last 7‑day progress, latest test attempt, mastery count, and retention.
   - Student stats expose: `totalWordsLearned`, `retention` (0.0-1.0), `streakDays`

2. **Weekly Goals:**
   - Primary focus calculated from most recently assigned list
   - Weekly goal: `list.pace * 7`
   - Progress: `list.stats?.wordsLearned || 0`
   - Settings API treats `weeklyGoal` (default ≈100 words) as the motivating target

### UI Components

1. **MasterySquares Component:**
   - Supports 3 modes: Streak mode, Activity mode, Progress mode (legacy)
   - Used in Activity Bar for 7-day visualization
   - Small squares (`w-3 h-3`) for compact display

2. **Dashboard Cards:**
   - Focus Card: Weekly goal progress with hero numbers
   - Vitals: Words Mastered, Retention Rate, Current Streak
   - Launchpad: Study Now (Orange) and Take Test (Navy) buttons
   - Activity Bar: 7-day streak visualization

3. **List View:**
   - Continuous progress bars (replaced segmented squares)
   - Standardized buttons: Study Now, Take Test, Download PDF
   - All buttons: `h-12 rounded-xl`

4. **Modals:**
   - `StudySelectionModal`: Lists available vocabulary lists from enrolled classes
   - Supports both study and test modes

### Tone & Messaging

- Copy celebrates "Goals & Recent Performance"
- Highlight supportive insights ("Weekly progress", "Mastered words") instead of punitive metrics
- Welcome message: "Your personalized vocabulary journey starts here"
- Focus Card: "Weekly Goals" with clear progress tracking

### File Structure

**Key Files:**
- `src/pages/Dashboard.jsx` - Main dashboard (1200+ lines, fully implemented)
- `src/index.css` - Design system definitions (colors, typography, utilities)
- `src/components/MasterySquares.jsx` - Activity visualization component
- `src/components/modals/StudySelectionModal.jsx` - List selection modal

**Documentation:**
- `UI_DASHBOARD_SPEC.md` - Complete UI/dashboard design specification
- `vocaboost_tech_spec.md` - Full technical specification

### Next Steps for Developers

1. **Connect Real Data:**
   - Replace hardcoded progress bar percentage with calculation from `list.stats`
   - Implement real 7-day activity data fetching
   - Add loading states for async operations

2. **Enhance Focus Card:**
   - Add empty state when no primary focus exists
   - Add animation to progress bar fill
   - Consider adding "on track" / "behind" indicators

3. **Improve List View:**
   - Add sorting/filtering options
   - Add empty states
   - Improve mobile responsiveness

Use this context when adding features so the dashboard remains consistent with the new supportive theme and design system.


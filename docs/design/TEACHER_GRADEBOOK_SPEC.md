# VocaBoost Teacher Gradebook Specification

**Version:** 1.0  
**Last Updated:** Current  
**Purpose:** Complete specification for the Teacher Gradebook interface

---

## 1. Overview

The Teacher Gradebook is a comprehensive interface for teachers to search, filter, and analyze student test performance across all classes. It provides advanced filtering capabilities, sorting, pagination, and detailed test result views.

**File:** `src/pages/TeacherGradebook.jsx`  
**Route:** `/teacher/gradebook`  
**Access:** Teacher only (protected by `TeacherRoute`)

---

## 2. Page Layout

### 2.1 Structure

```
┌─────────────────────────────────────────────────────────┐
│ Global Top Bar: Logo + Logout Button                    │
├─────────────────────────────────────────────────────────┤
│ Page Header: Title + Subtitle + Back to Dashboard       │
├─────────────────────────────────────────────────────────┤
│ Filter Toolbox (Tag Filter System)                       │
│   - Category Buttons                                     │
│   - Input Area (Dynamic)                                 │
│   - Add Filter Button                                    │
├─────────────────────────────────────────────────────────┤
│ Active Tags Display (Chips)                              │
├─────────────────────────────────────────────────────────┤
│ Results Table                                            │
│   - Control Bar (Count, Check All, Export)               │
│   - Table with Sortable Columns                          │
│   - Pagination Controls                                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Global Top Bar

**Matches Dashboard.jsx exactly:**
- **Left:** VocaBoost Logo (`w-32 md:w-48`)
- **Right:** Logout Button (`h-12 rounded-xl border border-slate-300 bg-white`)

### 2.3 Page Header

**Layout:** Flex row (responsive: column on mobile)
- **Left:**
  - Title: "Gradebook" (`text-3xl font-heading font-bold text-brand-primary`)
  - Subtitle: "Search and filter student performance across all classes." (`text-base text-slate-500`)
- **Right:**
  - "Back to Dashboard" Link (`Link` to `/`)
  - Style: Ghost button with `ChevronLeft` icon

---

## 3. Tag Filter System

### 3.1 Filter Toolbox Container

**Styling:**
- `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6`

### 3.2 Category Buttons

**Categories:** Class, List, Date, Name

**Button Style:**
- Default: `h-10 px-4 rounded-xl border border-slate-200 font-medium text-slate-600 hover:border-brand-primary hover:text-brand-primary`
- Active: `bg-brand-primary text-white border-brand-primary`
- Icons: Each button has a category-specific icon:
  - Class: `BookOpen` icon
  - List: `BookOpen` icon
  - Date: `Calendar` icon
  - Name: `User` icon

**Behavior:**
- Clicking a category button sets it as `activeCategory`
- Changes the input area below

### 3.3 Input Area

**Dynamic based on selected category:**

**For Class/List/Name:**
- Text input with search icon
- Placeholder: "Search by {category}..."
- Style: `h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4`
- Supports Enter key to add filter

**For Date:**
- Two date inputs (Start Date, End Date)
- Grid layout: `grid grid-cols-2 gap-3`
- Both inputs required
- Validation: Start date must be before end date

### 3.4 Add Filter Button

**Style:** `h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold`
**Behavior:**
- Validates input before adding
- Limits to 10 active tags maximum
- Clears input after adding
- For Date: Validates date range

### 3.5 Active Tags Display

**Location:** Below filter toolbox

**Tag Styling:**
- Container: `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium`
- Color coding by category:
  - **Class:** `bg-blue-50 text-blue-700`
  - **List:** `bg-purple-50 text-purple-700`
  - **Date:** `bg-amber-50 text-amber-700`
  - **Name:** `bg-emerald-50 text-emerald-700`

**Tag Structure:**
- Shows: `{Category}: {Label}`
- Remove button: `X` icon (14px)
- Clicking X removes the tag

**Limit:** Maximum 10 tags

---

## 4. Filtering Logic

### 4.1 Filter Structure

**Tag Data:**
```javascript
{
  id: string,  // Unique identifier
  category: 'Class' | 'List' | 'Date' | 'Name',
  value: string | { start: string, end: string },  // Date uses range object
  label: string  // Display text
}
```

### 4.2 Filter Rules

**OR Logic (Within Category):**
- Multiple tags of the same category use OR logic
- Example: "Class A" OR "Class B" matches attempts from either class

**AND Logic (Across Categories):**
- Different categories use AND logic
- Example: ("Class A" OR "Class B") AND "Date > X" AND "Name contains Y"

**String Matching:**
- Partial matching (substring search)
- Case-insensitive
- Example: "amaz" matches "Amazing Class"

**Date Matching:**
- Date range: Attempt date must be within start and end dates (inclusive)
- End date includes full day (23:59:59)

### 4.3 Filter Application

**Process:**
1. Group tags by category
2. For each category with tags, apply OR logic
3. Combine all categories with AND logic
4. Return filtered results

---

## 5. Mock Data Generation

### 5.1 Data Structure

**Test Attempt Object:**
```javascript
{
  id: string,  // Unique identifier
  class: string,  // Class name
  list: string,  // Vocabulary list name
  date: Date,  // Test date (last 90 days)
  name: string,  // Student name
  score: number,  // Percentage (0-100)
  totalQuestions: number,  // 10-24 questions
  correctAnswers: number,  // Number of correct answers
  answers: Array<{
    wordId: string,
    word: string,
    correctAnswer: string,
    studentAnswer: string,
    isCorrect: boolean
  }>
}
```

### 5.2 Generation Details

**Quantity:** ~50 test attempts

**Randomization:**
- Classes: 5 predefined class names
- Lists: 8 predefined list names
- Names: 15 predefined student names
- Dates: Random within last 90 days
- Questions: 10-24 per test
- Score: Random based on correct answers

**Initial Sort:** By date (descending - newest first)

---

## 6. Results Table

### 6.1 Control Bar

**Location:** Above table header

**Layout:** Three sections (Left, Center, Right)

**Left Section:**
- "Total Results: {count}" (`text-sm font-bold text-slate-500`)
- Count in `text-brand-primary`

**Right Section:**
- "Check All" / "Uncheck All" button
  - Icon: `CheckSquare` or `Square`
  - Style: Ghost button with border
  - Behavior: Toggles all items on current page
- "Export ({count})" button
  - Icon: `Download`
  - Style: `h-10 px-4 rounded-xl bg-brand-accent text-white`
  - Shows selected count
  - Requires at least 1 selection

### 6.2 Table Columns

1. **Select (Checkbox)**
   - Individual row selection
   - Header checkbox: Selects/deselects all on current page
   - Persists across pagination

2. **Class** (Sortable)
   - Click header to sort
   - Shows sort indicator (↑/↓)

3. **List** (Sortable)
   - Click header to sort
   - Shows sort indicator

4. **Date** (Sortable)
   - Format: "Oct 24, 2024" (short month, day, year)
   - Click header to sort
   - Default sort column

5. **Name** (Sortable)
   - Student name
   - Click header to sort

6. **Score**
   - Format: "{score}% ({correct}/{total})"
   - Color coding:
     - **Green** (≥80%): `text-emerald-600 font-bold`
     - **Amber** (≥60%): `text-amber-600 font-bold`
     - **Red** (<60%): `text-red-600 font-bold`

7. **View**
   - "View Details" button
   - Style: `text-sm font-semibold text-brand-primary hover:text-brand-accent`
   - Opens details modal

### 6.3 Sorting

**Behavior:**
- Click column header to sort
- First click: Ascending
- Second click: Descending
- Third click: (if implemented) Reset to default

**Default:** Date (descending)

**Sortable Columns:** Class, List, Date, Name, Score

### 6.4 Pagination

**Location:** Below table

**Controls:**
- Previous button (disabled on page 1)
- "Page X of Y" text
- Next button (disabled on last page)

**Items Per Page:** 10

**Behavior:**
- Maintains selected items across pages
- Resets to page 1 when filters change

### 6.5 Empty States

**No Filters Applied:**
- Large watermark text: "Search for your students' results"
- Style: `text-4xl font-heading font-bold text-slate-300`
- Centered in table area

**No Results (After Filtering):**
- Message: "Your search returned no results"
- Style: `text-lg font-heading font-bold text-slate-600`
- Centered in table area

---

## 7. View Details Modal/Drawer

### 7.1 Layout

**Type:** Slide drawer from right side

**Structure:**
- Backdrop: `bg-black/50` overlay
- Drawer: `w-full max-w-2xl` from right edge
- Scrollable content area

### 7.2 Header

**Sticky header:**
- Title: "Test Details"
- Close button: `X` icon
- Border bottom separator

### 7.3 Content Sections

**Header Info (Grid Layout):**
- 2x2 grid showing:
  - Student name
  - Test date
  - List name
  - Class name
- Score display (large, color-coded)

**Questions List:**
- Each question in a card:
  - Question number
  - Correct/Incorrect badge
  - Word (bold)
  - Correct Answer (gray background)
  - Student Answer (green if correct, red if wrong)

### 7.4 Question Card Styling

**Container:** `rounded-xl border border-slate-200 bg-white p-4`

**Correct Answer:**
- Background: `bg-slate-50`
- Text: `text-slate-700`

**Student Answer:**
- Correct: `text-emerald-700 bg-emerald-50`
- Incorrect: `text-red-700 bg-red-50`

**Badge:**
- Correct: `text-emerald-600 bg-emerald-50`
- Incorrect: `text-red-600 bg-red-50`

---

## 8. Selection & Export

### 8.1 Selection Persistence

**Behavior:**
- Selected items persist across pagination
- Stored in `Set` of attempt IDs
- "Check All" only affects current page
- Individual checkboxes update the Set

### 8.2 Export Functionality

**Button:** "Export ({count})"

**Requirements:**
- At least 1 item must be selected
- Shows count of selected items

**Current Implementation:**
- Logs selected data to console
- Shows alert with count
- **Future:** CSV/Excel download

**Export Data Structure:**
- Array of selected attempt objects
- Includes all attempt fields

---

## 9. Design System Compliance

### 9.1 Colors

- **Primary:** `text-brand-primary` (#1B3A94 - Royal Navy)
- **Accent:** `bg-brand-accent` (#F97316 - Orange)
- **Background:** `bg-slate-50`
- **Cards:** `bg-white border border-slate-200`

### 9.2 Typography

- **Headings:** `font-heading` (Plus Jakarta Sans)
- **Body:** `font-body` (Pretendard)
- **Section Titles:** `text-xl font-heading font-bold`
- **Table Headers:** `text-xs font-heading font-bold uppercase tracking-wider`

### 9.3 Border Radius

- **Cards/Panels:** `rounded-3xl` (24px)
- **Buttons:** `rounded-xl` (12px)
- **Tags:** `rounded-lg` (8px)
- **Inputs:** `rounded-xl` (12px)

### 9.4 Button Heights

- **Primary Actions:** `h-12` (48px)
- **Secondary Actions:** `h-10` (40px)
- **Icon Buttons:** `h-10 w-10` or `h-8 w-8`

---

## 10. State Management

### 10.1 Filter State

```javascript
activeCategory: 'Class' | 'List' | 'Date' | 'Name'
filterInput: string  // For text inputs
dateStart: string  // For date range
dateEnd: string  // For date range
activeTags: Array<Tag>  // Max 10
```

### 10.2 Table State

```javascript
sortColumn: string  // 'class' | 'list' | 'date' | 'name' | 'score'
sortDirection: 'asc' | 'desc'
currentPage: number
selectedAttempts: Set<string>  // Attempt IDs
```

### 10.3 Modal State

```javascript
viewDetailsId: string | null  // Attempt ID to show details for
```

---

## 11. Data Flow

### 11.1 Filtering Flow

```
Mock Data Generation
  ↓
Apply Active Tags (OR within category, AND across)
  ↓
Filtered Attempts
  ↓
Sort by Column/Direction
  ↓
Paginate (10 per page)
  ↓
Display in Table
```

### 11.2 Selection Flow

```
User Clicks Checkbox
  ↓
Update selectedAttempts Set
  ↓
Persist Across Pagination
  ↓
Export Button Shows Count
  ↓
Export Selected Items
```

---

## 12. Icons Used

**From `lucide-react`:**
- `Filter` - Filter toolbox header
- `Download` - Export button
- `CheckSquare` - Checked state
- `Square` - Unchecked state
- `ChevronLeft` - Previous page, Back button
- `ChevronRight` - Next page
- `X` - Close modal, Remove tag
- `Search` - Search input icon
- `Calendar` - Date category
- `BookOpen` - Class/List categories
- `User` - Name category
- `ClipboardList` - Gradebook link (in Dashboard)

---

## 13. Future Enhancements

### 13.1 Planned Features

- **Real Data Integration:** Replace mock data with `fetchClassAttempts()` from database
- **Export Formats:** CSV and Excel download functionality
- **Advanced Filters:** Score range, date presets (Last Week, Last Month)
- **Bulk Actions:** Delete attempts, reassign to different class
- **Analytics:** Charts and graphs for performance trends
- **Search Enhancement:** Autocomplete for class/list/name inputs

### 13.2 UI Improvements

- **Loading States:** Skeleton loaders while fetching data
- **Error Handling:** Better error messages and retry options
- **Responsive Design:** Mobile-optimized table view
- **Keyboard Navigation:** Full keyboard support for table
- **Accessibility:** ARIA labels, screen reader support

---

## 14. Integration Points

### 14.1 Navigation

**From Dashboard:**
- Link in teacher dashboard header
- Route: `/teacher/gradebook`

**Back Navigation:**
- "Back to Dashboard" button → `/`

### 14.2 Database Functions (Future)

**Potential Functions:**
- `fetchAllClassAttempts(teacherId)` - Get all attempts from teacher's classes
- `fetchAttemptDetails(attemptId)` - Get full attempt data
- `exportAttemptsToCSV(attemptIds)` - Export functionality

---

## 15. Key Implementation Details

### 15.1 Filter Tag Removal

**Bug Prevention:**
- Tag removal only affects filter state
- Does not interfere with selection state
- Clean separation of concerns

### 15.2 Selection Persistence

**Implementation:**
- Uses `Set` data structure for O(1) lookup
- Persists across pagination changes
- "Check All" preserves selections from other pages

### 15.3 Date Formatting

**Format:** "Oct 24, 2024"
- Uses `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
- Consistent across table and modal

### 15.4 Score Color Logic

**Thresholds:**
- Green: `score >= 80`
- Amber: `score >= 60`
- Red: `score < 60`

**Applied to:** Score percentage text in table and modal

---

## 16. Component Structure

```jsx
<main>
  <GlobalTopBar />
  <PageHeader />
  <FilterToolbox>
    <CategoryButtons />
    <InputArea />
    <AddFilterButton />
  </FilterToolbox>
  <ActiveTags />
  <ResultsTable>
    <ControlBar />
    <Table>
      <TableHeader />
      <TableBody />
    </Table>
    <Pagination />
  </ResultsTable>
  {viewDetailsId && <DetailsModal />}
</main>
```

---

## 17. Testing Considerations

### 17.1 Filter Testing

- Test OR logic within categories
- Test AND logic across categories
- Test partial string matching
- Test date range filtering
- Test maximum tag limit (10)

### 17.2 Selection Testing

- Test individual selection
- Test "Check All" on current page
- Test selection persistence across pages
- Test export with 0, 1, and multiple selections

### 17.3 Sorting Testing

- Test each sortable column
- Test ascending/descending toggle
- Test sort with filters applied

### 17.4 Pagination Testing

- Test navigation between pages
- Test edge cases (first page, last page)
- Test pagination with filters

---

**End of Specification**

For questions or clarifications, refer to:
- `src/pages/TeacherGradebook.jsx` - Main implementation
- `UI_DASHBOARD_SPEC.md` - Design system reference
- `TEACHER_DASHBOARD_SPEC.md` - Teacher dashboard context


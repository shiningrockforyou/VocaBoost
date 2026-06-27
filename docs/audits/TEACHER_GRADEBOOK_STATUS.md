# Teacher Gradebook - Current Status & Next Steps

**Last Updated:** Current

---

## ✅ What We Have (Completed)

### 1. UI Implementation
- ✅ **Complete UI** with all features implemented
- ✅ **Tag Filter System** - Class, List, Date, Name filters with OR/AND logic
- ✅ **Results Table** - Sortable columns, pagination, selection
- ✅ **View Details Modal** - Slide drawer with question breakdown
- ✅ **Export UI** - Button and selection system ready
- ✅ **Design System Compliance** - Matches "Academic Glass" design

### 2. Infrastructure
- ✅ **Route Setup** - `/teacher/gradebook` with `TeacherRoute` protection
- ✅ **Dashboard Link** - Gradebook button in teacher dashboard header
- ✅ **Component Structure** - Well-organized, maintainable code

### 3. Documentation
- ✅ **Spec Document** - `TEACHER_GRADEBOOK_SPEC.md` created
- ✅ **Changelog** - Documented in `CHANGELOG.md`

---

## ⚠️ What's Missing (To Do)

### 1. Real Data Integration (CRITICAL)

**Current State:** Using mock data (~50 generated attempts)

**What's Needed:**
- Create `fetchAllTeacherAttempts(teacherId)` function in `src/services/db.js`
- Replace mock data with real database queries
- Handle loading states
- Handle error states

**Function Requirements:**
```javascript
export const fetchAllTeacherAttempts = async (teacherId) => {
  // 1. Get all classes owned by teacher
  // 2. Get all assigned list IDs from those classes
  // 3. Query attempts collection
  // 4. Filter attempts by listId (extracted from testId)
  // 5. Enrich with student name, class name, list name
  // 6. Return formatted array matching current data structure
}
```

**Data Structure Mapping:**
- Current mock: `{ id, class, list, date, name, score, totalQuestions, correctAnswers, answers }`
- Database: `{ id, studentId, testId, score, answers, submittedAt, ... }`
- Need to enrich with: student name, class name, list name

### 2. Export Functionality

**Current State:** Alert placeholder

**What's Needed:**
- CSV export implementation
- Excel export (optional)
- Format: Selected attempts with all relevant data
- Download trigger

### 3. Performance Optimizations

**Current State:** Client-side filtering/sorting (works for mock data)

**What's Needed:**
- Consider server-side filtering for large datasets
- Pagination at database level (if needed)
- Caching strategy for frequently accessed data

### 4. Error Handling

**Current State:** Basic error handling

**What's Needed:**
- Loading states during data fetch
- Error messages for failed queries
- Empty states for no data
- Retry mechanisms

---

## 📋 Next Steps (Priority Order)

### Step 1: Create Database Function (HIGH PRIORITY)

**File:** `src/services/db.js`

**Function:** `fetchAllTeacherAttempts(teacherId)`

**Implementation:**
1. Fetch all teacher's classes using `fetchTeacherClasses(teacherId)`
2. Collect all assigned list IDs from all classes
3. Query `attempts` collection (may need to fetch all and filter client-side, or use multiple queries)
4. For each attempt:
   - Extract `listId` from `testId` (format: `test_{listId}_{timestamp}`)
   - Check if `listId` is in assigned lists
   - Fetch student data for `studentName`
   - Fetch list data for `listName`
   - Fetch class data for `className` (need to determine which class)
   - Format to match expected structure

**Challenges:**
- Firestore doesn't support querying by extracted substring (testId parsing)
- May need to fetch all attempts and filter client-side
- Need to determine which class an attempt belongs to (could be multiple classes with same list)

**Data Structure Return:**
```javascript
[{
  id: string,
  class: string,  // Class name
  list: string,   // List name
  date: Date,     // submittedAt
  name: string,   // Student name
  score: number,  // Percentage
  totalQuestions: number,
  correctAnswers: number,
  answers: Array<{
    wordId: string,
    word: string,
    correctAnswer: string,
    studentAnswer: string,
    isCorrect: boolean
  }>
}]
```

### Step 2: Integrate Real Data (HIGH PRIORITY)

**File:** `src/pages/TeacherGradebook.jsx`

**Changes:**
1. Remove `mockAttempts` useMemo
2. Add `useState` for attempts data
3. Add `useState` for loading/error states
4. Add `useEffect` to fetch data on mount
5. Update filtering to use real data
6. Add loading spinner
7. Add error display

**Code Pattern:**
```javascript
const [attempts, setAttempts] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

useEffect(() => {
  const loadAttempts = async () => {
    if (!user?.uid) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllTeacherAttempts(user.uid)
      setAttempts(data)
    } catch (err) {
      setError(err.message ?? 'Unable to load attempts')
    } finally {
      setLoading(false)
    }
  }
  loadAttempts()
}, [user?.uid])
```

### Step 3: Implement Export (MEDIUM PRIORITY)

**Options:**
1. **CSV Export** (Simpler)
   - Use a library like `papaparse` or manual CSV generation
   - Format: Columns match table columns
   - Download as `.csv` file

2. **Excel Export** (More complex)
   - Use library like `xlsx` or `exceljs`
   - Better formatting options
   - Multiple sheets support

**Implementation:**
```javascript
const handleExport = async () => {
  if (selectedAttempts.size === 0) {
    alert('Please select at least one attempt to export')
    return
  }
  
  const selectedData = sortedAttempts.filter(a => selectedAttempts.has(a.id))
  
  // Generate CSV
  const csv = generateCSV(selectedData)
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gradebook-export-${new Date().toISOString()}.csv`
  a.click()
}
```

### Step 4: Enhance Error Handling (MEDIUM PRIORITY)

**Add:**
- Loading spinner during data fetch
- Error banner for failed loads
- Empty state when no attempts exist
- Retry button on errors

### Step 5: Performance Optimizations (LOW PRIORITY)

**Consider:**
- Server-side filtering (if dataset grows large)
- Pagination at database level
- Caching with React Query or similar
- Virtual scrolling for large tables

---

## 🔍 Technical Considerations

### Challenge 1: Determining Class for Each Attempt

**Problem:** An attempt only has `testId` (which contains `listId`), but a list can be assigned to multiple classes.

**Solutions:**
1. **Include classId in testId** (requires changing test generation)
2. **Store classId in attempt document** (requires schema change)
3. **Show all matching classes** (attempt appears in all classes that have the list)
4. **Use most recent assignment** (heuristic)

**Recommended:** Option 3 (show in all matching classes) or Option 2 (store classId in attempt)

### Challenge 2: Firestore Query Limitations

**Problem:** Can't query by extracted substring from `testId`

**Solutions:**
1. Fetch all attempts, filter client-side (current approach in `fetchClassAttempts`)
2. Store `listId` directly in attempt document (schema change)
3. Use composite queries if possible

**Recommended:** Option 1 for now (works, but may be slow with many attempts)

### Challenge 3: Data Enrichment Performance

**Problem:** Need to fetch student/list/class data for each attempt

**Solutions:**
1. Batch fetches where possible
2. Cache lookups (student names, list names)
3. Denormalize data in attempt document (store names directly)

**Recommended:** Option 1 + 2 (batch and cache)

---

## 📊 Current Data Flow

```
TeacherGradebook Component
  ↓
mockAttempts (useMemo) - Generates 50 mock attempts
  ↓
filteredAttempts (useMemo) - Applies tag filters
  ↓
sortedAttempts (useMemo) - Applies sorting
  ↓
paginatedAttempts (useMemo) - Paginates results
  ↓
Table Display
```

## 🎯 Target Data Flow

```
TeacherGradebook Component
  ↓
useEffect - Fetch on mount
  ↓
fetchAllTeacherAttempts(teacherId)
  ↓
  - Get teacher classes
  - Get assigned lists
  - Query attempts collection
  - Filter by listId
  - Enrich with student/list/class data
  ↓
attempts (useState) - Real data
  ↓
filteredAttempts (useMemo) - Apply tag filters
  ↓
sortedAttempts (useMemo) - Apply sorting
  ↓
paginatedAttempts (useMemo) - Paginate results
  ↓
Table Display
```

---

## 🚀 Implementation Checklist

### Phase 1: Database Function
- [ ] Create `fetchAllTeacherAttempts(teacherId)` in `db.js`
- [ ] Test with real teacher account
- [ ] Handle edge cases (no classes, no attempts, etc.)
- [ ] Optimize with batching/caching

### Phase 2: Integration
- [ ] Replace mock data with real data fetch
- [ ] Add loading state
- [ ] Add error handling
- [ ] Test filtering with real data
- [ ] Test sorting with real data
- [ ] Test pagination with real data

### Phase 3: Export
- [ ] Implement CSV export
- [ ] Test export with selected items
- [ ] (Optional) Implement Excel export

### Phase 4: Polish
- [ ] Add loading spinners
- [ ] Improve error messages
- [ ] Add empty states
- [ ] Performance testing
- [ ] Mobile responsiveness

---

## 📝 Notes

**Current Mock Data Structure:**
- Matches expected format perfectly
- Good for UI development and testing
- Needs to be replaced with real data

**Database Schema:**
- `attempts` collection has: `studentId`, `testId`, `score`, `answers`, `submittedAt`
- `testId` format: `test_{listId}_{timestamp}`
- Need to extract `listId` and match to teacher's assigned lists

**Performance Considerations:**
- If teacher has many classes/students, fetching all attempts may be slow
- Consider pagination or date range limits
- Client-side filtering is fine for reasonable dataset sizes (<1000 attempts)

---

**Status:** UI Complete, Data Integration Pending  
**Next Action:** Create `fetchAllTeacherAttempts()` function


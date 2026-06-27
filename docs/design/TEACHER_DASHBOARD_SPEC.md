# VocaBoost Teacher Dashboard & Functions Specification

**Version:** 1.0  
**Last Updated:** Current  
**Purpose:** Complete specification for teacher-side functionality, pages, and features

---

## 1. Overview

The VocaBoost teacher interface provides tools for managing classes, creating and editing vocabulary lists, assigning content to students, and tracking student progress. All teacher pages are protected by the `TeacherRoute` component, which ensures only users with `role === 'teacher'` can access these features.

### 1.1 Access Control

**Route Protection:**
- All teacher routes are wrapped in `<PrivateRoute><TeacherRoute>...</TeacherRoute></PrivateRoute>`
- `TeacherRoute` component checks `user?.role !== 'teacher'` and redirects to `/` if unauthorized
- Located in: `src/components/TeacherRoute.jsx`

**Shared Pages:**
- **Dashboard** (`/`): Shows different content based on `user.role === 'teacher'`
- **Gradebook** (`/gradebook`): Accessible to both teachers and students (different views)

---

## 2. Teacher Pages

### 2.1 Dashboard (`/`)

**File:** `src/pages/Dashboard.jsx` (lines 335-566)  
**Access:** Shared page with role-based rendering  
**Condition:** `if (isTeacher)` block

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Global Top Bar: Logo + Logout Button                    │
├─────────────────────────────────────────────────────────┤
│ Error Banner (if error)                                   │
├─────────────────────────────────────────────────────────┤
│ Page Header: Welcome + Create Class Button                │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ My Classes Section (Col-span-12)                    │ │
│ │   - Grid of class cards (md:grid-cols-2)            │ │
│ │   - Refresh button (icon-only)                      │ │
│ └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ My Vocabulary Lists Section (Col-span-12)           │ │
│ │   - Grid of list cards (md:grid-cols-2)            │ │
│ │   - View All Lists + Create New List buttons       │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Features

**My Classes Section:**
- Displays all classes owned by the teacher
- Each class card shows:
  - Class name (hover: changes to brand-primary)
  - Join code (badge style)
  - Student count (placeholder: "—")
  - Delete button (icon-only, hover: red)
  - "Open Class" link → `/classes/:classId`
- Empty state: Message prompting to create first class
- Refresh button: Icon-only ghost button

**My Vocabulary Lists Section:**
- Displays all vocabulary lists owned by the teacher
- Each list card shows:
  - List title (hover: changes to brand-primary)
  - Description (line-clamp-2)
  - Word count badge
  - Delete button (icon-only, hover: red)
  - "Edit List" link → `/lists/:listId`
  - PDF download button
- Header actions:
  - "View All Lists" button → `/lists` (List Library)
  - "Create New List" button → `/lists/new`
- Empty state: Message prompting to create first list

**Create Class Modal:**
- Triggered by "Create New Class" button in header
- Component: `CreateClassModal`
- On success: Refreshes class list

#### Data Loading

**Functions Used:**
- `fetchTeacherClasses(user.uid)` - Loads teacher's classes
- `fetchTeacherLists(user.uid)` - Loads teacher's vocabulary lists
- `deleteClass(classId)` - Deletes a class
- `deleteList(listId)` - Deletes a vocabulary list
- `downloadListAsPDF(listTitle, words, 'Full List')` - Generates PDF

**State Management:**
- `classes` - Array of class objects
- `teacherLists` - Array of list objects
- `classesLoading` / `listsLoading` - Loading states
- `classError` / `listsError` - Error messages
- `deletingClassId` / `deletingListId` - Track deletion in progress
- `generatingPDF` - Track PDF generation

---

### 2.2 List Library (`/lists`)

**File:** `src/pages/ListLibrary.jsx`  
**Access:** Teacher only (protected by `TeacherRoute`)  
**Purpose:** Browse all vocabulary lists in a dedicated view

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Header Section                                           │
│   - Title: "List Library"                                │
│   - Actions: Create New List + Back to Dashboard        │
├─────────────────────────────────────────────────────────┤
│ Lists Grid (md:grid-cols-2)                              │
│   - Each list card:                                      │
│     * Title + Description                                │
│     * Word count badge                                   │
│     * "Edit List" link                                   │
└─────────────────────────────────────────────────────────┘
```

#### Features

- **Header:**
  - Title: "List Library"
  - Subtitle: "Manage content for your classes and study modes."
  - "Create New List" button → `/lists/new`
  - "Back to Dashboard" button → `/`

- **List Cards:**
  - Grid layout: 2 columns on medium+ screens
  - Each card displays:
    - List title
    - Description (truncated)
    - Word count badge
    - "Edit List" link → `/lists/:listId`

- **Empty State:**
  - Message: "You have not created any lists yet. Click 'Create New List' to start."

#### Data Loading

**Functions Used:**
- `fetchTeacherLists(user.uid)` - Loads all teacher's lists

**State Management:**
- `lists` - Array of list objects
- `loading` - Loading state
- `error` - Error message

---

### 2.3 List Editor (`/lists/new` and `/lists/:listId`)

**File:** `src/pages/ListEditor.jsx`  
**Access:** Teacher only (protected by `TeacherRoute`)  
**Modes:**
- **Create Mode:** `/lists/new` - Create a new vocabulary list
- **Edit Mode:** `/lists/:listId` - Edit an existing list

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Back Button                                              │
├─────────────────────────────────────────────────────────┤
│ Header: "Create List" or "Edit {List Name}"             │
├─────────────────────────────────────────────────────────┤
│ List Details Section                                      │
│   - Title input                                          │
│   - Description textarea                                 │
│   - Save button                                          │
├─────────────────────────────────────────────────────────┤
│ Add Word Form                                            │
│   - Word, Part of Speech, Definition                     │
│   - Sample Sentence                                      │
│   - Secondary Language + Definition                       │
│   - Add/Update button                                    │
│   - Import Words button (opens modal)                    │
├─────────────────────────────────────────────────────────┤
│ Words List                                               │
│   - Each word: Edit + Delete buttons                     │
│   - Sorted by createdAt (desc)                          │
└─────────────────────────────────────────────────────────┘
```

#### Features

**List Details:**
- **Title:** Required text input
- **Description:** Optional textarea
- **Save:** Updates list metadata (only in edit mode)
- **Create:** Creates new list and redirects to edit mode (only in create mode)

**Word Management:**
- **Add Word Form:**
  - Word (required)
  - Part of Speech (optional)
  - Definition (required) - Primary English definition
  - Sample Sentence (optional)
  - Secondary Language (optional) - Language code
  - Secondary Definition (optional) - Translation/definition in secondary language

- **Word Actions:**
  - **Add:** Creates new word in list
  - **Edit:** Populates form with word data, changes button to "Update"
  - **Delete:** Confirms then deletes word
  - **Cancel Edit:** Clears form and exits edit mode

- **Import Words:**
  - Opens `ImportWordsModal` component
  - Supports CSV/text import
  - Bulk adds words to list

**Word List Display:**
- Shows all words in the list
- Sorted by `createdAt` descending (newest first)
- Each word shows:
  - Word text
  - Part of speech (if available)
  - Definition
  - Sample sentence (if available)
  - Edit button (populates form)
  - Delete button (with confirmation)

#### Data Loading

**Functions Used:**
- `createList({ title, description, ownerId })` - Creates new list
- `fetchTeacherLists(user.uid)` - Loads lists (for navigation)
- `addWordToList(listId, wordData)` - Adds word to list
- `updateWord(listId, wordId, wordData)` - Updates existing word
- `deleteWord(listId, wordId)` - Deletes word from list
- `updateDoc()` - Updates list metadata

**State Management:**
- `details` - List title and description
- `words` - Array of word objects
- `wordForm` - Current word form data
- `editingId` - ID of word being edited (null if adding new)
- `isCreateMode` - Boolean for create vs edit mode
- `wordsLoading` - Loading state
- `addingWord` / `savingDetails` - Action states
- `wordError` / `detailError` - Error messages
- `wordSuccess` / `detailSuccess` - Success messages
- `isImportModalOpen` - Import modal state

**Word Data Structure:**
```javascript
{
  word: string,
  partOfSpeech: string | null,
  definition: string,  // Primary definition (English)
  definitions: {
    en: string,  // English definition
    [langCode]: string  // Secondary language definitions
  },
  samples: string[],  // Sample sentences
  createdAt: Timestamp
}
```

---

### 2.4 Class Detail (`/classes/:classId`)

**File:** `src/pages/ClassDetail.jsx`  
**Access:** Teacher only (protected by `TeacherRoute`)  
**Purpose:** Manage a specific class, assign lists, view students, and track progress

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Back Button                                              │
├─────────────────────────────────────────────────────────┤
│ Class Header                                             │
│   - Class name                                           │
│   - Join code (with copy button)                         │
├─────────────────────────────────────────────────────────┤
│ Tabs: Lists | Students | Attempts                        │
├─────────────────────────────────────────────────────────┤
│ Tab Content (conditional rendering)                      │
│                                                          │
│ Lists Tab:                                               │
│   - Assigned lists grid                                  │
│   - Each list: Settings + Unassign + PDF                 │
│   - "Assign List" button (opens modal)                   │
│                                                          │
│ Students Tab:                                            │
│   - Student list with stats                              │
│                                                          │
│ Attempts Tab:                                            │
│   - Test attempts table                                  │
│   - Filter by list                                       │
└─────────────────────────────────────────────────────────┘
```

#### Features

**Class Header:**
- Displays class name
- Shows join code with copy-to-clipboard button
- Feedback message on copy success

**Tabs:**
1. **Lists Tab** (default: `activeTab === 'lists'`):
   - **Assigned Lists Grid:**
     - Shows all lists assigned to the class
     - Each list card displays:
       - List title
       - Word count
       - Pace setting (words per day)
       - Test options count
       - Settings button (opens settings modal)
       - Unassign button (removes list from class)
       - PDF download button
   
   - **Assign List Modal:**
     - Opens via "Assign List" button
     - Shows available lists (not already assigned)
     - Allows setting:
       - Pace (words per day, default: 20)
       - Test Options Count (default: 4)
     - On assign: Adds list to class `assignments` map

   - **Assignment Settings Modal:**
     - Opens from list card "Settings" button
     - Allows editing:
       - Pace (words per day)
       - Test Options Count
     - Updates `classes/{classId}.assignments[listId]`

2. **Students Tab** (`activeTab === 'students'`):
   - **Student List:**
     - Shows all enrolled students
     - Each student displays:
       - Display name
       - Email
       - Join date
       - Aggregate stats (from `fetchStudentAggregateStats`):
         - Total words learned
         - Mastered words
         - Retention rate
         - Credibility score

3. **Attempts Tab** (`activeTab === 'gradebook'`):
   - **Test Attempts Table:**
     - Shows all test attempts by students in the class
     - Filterable by list (dropdown: "All Lists" or specific list)
     - Each attempt shows:
       - Student name
       - List name
       - Test date
       - Score (percentage)
       - Total questions
       - Correct answers
       - Credibility
       - Retention

#### Data Loading

**Functions Used:**
- `fetchClass(classId)` - Loads class data
- `fetchClassAttempts(classId)` - Loads all test attempts for class
- `fetchStudentAggregateStats(studentId)` - Gets student progress stats
- `fetchTeacherLists(user.uid)` - Loads available lists for assignment
- `assignListToClass(classId, listId, pace, testOptionsCount)` - Assigns list to class
- `updateAssignmentSettings(classId, listId, settings)` - Updates assignment settings
- `unassignListFromClass(classId, listId)` - Removes list from class
- `fetchAllWords(listId)` - Gets all words for PDF generation
- `downloadListAsPDF(listTitle, words, 'Full List')` - Generates PDF

**State Management:**
- `classInfo` - Class document data
- `members` - Array of student member data with stats
- `assignedLists` - Array of assigned list objects with assignment metadata
- `teacherLists` - All teacher's lists (for assignment modal)
- `attempts` - Array of test attempt objects
- `activeTab` - Current tab ('lists' | 'students' | 'gradebook')
- `listFilter` - Filter for attempts tab ('all' | listId)
- `assignModalOpen` - Assignment modal state
- `settingsModalList` - Currently editing settings for this list (null if closed)
- `settingsForm` - Settings form data (pace, testOptionsCount)
- `unassigningListId` - Track unassignment in progress
- `generatingPDF` - Track PDF generation
- `loading` / `attemptsLoading` - Loading states
- `error` / `feedback` - Messages

**Assignment Data Structure:**
```javascript
// Stored in classes/{classId}.assignments[listId]
{
  pace: number,  // Words per day (default: 20)
  testOptionsCount: number,  // MCQ options (default: 4)
  assignedAt: Timestamp
}
```

---

## 3. Teacher-Specific Database Functions

### 3.1 Class Management

**Location:** `src/services/db.js`

#### `createClass(name, ownerTeacherId)`
- **Purpose:** Creates a new class
- **Parameters:**
  - `name`: String (required) - Class name
  - `ownerTeacherId`: String (required) - Teacher's user ID
- **Returns:** `{ id, name, ownerTeacherId, joinCode, createdAt, settings, assignedLists, mandatoryLists }`
- **Creates:**
  - Document in `classes` collection
  - Generates unique 6-character join code
  - Sets default settings

#### `fetchTeacherClasses(ownerTeacherId)`
- **Purpose:** Gets all classes owned by a teacher
- **Parameters:**
  - `ownerTeacherId`: String (required) - Teacher's user ID
- **Returns:** Array of class objects
- **Query:** `where('ownerTeacherId', '==', ownerTeacherId)`

#### `deleteClass(classId)`
- **Purpose:** Deletes a class and all its subcollections
- **Parameters:**
  - `classId`: String (required)
- **Deletes:**
  - Class document
  - `members` subcollection
  - Removes class from all students' `enrolledClasses`

### 3.2 List Management

#### `createList(payload)`
- **Purpose:** Creates a new vocabulary list
- **Parameters:**
  - `payload`: Object with `{ title, description, ownerId, visibility? }`
- **Returns:** `{ id, ...payload }`
- **Creates:**
  - Document in `lists` collection
  - Sets `wordCount: 0`
  - Sets `createdAt` and `updatedAt` timestamps

#### `fetchTeacherLists(ownerId)`
- **Purpose:** Gets all lists owned by a teacher
- **Parameters:**
  - `ownerId`: String (required) - Teacher's user ID
- **Returns:** Array of list objects
- **Query:** `where('ownerId', '==', ownerId)`

#### `deleteList(listId)`
- **Purpose:** Deletes a list and all its words
- **Parameters:**
  - `listId`: String (required)
- **Deletes:**
  - List document
  - `words` subcollection
  - Removes list from all classes' `assignedLists` arrays

### 3.3 Word Management

#### `addWordToList(listId, wordData)`
- **Purpose:** Adds a word to a vocabulary list
- **Parameters:**
  - `listId`: String (required)
  - `wordData`: Object with word fields
- **Creates:**
  - Document in `lists/{listId}/words` subcollection
  - Increments list `wordCount`
  - Sets `createdAt` timestamp

#### `updateWord(listId, wordId, wordData)`
- **Purpose:** Updates an existing word
- **Parameters:**
  - `listId`: String (required)
  - `wordId`: String (required)
  - `wordData`: Object with updated fields
- **Updates:** Word document in subcollection

#### `deleteWord(listId, wordId)`
- **Purpose:** Deletes a word from a list
- **Parameters:**
  - `listId`: String (required)
  - `wordId`: String (required)
- **Deletes:**
  - Word document
  - Decrements list `wordCount`

### 3.4 Class Assignment Management

#### `assignListToClass(classId, listId, pace, testOptionsCount)`
- **Purpose:** Assigns a vocabulary list to a class
- **Parameters:**
  - `classId`: String (required)
  - `listId`: String (required)
  - `pace`: Number (default: 20) - Words per day
  - `testOptionsCount`: Number (default: 4) - MCQ options
- **Updates:**
  - Adds `listId` to `classes/{classId}.assignedLists` array (if not present)
  - Sets `classes/{classId}.assignments[listId]` with metadata:
    ```javascript
    {
      pace: number,
      testOptionsCount: number,
      assignedAt: Timestamp
    }
    ```

#### `updateAssignmentSettings(classId, listId, settings)`
- **Purpose:** Updates assignment settings (pace, testOptionsCount)
- **Parameters:**
  - `classId`: String (required)
  - `listId`: String (required)
  - `settings`: Object with `{ pace?, testOptionsCount? }`
- **Updates:** `classes/{classId}.assignments[listId]`

#### `unassignListFromClass(classId, listId)`
- **Purpose:** Removes a list from a class
- **Parameters:**
  - `classId`: String (required)
  - `listId`: String (required)
- **Updates:**
  - Removes `listId` from `assignedLists` array
  - Removes `assignments[listId]` from map
- **Note:** Does NOT delete student progress (study_states preserved)

### 3.5 Student Data Access

#### `fetchClassAttempts(classId)`
- **Purpose:** Gets all test attempts for students in a class
- **Parameters:**
  - `classId`: String (required)
- **Returns:** Array of attempt objects with student info
- **Query:** Filters `attempts` collection by students enrolled in class

#### `fetchStudentAggregateStats(studentId)`
- **Purpose:** Gets aggregated progress stats for a student
- **Parameters:**
  - `studentId`: String (required)
- **Returns:** Object with:
  ```javascript
  {
    totalWordsLearned: number,
    masteredWords: number,
    retention: number,
    credibility: number
  }
  ```
- **Calculates:** From `users/{studentId}/study_states` subcollection

---

## 4. UI Components Used

### 4.1 Modals

#### `CreateClassModal`
- **Location:** `src/components/CreateClassModal.jsx`
- **Purpose:** Create a new class
- **Props:**
  - `isOpen`: Boolean
  - `onClose`: Function
  - `ownerId`: String
  - `onCreated`: Function (callback after creation)
  - `canManage`: Boolean

#### `AssignListModal`
- **Location:** `src/components/AssignListModal.jsx`
- **Purpose:** Assign a vocabulary list to a class
- **Props:**
  - `isOpen`: Boolean
  - `onClose`: Function
  - `availableLists`: Array of list objects
  - `onAssign`: Function(listId, pace, testOptionsCount)
  - `assigning`: Boolean (loading state)

#### `ImportWordsModal`
- **Location:** `src/components/ImportWordsModal.jsx`
- **Purpose:** Bulk import words from CSV/text
- **Props:**
  - `isOpen`: Boolean
  - `onClose`: Function
  - `onImport`: Function(wordsArray)
  - `listId`: String

### 4.2 Shared Components

#### `LoadingSpinner`
- **Location:** `src/components/LoadingSpinner.jsx`
- **Props:** `size`: 'sm' | 'md' | 'lg'

#### `BackButton`
- **Location:** `src/components/BackButton.jsx`
- **Purpose:** Navigation back button with consistent styling

---

## 5. Navigation Flow

### 5.1 Dashboard Navigation

```
Dashboard (/)
  ├─→ Create Class → Class Detail (/classes/:classId)
  ├─→ Open Class → Class Detail (/classes/:classId)
  ├─→ View All Lists → List Library (/lists)
  ├─→ Create New List → List Editor (/lists/new)
  └─→ Edit List → List Editor (/lists/:listId)
```

### 5.2 List Library Navigation

```
List Library (/lists)
  ├─→ Create New List → List Editor (/lists/new)
  ├─→ Edit List → List Editor (/lists/:listId)
  └─→ Back to Dashboard → Dashboard (/)
```

### 5.3 List Editor Navigation

```
List Editor (/lists/new or /lists/:listId)
  ├─→ Back Button → Previous page
  └─→ Import Words → ImportWordsModal
```

### 5.4 Class Detail Navigation

```
Class Detail (/classes/:classId)
  ├─→ Back Button → Dashboard (/)
  ├─→ Assign List → AssignListModal
  ├─→ Settings → Settings Modal
  └─→ Tab Navigation: Lists | Students | Attempts
```

---

## 6. Design System Compliance

### 6.1 Color Palette

- **Primary Actions:** `bg-brand-accent` (Orange: #F97316)
- **Secondary Actions:** `bg-blue-50 text-brand-primary` (Light blue background)
- **Delete Actions:** `hover:bg-red-50 hover:text-red-600` (Red on hover)
- **Borders:** `border-slate-200` or `border-slate-300`
- **Cards:** `bg-white border border-slate-200 rounded-3xl` (or `rounded-2xl` for nested cards)

### 6.2 Typography

- **Headings:** `font-heading` (Plus Jakarta Sans)
- **Body:** `font-body` (Pretendard)
- **Section Titles:** `text-xl font-heading font-bold text-slate-900`
- **Card Titles:** `text-lg font-heading font-bold text-slate-800`
- **Metadata:** `text-sm font-body text-slate-500`

### 6.3 Button Standards

- **Primary Buttons:** `h-12 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white`
- **Secondary Buttons:** `h-10 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand-primary`
- **Icon-Only Buttons:** `h-8 w-8 rounded-lg` with hover states
- **Delete Buttons:** Icon-only with `hover:bg-red-50 hover:text-red-600`

### 6.4 Card Styling

- **Container Cards:** `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm`
- **Grid Items:** `rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-brand-primary/30`
- **Group Hover:** Cards use `group` class with `group-hover:text-brand-primary` on titles

---

## 7. Data Structures

### 7.1 Class Document

```javascript
{
  name: string,
  ownerTeacherId: string,
  joinCode: string,  // 6-character uppercase code
  settings: {
    allowStudentListImport: boolean
  },
  assignedLists: string[],  // Array of list IDs (legacy)
  mandatoryLists: string[],  // Array of list IDs
  assignments: {  // Map structure (new)
    [listId]: {
      pace: number,  // Words per day
      testOptionsCount: number,  // MCQ options
      assignedAt: Timestamp
    }
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 7.2 List Document

```javascript
{
  title: string,
  description: string,
  ownerId: string,  // Teacher's user ID
  visibility: "public" | "private" | "class",
  wordCount: number,  // Cached count
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 7.3 Word Document

```javascript
{
  word: string,
  definition: string,  // Primary definition (English)
  definitions: {
    en: string,
    [langCode]: string  // Secondary language definitions
  },
  samples: string[],  // Sample sentences
  partOfSpeech: string | null,
  roots: string[],
  audioUrl: string | null,
  createdAt: Timestamp
}
```

---

## 8. Error Handling

### 8.1 Error States

All teacher pages implement error handling:

- **Loading Errors:** Display error message, allow retry
- **Action Errors:** Show inline error messages (red banners)
- **Success Messages:** Show success feedback (green banners or toasts)
- **Confirmation Dialogs:** Used for destructive actions (delete class/list/word)

### 8.2 Error Display Patterns

```jsx
{error && (
  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
    {error}
  </div>
)}
```

---

## 9. Future Enhancements

### 9.1 Planned Features

- **Student Count Display:** Currently shows "—", needs implementation
- **Bulk Operations:** Select multiple lists/classes for batch actions
- **List Templates:** Pre-built list templates for common curricula
- **Analytics Dashboard:** Class-wide progress analytics
- **Export Data:** Export class/student data as CSV/Excel

### 9.2 UI Improvements

- **List Library:** Update to match new design system
- **Class Detail:** Enhance tabs with better visual indicators
- **List Editor:** Improve word list display with search/filter
- **Responsive Design:** Optimize mobile experience

---

## 10. Key Implementation Notes

### 10.1 Assignment System

The assignment system uses a **dual structure** for backward compatibility:
- **Legacy:** `assignedLists` array (maintained for compatibility)
- **New:** `assignments` map with metadata (pace, testOptionsCount, assignedAt)

Code should check both structures when reading assignments.

### 10.2 Word Count Caching

List `wordCount` is cached and updated atomically:
- Incremented on word add
- Decremented on word delete
- Prevents expensive count queries

### 10.3 PDF Generation

PDF generation uses two modes:
- **Teacher View:** "Full List" - All words in the list
- **Student View:** "Daily Worksheet" - Filtered by study queue

---

**End of Specification**

For questions or clarifications, refer to:
- `src/pages/Dashboard.jsx` - Teacher dashboard implementation
- `src/pages/ListLibrary.jsx` - List library page
- `src/pages/ListEditor.jsx` - List editor page
- `src/pages/ClassDetail.jsx` - Class detail page
- `src/services/db.js` - Database functions
- `UI_DASHBOARD_SPEC.md` - Design system reference


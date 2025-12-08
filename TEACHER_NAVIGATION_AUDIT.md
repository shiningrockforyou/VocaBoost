# Teacher Navigation Audit

## 1. Teacher Routes in App.jsx

### Protected Routes (wrapped in `TeacherRoute`):

| Path | Component | Parameters | Description |
|------|-----------|------------|-------------|
| `/teacher/gradebook` | `Gradebook` | None (supports `?classId=xxx` query param) | Teacher gradebook view with challenge review, filters by class when classId provided |
| `/lists` | `ListLibrary` | None | View all vocabulary lists |
| `/lists/new` | `ListEditor` | None | Create new vocabulary list |
| `/lists/:listId` | `ListEditor` | `listId` | Edit existing vocabulary list |
| `/classes/:classId` | `ClassDetail` | `classId` | View class details, assign lists, view students, class switcher popover |

### Shared Routes (accessible to both teachers and students):
- `/` - Dashboard (renders differently based on role)
- `/study/:listId` - Study session (students only in practice)
- `/test/:listId` - MCQ test (students only)
- `/typed-test/:listId` - Typed test (students only)
- `/gradebook` - Student gradebook view

---

## 2. Dashboard.jsx Teacher Section Navigation

### Header Actions:
- **Gradebook Button** → `/teacher/gradebook`
  - Location: Top right, next to "Create New Class"
  - Style: Ghost button with ClipboardList icon
  
- **Create New Class Button** → Opens modal
  - Location: Top right
  - Style: Primary accent (orange) button
  - Action: Opens `CreateClassModal`

### My Classes Section:
- **Open Class Link** → `/classes/:classId`
  - Location: Each class card
  - Style: Blue outlined button with ExternalLink icon
  - Text: "Open Class"

- **Delete Class Button** → Action (no navigation)
  - Location: Top right of each class card
  - Style: Icon button (Trash2)

- **Refresh Button** → Action (reloads classes)
  - Location: Section header
  - Style: Icon button (RefreshCw)

### My Vocabulary Lists Section:
- **View All Lists Link** → `/lists`
  - Location: Section header
  - Style: Ghost button with BookOpen icon
  - Text: "View All Lists"

- **Create New List Link** → `/lists/new`
  - Location: Section header
  - Style: Primary accent (orange) button with Plus icon
  - Text: "Create New List"

- **Edit List Link** → `/lists/:listId`
  - Location: Each list card
  - Style: Blue outlined button with ExternalLink icon
  - Text: "Edit List"

- **Download PDF Button** → Action (no navigation)
  - Location: Each list card
  - Style: Outlined button with FileText icon

- **Delete List Button** → Action (no navigation)
  - Location: Top right of each list card
  - Style: Icon button (Trash2)

---

## 3. ClassDetail.jsx Navigation

### Route: `/classes/:classId`

### Navigation Options:
- **BackButton Component** → `/`
  - Location: Top of page
  - Text: "← Back to Dashboard"
  - Style: Link with arrow icon

- **Class Name (Clickable)** → Opens popover menu
  - Location: Header, class name heading
  - Style: Clickable button with chevron icon (only shows if multiple classes)
  - Action: Opens class switcher popover
  - Popover shows all teacher classes, highlights current class
  - Clicking a class navigates to that class's detail page

- **Manage Lists Link** → `/lists`
  - Location: Header actions
  - Style: Outlined button
  - Text: "Manage Lists"

- **Gradebook Tab Link** → `/teacher/gradebook?classId=${classId}`
  - Location: Gradebook tab content
  - Style: Primary blue button with ClipboardList icon
  - Text: "Open Gradebook"
  - Action: Opens filtered gradebook view for this class

- **Error State Back Button** → `navigate(-1)`
  - Location: Error screen
  - Text: "Go Back"
  - Uses browser history

### Features Available:
- View class name and join code
- **Class Switcher Popover**: Click class name to switch between classes (if multiple classes exist)
- Assign lists to class (via `AssignListModal`)
- View assigned lists with settings (pace, test mode, etc.)
- View class members (students)
- Link to filtered gradebook view
- Unassign lists from class
- Update assignment settings (pace, testOptionsCount, testMode)

### Tabs:
- **Lists Tab** (`activeTab === 'lists'`): Shows assigned lists
- **Students Tab** (`activeTab === 'students'`): Shows enrolled students
- **Gradebook Tab** (`activeTab === 'gradebook'`): Shows link to filtered gradebook (replaces embedded attempts table)

---

## 4. ListEditor.jsx Navigation

### Routes:
- `/lists/new` - Create mode (`mode="create"`)
- `/lists/:listId` - Edit mode (default)

### Navigation Options:
- **BackButton Component** → `/`
  - Location: Top of page
  - Text: "← Back to Dashboard"
  - Style: Link with arrow icon

- **After Creating List** → `/lists/:listId`
  - Action: Auto-navigates after successful creation
  - Delay: 600ms (shows success message first)

### Features Available:
- Create new vocabulary list
- Edit list title and description
- Add/edit/delete words
- Import words from CSV/text
- View word count

---

## 5. ListLibrary.jsx Navigation

### Route: `/lists`

### Navigation Options:
- **Create New List Button** → `/lists/new`
  - Location: Header actions
  - Style: Primary blue button
  - Text: "Create New List"

- **Back to Dashboard Button** → `/`
  - Location: Header actions
  - Style: Outlined button
  - Text: "Back to Dashboard"

- **Edit List Link** → `/lists/:listId`
  - Location: Each list card
  - Style: Text link with arrow
  - Text: "Edit List →"

### Features Available:
- View all vocabulary lists
- See word count for each list
- Navigate to edit individual lists

---

## 6. Gradebook.jsx Navigation

### Routes:
- `/teacher/gradebook` - Teacher view (with challenge review)
- `/gradebook` - Student view (with challenge submission)

### URL Parameters:
- `?classId=xxx` - Filters gradebook to specific class (teacher only)
  - When present, class filter is locked and cannot be removed
  - Class name is displayed as a label instead of dropdown

### Navigation Options:
- **Back to Dashboard Button** → `/`
  - Location: Page header
  - Style: Ghost/secondary button

### Features Available:
- Filter by Class, List, Date, Name (teacher only)
- Filter by Class, List, Date (student only)
- View attempt details in slide-out drawer
- Export to Excel
- Pagination with configurable page size
- Challenge review (teacher) / Challenge submission (student)

---

## 7. Navigation Flow Diagram

```
Dashboard (Teacher) - /
│
├── Gradebook Button → /teacher/gradebook
│   └── Gradebook (Teacher Mode)
│       ├── Filter by Class, List, Date, Name
│       ├── View attempt details
│       ├── Review challenges (Accept/Reject)
│       └── URL param ?classId=xxx → Filters to specific class
│
├── Create New Class Button → Modal
│   └── Creates class → Stays on Dashboard
│
├── My Classes Section
│   └── Open Class Link → /classes/:classId
│       └── ClassDetail
│           ├── BackButton → /
│           ├── Class Name (Clickable) → Popover
│           │   └── Switch to other classes
│           ├── Manage Lists Link → /lists
│           ├── Assign List Modal → Assigns list to class
│           ├── Lists Tab
│           │   ├── View assigned lists
│           │   ├── Update settings (pace, test mode)
│           │   └── Unassign lists
│           ├── Students Tab
│           │   └── View enrolled students
│           └── Gradebook Tab
│               └── Link → /teacher/gradebook?classId=xxx
│
└── My Vocabulary Lists Section
    ├── View All Lists Link → /lists
    │   └── ListLibrary
    │       ├── Back to Dashboard → /
    │       ├── Create New List → /lists/new
    │       └── Edit List Link → /lists/:listId
    │
    ├── Create New List Link → /lists/new
    │   └── ListEditor (Create Mode)
    │       ├── BackButton → /
    │       └── After creation → /lists/:listId
    │
    └── Edit List Link → /lists/:listId
        └── ListEditor (Edit Mode)
            ├── BackButton → /
            ├── Add/Edit/Delete words
            └── Import words
```

---

## 8. Navigation Patterns Summary

### Common Patterns:
1. **BackButton Component**: Used in `ClassDetail` and `ListEditor`
   - Always links to `/` (Dashboard)
   - Consistent styling across pages

2. **Header Actions**: Most pages have action buttons in the header
   - Primary actions (create, save) use accent colors
   - Secondary actions (back, cancel) use outlined/ghost styles

3. **Card-based Navigation**: Dashboard uses cards with action buttons
   - "Open Class" / "Edit List" buttons on cards
   - Delete actions as icon buttons

4. **Modal-based Actions**: Some actions use modals instead of navigation
   - Create Class (stays on Dashboard)
   - Assign List (stays on ClassDetail)

5. **Popover Menus**: Contextual navigation without leaving page
   - Class switcher in ClassDetail header
   - Shows all classes, highlights current

6. **URL-based Filtering**: Gradebook supports query parameters
   - `?classId=xxx` locks class filter
   - Enables deep linking to filtered views

### Recent Enhancements:
- **Class Switcher Popover**: Added to ClassDetail header for quick class switching
- **Filtered Gradebook Links**: ClassDetail gradebook tab links to filtered gradebook view
- **URL Parameter Support**: Gradebook reads `classId` from URL to auto-filter

### Recommendations:
1. ✅ **Implemented**: Class switcher popover in ClassDetail
2. ✅ **Implemented**: Filtered gradebook links from ClassDetail
3. ✅ **Implemented**: URL parameter support for gradebook filtering
4. Consider adding breadcrumbs for deeper navigation context
5. Add "View Classes Using This List" link in ListEditor
6. Add "View Class" link from Gradebook attempt details

# Specification Files Review & Update Recommendations

**Date:** Current  
**Purpose:** Identify spec files that need updates and missing specs to create

---

## 📋 Existing Spec Files Status

### ✅ Up-to-Date Specs

1. **`UI_DASHBOARD_SPEC.md`** (v2.0)
   - ✅ Recently updated
   - ✅ Includes Teacher Dashboard documentation
   - ✅ Documents Smart CTA, Activity Bar, etc.
   - **Status:** Current

2. **`TEACHER_DASHBOARD_SPEC.md`** (v1.0)
   - ✅ Recently created
   - ✅ Comprehensive teacher pages documentation
   - **Status:** Current

3. **`TEACHER_GRADEBOOK_SPEC.md`** (v1.0)
   - ✅ Recently created
   - ✅ Complete gradebook specification
   - **Status:** Current

4. **`CHANGELOG.md`**
   - ✅ Recently created
   - ✅ Documents recent changes
   - **Status:** Current

5. **`DATA_STRUCTURE.md`**
   - ✅ Uses `weeklyGoal` (correct)
   - ✅ Documents `assignments` map structure
   - ✅ Comprehensive data structure documentation
   - **Status:** Current

---

## ⚠️ Specs Needing Updates

### 1. `vocaboost_tech_spec.md`

**Issues Found:**
- ❌ Line 50: Still shows `"dailyGoal": 20` instead of `"weeklyGoal": 100`
- ❌ Missing Teacher Gradebook route (`/teacher/gradebook`)
- ❌ May need updates for recent UI changes

**Recommended Updates:**
1. Change `dailyGoal` to `weeklyGoal` in schema example
2. Add Teacher Gradebook route to routing section
3. Update any outdated UI references

**Priority:** Medium

---

### 2. `PROJECT_CONTEXT.md`

**Issues Found:**
- ❌ Line 16: States "Activity Bar: 7-day streak visualization using MasterySquares"
  - **Reality:** Activity Bar uses a bar chart, not MasterySquares
- ❌ May have other outdated information about dashboard implementation

**Recommended Updates:**
1. Update Activity Bar description to reflect bar chart implementation
2. Review and update any other outdated implementation details
3. Add note about Teacher Dashboard redesign
4. Mention Teacher Gradebook feature

**Priority:** Medium

---

### 3. `README.md`

**Issues Found:**
- ❌ Currently just the default Vite template
- ❌ No project-specific information
- ❌ No setup instructions
- ❌ No feature overview

**Recommended Updates:**
1. Replace with actual project README
2. Add project description
3. Add setup/installation instructions
4. Add feature overview
5. Link to relevant spec files
6. Add development guidelines

**Priority:** High (Important for onboarding)

---

## 📝 Missing Spec Files to Create

### 1. **`ROUTING_SPEC.md`** (Recommended)

**Purpose:** Document all routes, their protection, and navigation patterns

**Should Include:**
- Complete route table with paths, components, and protection
- Route protection patterns (`PrivateRoute`, `TeacherRoute`)
- Navigation flows between pages
- Route parameters and query strings
- Redirect rules

**Routes to Document:**
- `/` - Dashboard (role-based)
- `/login` - Login page
- `/signup` - Signup page
- `/lists` - List Library (teacher)
- `/lists/new` - Create List (teacher)
- `/lists/:listId` - Edit List (teacher)
- `/classes/:classId` - Class Detail (teacher)
- `/study/:listId` - Study Session (student)
- `/test/:listId` - Take Test (student)
- `/gradebook` - Student Gradebook
- `/teacher/gradebook` - Teacher Gradebook (teacher)

**Priority:** Medium

---

### 2. **`STUDENT_PAGES_SPEC.md`** (Recommended)

**Purpose:** Document all student-facing pages

**Should Include:**
- StudySession page specification
- TakeTest page specification
- Student Gradebook page specification
- Login/Signup pages
- Common patterns and components

**Priority:** Medium

---

### 3. **`COMPONENT_LIBRARY_SPEC.md`** (Optional)

**Purpose:** Document reusable components

**Should Include:**
- All shared components (modals, cards, buttons, etc.)
- Component props and usage
- Design system integration
- Component examples

**Components to Document:**
- `CreateClassModal`
- `AssignListModal`
- `ImportWordsModal`
- `StudySelectionModal`
- `LoadingSpinner`
- `BackButton`
- `Flashcard`
- `MasterySquares`
- `MasteryBars`
- `CollapsibleCard`

**Priority:** Low (Nice to have)

---

### 4. **`API_REFERENCE.md`** (Optional)

**Purpose:** Document all database service functions

**Should Include:**
- Function signatures
- Parameters and return types
- Usage examples
- Error handling
- Data transformations

**Priority:** Low (Could be part of existing specs)

---

## 🔧 Quick Fixes Needed

### Immediate Updates

1. **`vocaboost_tech_spec.md`:**
   ```diff
   - "dailyGoal": 20,
   + "weeklyGoal": 100,
   ```

2. **`PROJECT_CONTEXT.md`:**
   ```diff
   - **Activity Bar:** 7-day streak visualization using MasterySquares
   + **Activity Bar:** 7-day bar chart showing word activity with hover tooltips
   ```

3. **`README.md`:**
   - Replace entire file with project-specific content

---

## 📊 Summary

### Update Priority

**High Priority:**
- `README.md` - Replace with actual project documentation

**Medium Priority:**
- `vocaboost_tech_spec.md` - Fix `dailyGoal` → `weeklyGoal`, add Teacher Gradebook route
- `PROJECT_CONTEXT.md` - Update Activity Bar description, add recent changes
- Create `ROUTING_SPEC.md` - Document all routes
- Create `STUDENT_PAGES_SPEC.md` - Document student pages

**Low Priority:**
- Create `COMPONENT_LIBRARY_SPEC.md` - Component documentation
- Create `API_REFERENCE.md` - Service function reference

---

## ✅ Action Items

1. [ ] Update `vocaboost_tech_spec.md` - Fix dailyGoal and add Teacher Gradebook
2. [ ] Update `PROJECT_CONTEXT.md` - Fix Activity Bar description
3. [ ] Replace `README.md` with project documentation
4. [ ] Create `ROUTING_SPEC.md`
5. [ ] Create `STUDENT_PAGES_SPEC.md`
6. [ ] (Optional) Create `COMPONENT_LIBRARY_SPEC.md`

---

**Last Updated:** Current


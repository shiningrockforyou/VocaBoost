# Button Migration Audit

This document catalogs all inline button elements that need to be migrated to standardized Button, IconButton, NavButton, TabButton, or LinkButton components.

---

## Section 1: Summary by File

| File | Total Buttons | Using Components | Inline (Need Migration) |
|------|---------------|------------------|------------------------|
| Dashboard.jsx | 17 | 0 | 17 |
| ClassDetail.jsx | 12 | 3 | 9 |
| ListEditor.jsx | 6 | 0 | 6 |
| ListLibrary.jsx | 1 | 0 | 1 |
| TakeTest.jsx | 4 | 0 | 4 |
| TypedTest.jsx | 4 | 0 | 4 |
| Login.jsx | 2 | 0 | 2 |
| Signup.jsx | 2 | 0 | 2 |
| StudySession.jsx | 4 | 0 | 4 |
| Gradebook.jsx | 13 | 0 | 13 |
| HeaderBar.jsx | 2 | 0 | 2 |
| Flashcard.jsx | 1 | 0 | 1 |
| CollapsibleCard.jsx | 1 | 0 | 1 |
| **TOTAL** | **69** | **3** | **66** |

---

## Section 2: Detailed Migration List by File

### Dashboard.jsx

#### Button 1: Create New Class
- **Line:** 351-358
- **Element:** `<button>`
- **Current classes:** `h-12 flex items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-accent-hover transition-colors`
- **Recommended component:** `<Button variant="primary" size="lg">`
- **Priority:** High

#### Button 2: Refresh Classes
- **Line:** 367-374
- **Element:** `<button>`
- **Current classes:** `h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-primary hover:bg-blue-50 transition-colors`
- **Recommended component:** `<IconButton variant="default" size="md">`
- **Priority:** Medium

#### Button 3: Delete Class
- **Line:** 411-423
- **Element:** `<button>`
- **Current classes:** `h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60`
- **Recommended component:** `<IconButton variant="danger" size="sm">`
- **Priority:** Medium

#### Button 4: Open Class (Link)
- **Line:** 425-431
- **Element:** `<Link>`
- **Current classes:** `h-10 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand-primary hover:bg-blue-100 transition-colors`
- **Recommended component:** `<LinkButton variant="default">` or `<Button variant="secondary" size="md" to={...}>`
- **Priority:** High

#### Button 5: View All Lists (Link)
- **Line:** 451-457
- **Element:** `<Link>`
- **Current classes:** `h-12 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors`
- **Recommended component:** `<Button variant="outline" size="lg" to={...}>`
- **Priority:** High

#### Button 6: Create New List (Link)
- **Line:** 458-464
- **Element:** `<Link>`
- **Current classes:** `h-12 flex items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-accent-hover transition-colors`
- **Recommended component:** `<Button variant="primary" size="lg" to={...}>`
- **Priority:** High

#### Button 7: Delete List
- **Line:** 496-508
- **Element:** `<button>`
- **Current classes:** `h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60`
- **Recommended component:** `<IconButton variant="danger" size="sm">`
- **Priority:** Medium

#### Button 8: Edit List (Link)
- **Line:** 512-518
- **Element:** `<Link>`
- **Current classes:** `h-10 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand-primary hover:bg-blue-100 transition-colors`
- **Recommended component:** `<LinkButton variant="default" to={...}>` or `<Button variant="secondary" size="md" to={...}>`
- **Priority:** High

#### Button 9: Download PDF
- **Line:** 519-534
- **Element:** `<button>`
- **Current classes:** `h-10 inline-flex items-center gap-1.5 rounded-xl border border-brand-primary bg-white px-3 text-sm font-semibold text-brand-primary transition hover:bg-blue-50 disabled:opacity-60`
- **Recommended component:** `<Button variant="secondary" size="md">`
- **Priority:** Medium

#### Button 10: Study Now (Smart CTA)
- **Line:** 864-889
- **Element:** `<button>`
- **Current classes:** Dynamic classes based on `smartCTAStatus` (behind/ahead/normal) with conditional colors
- **Recommended component:** Keep inline (special dynamic styling)
- **Priority:** Skip (Keep Inline)

#### Button 11: Take Test (Student Dashboard)
- **Line:** 890-909
- **Element:** `<button>`
- **Current classes:** `w-full h-14 flex items-center justify-center gap-2 rounded-xl bg-transparent text-white font-bold border-2 border-white hover:bg-white/20 transition-all active:scale-95`
- **Recommended component:** Keep inline (special gradient background styling)
- **Priority:** Skip (Keep Inline)

#### Button 12: Study Now (Link)
- **Line:** 1236-1240
- **Element:** `<Link>`
- **Current classes:** `h-12 flex items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-accent-hover shadow-brand-accent/30`
- **Recommended component:** `<Button variant="primary" size="lg" to={...}>`
- **Priority:** High

#### Button 13: Take Test (Link)
- **Line:** 1250-1254
- **Element:** `<Link>`
- **Current classes:** `h-12 flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-heading font-bold text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all active:scale-95`
- **Recommended component:** `<Button variant="primary-blue" size="lg" to={...}>`
- **Priority:** High

#### Button 14: Typed Test (Link)
- **Line:** 1257-1262
- **Element:** `<Link>`
- **Current classes:** `h-12 flex items-center justify-center gap-2 rounded-xl border border-brand-primary bg-white px-4 text-sm font-heading font-bold text-brand-primary hover:bg-blue-50 shadow-sm transition-all active:scale-95`
- **Recommended component:** `<Button variant="secondary" size="lg" to={...}>`
- **Priority:** High

#### Button 15: Download PDF (Student)
- **Line:** 1267-1283
- **Element:** `<button>`
- **Current classes:** `h-12 flex items-center justify-center gap-1.5 rounded-xl border border-brand-primary bg-white px-4 text-sm font-semibold text-brand-primary transition hover:bg-blue-50 disabled:opacity-60`
- **Recommended component:** `<Button variant="secondary" size="lg">`
- **Priority:** Medium

#### Button 16: Join Class
- **Line:** 1097-1103
- **Element:** `<button>` (form submit)
- **Current classes:** `h-12 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 transition hover:bg-brand-primary/90 disabled:opacity-60`
- **Recommended component:** `<Button variant="primary-blue" size="lg" type="submit">`
- **Priority:** High

---

### ClassDetail.jsx

#### Button 1: Class Switcher Toggle
- **Line:** 335-351
- **Element:** `<button>`
- **Current classes:** `flex items-center gap-2 text-3xl font-heading font-bold text-slate-900 hover:text-brand-primary transition-colors`
- **Recommended component:** Keep inline (special header styling)
- **Priority:** Skip (Keep Inline)

#### Button 2: Manage Lists (Link)
- **Line:** 393-398
- **Element:** `<Link>`
- **Current classes:** `rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md" to={...}>`
- **Priority:** Medium

#### Button 3: Tab - Assigned Lists
- **Line:** 415-425
- **Element:** `<button>`
- **Current classes:** `px-4 py-2 text-sm font-semibold transition` with conditional `border-b-2 border-blue-600 text-blue-600` or `text-slate-600 hover:text-slate-900`
- **Recommended component:** `<TabButton active={activeTab === 'lists'}>`
- **Priority:** Medium

#### Button 4: Tab - Students
- **Line:** 426-436
- **Element:** `<button>`
- **Current classes:** `px-4 py-2 text-sm font-semibold transition` with conditional `border-b-2 border-blue-600 text-blue-600` or `text-slate-600 hover:text-slate-900`
- **Recommended component:** `<TabButton active={activeTab === 'students'}>`
- **Priority:** Medium

#### Button 5: Tab - Gradebook
- **Line:** 437-447
- **Element:** `<button>`
- **Current classes:** `px-4 py-2 text-sm font-semibold transition` with conditional `border-b-2 border-blue-600 text-blue-600` or `text-slate-600 hover:text-slate-900`
- **Recommended component:** `<TabButton active={activeTab === 'gradebook'}>`
- **Priority:** Medium

#### Button 6: Assign List
- **Line:** 458-465
- **Element:** `<button>`
- **Current classes:** `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** High

#### Button 7: Download PDF
- **Line:** 490-533
- **Element:** `<button>`
- **Current classes:** `inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60`
- **Recommended component:** `<Button variant="outline" size="sm">`
- **Priority:** Medium

#### Button 8: Edit Settings
- **Line:** 537-557
- **Element:** `<button>`
- **Current classes:** `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700`
- **Recommended component:** `<IconButton variant="ghost" size="sm">`
- **Priority:** Medium

#### Button 9: Unassign List
- **Line:** 558-595
- **Element:** `<button>`
- **Current classes:** `rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60`
- **Recommended component:** `<IconButton variant="danger" size="sm">`
- **Priority:** Medium

#### Button 10: Copy Join Code
- **Line:** 662-668
- **Element:** `<button>`
- **Current classes:** `rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="sm">`
- **Priority:** Low

---

### ListEditor.jsx

#### Button 1: Create/Save List
- **Line:** 309-315
- **Element:** `<button>` (form submit)
- **Current classes:** `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60`
- **Recommended component:** `<Button variant="primary-blue" size="md" type="submit">`
- **Priority:** High

#### Button 2: Add Word
- **Line:** 427-439
- **Element:** `<button>` (form submit)
- **Current classes:** `flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60`
- **Recommended component:** `<Button variant="success" size="md" type="submit">`
- **Priority:** High

#### Button 3: Cancel Edit
- **Line:** 441-447
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 4: Import Words
- **Line:** 449-455
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 5: Edit Word
- **Line:** 491-511
- **Element:** `<button>`
- **Current classes:** `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600`
- **Recommended component:** `<IconButton variant="default" size="sm">`
- **Priority:** Medium

#### Button 6: Delete Word
- **Line:** 512-532
- **Element:** `<button>`
- **Current classes:** `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600`
- **Recommended component:** `<IconButton variant="danger" size="sm">`
- **Priority:** Medium

---

### ListLibrary.jsx

#### Button 1: Create New List
- **Line:** 50-56
- **Element:** `<button>`
- **Current classes:** `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** High

---

### TakeTest.jsx

#### Button 1: Try Again
- **Line:** 161-167
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** Medium

#### Button 2: Go Back (Error)
- **Line:** 168-174
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 3: Go Back (No Content)
- **Line:** 220-226
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 4: Quit to Dashboard
- **Line:** 258-265
- **Element:** `<button>`
- **Current classes:** `rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60`
- **Recommended component:** `<Button variant="outline" size="sm">`
- **Priority:** Medium

#### Button 5: Play Audio
- **Line:** 281-288
- **Element:** `<button>`
- **Current classes:** `mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-60`
- **Recommended component:** Keep inline (special rounded-full styling)
- **Priority:** Skip (Keep Inline)

#### Button 6-9: MCQ Option Buttons
- **Line:** 302-315
- **Element:** `<button>` (multiple)
- **Current classes:** Dynamic classes with `min-h-[80px] rounded-2xl border-2 p-4 text-left transition-all` and conditional selected state styling
- **Recommended component:** Keep inline (special MCQ option card styling)
- **Priority:** Skip (Keep Inline)

---

### TypedTest.jsx

#### Button 1: Try Again
- **Line:** 223-229
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** Medium

#### Button 2: Go Back (Error)
- **Line:** 230-236
- **Element:** `<button>`
- **Current classes:** `mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 3: Go Back (No Content)
- **Line:** 249-255
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 4: Submit Test
- **Line:** 288-295
- **Element:** `<button>`
- **Current classes:** `rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** High

---

### Login.jsx

#### Button 1: Continue (Form Submit)
- **Line:** 104-110
- **Element:** `<button>` (form submit)
- **Current classes:** `w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70`
- **Recommended component:** `<Button variant="primary-blue" size="lg" type="submit">`
- **Priority:** High

#### Button 2: Continue with Google
- **Line:** 119-150
- **Element:** `<button>`
- **Current classes:** `w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-not-allowed disabled:opacity-70`
- **Recommended component:** `<Button variant="outline" size="lg">`
- **Priority:** High

---

### Signup.jsx

#### Button 1: Create Account (Form Submit)
- **Line:** 154-160
- **Element:** `<button>` (form submit)
- **Current classes:** `w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-70`
- **Recommended component:** `<Button variant="primary" size="lg" type="submit">` (Note: May need dark variant)
- **Priority:** High

#### Button 2: Continue with Google
- **Line:** 169-200
- **Element:** `<button>`
- **Current classes:** `w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-not-allowed disabled:opacity-70`
- **Recommended component:** `<Button variant="outline" size="lg">`
- **Priority:** High

---

### StudySession.jsx

#### Button 1: Go Back (Error)
- **Line:** 107-113
- **Element:** `<button>`
- **Current classes:** `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 2: Back to Dashboard
- **Line:** 154-160
- **Element:** `<button>`
- **Current classes:** `mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700`
- **Recommended component:** `<Button variant="primary-blue" size="lg">`
- **Priority:** High

#### Button 3: Again (Rating)
- **Line:** 201-208
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-2xl bg-red-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-red-100 transition hover:bg-red-600 disabled:opacity-60`
- **Recommended component:** Keep inline (special flashcard rating styling)
- **Priority:** Skip (Keep Inline)

#### Button 4: Hard (Rating)
- **Line:** 209-216
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-2xl bg-amber-400 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-100 transition hover:bg-amber-500 disabled:opacity-60`
- **Recommended component:** Keep inline (special flashcard rating styling)
- **Priority:** Skip (Keep Inline)

#### Button 5: Easy (Rating)
- **Line:** 217-224
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:opacity-60`
- **Recommended component:** Keep inline (special flashcard rating styling)
- **Priority:** Skip (Keep Inline)

---

### Gradebook.jsx

#### Button 1-2: Category Filter Buttons (Class/List/Date/Name)
- **Line:** 510-525, 530-544
- **Element:** `<button>` (multiple)
- **Current classes:** `h-10 px-4 rounded-xl border font-medium transition-colors` with conditional active state
- **Recommended component:** Keep inline (special filter button styling with icons)
- **Priority:** Skip (Keep Inline) - OR create FilterButton component

#### Button 3: Add Filter
- **Line:** 597-603
- **Element:** `<button>`
- **Current classes:** `h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors`
- **Recommended component:** `<Button variant="primary" size="md">`
- **Priority:** High

#### Button 4: Remove Tag (X)
- **Line:** 621-627
- **Element:** `<button>`
- **Current classes:** `hover:opacity-70 transition-opacity`
- **Recommended component:** `<IconButton variant="ghost" size="sm">`
- **Priority:** Low

#### Button 5: Check All / Uncheck All
- **Line:** 658-671
- **Element:** `<button>`
- **Current classes:** `h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 6: Export
- **Line:** 672-679
- **Element:** `<button>`
- **Current classes:** `h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors flex items-center gap-2`
- **Recommended component:** `<Button variant="primary" size="md">`
- **Priority:** High

#### Button 7: Retry (Error)
- **Line:** 692-700
- **Element:** `<button>`
- **Current classes:** `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700`
- **Recommended component:** `<Button variant="primary-blue" size="md">`
- **Priority:** Medium

#### Button 8: View Details
- **Line:** 827-858
- **Element:** `<button>`
- **Current classes:** `text-sm font-semibold text-brand-primary hover:text-brand-accent transition-colors`
- **Recommended component:** `<LinkButton variant="default">`
- **Priority:** High

#### Button 9: Previous Page
- **Line:** 868-875
- **Element:** `<button>`
- **Current classes:** `h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 10: Next Page
- **Line:** 880-887
- **Element:** `<button>`
- **Current classes:** `h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`
- **Recommended component:** `<Button variant="outline" size="md">`
- **Priority:** Medium

#### Button 11: Close Drawer
- **Line:** 925-938
- **Element:** `<button>`
- **Current classes:** `h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors`
- **Recommended component:** `<IconButton variant="close" size="md">`
- **Priority:** Medium

#### Button 12: Accept Challenge
- **Line:** 1054-1069
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition`
- **Recommended component:** `<Button variant="success" size="md">`
- **Priority:** High

#### Button 13: Reject Challenge
- **Line:** 1070-1085
- **Element:** `<button>`
- **Current classes:** `flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition`
- **Recommended component:** `<Button variant="danger" size="md">`
- **Priority:** High

#### Button 14: Challenge (Student)
- **Line:** 1123-1129
- **Element:** `<button>`
- **Current classes:** `text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded transition`
- **Recommended component:** `<LinkButton variant="default">`
- **Priority:** High

---

### HeaderBar.jsx

#### Button 1: Classes Dropdown Toggle
- **Line:** 85-100
- **Element:** `<button>`
- **Current classes:** `h-12 flex items-center gap-2 px-5 rounded-xl shadow-sm font-heading font-bold transition-colors` with conditional active state
- **Recommended component:** Keep inline (special dropdown button with active state)
- **Priority:** Skip (Keep Inline) - OR create DropdownButton component

#### Button 2: Sign Out
- **Line:** 195-202
- **Element:** `<button>`
- **Current classes:** `w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors`
- **Recommended component:** `<Button variant="ghost" size="md" className="text-red-600 hover:bg-red-50">` (may need danger variant)
- **Priority:** Medium

---

### Flashcard.jsx

#### Button 1: Play Audio
- **Line:** 146-156
- **Element:** `<button>`
- **Current classes:** `inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60`
- **Recommended component:** Keep inline (special full-width card button styling)
- **Priority:** Skip (Keep Inline)

---

### CollapsibleCard.jsx

#### Button 1: Show More / Show Less
- **Line:** 51-57
- **Element:** `<button>`
- **Current classes:** `rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50`
- **Recommended component:** `<Button variant="outline" size="sm">`
- **Priority:** Low

---

## Section 3: Migration Priority

### High Priority (User-facing CTAs) - 28 buttons

**Primary Actions:**
- Create New Class (Dashboard)
- Create New List (Dashboard, ListLibrary)
- Assign List (ClassDetail)
- Join Class (Dashboard)
- Study Now (Dashboard - Link)
- Take Test (Dashboard - Link)
- Typed Test (Dashboard - Link)
- Submit Test (TypedTest)
- Create/Save List (ListEditor)
- Add Word (ListEditor)
- Continue (Login)
- Create Account (Signup)
- Back to Dashboard (StudySession)
- Add Filter (Gradebook)
- Export (Gradebook)
- View Details (Gradebook)
- Accept Challenge (Gradebook)
- Reject Challenge (Gradebook)
- Challenge (Gradebook - Student)

**Secondary Actions:**
- Open Class (Dashboard - Link)
- Edit List (Dashboard - Link)
- Continue with Google (Login, Signup)

### Medium Priority (Secondary actions) - 20 buttons

**Cancel/Back:**
- Go Back (TakeTest - 2 instances)
- Go Back (TypedTest - 2 instances)
- Go Back (StudySession)
- Cancel Edit (ListEditor)
- Import Words (ListEditor)

**Edit/Delete:**
- Refresh Classes (Dashboard)
- Delete Class (Dashboard)
- Delete List (Dashboard)
- Edit Settings (ClassDetail)
- Unassign List (ClassDetail)
- Edit Word (ListEditor)
- Delete Word (ListEditor)

**Navigation:**
- Tab buttons (ClassDetail - 3 instances)
- Check All / Uncheck All (Gradebook)
- Previous/Next Page (Gradebook - 2 instances)
- Close Drawer (Gradebook)
- Sign Out (HeaderBar)

**Utility:**
- Try Again (TakeTest, TypedTest - 2 instances)
- Retry (Gradebook)
- Download PDF (Dashboard - 2 instances, ClassDetail)

### Low Priority (Utility) - 4 buttons

- Copy Join Code (ClassDetail)
- Remove Tag (Gradebook)
- Show More / Show Less (CollapsibleCard)
- Quit to Dashboard (TakeTest)

### Skip (Keep Inline) - 14 buttons

**Special Styling:**
- Study Now Smart CTA (Dashboard) - Dynamic color based on status
- Take Test (Dashboard - Student) - Gradient background with border
- Play Audio (TakeTest, Flashcard) - Rounded-full or full-width card styling
- MCQ Option Buttons (TakeTest) - Card-style options with selection state
- Flashcard Rating Buttons (StudySession) - Again/Hard/Easy with special colors
- Category Filter Buttons (Gradebook) - Filter buttons with icons
- Classes Dropdown Toggle (HeaderBar) - Dropdown with active state
- Class Switcher Toggle (ClassDetail) - Header text button

---

## Section 4: Recommended Component for Each Pattern

| Inline Pattern | Recommended Component |
|----------------|----------------------|
| `bg-brand-accent ... text-white` | `<Button variant="primary">` |
| `bg-brand-primary ... text-white` | `<Button variant="primary-blue">` |
| `bg-blue-600 ... text-white` | `<Button variant="primary-blue">` |
| `bg-slate-900 ... text-white` | `<Button variant="primary">` (may need dark variant) |
| `border border-brand-primary ... text-brand-primary` | `<Button variant="secondary">` |
| `border border-slate-200/300 ... text-slate-700` | `<Button variant="outline">` |
| `bg-red-600 ... text-white` | `<Button variant="danger">` |
| `bg-green-600 ... text-white` | `<Button variant="success">` |
| `bg-emerald-600 ... text-white` | `<Button variant="success">` |
| `h-8 w-8 ... text-slate-400` (icon only) | `<IconButton variant="default">` |
| `h-8 w-8 ... hover:text-red-600` (icon delete) | `<IconButton variant="danger">` |
| `text-brand-primary bg-blue-50` (inline link) | `<LinkButton variant="default">` |
| `text-sm font-semibold text-brand-primary` (text link) | `<LinkButton variant="default">` |
| `border-b-2 border-blue-600` (tab) | `<TabButton active>` |
| `rounded-lg p-1.5 text-slate-500` (icon button) | `<IconButton variant="ghost" size="sm">` |
| `rounded-lg p-1.5 text-red-500` (icon danger) | `<IconButton variant="danger" size="sm">` |

---

## Section 5: Files by Migration Effort

### Quick Wins (< 5 buttons, straightforward) - 4 files

1. **ListLibrary.jsx** - 1 button (Create New List)
2. **CollapsibleCard.jsx** - 1 button (Show More/Less)
3. **Login.jsx** - 2 buttons (Continue, Google)
4. **Signup.jsx** - 2 buttons (Create Account, Google)

**Total:** 6 buttons

### Medium Effort (5-15 buttons) - 7 files

1. **TakeTest.jsx** - 4 buttons (Try Again, Go Back x2, Quit)
2. **TypedTest.jsx** - 4 buttons (Try Again, Go Back x2, Submit)
3. **StudySession.jsx** - 2 buttons (Go Back, Back to Dashboard)
4. **ListEditor.jsx** - 6 buttons (Create/Save, Add Word, Cancel, Import, Edit, Delete)
5. **ClassDetail.jsx** - 9 buttons (Manage Lists, Tabs x3, Assign, Download PDF, Edit Settings, Unassign, Copy)
6. **HeaderBar.jsx** - 1 button (Sign Out)
7. **Flashcard.jsx** - 0 buttons (all skipped)

**Total:** 26 buttons

### Large Effort (15+ buttons or complex) - 2 files

1. **Dashboard.jsx** - 17 buttons (many Links, CTAs, Delete buttons)
2. **Gradebook.jsx** - 13 buttons (filters, pagination, challenge buttons, drawer controls)

**Total:** 30 buttons

---

## Summary

- **Total buttons to migrate:** 52 (excluding 14 skipped)
- **High priority:** 28 buttons
- **Medium priority:** 20 buttons
- **Low priority:** 4 buttons
- **Skipped (keep inline):** 14 buttons

**Estimated migration time:**
- Quick wins: ~30 minutes
- Medium effort: ~2-3 hours
- Large effort: ~4-5 hours
- **Total:** ~7-8 hours


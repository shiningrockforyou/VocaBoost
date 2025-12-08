# Button Radius Audit

## Section 1: Button Components

| Component | Current Radius Class | Pixel Value | Notes |
|-----------|---------------------|-------------|-------|
| Button.jsx | `rounded-xl` | 0.75rem (12px) | Hardcoded, should use `rounded-button` token |
| IconButton.jsx | `rounded-lg` (default), `rounded-full` (close) | 0.5rem (8px), full | Hardcoded, close variant uses full circle |
| TagButton.jsx | `rounded-lg` | 0.5rem (8px) | Hardcoded, smaller tag buttons |
| NavButton.jsx | `rounded-xl` | 0.75rem (12px) | Hardcoded, should use `rounded-button` token |
| LinkButton.jsx | `rounded-lg` | 0.5rem (8px) | Hardcoded, inline link-style buttons |
| CardButton.jsx | None | N/A | No radius class (relies on child Card component) |

---

## Section 2: Inline Buttons by File

### src/pages/Dashboard.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 856 | `<button>` | `rounded-xl` | Smart CTA button (Study Now, Take Test) |
| 882 | `<button>` | `rounded-xl` | Alternative CTA button |
| 1089 | `<button>` | `rounded-xl` | Join class button |
| 1125 | `<button>` | `rounded-xl` | Join class button (alternative) |

**Summary:** 4 inline buttons, all use `rounded-xl` (0.75rem / 12px)

---

### src/pages/Gradebook.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 682 | Category button | `rounded-xl` | Filter category button |
| 703 | Category button | `rounded-xl` | Filter category button (locked class) |
| 949 | Export button | `rounded-xl` | Export to Excel button |
| 982 | Clear filters button | `rounded-xl` | Clear all filters button |
| 1146 | Pagination button | `rounded-xl` | Previous page button |
| 1158 | Pagination button | `rounded-xl` | Next page button |
| 1209 | Close drawer button | `rounded-lg` | Close detail drawer button |
| 1340 | Accept challenge button | `rounded-lg` | Accept challenge action |
| 1356 | Reject challenge button | `rounded-lg` | Reject challenge action |

**Summary:** 9 inline buttons
- 6 use `rounded-xl` (0.75rem / 12px)
- 3 use `rounded-lg` (0.5rem / 8px)

---

### src/pages/ClassDetail.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 392 | `<button>` | `rounded-lg` | Unassign list button |
| 457 | Class switcher item | `rounded-lg` | Class switcher popover item |

**Summary:** 2 inline buttons, both use `rounded-lg` (0.5rem / 8px)

---

### src/pages/StudySession.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 197 | Again button | `rounded-2xl` | Study result button (Again) |
| 206 | Hard button | `rounded-2xl` | Study result button (Hard) |
| 214 | Easy button | `rounded-2xl` | Study result button (Easy) |
| 148 | Download PDF button | `rounded-2xl` | Download PDF button |

**Summary:** 4 inline buttons, all use `rounded-2xl` (1rem / 16px)

---

### src/pages/TakeTest.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 291 | Option button | `rounded-2xl` | MCQ option button |

**Summary:** 1 inline button, uses `rounded-2xl` (1rem / 16px)

---

### src/components/HeaderBar.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 158 | Avatar button | `rounded-xl` | Avatar dropdown trigger |

**Summary:** 1 inline button, uses `rounded-xl` (0.75rem / 12px)

---

### src/components/Flashcard.jsx

| Line | Element | Radius Class | Purpose |
|------|---------|--------------|---------|
| 148 | Download PDF button | `rounded-2xl` | Download PDF button |

**Summary:** 1 inline button, uses `rounded-2xl` (1rem / 16px)

---

### Summary by File

| File | Radius Classes Used | Count |
|------|---------------------|-------|
| Dashboard.jsx | `rounded-xl` | 4 |
| Gradebook.jsx | `rounded-xl`, `rounded-lg` | 9 (6 xl, 3 lg) |
| ClassDetail.jsx | `rounded-lg` | 2 |
| StudySession.jsx | `rounded-2xl` | 4 |
| TakeTest.jsx | `rounded-2xl` | 1 |
| HeaderBar.jsx | `rounded-xl` | 1 |
| Flashcard.jsx | `rounded-2xl` | 1 |

**Total inline buttons:** 22

---

## Section 3: Radius Values Reference

| Class | Value | Equivalent Token | Current Usage |
|-------|-------|------------------|---------------|
| `rounded-lg` | 0.5rem (8px) | `--radius-sm` / `rounded-alert` | IconButton (default), TagButton, LinkButton, small action buttons |
| `rounded-xl` | 0.75rem (12px) | `--radius-md` / `rounded-button` | Button, NavButton, most inline buttons |
| `rounded-2xl` | 1rem (16px) | `--radius-lg` / `rounded-card` | StudySession result buttons, MCQ options, PDF buttons |
| `rounded-3xl` | 1.5rem (24px) | `--radius-xl` / `rounded-card-lg` | Flashcard component |
| `rounded-full` | 50% | N/A | IconButton (close variant) |

---

## Section 4: Issues Found

### 1. **Button Components Not Using Tokens**

- **Button.jsx**: Uses hardcoded `rounded-xl` instead of `rounded-button` token
- **NavButton.jsx**: Uses hardcoded `rounded-xl` instead of `rounded-button` token
- **IconButton.jsx**: Uses hardcoded `rounded-lg` (could use token if one exists for icon buttons)
- **TagButton.jsx**: Uses hardcoded `rounded-lg` (intentional for smaller buttons)
- **LinkButton.jsx**: Uses hardcoded `rounded-lg` (intentional for link-style buttons)

### 2. **Inconsistent Radius Usage**

- **Standard action buttons**: Mix of `rounded-xl` (12px) and `rounded-2xl` (16px)
  - Dashboard CTA buttons: `rounded-xl`
  - StudySession result buttons: `rounded-2xl`
  - TakeTest MCQ options: `rounded-2xl`
  
- **Small action buttons**: Mix of `rounded-lg` (8px) and `rounded-xl` (12px)
  - Gradebook close/pagination buttons: `rounded-xl`
  - Gradebook challenge buttons: `rounded-lg`
  - ClassDetail buttons: `rounded-lg`

### 3. **No Token System Usage**

- **0 components** are currently using the `rounded-button` token
- All button components use hardcoded Tailwind classes
- All inline buttons use hardcoded Tailwind classes

### 4. **Missing Token for Small Buttons**

- No token defined for `rounded-lg` (0.5rem) used by:
  - IconButton (default)
  - TagButton
  - LinkButton
  - Small action buttons

### 5. **Special Cases Not Tokenized**

- `rounded-2xl` (1rem) used for:
  - StudySession result buttons
  - TakeTest MCQ options
  - PDF download buttons
  - Could potentially use `rounded-card` token

- `rounded-full` used for:
  - IconButton (close variant)
  - This is intentional and doesn't need a token

---

## Section 5: Recommendations

### Standard Radius for Each Button Type

| Button Type | Recommended Radius | Token | Rationale |
|-------------|-------------------|-------|------------|
| **Standard Action Buttons** | 0.75rem (12px) | `rounded-button` | Primary CTA buttons, form submissions, main actions |
| **Navigation Buttons** | 0.75rem (12px) | `rounded-button` | Header navigation, tab buttons |
| **Small/Tag Buttons** | 0.5rem (8px) | `rounded-alert` (or new `rounded-button-sm`) | Filter tags, small inline actions, icon buttons |
| **Link-Style Buttons** | 0.5rem (8px) | `rounded-alert` (or new `rounded-button-sm`) | Inline text actions, subtle buttons |
| **Large Action Buttons** | 1rem (16px) | `rounded-card` | Study result buttons, MCQ options, prominent actions |
| **Icon Buttons (Close)** | `rounded-full` | N/A | Modal close buttons, circular icon buttons |

### Migration Priority

1. **High Priority:**
   - Update `Button.jsx` to use `rounded-button` token
   - Update `NavButton.jsx` to use `rounded-button` token
   - Standardize inline action buttons to use `rounded-button` token

2. **Medium Priority:**
   - Create `rounded-button-sm` token for small buttons (0.5rem)
   - Update `IconButton.jsx` (default), `TagButton.jsx`, `LinkButton.jsx` to use new token
   - Standardize small action buttons to use `rounded-button-sm` token

3. **Low Priority:**
   - Consider if large action buttons (StudySession, TakeTest) should use `rounded-card` token
   - Document when to use each radius size

### Proposed Token Additions

Add to `src/index.css` `@theme` block:

```css
--radius-button-sm: 0.5rem;  /* For small buttons, tags, links */
```

Then update Tailwind config to expose:

```css
--radius-button-sm: var(--radius-button-sm);
```

### Standardization Rules

1. **Primary actions** → `rounded-button` (0.75rem)
2. **Secondary/small actions** → `rounded-button-sm` (0.5rem) - if token created
3. **Large/prominent actions** → `rounded-card` (1rem)
4. **Close buttons** → `rounded-full` (50%)

---

## Summary

- **Button Components:** 6 total, 0 using tokens
- **Inline Buttons:** 22 total, 0 using tokens
- **Most Common Radius:** `rounded-xl` (0.75rem / 12px) - used by 11 buttons
- **Token System:** Not being used at all
- **Consistency:** Moderate - similar button types use different radii

**Next Steps:**
1. Update Button.jsx and NavButton.jsx to use `rounded-button` token
2. Create `rounded-button-sm` token for small buttons
3. Migrate inline buttons to use appropriate tokens
4. Document radius usage guidelines


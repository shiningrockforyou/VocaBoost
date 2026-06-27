# Color Usage Audit

## Section 1: Color Usage Summary

| Color | Count | Primary Usage | Proposed Token |
|-------|-------|---------------|----------------|
| `white` | 150+ | Card backgrounds, modals, inputs | `bg-surface` |
| `slate-50` | 80+ | Page backgrounds, empty states | `bg-base` |
| `slate-100` | 60+ | Subtle backgrounds, hover states | `bg-muted` |
| `slate-200` | 120+ | Borders, dividers | `border-border-default` |
| `slate-300` | 40+ | Stronger borders, inputs | `border-border-strong` |
| `slate-400` | 15+ | Icons, placeholders | `text-text-faint` |
| `slate-500` | 50+ | Secondary text, labels | `text-text-muted` |
| `slate-600` | 40+ | Body text, buttons | `text-text-secondary` |
| `slate-700` | 20+ | Secondary text | `text-text-secondary` |
| `slate-800` | 5+ | Headings (rare) | `text-text-primary` |
| `slate-900` | 30+ | Primary headings, text | `text-text-primary` |
| `brand-primary` | 50+ | Brand identity (keep) | N/A - keep as-is |
| `brand-accent` | 20+ | Brand identity (keep) | N/A - keep as-is |
| `red-50/100/200/600/700` | 30+ | Error/danger states (keep) | N/A - keep as-is |
| `emerald-50/600/700` | 25+ | Success states (keep) | N/A - keep as-is |
| `amber-50/100/200/600` | 20+ | Warning states (keep) | N/A - keep as-is |
| `blue-50/100/200/600` | 30+ | Info states, accents (keep) | N/A - keep as-is |
| `purple-50/100/700` | 10+ | Tag colors (keep) | N/A - keep as-is |
| `green-50/600/700` | 10+ | Success actions (keep) | N/A - keep as-is |

---

## Section 2: Usage by Category

### Backgrounds

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `bg-white` | 150+ | All pages, components | `bg-surface` | Most common - card backgrounds |
| `bg-slate-50` | 80+ | All pages | `bg-base` | Page backgrounds, empty states |
| `bg-slate-100` | 60+ | All pages, components | `bg-muted` | Subtle backgrounds, table headers |
| `bg-slate-200` | 10+ | Few components | `bg-inset` | Inset elements (rare) |
| `bg-slate-50/60` | 2 | ListLibrary, ClassDetail | `bg-muted` | Semi-transparent variant |
| `bg-black/50` | 2 | Gradebook modals | Keep | Modal backdrop |
| `bg-white/20` | 1 | Dashboard | Keep | Special overlay |
| `bg-white/90` | 1 | Dashboard | Keep | Special hover state |

**Total background classes:** 300+

---

### Text

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `text-slate-900` | 30+ | All pages | `text-text-primary` | Primary headings, important text |
| `text-slate-800` | 5+ | Dashboard, ClassDetail | `text-text-primary` | Headings (less common) |
| `text-slate-700` | 20+ | All pages | `text-text-secondary` | Body text, secondary content |
| `text-slate-600` | 40+ | All pages | `text-text-secondary` | Body text, buttons (most common) |
| `text-slate-500` | 50+ | All pages | `text-text-muted` | Labels, secondary info |
| `text-slate-400` | 15+ | Icons, placeholders | `text-text-faint` | Icons, hints |
| `text-white` | 50+ | On colored backgrounds | Keep | Intentional contrast |
| `text-black` | 0 | None | N/A | Not used |

**Total text classes:** 210+

---

### Borders

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `border-slate-200` | 120+ | All pages, components | `border-border-default` | Most common - standard borders |
| `border-slate-300` | 40+ | All pages | `border-border-strong` | Stronger borders, inputs |
| `border-slate-100` | 10+ | ClassDetail, ListLibrary | `border-border-muted` | Subtle borders |
| `border-dashed border-slate-300` | 10+ | Empty states | `border-dashed border-border-strong` | Empty state borders |
| `border-red-200` | 10+ | Error alerts | Keep | Semantic color |
| `border-emerald-200` | 5+ | Success alerts | Keep | Semantic color |
| `border-amber-200` | 5+ | Warning alerts | Keep | Semantic color |
| `border-blue-200` | 2 | Info alerts | Keep | Semantic color |

**Total border classes:** 200+

---

### Hover States

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `hover:bg-slate-50` | 40+ | All pages | `hover:bg-hover` | Most common hover |
| `hover:bg-slate-100` | 20+ | All pages | `hover:bg-hover-strong` | Stronger hover |
| `hover:bg-white` | 5+ | ListLibrary, ClassDetail | `hover:bg-surface` | Hover to white |
| `hover:bg-blue-50` | 15+ | Buttons, links | Keep | Accent hover |
| `hover:bg-red-50` | 5+ | Danger buttons | Keep | Semantic hover |
| `hover:bg-emerald-50` | 2 | Success buttons | Keep | Semantic hover |
| `hover:text-brand-primary` | 20+ | Links, buttons | Keep | Brand hover |
| `hover:text-slate-700` | 10+ | Icon buttons | `hover:text-text-secondary` | Icon hover |
| `hover:border-slate-300` | 10+ | Buttons, inputs | `hover:border-border-strong` | Border hover |
| `hover:border-brand-primary` | 10+ | Buttons, cards | Keep | Brand hover |

**Total hover classes:** 140+

---

### Active States

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `active:bg-slate-100` | 5+ | Buttons | `active:bg-active` | Button press |
| `active:bg-slate-200` | 3 | TagButton, LinkButton | `active:bg-active` | Button press |
| `active:bg-blue-100` | 2 | Buttons | Keep | Accent active |
| `active:bg-blue-200` | 1 | LinkButton | Keep | Accent active |
| `active:bg-red-200` | 1 | LinkButton | Keep | Semantic active |

**Total active classes:** 12+

---

### Focus States

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `focus:ring-brand-primary` | 30+ | Inputs, selects | Keep | Brand focus ring |
| `focus:ring-2` | 30+ | Inputs, selects | Keep | Ring width |
| `focus:ring-slate-300` | 0 | None | N/A | Not used (using brand-primary) |
| `focus:bg-white` | 15+ | Inputs | `focus:bg-surface` | Input focus background |
| `focus:border-brand-primary` | 10+ | Inputs, selects | Keep | Brand focus border |

**Total focus classes:** 50+

---

### Rings (Focus/Outline)

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `ring-1 ring-slate-200` | 10+ | Headers, sections | Keep | Subtle ring (alternative to border) |
| `ring-1 ring-slate-100` | 5+ | Sections | Keep | Very subtle ring |
| `ring-slate-300` | 20+ | Inputs | Keep | Input ring color |
| `ring-brand-primary` | 30+ | Focus states | Keep | Brand focus ring |

**Total ring classes:** 65+

---

### Shadows (Colored)

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `shadow-brand-accent/30` | 5+ | Buttons | Keep | Brand shadow |
| `shadow-brand-accent/40` | 2 | Buttons | Keep | Brand shadow |
| `shadow-brand-primary/20` | 10+ | Buttons | Keep | Brand shadow |
| `shadow-brand-primary/30` | 2 | Buttons | Keep | Brand shadow |
| `shadow-red-600/20` | 2 | Danger buttons | Keep | Semantic shadow |
| `shadow-red-600/30` | 1 | Danger buttons | Keep | Semantic shadow |
| `shadow-emerald-600/20` | 2 | Success buttons | Keep | Semantic shadow |
| `shadow-emerald-600/30` | 1 | Success buttons | Keep | Semantic shadow |
| `shadow-blue-500/20` | 1 | Dashboard gradient | Keep | Special effect |
| `shadow-orange-500/20` | 1 | Dashboard gradient | Keep | Special effect |
| `shadow-emerald-500/20` | 1 | Dashboard gradient | Keep | Special effect |
| `shadow-red-100` | 1 | StudySession | Keep | Semantic shadow |
| `shadow-amber-100` | 1 | StudySession | Keep | Semantic shadow |
| `shadow-emerald-100` | 1 | StudySession | Keep | Semantic shadow |
| `shadow-blue-100` | 1 | Flashcard | Keep | Special effect |

**Total colored shadow classes:** 30+

---

### Dividers

| Class | Count | Files | Proposed Token | Notes |
|-------|-------|-------|----------------|-------|
| `border-b border-slate-200` | 10+ | Tables, sections | `border-b border-border-default` | Horizontal dividers |
| `border-t border-slate-200` | 5+ | Tables, sections | `border-t border-border-default` | Horizontal dividers |

**Total divider classes:** 15+

---

## Section 3: Semantic/Brand Colors (DO NOT MIGRATE)

These colors should **stay as-is** because they represent semantic meaning or brand identity:

### Brand Colors
- `bg-brand-primary` - Brand identity (Royal Navy)
- `text-brand-primary` - Brand identity
- `border-brand-primary` - Brand identity
- `bg-brand-accent` - Brand identity (Ember Orange)
- `text-brand-accent` - Brand identity
- `bg-brand-accent-hover` - Brand identity
- `hover:bg-brand-primary/90` - Brand hover state
- `hover:bg-brand-accent-hover` - Brand hover state
- `shadow-brand-primary/*` - Brand shadows
- `shadow-brand-accent/*` - Brand shadows

### Error/Danger Colors
- `bg-red-50`, `bg-red-100`, `bg-red-200` - Error backgrounds
- `bg-red-600`, `bg-red-700` - Error buttons
- `text-red-600`, `text-red-700` - Error text
- `border-red-200` - Error borders
- `hover:bg-red-50`, `hover:bg-red-100`, `hover:bg-red-700` - Error hover
- `active:bg-red-200` - Error active
- `shadow-red-600/*` - Error shadows

### Success Colors
- `bg-emerald-50`, `bg-emerald-100` - Success backgrounds
- `bg-emerald-600`, `bg-emerald-700` - Success buttons
- `bg-green-50`, `bg-green-600`, `bg-green-700` - Success variants
- `text-emerald-600`, `text-emerald-700` - Success text
- `text-green-600` - Success text variant
- `border-emerald-200` - Success borders
- `hover:bg-emerald-700` - Success hover
- `shadow-emerald-600/*` - Success shadows

### Warning Colors
- `bg-amber-50`, `bg-amber-100`, `bg-amber-200` - Warning backgrounds
- `bg-amber-400`, `text-amber-600` - Warning buttons/text
- `border-amber-200` - Warning borders
- `shadow-amber-100` - Warning shadows

### Info/Accent Colors
- `bg-blue-50`, `bg-blue-100`, `bg-blue-200` - Info backgrounds
- `text-blue-600`, `text-blue-700`, `text-blue-800` - Info text
- `hover:bg-blue-50`, `hover:bg-blue-100` - Info hover
- `active:bg-blue-100`, `active:bg-blue-200` - Info active
- `bg-blue-400`, `bg-blue-500`, `bg-blue-600`, `bg-blue-700` - Mastery bars (special)

### Tag/Status Colors
- `bg-purple-50`, `bg-purple-100`, `text-purple-700` - Tag colors
- `bg-amber-100`, `text-amber-700` - Tag colors

### Contrast Colors
- `text-white` - On colored backgrounds (intentional contrast)
- `bg-black/50` - Modal backdrops
- `bg-white/20`, `bg-white/90` - Special overlays

---

## Section 4: Already Using Tokens

These classes are already using the token system (from Card component):

| Class | Count | Files | Token |
|-------|-------|-------|-------|
| `bg-surface` | 10+ | Card.jsx | `--color-bg-surface` |
| `bg-muted` | 3 | Card.jsx | `--color-bg-muted` |
| `border-border-default` | 10+ | Card.jsx | `--color-border-default` |
| `border-border-muted` | 1 | Card.jsx | `--color-border-muted` |

**Note:** Only the Card component is currently using tokens. All other components use hardcoded Tailwind classes.

---

## Section 5: Inconsistencies Found

### 1. **Text Color Inconsistencies**

- **Body text:** Mix of `text-slate-600` (40+ uses) and `text-slate-700` (20+ uses)
  - Both used for same purpose (body text, secondary content)
  - **Recommendation:** Standardize on `text-text-secondary` token

- **Headings:** Mix of `text-slate-900` (30+ uses) and `text-slate-800` (5+ uses)
  - Both used for headings
  - **Recommendation:** Standardize on `text-text-primary` token

- **Labels/Secondary:** Mix of `text-slate-500` (50+ uses) and `text-slate-400` (15+ uses)
  - `text-slate-500` more common for labels
  - `text-slate-400` used for icons/hints
  - **Recommendation:** Use `text-text-muted` for labels, `text-text-faint` for icons

### 2. **Border Color Inconsistencies**

- **Standard borders:** Mix of `border-slate-200` (120+ uses) and `border-slate-300` (40+ uses)
  - `border-slate-200` most common for cards, containers
  - `border-slate-300` used for inputs, stronger emphasis
  - **Recommendation:** Use `border-border-default` for standard, `border-border-strong` for emphasis

- **Subtle borders:** `border-slate-100` (10+ uses) vs `border-slate-200`
  - Used inconsistently for subtle borders
  - **Recommendation:** Use `border-border-muted` for subtle borders

### 3. **Background Color Inconsistencies**

- **Page backgrounds:** All use `bg-slate-50` consistently ✅
- **Card backgrounds:** All use `bg-white` consistently ✅
- **Subtle backgrounds:** Mix of `bg-slate-100` and `bg-slate-50`
  - `bg-slate-100` for table headers, subtle sections
  - `bg-slate-50` for page backgrounds, empty states
  - **Recommendation:** Use `bg-muted` for subtle backgrounds, `bg-base` for page backgrounds

### 4. **Hover State Inconsistencies**

- **Hover backgrounds:** Mix of `hover:bg-slate-50` (40+ uses) and `hover:bg-slate-100` (20+ uses)
  - Both used for hover states on white backgrounds
  - **Recommendation:** Use `hover:bg-hover` for standard, `hover:bg-hover-strong` for emphasis

### 5. **Ring vs Border Inconsistencies**

- Some components use `ring-1 ring-slate-200` instead of `border border-slate-200`
  - Headers, sections use rings
  - Cards, containers use borders
  - **Recommendation:** Standardize on borders for consistency (or document when to use rings)

---

## Section 6: Migration Priority

### High Impact (Migrate First)

**Classes used 50+ times:**

1. **`bg-white`** → `bg-surface` (150+ uses)
   - **Impact:** Core UI element - all cards, modals, inputs
   - **Files:** All pages, all components
   - **Effort:** High (many files, but straightforward find/replace)

2. **`bg-slate-50`** → `bg-base` (80+ uses)
   - **Impact:** Page backgrounds - affects entire app appearance
   - **Files:** All pages
   - **Effort:** Medium (fewer files, but page-level changes)

3. **`border-slate-200`** → `border-border-default` (120+ uses)
   - **Impact:** All borders - major visual consistency
   - **Files:** All pages, all components
   - **Effort:** High (many files, but straightforward)

4. **`text-slate-500`** → `text-text-muted` (50+ uses)
   - **Impact:** Labels, secondary text - affects readability
   - **Files:** All pages
   - **Effort:** Medium

5. **`text-slate-600`** → `text-text-secondary` (40+ uses)
   - **Impact:** Body text - affects readability
   - **Files:** All pages
   - **Effort:** Medium

6. **`text-slate-900`** → `text-text-primary` (30+ uses)
   - **Impact:** Headings - affects hierarchy
   - **Files:** All pages
   - **Effort:** Medium

7. **`bg-slate-100`** → `bg-muted` (60+ uses)
   - **Impact:** Subtle backgrounds - affects visual depth
   - **Files:** All pages, components
   - **Effort:** Medium

8. **`hover:bg-slate-50`** → `hover:bg-hover` (40+ uses)
   - **Impact:** Hover states - affects interactivity
   - **Files:** All pages, components
   - **Effort:** Medium

---

### Medium Impact (Migrate Second)

**Classes used 10-50 times:**

9. **`border-slate-300`** → `border-border-strong` (40+ uses)
   - **Impact:** Stronger borders - inputs, emphasis
   - **Effort:** Medium

10. **`text-slate-700`** → `text-text-secondary` (20+ uses)
    - **Impact:** Secondary text - consolidate with slate-600
    - **Effort:** Low

11. **`hover:bg-slate-100`** → `hover:bg-hover-strong` (20+ uses)
    - **Impact:** Stronger hover states
    - **Effort:** Low

12. **`text-slate-400`** → `text-text-faint` (15+ uses)
    - **Impact:** Icons, placeholders
    - **Effort:** Low

13. **`border-slate-100`** → `border-border-muted` (10+ uses)
    - **Impact:** Subtle borders
    - **Effort:** Low

14. **`ring-1 ring-slate-200`** → `ring-1 ring-border-default` (10+ uses)
    - **Impact:** Headers, sections
    - **Effort:** Low (or keep as-is if rings are intentional)

15. **`focus:bg-white`** → `focus:bg-surface` (15+ uses)
    - **Impact:** Input focus states
    - **Effort:** Low

---

### Low Impact (Migrate Last)

**Classes used < 10 times:**

16. **`bg-slate-200`** → `bg-inset` (10+ uses)
    - **Impact:** Rare - inset elements
    - **Effort:** Low

17. **`text-slate-800`** → `text-text-primary` (5+ uses)
    - **Impact:** Rare - consolidate with slate-900
    - **Effort:** Low

18. **`active:bg-slate-100`** → `active:bg-active` (5+ uses)
    - **Impact:** Button active states
    - **Effort:** Low

19. **`active:bg-slate-200`** → `active:bg-active` (3 uses)
    - **Impact:** Button active states
    - **Effort:** Low

20. **`hover:border-slate-300`** → `hover:border-border-strong` (10+ uses)
    - **Impact:** Border hover states
    - **Effort:** Low

21. **`border-dashed border-slate-300`** → `border-dashed border-border-strong` (10+ uses)
    - **Impact:** Empty state borders
    - **Effort:** Low

---

## Section 7: Proposed Find/Replace

**Order: Most specific first (to avoid partial matches)**

### Phase 1: High Impact (50+ uses)

| Find | Replace | Count | Priority |
|------|---------|-------|----------|
| `border-slate-200` | `border-border-default` | 120+ | 1 |
| `bg-white` | `bg-surface` | 150+ | 2 |
| `bg-slate-50` | `bg-base` | 80+ | 3 |
| `bg-slate-100` | `bg-muted` | 60+ | 4 |
| `text-slate-500` | `text-text-muted` | 50+ | 5 |
| `text-slate-600` | `text-text-secondary` | 40+ | 6 |
| `hover:bg-slate-50` | `hover:bg-hover` | 40+ | 7 |
| `border-slate-300` | `border-border-strong` | 40+ | 8 |
| `text-slate-900` | `text-text-primary` | 30+ | 9 |

### Phase 2: Medium Impact (10-50 uses)

| Find | Replace | Count | Priority |
|------|---------|-------|----------|
| `text-slate-700` | `text-text-secondary` | 20+ | 10 |
| `hover:bg-slate-100` | `hover:bg-hover-strong` | 20+ | 11 |
| `text-slate-400` | `text-text-faint` | 15+ | 12 |
| `focus:bg-white` | `focus:bg-surface` | 15+ | 13 |
| `border-slate-100` | `border-border-muted` | 10+ | 14 |
| `ring-1 ring-slate-200` | `ring-1 ring-border-default` | 10+ | 15 |
| `hover:border-slate-300` | `hover:border-border-strong` | 10+ | 16 |
| `border-dashed border-slate-300` | `border-dashed border-border-strong` | 10+ | 17 |
| `border-b border-slate-200` | `border-b border-border-default` | 10+ | 18 |
| `border-t border-slate-200` | `border-t border-border-default` | 5+ | 19 |

### Phase 3: Low Impact (< 10 uses)

| Find | Replace | Count | Priority |
|------|---------|-------|----------|
| `bg-slate-200` | `bg-inset` | 10+ | 20 |
| `text-slate-800` | `text-text-primary` | 5+ | 21 |
| `active:bg-slate-100` | `active:bg-active` | 5+ | 22 |
| `active:bg-slate-200` | `active:bg-active` | 3 | 23 |
| `ring-slate-300` | `ring-border-strong` | 20+ | 24 |
| `bg-slate-50/60` | `bg-muted/60` | 2 | 25 |

### Special Cases (Handle Manually)

| Find | Replace | Notes |
|------|---------|-------|
| `bg-slate-50/60` | `bg-muted/60` | Semi-transparent - verify opacity works |
| `ring-1 ring-slate-100` | `ring-1 ring-border-muted` | Very subtle rings |
| `hover:bg-white` | `hover:bg-surface` | Hover to white (5+ uses) |

---

## Summary Statistics

- **Total color classes found:** 800+
- **Classes to migrate:** ~600 (excluding semantic/brand colors)
- **Classes to keep:** ~200 (semantic colors, brand colors, special effects)
- **Already using tokens:** ~15 (Card component only)
- **Migration phases:** 3 (High → Medium → Low impact)

### Migration Complexity

- **High Impact:** 9 classes, ~600 total uses
- **Medium Impact:** 10 classes, ~120 total uses
- **Low Impact:** 6 classes, ~50 total uses

### Estimated Effort

- **Phase 1 (High Impact):** 2-3 hours (many files, but straightforward)
- **Phase 2 (Medium Impact):** 1-2 hours (fewer files)
- **Phase 3 (Low Impact):** 30 minutes (edge cases)

**Total estimated effort:** 4-6 hours for complete migration

---

## Notes

1. **Test after each phase** - Verify visual consistency
2. **Handle edge cases manually** - Semi-transparent colors, special effects
3. **Keep semantic colors** - Don't migrate error/success/warning/brand colors
4. **Document exceptions** - Any colors that intentionally don't use tokens
5. **Update Card component** - Already using tokens, verify consistency


# UI Design System - "Academic Glass"

## Design Philosophy

VocaBoost uses a consistent design system called "Academic Glass" that emphasizes:
- Clean, modern aesthetics with glassmorphism-inspired elements
- Slate color palette with royal blue and orange accents
- Rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-3xl`)
- Subtle shadows and borders
- Consistent spacing and typography

---

## Color Palette

### Primary Colors
- **Brand Primary (Royal Blue)**: `brand-primary` - Used for primary actions, headings
- **Brand Accent (Orange)**: `brand-accent` - Used for CTAs, highlights
- **Brand Accent Hover**: `brand-accent-hover` - Hover state for accent buttons

### Neutral Colors
- **Slate-50**: Background (`bg-slate-50`)
- **Slate-100**: Subtle backgrounds, badges
- **Slate-200**: Borders (`border-slate-200`)
- **Slate-300**: Secondary borders
- **Slate-400**: Icons, secondary text
- **Slate-500**: Muted text
- **Slate-600**: Body text
- **Slate-700**: Emphasized text
- **Slate-900**: Headings, primary text

### Status Colors
- **Emerald**: Success states (green-50, green-600, emerald-50, emerald-600)
- **Amber**: Warning states (amber-50, amber-100, amber-600, amber-800)
- **Red**: Error/danger states (red-50, red-600, red-700)

---

## Typography

### Font Families
- **Font Heading**: Used for titles, headings, buttons (`font-heading font-bold`)
- **Font Body**: Used for body text (`font-body`)

### Font Sizes
- **text-xs**: 12px - Small labels, badges
- **text-sm**: 14px - Body text, buttons
- **text-base**: 16px - Standard text
- **text-lg**: 18px - Subheadings
- **text-xl**: 20px - Section headings
- **text-2xl**: 24px - Large headings
- **text-3xl**: 30px - Page titles
- **text-4xl**: 36px - Hero text

### Font Weights
- **font-medium**: 500 - Labels, emphasis
- **font-semibold**: 600 - Buttons, emphasized text
- **font-bold**: 700 - Headings, primary actions

---

## Component Library (`src/components/ui/`)

### Button.jsx
**Variants:**
- `primary` - Orange CTA (matches "Study Now")
- `primary-blue` - Blue primary (matches "Take Test")
- `secondary` - Outlined blue (matches "Typed Test")
- `ghost` - White with border (matches "Gradebook" link)
- `outline` - Gray outlined (matches logout)
- `danger` - Red for destructive actions

**Sizes:**
- `sm` - h-8 px-3 text-xs
- `md` - h-10 px-4 text-sm
- `lg` - h-12 px-4 text-sm (default)
- `xl` - h-14 px-6 text-base

**Features:**
- `active:scale-95` transition
- `disabled:opacity-50 disabled:cursor-not-allowed`
- `rounded-xl` corners

### IconButton.jsx
**Variants:**
- `default` - Slate-400 hover to brand-primary
- `danger` - Hover to red-600
- `ghost` - Slate-500 hover to slate-700

**Sizes:**
- `sm` - h-8 w-8
- `md` - h-10 w-10 (default)
- `lg` - h-12 w-12

### Card.jsx
**Variants:**
- `default` - White with border and shadow
- `hoverable` - Adds hover shadow and border highlight
- `hero` - Brand primary background with white text
- `gradient` - Blue gradient background
- `vitals` - White with hover shadow

**Sizes:**
- `sm` - rounded-xl p-4
- `md` - rounded-2xl p-5
- `lg` - rounded-3xl p-6 (default)
- `xl` - rounded-3xl p-8

### Badge.jsx
**Variants:**
- `default` - Slate-100 background, slate-600 text
- `info` - Blue-100 background, blue-800 text
- `success` - Emerald-50 background, emerald-600 text
- `warning` - Amber-100 background, amber-800 text
- `error` - Red-50 background, red-600 text
- `purple` - Purple-100 background, purple-700 text

**Sizes:**
- `sm` - px-2 py-0.5 text-xs
- `md` - px-2.5 py-1 text-xs (default)
- `lg` - px-3 py-1.5 text-sm

**Shapes:**
- `rounded` - rounded-lg (default)
- `pill` - rounded-full

### Input.jsx
**Sizes:**
- `sm` - h-10 px-3 text-sm
- `md` - h-11 px-3 text-sm (default)
- `lg` - h-12 px-4 text-sm

**Features:**
- `rounded-xl` corners
- `border-slate-200` border
- `focus:ring-2 focus:ring-brand-primary focus:border-brand-primary`
- `placeholder:text-slate-400`

### Textarea.jsx
**Features:**
- `rounded-xl` corners
- `px-4 py-3` padding
- Same focus states as Input

### Select.jsx
**Sizes:**
- `sm` - h-8 px-3 text-sm
- `md` - h-10 px-3 py-2 text-sm (default)
- `lg` - h-12 px-4 py-2 text-sm

**Features:**
- `rounded-lg` corners (matches modal style)
- `bg-slate-50` default background
- `focus:bg-white` transition
- `focus:ring-brand-primary` focus ring

### Modal.jsx
**Sizes:**
- `sm` - max-w-sm
- `md` - max-w-md (default)
- `lg` - max-w-lg
- `xl` - max-w-xl
- `2xl` - max-w-2xl

**Features:**
- `rounded-3xl` corners
- `bg-slate-900/50` backdrop
- `shadow-2xl` shadow
- Close button using IconButton

---

## Common Patterns

### Page Layout
```jsx
<main className="min-h-screen bg-slate-50 px-4 py-10">
  <div className="mx-auto max-w-6xl flex flex-col gap-8">
    {/* Content */}
  </div>
</main>
```

### Card Container
```jsx
<div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
  {/* Content */}
</div>
```

### Section Header
```jsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-xl font-heading font-bold text-slate-900">Title</h2>
  <Button variant="primary-blue">Action</Button>
</div>
```

### Table Styling
```jsx
<table className="min-w-full divide-y divide-slate-200">
  <thead>
    <tr className="text-slate-500">
      <th className="px-3 py-2 font-medium">Header</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100">
    {/* Rows */}
  </tbody>
</table>
```

### Filter Tags
- Class: `bg-blue-50 text-blue-700`
- List: `bg-purple-50 text-purple-700`
- Date: `bg-amber-50 text-amber-700`
- Name: `bg-emerald-50 text-emerald-700`

### Score Colors
- ≥90%: `text-emerald-600` / `bg-emerald-50 border-emerald-200`
- ≥70%: `text-amber-600` / `bg-amber-50 border-amber-200`
- <70%: `text-red-600` / `bg-red-50 border-red-200`

---

## Animation & Transitions

### Common Transitions
- `transition-colors` - Color changes
- `transition-all` - All properties
- `transition-opacity` - Opacity changes
- `active:scale-95` - Button press feedback

### Drawer Animation
- Slide-in from right using CSS keyframes
- `@keyframes slideInFromRight` defined in `index.css`

---

## Responsive Design

### Breakpoints
- Mobile: Default (< 768px)
- Tablet: `md:` (≥ 768px)
- Desktop: `lg:` (≥ 1024px)

### Common Responsive Patterns
```jsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  {/* Responsive flex layout */}
</div>
```

---

## Accessibility

### Focus States
- All interactive elements have visible focus rings
- `focus:ring-2 focus:ring-brand-primary`
- Keyboard navigation supported throughout

### ARIA Labels
- Buttons include descriptive text or icons
- Modals include proper ARIA attributes
- Form inputs have associated labels

---

## Consistency Guidelines

1. **Always use UI components** from `src/components/ui/` when available
2. **Match existing patterns** - Check Dashboard.jsx for reference
3. **Use consistent spacing** - `gap-2`, `gap-4`, `mb-4`, `mb-6`, etc.
4. **Maintain color consistency** - Use brand colors, not arbitrary colors
5. **Follow typography hierarchy** - Use appropriate font sizes and weights
6. **Rounded corners** - Use `rounded-xl` for buttons, `rounded-3xl` for cards
7. **Shadows** - Use `shadow-sm` for cards, `shadow-lg` for modals


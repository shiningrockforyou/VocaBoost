# Phase 4: Annotation Tools

> **Goal:** Bluebook-style annotation tools (highlighter, strikethrough, line reader)

## Prerequisites
- Phase 1-3 complete and verified
- Read `ap_boost_spec_plan.md` section: 5.3 (Tools Specification)

---

## Step 4.1: useAnnotations Hook

**File:** `hooks/useAnnotations.js`

**Purpose:** Manage highlights, strikethroughs, and line reader state.

```javascript
export function useAnnotations(sessionId) {
  return {
    // Highlights
    highlights: Map<questionId, HighlightRange[]>,
    addHighlight: (questionId, range, color) => void,
    removeHighlight: (questionId, index) => void,
    clearHighlights: (questionId) => void,

    // Strikethroughs
    strikethroughs: Map<questionId, Set<choiceId>>,
    toggleStrikethrough: (questionId, choiceId) => void,

    // Line reader
    lineReaderEnabled: boolean,
    lineReaderPosition: number,
    toggleLineReader: () => void,
    moveLineReader: (position) => void,

    // Persistence
    saveAnnotations: () => Promise<void>,
    loadAnnotations: () => Promise<void>,
  };
}
```

**HighlightRange type:**
```typescript
interface HighlightRange {
  start: number;
  end: number;
  color: 'yellow' | 'green' | 'pink' | 'blue';
}
```

**Storage:** Annotations stored in `ap_session_state.annotations`

**Verification:**
- [ ] Annotations persist in session
- [ ] Annotations load on resume
- [ ] Clear on section complete (optional)

---

## Step 4.2: Highlighter Component

**File:** `components/tools/Highlighter.jsx`

**Text highlighting for stimulus/passages:**

**Usage:**
```jsx
<Highlighter
  content={stimulus.content}
  highlights={highlights}
  onHighlight={(range, color) => addHighlight(questionId, range, color)}
  onRemove={(index) => removeHighlight(questionId, index)}
/>
```

**Behavior:**
1. Select text → show color picker popup
2. Choose color → apply highlight
3. Click existing highlight → remove it

**Colors:**
- Yellow (default): `bg-yellow-200`
- Green: `bg-green-200`
- Pink: `bg-pink-200`
- Blue: `bg-blue-200`

**Implementation approach:**
- Wrap text in spans based on highlight ranges
- Use `window.getSelection()` to get selected range
- Calculate character offsets from selection

**Verification:**
- [ ] Select text → color picker appears
- [ ] Highlight applied correctly
- [ ] Click to remove works
- [ ] Multiple highlights supported
- [ ] Overlapping highlights handled

---

## Step 4.3: Strikethrough Component

**File:** `components/tools/Strikethrough.jsx`

**Toggle strikethrough on MCQ answer options:**

**Integration with AnswerInput:**
```jsx
<AnswerInput
  question={question}
  selectedAnswer={selectedAnswer}
  onSelect={setAnswer}
  strikethroughs={strikethroughs.get(question.id)}
  onStrikethrough={(choice) => toggleStrikethrough(question.id, choice)}
/>
```

**Behavior:**
- Small "X" button next to each option (or right-click)
- Click → toggle strikethrough on that option
- Strikethrough visual: gray text, line-through
- Can still select struck option (doesn't affect functionality)

**Styling:**
```css
.strikethrough {
  text-decoration: line-through;
  color: var(--text-muted);
  opacity: 0.6;
}
```

**Verification:**
- [ ] Click toggles strikethrough
- [ ] Visual feedback correct
- [ ] Can still select struck option
- [ ] Persists across navigation

---

## Step 4.4: LineReader Component

**File:** `components/tools/LineReader.jsx`

**Focus line reader overlay for long passages:**

```typescript
interface LineReaderProps {
  contentRef: RefObject<HTMLElement>;
  enabled: boolean;
  position: number;
  onPositionChange: (position: number) => void;
  lineHeight?: number;
  visibleLines?: 1 | 2 | 3;
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ [Darkened overlay]                      │
│─────────────────────────────────────────│
│ Current visible line(s)                 │ ← Clear/focused
│─────────────────────────────────────────│
│ [Darkened overlay]                      │
└─────────────────────────────────────────┘
```

**Controls:**
- Arrow keys: move up/down
- Click on overlay: move to that position
- Settings: 1, 2, or 3 visible lines

**Implementation:**
- Absolute positioned overlay with `pointer-events: none` for clear area
- Track scroll position to maintain relative position

**Verification:**
- [ ] Toggle on/off
- [ ] Arrow keys move focus
- [ ] Click repositions
- [ ] Works with scrollable content

---

## Step 4.5: PassageDisplay Component

**File:** `components/PassageDisplay.jsx`

**Stimulus/passage display with integrated tools:**

```typescript
interface PassageDisplayProps {
  stimulus: Stimulus;
  highlights: HighlightRange[];
  onHighlight: (range, color) => void;
  onRemoveHighlight: (index) => void;
  lineReaderEnabled: boolean;
  lineReaderPosition: number;
  onLineReaderMove: (position) => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ [Toolbar]  [Highlight ▼] [Line Reader]  │
├─────────────────────────────────────────┤
│                                         │
│  [Stimulus content with highlights]     │
│                                         │
│  [Line reader overlay if enabled]       │
│                                         │
└─────────────────────────────────────────┘
```

**Toolbar:**
- Highlighter button (toggle color picker)
- Line reader toggle
- Clear all highlights button

**Verification:**
- [ ] Toolbar shows
- [ ] Highlighter works in passage
- [ ] Line reader overlays correctly

---

## Step 4.6: Update QuestionDisplay

**File:** `components/QuestionDisplay.jsx`

**Integrate tools for HORIZONTAL layout:**

```jsx
// HORIZONTAL layout with tools
<div className="grid grid-cols-2 gap-4">
  <div className="stimulus-panel">
    <PassageDisplay
      stimulus={stimulus}
      highlights={annotations.highlights.get(question.id)}
      onHighlight={(range, color) => addHighlight(question.id, range, color)}
      onRemoveHighlight={(idx) => removeHighlight(question.id, idx)}
      lineReaderEnabled={lineReaderEnabled}
      lineReaderPosition={lineReaderPosition}
      onLineReaderMove={moveLineReader}
    />
  </div>
  <div className="question-panel">
    {children}
  </div>
</div>
```

**Verification:**
- [ ] Tools appear in HORIZONTAL layout
- [ ] No tools in VERTICAL layout
- [ ] Integration with session state

---

## Toolbar Component

**File:** `components/tools/ToolsToolbar.jsx`

**Floating toolbar for tool controls:**

```
┌─────────────────────────────────────┐
│ [🖍 Highlight ▼] [📖 Reader] [❌]   │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface ToolsToolbarProps {
  highlightColor: string;
  onHighlightColorChange: (color) => void;
  lineReaderEnabled: boolean;
  onLineReaderToggle: () => void;
  onClearAll: () => void;
}
```

**Verification:**
- [ ] Color picker dropdown
- [ ] Line reader toggle
- [ ] Clear all button

---

## Final Verification Checklist

- [ ] Highlight text → color picker → highlight applied
- [ ] Click highlight → removes it
- [ ] Multiple colors supported
- [ ] Strikethrough option → visual feedback
- [ ] Can still select struck option
- [ ] Line reader toggle → overlay appears
- [ ] Arrow keys move line reader
- [ ] All annotations persist across navigation
- [ ] Annotations visible in review mode (read-only)
- [ ] Annotations cleared on section complete (if policy)

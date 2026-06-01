# Screenshot Matrix

Use this matrix after token cleanup and again after dark-mode values are assigned.

## Viewports

Capture at minimum:

```text
mobile: 375x812
tablet: 768x1024
desktop: 1440x900
```

## Student Routes

| ID | Route/State | Required Evidence |
| --- | --- | --- |
| S01 | Login | default, error state, focused input |
| S02 | Signup | default, validation error |
| S03 | Student dashboard | enrolled class card, empty state if available |
| S04 | Study selection modal | open modal, focus state |
| S05 | Daily session - new words | card front, card back, progress/header |
| S06 | Daily session - review | review card, dismissed/known state |
| S07 | MCQ test | unanswered, answered, selected option, submit button |
| S08 | MCQ results | pass state, fail state |
| S09 | Typed test | inputs, focused input, validation/submitting state |
| S10 | Typed results | correct/incorrect reasoning, fail state |
| S11 | Blind spot check | empty state, active question, result state |
| S12 | Student gradebook | table, filter controls, modal/details |
| S13 | Settings | form controls, toggles/selects |

## Teacher Routes

| ID | Route/State | Required Evidence |
| --- | --- | --- |
| T01 | Teacher dashboard | class list, empty/loading if available |
| T02 | Class detail | roster, assignments, action buttons |
| T03 | Create class modal | default, focused input, validation |
| T04 | List library | cards/table, import button |
| T05 | List editor | word rows, inputs, save controls |
| T06 | Import words modal | pasted content, validation, buttons |
| T07 | Teacher gradebook | table, filters, challenge review state |

## Component States

Capture these wherever the route naturally exposes them:

```text
default
hover
focus-visible
active
disabled
loading
empty
error
success
warning
selected
modal open
dropdown open
tooltip open if present
```

## Screenshot Naming

Use this naming format:

```text
audit/theme/screenshots/light/S03_dashboard_desktop.png
audit/theme/screenshots/dark/S03_dashboard_desktop.png
audit/theme/screenshots/compare/S03_dashboard_desktop_notes.md
```

## Review Checklist

For each screenshot, check:

- Body text is readable.
- Secondary text is subordinate but readable.
- Muted text is not confused with disabled text.
- Primary actions stand out.
- Destructive actions are clearly distinct.
- Focus rings are visible.
- Borders define surfaces without excessive contrast.
- Status colors retain meaning.
- Tables remain scannable.
- Cards/modals do not flatten into the page background.
- The page does not become dominated by one hue.


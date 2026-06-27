# VocaBoost Technical Specification

**Version:** 1.0
**Last Updated:** January 2026
**Document Type:** Complete Technical Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [Project Architecture](#3-project-architecture)
4. [Routing & Navigation](#4-routing--navigation)
5. [Pages Documentation](#5-pages-documentation)
6. [Component Library](#6-component-library)
7. [Design System](#7-design-system)
8. [State Management](#8-state-management)
9. [Services Layer](#9-services-layer)
10. [Data Models](#10-data-models)
11. [Core Algorithms](#11-core-algorithms)
12. [Study Flow](#12-study-flow)
13. [Utility Functions](#13-utility-functions)
14. [Development Tools](#14-development-tools)
15. [Security & Access Control](#15-security--access-control)

---

## 1. Executive Summary

### 1.1 Project Overview

VocaBoost is a vocabulary learning web application designed for Korean students studying English vocabulary. The platform implements a sophisticated spaced repetition system with adaptive difficulty, enabling efficient vocabulary acquisition through structured daily study sessions.

### 1.2 Target Users

**Students:**
- Korean students learning English vocabulary
- Access vocabulary lists assigned by teachers
- Complete daily study sessions with flashcards and tests
- Track personal progress and mastery levels

**Teachers:**
- Create and manage vocabulary word lists
- Create classes and enroll students
- Assign lists to classes with customizable pace settings
- Monitor student progress through gradebook

### 1.3 Core Value Proposition

- **Adaptive Learning:** Intervention system adjusts difficulty based on recent performance
- **Spaced Repetition:** 21-day mastery cycle with automatic word return for retention
- **Session-Based Learning:** Structured daily sessions with study, testing, and review phases
- **Role-Based Experience:** Distinct interfaces for students and teachers
- **Progress Tracking:** Comprehensive analytics and gradebook functionality

---

## 2. Tech Stack

### 2.1 Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI library with latest React 19 features |
| React DOM | 19.2.0 | DOM rendering |
| React Router DOM | 7.9.6 | Client-side routing |
| Vite | 7.2.4 | Build tool and dev server |

### 2.2 Backend Services

| Service | Version | Purpose |
|---------|---------|---------|
| Firebase | 12.6.0 | Authentication, Firestore database, Storage |
| Firebase Admin | 13.6.0 | Backend admin SDK for Cloud Functions |
| Cloud Functions | - | AI grading with OpenAI integration |

### 2.3 Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.1.17 | Utility-first CSS framework |
| @tailwindcss/postcss | 4.1.17 | PostCSS integration |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.22 | Vendor prefixing |

### 2.4 UI & Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| lucide-react | 0.556.0 | Icon library |
| jspdf | 3.0.4 | PDF generation |
| jspdf-autotable | 5.0.2 | PDF table formatting |
| xlsx | 0.18.5 | Excel file import/export |

### 2.5 Development Tools

| Package | Version | Purpose |
|---------|---------|---------|
| @vitejs/plugin-react | 5.1.1 | React Fast Refresh |
| ESLint | 9.39.1 | Code linting |
| eslint-plugin-react-hooks | 7.0.1 | React hooks rules |
| eslint-plugin-react-refresh | 0.4.24 | Fast Refresh rules |

### 2.6 Build Scripts

```json
{
  "dev": "vite",              // Start dev server with HMR
  "build": "vite build",      // Production build to ./dist
  "lint": "eslint .",         // Check code style
  "preview": "vite preview",  // Preview production build
  "seed": "node scripts/seedEmulator.js"  // Seed Firebase Emulator
}
```

---

## 3. Project Architecture

### 3.1 Directory Structure

```
vocaboost/
├── src/
│   ├── App.jsx                 # Main app component with routing
│   ├── main.jsx                # React entry point
│   ├── index.css               # Design tokens and global styles
│   ├── firebase.js             # Firebase configuration
│   │
│   ├── pages/                  # Page components
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Gradebook.jsx
│   │   ├── ListLibrary.jsx
│   │   ├── ListEditor.jsx
│   │   ├── ClassDetail.jsx
│   │   ├── DailySessionFlow.jsx
│   │   ├── BlindSpotCheck.jsx
│   │   ├── MCQTest.jsx
│   │   ├── TypedTest.jsx
│   │   └── Settings.jsx
│   │
│   ├── components/             # Reusable components
│   │   ├── ui/                 # Design system components
│   │   │   ├── Badge.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Textarea.jsx
│   │   │   └── buttons/        # Button variants
│   │   │       ├── Button.jsx
│   │   │       ├── CardButton.jsx
│   │   │       ├── IconButton.jsx
│   │   │       ├── LinkButton.jsx
│   │   │       ├── NavButton.jsx
│   │   │       ├── TabButton.jsx
│   │   │       └── TagButton.jsx
│   │   │
│   │   ├── dev/                # Development utilities
│   │   │   ├── SimulationPanel.jsx
│   │   │   ├── SimulationLog.jsx
│   │   │   ├── SegmentDebugPanel.jsx
│   │   │   └── WordPoolChart.jsx
│   │   │
│   │   ├── modals/
│   │   │   └── StudySelectionModal.jsx
│   │   │
│   │   └── [Application components...]
│   │
│   ├── contexts/               # Global state
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   │
│   ├── hooks/                  # Custom hooks
│   │   └── useSimulation.jsx
│   │
│   ├── services/               # Business logic
│   │   ├── db.js               # Firestore operations (3014 lines)
│   │   ├── sessionService.js
│   │   ├── studyService.js
│   │   └── progressService.js
│   │
│   ├── utils/                  # Utility functions
│   │   ├── dateProvider.js
│   │   ├── pdfGenerator.js
│   │   ├── sessionRecovery.js
│   │   ├── sessionStepTracker.js
│   │   ├── sessionTimeCalculator.js
│   │   ├── simulationConfig.js
│   │   ├── studyAlgorithm.js
│   │   ├── testConfig.js
│   │   ├── testRecovery.js
│   │   └── tts.js
│   │
│   └── types/
│       └── studyTypes.js       # Type definitions
│
├── public/                     # Static assets
│   ├── Pretendard*.ttf         # Korean font files
│   ├── WantedSans*.ttf         # Additional fonts
│   ├── help-*.html             # Help documentation
│   └── logo*.png, *.svg        # Branding assets
│
├── index.html                  # HTML entry point
├── vite.config.js              # Vite configuration
├── postcss.config.js           # PostCSS configuration
├── eslint.config.js            # ESLint configuration
└── package.json                # Dependencies and scripts
```

### 3.2 File Organization Conventions

| Directory | Purpose | Naming Convention |
|-----------|---------|-------------------|
| `/src/pages/` | Page-level components | PascalCase.jsx |
| `/src/components/` | Reusable components | PascalCase.jsx |
| `/src/components/ui/` | Design system primitives | PascalCase.jsx |
| `/src/services/` | Business logic and API | camelCase.js |
| `/src/contexts/` | React contexts | PascalCase.jsx |
| `/src/hooks/` | Custom React hooks | useCamelCase.jsx |
| `/src/utils/` | Pure utility functions | camelCase.js |
| `/src/types/` | Type definitions | camelCase.js |

### 3.3 Module Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        Pages Layer                          │
│  (Dashboard, DailySessionFlow, MCQTest, Gradebook, etc.)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Components Layer                          │
│  (SessionHeader, Flashcard, TestResults, UI primitives)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Contexts & Hooks Layer                          │
│  (AuthContext, ThemeContext, useSimulation)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Services Layer                            │
│  (db.js, sessionService, studyService, progressService)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Utilities Layer                           │
│  (studyAlgorithm, dateProvider, pdfGenerator, tts)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Firebase Layer                            │
│  (Authentication, Firestore, Storage)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Routing & Navigation

### 4.1 Route Configuration

All routes are defined in `src/App.jsx` using React Router v7.

| Route | Component | Protection | Description |
|-------|-----------|------------|-------------|
| `/` | Dashboard | PrivateRoute | Main hub (role-based view) |
| `/login` | Login | Public | Email/Google sign-in |
| `/signup` | Signup | Public | New user registration |
| `/lists` | ListLibrary | PrivateRoute + TeacherRoute | Vocabulary list management |
| `/lists/new` | ListEditor | PrivateRoute + TeacherRoute | Create new word list |
| `/lists/:listId` | ListEditor | PrivateRoute + TeacherRoute | Edit existing list |
| `/classes/:classId` | ClassDetail | PrivateRoute + TeacherRoute | Class management |
| `/session/:classId/:listId` | DailySessionFlow | PrivateRoute | Study session |
| `/blindspots/:classId/:listId` | BlindSpotCheck | PrivateRoute | Weak area assessment |
| `/mcqtest/:classId/:listId` | MCQTest | PrivateRoute | Multiple choice test |
| `/typedtest/:classId/:listId` | TypedTest | PrivateRoute | Typed response test |
| `/gradebook` | Gradebook (student) | PrivateRoute | Personal performance |
| `/teacher/gradebook` | Gradebook (teacher) | PrivateRoute + TeacherRoute | Student analytics |
| `/settings` | Settings | PrivateRoute | User preferences |
| `*` | Navigate to `/` | - | Catch-all redirect |

### 4.2 Route Guards

**PrivateRoute** (`src/components/PrivateRoute.jsx`)
- Requires authenticated Firebase user
- Redirects unauthenticated users to `/login`
- Shows loading spinner during auth check

**TeacherRoute** (`src/components/TeacherRoute.jsx`)
- Requires `user.role === 'teacher'`
- Redirects non-teachers to `/`
- Always nested within PrivateRoute

### 4.3 Protection Hierarchy

```
Public Routes (no auth)
├── /login
└── /signup

PrivateRoute (requires auth)
├── /
├── /session/:classId/:listId
├── /blindspots/:classId/:listId
├── /mcqtest/:classId/:listId
├── /typedtest/:classId/:listId
├── /gradebook
└── /settings

TeacherRoute (requires auth + teacher role)
├── /lists
├── /lists/new
├── /lists/:listId
├── /classes/:classId
└── /teacher/gradebook
```

### 4.4 Navigation Flow

```
                    ┌─────────────┐
                    │   Login     │
                    └──────┬──────┘
                           │ auth success
                           ▼
                    ┌─────────────┐
          ┌─────────│  Dashboard  │─────────┐
          │         └──────┬──────┘         │
          │ teacher        │ student        │
          ▼                ▼                ▼
    ┌───────────┐   ┌───────────┐    ┌───────────┐
    │ListLibrary│   │  Session  │    │ Gradebook │
    └─────┬─────┘   └─────┬─────┘    └───────────┘
          │               │
          ▼               ▼
    ┌───────────┐   ┌───────────┐
    │ListEditor │   │MCQ/Typed  │
    └───────────┘   │   Test    │
                    └───────────┘
```

---

## 5. Pages Documentation

### 5.1 Authentication Pages

#### Login.jsx
**Purpose:** User authentication entry point

**Features:**
- Email/password login form
- Google OAuth sign-in
- "Forgot password" link
- Redirect to signup for new users
- Error handling and validation

**State:**
- `email`, `password` - Form inputs
- `error` - Authentication error message
- `loading` - Submission state

---

#### Signup.jsx
**Purpose:** New user registration

**Features:**
- Email/password account creation
- Role selection (student/teacher)
- Optional Google signup
- Input validation
- Automatic profile creation

**State:**
- `email`, `password`, `confirmPassword`
- `role` - 'student' or 'teacher'
- `displayName` - User's name
- `error`, `loading`

---

### 5.2 Dashboard

#### Dashboard.jsx
**Purpose:** Main hub after login (role-specific views)

**Teacher View Features:**
- Classes overview with student counts
- Quick actions: Create class, Create list
- Recent activity feed
- Class management shortcuts

**Student View Features:**
- Enrolled classes list
- Active lists with progress indicators
- Daily session shortcuts ("Study Now" buttons)
- Mastery level display
- Current study day indicator
- Blind spot warnings

**State:**
- `classes` - User's classes
- `lists` - Assigned vocabulary lists
- `progress` - Per-list progress data
- `loading`, `error`

---

### 5.3 List Management (Teacher)

#### ListLibrary.jsx
**Purpose:** Vocabulary list management hub

**Features:**
- View all owned lists
- Create new list button
- Edit/delete existing lists
- View list metadata (word count, classes assigned)
- Import words from file

**State:**
- `lists` - Teacher's vocabulary lists
- `loading`, `error`

---

#### ListEditor.jsx
**Purpose:** Create/edit individual word lists

**Features:**
- Add/remove/edit vocabulary entries
- Word fields: English term, Korean translation, definition, example sentence
- Part of speech selection
- Bulk import from CSV/Excel
- Position/order management
- Publishing controls
- Delete list option

**URL Params:**
- `:listId` - List ID (or "new" for creation mode)

**State:**
- `list` - List metadata
- `words` - Array of word objects
- `editingWord` - Currently editing word
- `isNew` - Creation vs edit mode

---

### 5.4 Class Management (Teacher)

#### ClassDetail.jsx
**Purpose:** Individual class management

**Features:**
- Class info display (name, join code)
- Student enrollment list
- Assign/unassign lists
- Assignment settings per list:
  - Weekly pace (words/week)
  - Test sizes (new/review)
  - Pass thresholds
  - Test mode (MCQ/Typed/Both)
- View class gradebook
- Remove students
- Delete class option

**URL Params:**
- `:classId` - Class ID

**State:**
- `classData` - Class metadata
- `students` - Enrolled students
- `assignments` - Assigned lists with settings
- `loading`, `error`

---

### 5.5 Study Session

#### DailySessionFlow.jsx
**Purpose:** Main study session interface

**Session Phases:**
1. `NEW_WORDS_STUDY` - Flashcard study of new vocabulary
2. `NEW_WORDS_TEST` - MCQ test on new words (95% pass required)
3. `REVIEW_STUDY` - Flashcard review of previous words
4. `REVIEW_TEST` - Test on review material
5. `COMPLETE` - Session finished

**Features:**
- Flashcard interface with flip animation
- Word dismissal (mark as known)
- Progress tracking through phases
- Session recovery for interrupted sessions
- Phase-appropriate navigation
- Mastery visualization

**URL Params:**
- `:classId` - Class context
- `:listId` - Vocabulary list

**State:**
- `phase` - Current session phase
- `words` - Current word set
- `currentIndex` - Flashcard position
- `dismissedWords` - Words marked as known
- `sessionState` - Persisted session data

---

### 5.6 Testing Pages

#### MCQTest.jsx
**Purpose:** Multiple choice question assessment

**Features:**
- Question display with 4 options
- Instant feedback on answer selection
- Progress indicator
- Score calculation
- Results summary
- Challenge system (flag incorrect answers)

**URL Params:**
- `:classId`, `:listId`

**Query Params:**
- `type` - 'new' or 'review'
- `words` - Word IDs to test

**State:**
- `questions` - Test questions
- `currentIndex` - Current question
- `answers` - User's answers
- `score` - Running score
- `isComplete` - Test finished flag

---

#### TypedTest.jsx
**Purpose:** Typed/fill-in response assessment

**Features:**
- Question with text input
- AI grading via Cloud Functions
- Accepts correct spellings and close variants
- Detailed feedback on answers
- Score with AI reasoning

**URL Params:**
- `:classId`, `:listId`

**State:**
- `questions` - Test questions
- `currentIndex` - Current question
- `typedAnswer` - User's input
- `results` - Graded answers

---

#### BlindSpotCheck.jsx
**Purpose:** Gap identification assessment

**Identifies:**
- Words never tested (`NEVER_TESTED` status)
- Stale words (not tested in 21+ days)

**Features:**
- Displays blind spot count
- Generates MCQ test from blind spot pool
- Reports remaining blind spots after test
- Recommendations for addressing gaps

**URL Params:**
- `:classId`, `:listId`

**State:**
- `blindSpots` - Words needing attention
- `testStarted` - Test in progress flag
- `results` - Test results

---

### 5.7 Analytics

#### Gradebook.jsx
**Purpose:** Performance tracking (role-specific views)

**Teacher View:**
- Search/filter by student, class, list, date
- View all student attempts
- Sort by multiple columns
- Export to Excel
- View detailed attempt results
- AI grading reasoning display
- Challenge review interface

**Student View:**
- Personal test history
- Performance trends
- Filter by class/list/date
- Score statistics

**Features:**
- Pagination with infinite scroll
- Advanced filtering
- Date range selection
- Export functionality

**State:**
- `attempts` - Test attempt records
- `filters` - Active filter state
- `pagination` - Cursor for infinite scroll
- `loading`, `error`

---

### 5.8 Settings

#### Settings.jsx
**Purpose:** User preferences and customization

**Features:**
- Theme selection (light/dark)
- UI roundness adjustment
- Border weight preference
- Settings preview
- Student-only: Reset progress (with confirmation)

**State:**
- `theme` - Current theme
- `roundness` - UI roundness level
- `borderWeight` - Border thickness
- `showResetModal` - Reset confirmation modal

---

## 6. Component Library

### 6.1 UI Primitives (`src/components/ui/`)

#### Button.jsx
**Purpose:** Primary action button with variants

**Variants:**
| Variant | Use Case | Colors |
|---------|----------|--------|
| `primary` | Main CTAs (Study Now, Create) | Orange (#F97316) |
| `primary-blue` | Secondary CTAs (Take Test, Submit) | Navy (#1B3A94) |
| `secondary` | Alternative actions | Outlined blue |
| `outline` | Cancel, Back | Gray outlined |
| `ghost` | Low-emphasis | Minimal styling |
| `danger` | Delete, destructive | Red |
| `success` | Accept, confirm | Green |
| `warning` | Caution actions | Amber |

**Sizes:**
| Size | Height | Padding |
|------|--------|---------|
| `sm` | h-8 | px-3 |
| `md` | h-10 | px-4 |
| `lg` | h-12 | px-5 |
| `xl` | h-14 | px-6 |

**Props:**
- `variant` - Button style variant
- `size` - Button size
- `to` - Internal navigation (React Router)
- `href` - External link
- `disabled` - Disabled state
- `loading` - Loading state with spinner

---

#### IconButton.jsx
**Purpose:** Icon-only buttons

**Variants:**
| Variant | Use Case |
|---------|----------|
| `default` | General icon actions |
| `danger` | Delete icons |
| `ghost` | Minimal emphasis |
| `close` | Modal close buttons |

**Sizes:** `sm` (h-8), `md` (h-10), `lg` (h-12)

---

#### Card.jsx
**Purpose:** Content container with variants

**Variants:**
| Variant | Use Case | Styling |
|---------|----------|---------|
| `section` | Large page sections | p-6, larger radius |
| `header` | Page headers | Prominent shadow |
| `content` | Standard cards | Hover effects |
| `modal` | Modal containers | Centered, backdrop |
| `inset` | Nested cards | Subtle background |
| `stat` | Small info display | Compact padding |
| `alert-error` | Error messages | Red theme |
| `alert-success` | Success messages | Green theme |
| `alert-warning` | Warnings | Amber theme |
| `alert-info` | Information | Blue theme |
| `empty` | Empty states | Dashed border |

---

#### Input.jsx
**Purpose:** Form text input

**Props:**
- `label` - Input label
- `error` - Error message
- `helper` - Helper text
- `size` - Input size
- Standard input attributes

---

#### Select.jsx
**Purpose:** Dropdown select field

**Props:**
- `label` - Select label
- `options` - Array of { value, label }
- `error` - Error message
- `placeholder` - Default text

---

#### Modal.jsx
**Purpose:** Modal dialog wrapper

**Props:**
- `isOpen` - Visibility state
- `onClose` - Close handler
- `title` - Modal title
- `size` - Modal width
- `children` - Modal content

---

#### Badge.jsx
**Purpose:** Small label/tag display

**Variants:** `default`, `success`, `warning`, `error`, `info`

---

#### Textarea.jsx
**Purpose:** Multi-line text input

**Props:**
- `label` - Textarea label
- `rows` - Number of rows
- `error` - Error message
- `maxLength` - Character limit

---

### 6.2 Button Variants (`src/components/ui/buttons/`)

| Component | Purpose |
|-----------|---------|
| `NavButton.jsx` | Navigation bar buttons |
| `TabButton.jsx` | Tab navigation |
| `LinkButton.jsx` | Button styled as link |
| `CardButton.jsx` | Full-card clickable area |
| `TagButton.jsx` | Filter/tag selection (h-8, compact) |

---

### 6.3 Application Components

#### Layout Components

| Component | Purpose |
|-----------|---------|
| `HeaderBar.jsx` | Global header with nav, user dropdown, help |
| `BackButton.jsx` | Navigation back button |
| `Watermark.jsx` | Background branding element |

#### Session Components

| Component | Purpose |
|-----------|---------|
| `SessionHeader.jsx` | Current list info, progress, study day |
| `SessionSteps.jsx` | Progress indicator through phases |
| `SessionMenu.jsx` | Action menu for session navigation |
| `SessionProgressBanner.jsx` | Visual progress tracking |
| `SessionProgressSheet.jsx` | Detailed session metrics |
| `Flashcard.jsx` | Interactive flashcard with flip animation |
| `SessionSummaryCard.jsx` | Post-session statistics |

#### Data Display Components

| Component | Purpose |
|-----------|---------|
| `MasteryBars.jsx` | Horizontal progress bars for mastery |
| `MasterySquares.jsx` | Grid of mastery indicators |
| `BlindSpotsCard.jsx` | Blind spot statistics card |
| `TestResults.jsx` | Detailed test result breakdown |
| `DismissedWordsDrawer.jsx` | Sliding panel for dismissed words |

#### Modal Components

| Component | Purpose |
|-----------|---------|
| `CreateClassModal.jsx` | Create new class dialog |
| `AssignListModal.jsx` | Assign lists to classes |
| `ImportWordsModal.jsx` | Bulk word import |
| `ConfirmModal.jsx` | Generic confirmation dialog |
| `HelpModal.jsx` | Help/feature guide |
| `StudySelectionModal.jsx` | Study mode selection |

#### Utility Components

| Component | Purpose |
|-----------|---------|
| `LoadingSpinner.jsx` | Animated loading indicator |
| `ErrorDisplay.jsx` | Error message display |
| `PrivateRoute.jsx` | Auth protection wrapper |
| `TeacherRoute.jsx` | Role-based protection |

---

## 7. Design System

### 7.1 Design Tokens (`src/index.css`)

All design values are defined as CSS custom properties for consistency and theme support.

#### Background Colors

| Token | Light Mode | Use Case |
|-------|------------|----------|
| `bg-base` | #f8fafc | Page backgrounds |
| `bg-surface` | #ffffff | Cards, modals |
| `bg-muted` | #f1f5f9 | Subtle backgrounds |
| `bg-inset` | #e2e8f0 | Inset elements |

#### Text Colors

| Token | Light Mode | Use Case |
|-------|------------|----------|
| `text-text-primary` | slate-900 | Headings, important text |
| `text-text-secondary` | slate-700 | Body text |
| `text-text-muted` | slate-500 | Secondary information |
| `text-text-faint` | slate-400 | Hints, placeholders |

#### Border Colors

| Token | Use Case |
|-------|----------|
| `border-border-default` | Standard borders |
| `border-border-strong` | Emphasized borders |
| `border-border-muted` | Subtle borders |

#### Semantic State Colors

| State | Token | Use Case |
|-------|-------|----------|
| Success | `bg-success`, `text-success` | Correct answers, completion |
| Error | `bg-error`, `text-error` | Wrong answers, errors |
| Warning | `bg-warning`, `text-warning` | Caution states |
| Info | `bg-info`, `text-info` | Informational messages |

Each state has `-subtle` variants for backgrounds.

#### Brand Colors

| Token | Value | Use Case |
|-------|-------|----------|
| `bg-brand-primary` | #1B3A94 | Primary brand color (navy) |
| `bg-brand-accent` | #F97316 | Accent color (orange) |
| `text-brand-text` | - | Brand-colored text |

#### Accent Background Colors

| Token | Use Case |
|-------|----------|
| `bg-accent-blue` | Blue accents |
| `bg-accent-red` | Red accents |
| `bg-accent-green` | Green accents |
| `bg-accent-amber` | Amber accents |
| `bg-accent-purple` | Purple accents |

---

### 7.2 Border Radius Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| `--radius-card` | 1rem (16px) | Standard cards |
| `--radius-card-lg` | 1.5rem (24px) | Large section cards |
| `--radius-button` | 1rem | Standard buttons |
| `--radius-button-sm` | 0.5rem (8px) | Small buttons, tags |
| `--radius-input` | 0.75rem (12px) | Form inputs |
| `--radius-alert` | 0.5rem | Alert boxes |
| `--radius-modal` | 1rem | Modal dialogs |

**Usage:**
```jsx
<div className="rounded-[--radius-card]">
<button className="rounded-[--radius-button]">
```

---

### 7.3 Shadow Tokens

| Token | Use Case |
|-------|----------|
| `shadow-theme-sm` | Subtle elevation |
| `shadow-theme-md` | Standard cards |
| `shadow-theme-lg` | Prominent elements |
| `shadow-theme-xl` | Modals, dropdowns |
| `shadow-theme-2xl` | Maximum elevation |

---

### 7.4 Typography

**Fonts:**
- **Heading Font:** Plus Jakarta Sans (Google Fonts)
- **Body Font:** Pretendard (locally hosted, weights 100-900)

**Font Classes:**
```css
.font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
.font-body { font-family: 'Pretendard', sans-serif; }
```

**Font Loading:**
- Plus Jakarta Sans loaded via Google Fonts CDN
- Pretendard fonts hosted locally in `/public/`
- Supports Korean text rendering

---

### 7.5 Interactive States

**Hover Effect:**
```css
hover:-translate-y-0.5  /* Lift effect */
hover:shadow-theme-lg   /* Increased shadow */
```

**Active Effect:**
```css
active:translate-y-0    /* Remove lift */
active:scale-95         /* Press effect */
```

**Disabled State:**
```css
disabled:opacity-50
disabled:cursor-not-allowed
```

---

### 7.6 Dark Mode Support

All color tokens automatically adapt for dark mode via `.dark` class:

```css
.dark {
  --color-bg-base: #0f172a;      /* slate-900 */
  --color-bg-surface: #1e293b;   /* slate-800 */
  --color-bg-muted: #334155;     /* slate-700 */
  --text-primary-rgb: 248 250 252; /* slate-50 */
  /* ... */
}
```

**Implementation:**
- ThemeContext manages theme state
- `.dark` class applied to document root
- All tokens reference CSS variables

---

### 7.7 Design Principles

1. **Elevation Strategy:** Cards use border + subtle shadow; buttons use stronger shadows
2. **Interaction Feedback:** Buttons lift on hover, compress on active
3. **Semantic Coloring:** Colors map to intent (red=danger, green=success)
4. **Spacing Consistency:** Uses Tailwind spacing scale (4, 8, 12, 16, 24, 32...)
5. **Accessibility:** Proper contrast ratios, focus states, ARIA attributes
6. **Responsive Design:** Mobile-first with `md:` breakpoint adjustments

---

## 8. State Management

### 8.1 AuthContext (`src/contexts/AuthContext.jsx`)

**Purpose:** User authentication and profile management

**State Provided:**
```javascript
{
  user: {
    uid: string,
    email: string,
    role: 'student' | 'teacher',
    profile: {
      displayName: string,
      school: string,
      gradYear: number,
      gradMonth: number,
      calculatedGrade: number,
      avatarUrl: string
    },
    stats: {
      totalWordsLearned: number
    },
    settings: {
      weeklyGoal: number,
      useUnifiedQueue: boolean,
      primaryFocusListId: string,
      primaryFocusClassId: string
    }
  },
  initializing: boolean  // Loading state during auth check
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `signup(email, password, role)` | Create new account |
| `login(email, password)` | Email/password auth |
| `logout()` | Sign out |
| `signInWithGoogle()` | Google OAuth login |
| `linkGoogleAccount()` | Link Google to existing account |

**Data Flow:**
```
Firebase Auth State Change
         │
         ▼
   Load User Profile
   (from Firestore)
         │
         ▼
   Merge Auth + Profile
         │
         ▼
   Update Context State
```

---

### 8.2 ThemeContext (`src/contexts/ThemeContext.jsx`)

**Purpose:** UI appearance preferences with persistence

**State Provided:**
```javascript
{
  theme: 'light' | 'dark',
  roundness: 'sharp' | 'normal' | 'rounded',
  borderWeight: 'light' | 'normal' | 'strong'
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setTheme(theme)` | Change light/dark mode |
| `setRoundness(level)` | Adjust corner rounding |
| `setBorderWeight(weight)` | Adjust border thickness |

**Features:**
- Syncs with system preference (`prefers-color-scheme`)
- Persists all values to localStorage
- Sets CSS custom properties dynamically
- Applies `.dark` class to document root

---

### 8.3 Local State Patterns

**Component-Level State:**
- Form inputs and validation
- Loading/error states
- UI toggles (modals, dropdowns)

**URL-Based State:**
- Route parameters (`:classId`, `:listId`)
- Query parameters (test type, filter values)

**Session State:**
- Study session progress (localStorage + Firestore)
- Test progress (in-memory, lost on navigation)

---

### 8.4 Session State Persistence

**Storage Locations:**
| Data | Storage | Scope |
|------|---------|-------|
| Session phase | Firestore | Per user/class/list |
| Flashcard progress | localStorage | Browser session |
| Test answers | In-memory | Single test |
| Dismissed words | Firestore | Per session |

**Recovery Flow:**
```
Page Load
    │
    ▼
Check Firestore for session_state
    │
    ├─ Found incomplete session
    │       │
    │       ▼
    │   Show re-entry modal
    │       │
    │       ├─ Resume → Restore phase
    │       └─ Restart → Clear state
    │
    └─ No session → Start fresh
```

---

## 9. Services Layer

### 9.1 Database Service (`src/services/db.js`)

**Size:** ~3014 lines
**Purpose:** All Firestore CRUD operations with retry logic

#### Retry Infrastructure

```javascript
async function withRetry(operation, maxRetries = 3) {
  // Exponential backoff with jitter
  // Detects transient errors: network, timeout, unavailable
  // Used for critical operations
}
```

#### User Operations

| Function | Purpose |
|----------|---------|
| `createUserDocument(uid, data)` | Initialize user on signup |
| `updateUserSettings(uid, settings)` | Store preferences |
| `getUserProfile(uid)` | Fetch user data |

#### Class Operations

| Function | Purpose |
|----------|---------|
| `createClass(teacherId, name)` | Create new class |
| `fetchTeacherClasses(teacherId)` | Get teacher's classes |
| `deleteClass(classId)` | Remove class |
| `joinClass(studentId, joinCode)` | Student enrollment |
| `removeStudentFromClass(classId, studentId)` | Remove student |

#### List Operations

| Function | Purpose |
|----------|---------|
| `createList(teacherId, title)` | Create vocabulary list |
| `fetchTeacherLists(teacherId)` | Get teacher's lists |
| `deleteList(listId)` | Remove list |
| `fetchAllWords(listId)` | Get all words in list |

#### Word Operations

| Function | Purpose |
|----------|---------|
| `addWordToList(listId, word)` | Add single word |
| `batchAddWords(listId, words)` | Bulk import |
| `updateWord(listId, wordId, data)` | Edit word |
| `deleteWord(listId, wordId)` | Remove word |

#### Assignment Operations

| Function | Purpose |
|----------|---------|
| `assignListToClass(classId, listId, settings)` | Assign with config |
| `unassignListFromClass(classId, listId)` | Remove assignment |
| `updateAssignmentSettings(classId, listId, settings)` | Update pace, thresholds |

#### Attempt Operations

| Function | Purpose |
|----------|---------|
| `submitTestAttempt(userId, data)` | Record MCQ results |
| `submitTypedTestAttempt(userId, data)` | Record typed results |
| `queryTeacherAttempts(teacherId, filters)` | Teacher gradebook |
| `queryStudentAttempts(studentId, filters)` | Student history |
| `getRecentAttemptsForClassList(userId, classId, listId)` | Last 8 attempts |

#### Challenge Operations

| Function | Purpose |
|----------|---------|
| `submitChallenge(studentId, wordId, data)` | Flag word for review |
| `reviewChallenge(challengeId, decision)` | Teacher accepts/rejects |

#### Utility Operations

| Function | Purpose |
|----------|---------|
| `logSystemEvent(type, data)` | Log anomalies |
| `resetStudentProgress(userId, classId, listId)` | Clear progress |
| `normalizeStudyState(state)` | Normalize state document |

---

### 9.2 Session Service (`src/services/sessionService.js`)

**Purpose:** Study session state management across page reloads

#### Session Phases

```javascript
const PHASES = {
  NEW_WORDS_STUDY: 'NEW_WORDS_STUDY',
  NEW_WORDS_TEST: 'NEW_WORDS_TEST',
  REVIEW_STUDY: 'REVIEW_STUDY',
  REVIEW_TEST: 'REVIEW_TEST',
  COMPLETE: 'COMPLETE'
};
```

#### Key Functions

| Function | Purpose |
|----------|---------|
| `getSessionState(userId, classId, listId)` | Load session |
| `saveSessionState(userId, classId, listId, state)` | Persist session |
| `clearSessionState(userId, classId, listId)` | Reset session |
| `dismissWord(userId, classId, listId, wordId, phase)` | Mark word as known |
| `recordNewWordsTestResult(...)` | Record new words test |
| `recordReviewTestResult(...)` | Record review test |
| `shouldShowReEntryModal(state)` | Check for incomplete session |
| `getReviewTestType(attemptCount)` | Determine typed vs MCQ |

#### Storage Schema

```
users/{userId}/session_states/{classId}_{listId}
{
  phase: string,
  newWordsDismissed: [wordId],
  reviewWordsDismissed: [wordId],
  newWordsTestPassed: boolean,
  newWordsTestScore: number,
  reviewTestPassed: boolean,
  reviewTestScore: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 9.3 Study Service (`src/services/studyService.js`)

**Size:** ~1180 lines
**Purpose:** Core study algorithm orchestration

#### Session Initialization

```javascript
async function initializeDailySession(userId, classId, listId, settings) {
  // 1. Load or create student progress
  // 2. Calculate intervention level from recent scores
  // 3. Determine daily allocation (new vs review)
  // 4. Calculate review segment based on week structure
  // 5. Detect session recovery state
  return { config, newWords, reviewWords, recoveryState };
}
```

#### Word Fetching

| Function | Purpose |
|----------|---------|
| `getSegmentWords(userId, listId, start, end)` | Get words in range |
| `getNewWords(userId, classId, listId, count)` | Get next new words |
| `getFailedFromPreviousNewWords(userId, listId)` | Get failed words |
| `buildReviewQueue(userId, listId, segment, todayFailed)` | Build review set |

#### Test Processing

```javascript
async function processTestResults(userId, listId, answers) {
  // For each answer:
  // - Update word status (PASSED/FAILED)
  // - Increment lifetime statistics
  // - Track queue appearances
}
```

#### Graduation System

```javascript
async function graduateSegmentWords(userId, listId, segmentStart, segmentEnd, score) {
  // X% of segment eligible words graduate to MASTERED
  // Based on review test score
}

async function returnMasteredWords(userId, listId) {
  // Words mastered >21 days ago → NEEDS_CHECK status
}
```

#### Blind Spot Detection

| Function | Purpose |
|----------|---------|
| `getBlindSpotPool(userId, listId)` | Get words needing check |
| `getBlindSpotCount(userId, listId)` | Count blind spots |

**Criteria:**
- Status = NEVER_TESTED
- Last tested > 21 days ago

---

### 9.4 Progress Service (`src/services/progressService.js`)

**Purpose:** Cumulative learning progress tracking

#### Key Data

| Field | Description |
|-------|-------------|
| `currentStudyDay (CSD)` | 1-indexed study day count |
| `totalWordsIntroduced (TWI)` | Count of words introduced |
| `interventionLevel` | 0.0 (none) to 1.0 (max) |
| `recentSessions` | Last 10 session summaries |
| `streakDays` | Consecutive study days |

#### Key Functions

| Function | Purpose |
|----------|---------|
| `getOrCreateClassProgress(userId, classId, listId)` | Load/create progress |
| `updateClassProgress(userId, classId, listId, data)` | Update after session |
| `fetchStudentsProgressForClass(classId, listId)` | Batch fetch for teacher |

#### Reconciliation

```javascript
async function getOrCreateClassProgress(userId, classId, listId) {
  // 1. Load stored progress
  // 2. Calculate CSD/TWI from actual attempt history
  // 3. Detect and fix mismatches
  // 4. Apply bidirectional reconciliation
  return reconciledProgress;
}
```

#### Storage Schema

```
users/{userId}/class_progress/{classId}_{listId}
{
  classId: string,
  listId: string,
  currentStudyDay: number,
  totalWordsIntroduced: number,
  interventionLevel: number,
  recentSessions: [SessionSummary],
  stats: { avgNewWordScore, avgReviewScore },
  streakDays: number,
  lastStudyDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 10. Data Models

### 10.1 Firestore Collection Hierarchy

```
users/{userId}
├── (document fields)
│   ├── email: string
│   ├── role: 'student' | 'teacher'
│   ├── profile: ProfileObject
│   ├── stats: StatsObject
│   ├── settings: SettingsObject
│   └── createdAt: Timestamp
│
├── class_progress/{classId}_{listId}
│   └── (ClassProgressDocument)
│
├── session_states/{classId}_{listId}
│   └── (SessionStateDocument)
│
├── study_states/{wordId}
│   └── (StudyStateDocument)
│
└── attempts/{attemptId}
    └── (AttemptDocument)

classes/{classId}
├── (document fields)
│   ├── name: string
│   ├── joinCode: string
│   ├── ownerTeacherId: string
│   └── createdAt: Timestamp
│
├── assignments/{listId}
│   └── (AssignmentDocument)
│
└── students/{studentId}
    └── (StudentEnrollmentDocument)

lists/{listId}
├── (document fields)
│   ├── title: string
│   ├── description: string
│   ├── ownerId: string
│   ├── visibility: 'private' | 'public'
│   └── wordCount: number
│
└── words/{wordId}
    └── (WordDocument)

system_logs/{eventId}
└── (SystemLogDocument)
```

---

### 10.2 Document Schemas

#### User Profile Object

```javascript
{
  displayName: string,
  school: string,
  gradYear: number,        // Graduation year
  gradMonth: number,       // Graduation month
  calculatedGrade: number, // Computed grade level
  avatarUrl: string
}
```

#### User Stats Object

```javascript
{
  totalWordsLearned: number
}
```

#### User Settings Object

```javascript
{
  weeklyGoal: number,           // Target words per week (default: 100)
  useUnifiedQueue: boolean,     // Queue algorithm option
  primaryFocusListId: string,   // Default list
  primaryFocusClassId: string   // Default class
}
```

#### Study State Document

```javascript
{
  status: 'NEW' | 'PASSED' | 'FAILED' | 'MASTERED' | 'NEEDS_CHECK',
  timesTestedTotal: number,
  timesCorrectTotal: number,
  lastTestedAt: Timestamp,
  lastTestResult: boolean,
  lastQueuedAt: Timestamp,
  queueAppearances: number,
  wordIndex: number,          // 0-indexed position
  introducedOnDay: number,    // CSD when introduced
  listId: string,
  masteredAt: Timestamp,
  returnAt: Timestamp         // 21 days after mastered
}
```

#### Class Progress Document

```javascript
{
  classId: string,
  listId: string,
  currentStudyDay: number,     // 1-indexed
  totalWordsIntroduced: number,
  interventionLevel: number,   // 0.0 - 1.0
  recentSessions: [{
    date: Timestamp,
    newWordsScore: number,
    reviewScore: number,
    wordsIntroduced: number
  }],                          // Last 10
  stats: {
    avgNewWordScore: number,
    avgReviewScore: number
  },
  streakDays: number,
  lastStudyDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Session State Document

```javascript
{
  phase: 'NEW_WORDS_STUDY' | 'NEW_WORDS_TEST' | 'REVIEW_STUDY' | 'REVIEW_TEST' | 'COMPLETE',
  newWordsDismissed: [wordId],
  reviewWordsDismissed: [wordId],
  newWordsTestPassed: boolean,
  newWordsTestScore: number,
  reviewTestPassed: boolean,
  reviewTestScore: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Word Document

```javascript
{
  english: string,
  korean: string,
  definition: string,
  partOfSpeech: string,
  exampleSentence: string,
  position: number,           // Order in list
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Assignment Document

```javascript
{
  listId: string,
  assignedAt: Timestamp,
  pace: number,               // Words per week (default: 400)
  testSizeNew: number,        // New words test size
  testSizeReview: number,     // Review test size
  passThresholdNew: number,   // 0.95 default
  passThresholdReview: number,
  testMode: 'mcq' | 'typed' | 'both',
  typedTestFirst: boolean     // First 3 attempts typed
}
```

#### Attempt Document

```javascript
{
  userId: string,
  classId: string,
  listId: string,
  testType: 'new' | 'review' | 'blindspot',
  inputType: 'mcq' | 'typed',
  score: number,
  totalQuestions: number,
  passed: boolean,
  answers: [{
    wordId: string,
    correct: boolean,
    userAnswer: string,
    aiReasoning: string       // For typed tests
  }],
  studyDay: number,
  createdAt: Timestamp
}
```

---

## 11. Core Algorithms

### 11.1 Algorithm Constants (`src/utils/studyAlgorithm.js`)

```javascript
// Intervention thresholds
INTERVENTION_HIGH_SCORE: 0.75  // ≥75% = no intervention
INTERVENTION_LOW_SCORE: 0.30   // ≤30% = max intervention

// Pass thresholds
DEFAULT_RETAKE_THRESHOLD: 0.95 // 95% to pass new words test

// Time thresholds
STALE_DAYS_THRESHOLD: 21       // Words become blind spots after 21 days

// Test sizes
REVIEW_TEST_SIZE_MIN: 30
REVIEW_TEST_SIZE_MAX: 60

// Pace defaults
DEFAULT_WEEKLY_PACE: 400       // Words per week
DEFAULT_DAILY_PACE: 80         // Words per day (5 days/week)
```

---

### 11.2 Intervention Calculation

**Purpose:** Adjust difficulty based on recent performance

```javascript
function calculateInterventionLevel(recentScores) {
  // Takes last 3 review test scores
  // Maps to 0.0 - 1.0 scale

  const avgScore = average(recentScores);

  if (avgScore >= 0.75) return 0.0;  // No intervention
  if (avgScore <= 0.30) return 1.0;  // Max intervention

  // Linear interpolation between thresholds
  return (0.75 - avgScore) / (0.75 - 0.30);
}
```

**Effect:**
| Intervention | New Words | Review Cap |
|--------------|-----------|------------|
| 0.0 (none) | 100% of pace | 100% of pace |
| 0.5 (moderate) | 50% of pace | 200% of pace |
| 1.0 (max) | 0% new | 300% of pace |

---

### 11.3 Daily Allocation

**Purpose:** Balance new words vs review based on intervention

```javascript
function calculateDailyAllocation(dailyPace, intervention) {
  const newWords = Math.floor(dailyPace * (1 - intervention));
  const reviewCap = Math.floor(dailyPace * (1 + 2 * intervention));

  return { newWords, reviewCap };
}
```

**Examples:**
| Daily Pace | Intervention | New Words | Review Cap |
|------------|--------------|-----------|------------|
| 80 | 0.0 | 80 | 80 |
| 80 | 0.5 | 40 | 160 |
| 80 | 1.0 | 0 | 240 |

---

### 11.4 Review Segment Calculation

**Purpose:** Divide introduced words into daily review chunks

```javascript
function calculateSegment(totalWords, studyDay, studyDaysPerWeek) {
  const currentWeek = Math.ceil(studyDay / studyDaysPerWeek);
  const dayInWeek = ((studyDay - 1) % studyDaysPerWeek) + 1;

  // Week 1: Day 1 has no review
  if (currentWeek === 1 && dayInWeek === 1) {
    return null;
  }

  // Calculate projected words by end of week
  const projectedWords = calculateProjectedWords(...);

  // Divide into n segments (n = study days per week)
  const segmentSize = Math.ceil(projectedWords / studyDaysPerWeek);

  const segmentStart = (dayInWeek - 1) * segmentSize;
  const segmentEnd = dayInWeek * segmentSize;

  return { start: segmentStart, end: segmentEnd };
}
```

---

### 11.5 Review Queue Selection

**Purpose:** Prioritize words for review testing

```javascript
function selectReviewQueue(segmentWords, todayFailedWords, maxSize) {
  // Combine segment words + today's failed new words
  const pool = [...segmentWords, ...todayFailedWords];

  // Priority order:
  // 1. FAILED status
  // 2. NEVER_TESTED status
  // 3. PASSED status

  // Within status, sort by queue recency (least recent first)
  pool.sort((a, b) => {
    const statusPriority = { FAILED: 0, NEVER_TESTED: 1, PASSED: 2 };

    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }

    return a.lastQueuedAt - b.lastQueuedAt;
  });

  return pool.slice(0, maxSize);
}
```

---

### 11.6 Test Word Selection

**Purpose:** Randomly select words for testing

```javascript
function selectTestWords(wordPool, testSize) {
  // Fisher-Yates shuffle
  const shuffled = [...wordPool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, testSize);
}
```

---

### 11.7 Graduation System

**Purpose:** Progress words to MASTERED status

```javascript
async function graduateSegmentWords(userId, listId, segment, testScore) {
  // Get eligible words in segment (PASSED status)
  const eligibleWords = await getEligibleForGraduation(userId, listId, segment);

  // Graduate X% where X = test score
  const graduateCount = Math.floor(eligibleWords.length * testScore);

  // Select words to graduate (oldest first)
  const toGraduate = eligibleWords
    .sort((a, b) => a.introducedOnDay - b.introducedOnDay)
    .slice(0, graduateCount);

  // Update status to MASTERED, set returnAt = now + 21 days
  await batchUpdateStatus(toGraduate, 'MASTERED');
}
```

---

### 11.8 Word Return System

**Purpose:** Return mastered words for retention check

```javascript
async function returnMasteredWords(userId, listId) {
  // Find words where:
  // - status = MASTERED
  // - returnAt <= now

  const returningWords = await query(
    where('status', '==', 'MASTERED'),
    where('returnAt', '<=', now())
  );

  // Update status to NEEDS_CHECK
  await batchUpdateStatus(returningWords, 'NEEDS_CHECK');
}
```

---

### 11.9 Blind Spot Detection

**Purpose:** Identify words needing attention

```javascript
function isBlindSpot(studyState) {
  // Never tested
  if (studyState.status === 'NEW' && studyState.timesTestedTotal === 0) {
    return true;
  }

  // Stale (not tested in 21+ days)
  const daysSinceTest = daysBetween(studyState.lastTestedAt, now());
  if (daysSinceTest > 21) {
    return true;
  }

  return false;
}
```

---

## 12. Study Flow

### 12.1 Daily Session Phases

```
┌─────────────────────────────────────────────────────────────┐
│                    DAY 1 SESSION                            │
├─────────────────────────────────────────────────────────────┤
│  1. NEW_WORDS_STUDY                                         │
│     - Flashcard study of first batch of words               │
│     - Can dismiss words (mark as known)                     │
│                                                             │
│  2. NEW_WORDS_TEST                                          │
│     - MCQ test on new words                                 │
│     - Must score ≥95% to pass                               │
│     - Failed? Repeat test until pass                        │
│                                                             │
│  3. COMPLETE                                                │
│     - Session finished                                      │
│     - Progress updated                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DAY 2+ SESSION                            │
├─────────────────────────────────────────────────────────────┤
│  1. NEW_WORDS_STUDY                                         │
│     - Flashcard study of new words                          │
│                                                             │
│  2. NEW_WORDS_TEST                                          │
│     - MCQ test (95% pass threshold)                         │
│                                                             │
│  3. REVIEW_STUDY                                            │
│     - Flashcard review of segment words                     │
│     - Includes today's failed new words                     │
│                                                             │
│  4. REVIEW_TEST                                             │
│     - MCQ or Typed test                                     │
│     - First 3 attempts: Typed (if enabled)                  │
│     - Score determines graduation %                         │
│                                                             │
│  5. COMPLETE                                                │
│     - Graduate segment words                                │
│     - Update intervention level                             │
│     - Progress updated                                      │
└─────────────────────────────────────────────────────────────┘
```

---

### 12.2 Word Status Lifecycle

```
                    ┌─────────┐
                    │   NEW   │
                    └────┬────┘
                         │ First test
                         ▼
              ┌──────────┴──────────┐
              │                     │
        ┌─────▼─────┐         ┌─────▼─────┐
        │  PASSED   │         │  FAILED   │
        └─────┬─────┘         └─────┬─────┘
              │                     │
              │ Graduation          │ Retest
              ▼                     │
        ┌───────────┐               │
        │ MASTERED  │◄──────────────┘
        └─────┬─────┘      (after passing)
              │
              │ 21 days pass
              ▼
        ┌─────────────┐
        │ NEEDS_CHECK │
        └─────────────┘
              │
              │ Blind spot test
              ▼
        (Back to PASSED/FAILED)
```

---

### 12.3 Pass Thresholds

| Test Type | Default Threshold | Behavior |
|-----------|-------------------|----------|
| New Words Test | 95% | Must retake until pass |
| Review Test | None | Score determines graduation % |
| Blind Spot Test | None | Updates word status only |

---

### 12.4 Session Recovery

**Trigger:** User leaves mid-session and returns

**Detection:**
```javascript
function shouldShowReEntryModal(sessionState) {
  // Incomplete if:
  // - Phase is not COMPLETE
  // - Session was started today

  return sessionState.phase !== 'COMPLETE' &&
         isToday(sessionState.updatedAt);
}
```

**Options:**
1. **Resume** - Continue from saved phase
2. **Restart** - Clear state and start fresh

**What's Preserved:**
- Current phase
- Dismissed words
- Test completion status

**What's Lost:**
- In-progress test answers
- Flashcard position

---

## 13. Utility Functions

### 13.1 Study Algorithm (`src/utils/studyAlgorithm.js`)

**Purpose:** Pure math and logic functions (no database dependencies)

| Function | Purpose |
|----------|---------|
| `calculateInterventionLevel(scores)` | Compute intervention 0.0-1.0 |
| `calculateDailyAllocation(pace, intervention)` | New vs review split |
| `calculateSegment(words, day, daysPerWeek)` | Review segment bounds |
| `selectReviewQueue(segment, failed, max)` | Prioritized review queue |
| `selectTestWords(pool, size)` | Random test selection |

---

### 13.2 Session Recovery (`src/utils/sessionRecovery.js`)

**Purpose:** localStorage session persistence

| Function | Purpose |
|----------|---------|
| `getSessionId(classId, listId, phase)` | Generate unique session key |
| `saveSessionState(id, state)` | Persist to localStorage |
| `getSessionState(id)` | Retrieve from localStorage |
| `clearSessionState(id)` | Remove session |
| `wasInTestPhase(state)` | Check if interrupted during test |

---

### 13.3 Date Provider (`src/utils/dateProvider.js`)

**Purpose:** Time abstraction for testing and simulation

| Function | Purpose |
|----------|---------|
| `now()` | Get current time (mock or real) |
| `setMockDate(date)` | Set simulated time |
| `advanceDays(n)` | Move time forward |
| `advanceHours(n)` | Move time forward |
| `clearMock()` | Reset to real time |
| `isMocked()` | Check if simulation active |

---

### 13.4 Session Step Tracker (`src/utils/sessionStepTracker.js`)

**Purpose:** Calculate progress indicator steps

| Day | Steps |
|-----|-------|
| Day 1 | 3 (study → test → complete) |
| Day 2+ | 5 (study → test → review study → review test → complete) |

---

### 13.5 PDF Generator (`src/utils/pdfGenerator.js`)

**Purpose:** Export study materials as PDF

**Features:**
- Loads Pretendard fonts from CDN
- Korean text rendering support
- Logo embedding
- Table formatting with jspdf-autotable

---

### 13.6 Text-to-Speech (`src/utils/tts.js`)

**Purpose:** Pronunciation assistance

| Function | Purpose |
|----------|---------|
| `speak(text, lang)` | Speak text using Web Speech API |
| `stopSpeaking()` | Cancel current speech |
| `isSpeaking()` | Check speaking state |

---

### 13.7 Test Config (`src/utils/testConfig.js`)

**Purpose:** Unified test parameter builder

```javascript
function buildTestConfig(assignment, pool, type) {
  return {
    words: selectTestWords(pool, assignment.testSize),
    testSize: assignment.testSize,
    passThreshold: assignment.passThreshold,
    testMode: assignment.testMode,
    typedTestFirst: assignment.typedTestFirst
  };
}
```

---

### 13.8 Simulation Config (`src/utils/simulationConfig.js`)

**Purpose:** Test profiles for automated testing

**Profiles:**
| Profile | Accuracy | Dismiss Rate | Retake Rate |
|---------|----------|--------------|-------------|
| Alex | 92% | Rarely | 5% |
| Bailey | 75% | 10% | 30% |
| Casey | 55% | 25% | 70% |

**Speeds:**
| Speed | Card Delay | Question Delay |
|-------|------------|----------------|
| INSTANT | 0ms | 0ms |
| FAST | 100ms | 50ms |
| NORMAL | 1000ms | 500ms |

---

## 14. Development Tools

### 14.1 Simulation System

**Purpose:** Automated testing with synthetic student behavior

#### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SimulationPanel.jsx` | `components/dev/` | Control panel for simulations |
| `SimulationLog.jsx` | `components/dev/` | Event log viewer |
| `SegmentDebugPanel.jsx` | `components/dev/` | Segment visualization |
| `WordPoolChart.jsx` | `components/dev/` | Word pool status chart |

#### Hook: `useSimulation.jsx`

**Provides:**
- Auto-swiping flashcards at configurable speeds
- Auto-answering tests based on profile accuracy
- Full session automation
- Live stats tracking
- Word pool snapshots

**Activation:**
```javascript
// Set environment variable
VITE_SIMULATION_MODE=true
```

---

### 14.2 Firebase Emulator Support

**Purpose:** Local development without production Firebase

**Configuration:**
```javascript
// In firebase.js
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

**Seeding:**
```bash
npm run seed  # Runs scripts/seedEmulator.js
```

---

### 14.3 Debug Panels

**SegmentDebugPanel:**
- Displays current segment boundaries
- Shows word distribution by status
- Visualizes review queue composition

**WordPoolChart:**
- Graphs word status distribution over time
- Tracks graduation progress
- Identifies retention patterns

---

### 14.4 Logging

**Event Types:**
| Type | Purpose |
|------|---------|
| `logEvent()` | Generic event |
| `logTestAttempt()` | Test completion |
| `logPhaseTransition()` | Session phase changes |
| `logGraduation()` | Word graduation |
| `logMismatch()` | Validation failures (non-breaking) |
| `logError()` | Breaking errors |

**Export:**
- JSON export of all events
- CSV export for word pool analysis

---

## 15. Security & Access Control

### 15.1 Role-Based Access

| Role | Capabilities |
|------|--------------|
| **Student** | View enrolled classes, complete sessions, view personal gradebook |
| **Teacher** | Create classes/lists, manage students, view class gradebook, assign lists |

**Route Protection:**
```jsx
// Student + Teacher routes
<PrivateRoute>
  <Dashboard />
</PrivateRoute>

// Teacher-only routes
<PrivateRoute>
  <TeacherRoute>
    <ListLibrary />
  </TeacherRoute>
</PrivateRoute>
```

---

### 15.2 Environment Variables

**Required:**
```env
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

**Optional:**
```env
VITE_USE_EMULATOR=true      # Enable Firebase emulators
VITE_SIMULATION_MODE=true   # Enable dev simulation tools
```

**Validation:**
```javascript
// firebase.js validates all required vars at startup
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  // ...
];

requiredVars.forEach(varName => {
  if (!import.meta.env[varName]) {
    throw new Error(`Missing required env var: ${varName}`);
  }
});
```

---

### 15.3 Data Access Patterns

**User Data Isolation:**
- Users can only read/write their own documents
- Study states scoped to user ID
- Progress scoped to user + class + list

**Teacher Data Access:**
- Teachers can read students enrolled in their classes
- Teachers can read attempts for their classes
- Teachers cannot modify student study states

**Class Membership:**
- Students join via class join code
- Only enrolled students can access class lists
- Teachers own classes they created

---

### 15.4 Security Best Practices

1. **No credentials in code:** All secrets via environment variables
2. **Server-side validation:** Cloud Functions validate inputs
3. **Firestore rules:** Document-level access control
4. **Input sanitization:** User inputs escaped before display
5. **HTTPS only:** Firebase enforces secure connections

---

## Appendix A: File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/db.js` | ~3014 | All Firestore operations |
| `src/services/studyService.js` | ~1180 | Study algorithm orchestration |
| `src/utils/studyAlgorithm.js` | ~351 | Pure algorithm functions |
| `src/services/sessionService.js` | ~300 | Session state management |
| `src/services/progressService.js` | ~250 | Progress tracking |
| `src/pages/DailySessionFlow.jsx` | ~800 | Main study interface |
| `src/pages/Gradebook.jsx` | ~600 | Analytics page |
| `src/index.css` | ~500 | Design tokens |

---

## Appendix B: Quick Reference

### Session Phase Flow
```
NEW_WORDS_STUDY → NEW_WORDS_TEST → REVIEW_STUDY → REVIEW_TEST → COMPLETE
```

### Word Status Flow
```
NEW → PASSED/FAILED → MASTERED → NEEDS_CHECK → (loop)
```

### Key Thresholds
- New test pass: 95%
- Intervention high: 75%
- Intervention low: 30%
- Stale days: 21

### Design Token Usage
```jsx
// DO
<div className="bg-surface text-text-primary rounded-[--radius-card]">

// DON'T
<div className="bg-white text-gray-900 rounded-lg">
```

---

*End of Technical Specification*

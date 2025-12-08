# VocaBoost Authentication & Authorization Specification

## Overview

VocaBoost uses **Firebase Authentication** for user authentication and implements **role-based access control (RBAC)** for authorization. This document explains the complete authentication flow, authorization mechanisms, data structures, and Firebase protocols used.

---

## 1. Firebase Configuration

### Firebase Setup

**File:** `src/firebase.js`

The Firebase app is initialized with configuration from environment variables:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
```

**Required Environment Variables:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Firebase Services Initialized:**
- `auth`: Firebase Authentication instance
- `db`: Firestore database instance

---

## 2. Authentication Context (AuthContext)

### Location
`src/contexts/AuthContext.jsx`

### Purpose
Provides authentication state and methods to all components via React Context API.

### State Management

**State Variables:**
- `user`: Current authenticated user object (null if not authenticated)
- `initializing`: Boolean flag indicating if auth state is still being determined

### Firebase Auth State Listener

The `AuthProvider` component sets up a Firebase Auth state listener using `onAuthStateChanged()`:

```javascript
onAuthStateChanged(auth, (firebaseUser) => {
  // Called whenever auth state changes (login, logout, token refresh)
})
```

**Flow:**
1. **No User**: If `firebaseUser` is null, sets `user` to null and `initializing` to false
2. **User Authenticated**: 
   - Fetches user document from Firestore: `users/{uid}`
   - Enriches Firebase user object with Firestore data:
     - `role`: From Firestore (defaults to 'student' if missing)
     - `profile`: User profile data
     - `stats`: User statistics
     - `settings`: User settings
   - Sets `initializing` to false

**Error Handling:**
- If Firestore fetch fails, user object is created with default role 'student'
- Component unmounting is tracked to prevent state updates on unmounted components

### Auth Methods Provided

#### `signup(email, password, name, gradData)`
Creates a new user account.

**Flow:**
1. Calls `createUserWithEmailAndPassword(auth, email, password)` - Firebase Auth
2. Updates Firebase profile with `displayName` using `updateProfile()`
3. Creates Firestore user document via `createUserDocument()`
4. Returns `userCredential.user`

**Parameters:**
- `email`: User's email address
- `password`: User's password (Firebase handles hashing)
- `name`: Display name (optional)
- `gradData`: Object with `gradYear` and `gradMonth` (optional)

#### `login(email, password)`
Signs in an existing user.

**Flow:**
1. Calls `signInWithEmailAndPassword(auth, email, password)` - Firebase Auth
2. Firebase Auth state listener automatically triggers and loads user profile

**Returns:** Promise that resolves when sign-in completes

#### `logout()`
Signs out the current user.

**Flow:**
1. Calls `signOut(auth)` - Firebase Auth
2. Auth state listener automatically triggers and sets `user` to null

---

## 3. User Registration (Signup) Process

### Location
`src/pages/Signup.jsx`

### Registration Form Fields

1. **Full Name** (`displayName`) - Required
2. **Email** (`email`) - Required, validated as email
3. **Password** (`password`) - Required
4. **Graduation Year** (`gradYear`) - Optional, number (2024-2035)
5. **Graduation Month** (`gradMonth`) - Optional, number (1-12)

### Signup Flow

```
User fills form
  ↓
Form validation
  ↓
Call auth.signup(email, password, name, gradData)
  ↓
Firebase creates auth account
  ↓
Update Firebase profile (displayName)
  ↓
Create Firestore user document
  ↓
Auth state listener triggers
  ↓
Load user profile from Firestore
  ↓
Navigate to Dashboard (/)
```

### User Document Creation

When a new user signs up, `createUserDocument()` is called with:

**Default Values:**
- `role`: 'student' (default role for all new users)
- `email`: From Firebase Auth user object
- `profile`: Merged from defaults + provided data
- `stats`: Default stats object
- `settings`: Default settings object
- `enrolledClasses`: Empty object `{}`
- `createdAt`: Server timestamp

**See Section 5 for complete data structure.**

---

## 4. User Login Process

### Location
`src/pages/Login.jsx`

### Login Flow

```
User enters email/password
  ↓
Call auth.login(email, password)
  ↓
Firebase Authentication validates credentials
  ↓
If valid: Firebase Auth state changes
  ↓
onAuthStateChanged listener triggers
  ↓
Fetch user document from Firestore
  ↓
Enrich user object with role/profile/stats/settings
  ↓
Auto-redirect to Dashboard (/)
```

### Auto-Redirect Logic

The Login component uses a `useEffect` hook that watches the `user` state:

```javascript
useEffect(() => {
  if (user) {
    navigate('/')  // Redirect to dashboard when authenticated
  }
}, [user, navigate])
```

This ensures users are automatically redirected after successful login.

### Error Handling

- Invalid credentials: Firebase throws error, displayed to user
- Network errors: Caught and displayed with user-friendly message
- Form validation: Client-side validation before submission

---

## 5. User Data Structure

### Firestore User Document

**Location:** `users/{uid}`

**Structure:**

```typescript
{
  // Core Identity
  role: "student" | "teacher" | "admin",  // Default: "student"
  email: string,                           // From Firebase Auth
  
  // Profile Information
  profile: {
    displayName: string,      // User's full name
    school: string,           // School name (optional)
    gradYear: number | null,  // Graduation year
    gradMonth: number | null,  // Graduation month (1-12)
    calculatedGrade: number | null,  // Calculated grade level
    avatarUrl: string,        // Profile picture URL
  },
  
  // Statistics
  stats: {
    totalWordsLearned: number,  // Total words mastered
    streakDays: number,         // Consecutive study days
    credibility: number,       // Trust score (0.0-1.0)
    retention: number,        // Retention rate (0.0-1.0)
  },
  
  // User Settings
  settings: {
    weeklyGoal: number,        // Weekly word goal (default: 100)
    useUnifiedQueue: boolean,  // Unified study queue setting
  },
  
  // Class Enrollment
  enrolledClasses: {
    [classId: string]: {
      name: string,            // Class name
      joinedAt: Timestamp,      // Join timestamp
    }
  },
  
  // Metadata
  createdAt: Timestamp,        // Account creation time
}
```

### Default Values

**Default Profile:**
```javascript
{
  displayName: '',
  school: '',
  gradYear: null,
  gradMonth: null,
  calculatedGrade: null,
  avatarUrl: '',
}
```

**Default Stats:**
```javascript
{
  totalWordsLearned: 0,
  streakDays: 0,
}
```

**Default Settings:**
```javascript
{
  weeklyGoal: 100,
  useUnifiedQueue: false,
}
```

### Enriched User Object (Context)

The `user` object in `AuthContext` combines Firebase Auth user with Firestore data:

```typescript
{
  // Firebase Auth Properties
  uid: string,
  email: string | null,
  displayName: string | null,
  photoURL: string | null,
  emailVerified: boolean,
  // ... other Firebase Auth properties
  
  // Enriched from Firestore
  role: "student" | "teacher",
  profile: ProfileObject | null,
  stats: StatsObject | null,
  settings: SettingsObject | null,
}
```

---

## 6. Authorization Mechanism

### Role-Based Access Control (RBAC)

VocaBoost uses a simple role-based system with two primary roles:

1. **Student** (`role: 'student'`)
   - Default role for all new users
   - Can study, take tests, view own gradebook
   - Cannot access teacher-only features

2. **Teacher** (`role: 'teacher'`)
   - Must be manually set in Firestore (no UI for role assignment)
   - Can create/manage lists, classes, view gradebook
   - Has access to all teacher dashboard features

### Route Protection Components

#### PrivateRoute

**Location:** `src/components/PrivateRoute.jsx`

**Purpose:** Ensures user is authenticated before accessing a route.

**Logic:**
```javascript
if (initializing) {
  return <LoadingScreen />
}

if (!user) {
  return <Navigate to="/login" replace />
}

return children  // Render protected content
```

**Usage:**
Wraps routes that require authentication (all routes except `/login` and `/signup`).

#### TeacherRoute

**Location:** `src/components/TeacherRoute.jsx`

**Purpose:** Ensures user has teacher role before accessing a route.

**Logic:**
```javascript
if (initializing) {
  return <LoadingScreen />
}

if (user?.role !== 'teacher') {
  return <Navigate to="/" replace />  // Redirect to dashboard
}

return children  // Render teacher-only content
```

**Usage:**
Wraps routes that require teacher role (e.g., `/lists`, `/classes/:classId`, `/teacher/gradebook`).

### Route Protection Hierarchy

Routes can be protected with multiple layers:

```jsx
<Route
  path="/lists"
  element={
    <PrivateRoute>        {/* Layer 1: Must be authenticated */}
      <TeacherRoute>      {/* Layer 2: Must be teacher */}
        <ListLibrary />
      </TeacherRoute>
    </PrivateRoute>
  }
/>
```

**Protection Levels:**
1. **Public Routes**: `/login`, `/signup` (no protection)
2. **Authenticated Routes**: All other routes wrapped in `PrivateRoute`
3. **Teacher Routes**: Teacher-only routes wrapped in both `PrivateRoute` and `TeacherRoute`

### Route Configuration

**File:** `src/App.jsx`

**Public Routes:**
- `/login` - Login page
- `/signup` - Signup page

**Authenticated Routes (Student & Teacher):**
- `/` - Dashboard
- `/study/:listId` - Study session
- `/test/:listId` - Take test
- `/gradebook` - Student gradebook

**Teacher-Only Routes:**
- `/lists` - List library
- `/lists/new` - Create list
- `/lists/:listId` - Edit list
- `/classes/:classId` - Class management
- `/teacher/gradebook` - Teacher gradebook

---

## 7. Firebase Authentication Protocols

### Authentication Methods Used

#### Email/Password Authentication

**Primary method** for user authentication.

**Firebase Functions:**
- `createUserWithEmailAndPassword(auth, email, password)`
  - Creates new user account
  - Returns `UserCredential` object
  - Throws error if email already exists or password is weak

- `signInWithEmailAndPassword(auth, email, password)`
  - Signs in existing user
  - Returns `UserCredential` object
  - Throws error if credentials are invalid

- `signOut(auth)`
  - Signs out current user
  - Clears authentication state

- `updateProfile(user, { displayName })`
  - Updates user's display name in Firebase Auth profile

### Auth State Persistence

Firebase Authentication automatically persists auth state:
- **Local Storage**: Auth tokens stored in browser's local storage
- **Automatic Refresh**: Tokens automatically refreshed when expired
- **Session Persistence**: User remains logged in across page refreshes

### Auth State Observer

**Function:** `onAuthStateChanged(auth, callback)`

**Behavior:**
- Called immediately with current auth state
- Called whenever auth state changes (login, logout, token refresh)
- Returns unsubscribe function to stop listening

**Usage in VocaBoost:**
```javascript
const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    // User is authenticated - load profile
  } else {
    // User is not authenticated
  }
})

// Cleanup on unmount
return () => unsubscribe()
```

### Token Management

Firebase handles token management automatically:
- **ID Token**: Used to identify the user (stored in local storage)
- **Refresh Token**: Used to obtain new ID tokens (stored securely)
- **Token Expiration**: Tokens expire after 1 hour, automatically refreshed

### Security Features

1. **Password Hashing**: Firebase handles password hashing (bcrypt)
2. **HTTPS Only**: All auth requests use HTTPS
3. **Token-Based**: Uses JWT tokens for authentication
4. **Email Verification**: Available but not enforced in current implementation
5. **Rate Limiting**: Firebase automatically rate-limits auth attempts

---

## 8. Firestore Security & Data Access

### User Document Access

**Read Access:**
- Users can read their own document: `users/{uid}`
- Teachers can read student documents (via queries)
- No public read access

**Write Access:**
- Users can update their own profile/settings
- System creates/updates user documents during signup
- Teachers cannot directly modify student documents

### Data Queries

**Teacher Queries:**
- Teachers query `attempts` collection filtered by `teacherId`
- Teachers query `classes` collection filtered by `ownerTeacherId`
- Teachers query `lists` collection filtered by `ownerId`

**Student Queries:**
- Students query `attempts` collection filtered by `studentId`
- Students query `classes` collection via `enrolledClasses` map
- Students query `study_states` subcollection under their user document

### Subcollections

**User Subcollections:**
- `users/{uid}/study_states/{wordId}` - Word study progress
  - Only accessible by the user themselves
  - Created/updated during study sessions and tests

---

## 9. Authentication Flow Diagrams

### Complete Signup Flow

```
┌─────────────┐
│ User visits │
│ /signup     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Fill form       │
│ (email, pwd,    │
│  name, grad)    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Submit form     │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────┐
│ auth.signup()               │
│  ↓                          │
│ createUserWithEmailAndPassword│
│  ↓                          │
│ updateProfile(displayName)   │
│  ↓                          │
│ createUserDocument()        │
│  - Creates Firestore doc     │
│  - Sets role: 'student'     │
│  - Sets defaults            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────┐
│ onAuthStateChanged│
│ triggers         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Load user doc   │
│ from Firestore  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Navigate to /   │
│ (Dashboard)     │
└─────────────────┘
```

### Complete Login Flow

```
┌─────────────┐
│ User visits │
│ /login      │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Enter email/    │
│ password        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Submit form     │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────┐
│ auth.login()                │
│  ↓                          │
│ signInWithEmailAndPassword  │
│  ↓                          │
│ Firebase validates          │
│ credentials                 │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────┐
│ onAuthStateChanged│
│ triggers         │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Load user doc   │
│ from Firestore  │
│  - role         │
│  - profile      │
│  - stats        │
│  - settings     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Navigate to /    │
│ (Dashboard)      │
└─────────────────┘
```

### Authorization Check Flow

```
┌─────────────────┐
│ User navigates  │
│ to protected    │
│ route           │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ PrivateRoute    │
│ checks:         │
│ - initializing? │
│ - user exists?  │
└──────┬──────────┘
       │
       ├─ No user → Redirect to /login
       │
       ▼
┌─────────────────┐
│ TeacherRoute    │
│ (if applicable) │
│ checks:         │
│ - role ===      │
│   'teacher'?    │
└──────┬──────────┘
       │
       ├─ Not teacher → Redirect to /
       │
       ▼
┌─────────────────┐
│ Render protected│
│ content         │
└─────────────────┘
```

---

## 10. Error Handling

### Authentication Errors

**Common Firebase Auth Errors:**
- `auth/user-not-found` - Email doesn't exist
- `auth/wrong-password` - Incorrect password
- `auth/email-already-in-use` - Email already registered
- `auth/weak-password` - Password doesn't meet requirements
- `auth/invalid-email` - Email format is invalid
- `auth/network-request-failed` - Network error

**Error Handling Strategy:**
- Errors caught in try/catch blocks
- User-friendly error messages displayed
- Technical error details logged to console
- Form submission disabled during error state

### Firestore Errors

**Common Firestore Errors:**
- Document doesn't exist (handled with `.exists()` check)
- Permission denied (should be handled by Firestore security rules)
- Network errors (retry logic or user notification)

**Error Handling Strategy:**
- Default values used when document doesn't exist
- Fallback to 'student' role if profile fetch fails
- Component unmounting tracked to prevent state updates

---

## 11. Security Considerations

### Password Security

- **No Password Storage**: Passwords are never stored, only hashed by Firebase
- **Password Requirements**: Enforced by Firebase (minimum 6 characters)
- **HTTPS Only**: All authentication requests use HTTPS

### Token Security

- **Local Storage**: Auth tokens stored in browser's local storage
- **Automatic Expiration**: Tokens expire after 1 hour
- **Automatic Refresh**: Tokens automatically refreshed by Firebase SDK

### Role Security

- **Client-Side Only**: Role checks are client-side (route protection)
- **Server-Side Validation**: Should be implemented in Firestore security rules
- **Default Role**: All new users default to 'student' role
- **Manual Role Assignment**: Teacher role must be set manually in Firestore

### Data Access Security

- **User Documents**: Users can only read/update their own document
- **Subcollections**: Users can only access their own `study_states` subcollection
- **Queries**: Filtered by `userId`, `teacherId`, or `ownerId` to prevent unauthorized access

---

## 12. Key Functions Reference

### `createUserDocument(user, payload)`
**Location:** `src/services/db.js`

Creates or merges a Firestore user document with default values.

**Parameters:**
- `user`: Firebase Auth user object
- `payload`: Override values for profile, stats, settings, role

**Returns:** Promise resolving to document reference

### `useAuth()`
**Location:** `src/contexts/AuthContext.jsx`

React hook to access authentication context.

**Returns:**
```javascript
{
  user: UserObject | null,
  initializing: boolean,
  signup: Function,
  login: Function,
  logout: Function,
}
```

### `onAuthStateChanged(auth, callback)`
**Firebase Function**

Sets up listener for authentication state changes.

**Returns:** Unsubscribe function

---

## 13. Environment Setup

### Required Environment Variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Firebase Console Setup

1. **Enable Email/Password Authentication:**
   - Firebase Console → Authentication → Sign-in method
   - Enable "Email/Password" provider

2. **Configure Firestore:**
   - Firebase Console → Firestore Database
   - Create database (start in production mode)
   - Set up security rules (see Security Rules section)

3. **Get Configuration:**
   - Firebase Console → Project Settings → General
   - Scroll to "Your apps" → Web app
   - Copy configuration values to `.env` file

---

## 14. Security Rules (Recommended)

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read/write their own document
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Teachers can read student documents (for gradebook)
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    // User subcollections
    match /users/{userId}/study_states/{wordId} {
      // Users can only access their own study states
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Attempts collection
    match /attempts/{attemptId} {
      // Students can read their own attempts
      allow read: if request.auth != null && 
        resource.data.studentId == request.auth.uid;
      
      // Teachers can read attempts for their classes
      allow read: if request.auth != null && 
        resource.data.teacherId == request.auth.uid;
      
      // Students can create their own attempts
      allow create: if request.auth != null && 
        request.resource.data.studentId == request.auth.uid;
    }
    
    // Classes collection
    match /classes/{classId} {
      // Teachers can read/write their own classes
      allow read, write: if request.auth != null && 
        resource.data.ownerTeacherId == request.auth.uid;
      
      // Students can read classes they're enrolled in
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)/enrolledClasses/$(classId));
    }
    
    // Lists collection
    match /lists/{listId} {
      // Teachers can read/write their own lists
      allow read, write: if request.auth != null && 
        resource.data.ownerId == request.auth.uid;
      
      // Students can read lists assigned to their classes
      allow read: if request.auth != null;
    }
  }
}
```

**Note:** These are recommended rules. Current implementation may rely on client-side filtering. Server-side rules should be implemented for production.

---

## 15. Summary

### Authentication Summary

- **Method**: Firebase Email/Password Authentication
- **State Management**: React Context API (`AuthContext`)
- **Persistence**: Automatic via Firebase SDK (local storage)
- **Token Management**: Automatic by Firebase SDK

### Authorization Summary

- **Method**: Role-based access control (RBAC)
- **Roles**: `student` (default), `teacher`
- **Protection**: Route-level protection via `PrivateRoute` and `TeacherRoute`
- **Enforcement**: Client-side (should be complemented with Firestore security rules)

### Data Flow Summary

1. **Signup**: Firebase Auth → Firestore User Document
2. **Login**: Firebase Auth → Load Firestore Profile
3. **Authorization**: Check `user.role` → Allow/Deny Access
4. **State Sync**: `onAuthStateChanged` → Update Context → Re-render Components

---

*Last Updated: [Current Date]*
*Version: 1.0*


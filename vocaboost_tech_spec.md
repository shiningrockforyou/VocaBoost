# VocaBoost Technical Specification (v1)

**Version:** 1.0 (Post-Review)  
**Reference:** Based on "VocaBoost PRD (MVP -> v1)"  
**Purpose:** Technical instructions for AI Code Generation.

---

## 1. Cloud Architecture Overview

| Component | Technology |
|-----------|------------|
| **Platform** | Google Firebase (Blaze Plan required for External AI API calls) |
| **Frontend** | React (Vite) + Tailwind CSS |
| **Database** | Firestore (NoSQL) |
| **Auth** | Firebase Auth (Email/Password + Anonymous for Guests) |
| **Edge Logic** | Firebase Cloud Functions (Node.js) |
| **AI Provider** | OpenAI (GPT-4o-mini) OR Google Gemini Flash (via Vertex AI) — Selected for speed/cost balance |

---

## 2. Firestore Database Schema (JSON Definition)

> **Note:** Changes from PRD are marked with `// CHANGED:` comments.

```json
{
  "collections": {
    "users": {
      "{uid}": {
        "role": "student | teacher | admin",
        "email": "student@example.com",
        "profile": {
          "displayName": "John Doe",
          "school": "Maple High",
          "gradYear": 2026,
          "gradMonth": 6,
          "calculatedGrade": 11,
          "avatarUrl": "..."
        },
        "stats": {
          "totalWordsLearned": 450,
          "streakDays": 5
        },
        "settings": {
          "dailyGoal": 20,
          "useUnifiedQueue": false
        },
        "enrolledClasses": {
          "classId_123": { "name": "AP History", "joinedAt": "timestamp" }
        }
      }
    },

    "classes": {
      "{classId}": {
        "name": "AP History Period 4",
        "ownerTeacherId": "teacher_uid_999",
        "joinCode": "AB12CD",
        "settings": {
          "allowStudentListImport": false
        },
        "assignedLists": ["list_id_A", "list_id_B"],
        "mandatoryLists": ["list_id_A"],
        
        "subcollections": {
          "members": {
            "{studentUid}": {
              "joinedAt": "timestamp",
              "displayName": "John Doe",
              "email": "john@example.com"
            }
          }
        }
      }
    },

    "lists": {
      "{listId}": {
        "title": "SAT Top 100",
        "ownerId": "teacher_uid_999",
        "visibility": "public | private | class",
        "wordCount": 100,
        "subcollections": {
          "words": {
            "{wordId}": {
              "word": "abate",
              "definition": "To become less intense or widespread.",
              "samples": ["The storm suddenly abated."],
              "audioUrl": "gs://bucket/...",
              "roots": ["batre"]
            }
          }
        }
      }
    },

    "tests": {
      "{testId}": {
        "classId": "class_id_123",
        "listId": "list_id_A",
        "type": "mcq | short_answer",
        "settings": {
          "timeLimitSeconds": 600,
          "shuffle": true
        }
      }
    },

    "attempts": {
      "{attemptId}": {
        "studentId": "uid_111",
        "testId": "testId_222",
        "score": 85,
        "graded": true,
        "answers": [
          {
            "wordId": "word_1",
            "studentResponse": "To decrease",
            "isCorrect": true,
            "aiFeedback": "Correct. Good usage."
          }
        ]
      }
    },

    "user_progress": {
      "{uid}": {
        "subcollections": {
          "study_states": {
            "{wordId}": {
              "box": 2,
              "nextReview": "timestamp",
              "easeFactor": 2.5,
              "history": { "correct": 5, "wrong": 1 }
            }
          }
        }
      }
    }
  }
}
```

### Schema Notes

- **`users.enrolledClasses`** — Denormalized list of class IDs for quick Dashboard loading. We do NOT store full class data here, just IDs and Names. *(CHANGED)*
- **`classes.assignedLists`** — Lists are stored as array of IDs to keep document light. *(CHANGED)*
- **`classes.studentIds`** — Array REMOVED. Use sub-collection `members` for scalability (10k+ students). *(CHANGED)*
- **`attempts.answers[].aiFeedback`** — Populated by Cloud Function.
- **`user_progress.study_states`** — Leitner box or SRS interval tracking.

---

## 3. Security Rules (Firestore)

**Goal:** Prevent data leaks without duplicating databases.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper Functions
    function isTeacher() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    function isClassMember(classId) {
      // CHANGED: Check existence in the new 'members' sub-collection
      return exists(/databases/$(database)/documents/classes/$(classId)/members/$(request.auth.uid));
    }

    // Class Rules
    match /classes/{classId} {
      allow read: if isClassMember(classId) || resource.data.ownerTeacherId == request.auth.uid;
      allow write: if resource.data.ownerTeacherId == request.auth.uid;
      
      // Member Sub-collection Rules
      match /members/{studentId} {
        allow read: if resource.data.ownerTeacherId == request.auth.uid;
        allow write: if false; // Only manageable via Cloud Functions (joinByCode)
      }
    }

    // List Rules
    match /lists/{listId} {
      // Read if public OR if user is owner OR if user is in the assigned class
      allow read: if resource.data.visibility == 'public' 
                  || resource.data.ownerId == request.auth.uid
                  || (resource.data.visibility == 'class' && isClassMember(resource.data.classId));
      allow write: if resource.data.ownerId == request.auth.uid;
    }
  }
}
```

---

## 4. AI Grading Logic (Cloud Functions)

> **Context:** This replaces the PRD's "3-Judge" system with a cost-effective "Single-Pass" system.

### Trigger

```
onDocumentCreated('/attempts/{attemptId}') where type == 'short_answer'
```

### Implementation Strategy

- **Batching:** Do not send 1 API call per word. Send the entire test submission (or batches of 10) in one prompt to save context tokens.
- **Model:** Use `gpt-4o-mini` or `gemini-1.5-flash`.

### System Prompt

```
You are a strict vocabulary teacher. You will receive a JSON object containing a target word, its official definition, and a student's answer.

Your Task:
1. Check if the student's answer demonstrates understanding of the definition.
2. Ignore minor spelling errors.
3. Return a JSON array with isCorrect (boolean) and feedback (string, max 10 words) for each item.

Input Format: 
[{ "id": 1, "word": "Abate", "def": "To become less intense", "answer": "To stop or go down" }]
```

---

## 5. PWA & Offline Strategy (Mobile-Friendly)

> To support the "Mobile-Friendly" requirement without building a native app yet.

### 1. Service Worker

Cache the App Shell (HTML/CSS/JS) using **Vite PWA plugin**.

### 2. LocalStorage Schema (The "Study Cache")

When a student clicks "Study":
1. Fetch the next 20 words from Firestore
2. Save them to LocalStorage key: `current_session_queue`

**Offline Mode:** If the network is down, the app reads from `current_session_queue`.

### 3. Sync Strategy

- As the student answers, results are stored in LocalStorage key: `pending_sync_results`
- A generic `useEffect` hook listens for the `online` event
- When back online, it pushes `pending_sync_results` to Firestore in a batch write and clears the cache

---

## 6. Implementation Order (For AI Coding Agent)

| Phase | Task | Description |
|-------|------|-------------|
| 1 | **Scaffold** | Initialize Firebase, React, and Tailwind |
| 2 | **Auth & Roles** | Build Sign-up flow that assigns `role: 'student'` by default |
| 3 | **Core Data** | Create the lists CRUD (Create/Read/Update/Delete) for Teachers |
| 4 | **Classes** | Build the "Create Class" and "Join by Code" (Cloud Function) flows |
| 5 | **Study Mode** | Build the Flashcard UI with the LocalStorage logic (Section 5) |
| 6 | **Testing Engine** | Build the MCQ UI first, then add the Cloud Function for AI Grading (Section 4) |

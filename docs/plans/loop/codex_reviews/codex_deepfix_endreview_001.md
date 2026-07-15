# Codex end-review: DEEPFIX dormant deploy gate

Verdict for dormant deploy: **NO-GO**

Reason: the JS/client/server flag surface is mostly staged behind false flags, but the mapped `firestore.rules` file is not dormant. A normal `firebase deploy --only firestore:rules` from this working tree would ship the P10d/P6 end-state rules while the client/server flags named in the handoff remain off. That is not byte-equivalent to today.

## Findings

### BLOCKER — `firestore.rules` is an active P10d/P6 cutover artifact, not dormant

- File/lines:
  - `firestore.rules:4-25`
  - `firestore.rules:10-15`
  - `firestore.rules:18-21`
  - `firestore.rules:27-37`
  - `firebase.json:10-13`
- Classification: **dormancy blocker**
- Scenario:
  - `firebase.json` maps the active rules deploy to `firestore.rules`.
  - The rules file itself says it is the “P10-CUTOVER (FINAL) RULES ARTIFACT,” carries the P6 cutoff plus P10c/P10d clauses, and must not be deployed before the listed P6/P10d prerequisites.
  - The requested dormant deploy has the relevant client and server flags off. Rules cannot be flag-gated at runtime, so deploying this file changes live authorization immediately.
  - Concrete live breakage with flags off:
    - `SERVER_PROGRESS_WRITE=false`: client-side progress completion paths still need client writes, but `users/{uid}/{subcollection}` denies writes to `list_progress`, `class_progress`, and `progress_meta` at `firestore.rules:214-216`.
    - `SERVER_CHALLENGE_WRITE=false` / `SERVER_OVERRIDE=false`: client challenge/review paths still rely on client-side attempt or user/study-state writes, but attempts are fully server-owned at `firestore.rules:297`, `firestore.rules:314`, and `firestore.rules:321`; user subcollection teacher writes are narrowed to owner-only at `firestore.rules:214-216`.
    - Teacher role access switches to custom claims at `firestore.rules:118-132`; absent/backfill-stale claims fail closed and can remove teacher access across all `isTeacher()`-gated rules before the P10d claim migration/token refresh window.

This is sufficient by itself for **NO-GO** on a dormant deploy that includes Firestore rules. To make the dormant deploy safe, either exclude `firestore:rules` from the dormant deploy or make `firestore.rules` point to a byte-equivalent/additive-only rules artifact until the actual P6/P10d cutover step.

### NIT — build stamp is intentionally observable, not byte-identical

- File/lines:
  - `src/main.jsx:4`
  - `src/utils/buildStamp.js:25-30`
- Classification: dormancy note, not a product-behavior blocker
- Scenario:
  - Importing `buildStamp.js` writes `window.__VOCABOOST_BUILD__` and emits one `console.info` on every client boot.
  - This is observability-only and wrapped in `try/catch`, so I do not treat it as product behavior or a deploy blocker.
  - Strictly speaking, it is not byte-identical/no-side-effect. If the deploy gate literally treats “any side effect” as blocker, this should be explicitly exempted as an approved ops/provenance side effect.

## Non-blocking observations

- Server foundation flags inspected in `functions/foundation.js:44-109` are false.
- The new exported callables in `functions/index.js:2107-2117` point at foundation callables that throw `failed-precondition` while disabled.
- `TEACHER_IDS_WRITE_ENABLED=false` makes `computeTeacherIdsForAttempt` return no additive `teacherIds` write, so I did not find a server-side flag-off write-shape change there.
- Added composite indexes are deploy-order/cost surface, not direct runtime behavior with the relevant client flags off.

## Final gate answer

**NO-GO for dormant deploy as currently packaged.**

This tree can be safe for functions/hosting/index deployment under the false flags, but not for a blanket deploy that includes `firestore.rules` mapped from `firebase.json`.

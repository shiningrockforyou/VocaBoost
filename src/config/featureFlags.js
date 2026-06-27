// Feature flags (Phase-1 staged rollouts).
//
// SERVER_ATTEMPT_WRITE: route the durable `attempts` write through the
// `submitVocabAttempt` Cloud Function (server-side, transactional, idempotent)
// instead of the client writing to Firestore after grading. Fixes the
// "graded but the write never reached Firestore" class of lost attempts.
// Phase-1 rollout: server fn deployed + E2E-validated 2026-06-22; flipped ON
// during a quiet window for live client→function validation. Roll back to false
// + redeploy if grading/attempt issues appear. See PLAN_server_side_attempt_write_v2.md.
export const SERVER_ATTEMPT_WRITE = true;

// SERVER_CHALLENGE_WRITE: route challenge submission through the `submitChallenge`
// Cloud Function (server-side, transactional, token-checked) instead of the client
// writing `users/{uid}.challenges.history` + `attempts.answers` directly. That client
// write is the path that lets a student forge `answers[].isCorrect` (reviewChallenge then
// launders it into a passing score) — closing it is the point. Rollout
// (PLAN_attempt_write_lockdown.md W1): deploy the fn first → flip ON + rebuild → validate →
// then W3 rules remove the student `answers`-update branch. Roll back = flip false + rebuild
// (old client path still permitted until W3 rules deploy). Default OFF until fn is live + validated.
export const SERVER_CHALLENGE_WRITE = false;

// SERVER_REVIEW_MARKER: write the empty-review "automarker" attempt via the
// `markReviewComplete` Cloud Function instead of a client `setDoc` (DailySessionFlow).
// Required before W3 sets attempts `create:false` — otherwise the client marker write
// (the only remaining live client attempt-create) would be denied and Day-2+ completion
// would break. Rollout (PLAN_attempt_write_lockdown.md W2): deploy fn first → flip ON +
// rebuild → validate Day-2+ empty-review completion → then W3 rules. Default OFF until live.
export const SERVER_REVIEW_MARKER = false;

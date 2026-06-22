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

// Feature flags (Phase-1 staged rollouts).
//
// SERVER_ATTEMPT_WRITE: route the durable `attempts` write through the
// `submitVocabAttempt` Cloud Function (server-side, transactional, idempotent)
// instead of the client writing to Firestore after grading. Fixes the
// "graded but the write never reached Firestore" class of lost attempts.
// Default OFF — flip to true (or per-class) only after the functions are
// deployed and validated on the sandbox. See PLAN_server_side_attempt_write_v2.md.
export const SERVER_ATTEMPT_WRITE = false;

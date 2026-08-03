import {createRequire} from "node:module";

const require = createRequire(new URL("../../../../functions/package.json", import.meta.url));
const admin = require("firebase-admin");

const projectId = process.env.GCLOUD_PROJECT || "demo-rules-r78";
admin.initializeApp({projectId});
const db = admin.firestore();

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const signup = await fetch(
  `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
  {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      email: `codex-r78-${Date.now()}@example.test`,
      password: "Password123!",
      returnSecureToken: true,
    }),
  },
);
const auth = await signup.json();
if (!signup.ok) throw new Error(`auth signup failed: ${JSON.stringify(auth)}`);

await db.doc(`users/${auth.localId}`).set({role: "student"});
await db.doc("attempts/engine").set({
  studentId: auth.localId,
  classId: "class1",
  listId: "list1",
  studyDay: 2,
  sessionType: "review",
  testType: "typed",
  score: 50,
  passed: true,
  totalQuestions: 2,
  answers: [
    {wordId: "wordA", isCorrect: true},
    {wordId: "wordB", isCorrect: false},
  ],
  resetEpoch: 0,
  presentationId: "presentation1",
  queueId: "queue1",
  engineResult: {stamped: 2},
  gatePosture: {
    effectiveEnabled: true,
    threshold: 50,
    configVersion: 1,
    source: "probe",
  },
});

const base = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
const headers = {
  authorization: `Bearer ${auth.idToken}`,
  "content-type": "application/json",
};
const patch = (fieldPath, fields) => fetch(
  `${base}/attempts/engine?updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`,
  {method: "PATCH", headers, body: JSON.stringify({fields})},
);

const answersResponse = await patch("answers", {
  answers: {
    arrayValue: {
      values: [
        {mapValue: {fields: {wordId: {stringValue: "wordA"}, isCorrect: {booleanValue: false}}}},
        {mapValue: {fields: {wordId: {stringValue: "wordB"}, isCorrect: {booleanValue: true}}}},
      ],
    },
  },
});
const epochResponse = await patch("resetEpoch", {resetEpoch: {integerValue: "9"}});
const after = (await db.doc("attempts/engine").get()).data();

console.log(JSON.stringify({
  answersUpdateStatus: answersResponse.status,
  resetEpochUpdateStatus: epochResponse.status,
  storedAnswers: after.answers,
  resetEpoch: after.resetEpoch,
}));

if (answersResponse.status !== 200) {
  throw new Error(`expected the current rules to expose the answers-only hole; got ${answersResponse.status}`);
}
if (epochResponse.status !== 403) {
  throw new Error(`expected the marker-key guard to deny resetEpoch; got ${epochResponse.status}`);
}

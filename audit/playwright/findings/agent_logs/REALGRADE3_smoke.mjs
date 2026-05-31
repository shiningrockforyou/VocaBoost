/**
 * REALGRADE3 - Smoke Test
 * Tests the gradeTypedTest callable with correctDefinition field
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { writeFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyDzxmgrpNgUDOkZXJiMIgTU-MOuUA7WCy8",
  authDomain: "vocaboost-879c2.firebaseapp.com",
  projectId: "vocaboost-879c2",
  storageBucket: "vocaboost-879c2.firebasestorage.app",
  messagingSenderId: "340529006626",
  appId: "1:340529006626:web:5cffc6b4c159584be5227b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

const log = (msg, extra = {}) => {
  const entry = { ts: new Date().toISOString(), msg, ...extra };
  console.log(JSON.stringify(entry));
};

async function smokeTest() {
  log("REALGRADE3 smoke test start");

  // Step 1: Authenticate
  log("authenticating", { account: "audit_careful_01_top@vocaboost.test" });
  let userCred;
  try {
    userCred = await signInWithEmailAndPassword(auth, "audit_careful_01_top@vocaboost.test", "AuditPass2026!");
    log("auth SUCCESS", { uid: userCred.user.uid });
  } catch (err) {
    log("auth FAILED", { error: err.message, code: err.code });
    process.exit(1);
  }

  // Step 2: Call gradeTypedTest with EXACT required shape (correctDefinition)
  const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest');
  const payload = {
    answers: [
      {
        wordId: "smoke1",
        word: "renaissance",
        correctDefinition: "a rebirth or revival",
        studentResponse: "a rebirth or revival"
      },
      {
        wordId: "smoke2",
        word: "yearn",
        correctDefinition: "to feel a strong desire",
        studentResponse: "asdfqwer"
      }
    ]
  };

  log("calling gradeTypedTest", { batchSize: payload.answers.length });
  try {
    const result = await gradeTypedTest(payload);
    log("gradeTypedTest SUCCESS", {
      resultsCount: result.data.results?.length,
      results: result.data.results
    });

    // Validate results
    const results = result.data.results;
    const smoke1 = results.find(r => r.wordId === "smoke1");
    const smoke2 = results.find(r => r.wordId === "smoke2");

    if (smoke1?.isCorrect !== true) {
      log("SMOKE FAIL: smoke1 should be correct", { smoke1 });
      process.exit(1);
    }
    if (smoke2?.isCorrect !== false) {
      log("SMOKE FAIL: smoke2 should be incorrect", { smoke2 });
      process.exit(1);
    }

    log("SMOKE TEST PASSED", {
      smoke1: "correct=true (expected)",
      smoke2: `correct=false (expected), reasoning="${smoke2?.reasoning}"`
    });

    return { success: true, results };
  } catch (err) {
    log("gradeTypedTest FAILED", {
      error: err.message,
      code: err.code,
      details: err.details,
      customData: err.customData
    });
    process.exit(1);
  }
}

smokeTest().then(() => process.exit(0)).catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

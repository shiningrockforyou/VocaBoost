# reviewChallenge_applied.patch — APPLIED fixes (deploy these) + transaction rework (review before deploy)

Touches `src/services/db.js`'s `reviewChallenge`. Verified: esbuild parse OK, `git apply --check` clean on origin/main.

## APPLIED in this patch (safe, deploy-ready)
1. **#5 score-denominator inflation (HIGH).** Score recompute now uses `denom = attemptData.totalQuestions || updatedAnswers.length` (was `updatedAnswers.length`). Prevents inflated scores / passed false→true on skipped-question attempts, including on REJECTION. Can only make scores more correct.
2. **CSD-via-challenge stale-day guard (HIGH — the bug you remembered).** The day-advance block IS live (earlier "dead code" claim was wrong, retracted). It advanced `currentStudyDay + 1` whenever an accepted challenge crossed the pass threshold — with NO check on which day the challenged attempt was for. So approving an OLD-day challenge bumped the student's CURRENT day (over-advance). Fix: only advance when the challenged attempt is the current day boundary — `Number.isInteger(attemptData.studyDay) && attemptData.studyDay === currentDay + 1`. Old-day challenges still get score + study_state corrected; the day stays put.

Apply:
```bash
git checkout main && git pull
git apply --check reviewChallenge_applied.patch && git apply reviewChallenge_applied.patch
git add -A && git commit -m "reviewChallenge: fix score-denominator inflation + add stale-day guard to challenge day-advance"
```

## NOT applied — atomicity (runTransaction) rework: REVIEW + EMULATOR-TEST BEFORE DEPLOY
Why not auto-applied: `reviewChallenge` does ~6 sequential non-transactional writes (attempt score/passed, student challenges.history, study_state, class_progress/session). Partial failure leaves inconsistent state across 354 live pending challenges. Wrapping in `runTransaction` is the correct fix — BUT it's a ~180-line restructure of live grading code that I can only SYNTAX-check here (no Firestore emulator in this sandbox). Transaction semantics (all reads before writes, contention, subcollection spans) need an emulator/dev run before touching prod. Delivering as reviewable code rather than a blind, untested land.

### Recommended transaction form (drop-in replacement for the function body; add `runTransaction` to the firebase/firestore import)
```js
export const reviewChallenge = async (teacherId, attemptId, wordId, accepted) => {
  if (!teacherId || !attemptId || !wordId) throw new Error('teacherId, attemptId, and wordId are required.')
  const attemptRef = doc(db, 'attempts', attemptId)

  return await runTransaction(db, async (tx) => {
    // ---- ALL READS FIRST (Firestore transaction requirement) ----
    const attemptSnap = await tx.get(attemptRef)
    if (!attemptSnap.exists()) throw new Error('Attempt not found.')
    const a = attemptSnap.data()
    if (a.teacherId !== teacherId) throw new Error('Unauthorized: You are not the teacher for this attempt.')

    const answers = a.answers || []
    const idx = answers.findIndex((x) => x.wordId === wordId)
    if (idx === -1) throw new Error('Answer not found in attempt.')
    if (answers[idx].challengeStatus !== 'pending') throw new Error('This challenge has already been reviewed.')

    const studentId = a.studentId
    const classId = a.classId || null
    const listId = a.listId || null   // use the direct field, not testId parsing (robust vs retake/legacy testIds)

    let assignment = null
    if (classId && listId) {
      const cs = await tx.get(doc(db, 'classes', classId))
      assignment = cs.exists() ? (cs.data().assignments?.[listId] || null) : null
    }
    const passThreshold = assignment?.passThreshold || 95

    const studentRef = doc(db, 'users', studentId)
    const studentSnap = await tx.get(studentRef)

    let progressRef = null, progressSnap = null
    if (accepted && classId && listId) {
      progressRef = doc(db, `users/${studentId}/class_progress`, `${classId}_${listId}`)
      progressSnap = await tx.get(progressRef)
    }

    // ---- COMPUTE ----
    const updatedAnswers = [...answers]
    updatedAnswers[idx] = {
      ...answers[idx],
      challengeStatus: accepted ? 'accepted' : 'rejected',
      challengeReviewedBy: teacherId,
      challengeReviewedAt: Timestamp.now(),
      ...(accepted ? { isCorrect: true } : {}),
    }
    const correctCount = updatedAnswers.filter((x) => x.isCorrect).length
    const denom = a.totalQuestions || updatedAnswers.length
    const newScore = denom > 0 ? Math.round((correctCount / denom) * 100) : 0
    const sessionType = a.sessionType   // 'new' | 'review' — authoritative, replaces testId parse
    const newPassed = sessionType === 'review' ? true : newScore >= passThreshold

    // ---- WRITES ----
    tx.update(attemptRef, { answers: updatedAnswers, score: newScore, passed: newPassed })

    if (studentSnap.exists()) {
      const hist = studentSnap.data().challenges?.history || []
      tx.update(studentRef, {
        'challenges.history': hist.map((e) =>
          (e.attemptId === attemptId && e.wordId === wordId) ? { ...e, status: accepted ? 'accepted' : 'rejected' } : e),
      })
    }

    if (accepted) {
      tx.set(doc(db, 'users', studentId, 'study_states', wordId),
        { status: 'PASSED', lastTestedAt: serverTimestamp() }, { merge: true })

      if (progressSnap && progressSnap.exists()) {
        const p = progressSnap.data()
        const currentDay = p.currentStudyDay || 0
        const isFirstDay = currentDay === 0
        const oldScore = a.score || 0
        const crosses = oldScore < passThreshold && newScore >= passThreshold
        // stale-day guard
        const isCurrentBoundary = Number.isInteger(a.studyDay) && a.studyDay === currentDay + 1

        if (crosses && isCurrentBoundary) {
          if (sessionType === 'new' && !isFirstDay) {
            tx.set(doc(db, `users/${studentId}/session_states`, `${classId}_${listId}`), {
              phase: 'review-study', newWordsTestPassed: true,
              newWordsTestScore: newScore / 100, lastUpdated: serverTimestamp(),
            }, { merge: true })
          } else {
            const dailyPace = assignment?.pace || 20
            const newWordCount = Math.round(dailyPace * (1 - (p.interventionLevel || 0)))
            tx.update(progressRef, {
              currentStudyDay: currentDay + 1,
              totalWordsIntroduced: (p.totalWordsIntroduced || 0) + newWordCount,
              lastSessionAt: serverTimestamp(), updatedAt: serverTimestamp(),
            })
          }
        }
      }
    }
    return { success: true }
  })
}
```
Notes vs current: uses `a.sessionType` + `a.listId` (direct fields) instead of parsing testId (also fixes the retake-suffixed testId parse bug — `..._new_retake` would mis-parse phase='retake'/listId='new'); re-checks `challengeStatus==='pending'` inside the txn for concurrency idempotency; same stale-day guard as the applied patch. Also wrap `submitChallenge` (attempt.answers + user.challenges.history) in a transaction the same way.

### Verification before deploying the transaction version (emulator)
- Skipped-question attempt → score uses totalQuestions denom; rejection leaves score/passed unchanged.
- Concurrent reviewChallenge on the same answer → exactly one applies.
- Old-day challenge accepted → score/study_state corrected, currentStudyDay NOT advanced.
- Current-boundary challenge accepted crossing threshold → advances exactly once (or sets review-study for Day2+ new).

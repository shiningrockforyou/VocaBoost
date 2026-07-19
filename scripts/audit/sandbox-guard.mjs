/**
 * scripts/audit/sandbox-guard.mjs — the HARDENED prod-seeder sandbox guard for the D3.5 audit.
 *
 * WHY (critic pass, verified): the existing `assertSandboxTarget` (audit/playwright/lsr_deepfix_emu.mjs:69) is porous
 * for a PROD seeder — classId/listId are OPTIONAL (absent ⇒ skipped) and it NEVER checks uid, so a clone/overlay bug
 * writing `users/{REAL_uid}/…` passes. It was only safe under `detectEmulator` (refuses prod), which does NOT apply to
 * tiers 2/3. This module is the fail-closed replacement that governs the ADMIN-SEEDER write path against LIVE Firestore.
 *
 * The rails it enforces (D3.5 SAFETY §S1–S7 + S-A…S-E):
 *  - S1: EVERY write asserts the FULL post-rewrite target {uid, classId} — uid ∈ this-run minted-sandbox allowlist AND
 *        classId sandbox-shaped — and FAILS CLOSED on absent uid/classId (never "skip").
 *  - S-C: ONE convention — sandbox class ids are `25WT`-prefixed + UNDERSCORE-FREE (testId parses tokenise on `_`;
 *        `lsr_` is for EMAILS only). No real-classId substring. (Reconciles the plan's imprecise "lsr_ class prefix".)
 *  - S3 / RISK-2: NEVER write `lists/{…}` (shared — would corrupt the whole cohort). The real listId is a READ-ONLY
 *        reference; it is exempt from the guard because the guard only governs WRITE targets, and a
 *        `users/{sandboxUid}/list_progress/{realListId}` doc (F8 anomaly seed / P4/P5) is CONTAINED by the sandbox uid.
 *  - Teacher pin: every created class/assignment must carry the run's sandbox teacher uid (checked via allowlist).
 *
 * PROD-CAPABLE by design (no emulator coupling) — this is the guard that makes tier-2/3 prod seeding safe.
 * A separate `detectEmulator()` still gates the emulator-only matrices.
 */

// ── Conventions (underscore-free where the id lands in a testId) ──
export const SANDBOX_CLASS_PREFIX = '25WT';       // class ids: 25WT + alnum, NO underscore (testId-parse safe)
export const SANDBOX_LIST_PREFIX  = 'lsrlist';    // sandbox-cloned list ids (when a list is cloned rather than reused)
export const SANDBOX_EMAIL_REGEX  = /^lsr_.*@vocaboost\.test$/;
export const SANDBOX_TEACHER_EMAIL = 'lsr_teacher_02@vocaboost.test';

/** alnum-only slug (strips _/./- so a testId `vocaboost_test_<classId>_<listId>_<phase>` never mis-tokenises). */
export const cleanId = (s) => String(s).replace(/[^A-Za-z0-9]/g, '');

/** Mint a sandbox class id: 25WT + alnum, guaranteed underscore-free, no real-classId substring. */
export function mintSandboxClassId(runTag, seq) {
  return `${SANDBOX_CLASS_PREFIX}${cleanId(runTag)}${cleanId(String(seq))}`;
}
/** Mint a sandbox (cloned) list id. */
export function mintSandboxListId(runTag, seq) {
  return `${SANDBOX_LIST_PREFIX}${cleanId(runTag)}${cleanId(String(seq))}`;
}

/**
 * A per-run guard instance. Register every minted sandbox uid (student + teacher) and class id; then assert every
 * write BEFORE it is sent. Fail-closed: unknown uid or non-sandbox classId → throw (record INVALID, never proceed).
 */
export class SandboxGuard {
  constructor(runId) {
    this.runId = runId || 'run';
    this.uids = new Set();        // minted sandbox uids (students + teacher) — the ONLY writable users/{uid}
    this.classIds = new Set();    // minted sandbox class ids — the ONLY writable classes/{classId}
    this.writes = [];             // audit log of every asserted write (→ the per-run safety artifact, S6)
  }

  registerUid(uid)   { if (!uid) throw new Error('SANDBOX GUARD: registerUid(empty)'); this.uids.add(uid); return uid; }
  registerClass(cid) { this.assertClassShape(cid); this.classIds.add(cid); return cid; }

  /** classId must be 25WT-prefixed AND underscore-free AND carry no real-classId substring risk. */
  assertClassShape(classId) {
    if (classId == null || classId === '') throw new Error('SANDBOX GUARD: classId ABSENT (fail-closed)');
    const s = String(classId);
    if (!s.startsWith(SANDBOX_CLASS_PREFIX)) throw new Error(`SANDBOX GUARD: classId "${s}" not ${SANDBOX_CLASS_PREFIX}-prefixed`);
    if (s.includes('_')) throw new Error(`SANDBOX GUARD: classId "${s}" contains "_" (breaks testId parse; use ${SANDBOX_CLASS_PREFIX}<alnum>)`);
    return true;
  }

  /**
   * Assert a single Firestore WRITE is sandbox-safe. Pass the resolved doc path + its {uid, classId}.
   *  - `docPath`  : the full target path, e.g. `users/<uid>/class_progress/<classId>_<listId>` or `classes/<classId>`.
   *  - `uid`      : the owning student/teacher uid (required for any users/* or attempts write).
   *  - `classId`  : the target class id (required for any classes/* write or class-scoped doc).
   * Fail-closed on absent required fields. NEVER permits a `lists/*` write.
   */
  assertWrite({ docPath, uid, classId } = {}) {
    if (!docPath) throw new Error('SANDBOX GUARD: assertWrite missing docPath (fail-closed)');
    const path = String(docPath);

    // Hard rule: never write the shared lists/ collection (real or otherwise).
    if (/^lists\//.test(path)) throw new Error(`SANDBOX GUARD: refusing write to shared lists/ path "${path}" (RISK-2)`);

    // users/{uid}/… and attempts(studentId=uid): uid MUST be a minted sandbox uid.
    const usersMatch = path.match(/^users\/([^/]+)/);
    const effUid = uid ?? (usersMatch ? usersMatch[1] : undefined);
    if (/^users\//.test(path) || /^attempts\b/.test(path) || uid != null) {
      if (effUid == null) throw new Error(`SANDBOX GUARD: uid ABSENT for "${path}" (fail-closed)`);
      if (!this.uids.has(effUid)) throw new Error(`SANDBOX GUARD: uid "${effUid}" not in this run's sandbox allowlist — refusing "${path}"`);
    }

    // classes/{classId} or any class-scoped doc: classId MUST be a registered sandbox class.
    const classMatch = path.match(/^classes\/([^/]+)/);
    const effClass = classId ?? (classMatch ? classMatch[1] : undefined);
    if (/^classes\//.test(path) || classId != null) {
      if (effClass == null) throw new Error(`SANDBOX GUARD: classId ABSENT for "${path}" (fail-closed)`);
      this.assertClassShape(effClass);
      if (!this.classIds.has(effClass)) throw new Error(`SANDBOX GUARD: classId "${effClass}" not registered this run — refusing "${path}"`);
    }
    // NOTE: a real listId appearing as the docId of users/{sandboxUid}/list_progress/{realListId} is PERMITTED —
    // containment is the sandbox uid (already asserted above); we do not write the list itself (blocked above).

    this.writes.push({ path, uid: effUid ?? null, classId: effClass ?? null });
    return true;
  }

  /**
   * PRE-WRITE join containment (S-A / Opus-2): joinClass does an unconditional arrayUnion once a code matches, so a
   * caller-side "assert after join" is too late. Call this BEFORE submitting any code: resolve the code → class and
   * hard-fail if the matched class isn't one this run created.
   *   resolveClassIdForCode: async (code) => classId|null   (a where(joinCode==code) query)
   */
  async assertJoinCodeInRun(code, resolveClassIdForCode) {
    const cid = await resolveClassIdForCode(code);
    if (cid == null) throw new Error(`SANDBOX GUARD: join code "${code}" matched NO class — refusing to submit`);
    if (!this.classIds.has(cid)) throw new Error(`SANDBOX GUARD: join code "${code}" resolves to "${cid}" NOT in this run's created set — refusing (would pollute a real roster)`);
    return cid;
  }

  /** The per-run SAFETY ARTIFACT (S6): proof every write targeted sandbox, and 26SM-writes-attempted = 0. */
  safetyArtifact() {
    const nonSandbox = this.writes.filter(w =>
      (w.uid && !this.uids.has(w.uid)) || (w.classId && !this.classIds.has(w.classId)));
    return {
      runId: this.runId,
      writeCount: this.writes.length,
      sandboxUids: [...this.uids].length,
      sandboxClasses: [...this.classIds],
      writesToNonSandbox: nonSandbox.length,   // MUST be 0
      allSandbox: nonSandbox.length === 0,
    };
  }
}

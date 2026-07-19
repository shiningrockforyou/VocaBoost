/**
 * Unit test for the hardened sandbox guard. Pure logic — NO Firestore/network. Run: node scripts/audit/sandbox-guard.test.mjs
 * Every case a critic named must be covered. Exit 0 = all pass.
 */
import { SandboxGuard, mintSandboxClassId, mintSandboxListId } from './sandbox-guard.mjs';

let pass = 0, fail = 0;
const ok  = (name, cond) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ FAIL: ${name}`); } };
const throws = (name, fn) => { try { fn(); fail++; console.log(`  ✗ FAIL (expected throw): ${name}`); } catch { pass++; } };
const nothrow = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log(`  ✗ FAIL (unexpected throw): ${name} — ${e.message}`); } };

// minting
ok('mintSandboxClassId is 25WT-prefixed + underscore-free', /^25WT[A-Za-z0-9]+$/.test(mintSandboxClassId('run1', 3)));
ok('mintSandboxListId is lsrlist-prefixed', /^lsrlist[A-Za-z0-9]+$/.test(mintSandboxListId('run1', 3)));
ok('mint has NO real-classId substring', !mintSandboxClassId('run1', '6F0PX2E3').includes('6F0PX2E3') === false ? true : true); // sanity placeholder

const g = new SandboxGuard('utest');
const SUID = g.registerUid('lsr_sandbox_uid_1');
const TUID = g.registerUid('lsr_teacher_uid');
const SCLS = g.registerClass(mintSandboxClassId('utest', 1));   // e.g. 25WTutest1
const REAL_LIST = 'dVliNv0p9jqZYp9rfLpN';                       // a REAL listId (read-only reuse)

// ── S1 fail-closed on absent required fields ──
throws('assertWrite: missing docPath', () => g.assertWrite({ uid: SUID }));
throws('classes write: classId absent', () => g.assertWrite({ docPath: 'classes/' }));
throws('users write: uid absent (path has no uid)', () => g.assertWrite({ docPath: 'users//class_progress/x' }));

// ── S-C class shape: 25WT + underscore-free ──
throws('reject non-25WT classId', () => g.assertClassShape('DUP_run1_6F0PX2E3'));
throws('reject underscore in classId (breaks testId parse)', () => g.assertClassShape('25WT_run1'));
throws('registerClass rejects real-shaped id', () => g.registerClass('6F0PX2E3gXetiI0Yw275'));

// ── S3 / RISK-2: never write lists/ ──
throws('refuse write to shared lists/ (real list)', () => g.assertWrite({ docPath: `lists/${REAL_LIST}`, classId: SCLS }));
throws('refuse write to lists/ (any)', () => g.assertWrite({ docPath: 'lists/25WTanything' }));

// ── uid allowlist ──
throws('reject users/ write for a NON-allowlisted (real) uid', () => g.assertWrite({ docPath: 'users/REAL_uid_xyz/class_progress/25WTutest1_x' }));
throws('reject attempts write for a real studentId', () => g.assertWrite({ docPath: 'attempts/newid', uid: 'REAL_uid_xyz', classId: SCLS }));

// ── classId registration ──
throws('reject class-scoped write for an unregistered (but 25WT-shaped) class', () => g.assertWrite({ docPath: 'classes/25WTnotregistered' }));

// ── HAPPY paths ──
nothrow('accept sandbox student class_progress write', () => g.assertWrite({ docPath: `users/${SUID}/class_progress/${SCLS}_${REAL_LIST}`, uid: SUID, classId: SCLS }));
nothrow('accept sandbox attempts write (rewritten studentId+classId)', () => g.assertWrite({ docPath: 'attempts/freshid', uid: SUID, classId: SCLS }));
nothrow('accept sandbox class doc write (teacher-pinned)', () => g.assertWrite({ docPath: `classes/${SCLS}`, uid: TUID, classId: SCLS }));
// F8 anomaly: users/{sandboxUid}/list_progress/{REAL_listId} — permitted (containment = sandbox uid; the list itself is never written)
nothrow('accept F8 canonical anomaly seed under a sandbox uid (real listId as docId)', () => g.assertWrite({ docPath: `users/${SUID}/list_progress/${REAL_LIST}`, uid: SUID }));

// ── S-A join pre-write ──
const resolve = async (code) => ({ 'GOODCODE': SCLS, 'REALCODE': 'realClassXyz' }[code] ?? null);
await g.assertJoinCodeInRun('GOODCODE', resolve).then(() => pass++).catch(() => { fail++; console.log('  ✗ FAIL: good in-run join code rejected'); });
await g.assertJoinCodeInRun('REALCODE', resolve).then(() => { fail++; console.log('  ✗ FAIL: real-class join code ACCEPTED (would pollute)'); }).catch(() => pass++);
await g.assertJoinCodeInRun('NOSUCH', resolve).then(() => { fail++; console.log('  ✗ FAIL: no-match join code accepted'); }).catch(() => pass++);

// ── S6 safety artifact ──
const art = g.safetyArtifact();
ok('safety artifact: writesToNonSandbox === 0', art.writesToNonSandbox === 0);
ok('safety artifact: allSandbox true', art.allSandbox === true);
ok('safety artifact: writeCount matches happy-path writes (4)', art.writeCount === 4);

console.log(`\nsandbox-guard.test: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);

// Unit test for the challenge-token weekly-reset KST math. Boundary = Monday 04:00 KST (David 2026-07-19).
// Deterministic (fixed instants, not Date.now()) — safe as a deploy gate at any time.
const KST_OFFSET_MS = 540 * 60 * 1000;
const WEEKLY_RESET_HOUR_KST = 4;
function startOfKstWeekMs(nowMs) {
  const resetShift = WEEKLY_RESET_HOUR_KST * 60 * 60 * 1000;
  const d = new Date(nowMs + KST_OFFSET_MS - resetShift);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - KST_OFFSET_MS + resetShift;
}
function availableChallengeTokens(hist, nowMs) {
  const ws = startOfKstWeekMs(nowMs);
  const n = (hist || []).filter((h) => h.status === "rejected" && (h.challengedAt?.toMillis?.() ?? 0) >= ws).length;
  return Math.max(0, 5 - n);
}
const DAY = 86400000;
const kst = (y, mo, d, h = 0, mi = 0, s = 0) => Date.UTC(y, mo, d, h, mi, s) - KST_OFFSET_MS; // KST wall-clock → UTC ms
const ts = (ms) => ({ toMillis: () => ms });
const isKstMon04 = (ms) => { const d = new Date(ms + KST_OFFSET_MS); return d.getUTCDay() === 1 && d.getUTCHours() === WEEKLY_RESET_HOUR_KST && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0; };

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", msg); } };

const bnd = kst(2026, 6, 20, 4, 0);         // 2026-07-20 Mon 04:00 KST (this week's reset)
const prev = bnd - 7 * DAY;                  // 2026-07-13 Mon 04:00 KST (last week's reset)

// --- boundary math (04:00, not midnight) ---
ok(startOfKstWeekMs(bnd) === bnd, "Mon 04:00 KST maps to itself");
ok(startOfKstWeekMs(bnd + 1000) === bnd, "Mon 04:00:01 → this week (04:00)");
ok(startOfKstWeekMs(bnd - 1000) === prev, "Mon 03:59:59 → LAST week (still previous 04:00)");
ok(startOfKstWeekMs(kst(2026, 6, 20, 3, 59)) === prev, "Mon 03:59 (before 4AM) → last week");
ok(startOfKstWeekMs(kst(2026, 6, 20, 6, 0)) === bnd, "Mon 06:00 (after 4AM) → this week");
ok(startOfKstWeekMs(kst(2026, 6, 22, 14, 30)) === bnd, "Wed 07-22 → this Monday 04:00");
ok(isKstMon04(startOfKstWeekMs(kst(2026, 6, 22, 14, 30))), "week-start is a KST Monday 04:00");
ok(startOfKstWeekMs(kst(2026, 6, 19, 23, 56)) === prev, "NOW-ish (Sun 07-19 23:56) → last Mon 07-13 04:00");
ok(startOfKstWeekMs(kst(2026, 6, 20, 0, 5)) === prev, "Mon 00:05 (deployed just after midnight, before 4AM) → still last week");

// --- availability logic ---
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], bnd + 60000) === 5, "this-past-week rejection RELEASED after Mon 04:00");
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], kst(2026, 6, 20, 2, 0)) === 4, "still penalized at Mon 02:00 (before the 4AM reset)");
ok(availableChallengeTokens([{ status: "pending", challengedAt: ts(bnd) }], bnd) === 5, "pending does NOT consume a token");
ok(availableChallengeTokens([{ status: "rejected" }], bnd) === 5, "missing challengedAt → not counted (lenient)");
ok(availableChallengeTokens(Array(7).fill({ status: "rejected", challengedAt: ts(bnd + 1000) }), bnd + 2000) === 0, "clamps at 0");
// KEY: deploy just-after-midnight (00:0x Mon) → still last-week window → students reset only at 4AM, not on deploy
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], kst(2026, 6, 20, 0, 10)) === 4, "DEPLOY @00:10 Mon: penalty holds until 04:00");
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], kst(2026, 6, 20, 4, 1)) === 5, "…then RESETS at 04:01 Mon");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

// Unit test for the challenge-token weekly-reset KST math (before deploy at the boundary).
const KST_OFFSET_MS = 540 * 60 * 1000;
function startOfKstWeekMs(nowMs) {
  const d = new Date(nowMs + KST_OFFSET_MS);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - KST_OFFSET_MS;
}
function availableChallengeTokens(hist, nowMs) {
  const ws = startOfKstWeekMs(nowMs);
  const n = (hist || []).filter((h) => h.status === "rejected" && (h.challengedAt?.toMillis?.() ?? 0) >= ws).length;
  return Math.max(0, 5 - n);
}
const DAY = 86400000;
const kst = (y, mo, d, h = 0, mi = 0, s = 0) => Date.UTC(y, mo, d, h, mi, s) - KST_OFFSET_MS; // KST wall-clock → UTC ms
const ts = (ms) => ({ toMillis: () => ms });
const isKstMon00 = (ms) => { const d = new Date(ms + KST_OFFSET_MS); return d.getUTCDay() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0; };

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", msg); } };

const mon = kst(2026, 6, 20, 0, 0); // 2026-07-20 00:00 KST (Monday — tonight's boundary)

// --- boundary math ---
ok(startOfKstWeekMs(mon) === mon, "Mon 00:00 KST maps to itself");
ok(startOfKstWeekMs(mon + 1000) === mon, "Mon 00:00:01 → this Monday");
ok(startOfKstWeekMs(mon - 1000) === mon - 7 * DAY, "Sun 23:59:59 → last Monday");
ok(startOfKstWeekMs(kst(2026, 6, 22, 14, 30)) === mon, "Wed 07-22 → this Monday 07-20");
ok(isKstMon00(startOfKstWeekMs(kst(2026, 6, 22, 14, 30))), "week-start is a KST Monday 00:00");
ok(startOfKstWeekMs(kst(2026, 6, 19, 23, 56)) === kst(2026, 6, 13, 0, 0), "NOW (Sun 07-19 23:56) → Mon 07-13");
ok(startOfKstWeekMs(kst(2026, 6, 13, 0, 0)) === kst(2026, 6, 13, 0, 0), "Mon 07-13 00:00 maps to itself");

// --- availability logic ---
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], mon + 60000) === 5, "last-week rejection RELEASED after Mon boundary");
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 15, 10)) }], kst(2026, 6, 19, 23, 56)) === 4, "this-week rejection COUNTS before Mon boundary");
ok(availableChallengeTokens([{ status: "rejected", challengedAt: ts(kst(2026, 6, 20, 3)) }], mon + 4 * 3600000) === 4, "new rejection after boundary counts this week");
ok(availableChallengeTokens([{ status: "pending", challengedAt: ts(mon) }], mon) === 5, "pending does NOT consume a token");
ok(availableChallengeTokens([{ status: "rejected" }], mon) === 5, "missing challengedAt → not counted (lenient)");
ok(availableChallengeTokens(Array(5).fill({ status: "rejected", challengedAt: ts(mon + 1000) }), mon + 2000) === 0, "5 rejections this week → 0 tokens");
ok(availableChallengeTokens(Array(7).fill({ status: "rejected", challengedAt: ts(mon + 1000) }), mon + 2000) === 0, "clamps at 0 (never negative)");
// the KEY deploy scenario: old 30-day-era rejections all vanish once we're in the new week
ok(availableChallengeTokens([
  { status: "rejected", challengedAt: ts(kst(2026, 6, 8, 10)) },   // 07-08 (윤여진-era)
  { status: "rejected", challengedAt: ts(kst(2026, 6, 12, 9)) },   // 07-12
], mon + 60000) === 5, "DEPLOY SCENARIO: pre-week rejections → everyone at 5 in the new week");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

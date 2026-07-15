/**
 * lsr_deepfix_net_helpers.mjs — degraded-network injection primitives for M-NET (resilience matrix).
 *
 * WHY THIS IS SEPARATE: the base lsr_ui.mjs policy FORBIDS request interception / injected control of the
 * network. M-NET's whole purpose is the opposite — deliberately degrade the network at a chokepoint and assert
 * the app stays correct. These helpers wrap a scenario's critical action in offline / slow / one-shot-failure
 * conditions, then ALWAYS restore. They touch only Playwright's network layer (CDP + context.setOffline +
 * page.route) — never the app code, never Firestore data (the Admin-SDK oracle checks that separately).
 *
 * Design: audit/deepfix/task6/M_NET_DESIGN.md. Portable (no /app paths; pure Playwright API).
 */

/** OFFLINE BLIP — take the browser fully offline for the duration of `fn`, then restore.
 *  Models: connection drop mid-submit / mid-completion. Assert: no false-success, idempotent recovery on reconnect. */
export async function withOffline(page, fn) {
  const ctx = page.context();
  await ctx.setOffline(true);
  try { return await fn(); } finally { await ctx.setOffline(false); }
}

/** SLOW NETWORK — high latency + low throughput (CDP) for the duration of `fn`, then restore to unthrottled.
 *  Models: slow-3G / congested link. Assert: loading state shown, eventual correct success, no false timeout-fail.
 *  Defaults ≈ a bad-3G link (2s RTT, ~30KB/s down, ~20KB/s up). */
export async function withSlow(page, fn, { latency = 2000, downKbps = 30, upKbps = 20 } = {}) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable').catch(() => {});
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency,
    downloadThroughput: Math.round((downKbps * 1024) / 8) * 8, // bytes/s
    uploadThroughput: Math.round((upKbps * 1024) / 8) * 8,
    connectionType: 'cellular3g',
  });
  try {
    return await fn();
  } finally {
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    }).catch(() => {});
    await client.detach().catch(() => {});
  }
}

/** ONE-SHOT FAILURE — abort the FIRST request matching `urlPattern`, then let subsequent ones through.
 *  Models: a transient write/grade failure that the app should retry. Assert: retry → EXACTLY one attempt
 *  (idempotent — no duplicate, no lost write). `urlPattern` is a Playwright glob (e.g. '**\/gradeTypedTest**'
 *  for the grade callable, or '**\/*firestore.googleapis.com/**' for the Firestore write). */
export async function withFailOnce(page, urlPattern, fn) {
  let fired = false;
  const handler = (route) => {
    if (!fired) { fired = true; return route.abort('failed'); }
    return route.continue();
  };
  await page.route(urlPattern, handler);
  try { return await fn(); } finally { await page.unroute(urlPattern, handler).catch(() => {}); }
}

/** TOTAL FAILURE — abort EVERY request matching `urlPattern` for the duration of `fn`, then restore.
 *  Models: the backend is unreachable the whole time. Assert: clear error/retry UX, NO false-success, no corruption. */
export async function withFailAll(page, urlPattern, fn) {
  const handler = (route) => route.abort('failed');
  await page.route(urlPattern, handler);
  try { return await fn(); } finally { await page.unroute(urlPattern, handler).catch(() => {}); }
}

/** Common request patterns for the chokepoints (Playwright globs). */
export const NET_PATTERNS = {
  firestoreWrite: '**/*firestore.googleapis.com/**', // gRPC-Web / WebChannel Firestore traffic
  gradeCallable: '**/gradeTypedTest**',               // the AI-grading Cloud Function
  anyGoogleApis: '**/*googleapis.com/**',             // firestore + auth + functions
};

#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — fetch-live-rules.mjs: THE LIVE RULESET BASELINE (17_ §7b step 1)
 * ============================================================================
 * READ-ONLY. Pulls the ruleset ACTUALLY LIVE in production for cloud.firestore
 * via the Firebase Rules REST API and saves it as the merge base the rules
 * workstream authors against ("The merge base is THE RULESET LIVE IN PRODUCTION
 * AT DARK-TRAIN TIME — not any repo draft", firestore.review_v2.rules:7).
 *
 * Outputs (committed — rules text contains no uids):
 *   audit/deepfix/task3/live_baseline/firestore.live.rules      the source text
 *   audit/deepfix/task3/live_baseline/live_ruleset.meta.json    name/createTime/sha256
 *
 * Re-run at deploy-order time: a changed sha256 means the base DRIFTED since
 * authoring and the merge must be re-derived (the freshness check).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/fetch-live-rules.mjs
 * Exit: 0 ok · 2 API/shape failure (nothing written)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
const auth = new GoogleAuth({
  credentials: key,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const token = (await (await auth.getClient()).getAccessToken()).token;
const base = "https://firebaserules.googleapis.com/v1";
const hdr = { Authorization: `Bearer ${token}` };

async function get(path) {
  const r = await fetch(`${base}/${path}`, { headers: hdr });
  if (!r.ok) {
    console.error(`GET ${path} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
    process.exit(2);
  }
  return r.json();
}

// The release that binds cloud.firestore to its live ruleset.
const release = await get(`projects/${key.project_id}/releases/cloud.firestore`);
if (!release.rulesetName) {
  console.error("release has no rulesetName:", JSON.stringify(release));
  process.exit(2);
}
const ruleset = await get(release.rulesetName);
const files = ruleset?.source?.files ?? [];
if (files.length !== 1) {
  console.error(`expected exactly 1 source file, got ${files.length}:`, files.map((f) => f.name));
  process.exit(2);
}
const content = files[0].content;
const sha256 = createHash("sha256").update(content).digest("hex");

const outDir = new URL("../../audit/deepfix/task3/live_baseline/", import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL("firestore.live.rules", outDir), content);
writeFileSync(
  new URL("live_ruleset.meta.json", outDir),
  JSON.stringify(
    {
      projectId: key.project_id,
      release: release.name,
      releaseUpdateTime: release.updateTime ?? null,
      rulesetName: release.rulesetName,
      rulesetCreateTime: ruleset.createTime ?? null,
      sourceFileName: files[0].name,
      lines: content.split("\n").length,
      sha256,
      fetchedBy: "scripts/deepfix2/fetch-live-rules.mjs",
    },
    null,
    2,
  ) + "\n",
);
console.log(`[live-rules] ${release.rulesetName} (created ${ruleset.createTime})`);
console.log(`[live-rules] ${content.split("\n").length} lines, sha256 ${sha256.slice(0, 16)}…`);
console.log("[live-rules] saved to audit/deepfix/task3/live_baseline/");

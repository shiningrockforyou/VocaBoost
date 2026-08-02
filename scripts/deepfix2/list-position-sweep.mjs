#!/usr/bin/env node
// DEEPFIX2 r74/O3 — READ-ONLY position sweep: counts duplicate + gapped
// `position`s per list (no uids, no writes). Output: counts only.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const lists = await db.collection("lists").get();
let dup = 0, gap = 0, clean = 0, empty = 0;
for (const l of lists.docs) {
  const words = await l.ref.collection("words").select("position").get();
  if (words.empty) { empty++; continue; }
  const pos = words.docs.map((d) => d.data().position).filter(Number.isInteger).sort((a, b) => a - b);
  const dups = pos.some((p, i) => i > 0 && p === pos[i - 1]);
  const gaps = pos.some((p, i) => i > 0 && p !== pos[i - 1] + 1) || (pos[0] ?? 0) !== 0 || pos.length !== words.size;
  if (dups) { dup++; console.log(`DUP  ${l.id} (${words.size} words)`); }
  else if (gaps) { gap++; console.log(`GAP  ${l.id} (${words.size} words)`); }
  else clean++;
}
const summary = {lists: lists.size, clean, gapped: gap, duplicated: dup, empty};
console.log(JSON.stringify(summary));
// [r75 Codex-5] committed, reviewable receipt: project/time/counts/script-hash.
const {writeFileSync} = await import("node:fs");
const {createHash} = await import("node:crypto");
const self = readFileSync(new URL(import.meta.url));
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/list-position-sweep-receipt.json", import.meta.url),
    JSON.stringify({kind: "list-position-sweep", projectId: key.project_id,
      at: new Date().toISOString(), ...summary,
      scriptSha16: createHash("sha256").update(self).digest("hex").slice(0, 16)}, null, 2));

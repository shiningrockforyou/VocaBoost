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
console.log(JSON.stringify({lists: lists.size, clean, gapped: gap, duplicated: dup, empty}));

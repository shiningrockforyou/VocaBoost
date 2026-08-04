#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-11 TEACHER REVIEW-SETTINGS — PURE fixtures (no Firebase, no network)
 * ============================================================================
 * SEAM (why PURE, not the emulator): the two writers gate on the CLIENT BUILD
 * CONST `REVIEW_V2_CLIENT` (featureFlags.js:243 = false). A build const cannot
 * be flipped at test time without editing the flag VALUE (forbidden), so the
 * emulator could only ever exercise the flag-OFF path — it can NOT test the
 * flag-ON validation (C2/C3) or the mutants (C4). So the flag-ON validation/
 * construction was extracted into the PURE, firebase-free
 * `src/utils/reviewSettingsAuthority.js` (the same pure-extraction seam
 * streakAuthority.js used for the dashboard fold, and the one `db.js CANNOT
 * load under plain node` forces). This file exercises that REAL module, and
 * proves flag-OFF byte-identity with STATIC source anchors on the three edited
 * files + the REAL imported flag value (REVIEW_V2_CLIENT === false).
 *
 *   C1  FLAG-OFF WRITER + CALLER BYTE-IDENTITY: REVIEW_V2_CLIENT is false; the
 *       new keys live ONLY inside the flag-gated branches in db.js
 *       (assignListToClass ternary + updateAssignmentSettings `if`); the
 *       reviewTestSizeMin/Max write + validation are NOT removed (E1); the two
 *       assemblers NEVER emit min/max; the callers (handleSaveSettings swap,
 *       AssignListModal's undefined 10th arg) keep the flag-off write identical.
 *   C2  FLAG-ON WRITE: assignReviewSettings fills the four new keys with the
 *       validated values + VISIBLE defaults (92/60/30/true) and never min/max;
 *       patchReviewSettings emits only the present new keys.
 *   C3  VALIDATION, one valid + invalid PER field (the 5 fields), matched to
 *       the SERVER contract config.js:163-192 (ints reject out of range; gate
 *       coerces boolean; type defaults mcq).
 *
 * Run: node scripts/deepfix2/df2-11-teacher-review-settings-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-11-teacher-review-settings-pure.json
 * (DF2_11_PURE_RECEIPT redirects the receipt for the mutant driver, same
 * audit-fixed idiom as dashboard-streak-authority-fixtures.mjs.)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  assignReviewSettings,
  patchReviewSettings,
  validateReviewField,
  REVIEW_SETTINGS_DEFAULTS,
  NEW_REVIEW_WRITE_FIELDS,
} from "../../src/utils/reviewSettingsAuthority.js";
import { REVIEW_V2_CLIENT } from "../../src/config/featureFlags.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);
const checkThrows = (name, fn) => {
  total++;
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) { failed++; reds.push(`${caseName} :: ${name} — expected a throw, got none`); console.error(`  RED ${name}: expected throw`); }
};

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const DB = read("../../src/services/db.js");
const CLASSDETAIL = read("../../src/pages/ClassDetail.jsx");
const MODAL = read("../../src/components/AssignListModal.jsx");

// ===========================================================================
CASE("C1 — flag-OFF WRITER byte-identity (the whole fold assumes REVIEW_V2_CLIENT === false)");
{
  // The REAL imported value — flag-OFF is the live posture (947 students / 26SM teachers).
  check("REVIEW_V2_CLIENT is false", REVIEW_V2_CLIENT, false);

  // db.js assignListToClass: the new keys are ONLY inside the flag-gated ternary, and the
  // reviewTestSizeMin/Max write is the flag-OFF branch (NOT removed — E1).
  checkTrue("assignListToClass gates the new group on REVIEW_V2_CLIENT",
    DB.includes("...(REVIEW_V2_CLIENT") && DB.includes("? assignReviewSettings(reviewOptions)"));
  checkTrue("assignListToClass keeps reviewTestSizeMin as the flag-OFF branch (E1: not deleted)",
    DB.includes("reviewTestSizeMin: Number(reviewTestSizeMin) || 30"));
  checkTrue("assignListToClass keeps reviewTestSizeMax as the flag-OFF branch (E1: not deleted)",
    DB.includes("reviewTestSizeMax: Number(reviewTestSizeMax) || 60"));

  // db.js updateAssignmentSettings: the new keys are behind `if (REVIEW_V2_CLIENT)`, and the
  // min/max validation blocks are still present (E1).
  checkTrue("updateAssignmentSettings gates the new group on REVIEW_V2_CLIENT",
    DB.includes("if (REVIEW_V2_CLIENT) {") && DB.includes("Object.assign(updates, patchReviewSettings(settings))"));
  checkTrue("updateAssignmentSettings keeps the reviewTestSizeMin validation block (E1)",
    DB.includes("if (settings.reviewTestSizeMin !== undefined) {"));
  checkTrue("updateAssignmentSettings keeps the reviewTestSizeMax validation block (E1)",
    DB.includes("if (settings.reviewTestSizeMax !== undefined) {"));

  // The assemblers themselves can NEVER echo min/max — even fed min/max inputs.
  const asgOut = assignReviewSettings({ reviewTestSizeMin: 99, reviewTestSizeMax: 99 });
  check("assignReviewSettings never emits reviewTestSizeMin", "reviewTestSizeMin" in asgOut, false);
  check("assignReviewSettings never emits reviewTestSizeMax", "reviewTestSizeMax" in asgOut, false);
  const patOut = patchReviewSettings({ reviewTestSizeMin: 99, reviewTestSizeMax: 99 });
  check("patchReviewSettings never emits min/max", Object.keys(patOut), []);

  // The CALLERS keep the flag-off write byte-identical: handleSaveSettings sends min/max in the
  // flag-off spread branch; AssignListModal passes `undefined` as the appended 10th arg flag-off.
  checkTrue("ClassDetail handleSaveSettings swaps min/max ↔ new-group on REVIEW_V2_CLIENT",
    CLASSDETAIL.includes("...(REVIEW_V2_CLIENT") &&
    CLASSDETAIL.includes("reviewTestSizeMin: settingsForm.reviewTestSizeMin,") &&
    CLASSDETAIL.includes("reviewPassThreshold: settingsForm.reviewPassThreshold,"));
  checkTrue("AssignListModal passes the 9 positional args + an appended options object",
    MODAL.includes("reviewTestType, reviewTestSizeMin, reviewTestSizeMax,"));
  checkTrue("AssignListModal's appended arg is `undefined` flag-off",
    MODAL.includes("REVIEW_V2_CLIENT") && MODAL.includes(": undefined,"));
}

// ===========================================================================
CASE("C2 — flag-ON write: new fields with validated values + VISIBLE defaults, min/max omitted");
{
  // assignListToClass (full object): absent ⇒ visible defaults.
  check("assignReviewSettings({}) fills the four new keys with defaults", assignReviewSettings({}), {
    reviewPassThreshold: 92, reviewQueueSize: 60, reviewTestSize: 30, reviewGateEnabled: true,
  });
  // Defaults are the config.js numbers (and reviewPassThreshold 92 is DISTINCT from passThreshold 95).
  check("default reviewPassThreshold is 92 (NOT the new-word 95)", REVIEW_SETTINGS_DEFAULTS.reviewPassThreshold, 92);
  check("the four write fields are exactly the new keys", NEW_REVIEW_WRITE_FIELDS,
    ["reviewPassThreshold", "reviewQueueSize", "reviewTestSize", "reviewGateEnabled"]);

  // present valid values are written verbatim.
  check("assignReviewSettings(valid) writes the passed values", assignReviewSettings({
    reviewPassThreshold: 88, reviewQueueSize: 40, reviewTestSize: 20, reviewGateEnabled: false,
  }), { reviewPassThreshold: 88, reviewQueueSize: 40, reviewTestSize: 20, reviewGateEnabled: false });

  // updateAssignmentSettings (sparse patch): only present new keys, never reviewTestType/min/max.
  check("patchReviewSettings({reviewPassThreshold:88}) ⇒ only that key", patchReviewSettings({ reviewPassThreshold: 88 }), { reviewPassThreshold: 88 });
  check("patchReviewSettings ignores reviewTestType (handled separately in db.js)",
    patchReviewSettings({ reviewTestType: "typed" }), {});
  check("patchReviewSettings({reviewGateEnabled:false}) ⇒ boolean false", patchReviewSettings({ reviewGateEnabled: false }), { reviewGateEnabled: false });
}

// ===========================================================================
CASE("C3 — validation, one valid + invalid PER field (mirror of config.js:163-192)");
{
  // reviewPassThreshold — int [1,100]
  check("reviewPassThreshold 50 valid", validateReviewField("reviewPassThreshold", 50), 50);
  check("reviewPassThreshold boundary 1 valid", validateReviewField("reviewPassThreshold", 1), 1);
  check("reviewPassThreshold boundary 100 valid", validateReviewField("reviewPassThreshold", 100), 100);
  checkThrows("reviewPassThreshold 0 rejected", () => validateReviewField("reviewPassThreshold", 0));
  checkThrows("reviewPassThreshold 101 rejected", () => validateReviewField("reviewPassThreshold", 101));
  checkThrows("reviewPassThreshold 92.5 (non-integer) rejected", () => validateReviewField("reviewPassThreshold", 92.5));

  // reviewQueueSize — int [1,500]
  check("reviewQueueSize 200 valid", validateReviewField("reviewQueueSize", 200), 200);
  check("reviewQueueSize boundary 500 valid", validateReviewField("reviewQueueSize", 500), 500);
  checkThrows("reviewQueueSize 0 rejected", () => validateReviewField("reviewQueueSize", 0));
  checkThrows("reviewQueueSize 501 rejected", () => validateReviewField("reviewQueueSize", 501));

  // reviewTestSize — int [1,500]
  check("reviewTestSize 30 valid", validateReviewField("reviewTestSize", 30), 30);
  check("reviewTestSize boundary 500 valid", validateReviewField("reviewTestSize", 500), 500);
  checkThrows("reviewTestSize 0 rejected", () => validateReviewField("reviewTestSize", 0));
  checkThrows("reviewTestSize 501 rejected", () => validateReviewField("reviewTestSize", 501));

  // reviewGateEnabled — coerced boolean
  check("reviewGateEnabled true ⇒ true", validateReviewField("reviewGateEnabled", true), true);
  check("reviewGateEnabled false ⇒ false", validateReviewField("reviewGateEnabled", false), false);
  check("reviewGateEnabled 'yes' coerced ⇒ false (never a non-boolean reaches the write)", validateReviewField("reviewGateEnabled", "yes"), false);
  check("reviewGateEnabled 1 coerced ⇒ false", validateReviewField("reviewGateEnabled", 1), false);

  // reviewTestType — mcq|typed, default mcq
  check("reviewTestType 'mcq' ⇒ mcq", validateReviewField("reviewTestType", "mcq"), "mcq");
  check("reviewTestType 'typed' ⇒ typed", validateReviewField("reviewTestType", "typed"), "typed");
  check("reviewTestType 'dsf' (bad enum) ⇒ default mcq", validateReviewField("reviewTestType", "dsf"), "mcq");
  check("reviewTestType '' ⇒ default mcq", validateReviewField("reviewTestType", ""), "mcq");
}

// ===========================================================================
const sha16 = (rel) => createHash("sha256").update(read(rel)).digest("hex").slice(0, 16);
const evidencePath = process.env.DF2_11_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_11_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-11-teacher-review-settings-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-11-teacher-review-settings-pure",
  pass: failed === 0,
  total, failed, reds,
  constants: { REVIEW_V2_CLIENT, REVIEW_SETTINGS_DEFAULTS },
  sourceShas: {
    "src/utils/reviewSettingsAuthority.js": sha16("../../src/utils/reviewSettingsAuthority.js"),
    "src/services/db.js": sha16("../../src/services/db.js"),
    "src/pages/ClassDetail.jsx": sha16("../../src/pages/ClassDetail.jsx"),
    "src/components/AssignListModal.jsx": sha16("../../src/components/AssignListModal.jsx"),
    "scripts/deepfix2/df2-11-teacher-review-settings-fixtures.mjs": sha16("./df2-11-teacher-review-settings-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-11-teacher-review-settings PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);

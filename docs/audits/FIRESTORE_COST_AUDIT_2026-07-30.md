# Firestore cost audit — 2026-07-30

**Question asked:** the GCP bill is ~$150/month; is it worth migrating off Firebase, and does our scale
justify it? **Answer: no.** ~83% of the bill is a single fixable query pattern. Actionable defect is
**`NEED_TO_FIX.md` #17**; this document is the measurement behind it.

Project `vocaboost-879c2`. All figures read-only from Cloud Monitoring, 7 days ending 2026-07-30.
Reproduce with `scripts/firestore-usage-probe.mjs`.

---

## 1. Scale (why platform cost "shouldn't" be a problem)

| Collection | Docs |
|---|---|
| `users` | 1,452 |
| `attempts` | 40,090 |
| `system_logs` | 79,997 |
| `grading_jobs` | 15,883 |
| `classes` / `lists` | 302 / 46 |
| all `ap_*` combined | ~165 |
| `study_states` (subcollection) | ~896,885 (26SM alone) |

≈1M documents, ~730 MB. Storage bills **~$0.13/month**. Nothing here justifies a platform migration.

## 2. Measured usage (Cloud Monitoring, 7d → monthly extrapolation)

| Metric | 7-day | ~Monthly | ~Cost |
|---|---|---|---|
| `document/read_count` | 48,706,254 | **208,741,089** | **~$125** |
| `document/write_count` | 965,114 | 4,136,203 | ~$7 |
| `document/delete_count` | 2,199 | 9,424 | ~$0.00 |
| Storage (0.73 GiB) | — | — | ~$0.13 |
| **Firestore subtotal** | | | **~$133 of ~$150** |

### 2a. Reads by type — the decisive breakdown

| Type | 7-day | ~Monthly | Share |
|---|---|---|---|
| **QUERY** | 48,235,784 | **206,724,789** | **99.0%** |
| LOOKUP | 427,731 | 1,833,133 | 0.9% |
| NOT_FOUND | 42,485 | 182,079 | 0.1% |

A QUERY read bills **per document returned**. An unfiltered `getDocs(collectionRef)` over a 2,240-doc
subcollection is 2,240 billed reads. Single-doc `getDoc` (LOOKUP) is negligible by comparison — so the cost
is entirely in unscoped collection reads, not in read *frequency*.

### 2b. Daily shape — rules out batch jobs

| Thu 24 | **Fri 25** | **Sat 26** | Mon 27 | Tue 28 | Wed 29 | Thu 30 |
|---|---|---|---|---|---|---|
| 8,746,096 | **387,515** | **318,042** | 10,071,963 | 10,012,637 | 10,188,354 | 8,981,647 |

Weekend drops **25–30×**. This is human session traffic during class hours — not cron, not the deepfix2
audit scripts, not the CS sweeps.

### 2c. Cloud Functions — effectively free

| Function | 7-day invocations |
|---|---|
| `resolveListProgress` | 27,628 |
| `pauseStaleSessions` | 10,081 |
| `submitVocabAttempt` | 9,539 |
| `gradeTypedTest` | 5,401 |
| `completeSession` | 4,286 |
| others | <1,100 each |

~59k/7d ≈ **253k/month against a 2M free tier**. Functions are not a cost factor. The ~$17 residual is
hosting / egress / Cloud Storage.

## 3. Attribution

~10M reads/weekday ÷ 954 active students ≈ **10,500 reads per student per weekday**, against ~1,090 avg
(26SM: 896,885 ÷ 823) and 2,240 on a sampled heavy student. That is ~5–10 full `study_states` scans per
student per day — consistent with a dashboard load plus each test submission going through the unscoped
paths in `NEED_TO_FIX.md` #17, plus `ClassDetail.jsx:225` fanning one scan out per class member.

## 4. Verdict

- **Not a Firebase problem.** 1,452 users / ~1M docs / 0.73 GiB is small; the platform is not straining.
- **A migration would save at most the ~$124 read line** and cost multiple weeks — while the same money is
  recoverable in ~1 day by scoping four queries. Expect **~$150 → ~$25**.
- Revisit the platform question only for a non-cost reason (SQL reporting, vendor risk, separate AP infra),
  and preferably after deepfix2 lands — its server-side write cutover (`SERVER_PROGRESS_WRITE`,
  `resolveListProgress`, `completeSession`) shrinks any future migration surface from ~600 client call sites
  to ~20 callables. Note the client uses `onSnapshot` only **4 times**, so realtime — normally the hardest
  part of leaving Firestore — is a non-issue here.

## 5. Open / to confirm

- **Dollar figures are derived**, not read from billing: units × assumed list price ($0.06/100k reads,
  $0.18/100k writes, $0.18/GiB storage). Confirm against **GCP Console → Billing → Reports**, Service =
  *Cloud Firestore*, grouped by **SKU** ("Cloud Firestore Read Ops"). Region pricing or committed-use
  discounts could shift the absolute numbers; they do not change the 99%-QUERY shape.
- The admin service account (`firebase-adminsdk-fbsvc@vocaboost-879c2`) **can** read Cloud Monitoring but
  **cannot** read Billing — the SKU report needs console access.
- `system_logs` (79,997) and `grading_jobs` (15,883) are append-only with no retention policy. Not a cost
  factor today (writes are ~$7/mo total) but worth a TTL before they become one.

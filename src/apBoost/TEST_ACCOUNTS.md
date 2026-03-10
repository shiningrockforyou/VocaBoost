# apBoost Test Accounts

## Production (Firebase)

| Role | Email | Password | Display Name |
|------|-------|----------|--------------|
| Teacher | teacher@apboost.test | Teacher123! | Ms. Thompson |
| Student | student@apboost.test | Student123! | Alex Johnson |
| Student 2 | student2@apboost.test | Student123! | Brian Kim |
| Student 3 | student3@apboost.test | Student123! | Carmen Lopez |
| Student 4 | student4@apboost.test | Student123! | Diana Park |
| Student 5 | student5@apboost.test | Student123! | Ethan Chen |
| Student 6 | student6@apboost.test | Student123! | Fatima Ali |
| Student 7 | student7@apboost.test | Student123! | George Martinez |
| Student 8 | student8@apboost.test | Student123! | Hannah Lee |
| Student 9 | student9@apboost.test | Student123! | Isaac Nguyen |
| Student 10 | student10@apboost.test | Student123! | Julia Brown |
| Student 11 | student11@apboost.test | Student123! | Kevin Patel |

Created via `scripts/create-auth-accounts.js`, `scripts/create-extra-students.js`, and `scripts/create-test-students.js`.

## Emulator

| Role | Email | Password | Display Name |
|------|-------|----------|--------------|
| Teacher | teacher@test.com | test123 | Test Teacher |
| Student | student@test.com | test123 | Test Student |

Created via `scripts/seedEmulator.js`.

## Seed Data

The teacher account owns:
- 3 tests: Micro, Macro, Calc AB (`test_micro_full_1`, `test_macro_full_1`, `test_calc_ab_full_1`)
- 2 classes: `class_econ_p1`, `class_calc_p3`
- 3 assignments: `assign_micro_p1`, `assign_macro_p1`, `assign_calc_p3`
- 51 questions across all tests

The student account has test results for all 3 tests.

Seed data created via `scripts/seed-ap-data.js` and `src/apBoost/utils/seedFullData.js` (in-app dev tool).

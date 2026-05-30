# B01 — Auth Flows

**Priority:** P1
**Estimated duration:** 30–45 minutes
**Depends on:** B00 for seeded users.
**Personas:** all (auth is per-user).

## Goal

Login, signup, password reset, sign-out, persistence across tabs and refresh. Any auth failure has knock-on effects across every other batch.

## Scenarios

### S01 — Login happy path

1. `page.goto('/login')`
2. Enter `carefulStudent` credentials.
3. Submit. Redirect to `/` or `/dashboard` within 3s.
4. Dashboard shows the student's name / their assigned lists.
5. No console errors.

### S02 — Login bad password

1. Enter correct email, wrong password.
2. Submit.
3. Expected: clear error message ("Invalid password" or "Login failed"). User remains on /login.
4. After 3 failed attempts in a row, no lockout (Firebase usually doesn't lock; document if so).

### S03 — Login unknown email

1. Enter `nonexistent_${Date.now()}@vocaboost.test`.
2. Submit.
3. Clear error; user stays on /login.

### S04 — Signup happy path

Already covered in B00. Sanity-check once more with a throwaway account.

### S05 — Signup duplicate email

1. Try to sign up with `carefulStudent`'s email (created in B00).
2. Expected: error "Email already in use" or similar.

### S06 — Signup with very weak password

1. Try `'a'` as password.
2. Expected: client-side or server-side validation rejects.

### S07 — Signup with very long email/name

1. Email: 100 chars (valid format), Name: 200 chars.
2. Expected: accepted OR clear validation message.
3. If accepted, downstream dashboard shows the long name without breaking layout.

### S08 — Password reset link

If implemented:
1. Click "Forgot password" → enter email → submit.
2. Verify confirmation message.
3. (Don't verify actual email delivery — emulator skip.)

### S09 — Sign out, dashboard inaccessible

1. Log in as `carefulStudent`.
2. Click Sign out.
3. Navigate to `/dashboard` directly.
4. Redirected to /login.
5. Browser back: cannot access cached dashboard view with private data.

### S10 — Auth state persists across refresh

1. Log in.
2. Refresh page.
3. Still logged in; dashboard reloads with student's data.

### S11 — Auth state persists across tab close + reopen

1. Log in. Close tab.
2. Open new tab to `/`.
3. Still logged in.

### S12 — Two tabs same user

1. Log in tab A.
2. Open tab B at `/`. Still logged in.
3. Sign out from tab B.
4. Tab A: next interaction either gets logged out or shows auth-error.

### S13 — Two tabs different users

1. Tab A logged in as `carefulStudent`.
2. Tab B: log in as `rushedStudent` (Firebase auth is per-context, so this either logs out A or coexists).
3. Verify behaviour is consistent.

### S14 — Role-based redirect

1. Log in as `powerTeacher`. Dashboard renders the teacher view.
2. Log in as `carefulStudent` (same machine, different session). Dashboard renders student view.
3. Try navigating to a teacher-only URL as a student. Expected: redirect or 403.

### S15 — Email verification (if required)

If signup requires email verification:
1. Sign up. Verify the unverified-user UI is shown.
2. (Skip actual verification flow if it requires email delivery; document.)

### S16 — Token refresh

1. Log in. Wait until token is about to expire (Firebase tokens typically 1h).
2. (Shim `Date.now` to advance 65 minutes.) Or trigger a forced token refresh.
3. Verify auth survives — Firebase SDK should auto-refresh.

## Severity reminder

S01 / S09 = BLOCKER if broken. S02 / S05 / S14 = HIGH. Others MEDIUM/LOW.

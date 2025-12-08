import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Button } from '../components/ui'

const Signup = () => {
  const navigate = useNavigate()
  const { signup, signInWithGoogle } = useAuth()
  const [formState, setFormState] = useState({
    displayName: '',
    email: '',
    password: '',
    gradYear: '',
    gradMonth: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await signup(
        formState.email,
        formState.password,
        formState.displayName,
        {
          gradYear: formState.gradYear ? Number(formState.gradYear) : null,
          gradMonth: formState.gradMonth ? Number(formState.gradMonth) : null,
        },
      )
      navigate('/')
    } catch (err) {
      setError(err.message ?? 'Unable to create your account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setIsGoogleLoading(true)
    try {
      const result = await signInWithGoogle()
      // If result is null, user closed popup (not an error)
      if (result) {
        navigate('/')
      }
    } catch (err) {
      // Only show error if it's not popup-closed
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message ?? 'Unable to sign in with Google.')
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default">
        <header className="mb-8 text-center">
          <img src="/logo_small.png" alt="VocaBoost" className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Get Started
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Create your VocaBoost account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Students receive the default role per the VocaBoost spec.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Full Name
            <input
              type="text"
              name="displayName"
              value={formState.displayName}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="Avery Johnson"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              name="email"
              value={formState.email}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="you@school.edu"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              name="password"
              value={formState.password}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Graduation Year
              <input
                type="number"
                name="gradYear"
                min="2024"
                max="2035"
                value={formState.gradYear}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                placeholder="2026"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Graduation Month
              <input
                type="number"
                name="gradMonth"
                min="1"
                max="12"
                value={formState.gradMonth}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                placeholder="6"
              />
            </label>
          </div>

          <Button variant="primary-blue" size="lg" type="submit" disabled={isSubmitting || isGoogleLoading} className="w-full">
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-border-default"></div>
          <span className="px-4 text-sm text-slate-500">Or continue with</span>
          <div className="flex-1 border-t border-border-default"></div>
        </div>

        <Button variant="outline" size="lg" onClick={handleGoogleSignIn} disabled={isSubmitting || isGoogleLoading} className="w-full">
          {isGoogleLoading ? (
            'Signing in...'
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Signup



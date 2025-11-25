import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const Signup = () => {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [formState, setFormState] = useState({
    displayName: '',
    email: '',
    password: '',
    gradYear: '',
    gradMonth: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
        <header className="mb-8 text-center">
          <img src="/logo_small.png" alt="VocaBoost" className="mx-auto mb-4 h-16 w-auto" />
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Get Started
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Create your VocaBoost account</h1>
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
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                placeholder="6"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

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



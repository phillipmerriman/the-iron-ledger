import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await resetPassword(email)
    if (error) {
      setError(error.message)
      setSubmitting(false)
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-surface-900">Reset your password</h1>
          {!submitted && (
            <p className="mt-1 text-sm text-surface-500">
              Enter your email and we&apos;ll send you a reset link
            </p>
          )}
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary-500/10 px-4 py-3 text-sm text-primary-600">
              Check your email for a password reset link.
            </div>
            <p className="text-center text-sm text-surface-500">
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-600">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-surface-300 bg-input-bg px-3 py-2 text-sm text-text shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-surface-500">
              Remember your password?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMPLOYMENT_OPTIONS = ['Student', 'Employed', 'Self-employed', 'Others']

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({
    fullName: '',
    mobileNumber: '',
    password: '',
    employmentStatus: 'Student',
    currentActivity: '',
    monthStartDay: '1',
    registrationReason: '',
  })
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await register(form)
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
      return
    }
    setSubmitted(true)
  }

  const startDayNum = Number(form.monthStartDay)
  const cycleHint =
    startDayNum === 1
      ? 'Monthly cycle: 1st to the last day of each month.'
      : `Monthly cycle: ${ordinal(startDayNum)} of a month to ${ordinal(startDayNum - 1)} of the next month.`

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900">Registration Request Sent</h1>
          <p className="text-sm text-slate-600 mt-2">
            Your account is pending Admin approval. Once approved, you can sign in using your mobile number and password.
          </p>
          <Link
            to="/login"
            className="inline-block mt-6 rounded-lg bg-slate-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-800"
          >
            Go to User Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Register Account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit your details. Admin approval is required before your first login.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="Your full name"
              required
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile Number (User ID)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.mobileNumber}
                onChange={(e) => updateField('mobileNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit number"
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Min 6 characters"
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Employment Status
              </label>
              <select
                value={form.employmentStatus}
                onChange={(e) => updateField('employmentStatus', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Month Starting Day
              </label>
              <select
                value={form.monthStartDay}
                onChange={(e) => updateField('monthStartDay', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {ordinal(day)} of every month
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500 -mt-2">{cycleHint}</p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              What are you doing now?
            </label>
            <input
              type="text"
              value={form.currentActivity}
              onChange={(e) => updateField('currentActivity', e.target.value)}
              placeholder="e.g., BCA 3rd year student, Software Developer, etc."
              required
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Why do you want to register?
            </label>
            <textarea
              rows={3}
              value={form.registrationReason}
              onChange={(e) => updateField('registrationReason', e.target.value)}
              placeholder="Write a short reason..."
              required
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Register Now'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 text-sm text-center">
          Already approved?{' '}
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
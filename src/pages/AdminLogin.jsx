import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [adminId, setAdminId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await login(adminId, password, 'admin')
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
      return
    }
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <span className="inline-block text-xs font-medium uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md mb-2">
            Restricted Portal
          </span>
          <h1 className="text-2xl font-semibold text-white">Admin Login</h1>
          <p className="text-sm text-slate-400 mt-1">Platform administration access only.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Admin ID</label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="admin"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-400 text-slate-950 py-2.5 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Verifying...' : 'Sign In as Admin'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 text-sm text-center">
          <Link to="/login" className="text-slate-400 hover:text-white">
            Switch to User Login
          </Link>
        </div>
      </div>
    </div>
  )
}
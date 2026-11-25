import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AdminResetPasswordCard({ user }) {
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    if (!accessToken) {
      setBusy(false)
      setError('Admin session expired. Please sign in again.')
      return
    }

    const { data, error: invokeErr } = await supabase.functions.invoke(
      'admin-reset-password',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { targetUserId: user.id, newPassword },
      }
    )

    setBusy(false)

    if (invokeErr) {
      let msg = invokeErr.message
      try {
        const errBody = await invokeErr.context?.json()
        if (errBody?.error) msg = errBody.error
      } catch {
        // Fallback to default message
      }
      setError(msg)
      return
    }

    if (data?.error) {
      setError(data.error)
      return
    }

    setNewPassword('')
    setSuccess(`Password updated for ${user.full_name} (${user.mobile_number}).`)
  }

  return (
    <form
      onSubmit={handleReset}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-400" />
        <h3 className="font-semibold text-white text-sm sm:text-base">
          Reset User Password
        </h3>
      </div>

      <p className="text-xs text-slate-400">
        Set a new password if this user forgot theirs. It is hashed automatically by Supabase Auth.
      </p>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
          {success}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          minLength={6}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password (min 6 characters)"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-400 text-slate-950 font-semibold px-4 py-2 text-sm hover:bg-amber-300 disabled:opacity-50 cursor-pointer shrink-0"
        >
          {busy ? 'Updating...' : 'Reset Password'}
        </button>
      </div>
    </form>
  )
}
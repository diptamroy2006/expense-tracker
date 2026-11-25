import { useEffect, useState } from 'react'
import {
  Check,
  Clock,
  FolderKanban,
  LogOut,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AdminUserInspector from '../components/AdminUserInspector'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
    disabled: 'bg-slate-700/60 text-slate-300 border-slate-600',
  }

  return (
    <span
      className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border capitalize ${
        styles[status] || styles.disabled
      }`}
    >
      {status}
    </span>
  )
}

export default function AdminDashboard() {
  const { profile, logout } = useAuth()
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function updateUserStatus(userId, newStatus) {
    setBusyId(userId)
    setError('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      )
    }
    setBusyId(null)
  }

  function handleUserUpdated(updatedProfile) {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedProfile.id ? updatedProfile : u))
    )
  }

  const selectedUser = users.find((u) => u.id === selectedUserId) || null
  const pendingUsers = users.filter((u) => u.status === 'pending')
  const otherUsers = users.filter((u) => u.status !== 'pending')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-tight">Admin Portal</h1>
              <p className="text-xs text-slate-400">Signed in as {profile?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!selectedUser && (
              <button
                onClick={loadUsers}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {selectedUser ? (
          <AdminUserInspector
            user={selectedUser}
            onBack={() => setSelectedUserId(null)}
            onUserUpdated={handleUserUpdated}
          />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-3 mb-6">
              <button
                onClick={() => setActiveTab('pending')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Pending Requests</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === 'pending'
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {pendingUsers.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>All Users</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === 'users'
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {otherUsers.length}
                </span>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-sm text-slate-400">Loading users...</div>
            ) : activeTab === 'pending' ? (
              pendingUsers.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                  No pending registration requests right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-white">{u.full_name}</h2>
                          <StatusBadge status={u.status} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-300">
                          <p>
                            <span className="text-slate-500">Mobile:</span> {u.mobile_number}
                          </p>
                          <p>
                            <span className="text-slate-500">Status:</span> {u.employment_status}
                          </p>
                          <p>
                            <span className="text-slate-500">Doing now:</span>{' '}
                            {u.current_activity || '—'}
                          </p>
                          <p>
                            <span className="text-slate-500">Month starts:</span>{' '}
                            {ordinal(u.month_start_day)}
                          </p>
                        </div>

                        <div className="pt-1">
                          <p className="text-xs text-slate-500 mb-0.5">
                            Why they want to register:
                          </p>
                          <p className="text-slate-200 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                            {u.registration_reason || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => updateUserStatus(u.id, 'approved')}
                          disabled={busyId === u.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>

                        <button
                          onClick={() => updateUserStatus(u.id, 'rejected')}
                          disabled={busyId === u.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-medium px-4 py-2 text-sm hover:bg-red-500/25 disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : otherUsers.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                No processed users yet.
              </div>
            ) : (
              <div className="space-y-3">
                {otherUsers.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-white">{u.full_name}</h2>
                        <StatusBadge status={u.status} />
                      </div>
                      <p className="text-slate-400">
                        {u.mobile_number} · {u.employment_status} ({u.current_activity || '—'}) ·
                        Cycle starts {ordinal(u.month_start_day)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedUserId(u.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold px-3.5 py-2 text-xs sm:text-sm hover:bg-amber-300 cursor-pointer"
                      >
                        <FolderKanban className="w-4 h-4" />
                        Manage Data
                      </button>

                      {u.status === 'approved' ? (
                        <button
                          onClick={() => updateUserStatus(u.id, 'disabled')}
                          disabled={busyId === u.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 text-xs sm:text-sm hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                        >
                          <UserX className="w-4 h-4" />
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => updateUserStatus(u.id, 'approved')}
                          disabled={busyId === u.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-2 text-xs sm:text-sm hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          {u.status === 'rejected' ? 'Approve' : 'Re-enable'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
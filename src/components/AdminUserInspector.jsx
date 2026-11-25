import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  EXPENSE_CATEGORIES,
  calculatePlanMetrics,
  formatCycleLabel,
  formatDateShort,
  formatINR,
  getCycleForDate,
  getIstToday,
} from '../lib/budgetEngine'
import AdminResetPasswordCard from './AdminResetPasswordCard'

const EMPLOYMENT_OPTIONS = ['Student', 'Employed', 'Self-employed', 'Others']

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function AdminUserInspector({ user, onBack, onUserUpdated }) {
  const todayYmd = getIstToday()

  // Profile editor state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name,
    employment_status: user.employment_status,
    current_activity: user.current_activity || '',
    month_start_day: String(user.month_start_day),
    status: user.status,
  })

  // Plans & cycle data
  const [plans, setPlans] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [topups, setTopups] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Plan edit form
  const [planForm, setPlanForm] = useState(null)

  // New plan creation form (when user has no plan for active cycle)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [newPlanForm, setNewPlanForm] = useState({
    base_budget: '',
    initial_emergency_reserve: '0',
    prev_pool_rollover: '0',
    prev_emergency_carry: '0',
  })

  // Fixed expense add / edit
  const [newFixed, setNewFixed] = useState({ title: '', amount: '', is_mid_month: false })
  const [editFixedId, setEditFixedId] = useState(null)
  const [editFixedForm, setEditFixedForm] = useState({ title: '', amount: '' })

  // Top-up add / edit
  const [newTopup, setNewTopup] = useState({ total_amount: '', note: '' })
  const [editTopupId, setEditTopupId] = useState(null)
  const [editTopupForm, setEditTopupForm] = useState({ total_amount: '', note: '' })

  // Expense add / edit
  const [newExp, setNewExp] = useState({
    expense_date: todayYmd,
    amount: '',
    category: 'Food',
    payment_mode: 'UPI',
    expense_type: 'regular',
    note: '',
  })
  const [editExpId, setEditExpId] = useState(null)
  const [editExpForm, setEditExpForm] = useState({})

  const activeCycle = useMemo(
    () => getCycleForDate(todayYmd, user.month_start_day),
    [todayYmd, user.month_start_day]
  )

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  )

  const loadPlanChildren = useCallback(async (plan) => {
    if (!plan) {
      setFixedExpenses([])
      setTopups([])
      setExpenses([])
      setPlanForm(null)
      return
    }

    setPlanForm({
      base_budget: String(plan.base_budget),
      initial_emergency_reserve: String(plan.initial_emergency_reserve),
      prev_pool_rollover: String(plan.prev_pool_rollover),
      prev_emergency_carry: String(plan.prev_emergency_carry),
      is_closed: Boolean(plan.is_closed),
    })

    const defaultExpDate =
      todayYmd >= plan.cycle_start_date && todayYmd <= plan.cycle_end_date
        ? todayYmd
        : plan.cycle_start_date
    setNewExp((prev) => ({ ...prev, expense_date: defaultExpDate }))

    const [fixedRes, topupRes, expRes] = await Promise.all([
      supabase
        .from('fixed_expenses')
        .select('*')
        .eq('plan_id', plan.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('budget_topups')
        .select('*')
        .eq('plan_id', plan.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .eq('plan_id', plan.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (fixedRes.error) throw fixedRes.error
    if (topupRes.error) throw topupRes.error
    if (expRes.error) throw expRes.error

    setFixedExpenses(fixedRes.data || [])
    setTopups(topupRes.data || [])
    setExpenses(expRes.data || [])
  }, [todayYmd])

  const loadUserPlans = useCallback(async (keepPlanId) => {
    setLoading(true)
    setError('')
    try {
      const { data, error: plansErr } = await supabase
        .from('monthly_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('cycle_start_date', { ascending: false })

      if (plansErr) throw plansErr

      const list = data || []
      setPlans(list)

      const target =
        list.find((p) => p.id === (keepPlanId || selectedPlanId)) || list[0] || null
      setSelectedPlanId(target ? target.id : '')
      await loadPlanChildren(target)
    } catch (err) {
      setError(err.message || 'Failed to load user data.')
    } finally {
      setLoading(false)
    }
  }, [user.id, selectedPlanId, loadPlanChildren])

  useEffect(() => {
    loadUserPlans()
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(() => {
    if (!selectedPlan) return null
    return calculatePlanMetrics({
      plan: selectedPlan,
      fixedExpenses,
      topups,
      expenses,
      todayYmd,
    })
  }, [selectedPlan, fixedExpenses, topups, expenses, todayYmd])

  function flashNotice(msg) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  async function handleSelectPlan(planId) {
    setSelectedPlanId(planId)
    const found = plans.find((p) => p.id === planId) || null
    setLoading(true)
    setError('')
    try {
      await loadPlanChildren(found)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 1. PROFILE UPDATE
  async function handleSaveProfile(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const payload = {
      full_name: profileForm.full_name.trim(),
      employment_status: profileForm.employment_status,
      current_activity: profileForm.current_activity.trim(),
      month_start_day: Number(profileForm.month_start_day),
      status: profileForm.status,
    }

    const { data, error: err } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single()

    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onUserUpdated(data)
    setEditingProfile(false)
    flashNotice('User profile updated.')
  }

  // 2. PLAN CREATE / UPDATE / DELETE
  async function handleCreatePlan(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: err } = await supabase
      .from('monthly_plans')
      .insert({
        user_id: user.id,
        cycle_start_date: activeCycle.startDate,
        cycle_end_date: activeCycle.endDate,
        base_budget: Number(newPlanForm.base_budget || 0),
        initial_emergency_reserve: Number(newPlanForm.initial_emergency_reserve || 0),
        prev_pool_rollover: Number(newPlanForm.prev_pool_rollover || 0),
        prev_emergency_carry: Number(newPlanForm.prev_emergency_carry || 0),
      })
      .select()
      .single()

    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setShowCreatePlan(false)
    setNewPlanForm({
      base_budget: '',
      initial_emergency_reserve: '0',
      prev_pool_rollover: '0',
      prev_emergency_carry: '0',
    })
    await loadUserPlans(data.id)
    flashNotice('Monthly cycle plan created.')
  }

  async function handleSavePlan(e) {
    e.preventDefault()
    if (!selectedPlan || !planForm) return
    setBusy(true)
    setError('')

    const { error: err } = await supabase
      .from('monthly_plans')
      .update({
        base_budget: Number(planForm.base_budget || 0),
        initial_emergency_reserve: Number(planForm.initial_emergency_reserve || 0),
        prev_pool_rollover: Number(planForm.prev_pool_rollover || 0),
        prev_emergency_carry: Number(planForm.prev_emergency_carry || 0),
        is_closed: Boolean(planForm.is_closed),
      })
      .eq('id', selectedPlan.id)

    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadUserPlans(selectedPlan.id)
    flashNotice('Monthly plan updated.')
  }

  async function handleDeletePlan() {
    if (!selectedPlan) return
    const ok = window.confirm(
      `Delete the entire cycle (${formatCycleLabel(
        selectedPlan.cycle_start_date,
        selectedPlan.cycle_end_date
      )}) including all its expenses, fixed bills, and top-ups? This cannot be undone.`
    )
    if (!ok) return

    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('monthly_plans')
      .delete()
      .eq('id', selectedPlan.id)
    setBusy(false)

    if (err) {
      setError(err.message)
      return
    }
    await loadUserPlans('')
    flashNotice('Cycle plan deleted.')
  }

  // 3. FIXED EXPENSES CRUD
  async function handleAddFixed(e) {
    e.preventDefault()
    if (!selectedPlan || !newFixed.title.trim() || Number(newFixed.amount) <= 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('fixed_expenses').insert({
      plan_id: selectedPlan.id,
      user_id: user.id,
      title: newFixed.title.trim(),
      amount: Number(newFixed.amount),
      is_mid_month: Boolean(newFixed.is_mid_month),
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewFixed({ title: '', amount: '', is_mid_month: false })
    await loadUserPlans(selectedPlan.id)
    flashNotice('Fixed bill added.')
  }

  async function handleSaveFixed(id) {
    if (!editFixedForm.title.trim() || Number(editFixedForm.amount) <= 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('fixed_expenses')
      .update({
        title: editFixedForm.title.trim(),
        amount: Number(editFixedForm.amount),
      })
      .eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setEditFixedId(null)
    await loadUserPlans(selectedPlan.id)
    flashNotice('Fixed bill updated.')
  }

  async function handleDeleteFixed(id) {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('fixed_expenses').delete().eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadUserPlans(selectedPlan.id)
    flashNotice('Fixed bill deleted.')
  }

  // 4. TOP-UPS CRUD
  async function handleAddTopup(e) {
    e.preventDefault()
    if (!selectedPlan || Number(newTopup.total_amount) <= 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('budget_topups').insert({
      plan_id: selectedPlan.id,
      user_id: user.id,
      total_amount: Number(newTopup.total_amount),
      note: newTopup.note.trim(),
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewTopup({ total_amount: '', note: '' })
    await loadUserPlans(selectedPlan.id)
    flashNotice('Budget top-up added (80/20 split applied).')
  }

  async function handleSaveTopup(id) {
    if (Number(editTopupForm.total_amount) <= 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('budget_topups')
      .update({
        total_amount: Number(editTopupForm.total_amount),
        note: editTopupForm.note.trim(),
      })
      .eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setEditTopupId(null)
    await loadUserPlans(selectedPlan.id)
    flashNotice('Top-up updated.')
  }

  async function handleDeleteTopup(id) {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('budget_topups').delete().eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadUserPlans(selectedPlan.id)
    flashNotice('Top-up deleted.')
  }

  // 5. EXPENSES CRUD (unrestricted dates, marks edited_by_admin = true)
  async function handleAddExpense(e) {
    e.preventDefault()
    if (!selectedPlan || Number(newExp.amount) <= 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('expenses').insert({
      plan_id: selectedPlan.id,
      user_id: user.id,
      expense_date: newExp.expense_date,
      amount: Number(newExp.amount),
      category: newExp.category,
      payment_mode: newExp.payment_mode,
      expense_type: newExp.expense_type,
      is_zero_spend: false,
      note: newExp.note.trim(),
      edited_by_admin: true,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewExp((prev) => ({ ...prev, amount: '', note: '' }))
    await loadUserPlans(selectedPlan.id)
    flashNotice('Expense added by Admin.')
  }

  function startEditExpense(exp) {
    setEditExpId(exp.id)
    setEditExpForm({
      expense_date: exp.expense_date,
      amount: String(exp.amount),
      category: exp.is_zero_spend ? 'Food' : exp.category,
      payment_mode: exp.payment_mode,
      expense_type: exp.expense_type,
      note: exp.note || '',
    })
  }

  async function handleSaveExpense(id) {
    if (Number(editExpForm.amount) < 0) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('expenses')
      .update({
        expense_date: editExpForm.expense_date,
        amount: Number(editExpForm.amount),
        category: editExpForm.category,
        payment_mode: editExpForm.payment_mode,
        expense_type: editExpForm.expense_type,
        is_zero_spend: false,
        note: editExpForm.note.trim(),
        edited_by_admin: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setEditExpId(null)
    await loadUserPlans(selectedPlan.id)
    flashNotice('Expense updated by Admin.')
  }

  async function handleDeleteExpense(id) {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadUserPlans(selectedPlan.id)
    flashNotice('Expense deleted.')
  }

  const hasCurrentCyclePlan = plans.some(
    (p) => p.cycle_start_date === activeCycle.startDate
  )

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-200 hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <button
          type="button"
          onClick={() => loadUserPlans(selectedPlanId)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-200 hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Reload Data
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* FULL USER PROFILE CARD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{user.full_name}</h2>
            <p className="text-sm text-slate-400">
              Mobile ID: <strong className="text-slate-200">{user.mobile_number}</strong> · Joined{' '}
              {formatDateShort(user.created_at.slice(0, 10))}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditingProfile((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            {editingProfile ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editingProfile ? 'Cancel Edit' : 'Edit Profile / Start Day'}
          </button>
        </div>

        {editingProfile ? (
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.full_name}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, full_name: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Employment Status</label>
              <select
                value={profileForm.employment_status}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, employment_status: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">What they are doing now</label>
              <input
                type="text"
                value={profileForm.current_activity}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, current_activity: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Month Starting Day (1–28)</label>
              <select
                value={profileForm.month_start_day}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, month_start_day: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {ordinal(day)} of every month
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Account Status</label>
              <select
                value={profileForm.status}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="disabled">disabled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold py-2 text-sm hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm pt-1">
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Employment Status</p>
              <p className="text-slate-200 font-medium mt-0.5">{user.employment_status}</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Doing Now</p>
              <p className="text-slate-200 font-medium mt-0.5">{user.current_activity || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Month Starting Day</p>
              <p className="text-slate-200 font-medium mt-0.5">
                {ordinal(user.month_start_day)} ({formatCycleLabel(activeCycle.startDate, activeCycle.endDate)})
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Account Status</p>
              <p className="text-slate-200 font-medium capitalize mt-0.5">{user.status}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Registration Reason</p>
              <p className="text-slate-200 mt-0.5">{user.registration_reason || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* RESET USER PASSWORD */}
      <AdminResetPasswordCard user={user} />

      {/* CYCLE PICKER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Select Cycle:
          </label>
          {plans.length > 0 ? (
            <select
              value={selectedPlanId}
              onChange={(e) => handleSelectPlan(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatCycleLabel(p.cycle_start_date, p.cycle_end_date)}{' '}
                  {p.is_closed ? '(Closed)' : '(Open)'}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-400">No monthly plans created yet.</span>
          )}
        </div>

        {!hasCurrentCyclePlan && (
          <button
            type="button"
            onClick={() => setShowCreatePlan((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold px-3.5 py-2 text-xs sm:text-sm hover:bg-amber-300 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Current Cycle ({formatCycleLabel(activeCycle.startDate, activeCycle.endDate)})
          </button>
        )}
      </div>

      {/* OPTIONAL CREATE NEW CYCLE FORM */}
      {showCreatePlan && (
        <form
          onSubmit={handleCreatePlan}
          className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 space-y-4"
        >
          <h3 className="font-semibold text-white">
            Create Plan for {formatCycleLabel(activeCycle.startDate, activeCycle.endDate)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base Budget (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newPlanForm.base_budget}
                onChange={(e) =>
                  setNewPlanForm((p) => ({ ...p, base_budget: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Initial Emergency (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newPlanForm.initial_emergency_reserve}
                onChange={(e) =>
                  setNewPlanForm((p) => ({ ...p, initial_emergency_reserve: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Prev Pool Rollover (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newPlanForm.prev_pool_rollover}
                onChange={(e) =>
                  setNewPlanForm((p) => ({ ...p, prev_pool_rollover: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Prev Emergency Carry (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newPlanForm.prev_emergency_carry}
                onChange={(e) =>
                  setNewPlanForm((p) => ({ ...p, prev_emergency_carry: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-amber-400 text-slate-950 font-semibold px-4 py-2 text-sm hover:bg-amber-300 cursor-pointer"
            >
              Create Plan
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePlan(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading cycle records...</div>
      ) : selectedPlan && metrics ? (
        <>
          {/* LIVE METRICS SUMMARY */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Spendable Pool</p>
              <p className="text-lg font-semibold text-white mt-0.5">
                {formatINR(metrics.spendablePool)}
              </p>
              <p className="text-xs text-slate-500">
                Today Cap: {formatINR(metrics.todayCap)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Remaining Pool</p>
              <p
                className={`text-lg font-semibold mt-0.5 ${
                  metrics.remainingPool < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {formatINR(metrics.remainingPool)}
              </p>
              <p className="text-xs text-slate-500">
                Spent: {formatINR(metrics.totalRegularSpent)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Emergency Vault</p>
              <p className="text-lg font-semibold text-amber-400 mt-0.5">
                {formatINR(metrics.rawEmergencyBalance)}
              </p>
              <p className="text-xs text-slate-500">
                Used: {formatINR(metrics.totalEmergencySpent)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Fixed Bills / Top-Ups</p>
              <p className="text-lg font-semibold text-white mt-0.5">
                -{formatINR(metrics.totalFixed)}
              </p>
              <p className="text-xs text-emerald-400">
                +{formatINR(metrics.totalTopups)} top-ups
              </p>
            </div>
          </div>

          {/* EDIT MONTHLY PLAN NUMBERS */}
          {planForm && (
            <form
              onSubmit={handleSavePlan}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-white">Edit Monthly Plan Values</h3>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-500/25 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Entire Cycle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Base Budget (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={planForm.base_budget}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, base_budget: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Initial Emergency (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={planForm.initial_emergency_reserve}
                    onChange={(e) =>
                      setPlanForm((p) => ({
                        ...p,
                        initial_emergency_reserve: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Prev Pool Rollover (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={planForm.prev_pool_rollover}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, prev_pool_rollover: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Prev Emergency Carry (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={planForm.prev_emergency_carry}
                    onChange={(e) =>
                      setPlanForm((p) => ({ ...p, prev_emergency_carry: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white tabular-nums"
                  />
                </div>
                <div className="flex flex-col justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-300 mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.is_closed}
                      onChange={(e) =>
                        setPlanForm((p) => ({ ...p, is_closed: e.target.checked }))
                      }
                    />
                    Cycle Closed / Locked
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold py-2 text-sm hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Save Plan
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* FIXED EXPENSES & TOP-UPS SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Fixed Expenses */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h3 className="font-semibold text-white">
                Fixed Expenses ({fixedExpenses.length})
              </h3>

              <form onSubmit={handleAddFixed} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  required
                  value={newFixed.title}
                  onChange={(e) => setNewFixed((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Bill title"
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
                />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={newFixed.amount}
                  onChange={(e) => setNewFixed((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="₹"
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white tabular-nums"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 text-sm font-medium cursor-pointer"
                >
                  Add
                </button>
              </form>

              {fixedExpenses.length === 0 ? (
                <p className="text-sm text-slate-500">No fixed bills.</p>
              ) : (
                <ul className="divide-y divide-slate-800 text-sm">
                  {fixedExpenses.map((f) => (
                    <li key={f.id} className="py-2.5 flex items-center justify-between gap-2">
                      {editFixedId === f.id ? (
                        <div className="flex flex-1 gap-2 items-center">
                          <input
                            type="text"
                            value={editFixedForm.title}
                            onChange={(e) =>
                              setEditFixedForm((p) => ({ ...p, title: e.target.value }))
                            }
                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editFixedForm.amount}
                            onChange={(e) =>
                              setEditFixedForm((p) => ({ ...p, amount: e.target.value }))
                            }
                            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveFixed(f.id)}
                            className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditFixedId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-slate-200 font-medium">{f.title}</p>
                            <p className="text-xs text-slate-500">
                              {f.is_mid_month ? 'Mid-month' : 'Initial'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white tabular-nums">
                              {formatINR(f.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditFixedId(f.id)
                                setEditFixedForm({ title: f.title, amount: String(f.amount) })
                              }}
                              className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFixed(f.id)}
                              className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Budget Top-Ups */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h3 className="font-semibold text-white">
                Budget Top-Ups ({topups.length})
              </h3>

              <form onSubmit={handleAddTopup} className="flex flex-wrap gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={newTopup.total_amount}
                  onChange={(e) =>
                    setNewTopup((p) => ({ ...p, total_amount: e.target.value }))
                  }
                  placeholder="₹ Amount"
                  className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white tabular-nums"
                />
                <input
                  type="text"
                  value={newTopup.note}
                  onChange={(e) => setNewTopup((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Note (optional)"
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-sm font-medium cursor-pointer"
                >
                  Add
                </button>
              </form>

              {topups.length === 0 ? (
                <p className="text-sm text-slate-500">No top-ups recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-800 text-sm">
                  {topups.map((t) => (
                    <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                      {editTopupId === t.id ? (
                        <div className="flex flex-1 gap-2 items-center">
                          <input
                            type="number"
                            step="0.01"
                            value={editTopupForm.total_amount}
                            onChange={(e) =>
                              setEditTopupForm((p) => ({
                                ...p,
                                total_amount: e.target.value,
                              }))
                            }
                            className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white tabular-nums"
                          />
                          <input
                            type="text"
                            value={editTopupForm.note}
                            onChange={(e) =>
                              setEditTopupForm((p) => ({ ...p, note: e.target.value }))
                            }
                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTopup(t.id)}
                            className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTopupId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-slate-200 font-medium">
                              {t.note || 'Budget Top-Up'}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              +{formatINR(t.spendable_share)} daily · +
                              {formatINR(t.emergency_share)} emergency
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-400 tabular-nums">
                              +{formatINR(t.total_amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditTopupId(t.id)
                                setEditTopupForm({
                                  total_amount: String(t.total_amount),
                                  note: t.note || '',
                                })
                              }}
                              className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTopup(t.id)}
                              className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* FULL EXPENSES MANAGER (NO DATE LOCK) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-white">
                All Expenses in Cycle ({expenses.length})
              </h3>
              <p className="text-xs text-slate-400">
                Admin can add, edit, or delete entries for any date. Modified rows are tagged
                as Edited by Admin.
              </p>
            </div>

            {/* Admin Add Expense Row */}
            <form
              onSubmit={handleAddExpense}
              className="grid grid-cols-2 sm:grid-cols-6 gap-2 rounded-xl bg-slate-950/70 border border-slate-800 p-3"
            >
              <input
                type="date"
                required
                min={selectedPlan.cycle_start_date}
                max={selectedPlan.cycle_end_date}
                value={newExp.expense_date}
                onChange={(e) =>
                  setNewExp((p) => ({ ...p, expense_date: e.target.value }))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={newExp.amount}
                onChange={(e) => setNewExp((p) => ({ ...p, amount: e.target.value }))}
                placeholder="₹ Amount"
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white tabular-nums"
              />
              <select
                value={newExp.category}
                onChange={(e) => setNewExp((p) => ({ ...p, category: e.target.value }))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newExp.expense_type}
                onChange={(e) =>
                  setNewExp((p) => ({ ...p, expense_type: e.target.value }))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="regular">Regular</option>
                <option value="emergency">Emergency</option>
              </select>
              <select
                value={newExp.payment_mode}
                onChange={(e) =>
                  setNewExp((p) => ({ ...p, payment_mode: e.target.value }))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs py-1.5 hover:bg-amber-300 cursor-pointer"
              >
                + Add Entry
              </button>
              <input
                type="text"
                value={newExp.note}
                onChange={(e) => setNewExp((p) => ({ ...p, note: e.target.value }))}
                placeholder="Optional note..."
                className="col-span-2 sm:col-span-6 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              />
            </form>

            {expenses.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No expenses recorded in this cycle.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800 text-sm">
                {expenses.map((exp) => (
                  <li key={exp.id} className="py-3">
                    {editExpId === exp.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <input
                            type="date"
                            value={editExpForm.expense_date}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, expense_date: e.target.value }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editExpForm.amount}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, amount: e.target.value }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white tabular-nums"
                          />
                          <select
                            value={editExpForm.category}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, category: e.target.value }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editExpForm.expense_type}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, expense_type: e.target.value }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          >
                            <option value="regular">Regular</option>
                            <option value="emergency">Emergency</option>
                          </select>
                          <select
                            value={editExpForm.payment_mode}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, payment_mode: e.target.value }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          >
                            <option value="UPI">UPI</option>
                            <option value="Cash">Cash</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editExpForm.note}
                            onChange={(e) =>
                              setEditExpForm((p) => ({ ...p, note: e.target.value }))
                            }
                            placeholder="Note"
                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveExpense(exp.id)}
                            className="px-3 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditExpId(null)}
                            className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-white">
                              {exp.is_zero_spend ? '₹0 Spend Day' : exp.category}
                            </span>
                            {exp.expense_type === 'emergency' && (
                              <span className="text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                                Emergency
                              </span>
                            )}
                            {!exp.is_zero_spend && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                {exp.payment_mode}
                              </span>
                            )}
                            {exp.edited_by_admin && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                Admin Edited
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDateShort(exp.expense_date)}
                            {exp.note ? ` · ${exp.note}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-semibold tabular-nums ${
                              exp.expense_type === 'emergency'
                                ? 'text-amber-400'
                                : 'text-white'
                            }`}
                          >
                            {formatINR(exp.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditExpense(exp)}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            title="Edit expense"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
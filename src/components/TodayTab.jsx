import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Pencil,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import {
  EXPENSE_CATEGORIES,
  addDays,
  canUserEditExpense,
  formatDateShort,
  formatINR,
  round2,
} from '../lib/budgetEngine'

const QUICK_AMOUNTS = [20, 50, 100, 200]

export default function TodayTab({ tracker }) {
  const {
    todayYmd,
    selectedPlan,
    expenses,
    metrics,
    addExpense,
    updateExpense,
    deleteExpense,
  } = tracker

  const yesterdayYmd = addDays(todayYmd, -1)
  const canLogYesterday =
    selectedPlan &&
    !selectedPlan.is_closed &&
    metrics.isTodayInCycle &&
    yesterdayYmd >= selectedPlan.cycle_start_date

  // Quick Add state
  const [expenseType, setExpenseType] = useState('regular')
  const [expenseDate, setExpenseDate] = useState(todayYmd)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit / Delete state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [actionBusyId, setActionBusyId] = useState(null)
  const [listError, setListError] = useState('')

  const canAddNow = selectedPlan && !selectedPlan.is_closed && metrics.isTodayInCycle

  function handlePresetAdd(val) {
    const current = Number(amount || 0)
    setAmount(String(round2(current + val)))
  }

  async function handleQuickAdd(e) {
    e.preventDefault()
    setFormError('')

    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setFormError('Enter an amount greater than 0.')
      return
    }

    const targetDate = canLogYesterday ? expenseDate : todayYmd
    setSubmitting(true)

    // If logging a regular expense on a day previously marked as zero-spend, remove the zero-spend marker
    if (expenseType === 'regular') {
      const existingZero = expenses.find(
        (item) => item.expense_date === targetDate && item.is_zero_spend
      )
      if (existingZero) {
        await deleteExpense(existingZero.id)
      }
    }

    const res = await addExpense({
      expenseDate: targetDate,
      amount: numAmount,
      category,
      paymentMode,
      expenseType,
      isZeroSpend: false,
      note,
    })

    setSubmitting(false)

    if (res.error) {
      setFormError(res.error)
      return
    }

    setAmount('')
    setNote('')
  }

  async function handleMarkZeroSpend() {
    setFormError('')
    setSubmitting(true)
    const res = await addExpense({
      expenseDate: todayYmd,
      isZeroSpend: true,
      note: 'No spend today',
    })
    setSubmitting(false)
    if (res.error) setFormError(res.error)
  }

  function startEditing(item) {
    setListError('')
    setConfirmDeleteId(null)
    setEditingId(item.id)
    setEditForm({
      amount: String(item.amount),
      category: item.category,
      paymentMode: item.payment_mode,
      expenseType: item.expense_type,
      note: item.note || '',
    })
  }

  async function saveEdit(itemId) {
    setListError('')
    const numAmt = Number(editForm.amount)
    if (!numAmt || numAmt <= 0) {
      setListError('Edited amount must be greater than 0.')
      return
    }
    setActionBusyId(itemId)
    const res = await updateExpense(itemId, editForm)
    setActionBusyId(null)
    if (res.error) {
      setListError(res.error)
      return
    }
    setEditingId(null)
  }

  async function handleConfirmDelete(itemId) {
    setListError('')
    setActionBusyId(itemId)
    const res = await deleteExpense(itemId)
    setActionBusyId(null)
    if (res.error) {
      setListError(res.error)
      return
    }
    setConfirmDeleteId(null)
  }

  // Daily progress color logic (<75% green, 75-100% amber, >100% red)
  const capPct =
    metrics.todayCap > 0
      ? Math.round((metrics.spentToday / metrics.todayCap) * 100)
      : metrics.spentToday > 0
        ? 100
        : 0

  const barColor =
    metrics.isOverMonthlyPool || capPct > 100
      ? 'bg-red-500'
      : capPct >= 75
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  const remainingColor =
    metrics.isOverMonthlyPool || metrics.todayRemaining < 0
      ? 'text-red-600'
      : capPct >= 75
        ? 'text-amber-600'
        : 'text-emerald-700'

  // Split log into Editable (Today & Yesterday) vs Locked (Older)
  const recentWindowItems = expenses.filter((item) =>
    canUserEditExpense(item.expense_date, todayYmd)
  )
  const olderItems = expenses.filter(
    (item) => !canUserEditExpense(item.expense_date, todayYmd)
  )

  return (
    <div className="space-y-5">
      {/* Over-budget alert */}
      {metrics.isOverMonthlyPool && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold">
              Over monthly spendable pool by {formatINR(metrics.monthlyOverspend)}
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              You can still log expenses. Up to 50% of your Emergency Vault will automatically
              rescue this deficit at cycle end.
            </p>
          </div>
        </div>
      )}

      {/* Past cycle notice */}
      {!canAddNow && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-slate-500" />
          <span>
            You are viewing a past or closed cycle. Switch back to your current cycle in the top
            bar to log today&apos;s expenses.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Daily Gauge + Quick Add */}
        <div className="lg:col-span-5 space-y-5">
          {/* Today's Allowance Gauge */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 tabular-nums">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Today · {formatDateShort(todayYmd)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Day {metrics.daysElapsed} of {metrics.totalCycleDays} ·{' '}
                  <strong>{metrics.daysRemainingIncludingToday}</strong>{' '}
                  {metrics.daysRemainingIncludingToday === 1 ? 'day' : 'days'} left in cycle
                </p>
              </div>
              <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                Cap {formatINR(metrics.todayCap)}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500">Remaining Today</p>
              <p className={`text-3xl font-bold mt-0.5 ${remainingColor}`}>
                {formatINR(metrics.todayRemaining)}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(100, Math.max(0, capPct))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Spent today: {formatINR(metrics.spentToday)}</span>
                <span>{capPct}% of cap</span>
              </div>
            </div>

            {metrics.emergencySpentToday > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                Emergency spent today: <strong>{formatINR(metrics.emergencySpentToday)}</strong>{' '}
                (deducted from Emergency Vault, not today&apos;s cap)
              </p>
            )}

            {/* Zero Spend Day button / status */}
            {canAddNow && metrics.spentToday === 0 && (
              metrics.hasZeroSpendToday ? (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Marked as a ₹0 Spend Day</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkZeroSpend}
                  disabled={submitting}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  Mark Today as ₹0 Spend Day
                </button>
              )
            )}
          </div>

          {/* Quick Add Expense Form */}
          {canAddNow && (
            <form
              onSubmit={handleQuickAdd}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">Quick Add Expense</h3>

                {/* Regular vs Emergency Switch */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setExpenseType('regular')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      expenseType === 'regular'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType('emergency')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      expenseType === 'emergency'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Emergency
                  </button>
                </div>
              </div>

              {expenseType === 'emergency' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  Deducts from Emergency Vault ({formatINR(metrics.rawEmergencyBalance)} available).
                </p>
              )}

              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {/* Amount + Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">Amount (₹)</label>
                  {canLogYesterday && (
                    <div className="inline-flex rounded-md border border-slate-200 text-[11px] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpenseDate(todayYmd)}
                        className={`px-2 py-0.5 cursor-pointer ${
                          expenseDate === todayYmd
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseDate(yesterdayYmd)}
                        className={`px-2 py-0.5 cursor-pointer ${
                          expenseDate === yesterdayYmd
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600'
                        }`}
                      >
                        Yesterday
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xl font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
                />

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePresetAdd(val)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 tabular-nums cursor-pointer"
                    >
                      +₹{val}
                    </button>
                  ))}
                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Category Chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                        category === cat
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode & Note */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                  {['UPI', 'Cash'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`flex-1 py-2 cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50 cursor-pointer ${
                  expenseType === 'emergency'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {submitting
                  ? 'Saving...'
                  : expenseType === 'emergency'
                    ? 'Log Emergency Expense'
                    : 'Add Expense'}
              </button>
            </form>
          )}
        </div>

        {/* RIGHT COLUMN: Mini Pool Strip + Expense Feed */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Context Strip */}
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Remaining Monthly Pool</p>
              <p
                className={`text-lg sm:text-xl font-semibold mt-0.5 ${
                  metrics.remainingPool < 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatINR(metrics.remainingPool)}
              </p>
              <p className="text-xs text-slate-400">of {formatINR(metrics.spendablePool)}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Emergency Vault</p>
              <p className="text-lg sm:text-xl font-semibold text-amber-700 mt-0.5">
                {formatINR(metrics.rawEmergencyBalance)}
              </p>
              <p className="text-xs text-slate-400">
                Used {formatINR(metrics.totalEmergencySpent)}
              </p>
            </div>
          </div>

          {listError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {listError}
            </div>
          )}

          {/* Editable Window List (Today & Yesterday) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                Today &amp; Yesterday ({recentWindowItems.length})
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5" /> Editable until next day 11:59 PM
              </span>
            </div>

            {recentWindowItems.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No entries recorded for today or yesterday yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentWindowItems.map((item) => {
                  const isEditing = editingId === item.id
                  const isConfirmingDelete = confirmDeleteId === item.id
                  const isToday = item.expense_date === todayYmd

                  if (isEditing) {
                    return (
                      <li key={item.id} className="py-3 space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, amount: e.target.value }))
                            }
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold tabular-nums"
                          />
                          <select
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.paymentMode}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, paymentMode: e.target.value }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                          >
                            <option value="UPI">UPI</option>
                            <option value="Cash">Cash</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            value={editForm.expenseType}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, expenseType: e.target.value }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                          >
                            <option value="regular">Regular Pool</option>
                            <option value="emergency">Emergency Vault</option>
                          </select>
                          <input
                            type="text"
                            value={editForm.note}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, note: e.target.value }))
                            }
                            placeholder="Note"
                            className="sm:col-span-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionBusyId === item.id}
                            onClick={() => saveEdit(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                        </div>
                      </li>
                    )
                  }

                  return (
                    <li
                      key={item.id}
                      className="py-3 flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-900">
                            {item.is_zero_spend ? '₹0 Spend Day' : item.category}
                          </span>
                          {item.expense_type === 'emergency' && (
                            <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              Emergency
                            </span>
                          )}
                          {!item.is_zero_spend && (
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {item.payment_mode}
                            </span>
                          )}
                          {item.edited_by_admin && (
                            <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                              Edited by Admin
                            </span>
                          )}
                        </div>

                        {item.note && (
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{item.note}</p>
                        )}

                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isToday
                            ? 'Today · Editable until tomorrow 11:59 PM'
                            : 'Yesterday · Locks tonight 11:59 PM'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-semibold tabular-nums ${
                            item.expense_type === 'emergency'
                              ? 'text-amber-700'
                              : item.is_zero_spend
                                ? 'text-emerald-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {formatINR(item.amount)}
                        </span>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={actionBusyId === item.id}
                              onClick={() => handleConfirmDelete(item.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-medium hover:bg-red-700 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-medium cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {!item.is_zero_spend && !item.edited_by_admin && (
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                                setConfirmDeleteId(item.id)
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Earlier Locked Entries in this Cycle */}
          {olderItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">
                  Earlier This Cycle ({olderItems.length})
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              </div>

              <ul className="divide-y divide-slate-100">
                {olderItems.slice(0, 15).map((item) => (
                  <li
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-800">
                          {item.is_zero_spend ? '₹0 Spend Day' : item.category}
                        </span>
                        {item.expense_type === 'emergency' && (
                          <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Emergency
                          </span>
                        )}
                        {!item.is_zero_spend && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {item.payment_mode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {formatDateShort(item.expense_date)}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-700 tabular-nums shrink-0">
                      {formatINR(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
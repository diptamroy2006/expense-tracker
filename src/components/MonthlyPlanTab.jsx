import { useState } from 'react'
import { Lock, Plus, Receipt, ShieldAlert, Trash2, TrendingUp } from 'lucide-react'
import {
  daysBetweenInclusive,
  formatCycleLabel,
  formatDateShort,
  formatINR,
  round2,
} from '../lib/budgetEngine'

export default function MonthlyPlanTab({ tracker }) {
  const {
    activeCycle,
    selectedCycleStart,
    selectedPlan,
    fixedExpenses,
    topups,
    prevRollover,
    metrics,
    createMonthlyPlan,
    addTopup,
    addFixedExpense,
  } = tracker

  // Setup state (when no plan exists for current cycle)
  const [baseBudget, setBaseBudget] = useState('')
  const [initialEmergency, setInitialEmergency] = useState('')
  const [initialFixed, setInitialFixed] = useState([{ title: '', amount: '' }])
  const [setupError, setSetupError] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)

  // Top-up state
  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupMsg, setTopupMsg] = useState('')
  const [topupBusy, setTopupBusy] = useState(false)

  // Mid-month fixed expense state
  const [midTitle, setMidTitle] = useState('')
  const [midAmount, setMidAmount] = useState('')
  const [midMsg, setMidMsg] = useState('')
  const [midBusy, setMidBusy] = useState(false)

  const isViewingCurrentCycle = selectedCycleStart === activeCycle.startDate

  function updateFixedRow(idx, field, value) {
    setInitialFixed((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )
  }

  function addFixedRow() {
    setInitialFixed((prev) => [...prev, { title: '', amount: '' }])
  }

  function removeFixedRow(idx) {
    setInitialFixed((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSetupSubmit(e) {
    e.preventDefault()
    setSetupError('')
    const budgetNum = Number(baseBudget)
    const emgNum = Number(initialEmergency || 0)

    if (!budgetNum || budgetNum <= 0) {
      setSetupError('Enter a valid monthly budget greater than 0.')
      return
    }
    if (emgNum < 0) {
      setSetupError('Emergency reserve cannot be negative.')
      return
    }

    setSetupBusy(true)
    const res = await createMonthlyPlan({
      baseBudget: budgetNum,
      initialEmergencyReserve: emgNum,
      initialFixedList: initialFixed,
    })
    setSetupBusy(false)

    if (res.error) setSetupError(res.error)
  }

  async function handleTopupSubmit(e) {
    e.preventDefault()
    setTopupMsg('')
    const amt = Number(topupAmount)
    if (!amt || amt <= 0) {
      setTopupMsg('Enter an amount greater than 0.')
      return
    }
    setTopupBusy(true)
    const res = await addTopup({ totalAmount: amt, note: topupNote })
    setTopupBusy(false)
    if (res.error) {
      setTopupMsg(res.error)
    } else {
      setTopupAmount('')
      setTopupNote('')
    }
  }

  async function handleMidFixedSubmit(e) {
    e.preventDefault()
    setMidMsg('')
    const amt = Number(midAmount)
    if (!midTitle.trim() || !amt || amt <= 0) {
      setMidMsg('Enter a title and valid amount.')
      return
    }
    setMidBusy(true)
    const res = await addFixedExpense({ title: midTitle, amount: amt })
    setMidBusy(false)
    if (res.error) {
      setMidMsg(res.error)
    } else {
      setMidTitle('')
      setMidAmount('')
    }
  }

  // CASE 1: No plan yet for this cycle -> Show initial monthly setup form
  if (!selectedPlan) {
    const fixedSum = round2(
      initialFixed.reduce((sum, r) => sum + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0)
    )
    const cycleDays = daysBetweenInclusive(activeCycle.startDate, activeCycle.endDate)
    const previewPool = round2(
      Number(baseBudget || 0) -
        fixedSum -
        Number(initialEmergency || 0) +
        prevRollover.poolRollover
    )
    const previewDaily = previewPool > 0 ? round2(previewPool / cycleDays) : 0
    const previewEmergency = round2(
      prevRollover.emergencyCarry + Number(initialEmergency || 0)
    )

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Set Up Monthly Budget</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Active Cycle: <strong className="text-slate-800">{formatCycleLabel(activeCycle.startDate, activeCycle.endDate)}</strong> ({cycleDays} days)
          </p>
        </div>

        {prevRollover.hasPrevious && (
          <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 text-sm space-y-1">
            <p className="font-medium text-slate-800">
              Carry-Forward from Previous Cycle {prevRollover.isLive ? '(Live until lock date)' : '(Locked)'}
            </p>
            <div className="flex flex-wrap gap-6 text-slate-600 tabular-nums">
              <span>
                Spendable Rollover:{' '}
                <strong className={prevRollover.poolRollover < 0 ? 'text-red-600' : 'text-emerald-700'}>
                  {formatINR(prevRollover.poolRollover)}
                </strong>
              </span>
              <span>
                Emergency Carry:{' '}
                <strong className="text-amber-700">{formatINR(prevRollover.emergencyCarry)}</strong>
              </span>
            </div>
          </div>
        )}

        {setupError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {setupError}
          </div>
        )}

        <form onSubmit={handleSetupSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Monthly Budget (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={baseBudget}
                  onChange={(e) => setBaseBudget(e.target.value)}
                  placeholder="e.g., 6000"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Emergency Reserve (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialEmergency}
                  onChange={(e) => setInitialEmergency(e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Initial Fixed Expenses (Rent, Recharge, Subscriptions, etc.)
                </label>
                <button
                  type="button"
                  onClick={addFixedRow}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add row
                </button>
              </div>

              <div className="space-y-2">
                {initialFixed.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateFixedRow(idx, 'title', e.target.value)}
                      placeholder="Bill name (e.g., Mobile Recharge)"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) => updateFixedRow(idx, 'amount', e.target.value)}
                      placeholder="₹ Amount"
                      className="w-28 sm:w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {initialFixed.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFixedRow(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Once saved, the base budget and initial bills lock. You can still add extra money or mid-month fixed bills anytime.
            </p>

            <button
              type="submit"
              disabled={setupBusy}
              className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {setupBusy ? 'Saving Monthly Plan...' : 'Save & Start Cycle'}
            </button>
          </div>

          {/* Live Preview */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 h-fit">
            <h3 className="text-sm font-medium text-slate-300">Live Breakdown Preview</h3>
            <div className="space-y-2.5 text-sm tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Base Budget</span>
                <span>{formatINR(baseBudget || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Fixed Bills</span>
                <span className="text-red-300">-{formatINR(fixedSum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Emergency Reserve</span>
                <span className="text-amber-300">-{formatINR(initialEmergency || 0)}</span>
              </div>
              {prevRollover.hasPrevious && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Prev Cycle Rollover</span>
                  <span>{formatINR(prevRollover.poolRollover)}</span>
                </div>
              )}
              <div className="border-t border-slate-800 pt-2.5 flex justify-between font-semibold text-base">
                <span>Spendable Pool</span>
                <span className={previewPool < 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {formatINR(previewPool)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Starting Daily Cap ({cycleDays} days)</span>
                <span className="font-semibold">{formatINR(previewDaily)} / day</span>
              </div>
              <div className="border-t border-slate-800 pt-2.5 flex justify-between text-xs text-amber-300">
                <span>Total Emergency Vault</span>
                <span className="font-semibold">{formatINR(previewEmergency)}</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    )
  }

  // CASE 2: Plan exists -> Show summary + Top-Up + Mid-Month Fixed Expenses
  const topupNum = Number(topupAmount || 0)
  const previewTopupEmergency = topupNum > 0 ? round2(topupNum * 0.2) : 0
  const previewTopupSpendable = topupNum > 0 ? round2(topupNum - previewTopupEmergency) : 0
  const canModifyOpenPlan = !selectedPlan.is_closed && isViewingCurrentCycle

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Monthly Plan</h2>
          <p className="text-sm text-slate-500">
            {formatCycleLabel(selectedPlan.cycle_start_date, selectedPlan.cycle_end_date)} ·{' '}
            {selectedPlan.is_closed ? 'Closed & Locked' : 'Active Cycle'}
          </p>
        </div>
        {selectedPlan.is_closed && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" /> Read-only History
          </span>
        )}
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 tabular-nums">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Spendable Pool</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {formatINR(metrics.spendablePool)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Base {formatINR(metrics.baseBudget)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Remaining Pool</p>
          <p
            className={`text-xl font-semibold mt-1 ${
              metrics.remainingPool < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatINR(metrics.remainingPool)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Spent {formatINR(metrics.totalRegularSpent)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Emergency Vault</p>
          <p className="text-xl font-semibold text-amber-700 mt-1">
            {formatINR(metrics.rawEmergencyBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Used {formatINR(metrics.totalEmergencySpent)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Fixed Bills</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {formatINR(metrics.totalFixed)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Top-ups +{formatINR(metrics.totalTopups)}
          </p>
        </div>
      </div>

      {/* Closed cycle settlement summary */}
      {selectedPlan.is_closed && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm space-y-1 tabular-nums">
          <p className="font-semibold text-slate-900">Cycle Closing Settlement</p>
          <p className="text-slate-600">
            Carried to next Spendable Pool:{' '}
            <strong>{formatINR(metrics.settlement.finalPoolRollover)}</strong> · Carried to next
            Emergency Vault: <strong>{formatINR(metrics.settlement.finalEmergencyCarry)}</strong>
            {metrics.settlement.rescueUsed > 0 && (
              <>
                {' '}
                · Emergency Rescue Applied:{' '}
                <strong className="text-amber-700">
                  {formatINR(metrics.settlement.rescueUsed)}
                </strong>
              </>
            )}
          </p>
        </div>
      )}

      {/* Actions for Open Cycle: Add Extra Money (80/20) & Add Mid-Month Fixed Expense */}
      {canModifyOpenPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Add Extra Money */}
          <form
            onSubmit={handleTopupSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-900">Add Extra Money to Budget</h3>
            </div>
            <p className="text-xs text-slate-500">
              Automatically splits <strong>20%</strong> into your Emergency Vault and{' '}
              <strong>80%</strong> into your flexible daily Spendable Pool.
            </p>

            {topupMsg && <p className="text-xs text-red-600">{topupMsg}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="₹ Extra amount"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Note (e.g., Pocket money)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {topupNum > 0 && (
              <div className="flex justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 tabular-nums">
                <span className="text-emerald-700">
                  +80% Spendable: <strong>{formatINR(previewTopupSpendable)}</strong>
                </span>
                <span className="text-amber-700">
                  +20% Emergency: <strong>{formatINR(previewTopupEmergency)}</strong>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={topupBusy}
              className="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {topupBusy ? 'Adding...' : 'Add Extra Money'}
            </button>
          </form>

          {/* Add Mid-Month Fixed Expense */}
          <form
            onSubmit={handleMidFixedSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-800" />
              <h3 className="font-semibold text-slate-900">Add Mid-Month Fixed Expense</h3>
            </div>
            <p className="text-xs text-slate-500">
              For an unexpected fixed bill mid-cycle. Immediately deducts from your remaining
              Spendable Pool and adjusts future daily caps.
            </p>

            {midMsg && <p className="text-xs text-red-600">{midMsg}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={midTitle}
                onChange={(e) => setMidTitle(e.target.value)}
                placeholder="Bill name (e.g., Exam Fee)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={midAmount}
                onChange={(e) => setMidAmount(e.target.value)}
                placeholder="₹ Amount"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={midBusy}
              className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {midBusy ? 'Saving...' : 'Add Fixed Expense'}
            </button>
          </form>
        </div>
      )}

      {/* Breakdown Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fixed Expenses List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-900 mb-3">
            Fixed Expenses ({fixedExpenses.length})
          </h3>
          {fixedExpenses.length === 0 ? (
            <p className="text-sm text-slate-400">No fixed expenses added for this cycle.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {fixedExpenses.map((item) => (
                <li key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <span className="text-xs text-slate-400">
                      {item.is_mid_month ? 'Added mid-month' : 'Initial bill'}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatINR(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Budget Top-Ups List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-900 mb-3">
            Extra Money Added ({topups.length})
          </h3>
          {topups.length === 0 ? (
            <p className="text-sm text-slate-400">No extra money added in this cycle.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {topups.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      {t.note || 'Budget Top-Up'}
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      +{formatINR(t.spendable_share)} daily · +{formatINR(t.emergency_share)}{' '}
                      emergency · {formatDateShort(t.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    +{formatINR(t.total_amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rollover Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Initial budget, emergency reserve, fixed bills, and top-ups cannot be edited or deleted by normal users. Contact Admin if a correction is needed.
        </span>
      </div>
    </div>
  )
}
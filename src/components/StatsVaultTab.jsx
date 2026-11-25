import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react'
import {
  addDays,
  formatCycleLabel,
  formatDateShort,
  formatINR,
  getAllDatesInCycle,
  round2,
} from '../lib/budgetEngine'

function csvEscape(val) {
  const str = String(val ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function shortAxisDate(ymd) {
  const [, m, d] = String(ymd).split('-').map(Number)
  return `${d}/${m}`
}

export default function StatsVaultTab({ tracker }) {
  const { todayYmd, selectedPlan, topups, expenses, metrics } = tracker

  // Build daily spend vs dynamic daily cap series
  const chartData = useMemo(() => {
    const allDates = getAllDatesInCycle(
      selectedPlan.cycle_start_date,
      selectedPlan.cycle_end_date
    )

    const spendByDate = new Map()
    for (const e of expenses) {
      if (e.expense_type === 'regular' && !e.is_zero_spend) {
        spendByDate.set(
          e.expense_date,
          round2((spendByDate.get(e.expense_date) || 0) + Number(e.amount || 0))
        )
      }
    }

    let runningPool = metrics.spendablePool
    const totalDays = allDates.length
    const rows = []

    allDates.forEach((ymd, idx) => {
      const daysLeft = totalDays - idx
      const cap = runningPool <= 0 ? 0 : round2(runningPool / daysLeft)
      const spent = ymd <= todayYmd ? spendByDate.get(ymd) || 0 : null

      rows.push({
        ymd,
        label: shortAxisDate(ymd),
        spent,
        cap,
      })

      if (ymd <= todayYmd) {
        runningPool = round2(runningPool - (spendByDate.get(ymd) || 0))
      }
    })

    return rows
  }, [selectedPlan, expenses, metrics.spendablePool, todayYmd])

  // Category breakdown (regular spending only)
  const categoryBreakdown = useMemo(() => {
    const totals = new Map()
    for (const e of expenses) {
      if (e.expense_type === 'regular' && !e.is_zero_spend) {
        totals.set(
          e.category,
          round2((totals.get(e.category) || 0) + Number(e.amount || 0))
        )
      }
    }
    return Array.from(totals.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        pct:
          metrics.totalRegularSpent > 0
            ? Math.round((amount / metrics.totalRegularSpent) * 100)
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, metrics.totalRegularSpent])

  // Burn rate survival message
  const burnSummary = useMemo(() => {
    if (metrics.isOverMonthlyPool) {
      return {
        tone: 'red',
        headline: `Pool exhausted (over by ${formatINR(metrics.monthlyOverspend)})`,
        sub: `At cycle end, up to 50% of Emergency Vault (${formatINR(
          metrics.settlement.rescueUsed
        )} currently) will rescue this deficit.`,
      }
    }
    if (metrics.dailyAverageSpend <= 0) {
      return {
        tone: 'green',
        headline: 'No regular spending recorded yet',
        sub: `Full pool of ${formatINR(metrics.remainingPool)} available for the rest of this cycle.`,
      }
    }
    if (metrics.projectedMonthEndBalance >= 0) {
      return {
        tone: 'green',
        headline: `Projected surplus: ${formatINR(metrics.projectedMonthEndBalance)}`,
        sub: `At ${formatINR(metrics.dailyAverageSpend)}/day average, your budget comfortably lasts the entire cycle.`,
      }
    }

    const daysUntilZero = Math.floor(metrics.remainingPool / metrics.dailyAverageSpend)
    const runOutDate = addDays(todayYmd, Math.max(0, daysUntilZero))
    return {
      tone: 'amber',
      headline: `Budget runs out around ${formatDateShort(runOutDate)}`,
      sub: `At ${formatINR(metrics.dailyAverageSpend)}/day average, projected deficit is ${formatINR(
        Math.abs(metrics.projectedMonthEndBalance)
      )}.`,
    }
  }, [metrics, todayYmd])

  const emergencySpends = useMemo(
    () => expenses.filter((e) => e.expense_type === 'emergency'),
    [expenses]
  )

  const totalPaymentMode = round2(metrics.upiTotal + metrics.cashTotal)
  const upiPct =
    totalPaymentMode > 0 ? Math.round((metrics.upiTotal / totalPaymentMode) * 100) : 0
  const cashPct = totalPaymentMode > 0 ? 100 - upiPct : 0

  function handleExportCsv() {
    const header = [
      'Date',
      'Type',
      'Category',
      'Payment Mode',
      'Amount (INR)',
      'Zero Spend Day',
      'Note',
      'Edited By Admin',
    ]

    const rows = [...expenses]
      .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
      .map((e) => [
        e.expense_date,
        e.expense_type,
        e.category,
        e.is_zero_spend ? '' : e.payment_mode,
        e.amount,
        e.is_zero_spend ? 'Yes' : 'No',
        e.note || '',
        e.edited_by_admin ? 'Yes' : 'No',
      ])

    const csvContent = [header, ...rows]
      .map((r) => r.map(csvEscape).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expenses_${selectedPlan.cycle_start_date}_to_${selectedPlan.cycle_end_date}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header + CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Stats &amp; Emergency Vault</h2>
          <p className="text-sm text-slate-500">
            {formatCycleLabel(selectedPlan.cycle_start_date, selectedPlan.cycle_end_date)}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
      </div>

      {/* Burn Rate & UPI/Cash Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-5 space-y-2 ${
            burnSummary.tone === 'red'
              ? 'bg-red-50 border-red-200 text-red-900'
              : burnSummary.tone === 'amber'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
            {burnSummary.tone === 'green' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>Burn Rate Projection</span>
          </div>
          <p className="text-lg sm:text-xl font-semibold tabular-nums">
            {burnSummary.headline}
          </p>
          <p className="text-xs sm:text-sm opacity-85">{burnSummary.sub}</p>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-3 tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">UPI vs. Cash Split</span>
            <span className="text-xs text-slate-400">
              Total {formatINR(totalPaymentMode)}
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
            <div className="bg-slate-900 h-full" style={{ width: `${upiPct}%` }} />
            <div className="bg-emerald-500 h-full" style={{ width: `${cashPct}%` }} />
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>
              <strong className="text-slate-900">UPI:</strong> {formatINR(metrics.upiTotal)} (
              {upiPct}%)
            </span>
            <span>
              <strong className="text-emerald-700">Cash:</strong> {formatINR(metrics.cashTotal)} (
              {cashPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Daily Spend vs Daily Cap Bar Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Daily Regular Spend vs. Dynamic Cap</h3>
            <p className="text-xs text-slate-500">
              Bars show daily regular spend; the line shows that day&apos;s auto-adjusted cap.
            </p>
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            Avg: <strong className="text-slate-900">{formatINR(metrics.dailyAverageSpend)}</strong>
            /day
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value, name) => [
                  formatINR(value),
                  name === 'spent' ? 'Spent' : 'Daily Cap',
                ]}
                labelFormatter={(label, payload) =>
                  payload?.[0]?.payload?.ymd ? formatDateShort(payload[0].payload.ymd) : label
                }
              />
              <Bar dataKey="spent" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line
                type="monotone"
                dataKey="cap"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown & Emergency Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Category Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Spending by Category</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {formatINR(metrics.totalRegularSpent)}
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              No regular expenses logged in this cycle yet.
            </p>
          ) : (
            <div className="space-y-3 tabular-nums">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{cat.name}</span>
                    <span className="text-slate-600">
                      <strong className="text-slate-900">{formatINR(cat.amount)}</strong> (
                      {cat.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Vault Breakdown & Log */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">Emergency Vault</h3>
            </div>
            <span className="text-lg font-bold text-amber-700 tabular-nums">
              {formatINR(metrics.rawEmergencyBalance)}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs sm:text-sm space-y-1.5 tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span>Previous Cycle Carry</span>
              <span>+{formatINR(metrics.prevEmergencyCarry)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Initial Monthly Reserve</span>
              <span>+{formatINR(metrics.initialEmergencyReserve)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>20% Share from Top-Ups ({topups.length})</span>
              <span className="text-emerald-700">
                +{formatINR(metrics.topupEmergencyShare)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Emergency Expenses ({emergencySpends.length})</span>
              <span className="text-red-600">-{formatINR(metrics.totalEmergencySpent)}</span>
            </div>
            {metrics.settlement.rescueUsed > 0 && (
              <div className="flex justify-between text-amber-800 pt-1.5 border-t border-slate-200 font-medium">
                <span>
                  {selectedPlan.is_closed
                    ? 'Cycle-End Rescue Used'
                    : 'Est. Cycle-End Rescue (50% max)'}
                </span>
                <span>-{formatINR(metrics.settlement.rescueUsed)}</span>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Emergency Expenses ({emergencySpends.length})
            </h4>

            {emergencySpends.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">
                No emergency withdrawals in this cycle.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {emergencySpends.map((e) => (
                  <li
                    key={e.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {e.category}
                        {e.note ? ` · ${e.note}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateShort(e.expense_date)} · {e.payment_mode}
                      </p>
                    </div>
                    <span className="font-semibold text-amber-700 tabular-nums shrink-0">
                      -{formatINR(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
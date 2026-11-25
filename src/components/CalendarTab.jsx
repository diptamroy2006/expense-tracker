import { useMemo, useState } from 'react'
import { CalendarDays, ShieldAlert } from 'lucide-react'
import {
  formatCycleLabel,
  formatDateShort,
  formatINR,
  getAllDatesInCycle,
  round2,
} from '../lib/budgetEngine'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekdayUtc(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function getDayParts(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const month = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    timeZone: 'UTC',
  }).format(dt)
  return { day: d, month }
}

export default function CalendarTab({ tracker }) {
  const { todayYmd, selectedPlan, expenses, metrics } = tracker
  const [selectedDate, setSelectedDate] = useState(todayYmd)

  const { dayRecords, dayMap, leadingBlanks } = useMemo(() => {
    const allDates = getAllDatesInCycle(
      selectedPlan.cycle_start_date,
      selectedPlan.cycle_end_date
    )

    const grouped = new Map()
    for (const exp of expenses) {
      const list = grouped.get(exp.expense_date) || []
      list.push(exp)
      grouped.set(exp.expense_date, list)
    }

    let runningPool = metrics.spendablePool
    const totalDays = allDates.length
    const records = []
    const map = new Map()

    allDates.forEach((ymd, idx) => {
      const daysLeft = totalDays - idx
      const dayCap = runningPool <= 0 ? 0 : round2(runningPool / daysLeft)
      const items = grouped.get(ymd) || []

      const regularSpent = round2(
        items
          .filter((e) => e.expense_type === 'regular' && !e.is_zero_spend)
          .reduce((sum, e) => sum + Number(e.amount || 0), 0)
      )
      const emergencySpent = round2(
        items
          .filter((e) => e.expense_type === 'emergency')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0)
      )
      const isZeroMarked = items.some((e) => e.is_zero_spend)
      const isFuture = ymd > todayYmd

      let status = 'empty'
      if (isFuture) {
        status = 'future'
      } else if (isZeroMarked && regularSpent === 0) {
        status = 'zero'
      } else if (regularSpent > 0) {
        if (dayCap <= 0) {
          status = 'over'
        } else {
          const ratio = regularSpent / dayCap
          if (ratio > 1) status = 'over'
          else if (ratio >= 0.75) status = 'amber'
          else status = 'good'
        }
      }

      const rec = {
        ymd,
        ...getDayParts(ymd),
        isFirstOfCycle: idx === 0,
        dayCap,
        regularSpent,
        emergencySpent,
        diff: round2(dayCap - regularSpent),
        isZeroMarked,
        isFuture,
        isToday: ymd === todayYmd,
        status,
        items,
      }

      records.push(rec)
      map.set(ymd, rec)

      runningPool = round2(runningPool - regularSpent)
    })

    return {
      dayRecords: records,
      dayMap: map,
      leadingBlanks: getWeekdayUtc(selectedPlan.cycle_start_date),
    }
  }, [selectedPlan, expenses, metrics.spendablePool, todayYmd])

  const activeDateKey = dayMap.has(selectedDate)
    ? selectedDate
    : dayMap.has(todayYmd)
      ? todayYmd
      : selectedPlan.cycle_start_date

  const activeDay = dayMap.get(activeDateKey)

  function tileClasses(rec, isSelected) {
    const base =
      'relative rounded-xl border p-2 text-left transition min-h-[64px] sm:min-h-[76px] flex flex-col justify-between cursor-pointer '
    const ring = isSelected ? 'ring-2 ring-slate-900 border-slate-900 ' : ''

    if (rec.status === 'future') {
      return base + ring + 'bg-slate-50/70 border-slate-100 text-slate-400'
    }
    if (rec.status === 'over') {
      return base + ring + 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100/70'
    }
    if (rec.status === 'amber') {
      return base + ring + 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/70'
    }
    if (rec.status === 'good') {
      return base + ring + 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
    }
    if (rec.status === 'zero') {
      return base + ring + 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100/70'
    }
    return base + ring + 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Cycle Calendar</h2>
          <p className="text-sm text-slate-500">
            {formatCycleLabel(selectedPlan.cycle_start_date, selectedPlan.cycle_end_date)}
          </p>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Under 75%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 75–100%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Over Cap
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> ₹0 Day
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Calendar Grid */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {dayRecords.map((rec) => {
              const showMonthTag = rec.isFirstOfCycle || rec.day === 1
              return (
                <button
                  key={rec.ymd}
                  type="button"
                  onClick={() => setSelectedDate(rec.ymd)}
                  className={tileClasses(rec, rec.ymd === activeDateKey)}
                >
                  <div className="flex items-start justify-between gap-1 w-full">
                    <span className="text-xs font-semibold leading-none">
                      {rec.day}
                      {showMonthTag && (
                        <span className="block text-[9px] font-medium uppercase tracking-wide opacity-70 mt-0.5">
                          {rec.month}
                        </span>
                      )}
                    </span>

                    {rec.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="mt-1.5 w-full tabular-nums">
                    {rec.status === 'future' ? (
                      <span className="text-[10px] opacity-60">—</span>
                    ) : rec.regularSpent > 0 ? (
                      <span className="block text-[10px] sm:text-[11px] font-semibold truncate">
                        {formatINR(rec.regularSpent)}
                      </span>
                    ) : rec.isZeroMarked ? (
                      <span className="block text-[10px] font-medium">₹0</span>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}

                    {rec.emergencySpent > 0 && (
                      <span className="block text-[9px] font-medium text-amber-700 truncate">
                        +{formatINR(rec.emergencySpent)} E
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Day Detail Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          {activeDay && (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {activeDay.isToday
                      ? 'Today'
                      : activeDay.isFuture
                        ? 'Upcoming Day'
                        : 'Selected Date'}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {formatDateShort(activeDay.ymd)}
                  </h3>
                </div>

                {!activeDay.isFuture && (
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      activeDay.status === 'over'
                        ? 'bg-red-100 text-red-700'
                        : activeDay.status === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : activeDay.status === 'good'
                            ? 'bg-emerald-100 text-emerald-700'
                            : activeDay.status === 'zero'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeDay.status === 'over'
                      ? 'Over Cap'
                      : activeDay.status === 'amber'
                        ? 'Near Cap'
                        : activeDay.status === 'good'
                          ? 'Under Cap'
                          : activeDay.status === 'zero'
                            ? '₹0 Spend Day'
                            : 'No Entry'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[11px] text-slate-500">Day Cap</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {formatINR(activeDay.dayCap)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[11px] text-slate-500">Regular</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {formatINR(activeDay.regularSpent)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <p className="text-[11px] text-slate-500">Saved / Diff</p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      activeDay.diff < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {activeDay.diff > 0 ? `+${formatINR(activeDay.diff)}` : formatINR(activeDay.diff)}
                  </p>
                </div>
              </div>

              {activeDay.emergencySpent > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-1.5 tabular-nums">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    Emergency spent on this day: <strong>{formatINR(activeDay.emergencySpent)}</strong>
                  </span>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Entries ({activeDay.items.length})
                </h4>

                {activeDay.items.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    {activeDay.isFuture
                      ? 'This day has not started yet.'
                      : 'No expenses logged on this date.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {activeDay.items.map((item) => (
                      <li
                        key={item.id}
                        className="py-2.5 flex items-start justify-between gap-3"
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
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {item.payment_mode}
                              </span>
                            )}
                            {item.edited_by_admin && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                Admin Edited
                              </span>
                            )}
                          </div>
                          {item.note && (
                            <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>
                          )}
                        </div>
                        <span
                          className={`font-semibold tabular-nums shrink-0 ${
                            item.expense_type === 'emergency'
                              ? 'text-amber-700'
                              : item.is_zero_spend
                                ? 'text-sky-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {formatINR(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
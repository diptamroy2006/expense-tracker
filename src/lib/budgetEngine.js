export const EXPENSE_CATEGORIES = [
  'Food',
  'Travel',
  'Groceries',
  'Bills & Recharge',
  'Shopping',
  'Academics / Books',
  'Health',
  'Hangouts',
  'Other',
]

export function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export function formatINR(value) {
  const num = round2(value)
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(num)
  const hasDecimals = abs % 1 !== 0
  return (
    sign +
    '₹' +
    abs.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
  )
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function getIstToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toYmd(dateObj) {
  return `${dateObj.getUTCFullYear()}-${pad2(dateObj.getUTCMonth() + 1)}-${pad2(
    dateObj.getUTCDate()
  )}`
}

export function addDays(ymd, days) {
  const dt = parseYmd(ymd)
  dt.setUTCDate(dt.getUTCDate() + days)
  return toYmd(dt)
}

export function daysBetweenInclusive(startYmd, endYmd) {
  const start = parseYmd(startYmd)
  const end = parseYmd(endYmd)
  const diff = Math.round((end - start) / 86400000)
  return Math.max(0, diff + 1)
}

export function formatDateShort(ymd) {
  if (!ymd) return ''
  const dt = parseYmd(ymd)
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt)
}

export function formatCycleLabel(startYmd, endYmd) {
  if (!startYmd || !endYmd) return ''
  const s = parseYmd(startYmd)
  const e = parseYmd(endYmd)
  const sPart = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(s)
  const ePart = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(e)
  return `${sPart} – ${ePart}`
}

// Calculates exact custom cycle bounds for any startDay (1 to 28)
export function getCycleForDate(ymd, startDay = 1) {
  const sDay = Math.min(28, Math.max(1, Number(startDay) || 1))
  const [year, month, day] = String(ymd).split('-').map(Number)

  let startDate
  let endDate

  if (sDay === 1) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    startDate = `${year}-${pad2(month)}-01`
    endDate = `${year}-${pad2(month)}-${pad2(lastDay)}`
  } else if (day >= sDay) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    startDate = `${year}-${pad2(month)}-${pad2(sDay)}`
    endDate = `${nextYear}-${pad2(nextMonth)}-${pad2(sDay - 1)}`
  } else {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    startDate = `${prevYear}-${pad2(prevMonth)}-${pad2(sDay)}`
    endDate = `${year}-${pad2(month)}-${pad2(sDay - 1)}`
  }

  return {
    startDate,
    endDate,
    editDeadlineAfterEnd: addDays(endDate, 1),
    lockDate: addDays(endDate, 2),
  }
}

export function canUserEditExpense(expenseDateYmd, todayYmd = getIstToday()) {
  if (!expenseDateYmd) return false
  const editCutoff = addDays(expenseDateYmd, 1)
  return expenseDateYmd <= todayYmd && todayYmd <= editCutoff
}

export function calculateSettlement(remainingPool, rawEmergencyBalance) {
  const rem = round2(remainingPool)
  const emg = round2(rawEmergencyBalance)

  if (rem >= 0) {
    return {
      rescueUsed: 0,
      finalPoolRollover: rem,
      finalEmergencyCarry: emg,
    }
  }

  const overspend = Math.abs(rem)
  const maxRescue = round2(Math.max(0, emg) * 0.5)
  const rescueUsed = round2(Math.min(overspend, maxRescue))

  return {
    rescueUsed,
    finalPoolRollover: round2(rem + rescueUsed),
    finalEmergencyCarry: round2(emg - rescueUsed),
  }
}

export function calculatePlanMetrics({
  plan,
  fixedExpenses = [],
  topups = [],
  expenses = [],
  todayYmd = getIstToday(),
  liveRollover = null,
}) {
  if (!plan) return null

  const baseBudget = round2(plan.base_budget)
  const initialEmergencyReserve = round2(plan.initial_emergency_reserve)
  const prevPoolRollover = round2(
    liveRollover ? liveRollover.poolRollover : plan.prev_pool_rollover
  )
  const prevEmergencyCarry = round2(
    liveRollover ? liveRollover.emergencyCarry : plan.prev_emergency_carry
  )

  const initialFixedTotal = round2(
    fixedExpenses
      .filter((f) => !f.is_mid_month)
      .reduce((sum, f) => sum + Number(f.amount || 0), 0)
  )
  const midMonthFixedTotal = round2(
    fixedExpenses
      .filter((f) => f.is_mid_month)
      .reduce((sum, f) => sum + Number(f.amount || 0), 0)
  )
  const totalFixed = round2(initialFixedTotal + midMonthFixedTotal)

  const totalTopups = round2(
    topups.reduce((sum, t) => sum + Number(t.total_amount || 0), 0)
  )
  const topupEmergencyShare = round2(
    topups.reduce((sum, t) => sum + Number(t.emergency_share || 0), 0)
  )
  const topupSpendableShare = round2(
    topups.reduce((sum, t) => sum + Number(t.spendable_share || 0), 0)
  )

  const regularExpenses = expenses.filter(
    (e) => e.expense_type === 'regular' && !e.is_zero_spend
  )
  const emergencyExpenses = expenses.filter((e) => e.expense_type === 'emergency')

  const totalRegularSpent = round2(
    regularExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )
  const totalEmergencySpent = round2(
    emergencyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )

  const spendablePool = round2(
    baseBudget -
      totalFixed -
      initialEmergencyReserve +
      topupSpendableShare +
      prevPoolRollover
  )
  const remainingPool = round2(spendablePool - totalRegularSpent)

  const rawEmergencyBalance = round2(
    prevEmergencyCarry +
      initialEmergencyReserve +
      topupEmergencyShare -
      totalEmergencySpent
  )

  const totalCycleDays = daysBetweenInclusive(plan.cycle_start_date, plan.cycle_end_date)
  const isTodayInCycle =
    todayYmd >= plan.cycle_start_date && todayYmd <= plan.cycle_end_date

  const effectiveDay = isTodayInCycle
    ? todayYmd
    : todayYmd < plan.cycle_start_date
      ? plan.cycle_start_date
      : plan.cycle_end_date

  const daysElapsed = daysBetweenInclusive(plan.cycle_start_date, effectiveDay)
  const daysRemainingIncludingToday = isTodayInCycle
    ? daysBetweenInclusive(todayYmd, plan.cycle_end_date)
    : todayYmd < plan.cycle_start_date
      ? totalCycleDays
      : 0

  const spentBeforeToday = round2(
    regularExpenses
      .filter((e) => e.expense_date < todayYmd)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )
  const spentToday = round2(
    regularExpenses
      .filter((e) => e.expense_date === todayYmd)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )
  const emergencySpentToday = round2(
    emergencyExpenses
      .filter((e) => e.expense_date === todayYmd)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )

  const hasZeroSpendToday = expenses.some(
    (e) => e.expense_date === todayYmd && e.is_zero_spend
  )

  const poolStartOfToday = round2(spendablePool - spentBeforeToday)
  const todayCap =
    !isTodayInCycle || poolStartOfToday <= 0 || daysRemainingIncludingToday <= 0
      ? 0
      : round2(poolStartOfToday / daysRemainingIncludingToday)
  const todayRemaining = round2(todayCap - spentToday)

  const isOverMonthlyPool = remainingPool < 0
  const monthlyOverspend = isOverMonthlyPool ? round2(Math.abs(remainingPool)) : 0

  const dailyAverageSpend =
    daysElapsed > 0 ? round2(totalRegularSpent / daysElapsed) : 0
  const projectedMonthEndBalance = round2(
    spendablePool - dailyAverageSpend * totalCycleDays
  )

  const upiTotal = round2(
    expenses
      .filter((e) => !e.is_zero_spend && e.payment_mode === 'UPI')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )
  const cashTotal = round2(
    expenses
      .filter((e) => !e.is_zero_spend && e.payment_mode === 'Cash')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  )

  const settlement = plan.is_closed
    ? {
        rescueUsed: round2(plan.emergency_rescue_used),
        finalPoolRollover: round2(plan.closing_pool_balance),
        finalEmergencyCarry: round2(plan.closing_emergency_balance),
      }
    : calculateSettlement(remainingPool, rawEmergencyBalance)

  return {
    baseBudget,
    initialEmergencyReserve,
    prevPoolRollover,
    prevEmergencyCarry,
    initialFixedTotal,
    midMonthFixedTotal,
    totalFixed,
    totalTopups,
    topupEmergencyShare,
    topupSpendableShare,
    spendablePool,
    totalRegularSpent,
    totalEmergencySpent,
    remainingPool,
    rawEmergencyBalance,
    totalCycleDays,
    daysElapsed,
    daysRemainingIncludingToday,
    isTodayInCycle,
    spentBeforeToday,
    spentToday,
    emergencySpentToday,
    hasZeroSpendToday,
    todayCap,
    todayRemaining,
    isOverMonthlyPool,
    monthlyOverspend,
    dailyAverageSpend,
    projectedMonthEndBalance,
    upiTotal,
    cashTotal,
    settlement,
  }
}

export function getAllDatesInCycle(startYmd, endYmd) {
  const dates = []
  let current = startYmd
  while (current <= endYmd) {
    dates.push(current)
    current = addDays(current, 1)
  }
  return dates
}
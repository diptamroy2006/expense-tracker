import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addDays,
  calculatePlanMetrics,
  getCycleForDate,
  getIstToday,
} from '../lib/budgetEngine'

export function useTrackerData(profile) {
  const userId = profile?.id
  const startDay = profile?.month_start_day || 1
  const todayYmd = getIstToday()
  const activeCycle = useMemo(() => getCycleForDate(todayYmd, startDay), [todayYmd, startDay])

  const [plans, setPlans] = useState([])
  const [selectedCycleStart, setSelectedCycleStart] = useState(activeCycle.startDate)
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [topups, setTopups] = useState([])
  const [expenses, setExpenses] = useState([])
  const [prevRollover, setPrevRollover] = useState({
    poolRollover: 0,
    emergencyCarry: 0,
    isLive: false,
    hasPrevious: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedPlan = useMemo(
    () => plans.find((p) => p.cycle_start_date === selectedCycleStart) || null,
    [plans, selectedCycleStart]
  )

  const loadPlanDetails = useCallback(async (allPlans, targetCycleStart) => {
    const plan = allPlans.find((p) => p.cycle_start_date === targetCycleStart) || null

    // Check immediate previous cycle for carry-forward balances
    const expectedPrevEnd = addDays(targetCycleStart, -1)
    const prevPlan = allPlans.find((p) => p.cycle_end_date === expectedPrevEnd) || null

    let rolloverInfo = {
      poolRollover: 0,
      emergencyCarry: 0,
      isLive: false,
      hasPrevious: false,
    }

    if (prevPlan) {
      if (prevPlan.is_closed) {
        rolloverInfo = {
          poolRollover: Number(prevPlan.closing_pool_balance || 0),
          emergencyCarry: Number(prevPlan.closing_emergency_balance || 0),
          isLive: false,
          hasPrevious: true,
        }
      } else {
        const [pFixed, pTopups, pExpenses] = await Promise.all([
          supabase.from('fixed_expenses').select('*').eq('plan_id', prevPlan.id),
          supabase.from('budget_topups').select('*').eq('plan_id', prevPlan.id),
          supabase.from('expenses').select('*').eq('plan_id', prevPlan.id),
        ])

        const prevMetrics = calculatePlanMetrics({
          plan: prevPlan,
          fixedExpenses: pFixed.data || [],
          topups: pTopups.data || [],
          expenses: pExpenses.data || [],
          todayYmd,
        })

        rolloverInfo = {
          poolRollover: prevMetrics.settlement.finalPoolRollover,
          emergencyCarry: prevMetrics.settlement.finalEmergencyCarry,
          isLive: true,
          hasPrevious: true,
        }
      }
    }

    setPrevRollover(rolloverInfo)

    if (!plan) {
      setFixedExpenses([])
      setTopups([])
      setExpenses([])
      return
    }

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

  const loadAll = useCallback(async (cycleStartOverride) => {
    if (!userId) return
    setLoading(true)
    setError('')

    try {
      // Automatically close any cycles that passed their lock date (end + 2 days IST)
      await supabase.rpc('close_expired_plans', { p_user_id: userId })

      const { data: planRows, error: plansError } = await supabase
        .from('monthly_plans')
        .select('*')
        .eq('user_id', userId)
        .order('cycle_start_date', { ascending: false })

      if (plansError) throw plansError

      const list = planRows || []
      setPlans(list)

      const targetStart = cycleStartOverride || selectedCycleStart
      await loadPlanDetails(list, targetStart)
    } catch (err) {
      setError(err.message || 'Failed to load budget data.')
    } finally {
      setLoading(false)
    }
  }, [userId, selectedCycleStart, loadPlanDetails])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function selectCycle(cycleStart) {
    setSelectedCycleStart(cycleStart)
    setLoading(true)
    setError('')
    try {
      await loadPlanDetails(plans, cycleStart)
    } catch (err) {
      setError(err.message || 'Failed to load selected cycle.')
    } finally {
      setLoading(false)
    }
  }

  async function createMonthlyPlan({ baseBudget, initialEmergencyReserve, initialFixedList }) {
    setError('')
    const { data: newPlan, error: insertError } = await supabase
      .from('monthly_plans')
      .insert({
        user_id: userId,
        cycle_start_date: activeCycle.startDate,
        cycle_end_date: activeCycle.endDate,
        base_budget: Number(baseBudget),
        initial_emergency_reserve: Number(initialEmergencyReserve || 0),
        prev_pool_rollover: prevRollover.poolRollover,
        prev_emergency_carry: prevRollover.emergencyCarry,
      })
      .select()
      .single()

    if (insertError) return { error: insertError.message }

    const validFixed = (initialFixedList || []).filter(
      (item) => item.title.trim() && Number(item.amount) > 0
    )

    if (validFixed.length > 0) {
      const { error: fixedErr } = await supabase.from('fixed_expenses').insert(
        validFixed.map((item) => ({
          plan_id: newPlan.id,
          user_id: userId,
          title: item.title.trim(),
          amount: Number(item.amount),
          is_mid_month: false,
        }))
      )
      if (fixedErr) return { error: fixedErr.message }
    }

    await loadAll(activeCycle.startDate)
    return { success: true }
  }

  async function addTopup({ totalAmount, note }) {
    if (!selectedPlan) return { error: 'No active plan found.' }
    const { error: err } = await supabase.from('budget_topups').insert({
      plan_id: selectedPlan.id,
      user_id: userId,
      total_amount: Number(totalAmount),
      note: (note || '').trim(),
    })
    if (err) return { error: err.message }
    await loadAll(selectedPlan.cycle_start_date)
    return { success: true }
  }

  async function addFixedExpense({ title, amount }) {
    if (!selectedPlan) return { error: 'No active plan found.' }
    const { error: err } = await supabase.from('fixed_expenses').insert({
      plan_id: selectedPlan.id,
      user_id: userId,
      title: title.trim(),
      amount: Number(amount),
      is_mid_month: true,
    })
    if (err) return { error: err.message }
    await loadAll(selectedPlan.cycle_start_date)
    return { success: true }
  }

  async function addExpense(payload) {
    if (!selectedPlan) return { error: 'No active plan found.' }
    const { error: err } = await supabase.from('expenses').insert({
      plan_id: selectedPlan.id,
      user_id: userId,
      expense_date: payload.expenseDate || todayYmd,
      amount: payload.isZeroSpend ? 0 : Number(payload.amount),
      category: payload.isZeroSpend ? 'Zero Spend' : payload.category,
      payment_mode: payload.paymentMode || 'UPI',
      expense_type: payload.isZeroSpend ? 'regular' : payload.expenseType || 'regular',
      is_zero_spend: Boolean(payload.isZeroSpend),
      note: (payload.note || '').trim(),
    })
    if (err) return { error: err.message }
    await loadAll(selectedPlan.cycle_start_date)
    return { success: true }
  }

  async function updateExpense(expenseId, updates) {
    const { error: err } = await supabase
      .from('expenses')
      .update({
        amount: Number(updates.amount),
        category: updates.category,
        payment_mode: updates.paymentMode,
        expense_type: updates.expenseType,
        note: (updates.note || '').trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
    if (err) return { error: err.message }
    await loadAll(selectedCycleStart)
    return { success: true }
  }

  async function deleteExpense(expenseId) {
    const { error: err } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (err) return { error: err.message }
    await loadAll(selectedCycleStart)
    return { success: true }
  }

  const metrics = useMemo(() => {
    if (!selectedPlan) return null
    return calculatePlanMetrics({
      plan: selectedPlan,
      fixedExpenses,
      topups,
      expenses,
      todayYmd,
      liveRollover: prevRollover.isLive ? prevRollover : null,
    })
  }, [selectedPlan, fixedExpenses, topups, expenses, todayYmd, prevRollover])

  return {
    todayYmd,
    activeCycle,
    plans,
    selectedCycleStart,
    selectedPlan,
    fixedExpenses,
    topups,
    expenses,
    prevRollover,
    metrics,
    loading,
    error,
    selectCycle,
    refresh: () => loadAll(selectedCycleStart),
    createMonthlyPlan,
    addTopup,
    addFixedExpense,
    addExpense,
    updateExpense,
    deleteExpense,
  }
}
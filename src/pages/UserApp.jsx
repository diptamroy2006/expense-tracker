import { useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  LogOut,
  RefreshCw,
  Wallet,
  Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTrackerData } from '../hooks/useTrackerData'
import { formatCycleLabel } from '../lib/budgetEngine'
import MonthlyPlanTab from '../components/MonthlyPlanTab'
import TodayTab from '../components/TodayTab'
import CalendarTab from '../components/CalendarTab'
import StatsVaultTab from '../components/StatsVaultTab'

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Zap },
  { id: 'plan', label: 'Monthly Plan', icon: Wallet },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'stats', label: 'Stats & Vault', icon: BarChart3 },
]

export default function UserApp() {
  const { profile, logout } = useAuth()
  const tracker = useTrackerData(profile)
  const [activeTab, setActiveTab] = useState('today')

  const cycleOptions = [
    {
      start: tracker.activeCycle.startDate,
      end: tracker.activeCycle.endDate,
      label: `${formatCycleLabel(
        tracker.activeCycle.startDate,
        tracker.activeCycle.endDate
      )} (Current)`,
    },
    ...tracker.plans
      .filter((p) => p.cycle_start_date !== tracker.activeCycle.startDate)
      .map((p) => ({
        start: p.cycle_start_date,
        end: p.cycle_end_date,
        label: formatCycleLabel(p.cycle_start_date, p.cycle_end_date),
      })),
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-slate-200 p-4 sticky top-0 h-screen shrink-0">
        <div className="px-2 pb-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Expense Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {profile.full_name} · {profile.mobile_number}
          </p>
        </div>

        <nav className="mt-4 space-y-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <select
                value={tracker.selectedCycleStart}
                onChange={(e) => tracker.selectCycle(e.target.value)}
                className="text-xs sm:text-sm font-medium bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 max-w-[230px] sm:max-w-none truncate focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {cycleOptions.map((c) => (
                  <option key={c.start} value={c.start}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={tracker.refresh}
                disabled={tracker.loading}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${tracker.loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={logout}
                className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl w-full mx-auto px-4 py-5 sm:py-6 flex-1">
          {tracker.error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {tracker.error}
            </div>
          )}

          {tracker.loading ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Loading your budget...
            </div>
          ) : activeTab === 'plan' ? (
            <MonthlyPlanTab tracker={tracker} />
          ) : !tracker.selectedPlan ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
              <p className="text-base font-medium text-slate-900">
                No budget set for this cycle yet
              </p>
              <p className="text-sm text-slate-500">
                Set up your Monthly Budget first so the app can calculate your daily spending cap.
              </p>
              <button
                onClick={() => setActiveTab('plan')}
                className="inline-block rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium cursor-pointer"
              >
                Go to Monthly Plan
              </button>
            </div>
          ) : activeTab === 'today' ? (
            <TodayTab tracker={tracker} />
          ) : activeTab === 'calendar' ? (
            <CalendarTab tracker={tracker} />
          ) : (
            <StatsVaultTab tracker={tracker} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-4 z-20">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-2.5 text-[11px] font-medium cursor-pointer ${
                active ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
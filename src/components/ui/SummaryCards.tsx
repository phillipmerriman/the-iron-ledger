import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react'
import { Weight, Dumbbell, Flame, Trophy, CalendarDays, Clock, Settings, UtensilsCrossed, ChartBar, Salad } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import Card from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { MacroData, MealSlot } from '@/types/meal-types'
import { MEAL_SLOT_LABELS } from '@/types/meal-types'

const CARD_DEFS = [
  { id: 'weight', label: 'Total Weight Moved', defaultVisible: true },
  { id: 'workouts', label: 'Total Workouts', defaultVisible: true },
  { id: 'thisWeek', label: 'This Week', defaultVisible: true },
  { id: 'streak', label: 'Current Streak', defaultVisible: false },
  { id: 'programs', label: 'Programs Completed', defaultVisible: true },
  { id: 'today', label: 'Today', defaultVisible: true },
  { id: 'todayMacros', label: "Today's Macros", defaultVisible: true },
  { id: 'weekMacros', label: "Week's Macros", defaultVisible: false },
  { id: 'nextMeal', label: 'Next Meal', defaultVisible: true },
] as const

export type SummaryCardId = (typeof CARD_DEFS)[number]['id']

const STORAGE_KEY = 'summary-visible-cards'
const DEFAULT_IDS = new Set(CARD_DEFS.filter((c) => c.defaultVisible).map((c) => c.id))

// Shared store so all components using this hook stay in sync
const listeners = new Set<() => void>()
let cachedSnapshot: Set<SummaryCardId> | null = null

function readFromStorage(): Set<SummaryCardId> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return new Set(JSON.parse(saved) as SummaryCardId[])
  } catch { /* ignore */ }
  return DEFAULT_IDS
}

function getSnapshot(): Set<SummaryCardId> {
  if (!cachedSnapshot) cachedSnapshot = readFromStorage()
  return cachedSnapshot
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function setVisibleCards(next: Set<SummaryCardId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  cachedSnapshot = next
  listeners.forEach((cb) => cb())
}

function useCardVisibility() {
  const visible = useSyncExternalStore(subscribe, getSnapshot)

  const toggle = useCallback((id: SummaryCardId) => {
    const next = new Set(visible)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setVisibleCards(next)
  }, [visible])

  return { visible, toggle }
}

interface TodaySlot {
  label: string
  done: boolean
}

interface SummaryCardsProps {
  weight?: { value: number; unit: string }
  workouts?: number
  thisWeek?: number
  streak?: number
  programsCompleted?: number
  todaySlots?: TodaySlot[]
  workoutsLabel?: string
  todayMacros?: MacroData | null
  weekMacros?: MacroData | null
  nextMeal?: { slot: MealSlot; recipeName: string | null; date: string } | null
}

/** Gear button + dropdown for toggling summary cards. Place this wherever you want in the page header. */
export function SummaryCardSettings() {
  const { visible, toggle } = useCardVisibility()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-lg p-1.5 transition-colors',
          open ? 'bg-surface-100 text-surface-700' : 'text-surface-400 hover:text-surface-600',
        )}
        aria-label="Configure summary cards"
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 rounded-lg border border-border bg-card p-2 shadow-lg z-20">
          {CARD_DEFS.map((card) => (
            <label
              key={card.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
            >
              <input
                type="checkbox"
                checked={visible.has(card.id)}
                onChange={() => toggle(card.id)}
                className="accent-primary-600"
              />
              {card.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SummaryCards({
  weight,
  workouts,
  thisWeek,
  streak,
  programsCompleted,
  todaySlots,
  workoutsLabel,
  todayMacros,
  weekMacros,
  nextMeal,
}: SummaryCardsProps) {
  const { visible } = useCardVisibility()

  const available = CARD_DEFS.filter((c) => {
    switch (c.id) {
      case 'weight': return weight != null
      case 'workouts': return workouts != null
      case 'thisWeek': return thisWeek != null
      case 'streak': return streak != null
      case 'programs': return programsCompleted != null
      case 'today': return todaySlots != null
      case 'todayMacros': return todayMacros !== undefined
      case 'weekMacros': return weekMacros !== undefined
      case 'nextMeal': return nextMeal !== undefined
    }
  })

  const shown = available.filter((c) => visible.has(c.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-500">Summary</h2>
        <SummaryCardSettings />
      </div>
      <div className={cn(
        'grid gap-4',
        shown.length <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4',
      )}>
      {visible.has('weight') && weight != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Weight className="h-4 w-4" />
            Total Weight Moved
          </div>
          <p className="mt-1 text-3xl font-bold">{weight.value.toLocaleString()}</p>
          <p className="text-xs text-surface-400">{weight.unit}</p>
        </Card>
      )}
      {visible.has('workouts') && workouts != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Dumbbell className="h-4 w-4" />
            Total Workouts
          </div>
          <p className="mt-1 text-3xl font-bold">{workouts}</p>
          {workoutsLabel && <p className="text-xs text-surface-400">{workoutsLabel}</p>}
        </Card>
      )}
      {visible.has('thisWeek') && thisWeek != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <CalendarDays className="h-4 w-4" />
            This Week
          </div>
          <p className="mt-1 text-3xl font-bold">{thisWeek}</p>
        </Card>
      )}
      {visible.has('streak') && streak != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Flame className="h-4 w-4" />
            Current Streak
          </div>
          <p className="mt-1 text-3xl font-bold">{streak}</p>
          <p className="text-xs text-surface-400">{streak === 1 ? 'day' : 'days'}</p>
        </Card>
      )}
      {visible.has('programs') && programsCompleted != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Trophy className="h-4 w-4" />
            Programs Completed
          </div>
          <p className="mt-1 text-3xl font-bold">{programsCompleted}</p>
        </Card>
      )}
      {visible.has('today') && todaySlots != null && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Clock className="h-4 w-4" />
            Today
          </div>
          {todaySlots.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {todaySlots.map(({ label, done }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-600">{label}</span>
                  <span className={cn('text-sm font-bold', done ? 'text-primary-600' : 'text-surface-400')}>
                    {done ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-3xl font-bold">
              <span className="text-surface-400">Rest</span>
            </p>
          )}
        </Card>
      )}

      {visible.has('todayMacros') && todayMacros !== undefined && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <UtensilsCrossed className="h-4 w-4" />
            Today's Macros
          </div>
          {todayMacros ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{todayMacros.calories}</span>
                <span className="text-xs text-surface-400">cal eaten</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span><span className="font-semibold text-blue-400">{todayMacros.protein_g}g</span> <span className="text-surface-400">protein</span></span>
                <span><span className="font-semibold text-amber-400">{todayMacros.carbs_g}g</span> <span className="text-surface-400">carbs</span></span>
                <span><span className="font-semibold text-rose-400">{todayMacros.fat_g}g</span> <span className="text-surface-400">fat</span></span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-surface-400">No meals eaten today</p>
          )}
        </Card>
      )}

      {visible.has('weekMacros') && weekMacros !== undefined && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <ChartBar className="h-4 w-4" />
            Week's Macros
          </div>
          {weekMacros ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{weekMacros.calories.toLocaleString()}</span>
                <span className="text-xs text-surface-400">cal this week</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span><span className="font-semibold text-blue-400">{weekMacros.protein_g}g</span> <span className="text-surface-400">protein</span></span>
                <span><span className="font-semibold text-amber-400">{weekMacros.carbs_g}g</span> <span className="text-surface-400">carbs</span></span>
                <span><span className="font-semibold text-rose-400">{weekMacros.fat_g}g</span> <span className="text-surface-400">fat</span></span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-surface-400">No meals eaten this week</p>
          )}
        </Card>
      )}

      {visible.has('nextMeal') && nextMeal !== undefined && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Salad className="h-4 w-4" />
            Next Meal
          </div>
          {nextMeal ? (
            <div className="mt-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                {isToday(parseISO(nextMeal.date))
                  ? MEAL_SLOT_LABELS[nextMeal.slot]
                  : `${format(parseISO(nextMeal.date), 'EEE MMM d')} · ${MEAL_SLOT_LABELS[nextMeal.slot]}`}
              </p>
              <p className="mt-0.5 text-sm font-bold text-text leading-snug">
                {nextMeal.recipeName ?? 'Custom meal'}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-surface-400">No upcoming meals planned</p>
          )}
        </Card>
      )}
      </div>
    </div>
  )
}

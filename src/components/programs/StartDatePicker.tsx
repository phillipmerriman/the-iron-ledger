import { useState, useEffect, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  getDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { loadUserEntries } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import { cn } from '@/lib/utils'

interface StartDatePickerProps {
  value: string // yyyy-MM-dd (always a Sunday)
  onChange: (value: string) => void
  programWeeks: number
  activationIds?: string[]
}

export default function StartDatePicker({ value, onChange, programWeeks, activationIds }: StartDatePickerProps) {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(() => {
    try { return new Date(value) } catch { return new Date() }
  })
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>([])

  useEffect(() => {
    if (!user) return
    loadUserEntries(user.id, activationIds).then(setPlannedEntries)
  }, [user, activationIds?.join(',')])

  const plannedDates = useMemo(
    () => new Set(plannedEntries.map((e) => e.date)),
    [plannedEntries],
  )

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  // Compute the program range from the selected Sunday
  const rangeStart = value ? new Date(value + 'T00:00:00') : null
  const rangeEnd = rangeStart ? addWeeks(rangeStart, programWeeks) : null

  function isInRange(day: Date) {
    if (!rangeStart || !rangeEnd) return false
    return day >= rangeStart && day < rangeEnd
  }

  function handleDayClick(day: Date) {
    const sunday = startOfWeek(day, { weekStartsOn: 0 })
    onChange(format(sunday, 'yyyy-MM-dd'))
  }

  return (
    <div>
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-surface-700">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-[11px] font-medium text-surface-400">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const isSunday = getDay(day) === 0
          const dateKey = format(day, 'yyyy-MM-dd')
          const hasWorkout = plannedDates.has(dateKey)
          const inRange = isInRange(day)
          const isSelected = value === dateKey

          return (
            <div key={dateKey} className="flex flex-col items-center py-0.5">
              <button
                type="button"
                onClick={() => inMonth && handleDayClick(day)}
                disabled={!inMonth}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors',
                  !inMonth && 'text-surface-200',
                  inMonth && 'cursor-pointer hover:bg-surface-100',
                  today && 'font-bold',
                  today && !isSelected && !inRange && 'border-2 border-primary-400',
                  // Program range highlight
                  inRange && !isSelected && 'bg-primary-100 text-primary-700',
                  // Selected Sunday
                  isSelected && 'bg-primary-500 text-white',
                  // Sunday emphasis
                  isSunday && inMonth && !isSelected && !inRange && 'font-semibold text-surface-800',
                  // Regular day
                  !isSunday && inMonth && !isSelected && !inRange && 'text-surface-500',
                )}
              >
                {format(day, 'd')}
              </button>
              {/* Workout indicator dot */}
              {hasWorkout && inMonth ? (
                <div className="mt-0.5 h-1 w-1 rounded-full bg-primary-400" />
              ) : (
                <div className="mt-0.5 h-1 w-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-surface-400">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary-400" />
          Existing workout
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded bg-primary-100" />
          Program range
        </div>
      </div>

      {/* Selected date confirmation */}
      {value && (
        <p className="mt-2 text-center text-xs font-medium text-surface-600">
          Starts Sunday, {format(new Date(value + 'T00:00:00'), 'MMM d, yyyy')}
          {rangeEnd && <> — ends {format(rangeEnd, 'MMM d, yyyy')}</>}
        </p>
      )}
    </div>
  )
}

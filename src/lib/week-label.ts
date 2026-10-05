import { format, startOfWeek, addWeeks, addDays } from 'date-fns'

/** "This Week" / "Last Week" / "Next Week", or the date range, for a week offset from today (weeks start Sunday). */
export function formatWeekLabel(weekDelta: number) {
  if (weekDelta === 0) return 'This Week'
  if (weekDelta === -1) return 'Last Week'
  if (weekDelta === 1) return 'Next Week'
  const start = startOfWeek(addWeeks(new Date(), weekDelta), { weekStartsOn: 0 })
  return `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`
}

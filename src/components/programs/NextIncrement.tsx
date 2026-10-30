import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import type { TemplateProgramStatus } from '@/hooks/useProgramProgression'
import { cn } from '@/lib/utils'

interface NextIncrementProps {
  status: TemplateProgramStatus
  className?: string
}

function dayLabel(date: string) {
  const d = parseISO(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, MMM d')
}

/** When the program steps up next: the next stage's first workout, or the end of the cycle */
export default function NextIncrement({ status, className }: NextIncrementProps) {
  const { config, isDue, nextIncrement } = status

  let text: string
  let date: string | null = null
  if (isDue) text = 'Ready to progress now'
  else if (config.increment_mode === 'manual') text = 'Progresses when you choose'
  else if (nextIncrement) {
    text = `${nextIncrement.kind === 'cycle_end' ? 'Cycle ends' : 'Next increment'}:`
    date = dayLabel(nextIncrement.date)
  } else return null

  return (
    <p className={cn('flex items-center gap-1 text-xs text-surface-500', isDue && 'font-medium text-primary-600', className)}>
      <TrendingUp className="h-3 w-3 shrink-0" />
      <span>{text}</span>
      {date && <span className="ui-date font-medium">{date}</span>}
    </p>
  )
}

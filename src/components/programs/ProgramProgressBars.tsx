import type { ProgramProgress } from '@/lib/program-templates/progress'
import { cn } from '@/lib/utils'

interface ProgramProgressBarsProps {
  progress: ProgramProgress
  /** compact: two bars side by side on one line */
  compact?: boolean
  className?: string
}

function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-surface-100', className)}>
      <span className="block h-full rounded-full bg-primary-500 transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
    </span>
  )
}

/** "This week" and "Total" progress for an active program */
export default function ProgramProgressBars({ progress, compact, className }: ProgramProgressBarsProps) {
  const { week, totalPercent, totalLabel } = progress
  const weekPercent = week.total > 0 ? (week.done / week.total) * 100 : 0
  const weekLabel = week.total > 0 ? `${week.done}/${week.total}` : 'Rest'

  if (compact) {
    return (
      <span className={cn('flex items-center gap-4 text-[11px] text-surface-500', className)}>
        <span className="flex flex-1 items-center gap-1.5" title={`This week: ${week.done} of ${week.total} workouts`}>
          <span className="shrink-0 text-surface-400">This week</span>
          <Bar percent={weekPercent} className="flex-1" />
          <span className="w-7 shrink-0 text-right">{weekLabel}</span>
        </span>
        <span className="flex flex-1 items-center gap-1.5" title={`Total: ${totalLabel}`}>
          <span className="shrink-0 text-surface-400">Total</span>
          <Bar percent={totalPercent} className="flex-1" />
          <span className="w-8 shrink-0 text-right">{totalPercent}%</span>
        </span>
      </span>
    )
  }

  return (
    <div className={cn('grid gap-2 sm:grid-cols-2 sm:gap-4', className)}>
      <div>
        <div className="mb-1 flex justify-between text-xs text-surface-500">
          <span>This week</span>
          <span>{week.total > 0 ? `${week.done} / ${week.total} workouts` : 'No workouts this week'}</span>
        </div>
        <Bar percent={weekPercent} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-surface-500">
          <span>Total</span>
          <span>{totalLabel} · {totalPercent}%</span>
        </div>
        <Bar percent={totalPercent} />
      </div>
    </div>
  )
}

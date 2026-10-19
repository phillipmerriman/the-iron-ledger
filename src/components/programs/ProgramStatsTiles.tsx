import { format, parseISO } from 'date-fns'
import type { ProgramStats } from '@/lib/program-templates/progress'
import { weightEquivalent } from '@/lib/program-templates/wildman'
import type { WeightUnit } from '@/types/common'
import { cn } from '@/lib/utils'

interface ProgramStatsTilesProps {
  stats: ProgramStats
  preferredUnit: WeightUnit
  /** narrow: at most 3 tiles per row, for tight spaces like the Plan page header */
  narrow?: boolean
  className?: string
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className="truncate font-display text-sm font-bold text-surface-800">{value}</p>
      {sub && <p className="truncate text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

/** Live program stats — the same figures as the setup wizard's review, updated as you train */
export default function ProgramStatsTiles({ stats, preferredUnit, narrow, className }: ProgramStatsTilesProps) {
  const s = stats
  const total = s.workoutsDone + s.workoutsLeft
  const showVolume = s.volumeTotal > 0
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', !narrow && 'lg:grid-cols-6', className)}>
      <Tile
        label="Projected end"
        value={s.projectedEnd ? format(parseISO(s.projectedEnd), 'MMM d, yyyy') : '—'}
        sub={`${s.workoutsLeft} ${s.workoutsLeft === 1 ? 'workout' : 'workouts'} left`}
      />
      <Tile label="Workouts" value={`${s.workoutsDone} / ${total}`} />
      <Tile label="Total reps" value={`${s.repsDone.toLocaleString()} / ${s.repsTotal.toLocaleString()}`} />
      {showVolume && (
        <Tile
          label="Weight moved"
          value={`${s.volumeDone.toLocaleString()} / ${s.volumeTotal.toLocaleString()} ${preferredUnit}`}
          sub={weightEquivalent(s.volumeTotal, preferredUnit)}
        />
      )}
      {showVolume && (
        <Tile label="Heaviest workout" value={`${s.heaviestWorkout.toLocaleString()} ${preferredUnit}`} />
      )}
      {s.emomMinutesLeft > 0 && <Tile label="EMOM minutes left" value={s.emomMinutesLeft.toLocaleString()} />}
      {s.bodyWeightMultiple != null && (
        <Tile label="Body weights moved" value={`${(Math.round(s.bodyWeightMultiple * 10) / 10).toLocaleString()}×`} sub="planned total" />
      )}
    </div>
  )
}

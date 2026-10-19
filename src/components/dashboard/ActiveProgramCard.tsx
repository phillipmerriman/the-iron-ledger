import { Link } from 'react-router-dom'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { format, parseISO, addWeeks, differenceInCalendarDays } from 'date-fns'
import type { Program, ProgramActivation, WorkoutSession } from '@/types/database'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import { completedSlotKeys, programProgress, programStats } from '@/lib/program-templates/progress'
import ProgramStatsTiles from '@/components/programs/ProgramStatsTiles'
import { useAuth } from '@/contexts/AuthContext'
import ProgramProgressBars from '@/components/programs/ProgramProgressBars'
import Badge from '@/components/ui/Badge'
import { SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import { formatTrainingDays, parseWildmanConfig } from '@/lib/program-templates/wildman'

interface ActiveProgramCardProps {
  program: Program
  activation: ProgramActivation
  sessions: WorkoutSession[]
  /** This activation's planned entries */
  entries: PlannedEntry[]
}

export default function ActiveProgramCard({ program, activation, sessions, entries }: ActiveProgramCardProps) {
  const start = parseISO(activation.start_date)
  // Template programs have a fixed weekly schedule; they're managed from the Plan page, not the designer
  const templateConfig = program.template_type === 'wildman_reverse_ladder' ? parseWildmanConfig(program.template_config) : null

  // Week + total progress from this program's planned workouts and completed sessions
  const doneKeys = completedSlotKeys(sessions)
  const progress = programProgress(program, activation, entries, doneKeys)

  // Live projection (end date, reps, weight moved…) like the setup wizard's review
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const bodyWeight = profile?.body_weight ? { value: profile.body_weight, unit: profile.body_weight_unit } : null
  const stats = programStats(program, activation, entries, doneKeys, preferredUnit, bodyWeight)
  // Template schedules shift with push-backs and moves, so use the live projection for the end date
  const end = templateConfig && stats.projectedEnd ? parseISO(stats.projectedEnd) : addWeeks(start, program.weeks)
  const weeks = templateConfig ? Math.max(1, Math.ceil((differenceInCalendarDays(end, start) + 1) / 7)) : program.weeks

  return (
    <Link
      to={templateConfig ? '/plan' : `/programs/${program.id}`}
      className="block rounded-xl border border-surface-200 bg-card p-4 shadow-sm transition-colors hover:border-primary-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary-50 p-2">
            <CalendarRange className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-surface-900">{program.name}</p>
            {program.description && (
              <p className="mt-0.5 text-sm text-surface-500">{program.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="primary">Active</Badge>
              <Badge className="ui-date">{format(start, 'MMM d')} — {format(end, 'MMM d, yyyy')}</Badge>
              <Badge>{weeks} {weeks === 1 ? 'week' : 'weeks'}</Badge>
              {templateConfig && (
                <Badge>{formatTrainingDays(templateConfig.days_of_week)} · {SESSION_LABELS[templateConfig.session]}</Badge>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-400" />
      </div>

      <ProgramProgressBars progress={progress} className="mt-3 sm:pl-11" />
      <ProgramStatsTiles stats={stats} preferredUnit={preferredUnit} className="mt-3 sm:pl-11" />
    </Link>
  )
}

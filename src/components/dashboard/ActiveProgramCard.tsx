import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { format, parseISO, addWeeks } from 'date-fns'
import type { Program, ProgramActivation, WorkoutSession } from '@/types/database'
import Badge from '@/components/ui/Badge'
import { SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import { formatTrainingDays, parseWildmanConfig } from '@/lib/program-templates/wildman'

interface ActiveProgramCardProps {
  program: Program
  activation: ProgramActivation
  sessions: WorkoutSession[]
}

export default function ActiveProgramCard({ program, activation, sessions }: ActiveProgramCardProps) {
  const start = parseISO(activation.start_date)
  const end = addWeeks(start, program.weeks)
  // Template programs have a fixed weekly schedule; they're managed from the Plan page, not the designer
  const templateConfig = program.template_type === 'wildman_reverse_ladder' ? parseWildmanConfig(program.template_config) : null

  // Count how many sessions have been completed since activation
  const completedSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.completed_at &&
          new Date(s.started_at) >= new Date(activation.created_at),
      ).length,
    [sessions, activation.created_at],
  )

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
              <Badge>{program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</Badge>
              {templateConfig && (
                <Badge>{formatTrainingDays(templateConfig.days_of_week)} · {SESSION_LABELS[templateConfig.session]}</Badge>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-400" />
      </div>

      {completedSessions > 0 && (
        <p className="mt-3 text-xs text-surface-500">
          {completedSessions} {completedSessions === 1 ? 'session' : 'sessions'} completed
        </p>
      )}
    </Link>
  )
}

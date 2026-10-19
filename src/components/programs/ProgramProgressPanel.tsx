import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import type useProgramProgression from '@/hooks/useProgramProgression'
import type { Exercise } from '@/types/database'
import { formatTrainingDays, stageLabel } from '@/lib/program-templates/wildman'
import { SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import { cn } from '@/lib/utils'
import ProgramProgressControls from './ProgramProgressControls'
import ProgramProgressBars from './ProgramProgressBars'
import { programProgress, programStats } from '@/lib/program-templates/progress'
import ProgramStatsTiles from './ProgramStatsTiles'
import { useAuth } from '@/contexts/AuthContext'

interface ProgramProgressPanelProps {
  progression: ReturnType<typeof useProgramProgression>
  exercises: Exercise[]
}

const COLLAPSED_KEY = 'fittrack:plan_programs_collapsed'

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

/**
 * Active template programs as compact rows above the week, so the calendar stays in view.
 * Click a row to open its pace controls; the whole section can be collapsed.
 */
export default function ProgramProgressPanel({ progression, exercises }: ProgramProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [openId, setOpenId] = useState<string | null>(null)
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const bodyWeight = profile?.body_weight ? { value: profile.body_weight, unit: profile.body_weight_unit } : null

  if (progression.statuses.length === 0) return null

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* storage unavailable */ }
  }

  const dueCount = progression.statuses.filter((s) => s.isDue).length

  return (
    <div className="rounded-xl border border-surface-200 bg-card">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-surface-500">
          Active Programs ({progression.statuses.length})
          {dueCount > 0 && (
            <span className="ml-2 normal-case tracking-normal text-primary-600">
              · {dueCount} ready to progress
            </span>
          )}
        </span>
        {collapsed ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronUp className="h-4 w-4 text-surface-400" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-surface-100 border-t border-surface-100">
          {progression.statuses.map((status) => {
            const { config, progress, stage, stages, completedInStage, requiredInStage } = status
            const auto = config.increment_mode === 'auto'
            const exerciseName = exercises.find((e) => e.id === config.exercise_id)?.name ?? status.program.name
            const open = openId === status.activation.id
            const weight = progress.weight_unit === 'bodyweight' ? 'BW' : `${progress.weight ?? '—'} ${progress.weight_unit}`
            return (
              <div key={status.activation.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : status.activation.id)}
                  aria-expanded={open}
                  title={status.program.name}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-1 pt-2 text-left hover:bg-surface-50 md:flex-nowrap"
                >
                  <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-surface-400 transition-transform', open && 'rotate-90')} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 md:w-56 md:flex-none">
                    {exerciseName}
                    <span className="ml-1.5 text-xs font-normal text-surface-400">{weight}</span>
                  </span>
                  <span className="shrink-0 text-xs text-surface-500">
                    Stage {progress.stage_index + 1}/{stages.length}
                    {auto && ` · ${Math.min(completedInStage, requiredInStage)}/${requiredInStage}`}
                    {progress.cycle > 1 && ` · C${progress.cycle}`}
                  </span>
                  <span className="shrink-0 text-xs text-surface-500">
                    {formatTrainingDays(config.days_of_week)} · {SESSION_LABELS[config.session]}
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate font-display text-sm font-semibold text-surface-800 md:block">
                    {stageLabel(stage, config.rep_type)}
                  </span>
                  {status.isDue && (
                    <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                      Ready
                    </span>
                  )}
                </button>
                <ProgramProgressBars
                  compact
                  className="px-3 pb-2 pl-9"
                  progress={programProgress(status.program, status.activation, progression.entriesFor(status.activation.id), progression.doneKeys)}
                />

                {open && (
                  <div className="space-y-2 px-3 pb-3 pl-9">
                    <p className="text-xs text-surface-500">
                      {status.program.name}
                      <span className="md:hidden"> · {stageLabel(stage, config.rep_type)}</span>
                      {!auto && ` · ${completedInStage} ${completedInStage === 1 ? 'session' : 'sessions'} at this stage`}
                    </p>
                    <ProgramStatsTiles
                      narrow
                      preferredUnit={preferredUnit}
                      stats={programStats(status.program, status.activation, progression.entriesFor(status.activation.id), progression.doneKeys, preferredUnit, bodyWeight)}
                    />
                    <ProgramProgressControls status={status} progression={progression} variant="panel" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

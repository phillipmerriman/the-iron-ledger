import usePrograms from '@/hooks/usePrograms'
import useWorkouts from '@/hooks/useWorkouts'
import useProgramProgression from '@/hooks/useProgramProgression'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import { stageLabel } from '@/lib/program-templates/wildman'
import ProgramProgressControls from './ProgramProgressControls'

interface TemplateProgressPromptsProps {
  /** The workout's entries — prompts show for any that belong to a template program */
  entries: PlannedEntry[]
  onScheduleChanged?: () => void
}

/**
 * "Ready to progress?" prompts for the workout-complete modal. Mount it only while the modal
 * is open: it loads fresh workout data so the just-completed session is counted.
 */
export default function TemplateProgressPrompts({ entries, onScheduleChanged }: TemplateProgressPromptsProps) {
  const programsApi = usePrograms()
  const { sessions, loading } = useWorkouts()
  const progression = useProgramProgression(programsApi, sessions, loading, onScheduleChanged)

  if (!progression.ready) return null

  const activationIds = [...new Set(entries.map((e) => e.program_id))]
  return (
    <>
      {activationIds.map((id) => {
        const status = progression.statusForActivation(id)
        if (!status) return null
        return (
          <div key={status.activation.id} className="rounded-lg border border-surface-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{status.program.name}</p>
            <p className="mb-2 text-sm text-surface-700">
              Stage {status.progress.stage_index + 1} of {status.stages.length}: {stageLabel(status.stage, status.config)}
              {status.config.increment_mode === 'auto' &&
                ` · ${Math.min(status.completedInStage, status.requiredInStage)}/${status.requiredInStage} sessions`}
            </p>
            <ProgramProgressControls status={status} progression={progression} variant="complete" />
          </div>
        )
      })}
    </>
  )
}

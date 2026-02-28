import { Pencil, Trash2 } from 'lucide-react'
import type { WorkoutTemplate, WorkoutTemplateExercise, Exercise } from '@/types/database'
import { formatReps } from '@/types/common'
import type { TemplateExerciseExtras } from '@/hooks/useWorkoutTemplates'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate
  templateExercises: WorkoutTemplateExercise[]
  exercises: Exercise[]
  parseExtras: (notes: string | null) => TemplateExerciseExtras
  onEdit: (template: WorkoutTemplate) => void
  onDelete: (id: string) => void
}

export default function WorkoutTemplateCard({
  template,
  templateExercises,
  exercises,
  parseExtras,
  onEdit,
  onDelete,
}: WorkoutTemplateCardProps) {
  function getExerciseName(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-surface-900">{template.name}</p>
        {template.description && (
          <p className="mt-0.5 text-xs text-surface-500">{template.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge>{templateExercises.length} {templateExercises.length === 1 ? 'exercise' : 'exercises'}</Badge>
        </div>
        {templateExercises.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {templateExercises.map((te) => {
              const extras = parseExtras(te.notes)
              const repsDisplay = formatReps(
                extras.rep_type,
                extras.rep_type === 'time' ? te.target_duration_sec : te.target_reps,
                extras.reps_right,
              )
              return (
                <p key={te.id} className="text-xs text-surface-600">
                  <u>{getExerciseName(te.exercise_id)}</u>
                  {te.target_sets != null && ` — ${te.target_sets > 1 ? `${te.target_sets} sets` : '1 set'}`}
                  {repsDisplay && ` × ${repsDisplay}`}
                  {extras.weight_unit === 'bodyweight'
                    ? ' BW'
                    : te.target_weight != null
                      ? ` @ ${te.target_weight}${extras.weight_unit}`
                      : ''}
                </p>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onEdit(template)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(template.id)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-600"
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  )
}

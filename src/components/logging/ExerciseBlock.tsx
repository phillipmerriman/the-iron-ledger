import { Plus } from 'lucide-react'
import type { Exercise, WorkoutSet, UpdateDto } from '@/types/database'
import SetRow from './SetRow'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

interface ExerciseBlockProps {
  exercise: Exercise
  sets: WorkoutSet[]
  onAddSet: (exerciseId: string, isWarmup: boolean) => void
  onUpdateSet: (id: string, values: UpdateDto<'workout_sets'>) => void
  onRemoveSet: (id: string) => void
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ExerciseBlock({
  exercise,
  sets,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
}: ExerciseBlockProps) {
  const workingSets = sets.filter((s) => !s.is_warmup)
  const warmupSets = sets.filter((s) => s.is_warmup)

  return (
    <div className="rounded-xl border border-surface-200 bg-card">
      <div className="border-b border-surface-100 px-4 py-2.5">
        <p className="font-display font-medium text-surface-900">{exercise.name}</p>
        <div className="mt-1 flex gap-1.5">
          <Badge variant="primary">{formatLabel(exercise.exercise_type)}</Badge>
          <Badge>{formatLabel(exercise.primary_muscle)}</Badge>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center gap-2 border-b border-surface-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-surface-400">
        <span className="w-8 text-center">Set</span>
        <span className="w-16 text-center">Weight</span>
        <span className="w-4" />
        <span className="w-16 text-center">Reps</span>
        <span className="w-14 text-center">RPE</span>
      </div>

      {/* Warmup sets */}
      {warmupSets.map((set) => (
        <SetRow key={set.id} set={set} onUpdate={onUpdateSet} onRemove={onRemoveSet} />
      ))}

      {/* Working sets */}
      {workingSets.map((set) => (
        <SetRow key={set.id} set={set} onUpdate={onUpdateSet} onRemove={onRemoveSet} />
      ))}

      <div className="flex items-center gap-2 border-t border-surface-100 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => onAddSet(exercise.id, false)}>
          <Plus className="h-3.5 w-3.5" />
          Add Set
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAddSet(exercise.id, true)}>
          <Plus className="h-3.5 w-3.5" />
          Warm-up
        </Button>
      </div>
    </div>
  )
}

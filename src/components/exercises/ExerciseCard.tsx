import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import type { Exercise } from '@/types/database'
import { getExerciseColorClasses } from '@/types/common'
import { cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface ExerciseCardProps {
  exercise: Exercise
  onEdit: (exercise: Exercise) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void
}

export default function ExerciseCard({
  exercise,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: ExerciseCardProps) {
  const colorClasses = getExerciseColorClasses(exercise.color)

  return (
    <Card className={cn('flex items-start justify-between gap-3', colorClasses.bg)}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-surface-900">{exercise.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant="primary">{formatLabel(exercise.exercise_type)}</Badge>
          <Badge>{formatLabel(exercise.primary_muscle)}</Badge>
          <Badge>{formatLabel(exercise.equipment)}</Badge>
          {exercise.exercise_rate && <Badge variant="info">{formatLabel(exercise.exercise_rate)}</Badge>}
          {exercise.is_archived && <Badge variant="warning">Archived</Badge>}
        </div>
        {exercise.notes && (
          <p className="mt-2 text-xs text-surface-500">{exercise.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onEdit(exercise)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {exercise.is_archived ? (
          <button
            onClick={() => onUnarchive(exercise.id)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Unarchive"
            title="Unarchive"
          >
            <ArchiveRestore className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onArchive(exercise.id)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Archive"
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(exercise.id)}
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

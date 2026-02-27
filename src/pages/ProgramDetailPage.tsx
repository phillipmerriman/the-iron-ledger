import { useState, type DragEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { parseISO } from 'date-fns'
import usePrograms from '@/hooks/usePrograms'
import useExercises from '@/hooks/useExercises'
import type { ExerciseType, ExerciseRate, MuscleGroup, Equipment } from '@/types/common'
import { getExerciseColorClasses } from '@/types/common'
import { cn } from '@/lib/utils'
import ProgramWeekGrid from '@/components/programs/ProgramWeekGrid'
import ExerciseForm from '@/components/exercises/ExerciseForm'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { programs, loading: programsLoading } = usePrograms()
  const { exercises, loading: exercisesLoading, create: createExercise } = useExercises()

  const [newExerciseOpen, setNewExerciseOpen] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [search, setSearch] = useState('')

  const program = programs.find((p) => p.id === id)
  const loading = programsLoading || exercisesLoading

  const activeExercises = exercises.filter((e) => !e.is_archived)
  const filtered = activeExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleCreateExercise(values: {
    name: string
    exercise_type: ExerciseType
    exercise_rate: ExerciseRate | null
    primary_muscle: MuscleGroup
    equipment: Equipment
    color: string | null
    notes: string
  }) {
    setCreatingExercise(true)
    try {
      await createExercise(values)
      setNewExerciseOpen(false)
    } finally {
      setCreatingExercise(false)
    }
  }

  function handlePoolDragStart(e: DragEvent, exerciseId: string) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', exerciseId)
    e.dataTransfer.setData('application/x-pool', 'true')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!program) {
    return (
      <div className="space-y-4">
        <Link to="/programs" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-500">
          <ArrowLeft className="h-4 w-4" /> Back to programs
        </Link>
        <p className="text-surface-500">Program not found.</p>
      </div>
    )
  }

  const programStart = parseISO(program.start_date)
  const weeks = Array.from({ length: program.weeks }, (_, i) => i)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link to="/programs" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-500">
          <ArrowLeft className="h-4 w-4" /> Programs
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{program.name}</h1>
        {program.description && (
          <p className="mt-0.5 text-sm text-surface-500">{program.description}</p>
        )}
        <div className="mt-2 flex gap-1.5">
          <Badge>{program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</Badge>
          {program.is_active && <Badge variant="primary">Active</Badge>}
        </div>
        <p className="mt-2 text-sm text-surface-500">
          Drag exercises from the pool into each day.
        </p>
      </div>

      {/* Main layout: weeks + pool sidebar */}
      <div className="flex gap-4">
        {/* Weeks column */}
        <div className="min-w-0 flex-1 space-y-2">
          {weeks.map((weekOffset) => (
            <div key={weekOffset} className="space-y-1">
              <h2 className="text-lg font-semibold text-surface-800">
                Week {weekOffset + 1}
              </h2>
              <ProgramWeekGrid
                weekOffset={weekOffset}
                programId={program.id}
                programStart={programStart}
                exercises={exercises}
              />
            </div>
          ))}
        </div>

        {/* Exercise pool — single sticky sidebar */}
        <div className="w-56 shrink-0">
          <div className="sticky top-6 rounded-xl border border-surface-200 bg-white">
            <div className="border-b border-surface-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-surface-500">
                  Exercise Pool
                </h3>
                <button
                  onClick={() => setNewExerciseOpen(true)}
                  className="rounded p-0.5 text-surface-400 hover:bg-primary-50 hover:text-primary-600"
                  aria-label="New exercise"
                  title="New exercise"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded border border-surface-200 px-2 py-1 pr-6 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-surface-400 hover:text-surface-600"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              <div className="space-y-1">
                {filtered.map((exercise) => {
                  const poolColor = getExerciseColorClasses(exercise.color)
                  return (
                    <div
                      key={exercise.id}
                      draggable
                      onDragStart={(e) => handlePoolDragStart(e, exercise.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-primary-300 transition-colors',
                        exercise.color ? `${poolColor.bg} ${poolColor.border}` : 'border-surface-200 bg-surface-50',
                      )}
                    >
                      <p className={cn('text-xs font-medium truncate', exercise.color ? poolColor.text : 'text-surface-800')}>
                        {exercise.name}
                      </p>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-surface-400">
                    {activeExercises.length === 0 ? 'Add exercises first' : 'No matches'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New exercise modal */}
      <Modal open={newExerciseOpen} onClose={() => setNewExerciseOpen(false)} title="New Exercise">
        <ExerciseForm
          onSubmit={handleCreateExercise}
          onCancel={() => setNewExerciseOpen(false)}
          loading={creatingExercise}
        />
      </Modal>
    </div>
  )
}

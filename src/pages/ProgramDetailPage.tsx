import { useState, type DragEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Trash2, Copy, ClipboardPaste } from 'lucide-react'
import { parseISO } from 'date-fns'
import usePrograms from '@/hooks/usePrograms'
import useExercises from '@/hooks/useExercises'
import useWorkoutTemplates from '@/hooks/useWorkoutTemplates'
import useWeeklyPlan, { loadWeekEntries, clearWeekEntries, pasteWeekEntries } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import { useAuth } from '@/contexts/AuthContext'
import type { ExerciseType, ExerciseRate, MuscleGroup, Equipment } from '@/types/common'
import { getExerciseColorClasses } from '@/types/common'
import { cn } from '@/lib/utils'
import ProgramWeekGrid from '@/components/programs/ProgramWeekGrid'
import ExerciseForm from '@/components/exercises/ExerciseForm'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { programs, loading: programsLoading } = usePrograms()
  const { exercises, loading: exercisesLoading, create: createExercise } = useExercises()
  const { templates, getExercisesForTemplate, saveDay, remove: removeTemplate, parseExtras } = useWorkoutTemplates()

  const { user } = useAuth()
  const [newExerciseOpen, setNewExerciseOpen] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [search, setSearch] = useState('')
  const [copiedWeek, setCopiedWeek] = useState<{ weekOffset: number; entries: (PlannedEntry & { dayIndex: number })[] } | null>(null)
  const [revision, setRevision] = useState(0)
  const [pasteConfirm, setPasteConfirm] = useState<{ targetWeekOffset: number } | null>(null)

  const program = programs.find((p) => p.id === id)
  const loading = programsLoading || exercisesLoading

  const activeExercises = exercises.filter((e) => !e.is_archived)
  const filtered = activeExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  // We need a useWeeklyPlan instance to call addEntry for template drops.
  // Since ProgramWeekGrid creates its own hook per week, we use a shared one at week 0
  // just for the addEntry function (it writes to the global localStorage anyway).
  const programStart = program ? parseISO(program.start_date) : new Date()
  const { addEntry } = useWeeklyPlan({
    startDate: programStart,
    weekOffset: 0,
    programId: id ?? null,
  })

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

  function handleTemplateDragStart(e: DragEvent, templateId: string) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', templateId)
    e.dataTransfer.setData('application/x-template', 'true')
  }

  function handleTemplateDrop(dateKey: string, templateId: string, session: Session) {
    const templateExercises = getExercisesForTemplate(templateId)
    for (const exercise of templateExercises) {
      const extras = parseExtras(exercise.notes)
      addEntry(dateKey, exercise.exercise_id, {
        sets: exercise.target_sets,
        reps: extras.rep_type === 'time' ? exercise.target_duration_sec : exercise.target_reps,
        rep_type: extras.rep_type,
        reps_right: extras.reps_right,
        weight: exercise.target_weight,
        weight_unit: extras.weight_unit,
      }, session)
    }
  }

  async function handleSaveDay(name: string, entries: PlannedEntry[]) {
    await saveDay(name, entries)
  }

  function handleCopyWeek(weekOffset: number) {
    if (!user || !program) return
    const entries = loadWeekEntries(user.id, program.id, programStart, weekOffset)
    setCopiedWeek({ weekOffset, entries })
  }

  function handlePasteWeek(targetWeekOffset: number) {
    if (!user || !program || !copiedWeek) return
    const targetEntries = loadWeekEntries(user.id, program.id, programStart, targetWeekOffset)
    if (targetEntries.length > 0) {
      setPasteConfirm({ targetWeekOffset })
      return
    }
    pasteWeekEntries(user.id, program.id, programStart, targetWeekOffset, copiedWeek.entries)
    setRevision((r) => r + 1)
  }

  function doPaste(targetWeekOffset: number, replace: boolean) {
    if (!user || !program || !copiedWeek) return
    if (replace) {
      clearWeekEntries(user.id, program.id, programStart, targetWeekOffset)
    }
    pasteWeekEntries(user.id, program.id, programStart, targetWeekOffset, copiedWeek.entries)
    setRevision((r) => r + 1)
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

  const weeks = Array.from({ length: program.weeks }, (_, i) => i)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link to="/programs" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-500">
          <ArrowLeft className="h-4 w-4" /> Programs
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Program Designer</h1>
        <p className="mt-1 font-display text-lg font-semibold text-surface-800">{program.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {program.description && (
            <p className="text-surface-500"><span className="font-medium text-surface-600">Description:</span> {program.description}</p>
          )}
          <span className="text-surface-500"><span className="font-medium text-surface-600">Length:</span> {program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</span>
          {program.is_active ? <Badge variant="primary">Active</Badge> : <Badge>Inactive</Badge>}
        </div>
        <p className="mt-2 text-xs text-surface-400">
          Drag exercises or saved workouts from the pool into each day.
        </p>
      </div>

      {/* Main layout: weeks + pool sidebar */}
      <div className="flex gap-4">
        {/* Weeks column */}
        <div className="min-w-0 flex-1 space-y-2">
          {weeks.map((weekOffset) => (
            <div key={weekOffset} className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-surface-800">
                  Week {weekOffset + 1}
                  {copiedWeek?.weekOffset === weekOffset && (
                    <span className="ml-2 text-xs font-normal text-primary-500">Copied</span>
                  )}
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopyWeek(weekOffset)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-surface-400 hover:bg-surface-100 hover:text-surface-600"
                    title="Copy week"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => handlePasteWeek(weekOffset)}
                    disabled={!copiedWeek}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-surface-400 hover:bg-surface-100 hover:text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Paste week"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                  </button>
                </div>
              </div>
              <ProgramWeekGrid
                weekOffset={weekOffset}
                programId={program.id}
                programStart={programStart}
                exercises={exercises}
                onSaveDay={handleSaveDay}
                onTemplateDrop={handleTemplateDrop}
                revision={revision}
              />
            </div>
          ))}
        </div>

        {/* Sidebar pools */}
        <div className="w-56 shrink-0">
          <div className="sticky top-6 space-y-3">
            {/* Exercise pool */}
            <div className="rounded-xl border border-surface-200 bg-white">
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
              <div className="max-h-[40vh] overflow-y-auto p-2">
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
                        <p className={cn('font-display text-xs font-medium truncate', exercise.color ? poolColor.text : 'text-surface-800')}>
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

            {/* Saved Workouts pool */}
            <div className="rounded-xl border border-surface-200 bg-white">
              <div className="border-b border-surface-100 px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-surface-500">
                  Saved Workouts
                </h3>
              </div>
              <div className="max-h-[30vh] overflow-y-auto p-2">
                <div className="space-y-1">
                  {templates.map((tmpl) => {
                    const count = getExercisesForTemplate(tmpl.id).length
                    return (
                      <div
                        key={tmpl.id}
                        draggable
                        onDragStart={(e) => handleTemplateDragStart(e, tmpl.id)}
                        className="group flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-primary-300 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-surface-800">
                            {tmpl.name}
                          </p>
                          <p className="text-[10px] text-surface-400">
                            {count} {count === 1 ? 'exercise' : 'exercises'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTemplate(tmpl.id) }}
                          className="shrink-0 rounded p-0.5 text-surface-300 opacity-0 transition-opacity hover:text-danger-500 group-hover:opacity-100"
                          aria-label="Delete template"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                  {templates.length === 0 && (
                    <p className="py-4 text-center text-[11px] text-surface-400">
                      Save a day to create a template
                    </p>
                  )}
                </div>
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

      {/* Paste week confirm */}
      <ConfirmDialog
        open={pasteConfirm !== null}
        onClose={() => setPasteConfirm(null)}
        title="Paste Week"
        message={`Week ${(pasteConfirm?.targetWeekOffset ?? 0) + 1} already has exercises. What would you like to do?`}
        actions={[
          {
            label: 'Add to existing',
            variant: 'secondary',
            onClick: () => { if (pasteConfirm) doPaste(pasteConfirm.targetWeekOffset, false) },
          },
          {
            label: 'Replace all',
            variant: 'danger',
            onClick: () => { if (pasteConfirm) doPaste(pasteConfirm.targetWeekOffset, true) },
          },
        ]}
      />
    </div>
  )
}

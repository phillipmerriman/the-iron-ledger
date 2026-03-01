import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import useWorkoutTemplates from '@/hooks/useWorkoutTemplates'
import useExercises from '@/hooks/useExercises'
import WorkoutTemplateCard from '@/components/workouts/WorkoutTemplateCard'
import WorkoutTemplateForm from '@/components/workouts/WorkoutTemplateForm'
import type { TemplateFormEntry, WorkoutTemplateFormInitial } from '@/components/workouts/WorkoutTemplateForm'
import type { WorkoutTemplate } from '@/types/database'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function WorkoutsPage() {
  const { templates, loading: templatesLoading, getExercisesForTemplate, create, addExercise, remove, updateTemplate, parseExtras } = useWorkoutTemplates()
  const { exercises, loading: exercisesLoading } = useExercises()

  const loading = templatesLoading || exercisesLoading

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return templates
    const q = search.toLowerCase()
    return templates.filter((t) => t.name.toLowerCase().includes(q))
  }, [templates, search])

  function entriesToExerciseRows(entries: TemplateFormEntry[]) {
    return entries.map((entry) => {
      const extras = {
        rep_type: entry.rep_type,
        reps_right: entry.reps_right,
        weight_unit: entry.weight_unit,
        target_duration_sec: entry.rep_type === 'time' ? entry.reps : null,
        intensity: entry.intensity ?? null,
        user_notes: entry.notes ?? null,
      }
      return {
        exercise_id: entry.exercise_id,
        sort_order: entry.sort_order,
        target_sets: entry.sets,
        target_reps: entry.rep_type === 'time' ? null : entry.reps,
        target_weight: entry.weight,
        target_duration_sec: entry.rep_type === 'time' ? entry.reps : null,
        rest_seconds: null,
        notes: JSON.stringify(extras),
      }
    })
  }

  async function handleSubmit(data: { name: string; description: string; entries: TemplateFormEntry[] }) {
    setSubmitting(true)
    try {
      if (editing) {
        await updateTemplate(editing.id, { name: data.name, description: data.description || undefined }, entriesToExerciseRows(data.entries))
      } else {
        const template = await create(data.name, data.description || undefined)
        if (!template) return
        for (const row of entriesToExerciseRows(data.entries)) {
          await addExercise(template.id, row)
        }
      }
      closeModal()
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(template: WorkoutTemplate) {
    setEditing(template)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workout template?')) return
    await remove(id)
  }

  function buildEditInitial(template: WorkoutTemplate): WorkoutTemplateFormInitial {
    const texs = getExercisesForTemplate(template.id)
    return {
      name: template.name,
      description: template.description ?? '',
      entries: texs.map((te) => {
        const extras = parseExtras(te.notes)
        return {
          id: te.id,
          exercise_id: te.exercise_id,
          sort_order: te.sort_order,
          sets: te.target_sets,
          reps: extras.rep_type === 'time' ? te.target_duration_sec : te.target_reps,
          rep_type: extras.rep_type,
          reps_right: extras.reps_right,
          weight: te.target_weight,
          weight_unit: extras.weight_unit,
          intensity: extras.intensity ?? null,
          notes: extras.user_notes ?? null,
        }
      }),
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Workouts</h1>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          New Workout
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-surface-300 py-2 pl-9 pr-8 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-surface-400 hover:text-surface-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-surface-400">
          {templates.length === 0
            ? 'No saved workouts yet. Create one or save a day from a program!'
            : 'No workouts match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template) => (
            <WorkoutTemplateCard
              key={template.id}
              template={template}
              templateExercises={getExercisesForTemplate(template.id)}
              exercises={exercises}
              parseExtras={parseExtras}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Workout' : 'New Workout'} size="xl">
        <WorkoutTemplateForm
          key={editing?.id ?? 'new'}
          exercises={exercises}
          initial={editing ? buildEditInitial(editing) : undefined}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      </Modal>
    </div>
  )
}

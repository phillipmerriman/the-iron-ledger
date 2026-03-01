import { useRef, useState, type DragEvent } from 'react'
import { GripVertical, X, Search } from 'lucide-react'
import type { Exercise } from '@/types/database'
import type { PlannedEntry, PlannedEntryUpdate } from '@/hooks/useWeeklyPlan'
import type { RepType, WeightUnit } from '@/types/common'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion } from '@/types/common'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import EntryDetailEditor from '@/components/programs/EntryDetailEditor'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export interface TemplateFormEntry {
  id: string
  exercise_id: string
  sort_order: number
  sets: number | null
  reps: number | null
  rep_type: RepType
  reps_right: number | null
  weight: number | null
  weight_unit: WeightUnit
  intensity: 'light' | 'heavy' | null
  notes: string | null
}

export interface WorkoutTemplateFormInitial {
  name: string
  description: string
  entries: TemplateFormEntry[]
}

interface WorkoutTemplateFormProps {
  exercises: Exercise[]
  initial?: WorkoutTemplateFormInitial
  onSubmit: (data: { name: string; description: string; entries: TemplateFormEntry[] }) => void
  onCancel: () => void
  submitting?: boolean
}

export default function WorkoutTemplateForm({
  exercises,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: WorkoutTemplateFormProps) {
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [entries, setEntries] = useState<TemplateFormEntry[]>(initial?.entries ?? [])
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [reorderDragId, setReorderDragId] = useState<string | null>(null)
  const [reorderOverIdx, setReorderOverIdx] = useState<number | null>(null)
  const dragCounterRef = useRef(0)

  const activeExercises = exercises.filter((e) => !e.is_archived)
  const filtered = activeExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  function addExercise(exerciseId: string) {
    const entry: TemplateFormEntry = {
      id: crypto.randomUUID(),
      exercise_id: exerciseId,
      sort_order: entries.length,
      sets: 3,
      reps: 10,
      rep_type: 'single',
      reps_right: null,
      weight: null,
      weight_unit: 'lbs',
      intensity: null,
      notes: null,
    }
    setEntries((prev) => [...prev, entry])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (editingEntryId === id) setEditingEntryId(null)
  }

  function updateEntry(id: string, values: PlannedEntryUpdate) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...values } : e)),
    )
  }

  function getExercise(exerciseId: string): Exercise | undefined {
    return exercises.find((e) => e.id === exerciseId)
  }

  // Drag from pool
  function handlePoolDragStart(e: DragEvent, exerciseId: string) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', exerciseId)
    e.dataTransfer.setData('application/x-pool', 'true')
  }

  // Drag to reorder entries
  function handleEntryDragStart(e: DragEvent, entryId: string) {
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', entryId)
    e.dataTransfer.setData('application/x-reorder', 'true')
    setReorderDragId(entryId)
  }

  function handleEntryDragEnd() {
    setReorderDragId(null)
    setReorderOverIdx(null)
  }

  function handleEntryDragOver(e: DragEvent, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    if (reorderDragId) {
      e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move'
      setReorderOverIdx(idx)
    }
  }

  function handleEntryDrop(e: DragEvent, targetIdx: number) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('application/x-reorder') && reorderDragId) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+drag = duplicate
        setEntries((prev) => {
          const source = prev.find((en) => en.id === reorderDragId)
          if (!source) return prev
          const clone: TemplateFormEntry = { ...source, id: crypto.randomUUID() }
          const updated = [...prev]
          updated.splice(targetIdx, 0, clone)
          return updated.map((en, i) => ({ ...en, sort_order: i }))
        })
      } else {
        // Reorder
        setEntries((prev) => {
          const fromIdx = prev.findIndex((en) => en.id === reorderDragId)
          if (fromIdx === -1 || fromIdx === targetIdx) return prev
          const updated = [...prev]
          const [moved] = updated.splice(fromIdx, 1)
          updated.splice(targetIdx, 0, moved)
          return updated.map((en, i) => ({ ...en, sort_order: i }))
        })
      }
    } else if (e.dataTransfer.types.includes('application/x-pool')) {
      // Insert from pool at position
      const exerciseId = e.dataTransfer.getData('text/plain')
      if (exerciseId) {
        const entry: TemplateFormEntry = {
          id: crypto.randomUUID(),
          exercise_id: exerciseId,
          sort_order: targetIdx,
          sets: 3,
          reps: 10,
          rep_type: 'single',
          reps_right: null,
          weight: null,
          weight_unit: 'lbs',
          intensity: null,
          notes: null,
        }
        setEntries((prev) => {
          const updated = [...prev]
          updated.splice(targetIdx, 0, entry)
          return updated.map((en, i) => ({ ...en, sort_order: i }))
        })
      }
    }
    setReorderDragId(null)
    setReorderOverIdx(null)
    setDragOver(false)
  }

  function handleDayDragOver(e: DragEvent) {
    e.preventDefault()
    dragCounterRef.current++
    setDragOver(true)
  }

  function handleDayDragLeave() {
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragOver(false)
      setReorderOverIdx(null)
    }
  }

  function handleDayDrop(e: DragEvent) {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    setReorderOverIdx(null)
    if (e.dataTransfer.types.includes('application/x-reorder')) return // handled by entry drop
    const exerciseId = e.dataTransfer.getData('text/plain')
    if (exerciseId) addExercise(exerciseId)
  }

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      entries,
    })
  }

  // Build a PlannedEntry-compatible object for EntryDetailEditor
  function toPlannedEntry(entry: TemplateFormEntry): PlannedEntry {
    return {
      ...entry,
      user_id: '',
      program_id: null,
      date: '',
    }
  }

  return (
    <div className="space-y-4">
      {/* Name & Description */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="template-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day, Upper Body"
        />
        <Input
          id="template-description"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
        />
      </div>

      {/* Day area + Exercise pool */}
      <div className="flex gap-4">
        {/* Day area */}
        <div
          onDragOver={handleDayDragOver}
          onDragLeave={handleDayDragLeave}
          onDrop={handleDayDrop}
          className={cn(
            'min-h-[200px] flex-1 rounded-xl border-2 border-dashed p-3 transition-colors',
            dragOver ? 'border-primary-400 bg-primary-50/40' : 'border-surface-200 bg-surface-50/30',
          )}
        >
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-surface-500">
            Exercises
          </h3>

          {entries.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-surface-300">Drop exercises here</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {entries.map((entry, idx) => {
                const ex = getExercise(entry.exercise_id)
                const entryColor = getExerciseColorClasses(ex?.color ?? null)
                const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                const isDragging = reorderDragId === entry.id
                return (
                  <div
                    key={entry.id}
                    className="relative"
                    onDragOver={(e) => handleEntryDragOver(e, idx)}
                    onDrop={(e) => handleEntryDrop(e, idx)}
                  >
                    {reorderOverIdx === idx && reorderDragId && reorderDragId !== entry.id && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary-500" />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleEntryDragStart(e, entry.id)}
                      onDragEnd={handleEntryDragEnd}
                      onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)}
                      className={cn(
                        'group flex items-start gap-1 rounded-lg border p-2 text-xs shadow-sm cursor-pointer transition-opacity',
                        ex?.color ? `${entryColor.bg} ${entryColor.border}` : 'border-surface-200 bg-white',
                        isDragging && 'opacity-30',
                      )}
                    >
                      <div
                        className="shrink-0 cursor-grab pt-0.5 text-surface-300 active:cursor-grabbing"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate font-medium', ex?.color ? entryColor.text : 'text-surface-800')}>
                          {ex?.name ?? 'Unknown'}
                        </p>
                        <div className="mt-0.5 space-y-0 text-[10px] text-surface-500">
                          {entry.sets != null && <p>Sets: {entry.sets}</p>}
                          {repsDisplay && (
                            <p>{entry.rep_type === 'time' ? 'Time: ' : entry.rep_type === 'reps_per_minute' ? '' : 'Reps: '}{repsDisplay}</p>
                          )}
                          {(entry.weight_unit === 'bodyweight' || entry.weight != null) && (
                            <p>{formatWeightWithConversion(entry.weight, entry.weight_unit, preferredUnit)}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeEntry(entry.id) }}
                        className="shrink-0 rounded p-0.5 text-surface-300 opacity-0 transition-opacity hover:text-danger-500 group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {editingEntryId === entry.id && (
                      <EntryDetailEditor
                        entry={toPlannedEntry(entry)}
                        exerciseName={ex?.name ?? 'Unknown'}
                        exercises={exercises}
                        onUpdate={updateEntry}
                        onClose={() => setEditingEntryId(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Exercise pool */}
        <div className="w-48 shrink-0">
          <div className="rounded-xl border border-surface-200 bg-white">
            <div className="border-b border-surface-100 px-3 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-surface-500">
                Exercise Pool
              </h3>
              <div className="relative mt-1.5">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded border border-surface-200 py-1 pl-6 pr-6 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
            <div className="max-h-[300px] overflow-y-auto p-2">
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

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
          {submitting ? (initial ? 'Saving...' : 'Creating...') : (initial ? 'Save' : 'Create')}
        </Button>
      </div>
    </div>
  )
}

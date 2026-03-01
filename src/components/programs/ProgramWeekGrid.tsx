import { useState, useEffect, type DragEvent } from 'react'
import { X, Trash2, Save } from 'lucide-react'
import { format, isToday } from 'date-fns'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion } from '@/types/common'
import type { RepType, WeightUnit } from '@/types/common'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import EntryDetailEditor from './EntryDetailEditor'

interface ProgramWeekGridProps {
  weekOffset: number
  programId: string
  programStart: Date
  exercises: Exercise[]
  onSaveDay?: (name: string, entries: PlannedEntry[]) => void
  /** Called when a template is dropped; parent resolves template exercises and calls addEntry */
  onTemplateDrop?: (dateKey: string, templateId: string) => void
  /** Bump to trigger refetch (e.g. after external paste) */
  revision?: number
}

export default function ProgramWeekGrid({
  weekOffset,
  programId,
  programStart,
  exercises,
  onSaveDay,
  onTemplateDrop,
  revision,
}: ProgramWeekGridProps) {
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const {
    days,
    dateKeys,
    getEntriesForDate,
    addEntry,
    updateEntry,
    removeEntry,
    moveEntry,
    clearDate,
    refetch,
  } = useWeeklyPlan({
    startDate: programStart,
    weekOffset,
    programId,
  })

  useEffect(() => { refetch() }, [revision])

  // Drag state
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [reorderOverId, setReorderOverId] = useState<string | null>(null)
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null)
  // Editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  function getExercise(exerciseId: string): Exercise | undefined {
    return exercises.find((e) => e.id === exerciseId)
  }

  function handleDayDragOver(e: DragEvent, dateKey: string) {
    e.preventDefault()
    const isFromPool = e.dataTransfer.types.includes('application/x-pool')
    const isFromTemplate = e.dataTransfer.types.includes('application/x-template')
    e.dataTransfer.dropEffect = (isFromPool || isFromTemplate || e.ctrlKey || e.metaKey) ? 'copy' : 'move'
    setDropTarget(dateKey)
  }

  function handleDayDragLeave() {
    setDropTarget(null)
  }

  function handleDayDrop(e: DragEvent, dateKey: string) {
    e.preventDefault()
    setDropTarget(null)
    setReorderOverId(null)

    const data = e.dataTransfer.getData('text/plain')
    if (!data) return

    if (e.dataTransfer.types.includes('application/x-template')) {
      onTemplateDrop?.(dateKey, data)
    } else if (e.dataTransfer.types.includes('application/x-pool')) {
      addEntry(dateKey, data)
    } else {
      // Dropped on day container (not on a specific entry) — append at end
      const dayEntries = getEntriesForDate(dateKey)
      if (e.ctrlKey || e.metaKey) {
        const allEntries = dateKeys.flatMap((dk) => getEntriesForDate(dk))
        const source = allEntries.find((en) => en.id === data)
        if (source) {
          addEntry(dateKey, source.exercise_id, {
            sets: source.sets,
            reps: source.reps,
            rep_type: source.rep_type,
            reps_right: source.reps_right,
            weight: source.weight,
            weight_unit: source.weight_unit,
          })
        }
      } else {
        moveEntry(data, dateKey, dayEntries.length)
      }
      setDraggingEntryId(null)
    }
  }

  function handleEntryDragStart(e: DragEvent, entryId: string) {
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', entryId)
    setDraggingEntryId(entryId)
  }

  function handleEntryDragEnd() {
    setDraggingEntryId(null)
    setReorderOverId(null)
  }

  function handleEntryDragOver(e: DragEvent, entryId: string) {
    if (!draggingEntryId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move'
    setReorderOverId(entryId)
  }

  function handleEntryDrop(e: DragEvent, dateKey: string, targetIdx: number) {
    if (!draggingEntryId) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setReorderOverId(null)

    if (e.ctrlKey || e.metaKey) {
      const allEntries = dateKeys.flatMap((dk) => getEntriesForDate(dk))
      const source = allEntries.find((en) => en.id === draggingEntryId)
      if (source) {
        addEntry(dateKey, source.exercise_id, {
          sets: source.sets,
          reps: source.reps,
          rep_type: source.rep_type,
          reps_right: source.reps_right,
          weight: source.weight,
          weight_unit: source.weight_unit,
        })
      }
    } else {
      moveEntry(draggingEntryId, dateKey, targetIdx)
    }
    setDraggingEntryId(null)
  }

  function handleSaveDay(dateKey: string) {
    if (!onSaveDay) return
    const planned = getEntriesForDate(dateKey)
    if (planned.length === 0) return
    const name = window.prompt('Template name:')
    if (!name?.trim()) return
    onSaveDay(name.trim(), planned)
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dateKey = dateKeys[i]
        const today = isToday(day)
        const planned = getEntriesForDate(dateKey)
        const isOver = dropTarget === dateKey

        return (
          <div
            key={dateKey}
            onDragOver={(e) => handleDayDragOver(e, dateKey)}
            onDragLeave={handleDayDragLeave}
            onDrop={(e) => handleDayDrop(e, dateKey)}
            className={cn(
              'flex flex-col rounded-xl border-2 border-dashed transition-colors',
              today ? 'border-primary-300 bg-primary-50/20' : 'border-surface-200 bg-white',
              isOver && 'border-primary-400 bg-primary-50/40',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between rounded-t-lg px-2 py-1.5',
                today ? 'bg-primary-100/50' : 'bg-surface-50',
              )}
            >
              <div>
                <span
                  className={cn(
                    'text-xs font-bold',
                    today ? 'text-primary-700' : 'text-surface-600',
                  )}
                >
                  {format(day, 'EEE')}
                </span>
                <span className="ml-1 text-[11px] text-surface-400">
                  {format(day, 'M/d')}
                </span>
              </div>
              {planned.length > 0 && (
                <div className="flex gap-0.5">
                  {onSaveDay && (
                    <button
                      onClick={() => handleSaveDay(dateKey)}
                      className="rounded p-0.5 text-surface-300 hover:bg-primary-50 hover:text-primary-500"
                      aria-label="Save as template"
                      title="Save as template"
                    >
                      <Save className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => clearDate(dateKey)}
                    className="rounded p-0.5 text-surface-300 hover:bg-danger-50 hover:text-danger-500"
                    aria-label="Clear day"
                    title="Clear all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 p-1.5">
              {planned.map((entry, idx) => {
                const ex = getExercise(entry.exercise_id)
                const entryColor = getExerciseColorClasses(ex?.color ?? null)
                const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                return (
                  <div
                    key={entry.id}
                    className="relative"
                    onDragOver={(e) => handleEntryDragOver(e, entry.id)}
                    onDrop={(e) => handleEntryDrop(e, dateKey, idx)}
                  >
                    {reorderOverId === entry.id && draggingEntryId && draggingEntryId !== entry.id && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary-500" />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleEntryDragStart(e, entry.id)}
                      onDragEnd={handleEntryDragEnd}
                      onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)}
                      title={[ex?.name, entry.notes].filter(Boolean).join('\n') || undefined}
                      className={cn(
                        'group flex items-start gap-1 rounded-lg border p-1.5 text-[11px] shadow-sm cursor-pointer transition-opacity',
                        ex?.color ? `${entryColor.bg} ${entryColor.border}` : 'border-surface-200 bg-white',
                        draggingEntryId === entry.id && 'opacity-30',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate font-medium', ex?.color ? entryColor.text : 'text-surface-800')}>
                          {ex?.name ?? 'Unknown'}
                        </p>
                        <div className="mt-0.5 space-y-0 text-[10px] text-surface-500">
                          {entry.intensity && (
                            <span className={`inline-block rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase ${
                              entry.intensity === 'light'
                                ? 'bg-info-500/10 text-info-600'
                                : 'bg-danger-500/10 text-danger-600'
                            }`}>
                              {entry.intensity}
                            </span>
                          )}
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
                        entry={entry}
                        exerciseName={ex?.name ?? 'Unknown'}
                        exercises={exercises}
                        onUpdate={updateEntry}
                        onClose={() => setEditingEntryId(null)}
                      />
                    )}
                  </div>
                )
              })}

              {planned.length === 0 && (
                <div className="py-2 text-center">
                  <span className="text-[11px] text-surface-300">Drop here</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

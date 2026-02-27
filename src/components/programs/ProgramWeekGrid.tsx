import { useState, type DragEvent } from 'react'
import { X, Trash2 } from 'lucide-react'
import { format, isToday } from 'date-fns'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import { getExerciseColorClasses } from '@/types/common'
import { cn } from '@/lib/utils'

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface ProgramWeekGridProps {
  weekOffset: number
  programId: string
  programStart: Date
  exercises: Exercise[]
}

export default function ProgramWeekGrid({
  weekOffset,
  programId,
  programStart,
  exercises,
}: ProgramWeekGridProps) {
  const {
    days,
    dateKeys,
    getEntriesForDate,
    addEntry,
    removeEntry,
    moveEntry,
    clearDate,
  } = useWeeklyPlan({
    startDate: programStart,
    weekOffset,
    programId,
  })

  // Drag state
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  function getExercise(exerciseId: string): Exercise | undefined {
    return exercises.find((e) => e.id === exerciseId)
  }

  function handleDayDragOver(e: DragEvent, dateKey: string) {
    e.preventDefault()
    setDropTarget(dateKey)
  }

  function handleDayDragLeave() {
    setDropTarget(null)
  }

  function handleDayDrop(e: DragEvent, dateKey: string) {
    e.preventDefault()
    setDropTarget(null)

    const data = e.dataTransfer.getData('text/plain')
    if (!data) return

    // Check if this is a pool drag (exercise ID) or entry move
    // Pool items set 'application/x-pool' marker
    if (e.dataTransfer.types.includes('application/x-pool')) {
      addEntry(dateKey, data)
    } else {
      const dayEntries = getEntriesForDate(dateKey)
      moveEntry(data, dateKey, dayEntries.length)
    }
  }

  function handleEntryDragStart(e: DragEvent, entryId: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', entryId)
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
                <button
                  onClick={() => clearDate(dateKey)}
                  className="rounded p-0.5 text-surface-300 hover:bg-danger-50 hover:text-danger-500"
                  aria-label="Clear day"
                  title="Clear all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1 p-1.5">
              {planned.map((entry) => {
                const ex = getExercise(entry.exercise_id)
                const entryColor = getExerciseColorClasses(ex?.color ?? null)
                return (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(e) => handleEntryDragStart(e, entry.id)}
                    className={cn(
                      'group flex items-start gap-1 rounded-lg border p-1.5 text-[11px] shadow-sm cursor-grab active:cursor-grabbing',
                      ex?.color ? `${entryColor.bg} ${entryColor.border}` : 'border-surface-200 bg-white',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate font-medium', ex?.color ? entryColor.text : 'text-surface-800')}>
                        {ex?.name ?? 'Unknown'}
                      </p>
                      {ex && (
                        <p className="truncate text-[10px] text-surface-400">
                          {formatLabel(ex.primary_muscle)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="shrink-0 rounded p-0.5 text-surface-300 opacity-0 transition-opacity hover:text-danger-500 group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
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

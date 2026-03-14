import { useState, useEffect, type DragEvent } from 'react'
import { Trash2, Save } from 'lucide-react'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { TimerWithIntervals } from '@/hooks/useTimers'
import type { RepType, WeightUnit } from '@/types/common'
import { useAuth } from '@/contexts/AuthContext'
import PlannerDayColumn from '@/components/planner/PlannerDayColumn'

interface ProgramWeekGridProps {
  weekOffset: number
  programId: string
  programStart: Date
  exercises: Exercise[]
  timers?: TimerWithIntervals[]
  onSaveDay?: (name: string, entries: PlannedEntry[]) => void
  /** Resolves a template ID into exercise items for adding to the plan */
  resolveTemplate?: (templateId: string) => { exerciseId: string; presets?: { sets?: number | null; reps?: number | null; rep_type?: RepType; reps_right?: number | null; weight?: number | null; weight_unit?: WeightUnit; timer_id?: string | null } }[]
  /** Bump to trigger refetch (e.g. after external paste) */
  revision?: number
}

export default function ProgramWeekGrid({
  weekOffset,
  programId,
  programStart,
  exercises,
  timers,
  onSaveDay,
  resolveTemplate,
  revision,
}: ProgramWeekGridProps) {
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const {
    days,
    dateKeys,
    getEntriesForDate,
    getEntriesForDateSession,
    addEntry,
    addEntries,
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

  useEffect(() => { refetch() }, [revision, refetch])

  function getExerciseDefaults(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId)
    if (!ex) return undefined
    const hasDefaults = ex.default_sets != null || ex.default_reps != null || ex.default_weight != null || ex.default_intensity != null
    if (!hasDefaults && ex.default_rep_type === 'single' && ex.default_weight_unit === 'lbs') return undefined
    return {
      sets: ex.default_sets,
      reps: ex.default_reps,
      rep_type: ex.default_rep_type as RepType,
      weight: ex.default_weight,
      weight_unit: ex.default_weight_unit as WeightUnit,
      intensity: ex.default_intensity,
    }
  }

  // Drag state
  const [dropTarget, setDropTarget] = useState<{ dateKey: string; session: Session } | null>(null)
  const [reorderOverId, setReorderOverId] = useState<string | null>(null)
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null)

  function handleSessionDragOver(e: DragEvent, dateKey: string, session: Session) {
    e.preventDefault()
    const isFromPool = e.dataTransfer.types.includes('application/x-pool')
    const isFromTemplate = e.dataTransfer.types.includes('application/x-template')
    e.dataTransfer.dropEffect = (isFromPool || isFromTemplate || e.ctrlKey || e.metaKey) ? 'copy' : 'move'
    setDropTarget({ dateKey, session })
  }

  function handleSessionDragLeave() {
    setDropTarget(null)
  }

  function handleSessionDrop(e: DragEvent, dateKey: string, session: Session) {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setReorderOverId(null)

    const data = e.dataTransfer.getData('text/plain')
    if (!data) return

    if (e.dataTransfer.types.includes('application/x-template')) {
      const items = resolveTemplate?.(data)
      if (items?.length) addEntries(dateKey, items, session)
    } else if (e.dataTransfer.types.includes('application/x-pool')) {
      addEntry(dateKey, data, getExerciseDefaults(data), session)
    } else {
      // Entry dropped on session container — append at end
      const sessionEntries = getEntriesForDateSession(dateKey, session)
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
          }, session)
        }
      } else {
        moveEntry(data, dateKey, sessionEntries.length, session)
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

  function handleEntryDrop(e: DragEvent, dateKey: string, targetIdx: number, session: Session) {
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
        }, session)
      }
    } else {
      moveEntry(draggingEntryId, dateKey, targetIdx, session)
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
        const allPlanned = getEntriesForDate(dateKey)

        return (
          <PlannerDayColumn
            key={dateKey}
            day={day}
            dateKey={dateKey}
            exercises={exercises}
            timers={timers}
            preferredUnit={preferredUnit}
            getEntriesForDate={getEntriesForDate}
            getEntriesForDateSession={getEntriesForDateSession}
            onUpdateEntry={updateEntry}
            onRemoveEntry={removeEntry}
            onSessionDragOver={handleSessionDragOver}
            onSessionDragLeave={handleSessionDragLeave}
            onSessionDrop={handleSessionDrop}
            onEntryDragStart={(e, entryId) => handleEntryDragStart(e, entryId)}
            onEntryDragEnd={handleEntryDragEnd}
            onEntryDragOver={handleEntryDragOver}
            onEntryDrop={handleEntryDrop}
            dropTarget={dropTarget}
            reorderOverId={reorderOverId}
            isDragging={(id) => draggingEntryId === id}
            hideDate
            headerActions={
              allPlanned.length > 0 ? (
                <div className="flex gap-0.5">
                  {onSaveDay && (
                    <button
                      onClick={() => handleSaveDay(dateKey)}
                      className="rounded p-0.5 text-surface-300 hover:bg-primary-50 hover:text-primary-500"
                      aria-label="Save as workout"
                      title="Save as workout"
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
              ) : undefined
            }
          />
        )
      })}
    </div>
  )
}

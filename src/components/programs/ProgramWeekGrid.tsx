import { useState, useEffect, type DragEvent } from 'react'
import { Trash2, Save } from 'lucide-react'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import PlannerDayColumn from '@/components/planner/PlannerDayColumn'

interface ProgramWeekGridProps {
  weekOffset: number
  programId: string
  programStart: Date
  exercises: Exercise[]
  onSaveDay?: (name: string, entries: PlannedEntry[]) => void
  /** Called when a template is dropped; parent resolves template exercises and calls addEntry */
  onTemplateDrop?: (dateKey: string, templateId: string, session: Session) => void
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
    getEntriesForDateSession,
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
      onTemplateDrop?.(dateKey, data, session)
    } else if (e.dataTransfer.types.includes('application/x-pool')) {
      addEntry(dateKey, data, undefined, session)
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

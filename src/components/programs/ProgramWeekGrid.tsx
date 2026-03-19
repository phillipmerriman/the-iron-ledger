import { useState, useEffect, useRef, type DragEvent } from 'react'
import { Trash2, Save, Copy, ClipboardPaste, MoreHorizontal } from 'lucide-react'
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
  /** Shared clipboard from parent for cross-week copy/paste */
  copiedDay?: { entries: PlannedEntry[] } | null
  onCopyDay?: (entries: PlannedEntry[]) => void
  /** When set, render only this day index instead of the full 7-column grid (mobile) */
  mobileDayIndex?: number
  /** Called on mount/update with the grid's internal functions so parent can trigger mobile adds */
  exposeApi?: (api: ProgramWeekGridApi) => void
}

export interface ProgramWeekGridApi {
  addEntry: (dateKey: string, exerciseId: string, presets: import('@/hooks/useWeeklyPlan').PlannedEntryUpdate | undefined, session: Session) => void
  addEntries: (dateKey: string, items: { exerciseId: string; presets?: import('@/hooks/useWeeklyPlan').PlannedEntryUpdate }[], session: Session) => void
  dateKeys: string[]
  getExerciseDefaults: (id: string) => import('@/hooks/useWeeklyPlan').PlannedEntryUpdate | undefined
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
  copiedDay: externalCopiedDay,
  onCopyDay,
  mobileDayIndex,
  exposeApi,
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

  // Expose internal functions for mobile tap-to-add from parent
  useEffect(() => {
    if (exposeApi) {
      exposeApi({ addEntry, addEntries, dateKeys, getExerciseDefaults })
    }
  })

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

  // Copy/paste day — use shared clipboard from parent if provided
  const [localCopiedDay, setLocalCopiedDay] = useState<{ entries: PlannedEntry[] } | null>(null)
  const copiedDay = externalCopiedDay !== undefined ? externalCopiedDay : localCopiedDay
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleCopyDay(dateKey: string) {
    const entries = getEntriesForDate(dateKey)
    if (entries.length === 0) return
    if (onCopyDay) {
      onCopyDay(entries)
    } else {
      setLocalCopiedDay({ entries })
    }
  }

  async function handlePasteDay(dateKey: string) {
    if (!copiedDay) return
    const bySession = new Map<Session, PlannedEntry[]>()
    for (const entry of copiedDay.entries) {
      if (!bySession.has(entry.session)) bySession.set(entry.session, [])
      bySession.get(entry.session)!.push(entry)
    }
    for (const [session, sessionEntries] of bySession) {
      await addEntries(dateKey, sessionEntries.map((e) => ({
        exerciseId: e.exercise_id,
        presets: {
          sets: e.sets,
          reps: e.reps,
          rep_type: e.rep_type,
          reps_right: e.reps_right,
          weight: e.weight,
          weight_unit: e.weight_unit,
          intensity: e.intensity,
          notes: e.notes,
          set_markers: e.set_markers,
        },
      })), session)
    }
  }

  const visibleDays = mobileDayIndex !== undefined ? [mobileDayIndex] : days.map((_, i) => i)

  return (
    <div className={mobileDayIndex !== undefined ? '' : 'grid grid-cols-7 gap-2'}>
      {visibleDays.map((i) => {
        const day = days[i]
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
              (allPlanned.length > 0 || copiedDay) ? <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === `day-${dateKey}` ? null : `day-${dateKey}`)}
                  className="rounded p-0.5 text-surface-300 hover:bg-surface-100 hover:text-surface-500"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {openMenu === `day-${dateKey}` && (
                  <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
                    {allPlanned.length > 0 && (
                      <>
                        <button onClick={() => { handleCopyDay(dateKey); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                          <Copy className="h-3.5 w-3.5" /> Copy Day
                        </button>
                        {onSaveDay && (
                          <button onClick={() => { handleSaveDay(dateKey); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                            <Save className="h-3.5 w-3.5" /> Save as Template
                          </button>
                        )}
                      </>
                    )}
                    {copiedDay && (
                      <button onClick={() => { handlePasteDay(dateKey); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                        <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                      </button>
                    )}
                    {allPlanned.length > 0 && (
                      <>
                        <div className="my-1 border-t border-surface-100" />
                        <button onClick={() => { clearDate(dateKey); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50">
                          <Trash2 className="h-3.5 w-3.5" /> Clear Day
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div> : undefined
            }
          />
        )
      })}
    </div>
  )
}

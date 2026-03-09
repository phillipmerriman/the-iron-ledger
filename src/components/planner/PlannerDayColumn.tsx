import { useState, useRef, type DragEvent, type ReactNode } from 'react'
import { X, ChevronRight, Sun, CloudSun, Moon } from 'lucide-react'
import { format, isToday } from 'date-fns'
import type { PlannedEntry, PlannedEntryUpdate, Session } from '@/hooks/useWeeklyPlan'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { TimerWithIntervals } from '@/hooks/useTimers'
import type { WeightUnit } from '@/types/common'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion } from '@/types/common'
import EntryDetailEditor from '@/components/programs/EntryDetailEditor'
import { cn } from '@/lib/utils'

const SESSION_ICONS: Record<Session, typeof Sun> = {
  morning: Sun,
  noon: CloudSun,
  night: Moon,
}

export interface PlannerDayColumnProps {
  day: Date
  dateKey: string
  exercises: Exercise[]
  timers?: TimerWithIntervals[]
  preferredUnit: WeightUnit

  // Data access
  getEntriesForDate: (dateKey: string) => PlannedEntry[]
  getEntriesForDateSession: (dateKey: string, session: Session) => PlannedEntry[]

  // Entry actions
  onUpdateEntry: (id: string, values: PlannedEntryUpdate) => void
  onRemoveEntry: (id: string) => void

  // Drag/drop — session level
  onSessionDragOver: (e: DragEvent, dateKey: string, session: Session) => void
  onSessionDragLeave: () => void
  onSessionDrop: (e: DragEvent, dateKey: string, session: Session) => void

  // Drag/drop — entry level
  onEntryDragStart: (e: DragEvent, entryId: string, dateKey: string) => void
  onEntryDragEnd: () => void
  onEntryDragOver: (e: DragEvent, entryId: string) => void
  onEntryDrop: (e: DragEvent, dateKey: string, targetIdx: number, session: Session) => void

  // Visual drag state from parent
  dropTarget: { dateKey: string; session: Session } | null
  reorderOverId: string | null
  isDragging: (entryId: string) => boolean

  // Slots for custom header/session actions
  headerActions?: ReactNode
  sessionActions?: (dateKey: string, session: Session, entries: PlannedEntry[]) => ReactNode

  // Styling
  minHeight?: string
}

export default function PlannerDayColumn({
  day,
  dateKey,
  exercises,
  timers,
  preferredUnit,
  getEntriesForDateSession,
  onUpdateEntry,
  onRemoveEntry,
  onSessionDragOver,
  onSessionDragLeave,
  onSessionDrop,
  onEntryDragStart,
  onEntryDragEnd,
  onEntryDragOver,
  onEntryDrop,
  dropTarget,
  reorderOverId,
  isDragging,
  headerActions,
  sessionActions,
  minHeight,
}: PlannerDayColumnProps) {
  const today = isToday(day)
  // Editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  // Collapse state for sessions
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set())
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set())

  function isSessionCollapsed(session: Session, isEmpty: boolean) {
    const key = `${dateKey}-${session}`
    if (isEmpty) return !manualExpanded.has(key)
    return manualCollapsed.has(key)
  }

  function toggleSession(session: Session, isEmpty: boolean) {
    const key = `${dateKey}-${session}`
    if (isEmpty) {
      setManualExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    } else {
      setManualCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }
  }

  function expandSession(session: Session) {
    const key = `${dateKey}-${session}`
    setManualCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setManualExpanded((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  // Auto-expand on drag hover timer
  const dragExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCollapsedDragOver(e: DragEvent, session: Session) {
    e.preventDefault()
    onSessionDragOver(e, dateKey, session)
    if (!dragExpandTimer.current) {
      dragExpandTimer.current = setTimeout(() => {
        expandSession(session)
        dragExpandTimer.current = null
      }, 350)
    }
  }

  function clearDragExpandTimer() {
    if (dragExpandTimer.current) {
      clearTimeout(dragExpandTimer.current)
      dragExpandTimer.current = null
    }
  }

  // Wrap parent drop to also auto-expand
  function handleSessionDropInternal(e: DragEvent, session: Session) {
    clearDragExpandTimer()
    expandSession(session)
    onSessionDrop(e, dateKey, session)
  }

  function handleSessionDragLeaveInternal() {
    onSessionDragLeave()
    clearDragExpandTimer()
  }

  function getExercise(exerciseId: string): Exercise | undefined {
    return exercises.find((ex) => ex.id === exerciseId)
  }

  function getExerciseName(exerciseId: string) {
    return exercises.find((ex) => ex.id === exerciseId)?.name ?? 'Unknown'
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border-2 border-dashed transition-colors',
        today ? 'border-primary-300 bg-primary-50/20' : 'border-surface-200 bg-white',
      )}
      style={minHeight ? { minHeight } : undefined}
    >
      {/* Day header */}
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
        {headerActions}
      </div>

      {/* Session sections */}
      <div className="flex flex-1 flex-col">
        {SESSIONS.map((session, sIdx) => {
          const sessionEntries = getEntriesForDateSession(dateKey, session)
          const isEmpty = sessionEntries.length === 0
          const collapsed = isSessionCollapsed(session, isEmpty)
          const isOver = dropTarget?.dateKey === dateKey && dropTarget?.session === session
          const Icon = SESSION_ICONS[session]

          return (
            <div key={session} className={cn(sIdx > 0 && 'border-t border-surface-100')}>
              {/* Section header */}
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400 transition-colors rounded-sm',
                  collapsed && isOver && 'bg-primary-50/60',
                )}
                onDragOver={(e) => {
                  if (collapsed) handleCollapsedDragOver(e, session)
                }}
                onDragLeave={() => {
                  if (collapsed) handleSessionDragLeaveInternal()
                }}
                onDrop={(e) => {
                  if (collapsed) handleSessionDropInternal(e, session)
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSession(session, isEmpty)}
                  className="flex items-center gap-1 hover:text-surface-600 transition-colors"
                >
                  <ChevronRight className={cn('h-2.5 w-2.5 transition-transform', !collapsed && 'rotate-90')} />
                  <Icon className="h-2.5 w-2.5" />
                  <span>{SESSION_LABELS[session]}</span>
                </button>
                {sessionEntries.length > 0 && (
                  <span className="text-surface-300">{sessionEntries.length}</span>
                )}
                {sessionActions?.(dateKey, session, sessionEntries)}
              </div>

              {/* Section body — animated with CSS grid trick */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-in-out',
                  collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                )}
                onDragOver={(e) => {
                  if (collapsed) {
                    handleCollapsedDragOver(e, session)
                  } else {
                    onSessionDragOver(e, dateKey, session)
                  }
                }}
                onDragLeave={handleSessionDragLeaveInternal}
                onDrop={(e) => handleSessionDropInternal(e, session)}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(
                      'flex flex-col gap-1 px-1.5 pb-1 min-h-[24px] transition-colors rounded-sm',
                      isOver && 'bg-primary-50/60',
                    )}
                  >
                    {sessionEntries.map((entry, idx) => {
                      const ex = getExercise(entry.exercise_id)
                      const entryColor = getExerciseColorClasses(ex?.color ?? null)
                      const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                      const isDraggedEntry = isDragging(entry.id)
                      return (
                        <div
                          key={entry.id}
                          className="relative"
                          onDragOver={(e) => onEntryDragOver(e, entry.id)}
                          onDrop={(e) => onEntryDrop(e, dateKey, idx, session)}
                        >
                          {reorderOverId === entry.id && !isDraggedEntry && (
                            <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary-500" />
                          )}
                          <div
                            draggable
                            onDragStart={(e) => onEntryDragStart(e, entry.id, dateKey)}
                            onDragEnd={onEntryDragEnd}
                            onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)}
                            title={[getExerciseName(entry.exercise_id), entry.notes].filter(Boolean).join('\n') || undefined}
                            className={cn(
                              'group flex items-start gap-1 rounded-lg border p-1.5 text-[11px] shadow-sm cursor-pointer transition-opacity',
                              ex?.color ? `${entryColor.bg} ${entryColor.border}` : 'border-surface-200 bg-white',
                              isDraggedEntry && 'opacity-30',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={cn('font-display truncate font-medium', ex?.color ? entryColor.text : 'text-surface-800')}>
                                {getExerciseName(entry.exercise_id)}
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
                              onClick={(e) => { e.stopPropagation(); onRemoveEntry(entry.id) }}
                              className="shrink-0 rounded p-0.5 text-surface-300 opacity-0 transition-opacity hover:text-danger-500 group-hover:opacity-100"
                              aria-label="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {editingEntryId === entry.id && (
                            <EntryDetailEditor
                              entry={entry}
                              exerciseName={getExerciseName(entry.exercise_id)}
                              exercises={exercises}
                              timers={timers}
                              onUpdate={onUpdateEntry}
                              onClose={() => setEditingEntryId(null)}
                            />
                          )}
                        </div>
                      )
                    })}

                    {isEmpty && (
                      <span className="py-1 text-center text-[10px] text-surface-300">Drop here</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

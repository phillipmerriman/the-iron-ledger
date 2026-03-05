import { useState, useRef, useEffect, type DragEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, Trash2, ChevronLeft, ChevronRight, Plus, Save, Sun, CloudSun, Moon, Copy, ClipboardPaste, MoreHorizontal } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import usePrograms from '@/hooks/usePrograms'
import useWorkoutTemplates from '@/hooks/useWorkoutTemplates'
import type { Exercise } from '@/types/database'
import type { ExerciseType, ExerciseRate, MuscleGroup, Equipment } from '@/types/common'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion } from '@/types/common'
import EntryDetailEditor from '@/components/programs/EntryDetailEditor'
import ExerciseForm from '@/components/exercises/ExerciseForm'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const SESSION_ICONS: Record<Session, typeof Sun> = {
  morning: Sun,
  noon: CloudSun,
  night: Moon,
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function WeeklyPlanPage() {
  const { programId } = useParams<{ programId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const fromDashboard = searchParams.get('from') === 'dashboard'
  const dashWeek = searchParams.get('dashweek')
  const dashboardLink = dashWeek ? `/?week=${dashWeek}` : '/'
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const { programs, loading: programsLoading } = usePrograms()
  const { exercises, loading: exercisesLoading, create: createExercise } = useExercises()
  const { templates, getExercisesForTemplate, saveDay, remove: removeTemplate, parseExtras } = useWorkoutTemplates()

  const program = programId ? programs.find((p) => p.id === programId) : null
  const totalWeeks = program?.weeks ?? 1
  const programStart = program?.start_date ? parseISO(program.start_date) : new Date()

  const weekOffset = Number(searchParams.get('week')) || 0
  function setWeekOffset(update: number | ((prev: number) => number)) {
    const next = typeof update === 'function' ? update(weekOffset) : update
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 0) params.delete('week')
      else params.set('week', String(next))
      return params
    }, { replace: true })
  }

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
    clearSession,
  } = useWeeklyPlan({
    startDate: programStart,
    weekOffset,
    programId: programId ?? null,
  })

  const activeExercises = exercises.filter((e) => !e.is_archived)

  // Filter exercise pool
  const [search, setSearch] = useState('')
  const filtered = activeExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

  // Editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  // Collapse state for sessions — tracks manually toggled sections
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set())
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set())

  function isSessionCollapsed(dateKey: string, session: Session, isEmpty: boolean) {
    const key = `${dateKey}-${session}`
    if (isEmpty) return !manualExpanded.has(key)
    return manualCollapsed.has(key)
  }

  function toggleSession(dateKey: string, session: Session, isEmpty: boolean) {
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

  function expandSession(dateKey: string, session: Session) {
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

  // Drag state
  const [dragSource, setDragSource] = useState<
    | { type: 'pool'; exerciseId: string }
    | { type: 'entry'; entryId: string; fromDate: string }
    | { type: 'template'; templateId: string }
    | null
  >(null)
  const [dropTarget, setDropTarget] = useState<{ dateKey: string; session: Session } | null>(null)
  const [reorderOverId, setReorderOverId] = useState<string | null>(null)

  // New exercise modal
  const [newExerciseOpen, setNewExerciseOpen] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<{ type: 'day'; dateKey: string; entries: PlannedEntry[] } | { type: 'session'; dateKey: string; session: Session; entries: PlannedEntry[] } | null>(null)

  // Context menu state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenu])

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

  function getExerciseName(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  function getExercise(exerciseId: string): Exercise | undefined {
    return exercises.find((e) => e.id === exerciseId)
  }

  function handlePoolDragStart(e: DragEvent, exerciseId: string) {
    setDragSource({ type: 'pool', exerciseId })
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', exerciseId)
  }

  function handleTemplateDragStart(e: DragEvent, templateId: string) {
    setDragSource({ type: 'template', templateId })
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', templateId)
  }

  function handleEntryDragStart(e: DragEvent, entryId: string, fromDate: string) {
    setDragSource({ type: 'entry', entryId, fromDate })
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', entryId)
  }

  function handleSessionDragOver(e: DragEvent, dateKey: string, session: Session) {
    e.preventDefault()
    if (dragSource?.type === 'entry') {
      e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move'
    } else {
      e.dataTransfer.dropEffect = 'copy'
    }
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
    if (!dragSource) return

    // Auto-expand the target section
    expandSession(dateKey, session)

    if (dragSource.type === 'pool') {
      addEntry(dateKey, dragSource.exerciseId, undefined, session)
    } else if (dragSource.type === 'template') {
      handleTemplateDrop(dateKey, dragSource.templateId, session)
    } else if (dragSource.type === 'entry') {
      const sessionEntries = getEntriesForDateSession(dateKey, session)
      if (e.ctrlKey || e.metaKey) {
        const source = dateKeys.flatMap((dk) => getEntriesForDate(dk)).find((en) => en.id === dragSource.entryId)
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
        moveEntry(dragSource.entryId, dateKey, sessionEntries.length, session)
      }
    }
    setDragSource(null)
  }

  function handleTemplateDrop(dateKey: string, templateId: string, session: Session) {
    const exercises = getExercisesForTemplate(templateId)
    for (const tex of exercises) {
      const extras = parseExtras(tex.notes)
      addEntry(dateKey, tex.exercise_id, {
        sets: tex.target_sets,
        reps: extras.rep_type === 'time' ? tex.target_duration_sec : tex.target_reps,
        rep_type: extras.rep_type,
        reps_right: extras.reps_right,
        weight: tex.target_weight,
        weight_unit: extras.weight_unit,
      }, session)
    }
  }

  function handleDragEnd() {
    setDragSource(null)
    setDropTarget(null)
    setReorderOverId(null)
  }

  function handleEntryDragOver(e: DragEvent, entryId: string) {
    if (dragSource?.type !== 'entry') return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move'
    setReorderOverId(entryId)
  }

  function handleEntryDrop(e: DragEvent, dateKey: string, targetIdx: number, session: Session) {
    if (dragSource?.type !== 'entry') return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setReorderOverId(null)

    if (e.ctrlKey || e.metaKey) {
      const source = dateKeys.flatMap((dk) => getEntriesForDate(dk)).find((en) => en.id === dragSource.entryId)
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
      moveEntry(dragSource.entryId, dateKey, targetIdx, session)
    }
    setDragSource(null)
  }

  function handleSaveDay(dateKey: string) {
    const planned = getEntriesForDate(dateKey)
    if (planned.length === 0) return
    const name = window.prompt('Template name:')
    if (!name?.trim()) return
    saveDay(name.trim(), planned)
  }

  function handleCopyDay(dateKey: string) {
    const entries = getEntriesForDate(dateKey)
    if (entries.length === 0) return
    setClipboard({ type: 'day', dateKey, entries })
  }

  function handlePasteDay(dateKey: string) {
    if (!clipboard) return
    const entries = clipboard.entries
    for (const entry of entries) {
      const targetSession = clipboard.type === 'session' ? clipboard.session : entry.session
      addEntry(dateKey, entry.exercise_id, {
        sets: entry.sets,
        reps: entry.reps,
        rep_type: entry.rep_type,
        reps_right: entry.reps_right,
        weight: entry.weight,
        weight_unit: entry.weight_unit,
        intensity: entry.intensity,
        notes: entry.notes,
      }, targetSession)
    }
  }

  function handleCopySession(dateKey: string, session: Session) {
    const entries = getEntriesForDateSession(dateKey, session)
    if (entries.length === 0) return
    setClipboard({ type: 'session', dateKey, session, entries })
  }

  function handlePasteSession(dateKey: string, session: Session) {
    if (!clipboard) return
    for (const entry of clipboard.entries) {
      addEntry(dateKey, entry.exercise_id, {
        sets: entry.sets,
        reps: entry.reps,
        rep_type: entry.rep_type,
        reps_right: entry.reps_right,
        weight: entry.weight,
        weight_unit: entry.weight_unit,
        intensity: entry.intensity,
        notes: entry.notes,
      }, session)
    }
  }

  if (programsLoading || exercisesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (programId && !program) {
    return (
      <div className="space-y-4">
        <Link to={fromDashboard ? dashboardLink : '/programs'} className="inline-flex items-center gap-1 text-sm text-primary-600">
          <ArrowLeft className="h-4 w-4" /> {fromDashboard ? 'Dashboard' : 'Programs'}
        </Link>
        <p className="text-surface-500">Program not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={fromDashboard ? dashboardLink : program ? `/programs/${program.id}` : '/'}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-500"
          >
            <ArrowLeft className="h-4 w-4" /> {fromDashboard ? 'Dashboard' : program ? program.name : 'Dashboard'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {program ? `Plan: ${program.name}` : 'Plan Your Week'}
          </h1>
          <p className="text-sm text-surface-500">
            Drag exercises or saved workouts from the pool into each day.
          </p>
        </div>
      </div>

      {/* Week navigation */}
      {program && totalWeeks > 1 ? (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-surface-700">
            Week {weekOffset + 1} of {totalWeeks}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={weekOffset >= totalWeeks - 1}
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-xs text-surface-400">
            {format(days[0], 'MMM d')} – {format(days[6], 'MMM d, yyyy')}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-surface-700">
            {format(days[0], 'MMM d')} – {format(days[6], 'MMM d, yyyy')}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWeekOffset(0)}
              className="text-xs"
            >
              Today
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {/* Day columns */}
        <div className="grid flex-1 grid-cols-7 gap-2">
          {days.map((day, i) => {
            const dateKey = dateKeys[i]
            const today = isToday(day)
            const allPlanned = getEntriesForDate(dateKey)

            return (
              <div
                key={dateKey}
                className={cn(
                  'flex min-h-[300px] flex-col rounded-xl border-2 border-dashed transition-colors',
                  today ? 'border-primary-300 bg-primary-50/20' : 'border-surface-200 bg-white',
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
                  {(allPlanned.length > 0 || clipboard) && (
                    <div className="relative">
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
                              <button onClick={() => { handleSaveDay(dateKey); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                                <Save className="h-3.5 w-3.5" /> Save as Template
                              </button>
                            </>
                          )}
                          {clipboard && (
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
                    </div>
                  )}
                </div>

                {/* Session sections */}
                <div className="flex flex-1 flex-col">
                  {SESSIONS.map((session, sIdx) => {
                    const sessionEntries = getEntriesForDateSession(dateKey, session)
                    const isEmpty = sessionEntries.length === 0
                    const collapsed = isSessionCollapsed(dateKey, session, isEmpty)
                    const isOver = dropTarget?.dateKey === dateKey && dropTarget?.session === session
                    const Icon = SESSION_ICONS[session]

                    return (
                      <div key={session} className={cn(sIdx > 0 && 'border-t border-surface-100')}>
                        {/* Section header */}
                        <div className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-400">
                          <button
                            type="button"
                            onClick={() => toggleSession(dateKey, session, isEmpty)}
                            className="flex items-center gap-1 hover:text-surface-600 transition-colors"
                          >
                            <ChevronRight className={cn('h-2.5 w-2.5 transition-transform', !collapsed && 'rotate-90')} />
                            <Icon className="h-2.5 w-2.5" />
                            <span>{SESSION_LABELS[session]}</span>
                          </button>
                          {sessionEntries.length > 0 && (
                            <span className="text-surface-300">{sessionEntries.length}</span>
                          )}
                          {(sessionEntries.length > 0 || clipboard) && (
                            <div className="relative ml-auto">
                              <button
                                onClick={() => setOpenMenu(openMenu === `ses-${dateKey}-${session}` ? null : `ses-${dateKey}-${session}`)}
                                className="rounded p-0.5 text-surface-300 hover:text-surface-500"
                              >
                                <MoreHorizontal className="h-2.5 w-2.5" />
                              </button>
                              {openMenu === `ses-${dateKey}-${session}` && (
                                <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
                                  {sessionEntries.length > 0 && (
                                    <button onClick={() => { handleCopySession(dateKey, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                                      <Copy className="h-3.5 w-3.5" /> Copy
                                    </button>
                                  )}
                                  {clipboard && (
                                    <button onClick={() => { handlePasteSession(dateKey, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                                      <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                                    </button>
                                  )}
                                  {sessionEntries.length > 0 && (
                                    <>
                                      <div className="my-1 border-t border-surface-100" />
                                      <button onClick={() => { clearSession(dateKey, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50">
                                        <Trash2 className="h-3.5 w-3.5" /> Clear
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Section body */}
                        {!collapsed && (
                          <div
                            onDragOver={(e) => handleSessionDragOver(e, dateKey, session)}
                            onDragLeave={handleSessionDragLeave}
                            onDrop={(e) => handleSessionDrop(e, dateKey, session)}
                            className={cn(
                              'flex flex-col gap-1 px-1.5 pb-1 min-h-[24px] transition-colors rounded-sm',
                              isOver && 'bg-primary-50/60',
                            )}
                          >
                            {sessionEntries.map((entry, idx) => {
                              const ex = getExercise(entry.exercise_id)
                              const entryColor = getExerciseColorClasses(ex?.color ?? null)
                              const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                              const isDraggedEntry = dragSource?.type === 'entry' && dragSource.entryId === entry.id
                              return (
                                <div
                                  key={entry.id}
                                  className="relative"
                                  onDragOver={(e) => handleEntryDragOver(e, entry.id)}
                                  onDrop={(e) => handleEntryDrop(e, dateKey, idx, session)}
                                >
                                  {reorderOverId === entry.id && dragSource?.type === 'entry' && dragSource.entryId !== entry.id && (
                                    <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary-500" />
                                  )}
                                  <div
                                    draggable
                                    onDragStart={(e) => handleEntryDragStart(e, entry.id, dateKey)}
                                    onDragEnd={handleDragEnd}
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
                                      exerciseName={getExerciseName(entry.exercise_id)}
                                      exercises={exercises}
                                      onUpdate={updateEntry}
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
                        )}

                        {/* Collapsed drop zone */}
                        {collapsed && (
                          <div
                            onDragOver={(e) => { e.preventDefault(); handleSessionDragOver(e, dateKey, session) }}
                            onDragLeave={handleSessionDragLeave}
                            onDrop={(e) => handleSessionDrop(e, dateKey, session)}
                            className={cn(
                              'mx-1 h-1 rounded transition-colors',
                              isOver && 'bg-primary-300',
                            )}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-primary-300 transition-colors',
                          exercise.color ? `${poolColor.bg} ${poolColor.border}` : 'border-surface-200 bg-surface-50',
                        )}
                      >
                        <p className={cn('font-display text-xs font-medium truncate', exercise.color ? poolColor.text : 'text-surface-800')}>
                          {exercise.name}
                        </p>
                        <div className="mt-0.5 flex gap-1">
                          <Badge className="!text-[9px] !px-1 !py-0">{formatLabel(exercise.primary_muscle)}</Badge>
                          <Badge className="!text-[9px] !px-1 !py-0">{formatLabel(exercise.equipment)}</Badge>
                        </div>
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
                        onDragEnd={handleDragEnd}
                        className="group flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-primary-300 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-xs font-medium truncate text-surface-800">
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
    </div>
  )
}

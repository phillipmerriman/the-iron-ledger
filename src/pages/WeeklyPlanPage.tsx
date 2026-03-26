import { useState, useRef, useEffect, type DragEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, Trash2, ChevronLeft, ChevronRight, Plus, Save, Copy, ClipboardPaste, MoreHorizontal, Check, Dumbbell, UtensilsCrossed } from 'lucide-react'
import { format, parseISO, isToday } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import useWeeklyPlan from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import usePrograms from '@/hooks/usePrograms'
import useWorkoutTemplates from '@/hooks/useWorkoutTemplates'
import useTimers from '@/hooks/useTimers'
import useMealPlan from '@/hooks/useMealPlan'
import useRecipes from '@/hooks/useRecipes'
import type { MealSlot, MacroData } from '@/types/meal-types'
import MealPlannerDayColumn from '@/components/meals/MealPlannerDayColumn'
import RecipePicker from '@/components/meals/RecipePicker'
import type { ExerciseType, ExerciseRate, MuscleGroup, Equipment, RepType, WeightUnit } from '@/types/common'
import { getExerciseColorClasses } from '@/types/common'
import ExerciseForm from '@/components/exercises/ExerciseForm'
import PlannerDayColumn from '@/components/planner/PlannerDayColumn'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type PlanMode = 'workouts' | 'meals'

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
  const { programs, activations, loading: programsLoading } = usePrograms()
  const activationIds = programId ? undefined : activations.map((a) => a.id)
  const { exercises, loading: exercisesLoading, create: createExercise } = useExercises()
  const { templates, getExercisesForTemplate, saveDay, remove: removeTemplate, parseExtras } = useWorkoutTemplates()
  const { timers } = useTimers()

  // Plan mode toggle (workouts vs meals)
  const planMode = (searchParams.get('mode') as PlanMode) || 'workouts'
  function setPlanMode(mode: PlanMode) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (mode === 'workouts') params.delete('mode')
      else params.set('mode', mode)
      return params
    }, { replace: true })
  }

  // Meal planning hooks
  const { recipes, loading: recipesLoading } = useRecipes()

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
    addEntries,
    updateEntry,
    removeEntry,
    moveEntry,
    clearDate,
    clearSession,
  } = useWeeklyPlan({
    startDate: programStart,
    weekOffset,
    programId: programId ?? null,
    programIds: activationIds,
  })

  const mealPlan = useMealPlan({
    startDate: programStart,
    weekOffset,
  })

  // Compute per-serving macros for each recipe (used by meal planner)
  const [recipeMacrosMap, setRecipeMacrosMap] = useState<Map<string, MacroData>>(new Map())

  // Meal drag state
  const [mealDragRecipeId, setMealDragRecipeId] = useState<string | null>(null)
  const [mealDropTarget, setMealDropTarget] = useState<{ dateKey: string; slot: MealSlot } | null>(null)

  function handleMealRecipeDragStart(e: DragEvent, recipeId: string) {
    setMealDragRecipeId(recipeId)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', recipeId)
  }

  function handleMealDragEnd() {
    setMealDragRecipeId(null)
    setMealDropTarget(null)
  }

  function handleMealSlotDragOver(e: DragEvent, dateKey: string, slot: MealSlot) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setMealDropTarget({ dateKey, slot })
  }

  function handleMealSlotDragLeave() {
    setMealDropTarget(null)
  }

  function handleMealSlotDrop(e: DragEvent, dateKey: string, slot: MealSlot) {
    e.preventDefault()
    setMealDropTarget(null)
    if (mealDragRecipeId) {
      mealPlan.addMeal(dateKey, mealDragRecipeId, slot)
    }
    setMealDragRecipeId(null)
  }

  const activeExercises = exercises.filter((e) => !e.is_archived)

  /** Look up exercise defaults and merge with any explicit presets */
  function getExerciseDefaults(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId)
    if (!ex) return undefined
    const hasDefaults = ex.default_sets != null || ex.default_reps != null || ex.default_weight != null || ex.default_intensity != null
    if (!hasDefaults && ex.default_rep_type === 'single' && ex.default_weight_unit === 'lbs') return undefined
    return {
      sets: ex.default_sets,
      reps: ex.default_reps,
      rep_type: ex.default_rep_type as import('@/types/common').RepType,
      weight: ex.default_weight,
      weight_unit: ex.default_weight_unit as import('@/types/common').WeightUnit,
      intensity: ex.default_intensity,
    }
  }

  // Filter exercise pool
  const [search, setSearch] = useState('')
  const filtered = activeExercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  )

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
  const [clipboard, setClipboard] = useState<
    | { type: 'day'; dateKey: string; entries: PlannedEntry[] }
    | { type: 'session'; dateKey: string; session: Session; entries: PlannedEntry[] }
    | { type: 'week'; entries: (PlannedEntry & { dayIndex: number })[] }
    | null
  >(null)

  // Mobile state
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    const todayIdx = days.findIndex((d) => isToday(d))
    return todayIdx >= 0 ? todayIdx : 0
  })
  const [exercisePoolOpen, setExercisePoolOpen] = useState(false)
  const [mobileSession, setMobileSession] = useState<Session>('morning')
  const [addedFlash, setAddedFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flashAdded(id: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setAddedFlash(id)
    flashTimer.current = setTimeout(() => setAddedFlash(null), 800)
  }

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
    default_sets: number | null
    default_reps: number | null
    default_rep_type: RepType
    default_weight: number | null
    default_weight_unit: WeightUnit
    default_intensity: 'light' | 'heavy' | null
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

    if (dragSource.type === 'pool') {
      addEntry(dateKey, dragSource.exerciseId, getExerciseDefaults(dragSource.exerciseId), session)
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
    const items = exercises.map((tex) => {
      const extras = parseExtras(tex.notes)
      return {
        exerciseId: tex.exercise_id,
        presets: {
          sets: tex.target_sets,
          reps: extras.rep_type === 'time' ? tex.target_duration_sec : tex.target_reps,
          rep_type: extras.rep_type,
          reps_right: extras.reps_right,
          weight: tex.target_weight,
          weight_unit: extras.weight_unit,
          timer_id: extras.timer_id,
        },
      }
    })
    addEntries(dateKey, items, session)
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

  async function handlePasteDay(dateKey: string) {
    if (!clipboard) return
    const clipEntries = clipboard.entries
    // Group entries by target session to preserve order within each session
    const bySession = new Map<Session, PlannedEntry[]>()
    for (const entry of clipEntries) {
      const targetSession = clipboard.type === 'session' ? clipboard.session : entry.session
      if (!bySession.has(targetSession)) bySession.set(targetSession, [])
      bySession.get(targetSession)!.push(entry)
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

  function handleCopySession(dateKey: string, session: Session) {
    const entries = getEntriesForDateSession(dateKey, session)
    if (entries.length === 0) return
    setClipboard({ type: 'session', dateKey, session, entries })
  }

  async function handlePasteSession(dateKey: string, session: Session) {
    if (!clipboard) return
    await addEntries(dateKey, clipboard.entries.map((e) => ({
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

  function handleCopyWeek() {
    const weekEntries: (PlannedEntry & { dayIndex: number })[] = []
    for (let i = 0; i < dateKeys.length; i++) {
      const dayEntries = getEntriesForDate(dateKeys[i])
      for (const entry of dayEntries) {
        weekEntries.push({ ...entry, dayIndex: i })
      }
    }
    if (weekEntries.length === 0) return
    setClipboard({ type: 'week', entries: weekEntries })
  }

  async function handlePasteWeek() {
    if (!clipboard || clipboard.type !== 'week') return
    const byDaySession = new Map<string, (PlannedEntry & { dayIndex: number })[]>()
    for (const entry of clipboard.entries) {
      const key = `${entry.dayIndex}|${entry.session}`
      if (!byDaySession.has(key)) byDaySession.set(key, [])
      byDaySession.get(key)!.push(entry)
    }
    for (const [key, groupEntries] of byDaySession) {
      const [dayIdxStr, session] = key.split('|')
      const dayIdx = Number(dayIdxStr)
      const targetDate = dateKeys[dayIdx]
      if (!targetDate) continue
      await addEntries(targetDate, groupEntries.map((e) => ({
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
      })), session as Session)
    }
  }

  function handleMobileTapExercise(exerciseId: string) {
    addEntry(dateKeys[mobileDayIndex], exerciseId, getExerciseDefaults(exerciseId), mobileSession)
    flashAdded(exerciseId)
  }

  function handleMobileTapTemplate(templateId: string) {
    handleTemplateDrop(dateKeys[mobileDayIndex], templateId, mobileSession)
    flashAdded(templateId)
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
            {planMode === 'workouts' ? (
              <>
                <span className="hidden md:inline">Drag exercises or saved workouts from the pool into each day.</span>
                <span className="md:hidden">Tap + to add exercises to your day.</span>
              </>
            ) : (
              <>
                <span className="hidden md:inline">Drag recipes from the sidebar into each day's meal slots.</span>
                <span className="md:hidden">Tap a recipe to add it to your meal plan.</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Mode toggle: Workouts / Meals */}
      {!programId && (
        <div className="flex rounded-lg border border-border bg-surface-50 p-0.5 w-fit">
          <button
            onClick={() => setPlanMode('workouts')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              planMode === 'workouts'
                ? 'bg-card text-primary-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700',
            )}
          >
            <Dumbbell className="h-4 w-4" /> Workouts
          </button>
          <button
            onClick={() => setPlanMode('meals')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              planMode === 'meals'
                ? 'bg-card text-primary-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-700',
            )}
          >
            <UtensilsCrossed className="h-4 w-4" /> Meals
          </button>
        </div>
      )}

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
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleCopyWeek} title="Copy Week">
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Copy Week</span>
            </Button>
            {clipboard?.type === 'week' && (
              <Button size="sm" variant="ghost" onClick={handlePasteWeek} title="Paste Week">
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1 text-xs">Paste Week</span>
              </Button>
            )}
          </div>
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
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleCopyWeek} title="Copy Week">
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1 text-xs">Copy Week</span>
            </Button>
            {clipboard?.type === 'week' && (
              <Button size="sm" variant="ghost" onClick={handlePasteWeek} title="Paste Week">
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1 text-xs">Paste Week</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ---- Mobile day-by-day view (workouts) ---- */}
      {planMode === 'workouts' && <div className="md:hidden">
        {/* Day tabs */}
        <div className="mb-3 flex gap-1 overflow-x-auto">
          {days.map((day, i) => (
            <button
              key={dateKeys[i]}
              onClick={() => setMobileDayIndex(i)}
              className={cn(
                'flex-1 min-w-0 rounded-lg px-1 py-1.5 text-center text-xs font-semibold transition-colors',
                mobileDayIndex === i
                  ? 'bg-primary-500 text-on-primary'
                  : isToday(day) ? 'bg-primary-50 text-primary-600' : 'text-surface-500 hover:bg-surface-100',
              )}
            >
              <div>{format(day, 'EEE')}</div>
              <div className="text-[10px] opacity-75">{format(day, 'M/d')}</div>
            </button>
          ))}
        </div>

        {/* Single day column */}
        <PlannerDayColumn
          key={dateKeys[mobileDayIndex]}
          day={days[mobileDayIndex]}
          dateKey={dateKeys[mobileDayIndex]}
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
          onEntryDragStart={handleEntryDragStart}
          onEntryDragEnd={handleDragEnd}
          onEntryDragOver={handleEntryDragOver}
          onEntryDrop={handleEntryDrop}
          dropTarget={dropTarget}
          reorderOverId={reorderOverId}
          isDragging={(id) => dragSource?.type === 'entry' && dragSource.entryId === id}
          minHeight="200px"
          headerActions={
            (() => {
              const allPlanned = getEntriesForDate(dateKeys[mobileDayIndex])
              return (allPlanned.length > 0 || clipboard) ? (
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === `day-m` ? null : `day-m`)}
                    className="rounded p-0.5 text-surface-300 hover:bg-surface-100 hover:text-surface-500"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {openMenu === `day-m` && (
                    <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-surface-200 bg-card py-1 shadow-lg">
                      {allPlanned.length > 0 && (
                        <>
                          <button onClick={() => { handleCopyDay(dateKeys[mobileDayIndex]); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                            <Copy className="h-3.5 w-3.5" /> Copy Day
                          </button>
                          <button onClick={() => { handleSaveDay(dateKeys[mobileDayIndex]); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                            <Save className="h-3.5 w-3.5" /> Save as Template
                          </button>
                        </>
                      )}
                      {clipboard && (
                        <button onClick={() => { handlePasteDay(dateKeys[mobileDayIndex]); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                          <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                        </button>
                      )}
                      {allPlanned.length > 0 && (
                        <>
                          <div className="my-1 border-t border-surface-100" />
                          <button onClick={() => { clearDate(dateKeys[mobileDayIndex]); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50">
                            <Trash2 className="h-3.5 w-3.5" /> Clear Day
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : undefined
            })()
          }
          sessionActions={(dk, session, sessionEntries) =>
            (sessionEntries.length > 0 || clipboard) ? (
              <div className="relative ml-auto">
                <button
                  onClick={() => setOpenMenu(openMenu === `ses-${dk}-${session}` ? null : `ses-${dk}-${session}`)}
                  className="rounded p-0.5 text-surface-300 hover:text-surface-500"
                >
                  <MoreHorizontal className="h-2.5 w-2.5" />
                </button>
                {openMenu === `ses-${dk}-${session}` && (
                  <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-surface-200 bg-card py-1 shadow-lg">
                    {sessionEntries.length > 0 && (
                      <button onClick={() => { handleCopySession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                    )}
                    {clipboard && (
                      <button onClick={() => { handlePasteSession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                        <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                      </button>
                    )}
                    {sessionEntries.length > 0 && (
                      <>
                        <div className="my-1 border-t border-surface-100" />
                        <button onClick={() => { clearSession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50">
                          <Trash2 className="h-3.5 w-3.5" /> Clear
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null
          }
        />

        {/* FAB to open exercise pool */}
        <button
          onClick={() => setExercisePoolOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-on-primary shadow-lg hover:bg-primary-600 active:bg-primary-700"
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Mobile exercise pool modal */}
        <Modal open={exercisePoolOpen} onClose={() => setExercisePoolOpen(false)} title={<>Add Exercise<br /><span className="text-sm font-normal text-surface-500">{format(days[mobileDayIndex], 'EEEE, MMM d')}</span></>}>
          <div className="space-y-3">
            {/* Session picker */}
            <div className="flex gap-1">
              {(['morning', 'noon', 'night'] as Session[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setMobileSession(s)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                    mobileSession === s
                      ? 'bg-primary-500 text-on-primary'
                      : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                  )}
                >
                  {s === 'morning' ? 'Morning' : s === 'noon' ? 'Noon' : 'Night'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search exercises..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-surface-400 hover:text-surface-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Exercise list */}
            <div className="max-h-[40vh] space-y-1 overflow-y-auto">
              {filtered.map((exercise) => {
                const poolColor = getExerciseColorClasses(exercise.color)
                const justAdded = addedFlash === exercise.id
                return (
                  <button
                    key={exercise.id}
                    onClick={() => handleMobileTapExercise(exercise.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary-300',
                      justAdded ? 'border-success-400 bg-success-50' : exercise.color ? `${poolColor.bg} ${poolColor.border} force-light` : 'border-surface-200 bg-surface-50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn('font-display text-sm font-medium', exercise.color ? poolColor.text : 'text-surface-800')}>
                        {exercise.name}
                      </p>
                      {justAdded && <Check className="h-4 w-4 text-success-600" />}
                    </div>
                    <div className="mt-0.5 flex gap-1">
                      <Badge className="!text-[9px] !px-1 !py-0">{formatLabel(exercise.primary_muscle)}</Badge>
                      <Badge className="!text-[9px] !px-1 !py-0">{formatLabel(exercise.equipment)}</Badge>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-surface-400">
                  {activeExercises.length === 0 ? 'Add exercises first' : 'No matches'}
                </p>
              )}
            </div>

            {/* Saved workouts */}
            {templates.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-surface-500">Saved Workouts</h4>
                <div className="space-y-1">
                  {templates.map((tmpl) => {
                    const count = getExercisesForTemplate(tmpl.id).length
                    const justAdded = addedFlash === tmpl.id
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => handleMobileTapTemplate(tmpl.id)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary-300',
                          justAdded ? 'border-success-400 bg-success-50' : 'border-surface-200 bg-surface-50',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-display text-sm font-medium text-surface-800">{tmpl.name}</p>
                          {justAdded && <Check className="h-4 w-4 text-success-600" />}
                        </div>
                        <p className="text-xs text-surface-400">{count} {count === 1 ? 'exercise' : 'exercises'}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* New exercise button */}
            <button
              onClick={() => { setExercisePoolOpen(false); setNewExerciseOpen(true) }}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-surface-300 py-2 text-xs font-medium text-surface-500 hover:border-primary-300 hover:text-primary-600"
            >
              <Plus className="h-3.5 w-3.5" /> New Exercise
            </button>
          </div>
        </Modal>
      </div>}

      {/* ---- Meals Desktop layout ---- */}
      {planMode === 'meals' && (
        <div className="hidden md:flex md:gap-4">
          <div className="grid flex-1 grid-cols-7 gap-2">
            {mealPlan.days.map((day, i) => {
              const dateKey = mealPlan.dateKeys[i]
              return (
                <MealPlannerDayColumn
                  key={dateKey}
                  day={day}
                  dateKey={dateKey}
                  recipes={recipes}
                  recipeMacros={recipeMacrosMap}
                  getEntriesForDateSlot={mealPlan.getEntriesForDateSlot}
                  onUpdateMeal={mealPlan.updateMeal}
                  onRemoveMeal={mealPlan.removeMeal}
                  onSlotDragOver={handleMealSlotDragOver}
                  onSlotDragLeave={handleMealSlotDragLeave}
                  onSlotDrop={handleMealSlotDrop}
                  dropTarget={mealDropTarget}
                />
              )
            })}
          </div>

          {/* Recipe sidebar */}
          <div className="w-56 shrink-0">
            <div className="sticky top-6 rounded-xl border border-surface-200 bg-card p-3 max-h-[80vh]">
              <RecipePicker
                recipes={recipes}
                recipeMacros={recipeMacrosMap}
                onDragStart={handleMealRecipeDragStart}
                onDragEnd={handleMealDragEnd}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---- Meals Mobile layout ---- */}
      {planMode === 'meals' && (
        <div className="md:hidden space-y-3">
          {mealPlan.days.map((day, i) => {
            const dateKey = mealPlan.dateKeys[i]
            return (
              <MealPlannerDayColumn
                key={dateKey}
                day={day}
                dateKey={dateKey}
                recipes={recipes}
                recipeMacros={recipeMacrosMap}
                getEntriesForDateSlot={mealPlan.getEntriesForDateSlot}
                onUpdateMeal={mealPlan.updateMeal}
                onRemoveMeal={mealPlan.removeMeal}
                onSlotDragOver={handleMealSlotDragOver}
                onSlotDragLeave={handleMealSlotDragLeave}
                onSlotDrop={handleMealSlotDrop}
                dropTarget={mealDropTarget}
              />
            )
          })}
        </div>
      )}

      {/* ---- Desktop layout ---- */}
      {planMode === 'workouts' && <div className="hidden md:flex md:gap-4">
        {/* Day columns */}
        <div className="grid flex-1 grid-cols-7 gap-2">
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
                onEntryDragStart={handleEntryDragStart}
                onEntryDragEnd={handleDragEnd}
                onEntryDragOver={handleEntryDragOver}
                onEntryDrop={handleEntryDrop}
                dropTarget={dropTarget}
                reorderOverId={reorderOverId}
                isDragging={(id) => dragSource?.type === 'entry' && dragSource.entryId === id}
                minHeight="300px"
                headerActions={
                  (allPlanned.length > 0 || clipboard) ? (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === `day-${dateKey}` ? null : `day-${dateKey}`)}
                        className="rounded p-0.5 text-surface-300 hover:bg-surface-100 hover:text-surface-500"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {openMenu === `day-${dateKey}` && (
                        <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-surface-200 bg-card py-1 shadow-lg">
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
                  ) : undefined
                }
                sessionActions={(dk, session, sessionEntries) =>
                  (sessionEntries.length > 0 || clipboard) ? (
                    <div className="relative ml-auto">
                      <button
                        onClick={() => setOpenMenu(openMenu === `ses-${dk}-${session}` ? null : `ses-${dk}-${session}`)}
                        className="rounded p-0.5 text-surface-300 hover:text-surface-500"
                      >
                        <MoreHorizontal className="h-2.5 w-2.5" />
                      </button>
                      {openMenu === `ses-${dk}-${session}` && (
                        <div ref={menuRef} className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-surface-200 bg-card py-1 shadow-lg">
                          {sessionEntries.length > 0 && (
                            <button onClick={() => { handleCopySession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                          )}
                          {clipboard && (
                            <button onClick={() => { handlePasteSession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50">
                              <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                            </button>
                          )}
                          {sessionEntries.length > 0 && (
                            <>
                              <div className="my-1 border-t border-surface-100" />
                              <button onClick={() => { clearSession(dk, session); setOpenMenu(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50">
                                <Trash2 className="h-3.5 w-3.5" /> Clear
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null
                }
              />
            )
          })}
        </div>

        {/* Sidebar pools */}
        <div className="w-56 shrink-0">
          <div className="sticky top-6 space-y-3">
            {/* Exercise pool */}
            <div className="rounded-xl border border-surface-200 bg-card">
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
                          exercise.color ? `${poolColor.bg} ${poolColor.border} force-light` : 'border-surface-200 bg-surface-50',
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
            <div className="rounded-xl border border-surface-200 bg-card">
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
      </div>}

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

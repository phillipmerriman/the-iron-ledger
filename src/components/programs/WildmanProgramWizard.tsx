import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import useExercises from '@/hooks/useExercises'
import useTimers from '@/hooks/useTimers'
import { SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Program, ProgramActivation, InsertDto, Json } from '@/types/database'
import type { RepType, WeightUnit } from '@/types/common'
import { WEIGHT_UNIT_OPTIONS, convertWeight } from '@/types/common'
import type { IncrementMode, WildmanConfig, WildmanStage } from '@/types/program-templates'
import { getProgramTemplate } from '@/lib/program-templates'
import {
  WILDMAN_REP_TYPES,
  buildStages,
  projectStats,
  stageKey,
  stageLabel,
  weightEquivalent,
} from '@/lib/program-templates/wildman'
import { autoTimerDraftForSets, findMatchingTimers } from '@/lib/program-templates/timers'
import TimerEditor from '@/components/timers/TimerEditor'
import {
  emptyTimerValue,
  formatDuration,
  intervalsForSave,
  timerValueFrom,
  totalDuration,
  type TimerEditorValue,
} from '@/components/timers/timer-draft'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'

interface WildmanProgramWizardProps {
  onCreate: (values: Omit<InsertDto<'programs'>, 'user_id'>) => Promise<Program | undefined>
  onActivate: (programId: string, startDate: string, program?: Program) => Promise<ProgramActivation | undefined>
  onDone: () => void
  onBack: () => void
}

const STEPS = ['Exercise', 'Weight', 'Reps & Sets', 'Time of Day', 'Days', 'Start Date', 'Progression', 'Timers', 'Review'] as const

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const BODY_WEIGHT_UNITS = WEIGHT_UNIT_OPTIONS.filter((o) => o.value === 'lbs' || o.value === 'kg')

/**
 * Per-stage timer choice. "auto" shares one timer per set count (one 1-minute interval per set,
 * pausing between sets); "manual" is a timer the user builds from scratch for that stage.
 */
type StageTimerChoice =
  | { mode: 'none' }
  | { mode: 'existing'; timerId: string }
  | { mode: 'manual'; draft: TimerEditorValue }
  | { mode: 'auto' }

const TIMER_OPTION_LABELS = { none: 'No timer', manual: 'Create timer (manual)', auto: 'Create timer (auto)' }

const rangeOptions = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: String(min + i) }))

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export default function WildmanProgramWizard({ onCreate, onActivate, onDone, onBack }: WildmanProgramWizardProps) {
  const { profile, updateProfile } = useAuth()
  const preferredUnit: WeightUnit = profile?.preferred_weight_unit ?? 'lbs'
  const { exercises } = useExercises()
  const { timers, create: createTimer } = useTimers()
  const template = getProgramTemplate('wildman_reverse_ladder')

  const [step, setStep] = useState(0)
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState<string>('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(preferredUnit)
  // Body weight starts from the profile (Settings) and is saved back there on activate
  const [bodyWeight, setBodyWeight] = useState<string>(profile?.body_weight != null ? String(profile.body_weight) : '')
  const [bodyWeightUnit, setBodyWeightUnit] = useState<WeightUnit>(
    profile?.body_weight_unit ?? (preferredUnit === 'kg' ? 'kg' : 'lbs'),
  )
  const [repType, setRepType] = useState<RepType>('double_reverse_ladder')
  const [minReps, setMinReps] = useState(2)
  const [maxReps, setMaxReps] = useState(5)
  const [minSets, setMinSets] = useState(2)
  const [maxSets, setMaxSets] = useState(5)
  const [session, setSession] = useState<WildmanConfig['session']>('morning')
  const [days, setDays] = useState<number[]>([1, 3, 5])
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [incrementMode, setIncrementMode] = useState<IncrementMode>('auto')
  const [stageTimers, setStageTimers] = useState<Record<string, StageTimerChoice>>({})
  /** Set count → unsaved auto timer draft */
  const [autoDrafts, setAutoDrafts] = useState<Record<number, TimerEditorValue>>({})
  /** Set count → saved (or matched existing) auto timer id */
  const [autoSaved, setAutoSaved] = useState<Record<number, string>>({})
  /** Set count -> saved timers with the same intervals, awaiting "use existing or create new" */
  const [autoMatches, setAutoMatches] = useState<Record<number, string[]>>({})
  /** Set count -> which matching timer is picked when there is more than one */
  const [autoPick, setAutoPick] = useState<Record<number, string>>({})
  /** "stage:<key>" or "auto:<sets>" — the draft whose editor is expanded */
  const [editingTimerKey, setEditingTimerKey] = useState<string | null>(null)
  const [savingTimers, setSavingTimers] = useState(false)
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exercise = exercises.find((e) => e.id === exerciseId)
  const stages = useMemo(
    () => buildStages({ min_sets: minSets, max_sets: maxSets, min_reps: minReps, max_reps: maxReps }),
    [minSets, maxSets, minReps, maxReps],
  )

  // Default the program name from the exercise until the user edits it
  useEffect(() => {
    if (!nameTouched) setName(exercise ? `${template.name} — ${exercise.name}` : template.name)
  }, [exercise, nameTouched, template.name])

  /**
   * Draft an auto timer for this set count. If saved timers already work the same way
   * (same intervals and pause setting, any name), remember them so the user can pick one instead.
   */
  function ensureAutoTimer(sets: number) {
    if (autoSaved[sets] || autoDrafts[sets]) return
    const draft = autoTimerDraftForSets(sets)
    setAutoDrafts((prev) => ({ ...prev, [sets]: timerValueFrom(draft) }))
    const matches = findMatchingTimers(timers, draft)
    if (matches.length > 0) setAutoMatches((prev) => ({ ...prev, [sets]: matches.map((t) => t.id) }))
  }

  function pickExistingAutoTimer(sets: number) {
    const id = autoPick[sets] ?? autoMatches[sets]?.[0]
    if (!id) return
    setAutoSaved((prev) => ({ ...prev, [sets]: id }))
    setAutoDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => Number(n) !== sets)))
    setAutoMatches((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => Number(n) !== sets)))
  }

  function createNewAutoTimer(sets: number) {
    setAutoMatches((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => Number(n) !== sets)))
    // Give the new timer a name that isn't already taken, e.g. "Wildman 2 Sets (2)"
    setAutoDrafts((prev) => {
      const draft = prev[sets]
      if (!draft) return prev
      const taken = new Set(timers.map((t) => t.name.trim().toLowerCase()))
      const base = draft.name.trim()
      let name = base
      for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})`
      return { ...prev, [sets]: { ...draft, name } }
    })
  }

  function chooseTimer(stage: WildmanStage, value: string) {
    const key = stageKey(stage)
    let choice: StageTimerChoice
    if (value === 'none') choice = { mode: 'none' }
    else if (value === 'auto') {
      ensureAutoTimer(stage.sets)
      choice = { mode: 'auto' }
    } else if (value === 'manual') {
      choice = { mode: 'manual', draft: { ...emptyTimerValue(), name: `${exercise?.name ?? 'Wildman'} ${stageLabel(stage, repType)}` } }
      setEditingTimerKey(`stage:${key}`)
    } else choice = { mode: 'existing', timerId: value }
    setStageTimers((prev) => ({ ...prev, [key]: choice }))
  }

  function chooseTimerForAll(value: string) {
    for (const stage of stages) chooseTimer(stage, value)
  }

  // New timers waiting to be reviewed and saved
  const usedAutoSets = [...new Set(stages.filter((st) => stageTimers[stageKey(st)]?.mode === 'auto').map((st) => st.sets))]
  const unsavedAutoSets = usedAutoSets.filter((n) => !autoSaved[n])
  const unsavedManualKeys = stages.map(stageKey).filter((k) => stageTimers[k]?.mode === 'manual')
  const unsavedTimerCount = unsavedAutoSets.length + unsavedManualKeys.length
  /** Auto timers that match saved timers and still need a "use existing / create new" answer */
  const undecidedAutoSets = unsavedAutoSets.filter((n) => (autoMatches[n]?.length ?? 0) > 0)

  function manualDraft(key: string): TimerEditorValue {
    return (stageTimers[key] as Extract<StageTimerChoice, { mode: 'manual' }>).draft
  }

  /** Save every new timer to the user's timers, then point the stages at the saved timers */
  async function saveNewTimers() {
    if (undecidedAutoSets.length > 0) {
      setError('Some auto timers match timers you already have. Choose “Use existing” or “Create new” for each one first.')
      return
    }
    const drafts = [
      ...unsavedAutoSets.map((n) => ({ draft: autoDrafts[n], label: `${n}-set auto timer` })),
      ...unsavedManualKeys.map((k) => ({ draft: manualDraft(k), label: `“${manualDraft(k).name || 'Untitled'}” timer` })),
    ]
    for (const { draft, label } of drafts) {
      if (!draft.name.trim()) { setError(`Give the ${label} a name before saving.`); return }
      if (intervalsForSave(draft).length === 0) { setError(`Add at least one interval with a duration to the ${label}.`); return }
    }

    setSavingTimers(true)
    setError(null)
    try {
      const savedAuto: Record<number, string> = {}
      for (const n of unsavedAutoSets) {
        const d = autoDrafts[n]
        savedAuto[n] = (await createTimer(d.name.trim(), intervalsForSave(d), d.pauseBetween)).id
      }
      const savedManual: Record<string, StageTimerChoice> = {}
      for (const k of unsavedManualKeys) {
        const d = manualDraft(k)
        savedManual[k] = { mode: 'existing', timerId: (await createTimer(d.name.trim(), intervalsForSave(d), d.pauseBetween)).id }
      }
      setAutoSaved((prev) => ({ ...prev, ...savedAuto }))
      setAutoDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([n]) => !savedAuto[Number(n)])))
      setStageTimers((prev) => ({ ...prev, ...savedManual }))
      setEditingTimerKey(null)
    } catch (err) {
      console.error('Failed to save timers', err)
      setError('Could not save your timers. Check your connection and try again.')
    } finally {
      setSavingTimers(false)
    }
  }

  function timerIdForStage(stage: WildmanStage): string | null {
    const choice = stageTimers[stageKey(stage)]
    if (choice?.mode === 'existing') return choice.timerId
    if (choice?.mode === 'auto') return autoSaved[stage.sets] ?? null
    return null
  }

  function selectExercise(id: string) {
    setExerciseId(id)
    const ex = exercises.find((e) => e.id === id)
    if (ex?.default_weight != null && weight === '') setWeight(String(ex.default_weight))
    if (ex?.default_weight_unit) setWeightUnit(ex.default_weight_unit)
  }

  const weightNum = weight === '' ? null : Number(weight)
  const bodyWeightNum = bodyWeight === '' ? null : Number(bodyWeight)

  const config: WildmanConfig = {
    exercise_id: exerciseId,
    rep_type: repType,
    min_reps: minReps,
    max_reps: maxReps,
    min_sets: minSets,
    max_sets: maxSets,
    weight: weightUnit === 'bodyweight' ? null : weightNum,
    weight_unit: weightUnit,
    body_weight: bodyWeightNum && bodyWeightNum > 0 ? bodyWeightNum : null,
    body_weight_unit: bodyWeightUnit,
    stage_timers: Object.fromEntries(stages.map((st) => [stageKey(st), timerIdForStage(st)])),
    session,
    days_of_week: [...days].sort(),
    increment_mode: incrementMode,
  }

  const projection = useMemo(
    () => projectStats(config, startDate, preferredUnit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(config), startDate, preferredUnit],
  )

  function stepError(s: number): string | null {
    switch (s) {
      case 0: return exerciseId ? null : 'Choose an exercise to continue.'
      case 1:
        if (weightUnit === 'bodyweight') return null
        return weightNum != null && weightNum > 0 ? null : 'Enter a starting weight greater than zero.'
      case 2:
        if (minReps > maxReps) return 'Min reps can’t be more than max reps.'
        if (minSets > maxSets) return 'Starting sets can’t be more than max sets.'
        return null
      case 4: return days.length > 0 ? null : 'Pick at least one training day.'
      case 5: return startDate ? null : 'Pick a start date.'
      case 7:
        return unsavedTimerCount > 0
          ? 'Save your new timers (or set those stages to “No timer”) before continuing.'
          : null
      case 8: return name.trim() ? null : 'Give the program a name.'
      default: return null
    }
  }

  const currentError = stepError(step)

  /** Save a new or changed body weight to the profile so it's filled in next time */
  async function rememberBodyWeight() {
    const unit = bodyWeightUnit === 'kg' ? 'kg' : 'lbs'
    if (config.body_weight == null) return
    if (config.body_weight === profile?.body_weight && unit === profile?.body_weight_unit) return
    try {
      await updateProfile({ body_weight: config.body_weight, body_weight_unit: unit })
    } catch (err) {
      // The program is already created; a missed body-weight save isn't worth interrupting for
      console.error('Failed to save body weight to profile', err)
    }
  }

  async function handleActivate() {
    for (let s = 0; s < STEPS.length; s++) {
      const err = stepError(s)
      if (err) { setStep(s); setError(err); return }
    }
    setSaving(true)
    setError(null)
    try {
      const program = await onCreate({
        name: name.trim(),
        description: `${exercise?.name ?? 'Exercise'} · ${stageLabel(stages[0], repType)} → ${stageLabel(stages[stages.length - 1], repType)}`,
        weeks: Math.max(1, projection.totalWeeks),
        start_date: startDate,
        template_type: 'wildman_reverse_ladder',
        template_config: config as unknown as Json,
      })
      if (!program) throw new Error('Program was not created')
      await onActivate(program.id, startDate, program)
      await rememberBodyWeight()
      onDone()
    } catch (err) {
      console.error('Failed to create Wildman program', err)
      setError('Could not create the program. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function next() {
    if (currentError) { setError(currentError); return }
    setError(null)
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  function back() {
    setError(null)
    if (step === 0) onBack()
    else setStep((s) => s - 1)
  }

  // ── Step bodies ──────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">Which exercise will you ladder?</p>
            <Select
              id="wm-exercise"
              label="Exercise"
              value={exerciseId}
              placeholder="Select an exercise"
              onChange={(e) => selectExercise(e.target.value)}
              options={exercises.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>
        )

      case 1: {
        const bwInUnit = config.body_weight && weightUnit !== 'bodyweight'
          ? convertWeight(config.body_weight, bodyWeightUnit, weightUnit)
          : null
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                id="wm-weight"
                label="Starting weight"
                type="number"
                min={0}
                step="any"
                value={weightUnit === 'bodyweight' ? '' : weight}
                disabled={weightUnit === 'bodyweight'}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={weightUnit === 'bodyweight' ? 'Bodyweight' : 'e.g. 16'}
              />
              <Select
                id="wm-weight-unit"
                label="Type"
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                options={WEIGHT_UNIT_OPTIONS}
              />
            </div>

            <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-surface-700">
                <Info className="h-4 w-4 text-primary-500" /> Choosing a weight
              </p>
              <p className="mt-1 text-xs text-surface-500">
                Think of your max working weight as about 33% of your body weight. If you can get to 50%, you are doing very well.
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Input
                  id="wm-bodyweight"
                  label="Your approximate body weight (optional, saved in Settings)"
                  type="number"
                  min={0}
                  step="any"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  onClear={() => setBodyWeight('')}
                  placeholder="e.g. 180"
                />
                <Select
                  id="wm-bodyweight-unit"
                  label="Unit"
                  value={bodyWeightUnit}
                  onChange={(e) => setBodyWeightUnit(e.target.value as WeightUnit)}
                  options={BODY_WEIGHT_UNITS}
                />
              </div>
              {bwInUnit != null && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-card p-2">
                    <p className="text-[11px] uppercase tracking-wide text-surface-400">Solid goal · 33%</p>
                    <p className="font-display text-lg font-bold text-surface-800">{round1(bwInUnit * 0.33)} {weightUnit}</p>
                  </div>
                  <div className="rounded-lg bg-card p-2">
                    <p className="text-[11px] uppercase tracking-wide text-surface-400">Very strong · 50%</p>
                    <p className="font-display text-lg font-bold text-surface-800">{round1(bwInUnit * 0.5)} {weightUnit}</p>
                  </div>
                  {weightNum != null && weightNum > 0 && (
                    <p className="col-span-2 text-xs text-surface-500">
                      Your starting weight is {Math.round((weightNum / bwInUnit) * 100)}% of your body weight.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      }

      case 2:
        return (
          <div className="space-y-4">
            <Select
              id="wm-rep-type"
              label="Rep type"
              value={repType}
              onChange={(e) => setRepType(e.target.value as RepType)}
              options={WILDMAN_REP_TYPES}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select id="wm-min-reps" label="Min reps (top rung)" value={String(minReps)}
                onChange={(e) => setMinReps(Number(e.target.value))} options={rangeOptions(1, 10)} />
              <Select id="wm-max-reps" label="Max reps (top rung)" value={String(maxReps)}
                onChange={(e) => setMaxReps(Number(e.target.value))} options={rangeOptions(1, 10)} />
              <Select id="wm-min-sets" label="Starting sets" value={String(minSets)}
                onChange={(e) => setMinSets(Number(e.target.value))} options={rangeOptions(1, 10)} />
              <Select id="wm-max-sets" label="Max sets" value={String(maxSets)}
                onChange={(e) => setMaxSets(Number(e.target.value))} options={rangeOptions(1, 10)} />
            </div>
            {minReps <= maxReps && minSets <= maxSets && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-surface-500">{stages.length} stages</p>
                <ol className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-surface-200 p-2 text-sm">
                  {stages.map((s, i) => (
                    <li key={stageKey(s)} className="flex items-center justify-between gap-2">
                      <span className="text-surface-700"><span className="mr-2 text-surface-400">{i + 1}.</span>{stageLabel(s, repType)}</span>
                      <span className="shrink-0 text-xs text-surface-400">{s.topReps} sessions</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">When will you train?</p>
            <div className="grid grid-cols-3 gap-2">
              {(['morning', 'noon', 'night'] as const).map((s) => (
                <ChoiceButton key={s} selected={session === s} onClick={() => setSession(s)}>
                  {SESSION_LABELS[s]}
                </ChoiceButton>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">Which days of the week? Each training day is one session.</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((label, dow) => (
                <ChoiceButton
                  key={label}
                  selected={days.includes(dow)}
                  onClick={() => setDays((prev) => prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow])}
                  className="px-0"
                >
                  {label}
                </ChoiceButton>
              ))}
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-3">
            <Input
              id="wm-start"
              label="Start date"
              type="date"
              min={format(new Date(), 'yyyy-MM-dd')}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {projection.startDate && (
              <p className="ui-date text-xs text-surface-500">
                First session: {format(parseISO(projection.startDate), 'EEEE, MMM d, yyyy')}
              </p>
            )}
          </div>
        )

      case 6:
        return (
          <div className="space-y-2">
            <ChoiceCard
              selected={incrementMode === 'auto'}
              onClick={() => setIncrementMode('auto')}
              title="Auto progression"
              body="Each stage lasts as many sessions as its top rung (2 sessions at 2 reps, up to 5 at 5 reps). When a stage is done you’ll be asked “Ready to progress?”. You can always push a stage back or speed it up from the Plan page."
            />
            <ChoiceCard
              selected={incrementMode === 'manual'}
              onClick={() => setIncrementMode('manual')}
              title="Manual progression"
              body="Your current stage repeats until you choose to progress. You can do that after a workout or from the Plan page."
            />
          </div>
        )

      case 7:
        return renderTimerStep()

      case 8:
        return renderReview()
    }
  }

  function renderTimerStep() {
    const selectClass = 'max-w-[14rem] rounded-lg border border-input-border bg-input-bg px-2 py-1 text-xs text-text'
    const savedTimerOptions = timers.length > 0 && (
      <optgroup label="Your timers">
        {timers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </optgroup>
    )
    const reviewButton = (k: string) => (
      <button
        type="button"
        onClick={() => setEditingTimerKey(editingTimerKey === k ? null : k)}
        className="inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
      >
        Review {editingTimerKey === k ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
    )
    const draftSummary = (d: TimerEditorValue) =>
      `${d.intervals.length} ${d.intervals.length === 1 ? 'interval' : 'intervals'} · ${formatDuration(totalDuration(intervalsForSave(d)))}${d.pauseBetween ? ' · pauses between' : ''}`

    return (
      <div className="space-y-3">
        <p className="text-sm text-surface-600">
          Optionally attach a timer to each stage. <span className="font-medium">Auto</span> creates one timer per set count,
          with a 1-minute interval for each set and a pause in between, so you start each set when you’re ready.
          <span className="font-medium"> Manual</span> lets you build your own.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-50 p-2">
          <span className="text-sm font-medium text-surface-700">Apply to all stages</span>
          <select
            aria-label="Timer for all stages"
            value=""
            onChange={(e) => { if (e.target.value) chooseTimerForAll(e.target.value) }}
            className={selectClass}
          >
            <option value="" disabled>Choose…</option>
            <option value="none">{TIMER_OPTION_LABELS.none}</option>
            <option value="auto">{TIMER_OPTION_LABELS.auto}</option>
            {savedTimerOptions}
          </select>
        </div>

        <div className="space-y-2">
          {stages.map((stage) => {
            const key = stageKey(stage)
            const choice = stageTimers[key] ?? { mode: 'none' }
            const value = choice.mode === 'existing' ? choice.timerId : choice.mode
            const autoId = autoSaved[stage.sets]
            const autoName = autoId ? timers.find((t) => t.id === autoId)?.name : autoDrafts[stage.sets]?.name
            const editKey = `stage:${key}`
            return (
              <div key={key} className="rounded-lg border border-surface-200 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-surface-700">{stageLabel(stage, repType)}</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Timer for ${stageLabel(stage, repType)}`}
                      value={value}
                      onChange={(e) => chooseTimer(stage, e.target.value)}
                      className={selectClass}
                    >
                      <option value="none">{TIMER_OPTION_LABELS.none}</option>
                      <option value="manual">{TIMER_OPTION_LABELS.manual}</option>
                      <option value="auto">{TIMER_OPTION_LABELS.auto}</option>
                      {savedTimerOptions}
                    </select>
                    {choice.mode === 'manual' && reviewButton(editKey)}
                  </div>
                </div>
                {choice.mode === 'auto' && (
                  <p className="mt-1 text-xs text-surface-400">
                    Uses “{autoName}” {autoId ? '· saved' : '· not saved yet, review below'}
                  </p>
                )}
                {choice.mode === 'manual' && (
                  <p className="mt-1 text-xs text-surface-400">
                    New: {choice.draft.name || 'Untitled'} · {draftSummary(choice.draft)} · not saved yet
                  </p>
                )}
                {choice.mode === 'manual' && editingTimerKey === editKey && (
                  <div className="mt-3 border-t border-surface-100 pt-3">
                    <TimerEditor
                      value={choice.draft}
                      onChange={(draft) => setStageTimers((prev) => ({ ...prev, [key]: { mode: 'manual', draft } }))}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {unsavedAutoSets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Auto timers to review</p>
            {undecidedAutoSets.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
                <p className="text-sm text-surface-700">
                  {undecidedAutoSets.length === 1 ? 'One of these works' : `${undecidedAutoSets.length} of these work`} the same as timers you already have.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" type="button" onClick={() => undecidedAutoSets.forEach(pickExistingAutoTimer)}>
                    Use my existing timers
                  </Button>
                  <Button size="sm" type="button" variant="secondary" onClick={() => undecidedAutoSets.forEach(createNewAutoTimer)}>
                    Create new ones
                  </Button>
                </div>
              </div>
            )}
            {unsavedAutoSets.map((n) => {
              const d = autoDrafts[n]
              if (!d) return null
              const editKey = `auto:${n}`
              return (
                <div key={n} className="rounded-lg border border-primary-200 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-surface-700">{d.name || 'Untitled'}</span>
                    {reviewButton(editKey)}
                  </div>
                  <p className="mt-1 text-xs text-surface-400">{draftSummary(d)}</p>
                  {(autoMatches[n]?.length ?? 0) > 0 && (() => {
                    const matchIds = autoMatches[n]
                    const pickedId = autoPick[n] ?? matchIds[0]
                    const picked = timers.find((t) => t.id === pickedId)
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-50 p-2">
                        <span className="text-xs text-surface-600">
                          Same intervals as your {matchIds.length === 1 ? <span className="font-medium">“{picked?.name}”</span> : 'saved timer'}
                        </span>
                        {matchIds.length > 1 && (
                          <select
                            aria-label={`Existing timer for ${n} sets`}
                            value={pickedId}
                            onChange={(e) => setAutoPick((prev) => ({ ...prev, [n]: e.target.value }))}
                            className="rounded-lg border border-input-border bg-input-bg px-2 py-1 text-xs text-text"
                          >
                            {matchIds.map((id) => <option key={id} value={id}>{timers.find((t) => t.id === id)?.name}</option>)}
                          </select>
                        )}
                        <div className="ml-auto flex gap-1.5">
                          <Button size="sm" type="button" onClick={() => pickExistingAutoTimer(n)}>Use existing</Button>
                          <Button size="sm" type="button" variant="secondary" onClick={() => createNewAutoTimer(n)}>Create new</Button>
                        </div>
                      </div>
                    )
                  })()}
                  {editingTimerKey === editKey && (
                    <div className="mt-3 border-t border-surface-100 pt-3">
                      <TimerEditor value={d} onChange={(draft) => setAutoDrafts((prev) => ({ ...prev, [n]: draft }))} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {unsavedTimerCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-50 p-3">
            <p className="text-sm text-primary-800">
              {unsavedTimerCount} new {unsavedTimerCount === 1 ? 'timer' : 'timers'} to review. Save to add {unsavedTimerCount === 1 ? 'it' : 'them'} to your timers.
            </p>
            <Button size="sm" type="button" onClick={saveNewTimers} disabled={savingTimers}>
              {savingTimers ? 'Saving…' : unsavedTimerCount === 1 ? 'Save timer' : 'Save timers'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  function renderReview() {
    const p = projection
    const showVolume = weightUnit !== 'bodyweight' && p.totalVolume > 0
    const timerCount = new Set(stages.map(timerIdForStage).filter(Boolean)).size
    return (
      <div className="space-y-4">
        <Input
          id="wm-name"
          label="Program name"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameTouched(true) }}
        />

        {p.endDate && (
          <div className="rounded-xl bg-primary-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
              {incrementMode === 'manual' ? 'Projected end date (if you progress on the default pace)' : 'Projected end date'}
            </p>
            <p className="ui-date mt-1 font-display text-2xl font-bold text-primary-700">
              {format(parseISO(p.endDate), 'EEE, MMM d, yyyy')}
            </p>
            <p className="ui-date mt-0.5 text-xs text-primary-600">
              Starts {p.startDate ? format(parseISO(p.startDate), 'MMM d') : '—'} · about {p.totalWeeks} {p.totalWeeks === 1 ? 'week' : 'weeks'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Sessions" value={p.totalSessions.toLocaleString()} sub={`${p.totalStages} stages`} />
          <Stat label="Total reps" value={p.totalReps.toLocaleString()} sub={`${p.firstSessionReps} → ${p.lastSessionReps} per session`} />
          {showVolume && (
            <Stat
              label="Weight moved"
              value={`${p.totalVolume.toLocaleString()} ${preferredUnit}`}
              sub={weightEquivalent(p.totalVolume, preferredUnit) ?? undefined}
            />
          )}
          {showVolume && (
            <Stat label="Heaviest session" value={`${p.heaviestSessionVolume.toLocaleString()} ${preferredUnit}`} sub={stageLabel(stages[stages.length - 1], repType)} />
          )}
          {p.emomMinutes > 0 && <Stat label="EMOM minutes" value={p.emomMinutes.toLocaleString()} sub="of every-minute work" />}
          {p.bodyWeightMultiple != null && (
            <Stat label="Body weights moved" value={`${round1(p.bodyWeightMultiple).toLocaleString()}×`} sub="your body weight" />
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-surface-200 p-3 text-sm">
          <dt className="text-surface-500">Exercise</dt><dd className="text-surface-800">{exercise?.name}</dd>
          <dt className="text-surface-500">Weight</dt>
          <dd className="text-surface-800">{weightUnit === 'bodyweight' ? 'Bodyweight' : `${weight} ${weightUnit}`}</dd>
          <dt className="text-surface-500">Stages</dt>
          <dd className="text-surface-800">{stageLabel(stages[0], repType)} → {stageLabel(stages[stages.length - 1], repType)}</dd>
          <dt className="text-surface-500">Schedule</dt>
          <dd className="text-surface-800">{SESSION_LABELS[session]} · {[...days].sort().map((d) => WEEKDAYS[d]).join(', ')}</dd>
          <dt className="text-surface-500">Timers</dt>
          <dd className="text-surface-800">{timerCount === 0 ? 'None' : `${timerCount} attached`}</dd>
          <dt className="text-surface-500">Progression</dt>
          <dd className="text-surface-800">{incrementMode === 'auto' ? 'Auto (asks before each step up)' : 'Manual'}</dd>
        </dl>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <div>
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span className="font-medium text-surface-700">{STEPS[step]}</span>
          <span>Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary-500' : 'bg-surface-200')} />
          ))}
        </div>
      </div>

      {renderStep()}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-surface-100 pt-4">
        <Button variant="secondary" type="button" onClick={back} disabled={saving}>
          {step === 0 ? 'Templates' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>Next</Button>
        ) : (
          <Button type="button" onClick={handleActivate} disabled={saving}>
            {saving ? 'Activating…' : 'Activate Program'}
          </Button>
        )}
      </div>
    </div>
  )
}

function ChoiceButton({ selected, onClick, className, children }: {
  selected: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
        selected
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-surface-200 text-surface-600 hover:border-surface-300 hover:bg-surface-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

function ChoiceCard({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:bg-surface-50',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
        selected ? 'border-primary-500 bg-primary-500 text-on-primary' : 'border-surface-300',
      )}>
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-surface-800">{title}</span>
        <span className="mt-0.5 block text-xs text-surface-500">{body}</span>
      </span>
    </button>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold text-surface-800">{value}</p>
      {sub && <p className="text-xs text-surface-500">{sub}</p>}
    </div>
  )
}

import { useState } from 'react'
import { Hourglass, Minus, OctagonX, Plus, TrendingUp } from 'lucide-react'
import type { TemplateProgramStatus } from '@/hooks/useProgramProgression'
import type useProgramProgression from '@/hooks/useProgramProgression'
import type { WeightUnit } from '@/types/common'
import { WEIGHT_UNIT_OPTIONS } from '@/types/common'
import { stageLabel } from '@/lib/program-templates/wildman'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'

type Progression = Pick<ReturnType<typeof useProgramProgression>, 'advance' | 'adjust' | 'finishCycle' | 'cancel'>

type Step = 'idle' | 'confirm' | 'how_many' | 'cycle_end' | 'cancel' | 'done'

interface ProgramProgressControlsProps {
  status: TemplateProgramStatus
  progression: Progression
  /**
   * panel: compact controls on the Plan page.
   * complete: shown after a workout. In auto mode it opens on "Ready to progress?" when the stage is due.
   * compact: just a "Progress now" button, for program cards elsewhere in the app.
   */
  variant: 'panel' | 'complete' | 'compact'
  /** The program's exercise, for "Ready to increment …?" (falls back to the program name) */
  exerciseName?: string
}

export default function ProgramProgressControls({ status, progression, variant, exerciseName }: ProgramProgressControlsProps) {
  const { config, progress, stage, nextStage, isFinalStage, isDue } = status
  const auto = config.increment_mode === 'auto'
  const name = exerciseName ?? status.program.name

  const [step, setStep] = useState<Step>('idle')
  // Auto mode: once the stage is due, ask "Ready to increment?" until it's answered
  const [dueAnswered, setDueAnswered] = useState(false)
  const current: Step = step === 'idle' && auto && isDue && !dueAnswered ? (isFinalStage ? 'cycle_end' : 'confirm') : step
  const [moreSessions, setMoreSessions] = useState('2')
  const sessionsToAdd = Number(moreSessions)
  const validSessions = Number.isInteger(sessionsToAdd) && sessionsToAdd >= 1 && sessionsToAdd <= 50
  const [newWeight, setNewWeight] = useState(progress.weight != null ? String(progress.weight) : '')
  const [newUnit, setNewUnit] = useState<WeightUnit>(progress.weight_unit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => Promise<void>, doneMessage?: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setDueAnswered(true)
      if (doneMessage) {
        setMessage(doneMessage)
        setStep(variant === 'complete' ? 'done' : 'idle')
      }
    } catch (err) {
      console.error('Program progression failed', err)
      setError('Could not update your program schedule. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function startProgress() {
    setMessage(null)
    setStep(isFinalStage ? 'cycle_end' : 'confirm')
  }

  /** "No" / Delay: ask how many more sessions to do at this stage */
  function startDelay() {
    setMessage(null)
    setDueAnswered(true)
    setStep('how_many')
  }

  function closePrompt() {
    setDueAnswered(true)
    setStep('idle')
  }

  const delayButton = (
    <Button size="sm" variant={variant === 'compact' ? 'ghost' : 'secondary'} disabled={busy} onClick={startDelay}
      title="Stay at this stage for more sessions and push the next increment back">
      <Hourglass className="h-3.5 w-3.5" /> Delay
    </Button>
  )

  const label = (s: typeof stage) => stageLabel(s, config)

  return (
    // Compact: once a prompt opens it takes its own row below the card's other details
    <div className={cn('space-y-2', variant === 'compact' && (current !== 'idle' || message || error) && 'basis-full')}>
      {current === 'idle' && variant === 'panel' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {auto && (
            <>
              <Button size="sm" variant="secondary" disabled={busy} title="Add a session to this stage"
                onClick={() => run(() => progression.adjust(status, 1), 'Added 1 session to this stage.')}>
                <Plus className="h-3.5 w-3.5" /> 1
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} title="Add two sessions to this stage"
                onClick={() => run(() => progression.adjust(status, 2), 'Added 2 sessions to this stage.')}>
                <Plus className="h-3.5 w-3.5" /> 2
              </Button>
              <Button size="sm" variant="secondary" disabled={busy || status.requiredInStage <= 1} title="Remove a session from this stage"
                onClick={() => run(() => progression.adjust(status, -1), 'Removed 1 session from this stage.')}>
                <Minus className="h-3.5 w-3.5" /> 1
              </Button>
            </>
          )}
          <Button size="sm" disabled={busy} onClick={startProgress}>
            <TrendingUp className="h-3.5 w-3.5" /> {auto ? 'Progress now' : 'Progress to next stage'}
          </Button>
          {auto && delayButton}
          <Button size="sm" variant="ghost" disabled={busy} title="Stop this program and remove its upcoming workouts"
            onClick={() => { setMessage(null); setStep('cancel') }}>
            <OctagonX className="h-3.5 w-3.5" /> Cancel program
          </Button>
        </div>
      )}

      {current === 'idle' && variant === 'compact' && (
        <div className="-ml-2.5 flex flex-wrap items-center">
          <Button size="sm" variant="ghost" disabled={busy} onClick={startProgress}>
            <TrendingUp className="h-3.5 w-3.5" /> Progress now
          </Button>
          {auto && delayButton}
        </div>
      )}

      {current === 'cancel' && (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 p-3">
          <p className="text-sm font-semibold text-surface-800">Cancel {status.program.name}?</p>
          <p className="mt-0.5 text-xs text-surface-600">
            Upcoming workouts will be removed from your plan, including today's if it isn't completed. Workouts you've completed stay.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={busy}
              onClick={() => run(() => progression.cancel(status))}>
              Cancel program
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStep('idle')}>
              Keep program
            </Button>
          </div>
        </div>
      )}

      {current === 'idle' && variant === 'complete' && !auto && (
        <Button size="sm" variant="secondary" className="w-full" onClick={startProgress}>
          <TrendingUp className="h-3.5 w-3.5" /> Progress to next stage
        </Button>
      )}

      {current === 'confirm' && nextStage && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <p className="text-sm font-semibold text-primary-800">Ready to increment {name}?</p>
          <p className="mt-0.5 text-xs text-primary-700">
            {label(stage)} → <span className="font-semibold">{label(nextStage)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy}
              onClick={() => run(async () => { await progression.advance(status) }, `Moved up to ${label(nextStage)}.`)}>
              Yes
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => (auto ? startDelay() : closePrompt())}>
              No
            </Button>
          </div>
        </div>
      )}

      {current === 'how_many' && (
        <form
          className="rounded-lg border border-surface-200 bg-surface-50 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!validSessions || busy) return
            run(() => progression.adjust(status, sessionsToAdd),
              `Added ${sessionsToAdd} more ${label(stage)} ${sessionsToAdd === 1 ? 'session' : 'sessions'}. The next increment moved back.`)
          }}
        >
          <p className="text-sm font-semibold text-surface-800">How many more {label(stage)} sessions?</p>
          <p className="mt-0.5 text-xs text-surface-500">
            They're added from today on, and every later workout moves back to make room.
          </p>
          <div className="mt-2 flex items-start gap-2">
            <div className="w-24">
              <Input
                id={`delay-sessions-${status.activation.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                aria-label="Sessions to add"
                value={moreSessions}
                autoFocus
                onChange={(e) => setMoreSessions(e.target.value)}
                error={moreSessions !== '' && !validSessions ? 'Enter a whole number from 1 to 50' : undefined}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy || !validSessions} className="mt-0.5">
              Add sessions
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={closePrompt} className="mt-0.5">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {current === 'cycle_end' && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <p className="text-sm font-semibold text-primary-800">You finished the final stage! 🎉</p>
          <p className="mt-0.5 text-xs text-primary-700">
            Increase the weight and start again from {label(status.stages[0])}, or complete the program.
          </p>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <Input
              id={`new-weight-${status.activation.id}`}
              label="New weight"
              type="number"
              min={0}
              step="any"
              value={newUnit === 'bodyweight' ? '' : newWeight}
              disabled={newUnit === 'bodyweight'}
              onChange={(e) => setNewWeight(e.target.value)}
            />
            <Select
              id={`new-unit-${status.activation.id}`}
              label="Type"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as WeightUnit)}
              options={WEIGHT_UNIT_OPTIONS}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || (newUnit !== 'bodyweight' && !(Number(newWeight) > 0))}
              onClick={() => run(
                () => progression.finishCycle(status, 'restart', {
                  weight: newUnit === 'bodyweight' ? null : Number(newWeight),
                  unit: newUnit,
                }),
                'New cycle started at the heavier weight.',
              )}>
              Increase weight &amp; start again
            </Button>
            <Button size="sm" variant="secondary" disabled={busy}
              onClick={() => run(() => progression.finishCycle(status, 'complete'), 'Program complete — nice work!')}>
              Complete program
            </Button>
            {auto && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={startDelay}>
                Not yet
              </Button>
            )}
            {variant !== 'complete' && (
              <Button size="sm" variant="ghost" onClick={closePrompt}>Cancel</Button>
            )}
          </div>
        </div>
      )}

      {message && <p className="text-xs font-medium text-success-600">{message}</p>}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-xs text-danger-600">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}
    </div>
  )
}

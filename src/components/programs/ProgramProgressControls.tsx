import { useState } from 'react'
import { Minus, Plus, TrendingUp } from 'lucide-react'
import type { TemplateProgramStatus } from '@/hooks/useProgramProgression'
import type useProgramProgression from '@/hooks/useProgramProgression'
import type { WeightUnit } from '@/types/common'
import { WEIGHT_UNIT_OPTIONS } from '@/types/common'
import { stageLabel } from '@/lib/program-templates/wildman'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

type Progression = Pick<ReturnType<typeof useProgramProgression>, 'advance' | 'adjust' | 'finishCycle'>

type Step = 'idle' | 'confirm' | 'how_many' | 'cycle_end' | 'done'

interface ProgramProgressControlsProps {
  status: TemplateProgramStatus
  progression: Progression
  /**
   * panel: compact controls on the Plan page.
   * complete: shown after a workout. In auto mode it opens on "Ready to progress?" when the stage is due.
   */
  variant: 'panel' | 'complete'
}

export default function ProgramProgressControls({ status, progression, variant }: ProgramProgressControlsProps) {
  const { config, progress, stage, nextStage, isFinalStage, isDue } = status
  const auto = config.increment_mode === 'auto'
  const initialStep: Step = variant === 'complete' && auto && isDue ? (isFinalStage ? 'cycle_end' : 'confirm') : 'idle'

  const [step, setStep] = useState<Step>(initialStep)
  const [moreSessions, setMoreSessions] = useState(2)
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

  const label = (s: typeof stage) => stageLabel(s, config.rep_type)

  return (
    <div className="space-y-2">
      {step === 'idle' && variant === 'panel' && (
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
        </div>
      )}

      {step === 'idle' && variant === 'complete' && !auto && (
        <Button size="sm" variant="secondary" className="w-full" onClick={startProgress}>
          <TrendingUp className="h-3.5 w-3.5" /> Progress to next stage
        </Button>
      )}

      {step === 'confirm' && nextStage && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <p className="text-sm font-semibold text-primary-800">Ready to progress?</p>
          <p className="mt-0.5 text-xs text-primary-700">
            {label(stage)} → <span className="font-semibold">{label(nextStage)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy}
              onClick={() => run(async () => { await progression.advance(status) }, `Moved up to ${label(nextStage)}.`)}>
              Yes, progress
            </Button>
            <Button size="sm" variant="secondary" disabled={busy}
              onClick={() => (variant === 'complete' && auto ? setStep('how_many') : setStep('idle'))}>
              Not yet
            </Button>
          </div>
        </div>
      )}

      {step === 'how_many' && (
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
          <p className="text-sm font-semibold text-surface-800">How many more sessions at this stage?</p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={moreSessions <= 1} onClick={() => setMoreSessions((n) => n - 1)} aria-label="Fewer sessions">
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-8 text-center font-display text-lg font-bold text-surface-800">{moreSessions}</span>
            <Button size="sm" variant="secondary" onClick={() => setMoreSessions((n) => n + 1)} aria-label="More sessions">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" disabled={busy} className="ml-auto"
              onClick={() => run(() => progression.adjust(status, moreSessions),
                `Staying at ${label(stage)} for ${moreSessions} more ${moreSessions === 1 ? 'session' : 'sessions'}.`)}>
              Confirm
            </Button>
          </div>
        </div>
      )}

      {step === 'cycle_end' && (
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
            {variant === 'panel' && (
              <Button size="sm" variant="ghost" onClick={() => setStep('idle')}>Cancel</Button>
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

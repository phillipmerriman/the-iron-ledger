import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, OctagonX, Calendar } from 'lucide-react'
import { format, startOfWeek, addWeeks, parseISO } from 'date-fns'
import usePrograms from '@/hooks/usePrograms'
import ProgramCard from '@/components/programs/ProgramCard'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StartDatePicker from '@/components/programs/StartDatePicker'
import ProgramWizard from '@/components/programs/ProgramWizard'
import Input from '@/components/ui/Input'
import useWorkouts from '@/hooks/useWorkouts'
import useProgramProgression from '@/hooks/useProgramProgression'
import { stageLabel } from '@/lib/program-templates/wildman'
import { isEntryDone } from '@/lib/program-templates/progress'

export default function ProgramsPage() {
  const programsApi = usePrograms()
  const { programs, activations, loading, create, update, remove, activate, deactivate } = programsApi
  const { sessions: workoutSessions, loading: workoutsLoading } = useWorkouts()
  const { statusForActivation, doneKeys } = useProgramProgression(programsApi, workoutSessions, workoutsLoading)
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [activateId, setActivateId] = useState<string | null>(null)
  const [activateDate, setActivateDate] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
  )
  const [editProgram, setEditProgram] = useState<{ id: string; name: string; description: string } | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleCancelProgram(activationId: string) {
    setCancelError(null)
    try {
      await deactivate(activationId, (e) => isEntryDone(e, doneKeys))
    } catch (err) {
      console.error('Failed to cancel program', err)
      setCancelError('Could not cancel the program. Check your connection and try again.')
    }
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this program? All days and exercises in it will be removed.')) return
    await remove(id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Create Program
        </Button>
      </div>

      {cancelError && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600">
          <span>{cancelError}</span>
          <button type="button" onClick={() => setCancelError(null)} className="text-xs font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Active Programs Section */}
      {activations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-surface-500">Active Programs</h2>
          {activations.map((act) => {
            const program = programs.find((p) => p.id === act.program_id)
            if (!program) return null
            const start = parseISO(act.start_date)
            const end = addWeeks(start, program.weeks)
            const status = statusForActivation(act.id)
            return (
              <Card key={act.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-900">{program.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary">Active</Badge>
                    <Badge className="ui-date">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {format(start, 'MMM d')} — {format(end, 'MMM d, yyyy')}
                    </Badge>
                    {!status && <Badge>{program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</Badge>}
                  </div>
                  {status && (
                    <p className="mt-1.5 text-xs text-surface-500">
                      Stage {status.progress.stage_index + 1} of {status.stages.length}: {stageLabel(status.stage, status.config)}
                      {status.config.increment_mode === 'auto' && ` · ${Math.min(status.completedInStage, status.requiredInStage)}/${status.requiredInStage} sessions`}
                      {status.progress.cycle > 1 && ` · Cycle ${status.progress.cycle}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setCancelTarget({ id: act.id, name: program.name })}
                  className="shrink-0 rounded-lg p-1.5 text-primary-500 hover:bg-warning-50 hover:text-warning-600"
                  aria-label="Cancel program"
                  title="Cancel program"
                >
                  <OctagonX className="h-4 w-4" />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {/* All Programs */}
      <div className="space-y-3">
        {activations.length > 0 && (
          <h2 className="text-sm font-bold uppercase tracking-wide text-surface-500">All Programs</h2>
        )}
        {programs.length === 0 ? (
          <div className="py-12 text-center text-surface-400">
            No programs yet. Create your first training program!
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onDelete={handleDelete}
                onSetActive={(id) => {
                  setActivateId(id)
                  const isTemplate = programs.find((p) => p.id === id)?.template_type === 'wildman_reverse_ladder'
                  setActivateDate(format(isTemplate ? new Date() : startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
                }}
                onEdit={(id) => {
                  const p = programs.find((pr) => pr.id === id)
                  if (p) setEditProgram({ id: p.id, name: p.name, description: p.description ?? '' })
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setConfirmDiscard(true)}
        title="Create Program"
        size="lg"
      >
        {/* Remount on each open so the wizard starts fresh */}
        {modalOpen && (
          <ProgramWizard
            onCreate={create}
            onActivate={activate}
            onCancel={closeModal}
            onDone={() => { closeModal(); navigate('/plan') }}
          />
        )}
      </Modal>

      {/* Cancelling keeps past and completed workouts; everything still to come is removed */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel program?"
        message={`Upcoming workouts for ${cancelTarget?.name ?? 'this program'} will be removed from your plan, including today's if it isn't completed. Workouts you've completed stay.`}
        cancelLabel="Keep program"
        actions={[{ label: 'Cancel program', variant: 'danger', onClick: () => { if (cancelTarget) handleCancelProgram(cancelTarget.id) } }]}
      />

      {/* Closing the wizard with the X, Escape or a click outside loses everything entered */}
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Cancel program creation?"
        message="Your program hasn't been created yet. If you leave now, everything you've entered will be lost."
        cancelLabel="Keep editing"
        actions={[{ label: 'Discard program', variant: 'danger', onClick: closeModal }]}
      />

      {/* Activation date picker modal */}
      <Modal
        open={activateId !== null}
        onClose={() => setActivateId(null)}
        title="Activate Program"
      >
        {(() => {
          const activateProgram = programs.find((p) => p.id === activateId)
          if (activateProgram?.template_type === 'wildman_reverse_ladder') {
            return (
              <div className="space-y-4">
                <p className="text-sm text-surface-600">
                  Choose the day to start. Workouts are scheduled on the program&apos;s training days from that date.
                </p>
                <Input
                  id="activate-template-date"
                  label="Start date"
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={activateDate}
                  onChange={(e) => setActivateDate(e.target.value)}
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setActivateId(null)}>Cancel</Button>
                  <Button
                    disabled={!activateDate}
                    onClick={async () => {
                      await activate(activateProgram.id, activateDate)
                      setActivateId(null)
                    }}
                  >
                    Activate
                  </Button>
                </div>
              </div>
            )
          }
          return (
            <div className="space-y-4">
              <p className="text-sm text-surface-600">
                Choose the Sunday your program should start on. Week 1 will begin on {activateDate ? format(parseISO(activateDate), 'EEEE, MMM d, yyyy') : 'the selected date'}.
              </p>
              <StartDatePicker
                value={activateDate}
                onChange={setActivateDate}
                programWeeks={activateProgram?.weeks ?? 1}
                activationIds={activations.map((a) => a.id)}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setActivateId(null)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    if (activateId) {
                      await activate(activateId, activateDate)
                      setActivateId(null)
                    }
                  }}
                >
                  Activate
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Edit program modal */}
      <Modal
        open={editProgram !== null}
        onClose={() => setEditProgram(null)}
        title="Edit Program"
      >
        {editProgram && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setEditSaving(true)
              try {
                await update(editProgram.id, { name: editProgram.name, description: editProgram.description || null })
                setEditProgram(null)
              } finally {
                setEditSaving(false)
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-surface-700">Name</label>
              <input
                id="edit-name"
                type="text"
                required
                value={editProgram.name}
                onChange={(e) => setEditProgram({ ...editProgram, name: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="edit-desc" className="block text-sm font-medium text-surface-700">Description</label>
              <textarea
                id="edit-desc"
                rows={3}
                value={editProgram.description}
                onChange={(e) => setEditProgram({ ...editProgram, description: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditProgram(null)}>Cancel</Button>
              <Button type="submit" disabled={editSaving || !editProgram.name.trim()}>
                {editSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

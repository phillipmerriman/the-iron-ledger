import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, OctagonX, Calendar } from 'lucide-react'
import { format, startOfWeek, addWeeks, parseISO } from 'date-fns'
import usePrograms from '@/hooks/usePrograms'
import ProgramCard from '@/components/programs/ProgramCard'
import ProgramForm from '@/components/programs/ProgramForm'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import StartDatePicker from '@/components/programs/StartDatePicker'

export default function ProgramsPage() {
  const { programs, activations, loading, create, update, remove, activate, deactivate } = usePrograms()
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activateId, setActivateId] = useState<string | null>(null)
  const [activateDate, setActivateDate] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
  )
  const [editProgram, setEditProgram] = useState<{ id: string; name: string; description: string } | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function closeModal() {
    setModalOpen(false)
  }

  async function handleSubmit(values: { name: string; description: string; weeks: number; start_date: string }) {
    setSubmitting(true)
    try {
      const program = await create(values)
      closeModal()
      if (program) navigate(`/programs/${program.id}`)
    } finally {
      setSubmitting(false)
    }
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
          New Program
        </Button>
      </div>

      {/* Active Programs Section */}
      {activations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-surface-500">Active Programs</h2>
          {activations.map((act) => {
            const program = programs.find((p) => p.id === act.program_id)
            if (!program) return null
            const start = parseISO(act.start_date)
            const end = addWeeks(start, program.weeks)
            return (
              <Card key={act.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-900">{program.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary">Active</Badge>
                    <Badge>
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {format(start, 'MMM d')} — {format(end, 'MMM d, yyyy')}
                    </Badge>
                    <Badge>{program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}</Badge>
                  </div>
                </div>
                <button
                  onClick={() => deactivate(act.id)}
                  className="shrink-0 rounded-lg p-1.5 text-primary-500 hover:bg-warning-50 hover:text-warning-600"
                  aria-label="Deactivate program"
                  title="Deactivate"
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
                onSetActive={(id) => { setActivateId(id); setActivateDate(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')) }}
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
        onClose={closeModal}
        title="New Program"
      >
        <ProgramForm
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      </Modal>

      {/* Activation date picker modal */}
      <Modal
        open={activateId !== null}
        onClose={() => setActivateId(null)}
        title="Activate Program"
      >
        {(() => {
          const activateProgram = programs.find((p) => p.id === activateId)
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

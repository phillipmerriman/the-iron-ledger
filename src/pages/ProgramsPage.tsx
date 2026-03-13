import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import usePrograms from '@/hooks/usePrograms'
import ProgramCard from '@/components/programs/ProgramCard'
import ProgramForm from '@/components/programs/ProgramForm'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function ProgramsPage() {
  const { programs, loading, create, remove, setActive, deactivate } = usePrograms()
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function closeModal() {
    setModalOpen(false)
  }

  async function handleSubmit(values: { name: string; description: string; weeks: number; start_date: string }) {
    setSubmitting(true)
    try {
      const program = await create(values)
      closeModal()
      if (program) navigate(`/plan/${program.id}`)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          New Program
        </Button>
      </div>

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
              onSetActive={setActive}
              onDeactivate={deactivate}
            />
          ))}
        </div>
      )}

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
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'
import type { Program } from '@/types/database'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface ProgramFormProps {
  initial?: Program | null
  onSubmit: (values: { name: string; description: string; weeks: number; start_date: string }) => Promise<void>
  onCancel: () => void
  submitting?: boolean
}

export default function ProgramForm({ initial, onSubmit, onCancel, submitting }: ProgramFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [weeks, setWeeks] = useState(initial?.weeks ?? 1)
  // Internal reference date — not user-facing. Use current week's Sunday.
  const startDate = initial?.start_date
    ? format(new Date(initial.start_date), 'yyyy-MM-dd')
    : format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit({ name: name.trim(), description: description.trim(), weeks, start_date: startDate })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="program-name"
        label="Program Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        onClear={() => setName('')}
        placeholder="e.g. Push Pull Legs"
      />

      <div className="space-y-1">
        <label htmlFor="program-desc" className="block text-sm font-medium text-surface-700">
          Description
        </label>
        <div className="relative">
          <textarea
            id="program-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn(
              'block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
              description && 'pr-8',
            )}
            placeholder="Optional description..."
          />
          {description && (
            <button
              type="button"
              onClick={() => setDescription('')}
              className="absolute right-2 top-2 rounded p-0.5 text-surface-400 hover:text-surface-600"
              aria-label="Clear description"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Input
        id="program-weeks"
        label="Number of Weeks"
        type="number"
        min={1}
        max={52}
        required
        value={weeks}
        onChange={(e) => setWeeks(Number(e.target.value))}
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {initial ? 'Save Changes' : 'Create & Plan'}
        </Button>
      </div>
    </form>
  )
}

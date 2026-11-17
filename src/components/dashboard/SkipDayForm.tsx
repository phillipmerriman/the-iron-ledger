import { useState } from 'react'
import { SkipForward } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface SkipDayFormProps {
  busy: boolean
  onConfirm: (reason: string | null) => void
  onCancel: () => void
  size?: 'sm' | 'md'
  className?: string
}

/** Asks for an optional reason before a day is skipped */
export default function SkipDayForm({ busy, onConfirm, onCancel, size = 'sm', className }: SkipDayFormProps) {
  const [reason, setReason] = useState('')

  function confirm() {
    onConfirm(reason.trim() || null)
  }

  return (
    <form
      className={cn('space-y-2 rounded-lg border border-surface-300 bg-surface-100 p-3', className)}
      onSubmit={(e) => {
        e.preventDefault()
        confirm()
      }}
    >
      <Input
        id="skip-day-reason"
        label="Why are you skipping? (optional)"
        placeholder="e.g. Sick, traveling, rest day"
        value={reason}
        maxLength={200}
        autoFocus
        disabled={busy}
        onChange={(e) => setReason(e.target.value)}
        onClear={() => setReason('')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          }
        }}
      />
      <div className="flex gap-2">
        <Button type="button" size={size} variant="ghost" disabled={busy} onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" size={size} variant="secondary" disabled={busy} className="flex-1">
          <SkipForward className={size === 'sm' ? 'h-3.5 w-3.5' : 'mr-1.5 h-4 w-4'} />
          {busy ? 'Skipping…' : 'Skip Day'}
        </Button>
      </div>
    </form>
  )
}

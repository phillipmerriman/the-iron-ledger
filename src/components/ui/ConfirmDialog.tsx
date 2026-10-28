import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  /** Label for the button that just closes the dialog (default "Cancel") */
  cancelLabel?: string
  /** Labels and handlers for action buttons (displayed left to right) */
  actions: {
    label: string
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    onClick: () => void
  }[]
}

export default function ConfirmDialog({ open, onClose, title, message, cancelLabel = 'Cancel', actions }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-surface-600 whitespace-pre-line">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? 'primary'}
            onClick={() => { action.onClick(); onClose() }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Modal>
  )
}

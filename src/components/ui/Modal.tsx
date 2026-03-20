import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  size?: keyof typeof sizeClasses
  children: ReactNode
}

export default function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div
        ref={backdropRef}
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      >
        <div className={`flex w-full ${sizeClasses[size]} max-h-[85vh] flex-col rounded-xl bg-card p-4 md:p-6 shadow-xl`}>
          <div className="mb-4 flex shrink-0 items-start justify-between">
            <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

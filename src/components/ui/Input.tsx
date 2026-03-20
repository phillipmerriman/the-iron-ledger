import { type InputHTMLAttributes, forwardRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  onClear?: () => void
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, onClear, value, ...props }, ref) => {
    const showClear = onClear && value !== undefined && value !== ''

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-surface-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={id}
            ref={ref}
            value={value}
            className={cn(
              'block w-full rounded-lg border bg-input-bg px-3 py-2 text-sm text-text shadow-sm transition-colors focus:outline-none focus:ring-1',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
                : 'border-input-border focus:border-primary-500 focus:ring-primary-500',
              showClear && 'pr-8',
              className,
            )}
            {...props}
          />
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-surface-400 hover:text-surface-600"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input

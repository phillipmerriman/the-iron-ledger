import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'primary' | 'danger' | 'warning' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 text-surface-700',
  primary: 'bg-primary-100 text-primary-700',
  danger: 'bg-danger-500/10 text-danger-600',
  warning: 'bg-warning-500/10 text-warning-600',
  info: 'bg-info-500/10 text-info-600',
}

export default function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'ui-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

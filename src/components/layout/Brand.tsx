import { Dumbbell } from 'lucide-react'

export default function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="ui-brand-mark flex items-center justify-center">
        <Dumbbell className="h-6 w-6 text-primary-600" />
      </span>
      <span className="ui-brand-name font-display text-lg font-bold text-surface-900">Iron Ledger</span>
    </div>
  )
}

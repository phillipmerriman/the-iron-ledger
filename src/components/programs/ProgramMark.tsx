import { Route } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Small icon marking a workout that belongs to an active program; hover shows which one */
export default function ProgramMark({ name, className }: { name: string; className?: string }) {
  return (
    <span title={`Part of ${name}`} className={cn('inline-flex shrink-0 items-center', className)}>
      <Route className="h-[1em] w-[1em]" aria-label={`Part of ${name}`} />
    </span>
  )
}

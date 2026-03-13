import { Pencil, Trash2, Play, Pause, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import type { Program } from '@/types/database'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

interface ProgramCardProps {
  program: Program
  onDelete: (id: string) => void
  onSetActive: (id: string) => void
  onDeactivate: (id: string) => void
}

export default function ProgramCard({ program, onDelete, onSetActive, onDeactivate }: ProgramCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <Link to={`/programs/${program.id}`} className="min-w-0 flex-1">
        <p className="font-medium text-surface-900">{program.name}</p>
        {program.description && (
          <p className="mt-0.5 text-sm text-surface-500">{program.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge>{format(parseISO(program.start_date), 'MMM d')}</Badge>
          <Badge>
            {program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}
          </Badge>
          {program.is_active && <Badge variant="primary">Active</Badge>}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        {program.is_active ? (
          <button
            onClick={() => onDeactivate(program.id)}
            className="rounded-lg p-1.5 text-primary-500 hover:bg-warning-50 hover:text-warning-600"
            aria-label="Deactivate program"
            title="Deactivate"
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onSetActive(program.id)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-primary-50 hover:text-primary-600"
            aria-label="Set as active program"
            title="Set as active"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        <Link
          to={`/plan/${program.id}`}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="Edit plan"
          title="Edit plan"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          onClick={() => onDelete(program.id)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-600"
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <Link
          to={`/programs/${program.id}`}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="View program details"
          title="View details"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  )
}

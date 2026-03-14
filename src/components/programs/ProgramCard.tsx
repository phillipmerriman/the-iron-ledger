import { Pencil, Trash2, Play, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Program } from '@/types/database'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

interface ProgramCardProps {
  program: Program
  onDelete: (id: string) => void
  onSetActive: (id: string) => void
}

export default function ProgramCard({ program, onDelete, onSetActive }: ProgramCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <Link to={`/programs/${program.id}`} className="min-w-0 flex-1">
        <p className="font-medium text-surface-900">{program.name}</p>
        {program.description && (
          <p className="mt-0.5 text-sm text-surface-500">{program.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge>
            {program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}
          </Badge>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onSetActive(program.id)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-primary-50 hover:text-primary-600"
          aria-label="Activate program"
          title="Activate with start date"
        >
          <Play className="h-4 w-4" />
        </button>
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

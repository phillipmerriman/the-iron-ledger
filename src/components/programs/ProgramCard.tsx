import { Pencil, Trash2, CirclePlay, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Program } from '@/types/database'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { getProgramTemplate } from '@/lib/program-templates'

interface ProgramCardProps {
  program: Program
  onDelete: (id: string) => void
  onSetActive: (id: string) => void
  onEdit: (id: string) => void
}

export default function ProgramCard({ program, onDelete, onSetActive, onEdit }: ProgramCardProps) {
  const isTemplate = program.template_type && program.template_type !== 'basic'
  // Template programs are generated, so there is no designer — send them to the plan instead
  const detailHref = isTemplate ? '/plan' : `/programs/${program.id}`
  return (
    <Card className="flex items-start justify-between gap-3">
      <Link to={detailHref} className="min-w-0 flex-1">
        <p className="font-medium text-surface-900">{program.name}</p>
        {program.description && (
          <p className="mt-0.5 text-sm text-surface-500">{program.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {isTemplate && <Badge variant="primary">{getProgramTemplate(program.template_type).name}</Badge>}
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
          <CirclePlay className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => onEdit(program.id)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="Edit program"
          title="Edit program"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(program.id)}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-600"
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <Link
          to={detailHref}
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

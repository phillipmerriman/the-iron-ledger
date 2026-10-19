import { ChevronRight } from 'lucide-react'
import { PROGRAM_TEMPLATES } from '@/lib/program-templates'
import type { ProgramTemplateType } from '@/types/program-templates'

interface ProgramTemplatePickerProps {
  onSelect: (template: ProgramTemplateType) => void
}

export default function ProgramTemplatePicker({ onSelect }: ProgramTemplatePickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-surface-500">Pick a template to start from.</p>
      {PROGRAM_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className="group w-full rounded-xl border border-surface-200 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary-400 hover:bg-primary-50/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold text-surface-900">{t.name}</p>
              <p className="mt-0.5 text-sm text-surface-600">{t.summary}</p>
            </div>
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-surface-300 group-hover:text-primary-500" />
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-surface-500">
            {t.guidelines.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </button>
      ))}
    </div>
  )
}

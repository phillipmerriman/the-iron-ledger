import type { ProgramTemplateType } from '@/types/program-templates'

export interface ProgramTemplateInfo {
  id: ProgramTemplateType
  name: string
}

/** Display names for template-driven programs (shown as a badge on program cards) */
export const PROGRAM_TEMPLATES: ProgramTemplateInfo[] = [
  { id: 'wildman_reverse_ladder', name: 'Progressive' },
]

export function getProgramTemplate(id: ProgramTemplateType | null | undefined): ProgramTemplateInfo {
  return PROGRAM_TEMPLATES.find((t) => t.id === id) ?? PROGRAM_TEMPLATES[0]
}

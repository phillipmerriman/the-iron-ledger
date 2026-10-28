import type { Program, ProgramActivation } from '@/types/database'

/** Activation id (a planned entry's `program_id`) → program name, or null for unscoped entries */
export type ProgramNameFor = (activationId: string | null | undefined) => string | null

export function programNameLookup(programs: Program[], activations: ProgramActivation[]): ProgramNameFor {
  const names = new Map<string, string>()
  for (const act of activations) {
    const program = programs.find((p) => p.id === act.program_id)
    if (program) names.set(act.id, program.name)
  }
  return (activationId) => (activationId ? names.get(activationId) ?? null : null)
}

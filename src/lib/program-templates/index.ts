import type { ProgramTemplateType } from '@/types/program-templates'

export interface ProgramTemplateInfo {
  id: ProgramTemplateType
  name: string
  summary: string
  guidelines: string[]
}

export const PROGRAM_TEMPLATES: ProgramTemplateInfo[] = [
  {
    id: 'basic',
    name: 'Basic',
    summary: 'Build your own program week by week in the program designer.',
    guidelines: [
      'Choose how many weeks the program runs, then drag exercises and saved workouts onto each day.',
      'Copy and paste days or whole weeks to build it out quickly.',
      'Activate it on a start date to put the workouts on your calendar.',
    ],
  },
  {
    id: 'wildman_reverse_ladder',
    name: 'Wildman Reverse Ladders | Sets -> Reps',
    summary: 'A self-progressing reverse-ladder program for a single exercise: add reps, then add sets, then add weight.',
    guidelines: [
      'Start with a few sets of a short reverse ladder (e.g. 2 × 2/2 1/1). Each stage adds one rep to the top of the ladder until you reach your max reps (default 5).',
      'Then add a set and drop back to the starting reps. Keep going until you hit your max sets of max reps (e.g. 5 × 5/5 4/4 3/3 2/2 1/1). Then increase the weight and start over.',
      'Think of your max working weight as about 33% of your body weight. If you can get to 50% of your body weight, you are doing very well.',
      'With auto progression, each stage lasts as many sessions as its top rung: 2 sessions at 2 reps, up to 5 sessions at 5 reps. You can always push a stage back if you are not ready.',
    ],
  },
]

export function getProgramTemplate(id: ProgramTemplateType | null | undefined): ProgramTemplateInfo {
  return PROGRAM_TEMPLATES.find((t) => t.id === id) ?? PROGRAM_TEMPLATES[0]
}

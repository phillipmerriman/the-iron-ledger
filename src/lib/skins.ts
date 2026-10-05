export type SkinId = 'classic' | 'command-deck'

export interface SkinDef {
  id: SkinId
  label: string
  /** 'switchable' honors the light/dark toggle; 'dark' forces dark mode. */
  mode: 'switchable' | 'dark'
  /** Desktop navigation style. 'tabs' shows a top tab bar on wide screens and the sidebar below that. */
  nav: 'sidebar' | 'tabs'
  /** Dashboard week calendar: 7-column grid, or one row per day. */
  weekLayout: 'grid' | 'list'
  /** Dashboard month calendar: round day dots, or bordered square cells with a status label. */
  monthLayout: 'dots' | 'cells'
  /** Dashboard: week and month calendars as two side-by-side panels instead of one "Calendars" panel. */
  splitCalendars: boolean
  /** Dashboard: large title with today's date under it and a full-size call-to-action button. */
  heroHeader: boolean
}

export const SKINS: Record<SkinId, SkinDef> = {
  classic: { id: 'classic', label: 'Classic', mode: 'switchable', nav: 'sidebar', weekLayout: 'grid', monthLayout: 'dots', splitCalendars: false, heroHeader: false },
  'command-deck': { id: 'command-deck', label: 'Command Deck', mode: 'dark', nav: 'tabs', weekLayout: 'list', monthLayout: 'cells', splitCalendars: true, heroHeader: true },
}

/** Active skin. Becomes a user setting once the design picker is added. */
export const ACTIVE_SKIN: SkinId = 'command-deck'

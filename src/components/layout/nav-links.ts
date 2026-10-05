import type { Location } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  ClipboardList,
  CalendarRange,
  Trophy,
  BarChart3,
  Scale,
  Timer,
  Database,
  Settings,
  ListChecks,
  CalendarDays,
  UtensilsCrossed,
  BookOpen,
  CalendarPlus,
  type LucideIcon,
} from 'lucide-react'

export interface NavLinkDef {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroupDef {
  label: string
  icon: LucideIcon
  children: NavLinkDef[]
  isActive: (location: Location) => boolean
}

export type NavItem = ({ type: 'link' } & NavLinkDef) | ({ type: 'group' } & NavGroupDef)

/** Single source for every nav destination. */
export const LINKS = {
  dashboard: { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  todaysWorkouts: { to: '/workouts/today', label: "Today's Workouts", icon: CalendarDays },
  savedWorkouts: { to: '/workouts', label: 'Saved Workouts', icon: ListChecks },
  recipes: { to: '/meals/recipes', label: 'Recipes', icon: BookOpen },
  mealPlan: { to: '/plan?mode=meals', label: 'Meal Plan', icon: CalendarPlus },
  exercises: { to: '/exercises', label: 'Exercises', icon: ClipboardList },
  programs: { to: '/programs', label: 'Programs', icon: CalendarRange },
  stats: { to: '/stats', label: 'Stats', icon: BarChart3 },
  records: { to: '/records', label: 'Records', icon: Trophy },
  body: { to: '/body', label: 'Body', icon: Scale },
  timers: { to: '/timers', label: 'Timers', icon: Timer },
  data: { to: '/data', label: 'Data', icon: Database },
  settings: { to: '/settings', label: 'Settings', icon: Settings },
} satisfies Record<string, NavLinkDef>

/** Full desktop nav (sidebar and top tabs). */
export const NAV_ITEMS: NavItem[] = [
  { type: 'link', ...LINKS.dashboard },
  {
    type: 'group',
    label: 'Workouts',
    icon: Dumbbell,
    children: [LINKS.todaysWorkouts, LINKS.savedWorkouts],
    isActive: (loc) => loc.pathname.startsWith('/workouts'),
  },
  {
    type: 'group',
    label: 'Meals',
    icon: UtensilsCrossed,
    children: [LINKS.recipes, LINKS.mealPlan],
    isActive: (loc) =>
      loc.pathname.startsWith('/meals') || (loc.pathname === '/plan' && loc.search.includes('mode=meals')),
  },
  { type: 'link', ...LINKS.exercises },
  { type: 'link', ...LINKS.programs },
  { type: 'link', ...LINKS.stats },
  { type: 'link', ...LINKS.records },
  { type: 'link', ...LINKS.body },
  { type: 'link', ...LINKS.timers },
  { type: 'link', ...LINKS.data },
  { type: 'link', ...LINKS.settings },
]

/** Mobile bottom bar. */
export const BOTTOM_NAV_LINKS: NavLinkDef[] = [
  LINKS.dashboard,
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/meals/recipes', label: 'Meals', icon: UtensilsCrossed },
  LINKS.exercises,
  LINKS.programs,
  LINKS.timers,
]

export type DrawerItem =
  | { type: 'heading'; label: string }
  | { type: 'divider' }
  | ({ type: 'link' } & NavLinkDef)

/** Mobile slide-out drawer. */
export const DRAWER_ITEMS: DrawerItem[] = [
  { type: 'heading', label: 'Workouts' },
  { type: 'link', ...LINKS.todaysWorkouts },
  { type: 'link', ...LINKS.savedWorkouts },
  { type: 'heading', label: 'More' },
  { type: 'link', ...LINKS.stats },
  { type: 'link', ...LINKS.records },
  { type: 'link', ...LINKS.body },
  { type: 'link', ...LINKS.data },
  { type: 'divider' },
  { type: 'link', ...LINKS.settings },
]

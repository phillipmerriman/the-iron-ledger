import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  ChevronDown,
  ListChecks,
  CalendarDays,
  UtensilsCrossed,
  BookOpen,
  CalendarPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/exercises', label: 'Exercises', icon: ClipboardList },
  { to: '/programs', label: 'Programs', icon: CalendarRange },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/records', label: 'Records', icon: Trophy },
  { to: '/body', label: 'Body', icon: Scale },
  { to: '/timers', label: 'Timers', icon: Timer },
  { to: '/data', label: 'Data', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

const workoutSubLinks = [
  { to: '/workouts/today', label: "Today's Workouts", icon: CalendarDays },
  { to: '/workouts', label: 'Saved Workouts', icon: ListChecks },
] as const

const mealSubLinks = [
  { to: '/meals/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/plan?mode=meals', label: 'Meal Plan', icon: CalendarPlus },
] as const

export default function Sidebar() {
  const location = useLocation()
  const workoutsActive = location.pathname.startsWith('/workouts')
  const [workoutsOpen, setWorkoutsOpen] = useState(workoutsActive)
  const mealsActive = location.pathname.startsWith('/meals') || (location.pathname === '/plan' && location.search.includes('mode=meals'))
  const [mealsOpen, setMealsOpen] = useState(mealsActive)

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Dumbbell className="h-6 w-6 text-primary-600" />
        <span className="font-display text-lg font-bold text-surface-900">Iron Ledger</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {/* Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'font-display flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
            )
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </NavLink>

        {/* Workouts — expandable */}
        <div>
          <button
            onClick={() => setWorkoutsOpen((o) => !o)}
            className={cn(
              'font-display flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              workoutsActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
            )}
          >
            <Dumbbell className="h-5 w-5" />
            Workouts
            <ChevronDown
              className={cn('ml-auto h-4 w-4 transition-transform', workoutsOpen && 'rotate-180')}
            />
          </button>
          {workoutsOpen && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-surface-200 pl-3">
              {workoutSubLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'font-display flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-surface-500 hover:bg-surface-100 hover:text-surface-900',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Meals — expandable */}
        <div>
          <button
            onClick={() => setMealsOpen((o) => !o)}
            className={cn(
              'font-display flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              mealsActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
            )}
          >
            <UtensilsCrossed className="h-5 w-5" />
            Meals
            <ChevronDown
              className={cn('ml-auto h-4 w-4 transition-transform', mealsOpen && 'rotate-180')}
            />
          </button>
          {mealsOpen && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-surface-200 pl-3">
              {mealSubLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'font-display flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-surface-500 hover:bg-surface-100 hover:text-surface-900',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Remaining links */}
        {links.slice(1).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'font-display flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

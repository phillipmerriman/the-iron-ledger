import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  ClipboardList,
  CalendarRange,
  Trophy,
  Scale,
  Timer,
  Database,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: ClipboardList },
  { to: '/programs', label: 'Programs', icon: CalendarRange },
  { to: '/records', label: 'Records', icon: Trophy },
  { to: '/body', label: 'Body', icon: Scale },
  { to: '/timers', label: 'Timers', icon: Timer },
  { to: '/data', label: 'Data', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-surface-200 md:bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-surface-200 px-4">
        <Dumbbell className="h-6 w-6 text-primary-600" />
        <span className="font-display text-lg font-bold text-surface-900">FitTrack</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {links.map(({ to, label, icon: Icon }) => (
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

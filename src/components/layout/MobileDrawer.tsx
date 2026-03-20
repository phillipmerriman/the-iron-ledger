import { NavLink } from 'react-router-dom'
import {
  X,
  CalendarDays,
  ListChecks,
  BarChart3,
  Trophy,
  Scale,
  Database,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DrawerHeading = { type: 'heading'; label: string }
type DrawerDivider = { type: 'divider' }
type DrawerLink = { type: 'link'; to: string; label: string; icon: typeof CalendarDays }
type DrawerItem = DrawerHeading | DrawerDivider | DrawerLink

const drawerItems: DrawerItem[] = [
  { type: 'heading', label: 'Workouts' },
  { type: 'link', to: '/workouts/today', label: "Today's Workouts", icon: CalendarDays },
  { type: 'link', to: '/workouts', label: 'Saved Workouts', icon: ListChecks },
  { type: 'heading', label: 'More' },
  { type: 'link', to: '/stats', label: 'Stats', icon: BarChart3 },
  { type: 'link', to: '/records', label: 'Records', icon: Trophy },
  { type: 'link', to: '/body', label: 'Body', icon: Scale },
  { type: 'link', to: '/data', label: 'Data', icon: Database },
  { type: 'divider' },
  { type: 'link', to: '/settings', label: 'Settings', icon: Settings },
]

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-xl transition-transform duration-200 ease-in-out md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-display text-lg font-bold text-surface-900">Menu</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="space-y-1 px-2 py-3">
          {drawerItems.map((item, i) => {
            if (item.type === 'divider') {
              return <div key={i} className="my-2 border-t border-surface-100" />
            }
            if (item.type === 'heading') {
              return (
                <p key={i} className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                  {item.label}
                </p>
              )
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/workouts'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'font-display flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </>
  )
}

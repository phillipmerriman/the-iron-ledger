import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DRAWER_ITEMS } from './nav-links'

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
          'ui-drawer fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-xl transition-transform duration-200 ease-in-out md:hidden',
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
          {DRAWER_ITEMS.map((item, i) => {
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

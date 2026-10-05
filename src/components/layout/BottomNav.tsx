import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV_LINKS } from './nav-links'

export default function BottomNav() {
  return (
    <nav className="ui-bottomnav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around">
        {BOTTOM_NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary-600' : 'text-surface-400',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

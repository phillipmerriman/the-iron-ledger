import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import Brand from './Brand'
import { NAV_ITEMS, type NavGroupDef } from './nav-links'

const itemClass = (active: boolean) =>
  cn(
    'font-display flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-primary-50 text-primary-700'
      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
  )

function SidebarGroup({ group }: { group: NavGroupDef }) {
  const location = useLocation()
  const active = group.isActive(location)
  const [open, setOpen] = useState(active)
  const Icon = group.icon

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className={cn(itemClass(active), 'w-full')}>
        <Icon className="h-5 w-5" />
        {group.label}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-surface-200 pl-3">
          {group.children.map(({ to, label, icon: ChildIcon }) => (
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
              <ChildIcon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { skinDef } = useTheme()

  return (
    <aside
      className={cn(
        'ui-sidebar hidden md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-card',
        // Skins with top tabs hand off to the tab bar on wide screens
        skinDef.nav === 'tabs' && 'xl:hidden',
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-4">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) =>
          item.type === 'group' ? (
            <SidebarGroup key={item.label} group={item} />
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => itemClass(isActive)}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  )
}

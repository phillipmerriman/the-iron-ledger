import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav-links'

const tabClass = (active: boolean) =>
  cn(
    'ui-tab font-display flex min-h-11 items-center gap-1.5 px-4 text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors',
    active ? 'ui-tab-active bg-nav-active-bg text-nav-active-text' : 'text-text-secondary hover:bg-hover hover:text-text',
  )

/** Top tab bar for wide screens. Only rendered by skins with nav: 'tabs'. */
export default function TopNav() {
  const location = useLocation()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!openGroup) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenGroup(null)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenGroup(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openGroup])

  return (
    <nav ref={ref} aria-label="Main" className="ui-topnav hidden border-b border-border px-4 xl:block">
      <div className="flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) =>
          item.type === 'group' ? (
            <div key={item.label} className="relative">
              <button
                onClick={() => setOpenGroup((g) => (g === item.label ? null : item.label))}
                aria-expanded={openGroup === item.label}
                aria-haspopup="true"
                className={tabClass(item.isActive(location))}
              >
                {item.label}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openGroup === item.label && 'rotate-180')} />
              </button>
              {openGroup === item.label && (
                <div className="ui-menu absolute left-0 top-full z-30 mt-1 w-56 space-y-0.5 rounded-lg border border-border bg-card p-1 shadow-lg">
                  {item.children.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      onClick={() => setOpenGroup(null)}
                      className={({ isActive }) =>
                        cn(
                          'font-display flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
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
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => tabClass(isActive)}>
              {item.label}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}

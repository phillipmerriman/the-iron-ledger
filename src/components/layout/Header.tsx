import { LogOut, Dumbbell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Header() {
  const { profile, signOut } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-200 bg-white px-4">
      {/* Mobile logo — hidden on md+ where sidebar shows it */}
      <div className="flex items-center gap-2 md:hidden">
        <Dumbbell className="h-5 w-5 text-primary-600" />
        <span className="font-bold text-surface-900">Iron Ledger</span>
      </div>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <span className="text-sm text-surface-600">
          {profile?.display_name ?? profile?.email}
        </span>
        <button
          onClick={signOut}
          className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

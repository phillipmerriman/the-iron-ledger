import { Outlet } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import TopNav from './TopNav'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { skinDef } = useTheme()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {skinDef.nav === 'tabs' && <TopNav />}

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {/* With top tabs the sidebar's width is freed up, so content can run wider */}
          <div className={cn('mx-auto max-w-5xl px-4 py-6', skinDef.nav === 'tabs' && 'xl:max-w-7xl')}>
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}

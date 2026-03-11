import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'
import { Truck, Map, LogOut, UserCircle } from 'lucide-react'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('driver', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">AHAWC Driver Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/driver/deliveries" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <Truck className="w-4 h-4" />Deliveries
          </Link>
          <Link href="/driver/map" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <Map className="w-4 h-4" />Map
          </Link>
          <Link href="/driver/profile" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <UserCircle className="w-4 h-4" />Profile
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto py-8 px-4">{children}</main>
      {isSuperAdmin ? (
        <div className="fixed bottom-4 left-4 z-40">
          <SuperAdminViewSwitcher />
        </div>
      ) : null}
    </div>
  )
}

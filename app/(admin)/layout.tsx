import { requireAdmin } from '@/lib/auth/session'
import AdminSidebar from '@/components/layout/AdminSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar showViewSwitcher={isSuperAdmin} />
      <main className="flex-1 overflow-auto">
        <TestSmsBar />
        {children}
      </main>
    </div>
  )
}

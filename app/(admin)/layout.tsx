import { requireAdmin } from '@/lib/auth/session'
import AdminSidebar from '@/components/layout/AdminSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <TestSmsBar />
        {children}
      </main>
    </div>
  )
}

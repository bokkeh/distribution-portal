import { requireAdminOrStaff } from '@/lib/auth/session'
import StaffSidebar from '@/components/layout/StaffSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminOrStaff()
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  return (
    <div className="flex min-h-screen bg-slate-50">
      <StaffSidebar showViewSwitcher={isSuperAdmin} />
      <main className="flex-1 overflow-auto">
        <TestSmsBar />
        {children}
      </main>
      {isSuperAdmin ? (
        <div className="fixed bottom-4 left-4 z-40 md:hidden">
          <SuperAdminViewSwitcher />
        </div>
      ) : null}
    </div>
  )
}

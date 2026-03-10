import { requireAdminOrStaff } from '@/lib/auth/session'
import StaffSidebar from '@/components/layout/StaffSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrStaff()
  return (
    <div className="flex min-h-screen bg-slate-50">
      <StaffSidebar />
      <main className="flex-1 overflow-auto">
        <TestSmsBar />
        {children}
      </main>
    </div>
  )
}

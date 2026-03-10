import { requireAdminOrStaff } from '@/lib/auth/session'
import StaffSidebar from '@/components/layout/StaffSidebar'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrStaff()
  return (
    <div className="flex min-h-screen bg-slate-50">
      <StaffSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

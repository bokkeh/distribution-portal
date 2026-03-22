import { requireRole } from '@/lib/auth/session'
import SalesNav from '@/components/layout/SalesNav'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <SalesNav userName={session.user.name ?? undefined} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

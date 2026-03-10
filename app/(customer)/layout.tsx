import { requireRole } from '@/lib/auth/session'
import CustomerNav from '@/components/layout/CustomerNav'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireRole('customer')
  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

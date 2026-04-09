import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { MarketingPage } from '@/components/marketing/MarketingPage'

export default async function HomePage() {
  const session = await auth()

  if (session) {
    const role = (session.user as { role?: string }).role
    const roles = (session.user as { roles?: string[] }).roles ?? (role ? [role] : [])
    if (roles.includes('admin')) redirect('/admin/dashboard')
    if (roles.includes('staff')) redirect('/staff/dashboard')
    if (roles.includes('driver')) redirect('/driver/deliveries')
    if (roles.includes('sales_rep') || roles.includes('sales_manager')) redirect('/sales/dashboard')
    if (roles.includes('taster')) redirect('/taster/welcome')
    if (roles.includes('customer')) redirect('/customer/dashboard')
  }

  return <MarketingPage />
}

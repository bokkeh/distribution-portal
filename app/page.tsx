import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { MarketingPage } from '@/components/marketing/MarketingPage'

export default async function HomePage() {
  const session = await auth()

  if (session) {
    const role = (session.user as any).role
    if (role === 'admin') redirect('/admin/dashboard')
    if (role === 'staff') redirect('/staff/dashboard')
    if (role === 'driver') redirect('/driver/deliveries')
    if (role === 'customer') redirect('/customer/dashboard')
  }

  return <MarketingPage />
}

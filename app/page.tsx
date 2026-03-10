import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'

export default async function HomePage() {
  const session = await auth()

  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role === 'admin') redirect('/admin/dashboard')
  if (role === 'staff') redirect('/staff/dashboard')
  if (role === 'driver') redirect('/driver/deliveries')
  if (role === 'customer') redirect('/customer/dashboard')

  redirect('/login')
}

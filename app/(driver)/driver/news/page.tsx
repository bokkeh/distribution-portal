import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function DriverNewsPage() {
  await requireRole('driver', 'admin')
  return <IndustryNewsFeedPage audience="driver" />
}

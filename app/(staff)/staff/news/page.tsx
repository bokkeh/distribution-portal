import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function StaffNewsPage() {
  await requireRole('admin', 'staff')
  return <IndustryNewsFeedPage audience="staff" />
}

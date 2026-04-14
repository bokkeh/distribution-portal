import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function AdminNewsPage() {
  await requireRole('admin')
  return <IndustryNewsFeedPage audience="admin" />
}

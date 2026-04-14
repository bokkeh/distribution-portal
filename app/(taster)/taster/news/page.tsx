import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function TasterNewsPage() {
  await requireRole('taster', 'admin')
  return <IndustryNewsFeedPage audience="taster" />
}

import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function CustomerNewsPage() {
  await requireRole('customer')
  return <IndustryNewsFeedPage audience="customer" />
}

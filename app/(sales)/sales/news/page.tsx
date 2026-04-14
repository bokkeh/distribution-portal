import { requireRole } from '@/lib/auth/session'
import { IndustryNewsFeedPage } from '@/components/news/IndustryNewsFeedPage'

export default async function SalesNewsPage() {
  await requireRole('sales_rep', 'sales_manager', 'admin')
  return <IndustryNewsFeedPage audience="sales" />
}

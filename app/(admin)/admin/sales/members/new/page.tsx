import { requireAdmin } from '@/lib/auth/session'
import { getPromotableUsers } from '@/actions/sales-members'
import { AddSalesMemberForm } from './AddSalesMemberForm'

export default async function NewSalesMemberPage() {
  await requireAdmin()
  const existingUsers = await getPromotableUsers()
  return <AddSalesMemberForm existingUsers={existingUsers} />
}

import Link from 'next/link'
import { redirect } from 'next/navigation'

export default function StaffSampleInventoryPage() {
  redirect('/staff/sample-inventory/new')
  return <Link href="/staff/sample-inventory/new">New sample request</Link>
}

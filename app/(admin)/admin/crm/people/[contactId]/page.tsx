import { ContactRecordPage } from '@/components/crm/ContactRecordPage'
export default async function Page({ params }: { params: Promise<{ contactId: string }> }) {
  return <ContactRecordPage contactId={(await params).contactId} mode="admin" />
}

import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Request Wholesale Access - AHAWC',
  description: 'Request an approved AHAWC wholesale portal account.',
}

export default function PartnerPage() {
  redirect('/join')
}

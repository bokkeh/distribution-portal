'use client'

import { MessageSquare } from 'lucide-react'

export default function DriverMessageButton({
  phone,
  driverName,
}: {
  phone: string
  driverName: string
}) {
  const smsHref = `sms:${phone}?&body=${encodeURIComponent(`Hi ${driverName}, I have a question about the delivery.`)}`

  return (
    <a
      href={smsHref}
      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800"
    >
      <MessageSquare className="h-4 w-4" />
      Message Driver
    </a>
  )
}

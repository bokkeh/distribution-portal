'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link2, Check } from 'lucide-react'

export function CopyPaymentLinkButton({ paymentPath }: { paymentPath: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = paymentPath.startsWith('http') ? paymentPath : `${window.location.origin}${paymentPath}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleCopy}>
      {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Link2 className="mr-2 h-4 w-4" />}
      {copied ? 'Link copied!' : 'Copy Payment Link'}
    </Button>
  )
}

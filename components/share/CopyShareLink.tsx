'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Link2 } from 'lucide-react'

export default function CopyShareLink({
  path,
  label = 'Share Link',
}: {
  path: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
      {copied ? 'Copied!' : label}
    </Button>
  )
}

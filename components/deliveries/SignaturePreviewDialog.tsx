'use client'

import Image from 'next/image'
import { PenSquare } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'

export function SignaturePreviewDialog({
  stopLabel,
  signerName,
  signatureUrl,
}: {
  stopLabel: string
  signerName?: string | null
  signatureUrl: string
}) {
  const resolvedUrl = signedPhotoUrl(signatureUrl) ?? signatureUrl

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="rounded-full p-1 text-violet-600 transition-colors hover:bg-violet-50"
          aria-label={`View signature for ${stopLabel}`}
          title="View signature"
        >
          <PenSquare className="h-3.5 w-3.5 shrink-0" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delivery Signature</AlertDialogTitle>
          <AlertDialogDescription>
            {signerName ? `Signed by ${signerName}` : 'Recipient signature on file'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">{stopLabel}</p>
          <div className="relative h-64 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Image
              src={resolvedUrl}
              alt={`Delivery signature for ${stopLabel}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <AlertDialogCancel>Close</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

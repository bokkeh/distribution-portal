import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <CheckCircle2 className="mx-auto w-14 h-14 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you! Your payment has been submitted successfully. You will receive a confirmation once it has been processed.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Questions? Contact us at <a href="mailto:info@ahawc.com" className="underline">info@ahawc.com</a></p>
      </div>
    </div>
  )
}

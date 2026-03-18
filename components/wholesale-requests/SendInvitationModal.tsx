'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendWholesalerInvitation } from '@/actions/wholesale-requests'

export function SendInvitationModal() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await sendWholesalerInvitation(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Invitation sent', {
        description: `We sent them a link to request access at /join.`,
      })
      formRef.current?.reset()
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Mail className="h-4 w-4" />
        Send Invitation
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">Send Invitation</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Invite someone to request a wholesale account.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form ref={formRef} action={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-900">
                  Email address <span className="text-red-500">*</span>
                </label>
                <Input
                  name="email"
                  type="email"
                  placeholder="wholesaler@example.com"
                  required
                  autoFocus
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-900">
                  Personal message <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  name="personalMessage"
                  placeholder="Hi, I'd like to invite you to apply for a wholesale account with AHAWC..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">This message will appear in the invitation email along with a link to the signup form.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={isPending} className="flex-1">
                  {isPending ? 'Sending…' : 'Send Invitation'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

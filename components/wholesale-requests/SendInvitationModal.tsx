'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resendWholesalerApprovalEmail, sendWholesalerInvitation } from '@/actions/wholesale-requests'

interface Props {
  defaultEmail?: string
  defaultMessage?: string
  businessName?: string
  mode?: 'invitation' | 'approval'
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  title?: string
  description?: string
}

export function SendInvitationModal({
  defaultEmail = '',
  defaultMessage = '',
  businessName = '',
  mode = 'invitation',
  triggerLabel = 'Send Invitation',
  triggerVariant = 'outline',
  title = 'Send Invitation',
  description = 'Invite someone to request a wholesale account.',
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (businessName) {
        formData.set('businessName', businessName)
      }

      const result = mode === 'approval'
        ? await resendWholesalerApprovalEmail(formData)
        : await sendWholesalerInvitation(formData)

      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success(mode === 'approval' ? 'Approval email sent' : 'Invitation sent', {
        description: mode === 'approval'
          ? 'We sent them the sign-in email again.'
          : 'We sent them a link to request access at /join.',
      })
      formRef.current?.reset()
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)} className="gap-2">
        <Mail className="h-4 w-4" />
        {triggerLabel}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
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
                  defaultValue={defaultEmail}
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
                  defaultValue={defaultMessage}
                  className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  {mode === 'approval'
                    ? 'This message will appear in the approval email along with a link to the sign-in page.'
                    : 'This message will appear in the invitation email along with a link to the signup form.'}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={isPending} className="flex-1">
                  {isPending ? 'Sending...' : mode === 'approval' ? 'Send Approval Email' : 'Send Invitation'}
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

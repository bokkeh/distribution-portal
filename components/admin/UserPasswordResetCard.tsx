'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { resetUserPassword, sendUserWelcomeEmail } from '@/actions/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UserPasswordResetCardProps = {
  userId: string
  email: string
  name: string
  roleLabel: string
}

export function UserPasswordResetCard({ userId, email, name, roleLabel }: UserPasswordResetCardProps) {
  const [state, action, pending] = useActionState(resetUserPassword, null)
  const [emailState, sendEmailAction, emailPending] = useActionState(sendUserWelcomeEmail, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to reset password', { description: state.error })
      return
    }

    if (state?.success) {
      formRef.current?.reset()
      toast.success('Password reset')
    }
  }, [state])

  useEffect(() => {
    if (emailState?.error) toast.error('Failed to send email', { description: emailState.error })
    else if (emailState?.success) toast.success('Login email sent')
  }, [emailState])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Reset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Temporary Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              minLength={8}
              placeholder="Leave blank to auto-generate"
            />
            <p className="text-xs text-muted-foreground">
              Leave this blank to generate a fresh temporary password. Passwords are hashed and cannot be recovered later.
            </p>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>

        {state?.success && state.temporaryPassword ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-slate-900">
              New temporary password for {email}
            </p>
            <Input
              readOnly
              value={state.temporaryPassword}
              className="bg-white font-mono"
            />
            <p className="text-xs text-slate-600">
              Share this securely with the user. Their previous password no longer works.
            </p>
            <form action={sendEmailAction}>
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={state.temporaryPassword} />
              <input type="hidden" name="roleLabel" value={roleLabel} />
              <Button type="submit" variant="outline" size="sm" disabled={emailPending}>
                {emailPending ? 'Sending...' : 'Email login details to user'}
              </Button>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

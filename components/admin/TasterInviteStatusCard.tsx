import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResendTasterInviteButton } from './ResendTasterInviteButton'

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    typeof value === 'string' ? new Date(value) : value,
  )
}

const STATUS_BADGE: Record<string, 'success' | 'secondary' | 'outline' | 'destructive'> = {
  invited: 'secondary',
  active: 'success',
  disabled: 'destructive',
}

export function TasterInviteStatusCard({
  userId,
  accountStatus,
  invite,
}: {
  userId: string
  accountStatus: 'invited' | 'active' | 'disabled'
  invite: { status: string; createdAt: Date; acceptedAt: Date | null } | null
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Invitation & Account Status</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-muted-foreground">Account Status</p>
            <Badge variant={STATUS_BADGE[accountStatus] ?? 'outline'} className="capitalize mt-1">{accountStatus}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Invitation Status</p>
            <p className="font-medium capitalize mt-1">{invite?.status ?? 'Not sent'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Invitation Sent</p>
            <p className="font-medium mt-1">{invite ? formatDateTime(invite.createdAt) : '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Password Setup Completed</p>
            <p className="font-medium mt-1">{invite?.acceptedAt ? formatDateTime(invite.acceptedAt) : '-'}</p>
          </div>
        </div>
        {accountStatus === 'invited' && (
          <div className="pt-2">
            <ResendTasterInviteButton userId={userId} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

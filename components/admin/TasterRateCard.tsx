'use client'

import { useActionState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { setTasterHourlyRate } from '@/actions/users'

interface Props {
  userId: string
  currentRate: string | null
}

export function TasterRateCard({ userId, currentRate }: Props) {
  const [state, action, pending] = useActionState(setTasterHourlyRate, null)

  return (
    <Card>
      <CardHeader><CardTitle>Taster Pay Rate</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <div className="space-y-2">
            <Label htmlFor="tasterHourlyRate">Hourly Rate ($/hr)</Label>
            <Input
              id="tasterHourlyRate"
              name="tasterHourlyRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={currentRate ?? '25.00'}
            />
            <p className="text-xs text-muted-foreground">
              This rate is used to calculate invoice totals when this taster submits hours.
              Tasters cannot see or change this value.
            </p>
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          {state?.success && <p className="text-xs text-green-600">Rate saved.</p>}
          <Button type="submit" disabled={pending} size="sm">
            {pending ? 'Saving…' : 'Save Rate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

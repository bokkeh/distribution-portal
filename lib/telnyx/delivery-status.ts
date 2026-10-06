export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'delivery_unconfirmed'
export type SmsDeliveryUpdate = { phoneNumber: string; status: SmsDeliveryStatus; error: string | null }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function getSmsDeliveryUpdates(value: unknown): SmsDeliveryUpdate[] {
  const payload = record(value)
  const errors = Array.isArray(payload.errors) ? payload.errors.map(record) : []
  const error = errors.map(item => [item.code, item.detail ?? item.title].filter(Boolean).join(': ')).join('; ') || null
  const recipients = Array.isArray(payload.to) ? payload.to : []
  return recipients.flatMap<SmsDeliveryUpdate>(value => {
    const recipient = record(value)
    if (typeof recipient.phone_number !== 'string') return []
    const status = recipient.status
    if (status === 'delivered') return [{ phoneNumber: recipient.phone_number, status: 'delivered' as const, error: null }]
    if (status === 'delivery_failed' || status === 'sending_failed' || status === 'failed') {
      return [{ phoneNumber: recipient.phone_number, status: 'failed' as const, error: error ?? 'Carrier rejected delivery.' }]
    }
    if (status === 'delivery_unconfirmed') return [{ phoneNumber: recipient.phone_number, status, error: error ?? 'Carrier could not confirm delivery.' }]
    if (status === 'sent') return [{ phoneNumber: recipient.phone_number, status, error: null }]
    if (status === 'queued' || status === 'sending') return [{ phoneNumber: recipient.phone_number, status: 'queued' as const, error: null }]
    return []
  })
}

export function isFinalSmsStatus(status: SmsDeliveryStatus): status is 'delivered' | 'failed' | 'delivery_unconfirmed' {
  return status === 'delivered' || status === 'failed' || status === 'delivery_unconfirmed'
}

export function getMutableSmsStatuses(next: SmsDeliveryStatus): Array<'queued' | 'sent' | 'delivery_unconfirmed'> {
  if (next === 'delivered') return ['queued', 'sent', 'delivery_unconfirmed']
  return next === 'queued' ? ['queued'] : ['queued', 'sent']
}

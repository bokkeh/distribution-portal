export type NotificationChannel = 'email' | 'sms' | 'chat' | 'in-app'

export interface NotificationResult {
  channel: NotificationChannel
  success: boolean
  error?: string
}

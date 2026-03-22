import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'

export async function GET() {
  try {
    const session = await requireAuth()
    const data = await getBellNotificationsForUser(session.user.id)
    return NextResponse.json(data)
  } catch {
    return new NextResponse('Unauthorized', { status: 401 })
  }
}

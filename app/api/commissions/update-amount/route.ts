import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { db } from '@/db'
import { commissions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    await requireAdminOrStaff()
    const { id, amount } = await req.json() as { id: string; amount: string }
    if (!id || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await db
      .update(commissions)
      .set({ amount })
      .where(eq(commissions.id, id))

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

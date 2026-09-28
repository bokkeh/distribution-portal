import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderDocuments } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { generateSignedReadUrl } from '@/lib/gcs/client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string; documentId: string }> }) {
  await requireFeature('orders', 'admin', 'staff')
  const { orderId, documentId } = await params
  if (![orderId, documentId].every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) return new NextResponse('Invalid document', { status: 400 })
  const [document] = await db.select().from(orderDocuments)
    .where(and(eq(orderDocuments.orderId, orderId), eq(orderDocuments.id, documentId))).limit(1)
  if (!document || !document.storagePath.startsWith(`order-documents/${orderId}/`) || document.storagePath.includes('..')) return new NextResponse('Not found', { status: 404 })
  try {
    const upstream = await fetch(await generateSignedReadUrl(document.storagePath), { cache: 'no-store' })
    if (!upstream.ok) return new NextResponse('Document unavailable', { status: 404 })
    const disposition = req.nextUrl.searchParams.get('download') === '1' || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(document.contentType) ? 'attachment' : 'inline'
    return new NextResponse(upstream.body, { headers: {
      'Content-Type': document.contentType,
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    } })
  } catch { return new NextResponse('Document unavailable', { status: 502 }) }
}

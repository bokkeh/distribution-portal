import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderDocuments, orders } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { uploadBuffer, deleteObject } from '@/lib/gcs/client'
import { isUploadRateLimited, rateLimitResponse } from '@/lib/auth/rate-limit'
import { validatePoFile, MAX_PO_BYTES } from '@/lib/orders/po-files'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await requireFeature('orders', 'admin', 'staff')
  if (await isUploadRateLimited(session.user.id)) return rateLimitResponse()
  const { orderId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 })
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  if (Number(req.headers.get('content-length')) > MAX_PO_BYTES + 65536) return NextResponse.json({ error: 'Maximum file size is 4 MB.' }, { status: 413 })
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file.' }, { status: 400 })
  if (file.size > MAX_PO_BYTES) return NextResponse.json({ error: 'Maximum file size is 4 MB.' }, { status: 413 })
  const buffer = Buffer.from(await file.arrayBuffer())
  const validation = validatePoFile(file.name, file.size, buffer)
  if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 })
  let storagePath: string | undefined
  try {
    const uploaded = await uploadBuffer(`${orderId}/${randomUUID()}.${validation.extension}`, validation.contentType, buffer, 'order-documents')
    storagePath = uploaded.filePath
    await db.insert(orderDocuments).values({ orderId, fileName: file.name.slice(0, 255), storagePath,
      contentType: validation.contentType, uploadedByUserId: session.user.id })
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath(`/staff/orders/${orderId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (storagePath) await deleteObject(storagePath).catch(() => {})
    console.error('PO upload failed', error)
    return NextResponse.json({ error: 'Unable to upload the PO. Please try again.' }, { status: 500 })
  }
}

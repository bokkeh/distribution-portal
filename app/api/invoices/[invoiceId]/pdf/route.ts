import React from 'react'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { requireAuth } from '@/lib/auth/session'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { InvoicePdfDocument } from '@/components/invoices/InvoicePdfDocument'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await requireAuth()
  const { invoiceId } = await params
  const roles = session.user.roles ?? [session.user.role]
  const invoice = await getInvoiceDetailData(invoiceId)

  if (!invoice) {
    return new NextResponse('Invoice not found', { status: 404 })
  }

  if (roles.includes('customer')) {
    const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.userId, session.user.id)).limit(1)
    if (!account || account.id !== invoice.customerId) {
      return new NextResponse('Unauthorized', { status: 403 })
    }
  } else if (!roles.some((role) => ['admin', 'staff'].includes(role))) {
    return new NextResponse('Unauthorized', { status: 403 })
  }

  const document = React.createElement(InvoicePdfDocument, { invoice }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(document)
  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

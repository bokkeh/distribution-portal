import React from 'react'
import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { InvoicePdfDocument } from '@/components/invoices/InvoicePdfDocument'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { resolveInvoiceIdFromPublicToken } from '@/lib/invoices/public-token'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invoiceId = resolveInvoiceIdFromPublicToken(token)
  if (!invoiceId) return new NextResponse('Invalid invoice link', { status: 404 })
  const invoice = await getInvoiceDetailData(invoiceId)
  if (!invoice) return new NextResponse('Invoice not found', { status: 404 })
  let logoDataUrl: string | null = null
  try {
    const logo = fs.readFileSync(path.join(process.cwd(), 'public', 'brand', 'logo.png'))
    logoDataUrl = `data:image/png;base64,${logo.toString('base64')}`
  } catch {}
  const document = React.createElement(InvoicePdfDocument, { invoice, logoDataUrl }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(document)
  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

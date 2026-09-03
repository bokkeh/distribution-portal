import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { InvoiceDetailData } from '@/lib/invoices/read'
import {
  ACH_REMITTANCE_LINES,
  CHECK_REMITTANCE_LINES,
  WIRE_TRANSFER_LINES,
} from '@/lib/invoices/constants'

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  PREPAID: 'Prepaid', DUE_ON_RECEIPT: 'Due on Receipt',
  NET7: 'Net 7', NET10: 'Net 10', NET15: 'Net 15', NET30: 'Net 30',
  NET45: 'Net 45', NET60: 'Net 60', NET90: 'Net 90', COD: 'COD',
  '2/10_NET30': '2/10 Net 30',
}
function formatPaymentTerms(t: string | null) { return t ? (PAYMENT_TERMS_LABELS[t] ?? t) : 'Net 30' }

const styles = StyleSheet.create({
  page: { padding: 36, backgroundColor: '#ffffff', fontSize: 11, color: '#0f172a' },
  header: { backgroundColor: '#0f172a', borderRadius: 18, padding: 24, marginBottom: 24 },
  eyebrow: { fontSize: 9, color: '#bfdbfe', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
  title: { fontSize: 26, color: '#ffffff', fontWeight: 700, marginBottom: 6 },
  subtitle: { fontSize: 10, color: '#cbd5e1', lineHeight: 1.5 },
  headerRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  summaryBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, minWidth: 180 },
  summaryRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: '#cbd5e1', fontSize: 9 },
  summaryValue: { color: '#ffffff', fontSize: 10, fontWeight: 600 },
  grid: { display: 'flex', flexDirection: 'row', gap: 18, marginBottom: 20 },
  panel: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, backgroundColor: '#ffffff' },
  softPanel: { backgroundColor: '#f8fafc' },
  panelEyebrow: { fontSize: 9, color: '#64748b', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 },
  panelHeading: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  panelText: { fontSize: 10, color: '#475569', marginBottom: 3 },
  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  tableHeader: { display: 'flex', flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableRow: { display: 'flex', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableRowLast: { borderBottomWidth: 0 },
  cell: { padding: 10, fontSize: 10 },
  itemCell: { width: '34%' },
  skuCell: { width: '18%' },
  qtyCell: { width: '12%', textAlign: 'right' },
  unitCell: { width: '18%', textAlign: 'right' },
  totalCell: { width: '18%', textAlign: 'right' },
  totalsWrap: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  checkMailingBox: { width: 220, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, backgroundColor: '#f8fafc' },
  paymentHeading: { fontSize: 10, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  paymentSection: { marginTop: 10 },
  totalsBox: { width: 220, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16 },
  totalRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, fontSize: 10 },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 6, fontSize: 13, fontWeight: 700, color: '#1d4ed8' },
})

function fmtCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function fmtDate(value: Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
}

export function InvoicePdfDocument({ invoice, logoDataUrl }: { invoice: InvoiceDetailData; logoDataUrl?: string | null }) {
  const appliedMethodLabel = invoice.stripeCheckout.appliedMethodLabel
  const appliedProcessingFee = invoice.stripeCheckout.appliedProcessingFee
  const appliedTotal = invoice.stripeCheckout.appliedTotal
  const hasAppliedStripeFee = (
    invoice.stripeCheckout.appliedMethod !== null &&
    appliedMethodLabel !== null &&
    appliedProcessingFee !== null &&
    appliedTotal !== null
  )
  const totalDisplay = hasAppliedStripeFee ? appliedTotal : invoice.total
  const dueDateDisplay = invoice.isPrepaidSettled
    ? 'Paid already'
    : invoice.dueDate
      ? fmtDate(invoice.dueDate)
      : '-'

  return (
    <Document title={invoice.invoiceNumber}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                {logoDataUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image does not support alt text props
                  <Image src={logoDataUrl} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#ffffff' }} />
                ) : null}
                <Text style={styles.eyebrow}>AHAWC Distribution</Text>
              </View>
              <Text style={styles.title}>Invoice</Text>
              <Text style={styles.subtitle}>Premium distribution billing statement for products, tasting support, and related account charges.</Text>
            </View>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Invoice #</Text><Text style={styles.summaryValue}>{invoice.invoiceNumber}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Issue date</Text><Text style={styles.summaryValue}>{fmtDate(invoice.createdAt)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Due date</Text><Text style={styles.summaryValue}>{dueDateDisplay}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.panel, styles.softPanel]}>
            <Text style={styles.panelEyebrow}>Bill To</Text>
            <Text style={styles.panelHeading}>{invoice.companyName}</Text>
            {invoice.customerAddressLines.map((line) => <Text key={line} style={styles.panelText}>{line}</Text>)}
            {invoice.customerEmail ? <Text style={[styles.panelText, { marginTop: 8 }]}>{invoice.customerEmail}</Text> : null}
            {invoice.customerPhone ? <Text style={styles.panelText}>{invoice.customerPhone}</Text> : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>Terms</Text>
            <Text style={styles.panelHeading}>{formatPaymentTerms(invoice.paymentTerms)}</Text>
            <Text style={[styles.panelText, { marginTop: 10 }]}>Linked Order</Text>
            <Text style={styles.panelText}>{invoice.orderId ? invoice.orderId.slice(-8).toUpperCase() : 'Direct invoice'}</Text>
            <Text style={[styles.panelText, { marginTop: 10 }]}>Status</Text>
            <Text style={styles.panelText}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.itemCell]}>Item</Text>
            <Text style={[styles.cell, styles.skuCell]}>SKU</Text>
            <Text style={[styles.cell, styles.qtyCell]}>Qty</Text>
            <Text style={[styles.cell, styles.unitCell]}>Unit</Text>
            <Text style={[styles.cell, styles.totalCell]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, index) => (
            <View key={item.id} style={index === invoice.lineItems.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}>
              <Text style={[styles.cell, styles.itemCell]}>{item.description}</Text>
              <Text style={[styles.cell, styles.skuCell]}>{item.sku ?? '—'}</Text>
              <Text style={[styles.cell, styles.qtyCell]}>{String(item.quantity)}</Text>
              <Text style={[styles.cell, styles.unitCell]}>{fmtCurrency(item.unitPrice)}</Text>
              <Text style={[styles.cell, styles.totalCell]}>{fmtCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.checkMailingBox}>
            <Text style={styles.paymentHeading}>Please remit checks to:</Text>
            {CHECK_REMITTANCE_LINES.map((line) => <Text key={line} style={styles.panelText}>{line}</Text>)}

            <View style={styles.paymentSection}>
              <Text style={styles.paymentHeading}>For ACH:</Text>
              {ACH_REMITTANCE_LINES.map((line) => <Text key={line} style={styles.panelText}>{line}</Text>)}
            </View>

            <View style={styles.paymentSection}>
              <Text style={styles.paymentHeading}>Wire Transfer Information:</Text>
              {WIRE_TRANSFER_LINES.map((line) => <Text key={line} style={styles.panelText}>{line}</Text>)}
            </View>
          </View>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{fmtCurrency(invoice.amount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Tax</Text>
              <Text>{fmtCurrency(invoice.tax)}</Text>
            </View>
            {hasAppliedStripeFee ? (
              <View style={styles.totalRow}>
                <Text>{appliedMethodLabel} fee</Text>
                <Text>{fmtCurrency(appliedProcessingFee)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text>Total</Text>
              <Text>{fmtCurrency(totalDisplay)}</Text>
            </View>
            {hasAppliedStripeFee ? (
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>
                Total reflects the Stripe {appliedMethodLabel.toLowerCase()} checkout amount.
              </Text>
            ) : (
              <>
                <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 6, marginBottom: 4 }]}>
                  <Text>ACH total</Text>
                  <Text>{fmtCurrency(invoice.stripeCheckout.achTotal)}</Text>
                </View>
                <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>
                  Includes {fmtCurrency(invoice.stripeCheckout.achFee)} ACH fee.
                </Text>
                <View style={[styles.totalRow, { marginBottom: 4 }]}>
                  <Text>Card total</Text>
                  <Text>{fmtCurrency(invoice.stripeCheckout.cardTotal)}</Text>
                </View>
                <Text style={{ fontSize: 9, color: '#64748b' }}>
                  Includes {fmtCurrency(invoice.stripeCheckout.cardFee)} credit card fee.
                </Text>
              </>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

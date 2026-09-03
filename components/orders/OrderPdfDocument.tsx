import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { OrderPdfData } from '@/lib/orders/read'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { formatOrderTypeLabel, formatStatusLabel } from '@/lib/orders/status'

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
  totalsWrap: { display: 'flex', alignItems: 'flex-end' },
  totalsBox: { width: 220, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16 },
  totalRow: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, fontSize: 10 },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 6, fontSize: 13, fontWeight: 700, color: '#1d4ed8' },
  notesBox: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginTop: 20, backgroundColor: '#f8fafc' },
})

function fmtCurrency(value: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
}

function fmtDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
}

export function OrderPdfDocument({ order, logoDataUrl }: { order: OrderPdfData; logoDataUrl?: string | null }) {
  const orderNumber = `#${order.id.slice(-8).toUpperCase()}`

  return (
    <Document title={`Order ${orderNumber}`}>
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
              <Text style={styles.title}>Order {orderNumber}</Text>
              <Text style={styles.subtitle}>Order record for accounting, fulfillment, and reconciliation reference.</Text>
            </View>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order date</Text><Text style={styles.summaryValue}>{fmtDate(order.createdAt)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order status</Text><Text style={styles.summaryValue}>{formatStatusLabel(order.status)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment</Text><Text style={styles.summaryValue}>{formatStatusLabel(order.paymentStatus)}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.panel, styles.softPanel]}>
            <Text style={styles.panelEyebrow}>Customer</Text>
            <Text style={styles.panelHeading}>{order.companyName}</Text>
            {order.customerAddressLines.map((line) => <Text key={line} style={styles.panelText}>{line}</Text>)}
            {order.customerEmail ? <Text style={[styles.panelText, { marginTop: 8 }]}>{order.customerEmail}</Text> : null}
            {order.customerPhone ? <Text style={styles.panelText}>{order.customerPhone}</Text> : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelEyebrow}>Details</Text>
            <Text style={styles.panelText}>Payment terms: {formatPaymentTerms(order.paymentTerms)}</Text>
            <Text style={styles.panelText}>Shipping status: {formatStatusLabel(order.shippingStatus)}</Text>
            <Text style={styles.panelText}>Order type: {formatOrderTypeLabel(order.orderType)}</Text>
            <Text style={[styles.panelText, { marginTop: 10 }]}>Linked invoice</Text>
            <Text style={styles.panelText}>{order.linkedInvoiceNumber ?? 'No invoice issued yet'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.itemCell]}>Item</Text>
            <Text style={[styles.cell, styles.skuCell]}>SKU</Text>
            <Text style={[styles.cell, styles.qtyCell]}>Qty</Text>
            <Text style={[styles.cell, styles.unitCell]}>Unit Price</Text>
            <Text style={[styles.cell, styles.totalCell]}>Amount</Text>
          </View>
          {order.lineItems.map((item, index) => (
            <View key={item.id} style={index === order.lineItems.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}>
              <Text style={[styles.cell, styles.itemCell]}>{item.productName}</Text>
              <Text style={[styles.cell, styles.skuCell]}>{item.productSku ?? '—'}</Text>
              <Text style={[styles.cell, styles.qtyCell]}>{item.quantity} {item.unit}{item.quantity === '1' ? '' : 's'}</Text>
              <Text style={[styles.cell, styles.unitCell]}>{fmtCurrency(item.unitPrice)}</Text>
              <Text style={[styles.cell, styles.totalCell]}>{fmtCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{fmtCurrency(order.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Tax</Text>
              <Text>{fmtCurrency(order.tax)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text>Total</Text>
              <Text>{fmtCurrency(order.total)}</Text>
            </View>
          </View>
        </View>

        {order.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.panelEyebrow}>Notes</Text>
            <Text style={styles.panelText}>{order.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

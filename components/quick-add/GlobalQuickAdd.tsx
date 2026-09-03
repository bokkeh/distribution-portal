'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2, CalendarDays, CheckCircle2, ClipboardCheck, FileText, Loader2,
  PackagePlus, Plus, ShoppingCart, Truck, UserPlus, X,
} from 'lucide-react'
import {
  quickCreateAccount,
  quickCreateDelivery,
  quickCreateNote,
  quickCreateOrder,
  quickCreatePerson,
  quickCreateTasting,
} from '@/actions/quick-add'
import { createTask } from '@/actions/tasks'
import { AccountSearchSelect, type QuickAccount } from '@/components/quick-add/AccountSearchSelect'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type QuickAction = 'account' | 'person' | 'note' | 'task' | 'order' | 'assisted-order' | 'delivery' | 'tasting'
type Bootstrap = {
  currentUser: { id: string; name: string; roles: string[] }
  users: Array<{ id: string; name: string; roles: string[] }>
  products: Array<{ id: string; name: string; sku: string; price: string; bottlePrice: string; bottlesPerCase: number }>
  drivers: Array<{ id: string; userId: string; name: string }>
  salesMembers: Array<{ id: string; userId: string; name: string }>
}
type Related = {
  contacts: Array<{ id: string; name: string; title: string | null; email: string | null }>
  orders: Array<{ id: string; createdAt: string; total: string; status: string; isAssisted: boolean }>
  tastings: Array<{ id: string; eventName: string; scheduledAt: string; status: string }>
  deliveries: Array<{ id: string; weekStartDate: string; status: string; stopStatus: string }>
}
type LineItem = { productId: string; quantity: number; unit: 'case' | 'bottle'; unitsSold?: number; revenueGenerated?: number }

const ACTIONS: Array<{ action: QuickAction; label: string; icon: typeof Plus; group: 'CRM' | 'Sales Activity' }> = [
  { action: 'account', label: 'Add Account', icon: Building2, group: 'CRM' },
  { action: 'person', label: 'Add People', icon: UserPlus, group: 'CRM' },
  { action: 'note', label: 'Add Note', icon: FileText, group: 'CRM' },
  { action: 'task', label: 'Add Task', icon: ClipboardCheck, group: 'CRM' },
  { action: 'order', label: 'Add Order', icon: ShoppingCart, group: 'Sales Activity' },
  { action: 'assisted-order', label: 'Add Assisted Order', icon: PackagePlus, group: 'Sales Activity' },
  { action: 'delivery', label: 'Add Delivery', icon: Truck, group: 'Sales Activity' },
  { action: 'tasting', label: 'Add Tasting', icon: CalendarDays, group: 'Sales Activity' },
]

function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function ProductLines({ items, onChange, products, tasting = false, sharedUnit = false }: { items: LineItem[]; onChange: (items: LineItem[]) => void; products: Bootstrap['products']; tasting?: boolean; sharedUnit?: boolean }) {
  function update(index: number, patch: Partial<LineItem>) {
    if (sharedUnit && patch.unit) {
      onChange(items.map((item, itemIndex) => ({ ...item, unit: patch.unit!, ...(itemIndex === index ? patch : {}) })))
      return
    }
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }
  return (
    <div className="space-y-2">
      <Label>Products</Label>
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
            <select value={item.productId} onChange={(event) => update(index, { productId: event.target.value })} className={inputClass} required>
              <option value="">Select product…</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} className={inputClass} aria-label="Quantity" required />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <select value={item.unit} onChange={(event) => update(index, { unit: event.target.value as LineItem['unit'] })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
              <option value="case">Cases</option><option value="bottle">Bottles</option>
            </select>
            {tasting ? <><input type="number" min="0" value={item.unitsSold ?? 0} onChange={(event) => update(index, { unitsSold: Number(event.target.value) })} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-xs" placeholder="Units sold" aria-label="Units sold" /><input type="number" min="0" step="0.01" value={item.revenueGenerated ?? 0} onChange={(event) => update(index, { revenueGenerated: Number(event.target.value) })} className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-xs" placeholder="Revenue" aria-label="Revenue generated" /></> : null}
            {items.length > 1 ? <button type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto text-xs text-red-600">Remove</button> : null}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { productId: '', quantity: 1, unit: 'case' }])} className="text-sm font-medium text-blue-600">+ Add product</button>
    </div>
  )
}

export function GlobalQuickAdd({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [action, setAction] = useState<QuickAction | null>(null)
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)
  const [related, setRelated] = useState<Related>({ contacts: [], orders: [], tastings: [], deliveries: [] })
  const [account, setAccount] = useState<QuickAccount | null>(null)
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unit: 'case' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const initialAccountId = useMemo(() => pathname.match(/\/(?:crm|accounts)\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? null, [pathname])

  const openAction = useCallback((nextAction: QuickAction) => {
    setAction(nextAction)
    setMenuOpen(false)
    setError(null)
    setSuccess(null)
    setItems([{ productId: '', quantity: 1, unit: 'case' }])
  }, [])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: QuickAction }>).detail
      if (detail?.action && ACTIONS.some((item) => item.action === detail.action)) openAction(detail.action)
    }
    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-quick-add-action]')
      const nextAction = element?.dataset.quickAddAction as QuickAction | undefined
      if (nextAction) { event.preventDefault(); openAction(nextAction) }
    }
    window.addEventListener('quick-add:open', onOpen)
    document.addEventListener('click', onClick)
    return () => { window.removeEventListener('quick-add:open', onOpen); document.removeEventListener('click', onClick) }
  }, [openAction])

  useEffect(() => {
    if (!action || bootstrap) return
    fetch('/api/quick-add/options?scope=bootstrap')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load form options')))
      .then(setBootstrap)
      .catch((loadError: Error) => setError(loadError.message))
  }, [action, bootstrap])

  useEffect(() => {
    if (!account) { setRelated({ contacts: [], orders: [], tastings: [], deliveries: [] }); return }
    fetch(`/api/quick-add/options?scope=related&accountId=${encodeURIComponent(account.id)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load account activity')))
      .then(setRelated)
      .catch(() => setRelated({ contacts: [], orders: [], tastings: [], deliveries: [] }))
  }, [account])

  useEffect(() => {
    if (!action) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [action])

  const selectedAction = ACTIONS.find((item) => item.action === action)
  const estimatedTotal = items.reduce((sum, item) => {
    const product = bootstrap?.products.find((candidate) => candidate.id === item.productId)
    return sum + Number(item.unit === 'bottle' ? product?.bottlePrice : product?.price) * item.quantity
  }, 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || submitting) return
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      let result: { success?: true; error?: string; warning?: string }
      if (action === 'account') {
        result = await quickCreateAccount({
          companyName: String(form.get('companyName') ?? ''), businessType: String(form.get('businessType') ?? ''),
          address: String(form.get('address') ?? ''), city: String(form.get('city') ?? ''), state: String(form.get('state') ?? ''),
          phone: String(form.get('phone') ?? ''), website: String(form.get('website') ?? ''),
          assignedSalesMemberId: String(form.get('assignedSalesMemberId') ?? ''), dealStage: String(form.get('dealStage') ?? ''),
        })
      } else if (!account && action !== 'task') {
        result = { error: 'Choose an account first.' }
      } else if (action === 'person') {
        result = await quickCreatePerson({ accountId: account!.id, firstName: String(form.get('firstName') ?? ''), lastName: String(form.get('lastName') ?? ''), title: String(form.get('title') ?? ''), email: String(form.get('email') ?? ''), phone: String(form.get('phone') ?? ''), notes: String(form.get('notes') ?? '') })
      } else if (action === 'note') {
        result = await quickCreateNote({ accountId: account!.id, noteBody: String(form.get('noteBody') ?? ''), noteType: String(form.get('noteType') ?? '') })
      } else if (action === 'task') {
        const due = new Date(`${String(form.get('dueDate'))}T${String(form.get('dueTime') || '17:00')}`)
        result = await createTask({
          title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''), accountId: account?.id ?? null,
          contactId: String(form.get('contactId') || '') || null, orderId: String(form.get('taskOrderId') || '') || null,
          tastingId: String(form.get('taskTastingId') || '') || null, deliveryId: String(form.get('taskDeliveryId') || '') || null,
          assignedToUserId: String(form.get('assignedToUserId') || bootstrap?.currentUser.id || ''),
          dueAt: due.toISOString(), priority: String(form.get('priority') || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          reminderOffsetMinutes: Number(form.get('reminderOffsetMinutes') ?? 0),
          notificationChannels: form.getAll('notificationChannels') as Array<'in-app' | 'email' | 'sms'>,
        })
      } else if (action === 'order' || action === 'assisted-order') {
        result = await quickCreateOrder({
          accountId: account!.id, orderedDate: String(form.get('orderedDate')), purchaseUnit: items[0]?.unit ?? 'case',
          orderType: String(form.get('orderType') || 'paid') as 'paid' | 'sample', paymentTerms: String(form.get('paymentTerms') || 'PREPAID'),
          paymentType: String(form.get('paymentType') || 'unpaid') as 'unpaid' | 'check' | 'cod' | 'paid',
          notes: String(form.get('notes') ?? ''), items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          isAssisted: action === 'assisted-order', assistedByUserId: String(form.get('assistedByUserId') || bootstrap?.currentUser.id || ''),
          assistanceType: String(form.get('assistanceType') || 'rep_placed'), relatedTastingId: String(form.get('relatedTastingId') || '') || null,
        })
      } else if (action === 'delivery') {
        const scheduledAt = new Date(`${String(form.get('deliveryDate'))}T${String(form.get('deliveryTime') || '09:00')}`)
        result = await quickCreateDelivery({
          accountId: account!.id, scheduledAt: scheduledAt.toISOString(), driverId: String(form.get('driverId') || ''),
          orderId: String(form.get('orderId') || '') || null, recipientContactId: String(form.get('recipientContactId') || '') || null,
          status: String(form.get('status') || 'scheduled') as 'scheduled' | 'in_progress' | 'delivered' | 'failed', notes: String(form.get('notes') ?? ''),
          items: items.filter((item) => item.productId).map((item) => ({ productId: item.productId, quantity: item.quantity, unit: item.unit })),
        })
      } else {
        const scheduledAt = new Date(`${String(form.get('tastingDate'))}T${String(form.get('startTime') || '17:00')}`)
        const endTime = String(form.get('endTime') || '')
        const createFollowUp = form.get('createFollowUp') === 'on'
        result = await quickCreateTasting({
          accountId: account!.id, assignedUserId: String(form.get('assignedUserId') || bootstrap?.currentUser.id || ''),
          scheduledAt: scheduledAt.toISOString(), endAt: endTime ? new Date(`${String(form.get('tastingDate'))}T${endTime}`).toISOString() : null,
          status: String(form.get('status') || 'scheduled') as 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled',
          location: String(form.get('location') || ''), notes: String(form.get('notes') || ''),
          products: items.filter((item) => item.productId).map((item) => ({ productId: item.productId, plannedQuantity: item.quantity, unitsSold: item.unitsSold, revenueGenerated: item.revenueGenerated })),
          followUpTask: createFollowUp ? {
            title: String(form.get('followUpTitle') || `Follow up after tasting at ${account!.companyName}`), description: String(form.get('followUpDescription') || ''),
            assignedToUserId: String(form.get('assignedUserId') || bootstrap?.currentUser.id || ''), dueAt: new Date(`${String(form.get('followUpDate') || localDate(3))}T09:00`).toISOString(),
            priority: 'normal', reminderOffsetMinutes: 60, notificationChannels: ['in-app', 'email'],
          } : null,
        })
      }
      if (result.error) setError(result.error)
      else { setSuccess(result.warning || `${selectedAction?.label ?? 'Item'} saved.`); router.refresh() }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-label="Quick add"
        aria-expanded={menuOpen}
        className={cn('inline-flex items-center justify-center rounded-xl font-semibold transition-colors', compact ? 'h-9 w-9' : 'h-10 gap-2 px-3', dark ? 'text-white hover:bg-white/10' : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50')}
      >
        <Plus className="h-5 w-5" />{compact ? null : <span className="hidden lg:inline">Quick Add</span>}
      </button>
      {menuOpen ? (
        <><button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} aria-label="Close quick add menu" /><div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl">
          {(['CRM', 'Sales Activity'] as const).map((group) => <div key={group}><p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group}</p>{ACTIONS.filter((item) => item.group === group).map(({ action: itemAction, label, icon: Icon }) => <button key={itemAction} type="button" onClick={() => openAction(itemAction)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"><Icon className="h-4 w-4 text-slate-400" />{label}</button>)}</div>)}
        </div></>
      ) : null}

      {action ? (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setAction(null)} aria-label="Close quick add drawer" />
          <aside role="dialog" aria-modal="true" aria-label={selectedAction?.label} className="relative flex h-full w-full flex-col bg-slate-50 shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Quick Add</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selectedAction?.label}</h2></div>
              <button type="button" onClick={() => setAction(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {action !== 'account' ? <AccountSearchSelect value={account} onChange={setAccount} initialAccountId={initialAccountId} optional={action === 'task'} /> : null}
                {!bootstrap && action !== 'account' ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading options…</div> : null}

                {action === 'account' ? <>
                  <div><Label>Account / business name</Label><input name="companyName" className={inputClass} required autoFocus /></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Business type</Label><input name="businessType" className={inputClass} placeholder="Restaurant, retail…" /></div><div><Label>Status</Label><select name="dealStage" className={inputClass}><option value="new_lead">New lead</option><option value="qualified">Qualified</option><option value="active_account">Active account</option></select></div></div>
                  <div><Label>Address</Label><input name="address" className={inputClass} /></div>
                  <div className="grid grid-cols-[1fr_6rem] gap-3"><div><Label>City</Label><input name="city" className={inputClass} /></div><div><Label>State</Label><input name="state" maxLength={2} className={inputClass} /></div></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Phone</Label><input name="phone" type="tel" className={inputClass} /></div><div><Label>Website</Label><input name="website" type="url" className={inputClass} /></div></div>
                  <div><Label>Assigned sales lead</Label><select name="assignedSalesMemberId" className={inputClass}><option value="">Unassigned</option>{bootstrap?.salesMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
                </> : null}

                {action === 'person' ? <>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>First name</Label><input name="firstName" className={inputClass} required /></div><div><Label>Last name</Label><input name="lastName" className={inputClass} required /></div></div>
                  <div><Label>Job title</Label><input name="title" className={inputClass} /></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Email</Label><input name="email" type="email" className={inputClass} /></div><div><Label>Phone</Label><input name="phone" type="tel" className={inputClass} /></div></div>
                  <div><Label>Notes</Label><textarea name="notes" className={textareaClass} /></div>
                </> : null}

                {action === 'note' ? <><div><Label>Note type</Label><select name="noteType" className={inputClass}><option value="general_update">General note</option><option value="sales_call">Sales call</option><option value="tasting">Tasting</option><option value="follow_up">Follow-up</option></select></div><div><Label>Note</Label><textarea name="noteBody" className={textareaClass} required autoFocus /></div></> : null}

                {action === 'task' ? <>
                  <div><Label>Task title</Label><input name="title" className={inputClass} required autoFocus /></div>
                  <div><Label>Related person</Label><select name="contactId" className={inputClass}><option value="">None</option>{related.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.title ? ` · ${contact.title}` : ''}</option>)}</select></div>
                  <div className="grid gap-3 sm:grid-cols-3"><div><Label>Order</Label><select name="taskOrderId" className={inputClass}><option value="">None</option>{related.orders.map((order) => <option key={order.id} value={order.id}>{new Date(order.createdAt).toLocaleDateString()} · ${Number(order.total).toFixed(0)}</option>)}</select></div><div><Label>Tasting</Label><select name="taskTastingId" className={inputClass}><option value="">None</option>{related.tastings.map((tasting) => <option key={tasting.id} value={tasting.id}>{new Date(tasting.scheduledAt).toLocaleDateString()}</option>)}</select></div><div><Label>Delivery</Label><select name="taskDeliveryId" className={inputClass}><option value="">None</option>{related.deliveries.map((delivery) => <option key={delivery.id} value={delivery.id}>{delivery.weekStartDate} · {delivery.stopStatus}</option>)}</select></div></div>
                  <div><Label>Description / notes</Label><textarea name="description" className={textareaClass} /></div>
                  <div><Label>Assigned to</Label><select name="assignedToUserId" defaultValue={bootstrap?.currentUser.id} className={inputClass}>{bootstrap?.users.filter((user) => user.roles.some((role) => ['admin', 'staff', 'sales_rep', 'sales_manager'].includes(role))).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Due date</Label><input name="dueDate" type="date" defaultValue={localDate()} className={inputClass} required /></div><div><Label>Due time</Label><input name="dueTime" type="time" defaultValue="17:00" className={inputClass} /></div></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Priority</Label><select name="priority" className={inputClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div><div><Label>Reminder</Label><select name="reminderOffsetMinutes" defaultValue="60" className={inputClass}><option value="0">At due time</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></div></div>
                  <div><Label>Notification channels</Label><div className="flex flex-wrap gap-4 text-sm text-slate-700">{(['in-app', 'email', 'sms'] as const).map((channel) => <label key={channel} className="flex items-center gap-2"><input type="checkbox" name="notificationChannels" value={channel} defaultChecked={channel === 'in-app' || channel === 'email'} />{channel === 'in-app' ? 'In-app' : channel.toUpperCase()}</label>)}</div></div>
                </> : null}

                {action === 'order' || action === 'assisted-order' ? <>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Order date</Label><input name="orderedDate" type="date" defaultValue={localDate()} className={inputClass} required /></div><div><Label>Order type</Label><select name="orderType" className={inputClass}><option value="paid">Standard order</option><option value="sample">Sample order</option></select></div></div>
                  <ProductLines items={items} onChange={setItems} products={bootstrap?.products ?? []} sharedUnit />
                  <div className="rounded-xl bg-slate-900 px-4 py-3 text-white"><p className="text-xs uppercase tracking-wide text-slate-400">Estimated subtotal</p><p className="mt-1 text-xl font-bold">${estimatedTotal.toFixed(2)}</p></div>
                  <div><Label>Payment terms</Label><select name="paymentTerms" className={inputClass}><option value="PREPAID">Prepaid</option><option value="NET15">Net 15</option><option value="NET30">Net 30</option><option value="NET45">Net 45</option></select></div>
                  <div><Label>Payment type</Label><select name="paymentType" defaultValue="unpaid" className={inputClass}><option value="unpaid">Unpaid</option><option value="check">Check</option><option value="cod">COD</option><option value="paid">Paid — manually confirmed</option></select><p className="mt-1 text-xs text-slate-500">Do not select Paid until payment has actually been received.</p></div>
                  {action === 'assisted-order' ? <><div><Label>Assisted by</Label><select name="assistedByUserId" defaultValue={bootstrap?.currentUser.id} className={inputClass}>{bootstrap?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div><div><Label>Assistance type</Label><select name="assistanceType" className={inputClass}><option value="rep_placed">Rep placed order</option><option value="phone_order">Phone order</option><option value="in_person">In-person order</option><option value="follow_up">Follow-up order</option><option value="tasting_conversion">Tasting conversion</option><option value="other">Other</option></select></div><div><Label>Related tasting</Label><select name="relatedTastingId" className={inputClass}><option value="">None</option>{related.tastings.map((tasting) => <option key={tasting.id} value={tasting.id}>{new Date(tasting.scheduledAt).toLocaleDateString()} · {tasting.status}</option>)}</select></div></> : null}
                  <div><Label>Notes</Label><textarea name="notes" className={textareaClass} /></div>
                </> : null}

                {action === 'delivery' ? <>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Delivery date</Label><input name="deliveryDate" type="date" defaultValue={localDate()} className={inputClass} required /></div><div><Label>Time</Label><input name="deliveryTime" type="time" defaultValue="09:00" className={inputClass} /></div></div>
                  <div><Label>Delivered by / driver</Label><select name="driverId" className={inputClass} required><option value="">Choose driver…</option>{bootstrap?.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></div>
                  <div><Label>Related order</Label><select name="orderId" className={inputClass}><option value="">None</option>{related.orders.map((order) => <option key={order.id} value={order.id}>{new Date(order.createdAt).toLocaleDateString()} · ${Number(order.total).toFixed(2)} · {order.status}</option>)}</select></div>
                  <ProductLines items={items} onChange={setItems} products={bootstrap?.products ?? []} />
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Status</Label><select name="status" className={inputClass}><option value="scheduled">Scheduled</option><option value="in_progress">In transit</option><option value="delivered">Delivered</option><option value="failed">Failed / reschedule</option></select></div><div><Label>Received by</Label><select name="recipientContactId" className={inputClass}><option value="">Not recorded</option>{related.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></div></div>
                  <div><Label>Delivery notes</Label><textarea name="notes" className={textareaClass} /></div>
                </> : null}

                {action === 'tasting' ? <>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Tasting date</Label><input name="tastingDate" type="date" defaultValue={localDate()} className={inputClass} required /></div><div><Label>Status</Label><select name="status" className={inputClass}><option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div><Label>Start time</Label><input name="startTime" type="time" defaultValue="17:00" className={inputClass} /></div><div><Label>End time</Label><input name="endTime" type="time" defaultValue="19:00" className={inputClass} /></div></div>
                  <div><Label>Taster / assigned rep</Label><select name="assignedUserId" defaultValue={bootstrap?.currentUser.id} className={inputClass}>{bootstrap?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
                  <div><Label>Location</Label><input name="location" className={inputClass} placeholder="Defaults to account address" /></div>
                  <ProductLines items={items} onChange={setItems} products={bootstrap?.products ?? []} tasting />
                  <div><Label>Notes / outcomes</Label><textarea name="notes" className={textareaClass} placeholder="Customer feedback, manager conversation, competitor observations…" /></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" name="createFollowUp" />Create follow-up task</label><div className="mt-3 grid gap-3"><input name="followUpTitle" className={inputClass} placeholder={`Follow up with ${account?.companyName ?? 'account'}`} /><input name="followUpDate" type="date" defaultValue={localDate(3)} className={inputClass} /><textarea name="followUpDescription" className={textareaClass} placeholder="Follow-up details" /></div></div>
                </> : null}

                {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Saved</div><p className="mt-1">{success}</p></div> : null}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"><Button type="button" variant="outline" onClick={() => setAction(null)}>Close</Button><Button type="submit" disabled={submitting || (!['account', 'task'].includes(action) && !account)}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button></div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

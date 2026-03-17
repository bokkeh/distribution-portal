'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneSmsButton } from '@/components/crm/PhoneSmsButton'
import { EmailModal } from '@/components/crm/EmailModal'
import { updateContact, deleteContact } from '@/actions/crm'
import { Pencil, Trash2, X, Check, MessageSquare, Phone, Mail } from 'lucide-react'

type Contact = {
  id: string
  customerId: string
  name: string
  email: string | null
  phone: string | null
  phoneType: string | null
  preferredContact: string | null
  title: string | null
  isPrimary: boolean
  notes: string | null
}

const PHONE_TYPE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  landline: 'Landline',
  voip: 'VoIP',
  other: 'Other',
}

const PREFERRED_CONTACT_ICONS: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  call: <Phone className="w-3 h-3" />,
}

const PREFERRED_CONTACT_LABELS: Record<string, string> = {
  sms: 'Text preferred',
  email: 'Email preferred',
  call: 'Call preferred',
}

export default function ContactCard({ contact }: { contact: Contact }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  // Edit state
  const [name, setName] = useState(contact.name)
  const [title, setTitle] = useState(contact.title ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [phoneType, setPhoneType] = useState(contact.phoneType ?? '')
  const [preferredContact, setPreferredContact] = useState(contact.preferredContact ?? '')
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary)

  function handleSave() {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('title', title)
    formData.append('email', email)
    formData.append('phone', phone)
    formData.append('phoneType', phoneType)
    formData.append('preferredContact', preferredContact)
    if (isPrimary) formData.append('isPrimary', 'on')

    startTransition(async () => {
      const result = await updateContact(contact.id, formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contact updated')
      setEditing(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete ${contact.name}?`)) return
    startTransition(async () => {
      const result = await deleteContact(contact.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contact deleted')
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title / Role</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Owner" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone Type</Label>
            <select value={phoneType} onChange={e => setPhoneType(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Unknown</option>
              <option value="mobile">Mobile (textable)</option>
              <option value="landline">Landline (no texts)</option>
              <option value="voip">VoIP</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Best Way to Contact</Label>
            <select value={preferredContact} onChange={e => setPreferredContact(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Not specified</option>
              <option value="sms">Text / SMS</option>
              <option value="email">Email</option>
              <option value="call">Phone call</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id={`isPrimary-${contact.id}`} checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded" />
          <Label htmlFor={`isPrimary-${contact.id}`} className="text-xs">Primary POC</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
            <Check className="w-3.5 h-3.5 mr-1" />{isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
            <X className="w-3.5 h-3.5 mr-1" />Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <p className="text-sm font-medium">{contact.name}</p>
          {contact.isPrimary && <Badge variant="info" className="text-xs">Primary POC</Badge>}
          {contact.phoneType === 'landline' && (
            <Badge variant="secondary" className="text-xs">Landline</Badge>
          )}
          {contact.phoneType === 'mobile' && (
            <Badge variant="success" className="text-xs">Mobile</Badge>
          )}
          {contact.preferredContact && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-medium">
              {PREFERRED_CONTACT_ICONS[contact.preferredContact]}
              {PREFERRED_CONTACT_LABELS[contact.preferredContact]}
            </span>
          )}
        </div>
        {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
        {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
        {contact.phone && (
          <div className="flex items-center gap-1.5">
            {contact.phoneType === 'landline' ? (
              <span className="text-xs text-muted-foreground">{contact.phone}</span>
            ) : (
              <PhoneSmsButton
                phone={contact.phone}
                recipientName={contact.name}
                className="text-xs"
              />
            )}
            {contact.phoneType && contact.phoneType !== 'mobile' && (
              <span className="text-xs text-muted-foreground">({PHONE_TYPE_LABELS[contact.phoneType]})</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {contact.email && (
          <button
            onClick={() => setEmailOpen(true)}
            className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Send email"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Edit contact"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete contact"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {emailOpen && contact.email && (
        <EmailModal
          email={contact.email}
          recipientName={contact.name}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </div>
  )
}

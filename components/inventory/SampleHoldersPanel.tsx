'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserCircle, X, Plus, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { assignSamplesToUser, returnSamplesFromUser, updateSampleHolderQuantity } from '@/actions/inventory-sample-holders'

type Holder = {
  id: string
  productId: string
  productName: string
  userId: string
  userName: string
  userAvatarUrl?: string | null
  quantity: number
  notes: string | null
  checkedOutAt: Date | string
}

type Product = {
  id: string
  name: string
  sku: string
  quantitySample: number
}

type StaffUser = {
  id: string
  name: string
  role: string
}

export default function SampleHoldersPanel({
  holders,
  products,
  staffUsers,
}: {
  holders: Holder[]
  products: Product[]
  staffUsers: StaffUser[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [editingHolderId, setEditingHolderId] = useState<string | null>(null)
  const [editingQuantity, setEditingQuantity] = useState('')

  // Group holders by product
  const byProduct = holders.reduce<Record<string, Holder[]>>((acc, h) => {
    if (!acc[h.productId]) acc[h.productId] = []
    acc[h.productId].push(h)
    return acc
  }, {})

  function handleAssign() {
    if (!selectedProduct || !selectedUser || !quantity) return
    const formData = new FormData()
    formData.append('productId', selectedProduct)
    formData.append('userId', selectedUser)
    formData.append('quantity', quantity)
    if (notes.trim()) formData.append('notes', notes.trim())

    startTransition(async () => {
      const result = await assignSamplesToUser(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Samples assigned')
      setShowAssignForm(false)
      setSelectedProduct('')
      setSelectedUser('')
      setQuantity('1')
      setNotes('')
      router.refresh()
    })
  }

  function handleReturn(holderId: string, userName: string) {
    startTransition(async () => {
      const result = await returnSamplesFromUser(holderId)
      if (!result?.success) {
        toast.error('Failed to return samples')
        return
      }
      toast.success(`Samples returned from ${userName}`)
      router.refresh()
    })
  }

  function startEditing(holderId: string, quantity: number) {
    setEditingHolderId(holderId)
    setEditingQuantity(String(quantity))
  }

  function cancelEditing() {
    setEditingHolderId(null)
    setEditingQuantity('')
  }

  function handleUpdateQuantity(holderId: string, userName: string) {
    const nextQuantity = parseInt(editingQuantity, 10)
    if (Number.isNaN(nextQuantity) || nextQuantity < 1) {
      toast.error('Quantity must be at least 1')
      return
    }

    startTransition(async () => {
      const result = await updateSampleHolderQuantity(holderId, nextQuantity)
      if (!result?.success) {
        toast.error('Failed to update quantity')
        return
      }
      toast.success(`Updated ${userName} to ${nextQuantity} ${nextQuantity === 1 ? 'case' : 'cases'}`)
      cancelEditing()
      router.refresh()
    })
  }

  const productsWithSamples = products.filter(p => p.quantitySample > 0)

  function initialsForName(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {holders.length === 0
              ? 'No samples currently checked out.'
              : `${holders.length} assignment${holders.length !== 1 ? 's' : ''} across ${Object.keys(byProduct).length} product${Object.keys(byProduct).length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAssignForm(v => !v)}
        >
          {showAssignForm ? (
            <><ChevronUp className="w-3.5 h-3.5 mr-1.5" />Cancel</>
          ) : (
            <><Plus className="w-3.5 h-3.5 mr-1.5" />Assign Samples</>
          )}
        </Button>
      </div>

      {showAssignForm && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-900">Check out samples to a user</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Product</label>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantitySample} sample {p.quantitySample === 1 ? 'case' : 'cases'} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">User</label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select user...</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Quantity (cases)</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Notes (optional)</label>
              <Input
                type="text"
                placeholder="e.g. for Spec's tasting event"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAssign}
            disabled={isPending || !selectedProduct || !selectedUser || !quantity}
          >
            {isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      )}

      {holders.length > 0 && (
        <div className="space-y-3">
          {Object.entries(byProduct).map(([productId, productHolders]) => {
            const product = products.find(p => p.id === productId)
            const totalOut = productHolders.reduce((sum, h) => sum + h.quantity, 0)
            return (
              <div key={productId} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{productHolders[0].productName}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{product?.sku}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {totalOut} case{totalOut !== 1 ? 's' : ''} checked out
                    {product ? ` · ${product.quantitySample} in stock` : ''}
                  </span>
                </div>
                <div className="divide-y">
                  {productHolders.map(holder => (
                    <div key={holder.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                          {holder.userAvatarUrl ? (
                            <Image
                              src={holder.userAvatarUrl}
                              alt={holder.userName}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-full object-cover"
                              unoptimized={holder.userAvatarUrl.includes('googleusercontent.com') || holder.userAvatarUrl.startsWith('/api/')}
                            />
                          ) : holder.userName ? (
                            <span>{initialsForName(holder.userName)}</span>
                          ) : (
                            <UserCircle className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-900">{holder.userName}</span>
                          {holder.notes && (
                            <span className="ml-2 text-xs text-muted-foreground">— {holder.notes}</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Since {new Date(holder.checkedOutAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {editingHolderId === holder.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={editingQuantity}
                              onChange={e => setEditingQuantity(e.target.value)}
                              className="h-8 w-20 text-right"
                            />
                            <span className="text-sm font-semibold text-slate-900">
                              {editingQuantity === '1' ? 'case' : 'cases'}
                            </span>
                            <Button
                              size="sm"
                              className="h-8 px-3"
                              onClick={() => handleUpdateQuantity(holder.id, holder.userName)}
                              disabled={isPending || !editingQuantity}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={cancelEditing}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {holder.quantity} {holder.quantity === 1 ? 'case' : 'cases'}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5"
                              onClick={() => startEditing(holder.id, holder.quantity)}
                              disabled={isPending}
                              title="Edit quantity"
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReturn(holder.id, holder.userName)}
                          disabled={isPending || editingHolderId === holder.id}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Mark as returned"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

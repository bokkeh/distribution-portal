'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { createPromotionCatalogItem } from '@/actions/promotion-catalog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCatalogImageField } from './PromotionCatalogImageField'

export function PromotionCatalogCreateForm() {
  const [state, action, pending] = useActionState(createPromotionCatalogItem, null)

  useEffect(() => {
    if (!state) return
    if ('error' in state && state.error) {
      toast.error('Catalog item not created', { description: state.error })
      return
    }
    if ('success' in state && state.success) {
      toast.success('Catalog item created')
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Promotion Catalog Item</CardTitle>
        <CardDescription>Add new marketing and signage options for reps to send to accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <PromotionCatalogImageField disabled={pending} />

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="promotion-title">Title</Label>
                  <Input id="promotion-title" name="title" required placeholder="Wisher shelf talker" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-category">Category</Label>
                  <select
                    id="promotion-category"
                    name="category"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    defaultValue="shelf_talker"
                  >
                    <option value="social_post">Social Post</option>
                    <option value="in_store_signage">In-Store Signage</option>
                    <option value="menu_feature">Menu Feature</option>
                    <option value="bar_sign">Bar Sign</option>
                    <option value="restaurant_signage">Restaurant Signage</option>
                    <option value="window_cling">Window Cling</option>
                    <option value="shelf_talker">Shelf Talker</option>
                    <option value="barker_card">Barker Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-price">Price</Label>
                  <Input id="promotion-price" name="price" type="number" min="0" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-sku">Internal Code</Label>
                  <Input id="promotion-sku" name="sku" placeholder="PROMO-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-leadTimeDays">Lead Time (days)</Label>
                  <Input id="promotion-leadTimeDays" name="leadTimeDays" type="number" min="0" placeholder="7" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-fulfillmentType">Fulfillment Type</Label>
                  <select
                    id="promotion-fulfillmentType"
                    name="fulfillmentType"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    defaultValue="printed"
                  >
                    <option value="printed">Printed</option>
                    <option value="digital">Digital</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <input id="promotion-customizable" name="isCustomizable" type="checkbox" className="rounded" />
                  <Label htmlFor="promotion-customizable" className="cursor-pointer">Customizable for account</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promotion-description">Description</Label>
                <textarea
                  id="promotion-description"
                  name="description"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Explain what this item is, where it works best, and what the rep/customer should know."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promotion-notes">Internal Notes</Label>
                <textarea
                  id="promotion-notes"
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Production notes, vendor notes, or internal constraints."
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create Catalog Item'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deactivateGeographicPricingRule, deleteGeographicPricingRule, upsertGeographicPricingRule } from '@/actions/geographic-pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_STATE_OPTIONS, describeQuantityRange } from '@/lib/pricing/geographic'
import { formatCurrency, formatDate } from '@/lib/utils'

type ProductOption = {
  id: string
  sku: string
  name: string
}

type RuleRow = {
  id: string
  productId: string
  productName: string | null
  productSku: string | null
  stateCode: string
  countyName: string | null
  ruleType: 'state' | 'county'
  minCaseQuantity: number | null
  maxCaseQuantity: number | null
  casePrice: string
  effectiveStartDate: string | Date
  effectiveEndDate: string | Date | null
  isActive: boolean
  notes: string | null
  updatedAt: string | Date
  updatedByName: string | null
}

type HistoryRow = {
  id: string
  entityId: string
  title: string
  body: string | null
  createdAt: string | Date
  actorName: string | null
}

type FormState = {
  id: string | null
  productId: string
  stateCode: string
  countyName: string
  ruleType: 'state' | 'county'
  minCaseQuantity: string
  maxCaseQuantity: string
  casePrice: string
  effectiveStartDate: string
  effectiveEndDate: string
  isActive: boolean
  notes: string
}

const EMPTY_FORM: FormState = {
  id: null,
  productId: '',
  stateCode: '',
  countyName: '',
  ruleType: 'state',
  minCaseQuantity: '',
  maxCaseQuantity: '',
  casePrice: '',
  effectiveStartDate: '',
  effectiveEndDate: '',
  isActive: true,
  notes: '',
}

function toDateInputValue(value: string | Date | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

export function GeographicPricingManager({
  products,
  rules,
  history,
}: {
  products: ProductOption[]
  rules: RuleRow[]
  history: HistoryRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [ruleTypeFilter, setRuleTypeFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesSearch = !query || [
        rule.productName,
        rule.productSku,
        rule.stateCode,
        rule.countyName ?? '',
        rule.notes ?? '',
      ].some((value) => (value ?? '').toLowerCase().includes(query))

      const matchesState = stateFilter === 'all' || rule.stateCode === stateFilter
      const matchesType = ruleTypeFilter === 'all' || rule.ruleType === ruleTypeFilter
      const matchesProduct = productFilter === 'all' || rule.productId === productFilter
      return matchesSearch && matchesState && matchesType && matchesProduct
    })
  }, [productFilter, ruleTypeFilter, rules, search, stateFilter])

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  function loadRule(rule: RuleRow) {
    setForm({
      id: rule.id,
      productId: rule.productId,
      stateCode: rule.stateCode,
      countyName: rule.countyName ?? '',
      ruleType: rule.ruleType,
      minCaseQuantity: rule.minCaseQuantity?.toString() ?? '',
      maxCaseQuantity: rule.maxCaseQuantity?.toString() ?? '',
      casePrice: rule.casePrice,
      effectiveStartDate: toDateInputValue(rule.effectiveStartDate),
      effectiveEndDate: toDateInputValue(rule.effectiveEndDate),
      isActive: rule.isActive,
      notes: rule.notes ?? '',
    })
  }

  function submitForm() {
    startTransition(async () => {
      const result = await upsertGeographicPricingRule({
        id: form.id,
        productId: form.productId,
        stateCode: form.stateCode,
        countyName: form.ruleType === 'county' ? form.countyName : null,
        ruleType: form.ruleType,
        minCaseQuantity: form.minCaseQuantity || null,
        maxCaseQuantity: form.maxCaseQuantity || null,
        casePrice: form.casePrice,
        effectiveStartDate: form.effectiveStartDate,
        effectiveEndDate: form.effectiveEndDate || null,
        isActive: form.isActive,
        notes: form.notes,
      })

      if (result?.error) {
        toast.error('Pricing rule not saved', { description: result.error })
        return
      }

      toast.success(form.id ? 'Pricing rule updated' : 'Pricing rule created')
      resetForm()
      router.refresh()
    })
  }

  function deactivateRule(ruleId: string) {
    startTransition(async () => {
      const result = await deactivateGeographicPricingRule(ruleId)
      if (result?.error) {
        toast.error('Rule not deactivated', { description: result.error })
        return
      }
      toast.success('Pricing rule deactivated')
      router.refresh()
    })
  }

  function deleteRule(ruleId: string) {
    startTransition(async () => {
      const result = await deleteGeographicPricingRule(ruleId)
      if (result?.error) {
        toast.error('Rule not deleted', { description: result.error })
        return
      }
      toast.success('Pricing rule deleted')
      router.refresh()
    })
  }

  const stateOptions = Array.from(new Set(rules.map((rule) => rule.stateCode))).sort()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Edit Geographic Pricing Rule' : 'Add Geographic Pricing Rule'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Create one rule per quantity break. Example: `3+ cases` at one price, `5+ cases` at a lower price, and
            `10+ cases` at the best price. If multiple breaks match, the highest qualifying break wins.
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="pricing-product">Product / SKU</Label>
              <select
                id="pricing-product"
                value={form.productId}
                onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="">Select product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-state">State</Label>
              <select
                id="pricing-state"
                value={form.stateCode}
                onChange={(event) => setForm((current) => ({ ...current, stateCode: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="">Select state...</option>
                {US_STATE_OPTIONS.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-rule-type">Rule Type</Label>
              <select
                id="pricing-rule-type"
                value={form.ruleType}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  ruleType: event.target.value as 'state' | 'county',
                  countyName: event.target.value === 'county' ? current.countyName : '',
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="state">State price</option>
                <option value="county">County override</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-county">County</Label>
              <Input
                id="pricing-county"
                value={form.countyName}
                onChange={(event) => setForm((current) => ({ ...current, countyName: event.target.value }))}
                placeholder="Montgomery"
                disabled={form.ruleType !== 'county'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-min-qty">Break Starts At</Label>
              <Input
                id="pricing-min-qty"
                type="number"
                min="1"
                step="1"
                value={form.minCaseQuantity}
                onChange={(event) => setForm((current) => ({ ...current, minCaseQuantity: event.target.value }))}
                placeholder="3"
              />
              <p className="text-xs text-slate-500">Enter the case count where this price begins, like `3`, `5`, or `10`.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-max-qty">Applies Through</Label>
              <Input
                id="pricing-max-qty"
                type="number"
                min="1"
                step="1"
                value={form.maxCaseQuantity}
                onChange={(event) => setForm((current) => ({ ...current, maxCaseQuantity: event.target.value }))}
                placeholder="Leave blank for 3+"
              />
              <p className="text-xs text-slate-500">Optional. Leave blank for an open-ended break such as `10+ cases`.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-price">Case Price</Label>
              <Input
                id="pricing-price"
                type="number"
                step="0.01"
                min="0.01"
                value={form.casePrice}
                onChange={(event) => setForm((current) => ({ ...current, casePrice: event.target.value }))}
                placeholder="120.00"
              />
              <p className="text-xs text-slate-500">Price per case for this quantity break.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-start">Effective Start</Label>
              <Input
                id="pricing-start"
                type="date"
                value={form.effectiveStartDate}
                onChange={(event) => setForm((current) => ({ ...current, effectiveStartDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-end">Effective End</Label>
              <Input
                id="pricing-end"
                type="date"
                value={form.effectiveEndDate}
                onChange={(event) => setForm((current) => ({ ...current, effectiveEndDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-notes">Notes</Label>
            <textarea
              id="pricing-notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              placeholder="Internal explanation for regulated counties, promotions, or distributor strategy."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Rule is active
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={submitForm} disabled={pending}>
              {pending ? 'Saving...' : form.id ? 'Update Rule' : 'Create Rule'}
            </Button>
            {form.id ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={pending}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules..." />
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All states</option>
              {stateOptions.map((stateCode) => <option key={stateCode} value={stateCode}>{stateCode}</option>)}
            </select>
            <select value={ruleTypeFilter} onChange={(event) => setRuleTypeFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All rule types</option>
              <option value="state">State price</option>
              <option value="county">County override</option>
            </select>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All products</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Product / SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Geography</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Rule Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Case Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Effective Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Last Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-slate-900">{rule.productName ?? 'Deleted product'}</p>
                      <p className="text-xs text-slate-500">{rule.productSku ?? 'No SKU'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-slate-900">{rule.stateCode}</p>
                      <p className="text-xs text-slate-500">{rule.countyName ?? 'All counties in state'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={rule.ruleType === 'county' ? 'warning' : 'secondary'}>
                        {rule.ruleType === 'county' ? 'County override' : 'State price'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{describeQuantityRange(rule)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(rule.casePrice)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{formatDate(rule.effectiveStartDate)}</p>
                      <p className="text-xs text-slate-500">{rule.effectiveEndDate ? `Ends ${formatDate(rule.effectiveEndDate)}` : 'No end date'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={rule.isActive ? 'success' : 'outline'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{rule.updatedByName ?? 'Unknown user'}</p>
                      <p className="text-xs text-slate-500">{formatDate(rule.updatedAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => loadRule(rule)} disabled={pending}>
                          Edit
                        </Button>
                        {rule.isActive ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              if (!window.confirm('Deactivate this pricing rule?')) return
                              deactivateRule(rule.id)
                            }}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm('Delete this pricing rule? Historical order snapshots will remain unchanged.')) return
                            deleteRule(rule.id)
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pricing rule history logged yet.</p>
          ) : history.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <Badge variant="outline">{item.actorName ?? 'System'}</Badge>
                <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
              </div>
              {item.body ? <p className="mt-1 text-sm text-slate-600">{item.body}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

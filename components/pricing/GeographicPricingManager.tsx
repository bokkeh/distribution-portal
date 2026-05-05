'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deactivateGeographicPricingRule, deleteGeographicPricingRule, upsertGeographicPricingRule } from '@/actions/geographic-pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BUSINESS_TYPE_OPTIONS } from '@/lib/customers/business-types'
import { US_STATE_OPTIONS, describePricingRuleScope, describePricingRuleType, describeQuantityRange } from '@/lib/pricing/geographic'
import { formatCurrency, formatDate } from '@/lib/utils'

type ProductOption = {
  id: string
  sku: string
  name: string
}

type AccountOption = {
  id: string
  companyName: string
  businessType: string | null
}

type RuleRow = {
  id: string
  productId: string
  productName: string | null
  productSku: string | null
  stateCode: string | null
  countyName: string | null
  accountId: string | null
  accountName: string | null
  businessType: string | null
  ruleType: 'state' | 'county' | 'account' | 'business_type'
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
  accountId: string
  businessType: string
  ruleType: 'state' | 'county' | 'account' | 'business_type'
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
  accountId: '',
  businessType: '',
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

function getRuleTypeBadgeVariant(ruleType: RuleRow['ruleType']) {
  switch (ruleType) {
    case 'account':
      return 'info'
    case 'county':
      return 'warning'
    case 'business_type':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function GeographicPricingManager({
  products,
  accounts,
  rules,
  history,
}: {
  products: ProductOption[]
  accounts: AccountOption[]
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
  const formCardRef = useRef<HTMLDivElement | null>(null)

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesSearch = !query || [
        rule.productName,
        rule.productSku,
        rule.stateCode ?? '',
        rule.countyName ?? '',
        rule.accountName ?? '',
        rule.businessType ?? '',
        rule.notes ?? '',
      ].some((value) => (value ?? '').toLowerCase().includes(query))

      const matchesState =
        stateFilter === 'all' ||
        (stateFilter === 'scoped' ? !rule.stateCode : rule.stateCode === stateFilter)
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
      stateCode: rule.stateCode ?? '',
      countyName: rule.countyName ?? '',
      accountId: rule.accountId ?? '',
      businessType: rule.businessType ?? '',
      ruleType: rule.ruleType,
      minCaseQuantity: rule.minCaseQuantity?.toString() ?? '',
      maxCaseQuantity: rule.maxCaseQuantity?.toString() ?? '',
      casePrice: rule.casePrice,
      effectiveStartDate: toDateInputValue(rule.effectiveStartDate),
      effectiveEndDate: toDateInputValue(rule.effectiveEndDate),
      isActive: rule.isActive,
      notes: rule.notes ?? '',
    })
    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function submitForm() {
    startTransition(async () => {
      const result = await upsertGeographicPricingRule({
        id: form.id,
        productId: form.productId,
        stateCode: form.ruleType === 'state' || form.ruleType === 'county' ? form.stateCode : null,
        countyName: form.ruleType === 'county' ? form.countyName : null,
        accountId: form.ruleType === 'account' ? form.accountId : null,
        businessType: form.ruleType === 'business_type' ? form.businessType : null,
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

  const stateOptions = Array.from(new Set(rules.map((rule) => rule.stateCode).filter(Boolean) as string[])).sort()

  return (
    <div className="space-y-6">
      <div ref={formCardRef}>
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.id ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              You are editing an existing pricing rule. Update the fields below, then click `Update Rule`.
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Create one rule per quantity break. Rule priority is: special pricing by account, county override,
            business type pricing, state pricing, then default catalog price.
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

            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="pricing-rule-type">Pricing Scope</Label>
              <select
                id="pricing-rule-type"
                value={form.ruleType}
                onChange={(event) => {
                  const ruleType = event.target.value as FormState['ruleType']
                  setForm((current) => ({
                    ...current,
                    ruleType,
                    stateCode: ruleType === 'state' || ruleType === 'county' ? current.stateCode : '',
                    countyName: ruleType === 'county' ? current.countyName : '',
                    accountId: ruleType === 'account' ? current.accountId : '',
                    businessType: ruleType === 'business_type' ? current.businessType : '',
                  }))
                }}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="state">State pricing</option>
                <option value="county">County override</option>
                <option value="account">Special pricing by account</option>
                <option value="business_type">Business type pricing</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-state">State</Label>
              <select
                id="pricing-state"
                value={form.stateCode}
                onChange={(event) => setForm((current) => ({ ...current, stateCode: event.target.value }))}
                disabled={form.ruleType !== 'state' && form.ruleType !== 'county'}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
              <Label htmlFor="pricing-account">Account</Label>
              <select
                id="pricing-account"
                value={form.accountId}
                onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
                disabled={form.ruleType !== 'account'}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.companyName}
                    {account.businessType ? ` (${account.businessType})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-business-type">Business Type</Label>
              <select
                id="pricing-business-type"
                value={form.businessType}
                onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))}
                disabled={form.ruleType !== 'business_type'}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select business type...</option>
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <p className="text-xs text-slate-500">Enter the case count where this price begins, like 3, 5, or 10.</p>
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
              <p className="text-xs text-slate-500">Optional. Leave blank for an open-ended break such as 10+ cases.</p>
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
              placeholder="Internal explanation for special pricing, geography, promotions, or distributor strategy."
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules..." />
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All states and scopes</option>
              <option value="scoped">Account and business type rules</option>
              {stateOptions.map((stateCode) => <option key={stateCode} value={stateCode}>{stateCode}</option>)}
            </select>
            <select value={ruleTypeFilter} onChange={(event) => setRuleTypeFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All rule types</option>
              <option value="state">State pricing</option>
              <option value="county">County override</option>
              <option value="account">Special pricing</option>
              <option value="business_type">Business type pricing</option>
            </select>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
              <option value="all">All products</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Product / SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scope</th>
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
                      <p className="font-medium text-slate-900">{describePricingRuleScope(rule)}</p>
                      {rule.notes ? <p className="text-xs text-slate-500">{rule.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={getRuleTypeBadgeVariant(rule.ruleType)}>
                        {describePricingRuleType(rule.ruleType)}
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

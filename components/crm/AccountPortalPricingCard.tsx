import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { db } from '@/db'
import { products } from '@/db/schema'
import { formatBusinessType, normalizeBusinessType } from '@/lib/customers/business-types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getPricingRulesForProducts, normalizeAccountGeography, resolveProductCasePrice } from '@/lib/pricing/geographic-service'
import { describePricingRuleScope, describePricingSource, describeQuantityRange, isRuleActiveOnDate, normalizeStateCode } from '@/lib/pricing/geographic'

type Props = {
  account: {
    id: string
    businessType: string | null
    state: string | null
    county: string | null
  }
}

export async function AccountPortalPricingCard({ account }: Props) {
  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(products.name)

  const pricingRules = await getPricingRulesForProducts(productRows.map((product) => product.id))
  const pricingContext = normalizeAccountGeography({
    accountId: account.id,
    businessType: account.businessType,
    state: account.state,
    county: account.county,
  })
  const now = new Date()
  const productNameById = new Map(productRows.map((product) => [product.id, product.name]))

  const portalCatalog = productRows.map((product) => {
    const pricing = resolveProductCasePrice({
      productId: product.id,
      baseCasePrice: product.price,
      account: pricingContext,
      rules: pricingRules,
      asOf: now,
    })

    return {
      ...product,
      portalPrice: pricing.price.toFixed(2),
      pricingSource: pricing.source,
      matchedRule: pricing.matchedRule,
    }
  })

  const applicableRules = pricingRules
    .filter((rule) =>
      isRuleActiveOnDate(rule, now) &&
      productNameById.has(rule.productId) &&
      (
        (rule.ruleType === 'account' && rule.accountId === pricingContext.accountId) ||
        (rule.ruleType === 'business_type' && normalizeBusinessType(rule.businessType) === pricingContext.businessType) ||
        (rule.ruleType === 'county' &&
          pricingContext.state &&
          normalizeStateCode(rule.stateCode) === pricingContext.state &&
          rule.countyKey === pricingContext.countyKey) ||
        (rule.ruleType === 'state' &&
          pricingContext.state &&
          normalizeStateCode(rule.stateCode) === pricingContext.state)
      )
    )
    .sort((left, right) => {
      const weight = { account: 0, county: 1, business_type: 2, state: 3 } as const
      const leftTypeWeight = weight[left.ruleType]
      const rightTypeWeight = weight[right.ruleType]
      if (leftTypeWeight !== rightTypeWeight) return leftTypeWeight - rightTypeWeight
      return (productNameById.get(left.productId) ?? '').localeCompare(productNameById.get(right.productId) ?? '')
    })

  const specialAccountPrices = portalCatalog.filter((product) => product.pricingSource === 'account_special').length
  const countyOverrides = portalCatalog.filter((product) => product.pricingSource === 'county_override').length
  const businessTypePrices = portalCatalog.filter((product) => product.pricingSource === 'business_type_price').length
  const stateOverrides = portalCatalog.filter((product) => product.pricingSource === 'state_price').length
  const defaultPrices = portalCatalog.filter((product) => product.pricingSource === 'default_price').length

  return (
    <div className="space-y-6 xl:col-span-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Customer Portal Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatBusinessType(account.businessType)}</Badge>
            <Badge variant="secondary">{pricingContext.state ?? 'No state set'}</Badge>
            {pricingContext.county ? <Badge variant="secondary">{pricingContext.county} County</Badge> : null}
            <Badge variant="info">{portalCatalog.length} active products</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Special Pricing</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{specialAccountPrices}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">County Overrides</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{countyOverrides}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Business Type</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{businessTypePrices}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">State Rules</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stateOverrides}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Default Prices</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{defaultPrices}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium text-slate-900">Visible catalog prices</p>
              <p className="text-xs text-slate-500">This preview uses the same pricing resolver as the customer product catalog.</p>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Portal</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Applied Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {portalCatalog.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(product.portalPrice)}</td>
                      <td className="px-4 py-3 text-slate-600">{describePricingSource(product.pricingSource)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {product.matchedRule
                          ? `${describePricingRuleScope(product.matchedRule)} - ${describeQuantityRange(product.matchedRule)}`
                          : 'Base catalog price'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Applicable Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {!pricingContext.state && !pricingContext.businessType ? (
            <p className="text-sm text-slate-500">Add a state, county, or business type to this CRM record before scoped pricing can apply.</p>
          ) : applicableRules.length === 0 ? (
            <p className="text-sm text-slate-500">No active pricing rules currently match this account.</p>
          ) : (
            <div className="space-y-3">
              {applicableRules.map((rule) => (
                <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{productNameById.get(rule.productId) ?? 'Unknown product'}</p>
                      <p className="text-xs text-slate-500">
                        {describePricingRuleScope(rule)} - {describeQuantityRange(rule)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(rule.casePrice)}</p>
                      <p className="text-xs text-slate-500">Effective {formatDate(rule.effectiveStartDate)}</p>
                    </div>
                  </div>
                  {rule.notes ? <p className="mt-2 text-sm text-slate-600">{rule.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

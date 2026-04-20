import { resolveGeographicCasePrice, type GeographicPriceResolution, type GeographicPricingRuleInput } from './geographic'

export type ProductPricingInput = {
  id: string
  price: string | number
  bottlePrice: string | number
  bottlesPerCase: number | null | undefined
}

export type ProductPricingContext = {
  accountId: string | null
  businessType: string | null
  state: string | null
  county: string | null
}

export function getBottleUnitPrice(product: ProductPricingInput, resolvedCasePrice: number) {
  const explicitBottlePrice = Number(product.bottlePrice || 0)
  if (Number.isFinite(explicitBottlePrice) && explicitBottlePrice > 0) {
    return { unitPrice: explicitBottlePrice, inheritsCasePricing: false }
  }

  const bottlesPerCase = product.bottlesPerCase || 12
  return {
    unitPrice: resolvedCasePrice / bottlesPerCase,
    inheritsCasePricing: true,
  }
}

export function resolveProductUnitPrice(input: {
  product: ProductPricingInput
  account: ProductPricingContext
  rules: GeographicPricingRuleInput[]
  purchaseUnit: 'case' | 'bottle'
  quantity: number
  asOf?: Date | string
}) {
  const casePricing = resolveGeographicCasePrice({
    productId: input.product.id,
    baseCasePrice: input.product.price,
    accountId: input.account.accountId,
    businessType: input.account.businessType,
    state: input.account.state,
    county: input.account.county,
    rules: input.rules,
    asOf: input.asOf ?? new Date(),
    quantityCases: input.purchaseUnit === 'case' ? input.quantity : null,
  })

  if (input.purchaseUnit === 'case') {
    return {
      unitPrice: casePricing.price,
      pricing: casePricing,
    }
  }

  const bottlePricing = getBottleUnitPrice(input.product, casePricing.price)
  const pricing: GeographicPriceResolution =
    bottlePricing.inheritsCasePricing
      ? casePricing
      : {
        price: bottlePricing.unitPrice,
        source: 'default_price',
        matchedRule: null,
        matchedState: casePricing.matchedState,
        matchedCounty: casePricing.matchedCounty,
      }

  return {
    unitPrice: bottlePricing.unitPrice,
    pricing,
  }
}

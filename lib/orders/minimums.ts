import { isRestaurantStyleBusinessType } from '@/lib/customers/business-types'

type ProductLike = {
  name?: string | null
  sku?: string | null
  brand?: string | null
}

export const WISHER_VODKA_MIN_CASES = 10
export const WISHER_VODKA_RESTAURANT_MIN_CASES = 3

export function isRestaurantBusinessType(businessType?: string | null) {
  return isRestaurantStyleBusinessType(businessType)
}

export function isWisherVodkaProduct(product: ProductLike) {
  const name = product.name?.toLowerCase() ?? ''
  const sku = product.sku?.toLowerCase() ?? ''
  const brand = product.brand?.toLowerCase() ?? ''

  return (
    name.includes('wisher vodka') ||
    (brand.includes('wisher') && name.includes('vodka')) ||
    sku.includes('wisher')
  )
}

export function getMinimumCaseQuantity(product: ProductLike, businessType?: string | null) {
  if (!isWisherVodkaProduct(product)) return 1
  return isRestaurantBusinessType(businessType) ? WISHER_VODKA_RESTAURANT_MIN_CASES : WISHER_VODKA_MIN_CASES
}

export function normalizeCaseQuantity(product: ProductLike, quantity: number, businessType?: string | null) {
  if (quantity <= 0) return 0
  return Math.max(getMinimumCaseQuantity(product, businessType), quantity)
}

export function getMinimumCaseQuantityMessage(product: ProductLike, businessType?: string | null) {
  if (!isWisherVodkaProduct(product)) return null
  const min = getMinimumCaseQuantity(product, businessType)
  return `Wisher Vodka requires a minimum order of ${min} cases.`
}

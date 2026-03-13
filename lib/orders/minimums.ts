type ProductLike = {
  name?: string | null
  sku?: string | null
  brand?: string | null
}

export const WISHER_VODKA_MIN_CASES = 10

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

export function getMinimumCaseQuantity(product: ProductLike) {
  return isWisherVodkaProduct(product) ? WISHER_VODKA_MIN_CASES : 1
}

export function normalizeCaseQuantity(product: ProductLike, quantity: number) {
  if (quantity <= 0) return 0
  return Math.max(getMinimumCaseQuantity(product), quantity)
}

export function getMinimumCaseQuantityMessage(product: ProductLike) {
  if (!isWisherVodkaProduct(product)) return null
  return `Wisher Vodka requires a minimum order of ${WISHER_VODKA_MIN_CASES} cases.`
}

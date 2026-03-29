'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ImageIcon, Plus, ShoppingCart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import { getMinimumCaseQuantity, isWisherVodkaProduct } from '@/lib/orders/minimums'
import { describePricingSource, type GeographicPricingSource } from '@/lib/pricing/geographic'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  brand: string | null
  price: string
  samplePrice: string
  imageUrl: string | null
  quantityPaid: number | null
  quantitySample: number | null
  pricingSource: GeographicPricingSource
}

export default function CustomerProductCatalog({
  products,
  categories,
  businessType,
}: {
  products: Product[]
  categories: string[]
  businessType?: string | null
}) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { items, addItem, itemCount, setBusinessType } = useCart()

  useEffect(() => {
    setBusinessType(businessType ?? null)
  }, [businessType, setBusinessType])

  const filtered = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.brand ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const isInCart = (productId: string) => items.some((item) => item.productId === productId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'border bg-white hover:bg-slate-50'}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${selectedCategory === category ? 'bg-slate-900 text-white' : 'border bg-white hover:bg-slate-50'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        {itemCount() > 0 ? (
          <Link href="/customer/cart">
            <Button variant="outline" className="relative">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Cart
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                {itemCount()}
              </span>
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((product) => {
          const stock = product.quantityPaid
          const inCart = isInCart(product.id)
          const outOfStock = (stock ?? 0) <= 0
          const hasMinimumCaseRequirement = isWisherVodkaProduct(product)
          const minCases = getMinimumCaseQuantity(product, businessType)

          return (
            <Card
              key={product.id}
              className={`overflow-hidden transition-shadow ${outOfStock ? 'opacity-60' : 'hover:shadow-md'}`}
            >
              <div className="relative aspect-video bg-slate-100">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                {outOfStock ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                ) : null}
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold leading-tight">{product.name}</p>
                  {product.brand ? <p className="text-xs text-muted-foreground">{product.brand}</p> : null}
                  {product.category ? <Badge variant="secondary" className="mt-1 text-xs">{product.category}</Badge> : null}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-600">{formatCurrency(product.price)}</span>
                    <p className="text-[11px] text-slate-500">{describePricingSource(product.pricingSource)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{stock ?? 0} avail.</span>
                </div>
                {hasMinimumCaseRequirement ? (
                  <p className="text-xs text-amber-700">Minimum order: {minCases} cases</p>
                ) : null}
                <Button
                  className="w-full"
                  size="sm"
                  variant={inCart ? 'secondary' : 'default'}
                  disabled={outOfStock}
                  onClick={() =>
                    addItem({
                      productId: product.id,
                      name: product.name,
                      sku: product.sku,
                      price: product.price,
                      samplePrice: product.samplePrice,
                      imageUrl: product.imageUrl,
                      orderType: 'paid',
                    })
                  }
                >
                  {inCart ? (
                    <>
                      <Check className="mr-1 h-4 w-4" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" />
                      {hasMinimumCaseRequirement ? `Add ${minCases} Cases` : 'Add to Order'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No products found matching your search.</p>
        </div>
      ) : null}
    </div>
  )
}

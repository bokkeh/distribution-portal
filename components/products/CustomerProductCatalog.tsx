'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import { ShoppingCart, Plus, Check } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

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
}

export default function CustomerProductCatalog({ products, categories }: { products: Product[]; categories: string[] }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [orderType, setOrderType] = useState<'paid' | 'sample'>('paid')
  const { items, addItem, setOrderType: setCartType, itemCount } = useCart()

  const handleOrderTypeChange = (type: 'paid' | 'sample') => {
    setOrderType(type)
    setCartType(type)
  }

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const isInCart = (productId: string) => items.some(i => i.productId === productId)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={orderType === 'paid' ? 'default' : 'outline'} onClick={() => handleOrderTypeChange('paid')}>
            Paid Cases
          </Button>
          <Button size="sm" variant={orderType === 'sample' ? 'default' : 'outline'} onClick={() => handleOrderTypeChange('sample')}>
            Sample Cases
          </Button>
        </div>
        {itemCount() > 0 && (
          <Link href="/customer/cart">
            <Button variant="outline" className="relative">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Cart
              <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount()}
              </span>
            </Button>
          </Link>
        )}
      </div>

      <div className="flex gap-3">
        <Input className="max-w-xs" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white border hover:bg-slate-50'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(product => {
          const price = orderType === 'sample' ? product.samplePrice : product.price
          const stock = orderType === 'sample' ? product.quantitySample : product.quantityPaid
          const inCart = isInCart(product.id)
          const outOfStock = (stock ?? 0) <= 0

          return (
            <Card key={product.id} className={`overflow-hidden transition-shadow ${outOfStock ? 'opacity-60' : 'hover:shadow-md'}`}>
              <div className="aspect-video bg-slate-100 relative">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🍷</div>
                )}
                {outOfStock && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm leading-tight">{product.name}</p>
                  {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
                  {product.category && <Badge variant="secondary" className="text-xs mt-1">{product.category}</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-600">{formatCurrency(price)}</span>
                  <span className="text-xs text-muted-foreground">{stock ?? 0} avail.</span>
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  variant={inCart ? 'secondary' : 'default'}
                  disabled={outOfStock}
                  onClick={() => addItem({
                    productId: product.id,
                    name: product.name,
                    sku: product.sku,
                    price: product.price,
                    samplePrice: product.samplePrice,
                    imageUrl: product.imageUrl,
                    orderType,
                  })}
                >
                  {inCart ? <><Check className="w-4 h-4 mr-1" />Added</> : <><Plus className="w-4 h-4 mr-1" />Add to Order</>}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No products found matching your search.</p>
        </div>
      )}
    </div>
  )
}

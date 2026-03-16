import { db } from '@/db'
import { inventory, products } from '@/db/schema'
import { eq, or } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProductDetails } from '@/actions/inventory'
import { ProductImageUploadField } from '@/components/inventory/ProductImageUploadField'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function StaffEditProductPage({ params }: { params: { productId: string } }) {
  async function submitProductUpdate(formData: FormData) {
    'use server'

    const result = await updateProductDetails(formData)
    if (result?.error) {
      throw new Error(result.error)
    }

    redirect('/staff/inventory')
  }

  const [record] = await db
    .select({
      product: products,
      inventory: inventory,
    })
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(
      or(
        eq(products.id, params.productId),
        eq(inventory.id, params.productId),
        eq(products.sku, params.productId),
      ),
    )
    .limit(1)

  if (!record?.product) notFound()

  const product = record.product
  const inv = record.inventory

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/staff/inventory"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-muted-foreground mt-1">SKU: {product.sku}</p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader><CardTitle>Edit Product And Inventory</CardTitle></CardHeader>
        <CardContent>
          <form action={submitProductUpdate} className="space-y-5">
            <input type="hidden" name="productId" value={product.id} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input name="sku" required defaultValue={product.sku} />
              </div>
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input name="name" required defaultValue={product.name} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input name="brand" defaultValue={product.brand ?? ''} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" defaultValue={product.category ?? ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input name="description" defaultValue={product.description ?? ''} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Price per Case ($)</Label>
                <Input type="number" step="0.01" min="0" name="price" defaultValue={product.price} />
              </div>
              <div className="space-y-2">
                <Label>Price per Bottle ($)</Label>
                <Input type="number" step="0.01" min="0" name="bottlePrice" defaultValue={product.bottlePrice} />
              </div>
              <div className="space-y-2">
                <Label>Sample Price ($)</Label>
                <Input type="number" step="0.01" min="0" name="samplePrice" defaultValue={product.samplePrice} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bottles per Case</Label>
                <Input type="number" min="1" name="bottlesPerCase" defaultValue={product.bottlesPerCase} />
              </div>
              <div className="space-y-2">
                <Label>Cases per Pallet</Label>
                <Input type="number" min="0" name="casesPerPallet" defaultValue={product.casesPerPallet ?? ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Product Image</Label>
              <ProductImageUploadField value={product.imageUrl ?? ''} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paid Cases</Label>
                <Input type="number" name="quantityPaid" min="0" defaultValue={inv?.quantityPaid ?? 0} />
              </div>
              <div className="space-y-2">
                <Label>Sample Cases</Label>
                <Input type="number" name="quantitySample" min="0" defaultValue={inv?.quantitySample ?? 0} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loose Bottles</Label>
                <Input type="number" name="looseBottlePaid" min="0" defaultValue={inv?.looseBottlePaid ?? 0} />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input type="number" name="reorderLevel" min="0" defaultValue={inv?.reorderLevel ?? 10} />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked={product.active} />
              <span>Active product</span>
            </label>
            <div className="flex gap-3">
              <Button type="submit">Save Product</Button>
              <Link href="/staff/inventory"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

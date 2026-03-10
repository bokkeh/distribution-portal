import { db } from '@/db'
import { products, inventory } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustStock } from '@/actions/inventory'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EditProductPage({ params }: { params: { productId: string } }) {
  const [product] = await db.select().from(products).where(eq(products.id, params.productId))
  if (!product) notFound()

  const [inv] = await db.select().from(inventory).where(eq(inventory.productId, params.productId))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-muted-foreground mt-1">SKU: {product.sku}</p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader><CardTitle>Adjust Inventory</CardTitle></CardHeader>
        <CardContent>
          <form action={adjustStock} className="space-y-4">
            <input type="hidden" name="productId" value={product.id} />
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
            <div className="flex gap-3">
              <Button type="submit">Update Stock</Button>
              <Link href="/admin/inventory"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

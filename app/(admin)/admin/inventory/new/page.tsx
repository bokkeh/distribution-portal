import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProduct } from '@/actions/inventory'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewProductPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Product</h1>
          <p className="text-muted-foreground mt-1">Add a new product to the catalog and inventory</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input name="sku" id="sku" required placeholder="WHI-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input name="name" id="name" required placeholder="Jack Daniel's Old No. 7" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input name="brand" id="brand" placeholder="Jack Daniel's" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input name="category" id="category" placeholder="Whiskey" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input name="description" id="description" placeholder="Tennessee whiskey..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price per Case ($)</Label>
                <Input type="number" name="price" id="price" step="0.01" min="0" required placeholder="120.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bottlePrice">Price per Bottle ($)</Label>
                <Input type="number" name="bottlePrice" id="bottlePrice" step="0.01" min="0" defaultValue="0" placeholder="10.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bottlesPerCase">Bottles per Case</Label>
                <Input type="number" name="bottlesPerCase" id="bottlesPerCase" min="1" defaultValue="12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="samplePrice">Sample Price ($)</Label>
                <Input type="number" name="samplePrice" id="samplePrice" step="0.01" min="0" defaultValue="0" placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantityPaid">Initial Paid Cases</Label>
                <Input type="number" name="quantityPaid" id="quantityPaid" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantitySample">Initial Sample Cases</Label>
                <Input type="number" name="quantitySample" id="quantitySample" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input type="number" name="reorderLevel" id="reorderLevel" min="0" defaultValue="10" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Add Product</Button>
              <Link href="/admin/inventory"><Button variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WisherCustomerImportForm } from '@/components/crm/WisherCustomerImportForm'
import { requireFeature } from '@/lib/auth/session'

export default async function WisherImportPage() {
  await requireFeature('crm', 'admin')

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/crm">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Wisher Customers</h1>
          <p className="mt-1 text-muted-foreground">Uploads consumer customers into CRM as B2C records so they stay separate from wholesale accounts.</p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Wisher CSV Import</CardTitle>
        </CardHeader>
        <CardContent>
          <WisherCustomerImportForm />
        </CardContent>
      </Card>
    </div>
  )
}

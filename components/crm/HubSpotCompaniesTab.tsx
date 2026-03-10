'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, ExternalLink, Download, Globe } from 'lucide-react'
import { importHubSpotCompany } from '@/actions/crm'
import type { HubSpotCompany } from '@/lib/hubspot/client'

interface Props {
  companies: HubSpotCompany[]
  importedIds: Set<string>
}

export function HubSpotCompaniesTab({ companies, importedIds }: Props) {
  const [imported, setImported] = useState<Set<string>>(new Set(importedIds))
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleImport(id: string) {
    setPending(id)
    startTransition(async () => {
      const result = await importHubSpotCompany(id)
      if (!('error' in result)) {
        setImported(prev => new Set([...prev, id]))
      }
      setPending(null)
    })
  }

  if (companies.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No companies found in HubSpot. Check your API key.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Website</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {companies.map(company => {
            const isImported = imported.has(company.id)
            return (
              <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium">{company.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {[company.city, company.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {company.industry ?? '—'}
                </td>
                <td className="px-6 py-4 text-sm">{company.phone ?? '—'}</td>
                <td className="px-6 py-4 text-sm">
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline">
                      <Globe className="w-3 h-3" />
                      {company.domain ?? 'Visit'}
                    </a>
                  ) : '—'}
                </td>
                <td className="px-6 py-4">
                  {isImported ? (
                    <Badge variant="success">Imported</Badge>
                  ) : (
                    <Badge variant="outline">HubSpot</Badge>
                  )}
                </td>
                <td className="px-6 py-4">
                  {!isImported && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending === company.id}
                      onClick={() => handleImport(company.id)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      {pending === company.id ? 'Importing…' : 'Import'}
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

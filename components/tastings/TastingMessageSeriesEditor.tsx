'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { saveTastingSmsTemplates } from '@/actions/tasting-message-templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TemplateRow = {
  key: string
  label: string
  description: string
  bodyTemplate: string
  linkPath: string | null
  sortOrder: number
}

export function TastingMessageSeriesEditor({ templates }: { templates: TemplateRow[] }) {
  const [state, action, pending] = useActionState(saveTastingSmsTemplates, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to save templates', { description: state.error })
    } else if (state?.success) {
      toast.success('Tasting SMS series updated')
    }
  }, [state])

  return (
    <form action={action} className="space-y-6">
      {templates.map((template, index) => (
        <div key={template.key} className="relative">
          {index < templates.length - 1 ? (
            <div className="absolute left-5 top-14 h-[calc(100%-2rem)] w-px bg-slate-200" aria-hidden="true" />
          ) : null}
          <div className="flex gap-4">
            <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {index + 1}
            </div>
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>{template.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${template.key}:linkPath`}>Action Link Path</Label>
                  <Input id={`${template.key}:linkPath`} name={`${template.key}:linkPath`} defaultValue={template.linkPath ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${template.key}:bodyTemplate`}>SMS Body</Label>
                  <textarea
                    id={`${template.key}:bodyTemplate`}
                    name={`${template.key}:bodyTemplate`}
                    defaultValue={template.bodyTemplate}
                    className="min-h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Available placeholders: <code>{'{{store_name}}'}</code>, <code>{'{{store_address}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{start_time}}'}</code>, <code>{'{{time_range}}'}</code>, <code>{'{{portal_link}}'}</code>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save SMS Series'}
      </Button>
    </form>
  )
}

'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { saveEmailAutomationTemplates } from '@/actions/email-automation-templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TemplateRow = {
  key: string
  label: string
  description: string
  audience: string
  subjectTemplate: string
  eyebrow: string
  titleTemplate: string
  introTemplate: string | null
  bodyTemplate: string
  ctaLabel: string | null
  ctaPath: string | null
  sortOrder: number
}

export function EmailAutomationSeriesEditor({ templates }: { templates: TemplateRow[] }) {
  const [state, action, pending] = useActionState(saveEmailAutomationTemplates, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Failed to save email templates', { description: state.error })
    } else if (state?.success) {
      toast.success('Email flows updated')
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
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{template.label}</CardTitle>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    {template.audience}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${template.key}:subjectTemplate`}>Subject</Label>
                    <Input id={`${template.key}:subjectTemplate`} name={`${template.key}:subjectTemplate`} defaultValue={template.subjectTemplate} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${template.key}:eyebrow`}>Eyebrow</Label>
                    <Input id={`${template.key}:eyebrow`} name={`${template.key}:eyebrow`} defaultValue={template.eyebrow} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${template.key}:titleTemplate`}>Title</Label>
                  <Input id={`${template.key}:titleTemplate`} name={`${template.key}:titleTemplate`} defaultValue={template.titleTemplate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${template.key}:introTemplate`}>Intro</Label>
                  <textarea
                    id={`${template.key}:introTemplate`}
                    name={`${template.key}:introTemplate`}
                    defaultValue={template.introTemplate ?? ''}
                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${template.key}:bodyTemplate`}>Body HTML</Label>
                  <textarea
                    id={`${template.key}:bodyTemplate`}
                    name={`${template.key}:bodyTemplate`}
                    defaultValue={template.bodyTemplate}
                    className="min-h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${template.key}:ctaLabel`}>CTA Label</Label>
                    <Input id={`${template.key}:ctaLabel`} name={`${template.key}:ctaLabel`} defaultValue={template.ctaLabel ?? ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${template.key}:ctaPath`}>CTA Path</Label>
                    <Input id={`${template.key}:ctaPath`} name={`${template.key}:ctaPath`} defaultValue={template.ctaPath ?? ''} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Templates support placeholders like <code>{'{{company_name}}'}</code>, <code>{'{{invoice_number}}'}</code>, <code>{'{{order_short_id}}'}</code>, <code>{'{{scheduled_at}}'}</code>, <code>{'{{store_name}}'}</code>, and flow-specific fields.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save Email Flows'}
      </Button>
    </form>
  )
}

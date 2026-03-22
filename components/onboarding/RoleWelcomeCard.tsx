import { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function RoleWelcomeCard({
  eyebrow,
  title,
  description,
  bullets,
  formAction,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  guidanceText,
}: {
  eyebrow: string
  title: string
  description: string
  bullets: ReactNode[]
  formAction?: () => Promise<void>
  primaryHref?: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  guidanceText?: string
}) {
  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-10">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">{eyebrow}</p>
          <CardTitle className="text-3xl text-slate-950">{title}</CardTitle>
          <CardDescription className="max-w-2xl text-base text-slate-600">{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 bg-slate-50 p-6 sm:grid-cols-[1.4fr_0.9fr] sm:p-8">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">What To Expect</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {bullets.map((bullet, index) => (
                  <li key={index} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
              Your portal will keep schedule times aligned to Eastern Time unless a message explicitly says otherwise.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-600">
                {guidanceText ?? 'Review your profile and notification settings at any time before you continue.'}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {primaryHref ? (
                  <Link href={primaryHref}>
                    <Button className="w-full">{primaryLabel}</Button>
                  </Link>
                ) : formAction ? (
                  <form action={formAction}>
                    <Button className="w-full">{primaryLabel}</Button>
                  </form>
                ) : null}
                {secondaryHref && secondaryLabel ? (
                  <Link href={secondaryHref}>
                    <Button variant="outline" className="w-full">{secondaryLabel}</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

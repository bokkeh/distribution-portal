import Image from 'next/image'
import { CommunitySignupForm } from '@/components/marketing/CommunitySignupForm'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata = {
  title: 'Join the Wisher Community | AHAWC',
  description: 'Sign up for Wisher brand news, events, and community updates.',
}

export default function CommunitySignupPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ed] px-4 py-12 sm:py-20">
      <Card className="mx-auto max-w-2xl overflow-hidden rounded-3xl border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="h-2 bg-[#ff5a00]" />
        <CardHeader className="items-center px-6 pb-4 pt-10 text-center sm:px-10">
          <Image src="/brand/logo-badge.png" alt="Wisher" width={72} height={72} className="mb-4 rounded-full" priority />
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#ff5a00]">Wisher community</p>
          <h1 className="font-display text-5xl font-bold uppercase leading-none text-[#181615] sm:text-6xl">Stay in the know</h1>
          <p className="mt-3 max-w-lg text-slate-600">Get brand news, tasting announcements, event invitations, and the stories behind Wisher.</p>
        </CardHeader>
        <CardContent className="px-6 pb-10 sm:px-10"><CommunitySignupForm /></CardContent>
      </Card>
    </main>
  )
}

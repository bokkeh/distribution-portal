import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'

function LoginCardFallback() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 pb-2">
            <div className="h-14 w-14 rounded-xl bg-slate-100" />
            <div className="h-6 w-32 rounded bg-slate-100" />
            <div className="h-4 w-40 rounded bg-slate-100" />
          </div>
          <div className="h-10 w-full rounded bg-slate-100" />
          <div className="h-10 w-full rounded bg-slate-100" />
          <div className="h-10 w-full rounded bg-slate-100" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCardFallback />}>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>
    </Suspense>
  )
}

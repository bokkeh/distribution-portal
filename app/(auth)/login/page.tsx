'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="pt-6">
        <LoginForm />
      </CardContent>
    </Card>
  )
}

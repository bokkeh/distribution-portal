'use server'

import { signIn, signOut } from '@/lib/auth/config'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password.' }
        default:
          return { error: 'Something went wrong.' }
      }
    }
    throw error
  }

  redirect('/admin/dashboard')
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}

import type { DefaultSession } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      roles: string[]
      featureFlags: string[]
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    roles?: string[]
    featureFlags?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string
    role?: string
    roles?: string[]
    featureFlags?: string[]
  }
}

export type UserRole = 'admin' | 'staff' | 'driver' | 'customer' | 'taster'

export interface CartItem {
  productId: string
  name: string
  sku: string
  price: string
  samplePrice: string
  imageUrl: string | null
  quantity: number
  orderType: 'paid' | 'sample'
}

export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

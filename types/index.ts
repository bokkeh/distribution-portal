import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }
}

export type UserRole = 'admin' | 'staff' | 'driver' | 'customer'

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

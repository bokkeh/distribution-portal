import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'
import { normalizeCaseQuantity } from '@/lib/orders/minimums'

interface CartStore {
  items: CartItem[]
  orderType: 'paid' | 'sample'
  setOrderType: (type: 'paid' | 'sample') => void
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      orderType: 'paid',
      setOrderType: (type) => set({ orderType: type, items: [] }),
      addItem: (newItem) => set((state) => {
        const existing = state.items.find(i => i.productId === newItem.productId)
        if (existing) {
          return {
            items: state.items.map(i => {
              if (i.productId !== newItem.productId) return i
              return {
                ...i,
                quantity: normalizeCaseQuantity(i, i.quantity + 1),
              }
            }),
          }
        }
        return {
          items: [
            ...state.items,
            {
              ...newItem,
              quantity: normalizeCaseQuantity(newItem, 1),
            },
          ],
        }
      }),
      removeItem: (productId) => set((state) => ({ items: state.items.filter(i => i.productId !== productId) })),
      updateQuantity: (productId, quantity) => set((state) => {
        if (quantity <= 0) return { items: state.items.filter(i => i.productId !== productId) }
        return {
          items: state.items.map(i => {
            if (i.productId !== productId) return i
            return {
              ...i,
              quantity: normalizeCaseQuantity(i, quantity),
            }
          }),
        }
      }),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((sum, item) => {
        const price = parseFloat(get().orderType === 'sample' ? item.samplePrice : item.price)
        return sum + price * item.quantity
      }, 0),
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: 'ahawc-cart' }
  )
)

import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const role = session?.user?.role

  // Public routes
  if (pathname === '/login' || pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL(getDashboardForRole(role), req.url))
    }
    return NextResponse.next()
  }

  // Unauthenticated
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (role === 'admin') {
    return NextResponse.next()
  }

  // Admin routes
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Staff routes (admin also allowed)
  if (pathname.startsWith('/staff') && !['admin', 'staff'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Driver routes
  if (pathname.startsWith('/driver') && role !== 'driver') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Customer routes
  if (pathname.startsWith('/customer') && role !== 'customer') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

function getDashboardForRole(role?: string) {
  switch (role) {
    case 'admin': return '/admin/dashboard'
    case 'staff': return '/staff/dashboard'
    case 'driver': return '/driver/deliveries'
    case 'customer': return '/customer/dashboard'
    default: return '/login'
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}

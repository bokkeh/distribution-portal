import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const role = session?.user?.role as string | undefined
  const rolesArr = session?.user?.roles as string[] | undefined
  const roles = [...new Set([...(rolesArr ?? []), ...(role ? [role] : [])].filter(Boolean))]

  // Always-public routes (no redirect even when logged in)
  if (pathname.startsWith('/share') || pathname === '/join' || pathname.startsWith('/pay') || pathname === '/taster-signup') {
    return NextResponse.next()
  }

  // Public routes
  if (pathname === '/login' || pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    if (session) {
      return NextResponse.redirect(new URL(getDashboardForRole(role), req.url))
    }
    return NextResponse.next()
  }

  // Unauthenticated
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (roles.includes('admin')) {
    return NextResponse.next()
  }

  // Admin routes
  if (pathname.startsWith('/admin') && !roles.includes('admin')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Staff routes (admin also allowed)
  if (pathname.startsWith('/staff') && !roles.some(nextRole => ['admin', 'staff'].includes(nextRole))) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Driver routes
  if (pathname.startsWith('/driver') && !roles.includes('driver')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Customer routes
  if (pathname.startsWith('/customer') && !roles.includes('customer')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Sales routes
  if (pathname.startsWith('/sales') && !roles.some(r => ['admin', 'sales_rep', 'sales_manager'].includes(r))) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Taster routes
  if (pathname.startsWith('/taster') && !roles.some(r => ['admin', 'taster'].includes(r))) {
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
    case 'sales_rep': return '/sales/dashboard'
    case 'sales_manager': return '/sales/dashboard'
    case 'taster': return '/taster/welcome'
    default: return '/login'
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}

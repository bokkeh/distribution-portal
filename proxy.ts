import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import {
  getDashboardForRole,
  normalizeRoleList,
  parseViewAsRoles,
  VIEW_AS_COOKIE,
  VIEW_AS_ROLE_COOKIE,
  VIEW_AS_ROLES_COOKIE,
} from '@/lib/auth/view-as'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const role = session?.user?.role as string | undefined
  const rolesArr = session?.user?.roles as string[] | undefined
  const realRoles = normalizeRoleList(role, rolesArr)
  const isAdmin = realRoles.includes('admin')
  const viewAsUserId = isAdmin ? req.cookies.get(VIEW_AS_COOKIE)?.value : undefined
  const viewAsRole = isAdmin ? req.cookies.get(VIEW_AS_ROLE_COOKIE)?.value : undefined
  const viewAsRoles = isAdmin ? parseViewAsRoles(req.cookies.get(VIEW_AS_ROLES_COOKIE)?.value) : []
  const effectiveRole = viewAsUserId ? (viewAsRole ?? viewAsRoles[0]) : role
  const effectiveRoles = viewAsUserId ? normalizeRoleList(effectiveRole, viewAsRoles) : realRoles
  const dashboardPath = getDashboardForRole(effectiveRole ?? realRoles[0] ?? role)
  const redirectHome = () => NextResponse.redirect(new URL(dashboardPath, req.url))

  if (pathname.startsWith('/share') || pathname === '/join' || pathname.startsWith('/pay') || pathname === '/taster-signup') {
    return NextResponse.next()
  }

  if (pathname === '/login' || pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    if (session) {
      return NextResponse.redirect(new URL(dashboardPath, req.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (effectiveRoles.includes('admin')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin') && !effectiveRoles.includes('admin')) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (pathname.startsWith('/staff') && !effectiveRoles.some((nextRole) => ['admin', 'staff'].includes(nextRole))) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (pathname.startsWith('/driver') && !effectiveRoles.includes('driver')) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (pathname.startsWith('/customer') && !effectiveRoles.includes('customer')) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (pathname.startsWith('/sales') && !effectiveRoles.some((nextRole) => ['admin', 'sales_rep', 'sales_manager'].includes(nextRole))) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (pathname.startsWith('/taster') && !effectiveRoles.some((nextRole) => ['admin', 'taster'].includes(nextRole))) {
    return viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}

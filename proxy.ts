import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import {
  getDashboardForRole,
  hasActiveViewAs,
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
  const isViewAsActive = hasActiveViewAs(viewAsUserId, viewAsRole, viewAsRoles)
  const effectiveRole = isViewAsActive ? (viewAsRole ?? viewAsRoles[0]) : (realRoles[0] ?? role)
  const effectiveRoles = isViewAsActive ? normalizeRoleList(effectiveRole, viewAsRoles) : realRoles
  const dashboardPath = getDashboardForRole(effectiveRole ?? realRoles[0] ?? role)
  const redirectHome = () => NextResponse.redirect(new URL(dashboardPath, req.url))
  const withSanitizedViewAsCookies = (response: NextResponse) => {
    if (isAdmin && viewAsUserId && !isViewAsActive) {
      response.cookies.delete(VIEW_AS_COOKIE)
      response.cookies.delete(VIEW_AS_ROLE_COOKIE)
      response.cookies.delete(VIEW_AS_ROLES_COOKIE)
    }
    return response
  }

  if (pathname.startsWith('/share') || pathname === '/join' || pathname.startsWith('/pay') || pathname.startsWith('/order-review') || pathname === '/taster-signup') {
    return NextResponse.next()
  }

  if (pathname === '/login' || pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    if (session) {
      return withSanitizedViewAsCookies(NextResponse.redirect(new URL(dashboardPath, req.url)))
    }
    return withSanitizedViewAsCookies(NextResponse.next())
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname.startsWith('/admin') && isAdmin) {
    return withSanitizedViewAsCookies(NextResponse.next())
  }

  if (effectiveRoles.includes('admin')) {
    return withSanitizedViewAsCookies(NextResponse.next())
  }

  if (pathname.startsWith('/admin') && !effectiveRoles.includes('admin')) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  if (pathname.startsWith('/staff') && !effectiveRoles.some((nextRole) => ['admin', 'staff'].includes(nextRole))) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  if (pathname.startsWith('/driver') && !effectiveRoles.includes('driver')) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  if (pathname.startsWith('/customer') && !effectiveRoles.includes('customer')) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  if (pathname.startsWith('/sales') && !effectiveRoles.some((nextRole) => ['admin', 'sales_rep', 'sales_manager'].includes(nextRole))) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  if (pathname.startsWith('/taster') && !effectiveRoles.some((nextRole) => ['admin', 'taster'].includes(nextRole))) {
    return withSanitizedViewAsCookies(viewAsUserId ? redirectHome() : NextResponse.redirect(new URL('/unauthorized', req.url)))
  }

  return withSanitizedViewAsCookies(NextResponse.next())
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}

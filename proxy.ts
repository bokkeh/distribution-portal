import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import { FIELD_DEVICE_COOKIE, FIELD_SESSION_MAX_AGE, isFieldEntry } from '@/lib/auth/field-session'
import { fieldLoginReturn } from '@/lib/field/validation'
import {
  getDashboardForRole,
  hasActiveViewAs,
  normalizeRoleList,
  parseViewAsRoles,
  VIEW_AS_COOKIE,
  VIEW_AS_ROLE_COOKIE,
  VIEW_AS_ROLES_COOKIE,
} from '@/lib/auth/view-as'

const authenticatedProxy = auth((req) => {
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
    if (isFieldEntry(pathname, req.nextUrl.searchParams.get('next'))) {
      response.cookies.set(FIELD_DEVICE_COOKIE, '1', { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: FIELD_SESSION_MAX_AGE })
    }
    if (isAdmin && viewAsUserId && !isViewAsActive) {
      response.cookies.delete(VIEW_AS_COOKIE)
      response.cookies.delete(VIEW_AS_ROLE_COOKIE)
      response.cookies.delete(VIEW_AS_ROLES_COOKIE)
    }
    return response
  }

  if (pathname === '/sms-consent/taster' || pathname.startsWith('/share') || pathname === '/join' || pathname === '/community' || pathname.startsWith('/pay') || pathname.startsWith('/order-review') || pathname === '/taster-signup') {
    return NextResponse.next()
  }

  if (pathname === '/login' || pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    if (session) {
      const field = pathname === '/login' ? fieldLoginReturn(req.nextUrl.searchParams.get('next')) : null
      return withSanitizedViewAsCookies(NextResponse.redirect(new URL(field ?? dashboardPath, req.url)))
    }
    return withSanitizedViewAsCookies(NextResponse.next())
  }

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    if (pathname === '/field') loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`)
    return withSanitizedViewAsCookies(NextResponse.redirect(loginUrl))
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

// Auth.js lazy configuration may return the wrapped handler asynchronously.
export default async function proxy(...args: Parameters<Awaited<typeof authenticatedProxy>>) {
  const handler = await authenticatedProxy
  return handler(...args)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}

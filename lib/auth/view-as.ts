export const VIEW_AS_COOKIE = '__portal_view_as'
export const VIEW_AS_ROLE_COOKIE = '__portal_view_as_role'
export const VIEW_AS_ROLES_COOKIE = '__portal_view_as_roles'

export function normalizeRoleList(role: string | null | undefined, roles: string[] | null | undefined) {
  return Array.from(new Set([...(roles ?? []), ...(role ? [role] : [])].filter(Boolean)))
}

export function serializeViewAsRoles(roles: string[]) {
  return normalizeRoleList(undefined, roles).join(',')
}

export function parseViewAsRoles(serializedRoles: string | null | undefined) {
  if (!serializedRoles) return []
  return Array.from(new Set(
    serializedRoles
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
  ))
}

export function getDashboardForRole(role?: string | null) {
  switch (role) {
    case 'admin': return '/admin/dashboard'
    case 'staff': return '/staff'
    case 'driver': return '/driver'
    case 'customer': return '/customer'
    case 'sales_rep': return '/sales/dashboard'
    case 'sales_manager': return '/sales/dashboard'
    case 'taster': return '/taster'
    default: return '/unauthorized'
  }
}

export function getDashboardForRoles(roles: string[], primaryRole?: string | null) {
  const normalizedRoles = normalizeRoleList(primaryRole, roles)

  if (primaryRole) {
    return getDashboardForRole(primaryRole)
  }

  if (normalizedRoles.includes('admin')) return getDashboardForRole('admin')
  if (normalizedRoles.includes('staff')) return getDashboardForRole('staff')
  if (normalizedRoles.includes('driver')) return getDashboardForRole('driver')
  if (normalizedRoles.includes('customer')) return getDashboardForRole('customer')
  if (normalizedRoles.includes('sales_manager')) return getDashboardForRole('sales_manager')
  if (normalizedRoles.includes('sales_rep')) return getDashboardForRole('sales_rep')
  if (normalizedRoles.includes('taster')) return getDashboardForRole('taster')

  return '/unauthorized'
}

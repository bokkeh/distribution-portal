export const ALL_FEATURES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'crm', label: 'CRM / Accounts' },
  { key: 'wholesale_requests', label: 'Wholesaler Requests' },
  { key: 'orders', label: 'Orders' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'users', label: 'User Management' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'profile', label: 'Profile' },
  { key: 'tastings', label: 'Tastings' },
  { key: 'products', label: 'Products' },
  { key: 'cart', label: 'Cart' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'map', label: 'Map' },
] as const

export type FeatureKey = typeof ALL_FEATURES[number]['key']

const ROLE_DEFAULTS: Record<string, FeatureKey[]> = {
  admin: ['dashboard', 'invoicing', 'accounting', 'crm', 'wholesale_requests', 'orders', 'inventory', 'users', 'deliveries', 'drivers', 'profile', 'tastings'],
  staff: ['dashboard', 'crm', 'orders', 'inventory', 'profile', 'tastings'],
  driver: ['deliveries', 'map', 'profile'],
  customer: ['dashboard', 'products', 'orders', 'cart', 'invoices', 'profile'],
  taster: ['tastings', 'profile'],
}

export function getDefaultFeaturesForRoles(roles: string[]) {
  const next = new Set<FeatureKey>()
  for (const role of roles) {
    for (const feature of ROLE_DEFAULTS[role] ?? []) {
      next.add(feature)
    }
  }
  if (roles.includes('admin')) {
    for (const feature of ALL_FEATURES) next.add(feature.key)
  }
  return Array.from(next)
}

export function resolveFeatureFlags(roles: string[], explicitFeatures?: string[] | null) {
  if (explicitFeatures) return explicitFeatures.filter(Boolean) as FeatureKey[]
  return getDefaultFeaturesForRoles(roles)
}

export function hasFeature(feature: FeatureKey, roles: string[], explicitFeatures?: string[] | null) {
  return resolveFeatureFlags(roles, explicitFeatures).includes(feature)
}

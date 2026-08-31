export const ALL_FEATURES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'crm', label: 'CRM / Accounts' },
  { key: 'inbox', label: 'SMS Inbox' },
  { key: 'wholesale_requests', label: 'Wholesaler Requests' },
  { key: 'orders', label: 'Orders' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'users', label: 'User Management' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'profile', label: 'Profile' },
  { key: 'tastings', label: 'Tastings' },
  { key: 'events', label: 'Events' },
  { key: 'products', label: 'Products' },
  { key: 'cart', label: 'Cart' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'map', label: 'Map' },
  { key: 'sales', label: 'Sales Dashboard' },
  { key: 'promotions', label: 'Promotion Catalog' },
] as const

export type FeatureKey = typeof ALL_FEATURES[number]['key']

const ROLE_DEFAULTS: Record<string, FeatureKey[]> = {
  admin: ['dashboard', 'invoicing', 'accounting', 'crm', 'inbox', 'wholesale_requests', 'orders', 'inventory', 'users', 'deliveries', 'drivers', 'profile', 'tastings', 'events', 'promotions'],
  staff: ['dashboard', 'invoicing', 'crm', 'inbox', 'orders', 'inventory', 'profile', 'tastings', 'events', 'promotions'],
  driver: ['deliveries', 'map', 'profile'],
  customer: ['dashboard', 'products', 'orders', 'cart', 'invoices', 'profile', 'promotions'],
  taster: ['tastings', 'profile'],
  sales_rep: ['sales', 'profile', 'promotions'],
  sales_manager: ['sales', 'profile', 'crm', 'promotions'],
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
  const defaults = getDefaultFeaturesForRoles(roles)
  if (!explicitFeatures) return defaults

  const next = new Set<FeatureKey>(defaults)
  for (const feature of explicitFeatures.filter(Boolean) as FeatureKey[]) {
    next.add(feature)
  }
  return Array.from(next)
}

export function hasFeature(feature: FeatureKey, roles: string[], explicitFeatures?: string[] | null) {
  return resolveFeatureFlags(roles, explicitFeatures).includes(feature)
}

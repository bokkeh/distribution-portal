import { PortalBreadcrumbs } from './PortalBreadcrumbs'
import { PortalSearch } from '@/components/search/PortalSearch'

export function PortalTopBar() {
  return (
    <div className="mb-6 space-y-4">
      <PortalBreadcrumbs />
      <PortalSearch />
    </div>
  )
}

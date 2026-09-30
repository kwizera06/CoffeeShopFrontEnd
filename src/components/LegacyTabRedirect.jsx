import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * LegacyTabRedirect Component
 * Handles backward compatibility for old ?tab=xxx query parameters
 * Redirects them to the new semantic paths:
 *   /app/admin?tab=overview → /app/admin/overview
 *   /app/admin?tab=menu → /app/admin/menu
 *   etc.
 * 
 * Usage: Automatically routes /app/admin?tab=xxx to new paths
 */
const TAB_TO_PATH_MAP = {
  overview: '/app/admin/overview',
  menu: '/app/admin/menu',
  inventory: '/app/admin/inventory',
  bakery: '/app/admin/menu',
  stock: '/app/admin/stock-levels',
  loans: '/app/admin/loans',
  requested_order: '/app/admin/requisitions',
  approvals: '/app/admin/approvals',
  staff: '/app/admin/staff',
  eod: '/app/admin/eod-report',
  audit: '/app/admin/manager-audit',
}

export default function LegacyTabRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')

  useEffect(() => {
    if (tab && TAB_TO_PATH_MAP[tab]) {
      navigate(TAB_TO_PATH_MAP[tab], { replace: true })
    } else if (tab) {
      navigate('/app/admin/overview', { replace: true })
    } else {
      navigate('/app/admin/overview', { replace: true })
    }
  }, [tab, navigate])

  return null
}

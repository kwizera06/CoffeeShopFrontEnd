import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * LegacyPosRedirect Component
 * Handles backward compatibility for old POS URLs:
 * - /app/cashier -> /app/pos/new-order
 * - /app/cashier?tab=pending -> /app/pos/pending
 * - /app/cashier?tab=production -> /app/pos/record-production
 * - /app/cashier?tab=ready -> /app/pos/awaiting-payment
 * - /app/cashier?tab=history -> /app/pos/history
 * - /app/cashier?tab=loans -> /app/pos/loans
 * - /app/cashier?tab=warehouse -> /app/pos/pending (warehouse requests are in pending)
 */
export default function LegacyPosRedirect() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Map old tab names to new routes
    const tabMap = {
      new: '/app/pos/new-order',
      pending: '/app/pos/pending',
      ready: '/app/pos/awaiting-payment',
      production: '/app/pos/record-production',
      warehouse: '/app/pos/warehouse',
      history: '/app/pos/history',
      loans: '/app/pos/loans',
    }

    const oldTab = searchParams.get('tab') || 'new'
    const newPath = tabMap[oldTab] || '/app/pos/new-order'

    nav(newPath, { replace: true })
  }, [nav, searchParams])

  return null
}

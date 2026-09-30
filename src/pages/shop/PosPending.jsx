import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosPending Page
 * Renders the Pending tab from CashierDashboard with initialTab prop
 */
export default function PosPending() {
  usePageTitle('Pending Orders')

  return <CashierDashboard initialTab="pending" />
}

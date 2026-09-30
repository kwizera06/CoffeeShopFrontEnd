import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosNewOrder Page
 * Renders the New Order tab from CashierDashboard with initialTab prop
 */
export default function PosNewOrder() {
  usePageTitle('New Order')

  return <CashierDashboard initialTab="new" />
}

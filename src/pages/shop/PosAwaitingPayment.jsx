import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosAwaitingPayment Page
 * Renders the Awaiting Payment (ready) tab from CashierDashboard with initialTab prop
 */
export default function PosAwaitingPayment() {
  usePageTitle('Awaiting Payment')

  return <CashierDashboard initialTab="ready" />
}

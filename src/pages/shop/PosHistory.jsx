import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosHistory Page
 * Renders the History tab from CashierDashboard with initialTab prop
 */
export default function PosHistory() {
  usePageTitle('Sales History')

  return <CashierDashboard initialTab="history" />
}

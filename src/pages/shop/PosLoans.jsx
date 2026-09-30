import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosLoans Page
 * Renders the Loans tab from CashierDashboard with initialTab prop
 */
export default function PosLoans() {
  usePageTitle('Loans')

  return <CashierDashboard initialTab="loans" />
}

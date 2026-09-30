import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosRecordProduction Page
 * Renders the Record Production tab from CashierDashboard with initialTab prop
 */
export default function PosRecordProduction() {
  usePageTitle('Record Production')

  return <CashierDashboard initialTab="production" />
}

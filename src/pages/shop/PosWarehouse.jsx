import { usePageTitle } from '../../hooks/usePageTitle'
import CashierDashboard from './CashierDashboard'

/**
 * PosWarehouse Page
 * Renders the Warehouse Requests tab from CashierDashboard with initialTab prop
 */
export default function PosWarehouse() {
  usePageTitle('Warehouse Requests')

  return <CashierDashboard initialTab="warehouse" />
}

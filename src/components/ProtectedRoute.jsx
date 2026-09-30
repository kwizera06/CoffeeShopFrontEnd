import { Navigate } from 'react-router-dom'
import { getSession } from '../api'

/**
 * ProtectedRoute Component
 * Guards routes to:
 * - Redirect unauthenticated users to /login
 * - Redirect unauthorized users to their default pages
 * 
 * Usage:
 *   <Route element={<ProtectedRoute requiredRoles={['SHOP_ADMIN']}><AdminPage /></ProtectedRoute>} />
 * 
 * Role Hierarchy:
 * - SHOP_ADMIN (OWNER) can access everything: admin, POS, etc.
 * - MANAGER can access admin and POS
 * - CASHIER, CHEF, WAITER can access POS
 * - AUDITOR has read-only admin access
 * - STOREKEEPER has dedicated storekeeper page
 */
export default function ProtectedRoute({ children, requiredRoles = ['SHOP_ADMIN', 'MANAGER', 'AUDITOR'] }) {
  const session = getSession()

  // Not authenticated
  if (!session?.token) {
    return <Navigate to="/login" replace />
  }

  // Role hierarchy: SHOP_ADMIN (OWNER) can access any route that allows MANAGER or CASHIER
  const canAccess = requiredRoles.includes(session.role) ||
    (session.role === 'SHOP_ADMIN' && (requiredRoles.includes('MANAGER') || requiredRoles.includes('CASHIER') || requiredRoles.includes('CHEF')))

  // Not authorized for this route
  if (!canAccess) {
    // Redirect to their default page based on role
    const roleRoutes = {
      CASHIER: '/app/pos/new-order',
      CHEF: '/app/chef',
      STOREKEEPER: '/app/storekeeper',
      AUDITOR: '/app/auditor',
      WAITER: '/app/pos/new-order',
    }
    return <Navigate to={roleRoutes[session.role] || '/login'} replace />
  }

  return children
}

import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LegacyTabRedirect from './components/LegacyTabRedirect.jsx'
import LegacyPosRedirect from './components/LegacyPosRedirect.jsx'
import NotFound from './components/NotFound.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PosLayout from './components/PosLayout.jsx'
import ShopLayout from './shop/ShopLayout.jsx'
import { ShopProvider } from './shop/ShopContext'
import Supplies from './pages/shop/Supplies.jsx'
import Orders from './pages/shop/Orders.jsx'
import Billing from './pages/shop/Billing.jsx'
import ChefDashboard from './pages/shop/ChefDashboard.jsx'
import CashierDashboard from './pages/shop/CashierDashboard.jsx'
import Storekeeper from './pages/shop/Storekeeper.jsx'
import Auditor from './pages/shop/Auditor.jsx'
import { getSession } from './api'

// Lazy-load admin pages for better performance
const Owner = lazy(() => import('./pages/shop/Owner.jsx'))

// Lazy-load POS pages for better performance
const PosNewOrder = lazy(() => import('./pages/shop/PosNewOrder.jsx'))
const PosPending = lazy(() => import('./pages/shop/PosPending.jsx'))
const PosAwaitingPayment = lazy(() => import('./pages/shop/PosAwaitingPayment.jsx'))
const PosRecordProduction = lazy(() => import('./pages/shop/PosRecordProduction.jsx'))
const PosWarehouse = lazy(() => import('./pages/shop/PosWarehouse.jsx'))
const PosHistory = lazy(() => import('./pages/shop/PosHistory.jsx'))
const PosLoans = lazy(() => import('./pages/shop/PosLoans.jsx'))

/**
 * Loading fallback component for lazy-loaded pages
 */
function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontSize: '16px',
      color: '#666'
    }}>
      Loading page...
    </div>
  )
}

/**
 * Home redirect component
 * Routes based on user role
 */
function AppIndex() {
  const { role } = getSession()
  if (role === 'SHOP_ADMIN' || role === 'MANAGER') return <Navigate to="/app/admin/overview" replace />
  if (role === 'AUDITOR') return <Navigate to="/app/auditor" replace />
  if (role === 'STOREKEEPER') return <Navigate to="/app/storekeeper" replace />
  if (role === 'CHEF') return <Navigate to="/app/chef" replace />
  return <Navigate to="/app/pos/new-order" replace />
}

/**
 * AdminLayoutWithProvider wrapper
 * Wraps AdminLayout with ShopProvider so useShopContext() works
 */
function AdminLayoutWithProvider() {
  return (
    <ShopProvider>
      <AdminLayout />
    </ShopProvider>
  )
}

/**
 * Root-level router using createBrowserRouter
 * 
 * IMPORTANT: Structure is:
 * - /login
 * - /app/admin/* (Protected, uses AdminLayout as parent with ShopProvider)
 * - /app/cashier, /app/chef, etc. (Regular routes with ShopLayout)
 * 
 * This prevents duplication by NOT nesting admin routes under ShopLayout
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  
  // ===== ADMIN ROUTES (Wrapped with ShopProvider for useShopContext support) =====
  {
    path: '/app/admin',
    element: (
      <ProtectedRoute>
        <AdminLayoutWithProvider />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/admin/overview" replace />,
      },
      {
        path: 'overview',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="overview" />
          </Suspense>
        ),
      },
      {
        path: 'menu',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="menu" />
          </Suspense>
        ),
      },
      {
        path: 'inventory',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="inventory" />
          </Suspense>
        ),
      },
      {
        path: 'stock-levels',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="stock" />
          </Suspense>
        ),
      },
      {
        path: 'loans',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="loans" />
          </Suspense>
        ),
      },
      {
        path: 'requisitions',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="requested_order" />
          </Suspense>
        ),
      },
      {
        path: 'approvals',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="approvals" />
          </Suspense>
        ),
      },
      {
        path: 'staff',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="staff" />
          </Suspense>
        ),
      },
      {
        path: 'eod-report',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="eod" />
          </Suspense>
        ),
      },
      {
        path: 'manager-audit',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Owner initialTab="audit" />
          </Suspense>
        ),
      },
    ],
  },

  // ===== LEGACY ?tab= REDIRECT (backward compatibility) =====
  {
    path: '/app/admin-legacy',
    element: <LegacyTabRedirect />,
  },

  // ===== LEGACY CASHIER REDIRECT (backward compatibility) =====
  {
    path: '/app/cashier-legacy',
    element: <LegacyPosRedirect />,
  },

  // ===== POS ROUTES (New semantic paths with ShopProvider wrapper) =====
  {
    path: '/app/pos',
    element: (
      <ProtectedRoute requiredRoles={['CASHIER', 'CHEF', 'WAITER', 'MANAGER', 'SHOP_ADMIN']}>
        <ShopProvider>
          <PosLayout />
        </ShopProvider>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/pos/new-order" replace />,
      },
      {
        path: 'new-order',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosNewOrder />
          </Suspense>
        ),
      },
      {
        path: 'pending',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosPending />
          </Suspense>
        ),
      },
      {
        path: 'awaiting-payment',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosAwaitingPayment />
          </Suspense>
        ),
      },
      {
        path: 'record-production',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosRecordProduction />
          </Suspense>
        ),
      },
      {
        path: 'warehouse',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosWarehouse />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosHistory />
          </Suspense>
        ),
      },
      {
        path: 'loans',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PosLoans />
          </Suspense>
        ),
      },
    ],
  },

  // ===== REGULAR APP ROUTES (with ShopLayout) =====
  {
    path: '/app',
    element: <ShopLayout />,
    children: [
      {
        index: true,
        element: <AppIndex />,
      },
      {
        // Legacy: /app/cashier -> redirect to /app/pos/new-order
        path: 'cashier',
        element: <LegacyPosRedirect />,
      },
      {
        path: 'orders',
        element: <Orders />,
      },
      {
        path: 'billing',
        element: <Billing />,
      },
      {
        path: 'supplies',
        element: <Supplies />,
      },
      {
        path: 'auditor',
        element: <Auditor />,
      },
      {
        path: 'storekeeper',
        element: <Storekeeper />,
      },
      {
        path: 'chef',
        element: <ChefDashboard />,
      },
    ],
  },

  // ===== 404 FALLBACK =====
  {
    path: '*',
    element: <NotFound />,
  },
])

export default router

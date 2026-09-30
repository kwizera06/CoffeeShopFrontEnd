import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { shouldShowAdminDashboard } from '../utils/adminAccess.js'
import { canAccessDashboard, canAccessTab, getDashboardLabel, isManagerRole, isOwnerRole, isStorekeeperRole } from '../utils/roles.js'
import { supabase } from '../supabaseClient.js'
import { useShopContext } from '../shop/ShopContext'
import ShiftManager from '../shop/ShiftManager'
import { 
  HiOutlineChartBar, 
  HiOutlineClipboardDocumentList, 
  HiOutlineCube, 
  HiOutlineUsers,
  HiOutlineDocumentChartBar,
  HiOutlineArchiveBox,
  HiOutlineArrowRightOnRectangle,
  HiOutlineQueueList,
  HiOutlineBell,
  HiOutlineMagnifyingGlass,
  HiOutlineSquares2X2,
  HiOutlineShoppingBag,
  HiOutlineBanknotes,
  HiOutlineBars3,
  HiOutlineXMark
} from 'react-icons/hi2'
import olitechLogo from '../assets/Olitech Logo.png'
import '../shop/ShopModern.css'

const NAV_ITEMS = [
  { path: '/app/admin/overview', label: 'Overview', ownerOnly: false },
  { path: '/app/admin/menu', label: 'Menu', ownerOnly: false },
  { path: '/app/admin/inventory', label: 'Inventory', ownerOnly: true },
  { path: '/app/admin/stock-levels', label: 'Stock Levels', ownerOnly: false },
  { path: '/app/admin/loans', label: 'Loans', ownerOnly: false },
  { path: '/app/admin/requisitions', label: 'Requisitions', ownerOnly: true },
  { path: '/app/admin/approvals', label: '🔔 Approvals', ownerOnly: true },
  { path: '/app/admin/staff', label: 'Staff', ownerOnly: true },
  { path: '/app/admin/eod-report', label: 'EOD Report', ownerOnly: false },
  { path: '/app/admin/manager-audit', label: 'Manager Audit', ownerOnly: true },
]

/**
 * AdminLayout Component
 * Shared layout for all admin pages with:
 * - Top navigation bar
 * - Collapsible sidebar with NavLink items
 * - Main content area with <Outlet />
 * - Mobile-responsive design
 */
export default function AdminLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const { role, name, email } = getSession()
  const { context, reload, isShopAdmin } = useShopContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s.token || s.role === 'PLATFORM_ADMIN' || !s.tenantId) {
      nav('/login', { replace: true })
      return
    }
    const initial = window.setTimeout(() => {
      void reload().catch(() => nav('/login', { replace: true }))
    }, 0)
    const id = setInterval(() => void reload().catch(() => {}), 30000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [nav, reload])

  const logout = async () => {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  const showDashboard = canAccessDashboard(role) || isShopAdmin || shouldShowAdminDashboard(getSession(), context)

  // enabledTabs: null means all tabs are enabled (backward compatible)
  const enabledTabs = context?.enabledTabs || null

  const visibleNav = NAV_ITEMS.filter(item => {
    // 1. Role-based gate (ownerOnly items hidden from non-owners)
    if (item.ownerOnly && !isOwnerRole(role)) return false
    // 2. Role access gate (manager/auditor item allowlist)
    if (!isOwnerRole(role) && !canAccessTab(role, item.path.split('/').pop())) return false
    // 3. Developer feature flag — if enabledTabs is set, only show listed tabs
    if (enabledTabs) {
      const tabKey = item.path.split('/').pop()
      const legacyKey = tabKey === 'stock-levels' ? 'stock' : tabKey === 'requisitions' ? 'requested_order' : tabKey === 'eod-report' ? 'eod' : tabKey === 'manager-audit' ? 'audit' : tabKey
      if (!enabledTabs.includes(legacyKey)) return false
    }
    return true
  })

  const dashboardLabel = getDashboardLabel(role)
  const roleLabel = isOwnerRole(role) ? 'Shop Admin' : isManagerRole(role) ? 'Manager' : 'Shop Staff'
  const initials = (name || email || '?')[0].toUpperCase()

  return (
    <div className="shop-app-modern">
      <header className="modern-header">
        <div className="modern-header-left">
          <div className="modern-logo"><img src={olitechLogo} alt="Olitech Hub" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div className="modern-shop-info">
            <h3>{context?.name || 'Olitech Hub'}</h3>
            <p>{roleLabel}</p>
          </div>
        </div>

        {showDashboard && (
          <nav className="modern-nav-tabs">
            {visibleNav.slice(0, 4).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `modern-tab ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="modern-header-right">
          <HiOutlineMagnifyingGlass className="header-icon-modern" />
          <div className="header-icon-modern" style={{ position: 'relative' }}>
            <HiOutlineBell />
            <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, background: '#FF5722', borderRadius: '50%' }}></span>
          </div>
          {(role === 'MANAGER' || role === 'SHOP_ADMIN') && (
            <NavLink to="/app/billing" className="pos-btn-modern" style={{ background: '#2196F3', borderColor: '#2196F3', marginRight: '8px' }}>Billing / Refunds</NavLink>
          )}
          {(role !== 'STOREKEEPER' && role !== 'AUDITOR') && (
            <NavLink to="/app/pos/new-order" className="pos-btn-modern">POS</NavLink>
          )}
          <div className="user-avatar-modern" title="Click to logout" onClick={logout} style={{ cursor: 'pointer' }}>{initials}</div>
        </div>
      </header>

      <div className="modern-body">
        <div className={`am-sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}></div>

        <aside className={`am-app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="am-sidebar-header">
            <div className="am-sidebar-brand">
              <img src={olitechLogo} alt="Olitech Hub" className="am-sidebar-logo-img" />
              <h2 className="am-sidebar-logo">
                <span className="brand-olitech">Olitech</span>{' '}
                <span className="brand-hub">Hub</span>
              </h2>
            </div>
            <HiOutlineXMark className="am-sidebar-close-btn" onClick={() => setSidebarOpen(false)} />
          </div>

          <nav className="am-sidebar-nav">
            {visibleNav.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `am-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          <div className="am-sidebar-footer">
            <button className="am-logout-btn" onClick={logout}>
              <HiOutlineArrowRightOnRectangle /> Logout
            </button>
          </div>
        </aside>

        <main className="modern-viewport">
          <div className="am-mobile-toggle-bar">
            <HiOutlineBars3 className="am-hamburger-btn" onClick={() => setSidebarOpen(true)} />
            <div className="am-mobile-logo-text">Olitech Hub</div>
          </div>
          {role !== 'SHOP_ADMIN' && role !== 'MANAGER' && <ShiftManager />}
          <Outlet context={{ setSidebarOpen }} />
        </main>
      </div>

      {showDashboard && (
        <nav className="am-bottom-nav">
          {visibleNav.slice(0, 4).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `am-bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <HiOutlineSquares2X2 />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button className="am-bottom-nav-item" onClick={() => setSidebarOpen(true)}>
            <HiOutlineBars3 />
            <span>More</span>
          </button>
        </nav>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { shouldShowAdminDashboard } from '../utils/adminAccess.js'
import { canAccessDashboard, canAccessTab, getDashboardLabel, isManagerRole, isOwnerRole } from '../utils/roles.js'
import { supabase } from '../supabaseClient.js'
import { ShopProvider, useShopContext } from './ShopContext'
import ShiftManager from './ShiftManager'
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
import './ShopModern.css'

const NAV_ITEMS = [
  { tab: 'overview', label: 'Overview', icon: null },
  { tab: 'menu', label: 'Menu', ownerOnly: true },
  { tab: 'inventory', label: 'Inventory', ownerOnly: true },
  { tab: 'bakery', label: 'Bakery', ownerOnly: true },
  { tab: 'stock', label: 'Stock Levels' },
  { tab: 'loans', label: 'Loans' },
  { tab: 'requested_order', label: 'Requisitions', ownerOnly: true },
  { tab: 'staff', label: 'Staff', ownerOnly: true },
  { tab: 'reports', label: 'Reports' },
  { tab: 'eod', label: 'EOD Report' },
]

function Shell() {
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
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.ownerOnly) return isOwnerRole(role)
    return canAccessTab(role, item.tab)
  })
  const dashboardLabel = getDashboardLabel(role)
  const roleLabel = isOwnerRole(role) ? 'Shop Admin' : isManagerRole(role) ? 'Manager' : 'Shop Staff'
  const initials = (name || email || '?')[0].toUpperCase()

  if (loc.pathname === '/app/cashier' && !showDashboard) {
    return <Outlet />
  }

  if (loc.pathname === '/app/cashier' && showDashboard) {
    return (
      <>
        <div className="admin-pos-bridge">
          <span className="admin-pos-bridge-label">POS Mode</span>
          <button type="button" className="admin-pos-bridge-btn" onClick={() => nav('/app/admin?tab=overview')}>
            ← {dashboardLabel}
          </button>
        </div>
        <Outlet />
      </>
    )
  }

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
              <NavLink key={item.tab} to={`/app/admin?tab=${item.tab}`} className={() => `modern-tab ${loc.search.includes(`tab=${item.tab}`) ? 'active' : ''}`}>
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
          <NavLink to="/app/cashier" className="pos-btn-modern">POS</NavLink>
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
                  key={item.tab}
                  to={`/app/admin?tab=${item.tab}`}
                  className={() => `am-nav-link ${loc.search.includes(`tab=${item.tab}`) ? 'active' : ''}`}
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
              key={item.tab}
              to={`/app/admin?tab=${item.tab}`}
              className={`am-bottom-nav-item ${loc.search.includes(`tab=${item.tab}`) || (item.tab === 'overview' && !loc.search.includes('tab=')) ? 'active' : ''}`}
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

export default function ShopLayout() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}

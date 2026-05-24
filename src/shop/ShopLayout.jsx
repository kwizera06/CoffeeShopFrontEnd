import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearSession, getSession } from '../api'
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
import { IoCafeOutline } from 'react-icons/io5'
import './ShopModern.css'

function Shell() {
  const nav = useNavigate()
  const loc = useLocation()
  const { role, name, email } = getSession()
  const { context, reload } = useShopContext()
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

  const showOwner = role === 'SHOP_ADMIN'
  const initials = (name || email || '?')[0].toUpperCase()

  if (loc.pathname === '/app/cashier') {
    return <Outlet />
  }

  return (
    <div className="shop-app-modern">
      {/* Modern Top Header */}
      <header className="modern-header">
        <div className="modern-header-left">
          <div className="modern-logo"><IoCafeOutline style={{ color: 'white' }} /></div>
          <div className="modern-shop-info">
            <h3>{context?.name || "Mama Prince's Coffee Shop"}</h3>
            <p>{role === 'SHOP_ADMIN' ? 'Shop Admin' : 'Shop Staff'}</p>
          </div>
        </div>

        {showOwner && (
          <nav className="modern-nav-tabs">
            <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `modern-tab ${isActive ? 'active' : ''}`}>Overview</NavLink>
            <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `modern-tab ${isActive ? 'active' : ''}`}>Reports</NavLink>
            <NavLink to="/app/admin?tab=staff" className={({ isActive }) => `modern-tab ${isActive ? 'active' : ''}`}>Staff</NavLink>
            <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `modern-tab ${isActive ? 'active' : ''}`}>Inventory</NavLink>
          </nav>
        )}

        <div className="modern-header-right">
          <HiOutlineMagnifyingGlass className="header-icon-modern" />
          <div className="header-icon-modern" style={{ position: 'relative' }}>
            <HiOutlineBell />
            <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, background: '#FF5722', borderRadius: '50%' }}></span>
          </div>
          <NavLink to="/app/cashier" className="pos-btn-modern">
            POS
          </NavLink>
          <div className="user-avatar-modern" title="Click to logout" onClick={logout} style={{ cursor: 'pointer' }}>{initials}</div>
        </div>
      </header>

      <div className="modern-body">
        {/* Sidebar Overlay Backdrop */}
        <div className={`am-sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}></div>

        {/* Global Navigation Sidebar */}
        <aside className={`am-app-sidebar ${sidebarOpen ? 'open' : ''}`}>
           <div className="am-sidebar-header">
              <h2 className="am-sidebar-logo">Olitech POS</h2>
              <HiOutlineXMark className="am-sidebar-close-btn" onClick={() => setSidebarOpen(false)} />
           </div>
           
           <nav className="am-sidebar-nav">
              <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=overview') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Overview</NavLink>
              <NavLink to="/app/admin?tab=menu" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=menu') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Menu</NavLink>
              <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=inventory') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Inventory</NavLink>
              <NavLink to="/app/admin?tab=loans" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=loans') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Loans</NavLink>
              <NavLink to="/app/admin?tab=requested_order" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=requested_order') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Requisitions</NavLink>
              <NavLink to="/app/admin?tab=staff" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=staff') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Staff</NavLink>
              <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=reports') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>Reports</NavLink>
              <NavLink to="/app/admin?tab=eod" className={({ isActive }) => `am-nav-link ${loc.search.includes('tab=eod') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>EOD Report</NavLink>
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
             <div className="am-mobile-logo-text">Olitech POS</div>
          </div>
          {role !== 'SHOP_ADMIN' && <ShiftManager />}
          {/* Inject sidebar controller for children if needed */}
          <Outlet context={{ setSidebarOpen }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {showOwner && (
        <nav className="am-bottom-nav">
          <NavLink to="/app/admin?tab=overview" className={`am-bottom-nav-item ${loc.search.includes('tab=overview') || (!loc.search.includes('tab=')) ? 'active' : ''}`}>
            <HiOutlineSquares2X2 />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/app/admin?tab=reports" className={`am-bottom-nav-item ${loc.search.includes('tab=reports') ? 'active' : ''}`}>
            <HiOutlineChartBar />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/app/admin?tab=staff" className={`am-bottom-nav-item ${loc.search.includes('tab=staff') ? 'active' : ''}`}>
            <HiOutlineUsers />
            <span>Staff</span>
          </NavLink>
          <NavLink to="/app/admin?tab=inventory" className={`am-bottom-nav-item ${loc.search.includes('tab=inventory') ? 'active' : ''}`}>
            <HiOutlineArchiveBox />
            <span>Inventory</span>
          </NavLink>
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

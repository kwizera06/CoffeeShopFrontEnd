import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { supabase } from '../supabaseClient.js'
import { ShopProvider, useShopContext } from './ShopContext'
import ShiftManager from './ShiftManager'

function Shell() {
  const nav = useNavigate()
  const { role, name, email } = getSession()
  const { context, reload } = useShopContext()

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

  async function logout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  const showOrders = role === 'CASHIER' || role === 'WAITER' || role === 'SHOP_ADMIN'
  const showBilling = role === 'CASHIER' || role === 'WAITER' || role === 'SHOP_ADMIN'
  const showOwner = role === 'SHOP_ADMIN'

  // User avatar initials
  const initials = (name || email || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="page shop-page">
      <ShiftManager />
      <header className="shop-topbar">
        {/* Brand */}
        <div className="shop-topbar-brand">
          <div className="shop-topbar-brand-icon">☕</div>
          <div>
            <div className="shop-topbar-brand-name">{context?.name ?? 'Coffee Shop'}</div>
            <div className="shop-topbar-brand-role">{role?.replace('_', ' ') ?? ''}</div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="shop-nav">
          {showOrders ? (
            <NavLink
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              to="/app/orders"
            >
              <span>🍽</span> Orders
            </NavLink>
          ) : null}
          {showBilling ? (
            <NavLink
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              to="/app/billing"
            >
              <span>💳</span> Billing
            </NavLink>
          ) : null}
          {showOwner ? (
            <NavLink
              className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
              to="/app/admin"
            >
              <span>⚙️</span> Admin
            </NavLink>
          ) : null}
        </nav>

        {/* Right actions */}
        <div className="shop-topbar-actions">
          <div className="topbar-user-avatar" title={email}>{initials || '?'}</div>
          <button
            type="button"
            className="nav-btn"
            onClick={logout}
            style={{ color: 'rgba(250,246,239,0.5)', fontSize: '13px' }}
          >
            <span>↩</span> Log out
          </button>
        </div>
      </header>

      <main className="shop-main">
        <Outlet />
      </main>
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

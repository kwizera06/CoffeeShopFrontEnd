import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { supabase } from '../supabaseClient.js'
import { ShopProvider, useShopContext } from './ShopContext'
import ShiftManager from './ShiftManager'

function Shell() {
  const nav = useNavigate()
  const { role, name, email } = getSession()
  const { context, reload } = useShopContext()
  const [showNotif, setShowNotif] = useState(false)
  const [search, setSearch] = useState('')

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

  function handleSearch(e) {
    if (e.key === 'Enter' && search.trim()) {
      nav(`/app/orders?search=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  const showOrders = role === 'CASHIER' || role === 'WAITER' || role === 'SHOP_ADMIN'
  const showBilling = role === 'CASHIER' || role === 'WAITER' || role === 'SHOP_ADMIN'
  const showSupplies = role === 'CASHIER' || role === 'WAITER'
  const showOwner = role === 'SHOP_ADMIN'

  // User avatar initials
  const initials = (name || email || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="shop-app-wrapper">
      {/* Top Header */}
      <header className="shop-top-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">MP</div>
          <div className="header-titles">
            <div className="sidebar-title-main">{context?.name || "Mama Prince's Coffee Shop"}</div>
            <div className="sidebar-title-sub">{role === 'SHOP_ADMIN' ? 'SHOP ADMIN' : 'SHOP STAFF'}</div>
          </div>
        </div>

        <div className="header-search">
           <span>🔍</span>
           <input 
             type="text" 
             placeholder="Search products or orders..." 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             onKeyDown={handleSearch}
           />
           <span className="search-shortcut">Enter ↵</span>
        </div>

        <div className="header-actions">
           {showOrders && <button onClick={() => nav('/app/orders')} className="header-icon-btn">📋 Orders</button>}
           {showBilling && <button onClick={() => nav('/app/billing')} className="header-icon-btn">💳 Billing</button>}
           {showSupplies && <button onClick={() => nav('/app/supplies')} className="header-icon-btn">📦 Supplies</button>}
           
           <div className="header-notif-container">
             <div className="header-notif" onClick={() => setShowNotif(!showNotif)}>
               🔔 <span className="notif-badge">3</span>
             </div>
             
             {showNotif && (
               <>
                 <div 
                   style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, cursor: 'default' }} 
                   onClick={() => setShowNotif(false)} 
                 />
                 <div className="notif-dropdown animate-in" style={{ zIndex: 1000 }}>
                   <div className="notif-header">Notifications</div>
                   <div className="notif-body">
                    <div className="notif-item">
                      <span className="notif-dot"></span>
                      <div>
                        <p><strong>New Sale!</strong> Cash payment of 2,000 RWF</p>
                        <span>2 minutes ago</span>
                      </div>
                    </div>
                    <div className="notif-item">
                      <span className="notif-dot"></span>
                      <div>
                        <p><strong>Low Stock</strong> Milk is below threshold</p>
                        <span>1 hour ago</span>
                      </div>
                    </div>
                    <div className="notif-item">
                      <span className="notif-dot gray"></span>
                      <div>
                        <p><strong>Shift Started</strong> Barista John logged in</p>
                        <span>3 hours ago</span>
                      </div>
                    </div>
                 </div>
                 <div className="notif-footer" onClick={() => { setShowNotif(false); nav('/app/admin?tab=reports'); }}>
                   View all activity
                 </div>
               </div>
             </>
           )}
           </div>

           <div className="header-profile" onClick={logout}>
              <span className="profile-initials">{initials}</span>
              <span className="profile-name">Logout</span>
           </div>
        </div>
      </header>

      <div className="app-layout-main">
        {/* Vertical Sidebar - Visible for ADMIN or on MOBILE for everyone */}
        {(role === 'SHOP_ADMIN' || window.innerWidth <= 768) && (
          <aside className="shop-vertical-sidebar">
             <nav className="sidebar-nav-v">
               {showOwner && (
                 <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>📊</span> Overview
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=menu" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>🍽️</span> Menu
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=staff" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>👥</span> Staff
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>📈</span> Reports
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>🧪</span> Inventory
                 </NavLink>
               )}
               
               <div className="mobile-only-divider" style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '12px 0' }} />
               
               <NavLink to="/app/orders" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                  <span>🛒</span> Orders
               </NavLink>
               <NavLink to="/app/billing" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                  <span>💳</span> Billing
               </NavLink>
               {showSupplies && (
                 <NavLink to="/app/supplies" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <span>📦</span> Supplies
                 </NavLink>
               )}
               
               <div className="v-link" onClick={logout} style={{ color: '#ef9a9a' }}>
                  <span>↩</span> Logout
               </div>
             </nav>

             {role === 'SHOP_ADMIN' && (
               <div className="sidebar-promo">
                  <div className="promo-box">
                    <span className="promo-icon">☕</span>
                    <h4>Great day for coffee!</h4>
                    <p>Delivering warmth, one cup at a time.</p>
                  </div>
               </div>
             )}
          </aside>
        )}

        <main className="shop-main-viewport">
          {role !== 'SHOP_ADMIN' && <ShiftManager />}
          <Outlet />
        </main>
      </div>
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

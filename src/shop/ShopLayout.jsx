import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { supabase } from '../supabaseClient.js'
import { ShopProvider, useShopContext } from './ShopContext'
import ShiftManager from './ShiftManager'
import { 
  HiOutlineChartBar, 
  HiOutlineClipboardDocumentList, 
  HiOutlineCreditCard, 
  HiOutlineCube, 
  HiOutlineUsers,
  HiOutlineDocumentChartBar,
  HiOutlineArchiveBox,
  HiOutlineArrowRightOnRectangle,
  HiOutlineQueueList,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineBell,
  HiOutlineMagnifyingGlass
} from 'react-icons/hi2'
import { IoRestaurantOutline } from 'react-icons/io5'

function Shell() {
  const nav = useNavigate()
  const loc = useLocation()
  const { role, name, email } = getSession()
  const { context, reload } = useShopContext()
  const [showNotif, setShowNotif] = useState(false)
  const [search, setSearch] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [loc.pathname, loc.search])

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
            <button className="mobile-hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
               {isMenuOpen ? <HiOutlineXMark /> : <HiOutlineBars3 />}
            </button>
            <div className="sidebar-logo">MP</div>
            <div className="header-titles">
               <div className="sidebar-title-main">{context?.name || "Mama Prince's Coffee Shop"}</div>
               <div className="sidebar-title-sub">{role === 'SHOP_ADMIN' ? 'SHOP ADMIN' : 'SHOP STAFF'}</div>
            </div>
         </div>

         <div className="header-right">
            <div className="header-search desktop-only">
               <HiOutlineMagnifyingGlass className="search-icon" />
               <input 
                  type="text" 
                  placeholder="Search products or orders..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearch}
               />
            </div>

            <div className="header-actions">
               <div className="desktop-only" style={{ display: 'flex', gap: '12px' }}>
                  {showOrders && <button onClick={() => nav('/app/orders')} className="header-icon-btn"><HiOutlineClipboardDocumentList /> Orders</button>}
                  {showBilling && <button onClick={() => nav('/app/billing')} className="header-icon-btn"><HiOutlineCreditCard /> Billing</button>}
                  {showSupplies && <button onClick={() => nav('/app/supplies')} className="header-icon-btn"><HiOutlineCube /> Supplies</button>}
               </div>
               
               <div className="header-notif-container">
                  <div className="header-notif" onClick={() => setShowNotif(!showNotif)}>
                    <HiOutlineBell /> <span className="notif-badge">3</span>
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
                        </div>
                        <div className="notif-footer" onClick={() => { setShowNotif(false); nav('/app/admin?tab=reports'); }}>
                           View all activity
                        </div>
                      </div>
                    </>
                  )}
               </div>

               <div className="header-profile desktop-only" onClick={logout}>
                  <span className="profile-initials">{initials}</span>
                  <span className="profile-name">Logout</span>
               </div>
            </div>
         </div>
      </header>

      <div className="app-layout-main">
        {/* Full-screen Mobile Overlay Menu */}
        {isMenuOpen && (
          <div className="mobile-menu-overlay animate-fade-in" onClick={() => setIsMenuOpen(false)}>
            <div className="mobile-menu-content animate-slide-up" onClick={e => e.stopPropagation()}>
               <div className="mobile-menu-header">
                  <div className="sidebar-logo">MP</div>
                  <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}><HiOutlineXMark /></button>
               </div>
               <nav className="mobile-nav-list">
                 {showOwner && (
                   <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                      <HiOutlineChartBar /> Overview
                   </NavLink>
                 )}
                 {showOwner && (
                   <NavLink to="/app/admin?tab=menu" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                      <IoRestaurantOutline /> Menu
                   </NavLink>
                 )}
                 {showOwner && (
                   <NavLink to="/app/admin?tab=staff" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                      <HiOutlineUsers /> Staff
                   </NavLink>
                 )}
                 {showOwner && (
                   <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                      <HiOutlineDocumentChartBar /> Reports
                   </NavLink>
                 )}
                 {showOwner && (
                    <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                       <HiOutlineArchiveBox /> Inventory
                    </NavLink>
                  )}
                  {showOwner && (
                    <NavLink to="/app/admin?tab=requested_order" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                       <HiOutlineQueueList /> Requisitions
                    </NavLink>
                  )}
                 
                 <div className="mobile-divider" />
                 
                 <NavLink to="/app/orders" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineClipboardDocumentList /> Orders
                 </NavLink>
                 <NavLink to="/app/billing" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineCreditCard /> Billing
                 </NavLink>
                 {showSupplies && (
                   <NavLink to="/app/supplies" className={({ isActive }) => `m-link ${isActive ? 'active' : ''}`}>
                      <HiOutlineCube /> Supplies
                   </NavLink>
                 )}
                 
                 <div className="mobile-divider" />
                 
                 <div className="m-link logout" onClick={logout}>
                    <HiOutlineArrowRightOnRectangle /> Logout
                 </div>
               </nav>
            </div>
          </div>
        )}

        {/* Vertical Sidebar - Visible for ADMIN or on desktop */}
        {role === 'SHOP_ADMIN' && (
          <aside className="shop-vertical-sidebar desktop-only">
             <nav className="sidebar-nav-v">
               {showOwner && (
                 <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineChartBar /> Overview
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=menu" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <IoRestaurantOutline /> Menu
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=staff" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineUsers /> Staff
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineDocumentChartBar /> Reports
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineArchiveBox /> Inventory
                 </NavLink>
               )}
               {showOwner && (
                 <NavLink to="/app/admin?tab=requested_order" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineQueueList /> Requisitions
                 </NavLink>
               )}
               
               <div className="mobile-only-divider" style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '12px 0' }} />
               
               <NavLink to="/app/orders" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                  <HiOutlineClipboardDocumentList /> Orders
               </NavLink>
               <NavLink to="/app/billing" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                  <HiOutlineCreditCard /> Billing
               </NavLink>
               {showSupplies && (
                 <NavLink to="/app/supplies" className={({ isActive }) => `v-link ${isActive ? 'active' : ''}`}>
                    <HiOutlineCube /> Supplies
                 </NavLink>
               )}
               
               <div className="v-link" onClick={logout} style={{ color: '#ef9a9a' }}>
                  <HiOutlineArrowRightOnRectangle /> Logout
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

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <NavLink to="/app/admin?tab=overview" className={({ isActive }) => `b-link ${isActive ? 'active' : ''}`}>
            <HiOutlineChartBar />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/app/admin?tab=reports" className={({ isActive }) => `b-link ${isActive ? 'active' : ''}`}>
            <HiOutlineDocumentChartBar />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/app/admin?tab=inventory" className={({ isActive }) => `b-link ${isActive ? 'active' : ''}`}>
            <HiOutlineArchiveBox />
            <span>Inventory</span>
          </NavLink>
        </nav>
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

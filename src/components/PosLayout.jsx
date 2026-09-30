import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../api'
import { useShopContext } from '../shop/ShopContext'
import { supabase } from '../supabaseClient'
import {
  HiOutlineBell,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2'
import olitechLogo from '../assets/Olitech Logo.png'
import '../shop/ShopModern.css'

const POS_NAV_ITEMS = [
  { path: '/app/pos/new-order', label: '+ New Order', showBadge: false },
  { path: '/app/pos/pending', label: '🛒 Pending', showBadge: 'pending' },
  { path: '/app/pos/awaiting-payment', label: '☕ Awaiting Payment', showBadge: 'awaiting' },
  { path: '/app/pos/record-production', label: '🧪 Record Production', showBadge: false },
  { path: '/app/pos/history', label: '🕐 History', showBadge: false },
  { path: '/app/pos/loans', label: '% Loans', showBadge: false },
]

/**
 * PosLayout Component
 * Shared layout for all POS pages with:
 * - Top navigation bar with shift status
 * - NavLink tab bar (no sidebar)
 * - Main content area with <Outlet />
 */
export default function PosLayout() {
  const nav = useNavigate()
  const { role, name, email } = getSession()
  const { context, reload, isShopAdmin } = useShopContext()

  useEffect(() => {
    const s = getSession()
    // Only CASHIER, CHEF, WAITER, MANAGER can access POS
    // OWNER/SHOP_ADMIN can also access
    const allowedRoles = ['CASHIER', 'CHEF', 'WAITER', 'MANAGER', 'SHOP_ADMIN']
    if (!s.token || !allowedRoles.includes(s.role) || !s.tenantId) {
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

  const roleLabel = role === 'SHOP_ADMIN' ? 'Owner' : 
                    role === 'MANAGER' ? 'Manager' :
                    role === 'CHEF' ? 'Chef' :
                    role === 'WAITER' ? 'Waiter' : 'Cashier'
  const initials = (name || email || '?')[0].toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center' }}>
            <img src={olitechLogo} alt="Olitech Hub" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
              {context?.name || 'Olitech Hub'}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{roleLabel}</p>
          </div>
        </div>

        {/* Top tabs */}
        <nav style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'center' }}>
          {POS_NAV_ITEMS.slice(0, 4).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: isActive ? '#ffffff' : '#6b7280',
                background: isActive ? '#3b82f6' : '#f3f4f6',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <HiOutlineMagnifyingGlass style={{ color: '#6b7280', cursor: 'pointer' }} />
          <div style={{ position: 'relative', color: '#6b7280', cursor: 'pointer' }}>
            <HiOutlineBell />
            <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, background: '#FF5722', borderRadius: '50%' }}></span>
          </div>
          {(role === 'MANAGER' || role === 'SHOP_ADMIN') && (
            <NavLink to="/app/admin/overview" style={{ 
              padding: '6px 14px',
              borderRadius: '4px',
              background: '#8B5A3C',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}>
              Admin
            </NavLink>
          )}
          <div 
            onClick={logout}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#e5e7eb',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            title="Click to logout"
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
        <Outlet context={{ }} />
      </main>
    </div>
  )
}

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
      {/* Main content area */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
        <Outlet context={{ }} />
      </main>
    </div>
  )
}

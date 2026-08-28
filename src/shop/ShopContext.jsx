/* eslint-disable react-refresh/only-export-components -- context + hook module */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, clearSession, getSession, setSession } from '../api'
import { setIsOwnerFlag, shouldShowAdminDashboard } from '../utils/adminAccess.js'
import { getCachedShopContext, setCachedShopContext } from '../utils/shopContextCache'

const Ctx = createContext(null)

function applyMeToSession(me) {
  if (!me) return
  const session = getSession()

  // IMPORTANT: Do NOT use `me.x || session.x` fallbacks for identity fields.
  // If /api/auth/me returns a user, their identity is authoritative. Merging with
  // old session values can cause cross-user contamination on mobile browsers that
  // restore backgrounded tabs with stale sessionStorage while a different user logs in.
  //
  // Only fall back to the old token when /api/auth/me intentionally sends null
  // (meaning "role did not change, keep current token").
  setSession({
    token: me.token ?? session.token,    // null means "no change needed"
    role: me.role || session.role,       // role should always be present
    tenantId: me.tenantId ?? null,       // authoritative — do NOT fall back to old tenant
    name: me.name ?? session.name,
    email: me.email ?? session.email,
    isOwner: me.isOwner,
  })
  if (me.isOwner || me.role === 'SHOP_ADMIN') {
    setIsOwnerFlag(true)
  }
}

export function ShopProvider({ children }) {
  const [context, setContext] = useState(() => getCachedShopContext(getSession().tenantId))
  const [shift, setShift] = useState(null)
  const [isShopAdmin, setIsShopAdmin] = useState(() => {
    const r = getSession().role
    return shouldShowAdminDashboard(getSession()) || r === 'MANAGER'
  })

  const reload = useCallback(async () => {
    const tenantId = getSession().tenantId

    // Optional refresh — only on local Node backend
    const me = await api('/api/auth/me').catch(() => null)
    if (me) {
      applyMeToSession(me)

      // Safety check: if the returned tenantId no longer matches what was in the session,
      // it means a different user logged in on this device. The session is stale — clear it.
      const newTenantId = getSession().tenantId
      if (tenantId && newTenantId && tenantId !== newTenantId) {
        console.warn('[ShopContext] Tenant mismatch after /api/auth/me — session was stale. Clearing.')
        clearSession()
        return
      }
    }

    const [c, s] = await Promise.all([
      api('/api/shop/context'),
      api('/api/shop/shifts/active'),
    ])
    setContext(c)
    if (c && tenantId) setCachedShopContext(tenantId, c)
    setShift(s)
    setIsShopAdmin(prev => prev || Boolean(c?.isOwner || getSession().role === 'SHOP_ADMIN' || getSession().role === 'MANAGER'))
  }, [])

  const value = useMemo(
    () => ({ context, shift, setShift, reload, isShopAdmin }),
    [context, shift, reload, isShopAdmin],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShopContext() {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error('useShopContext missing provider')
  }
  return v
}

/* eslint-disable react-refresh/only-export-components -- context + hook module */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, getSession, setSession } from '../api'
import { setIsOwnerFlag, shouldShowAdminDashboard } from '../utils/adminAccess.js'
import { getCachedShopContext, setCachedShopContext } from '../utils/shopContextCache'

const Ctx = createContext(null)

function applyMeToSession(me) {
  if (!me) return
  const session = getSession()
  setSession({
    token: me.token || session.token,
    role: me.role || session.role,
    tenantId: me.tenantId || session.tenantId,
    name: me.name || session.name,
    email: me.email || session.email,
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
    // Optional refresh — only on local Node backend (cloud may not have this route yet)
    const me = await api('/api/auth/me').catch(() => null)
    if (me) {
      applyMeToSession(me)
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

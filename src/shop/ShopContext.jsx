/* eslint-disable react-refresh/only-export-components -- context + hook module */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, getSession } from '../api'
import { getCachedShopContext, setCachedShopContext } from '../utils/shopContextCache'

const Ctx = createContext(null)

export function ShopProvider({ children }) {
  const [context, setContext] = useState(() => getCachedShopContext(getSession().tenantId))
  const [shift, setShift] = useState(null)

  const reload = useCallback(async () => {
    const tenantId = getSession().tenantId
    const [c, s] = await Promise.all([
      api('/api/shop/context'),
      api('/api/shop/shifts/active'),
    ])
    setContext(c)
    if (c && tenantId) setCachedShopContext(tenantId, c)
    setShift(s)
  }, [])

  const value = useMemo(() => ({ context, shift, setShift, reload }), [context, shift, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShopContext() {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error('useShopContext missing provider')
  }
  return v
}

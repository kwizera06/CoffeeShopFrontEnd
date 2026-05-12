/* eslint-disable react-refresh/only-export-components -- context + hook module */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api } from '../api'

const Ctx = createContext(null)

export function ShopProvider({ children }) {
  const [context, setContext] = useState(null)
  const [shift, setShift] = useState(null)

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      api('/api/shop/context'),
      api('/api/shop/shifts/active'),
    ])
    setContext(c)
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

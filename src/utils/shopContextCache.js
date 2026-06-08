const KEY = 'olitech_shop_context'

export function getCachedShopContext(tenantId) {
  if (!tenantId) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data.tenantId === tenantId ? data : null
  } catch {
    return null
  }
}

export function setCachedShopContext(tenantId, context) {
  if (!tenantId || !context?.name) return
  sessionStorage.setItem(KEY, JSON.stringify({
    id: context.id,
    name: context.name,
    status: context.status,
    tenantId,
  }))
}

export function clearCachedShopContext() {
  sessionStorage.removeItem(KEY)
}

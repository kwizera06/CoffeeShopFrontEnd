import { getCachedShopContext } from './shopContextCache.js'

const AUTH_IS_OWNER = 'olitech_is_owner'

export function parseJwtPayload(token) {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function getIsOwnerFlag() {
  return sessionStorage.getItem(AUTH_IS_OWNER) === 'true'
}

export function setIsOwnerFlag(value) {
  if (value) {
    sessionStorage.setItem(AUTH_IS_OWNER, 'true')
  } else {
    sessionStorage.removeItem(AUTH_IS_OWNER)
  }
}

export function clearIsOwnerFlag() {
  sessionStorage.removeItem(AUTH_IS_OWNER)
}

/** True when this user should see Admin/Manager Dashboard on POS */
export function shouldShowAdminDashboard(session, context) {
  if (!session?.token) return false

  const jwt = parseJwtPayload(session.token)
  const role = jwt?.role || session.role
  if (role === 'SHOP_ADMIN' || role === 'MANAGER') return true
  if (getIsOwnerFlag()) return true

  const ctx = context || getCachedShopContext(session.tenantId)
  if (ctx?.isOwner) return true

  const ownerEmail = ctx?.ownerEmail?.trim().toLowerCase()
  const userEmail = session.email?.trim().toLowerCase()
  if (ownerEmail && userEmail && ownerEmail === userEmail) return true

  return false
}

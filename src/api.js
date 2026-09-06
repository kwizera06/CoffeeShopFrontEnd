import { clearCachedShopContext, getCachedShopContext, setCachedShopContext } from './utils/shopContextCache.js'
import { clearIsOwnerFlag, parseJwtPayload, setIsOwnerFlag } from './utils/adminAccess.js'

const AUTH = {
  token: 'olitech_auth_token',
  role: 'olitech_auth_role',
  tenantId: 'olitech_tenant_id',
  name: 'olitech_auth_name',
  email: 'olitech_auth_email',
}

export function getToken() {
  return sessionStorage.getItem(AUTH.token)
}

export function getSession() {
  const token = sessionStorage.getItem(AUTH.token)
  const storedRole = sessionStorage.getItem(AUTH.role)
  const jwtRole = parseJwtPayload(token)?.role
  const role = jwtRole || storedRole
  if (jwtRole && jwtRole !== storedRole) {
    sessionStorage.setItem(AUTH.role, jwtRole)
  }
  return {
    token,
    role,
    tenantId: sessionStorage.getItem(AUTH.tenantId),
    name: sessionStorage.getItem(AUTH.name),
    email: sessionStorage.getItem(AUTH.email),
  }
}

export function setSession({ token, role, tenantId, name, email, isOwner }) {
  const prevTenant = sessionStorage.getItem(AUTH.tenantId)
  if (prevTenant && tenantId && prevTenant !== tenantId) {
    clearCachedShopContext()
  }
  sessionStorage.setItem(AUTH.token, token)
  sessionStorage.setItem(AUTH.role, role)
  if (tenantId) {
    sessionStorage.setItem(AUTH.tenantId, tenantId)
  } else {
    sessionStorage.removeItem(AUTH.tenantId)
  }
  sessionStorage.setItem(AUTH.name, name ?? '')
  sessionStorage.setItem(AUTH.email, email ?? '')
  if (isOwner || role === 'SHOP_ADMIN') {
    setIsOwnerFlag(true)
  } else if (role !== 'MANAGER') {
    clearIsOwnerFlag()
  }
}

export function clearSession() {
  sessionStorage.removeItem(AUTH.token)
  sessionStorage.removeItem(AUTH.role)
  sessionStorage.removeItem(AUTH.tenantId)
  sessionStorage.removeItem(AUTH.name)
  sessionStorage.removeItem(AUTH.email)
  clearCachedShopContext()
  clearIsOwnerFlag()
}

async function parseError(res) {
  try {
    const j = await res.json()
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If a specific URL is set in .env, use it
  if (envUrl && envUrl !== 'http://localhost:8081') {
    return envUrl;
  }
  
  // By returning an empty string, the frontend will make relative requests
  // (e.g. /api/shop/...) which will inherently use the exact same hostname and port
  // that the frontend was loaded from (like a localtunnel URL or local Vite server)
  // Vite's built-in proxy handles forwarding these from 5174 to 8081 locally.
  return '';
};

const BASE_URL = getBaseUrl();

/**
 * Core API call with mobile-friendly timeouts and automatic retry on transient network failures.
 * 
 * Mobile connections (3G/4G/WiFi) can drop briefly. One automatic retry prevents users
 * from seeing false "Network error" failures when the device momentarily loses signal.
 * We only retry on network-level failures (TypeError "Failed to fetch"), NOT on HTTP errors
 * (4xx/5xx) which should be surfaced immediately to the user.
 */
export async function api(path, options = {}, _retryCount = 1) {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  // Ensure we don't double up on /api/ if path already includes it
  const fullPath = path.startsWith('http') ? path : `${BASE_URL}${path}`
  
  // Mobile-friendly timeout handling: Extended to 60s (POST/PUT) and 30s (GET/DELETE)
  // to accommodate slower mobile 3G/4G networks without falsely timing out.
  const timeout = (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH') ? 60000 : 30000
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const res = await fetch(fullPath, { ...options, headers, signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (res.status === 401) {
      clearSession()
    }
    if (!res.ok) {
      const msg = await parseError(res)
      const err = new Error(msg || `Request failed (${res.status})`)
      err.status = res.status
      throw err
    }
    if (res.status === 204) {
      return null
    }
    const text = await res.text()
    if (!text) return null;
    try {
      const data = JSON.parse(text)
      const pathOnly = path.split('?')[0]
      if (pathOnly === '/api/shop/context' && data?.name) {
        const tenantId = getSession().tenantId
        if (tenantId) setCachedShopContext(tenantId, data)
      }
      return data
    } catch {
      return text
    }
  } catch (e) {
    clearTimeout(timeoutId)
    
    if (e.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout/1000}s - check your network connection`)
    }
    
    // Retry once on transient network failures (mobile connection drops)
    if (e instanceof TypeError && e.message.includes('Failed to fetch') && _retryCount > 0) {
      console.warn(`[API] Network error on ${path}, retrying in 1.5s... (${_retryCount} attempt left)`)
      await new Promise(resolve => setTimeout(resolve, 1500))
      return api(path, options, _retryCount - 1)
    }
    
    if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again')
    }
    throw e
  }
}

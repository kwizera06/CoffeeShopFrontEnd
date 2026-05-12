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
  return {
    token: sessionStorage.getItem(AUTH.token),
    role: sessionStorage.getItem(AUTH.role),
    tenantId: sessionStorage.getItem(AUTH.tenantId),
    name: sessionStorage.getItem(AUTH.name),
    email: sessionStorage.getItem(AUTH.email),
  }
}

export function setSession({ token, role, tenantId, name, email }) {
  sessionStorage.setItem(AUTH.token, token)
  sessionStorage.setItem(AUTH.role, role)
  if (tenantId) {
    sessionStorage.setItem(AUTH.tenantId, tenantId)
  } else {
    sessionStorage.removeItem(AUTH.tenantId)
  }
  sessionStorage.setItem(AUTH.name, name ?? '')
  sessionStorage.setItem(AUTH.email, email ?? '')
}

export function clearSession() {
  sessionStorage.removeItem(AUTH.token)
  sessionStorage.removeItem(AUTH.role)
  sessionStorage.removeItem(AUTH.tenantId)
  sessionStorage.removeItem(AUTH.name)
  sessionStorage.removeItem(AUTH.email)
}

async function parseError(res) {
  try {
    const j = await res.json()
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
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
  
  const res = await fetch(fullPath, { ...options, headers })
  if (res.status === 401) {
    clearSession()
  }
  if (!res.ok) {
    const msg = await parseError(res)
    throw new Error(msg || 'Request failed')
  }
  if (res.status === 204) {
    return null
  }
  const text = await res.text()
  if (!text) return null;
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

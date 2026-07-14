/** Tabs managers can access (subset of owner dashboard) */
export const MANAGER_TABS = ['overview', 'reports', 'eod', 'stock', 'loans']

/** Tabs auditors can access (read-only subset) */
export const AUDITOR_TABS = ['overview', 'reports', 'eod', 'stock', 'loans', 'audit']

export function isOwnerRole(role) {
  return role === 'SHOP_ADMIN'
}

export function isManagerRole(role) {
  return role === 'MANAGER'
}

export function isAuditorRole(role) {
  return role === 'AUDITOR'
}

export function canAccessDashboard(role) {
  return isOwnerRole(role) || isManagerRole(role) || isAuditorRole(role)
}

export function canAccessTab(role, tab) {
  if (isOwnerRole(role)) return true
  if (isManagerRole(role)) return MANAGER_TABS.includes(tab)
  if (isAuditorRole(role)) return AUDITOR_TABS.includes(tab)
  return false
}

export function getDashboardLabel(role) {
  if (isManagerRole(role)) return 'Manager Dashboard'
  if (isAuditorRole(role)) return 'Auditor Dashboard'
  return 'Admin Dashboard'
}

export function staffRoleLabel(role) {
  if (role === 'SHOP_ADMIN') return 'Owner'
  if (role === 'MANAGER') return 'Manager'
  if (role === 'AUDITOR') return 'Auditor'
  if (role === 'WAITER') return 'Waiter'
  if (role === 'CASHIER') return 'Cashier'
  if (role === 'CHEF') return 'Chef'
  return role
}

export function staffRoleStyle(role) {
  if (role === 'SHOP_ADMIN') return { bg: 'rgba(230, 204, 178, 0.1)', color: '#1D3557', border: '#1D355744' }
  if (role === 'MANAGER') return { bg: 'rgba(156, 39, 176, 0.1)', color: '#7B1FA2', border: '#9C27B044' }
  if (role === 'AUDITOR') return { bg: 'rgba(0, 188, 212, 0.1)', color: '#00838F', border: '#00BCD444' }
  if (role === 'WAITER') return { bg: 'rgba(76, 175, 80, 0.1)', color: '#2E7D32', border: '#4CAF5044' }
  if (role === 'CASHIER') return { bg: 'rgba(33, 150, 243, 0.1)', color: '#2196F3', border: '#2196F344' }
  return { bg: 'rgba(158, 158, 158, 0.1)', color: '#616161', border: '#9E9E9E44' }
}

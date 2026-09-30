# POS Routing Refactor - Implementation Notes

## Architecture Changes

### Before
```
/app/cashier (Single route with query params)
  └─ Tab state managed via useSearchParams()
  └─ URL: /app/cashier?tab=pending
  └─ No lazy loading
  └─ CashierDashboard renders all tabs internally
```

### After
```
/app/pos (Layout route with ShopProvider wrapper)
  ├─ /app/pos/new-order (PosNewOrder lazy component)
  ├─ /app/pos/pending (PosPending lazy component)
  ├─ /app/pos/awaiting-payment (PosAwaitingPayment lazy component)
  ├─ /app/pos/record-production (PosRecordProduction lazy component)
  ├─ /app/pos/history (PosHistory lazy component)
  └─ /app/pos/loans (PosLoans lazy component)
```

---

## Key Implementation Details

### 1. PosLayout Component Structure

The `PosLayout` component mirrors the `AdminLayout` design:

```jsx
export default function PosLayout() {
  // Role-based access check
  // Ensures only CASHIER, CHEF, WAITER, MANAGER, SHOP_ADMIN can access
  
  // useShopContext() for context data
  // ShiftManager integration
  
  // NavLink-based navigation (no query params)
  // Mobile-responsive sidebar
  // Logout button
}
```

**Critical**: `PosLayout` is wrapped with `ShopProvider` in the router:
```jsx
{
  path: '/app/pos',
  element: (
    <ProtectedRoute requiredRoles={['CASHIER', 'CHEF', 'WAITER', 'MANAGER', 'SHOP_ADMIN']}>
      <ShopProvider>
        <PosLayout />
      </ShopProvider>
    </ProtectedRoute>
  ),
  // ... children routes
}
```

This ensures `CashierDashboard` (which calls `useShopContext()`) has the provider available.

---

### 2. CashierDashboard Adapter Pattern

The `CashierDashboard` component now accepts an `initialTab` prop:

```jsx
export default function CashierDashboard({ initialTab = null }) {
  // ... setup code ...
  
  const [searchParams, setSearchParams] = useSearchParams()
  // Priority: initialTab (from new routes) > query param (backward compat) > default
  const tab = initialTab || searchParams.get('tab') || 'new'
}
```

**Why this approach?**
- Avoids duplicating 2000+ lines of CashierDashboard logic
- Maintains backward compatibility with old query param URLs
- Allows gradual migration if needed
- Single source of truth for POS functionality

**The page wrappers** (e.g., `PosNewOrder.jsx`):
```jsx
export default function PosNewOrder() {
  usePageTitle('New Order')  // Sets browser title
  return <CashierDashboard initialTab="new" />  // Force specific tab
}
```

---

### 3. Role Hierarchy Implementation

The enhanced `ProtectedRoute` now supports role inheritance:

```jsx
const canAccess = requiredRoles.includes(session.role) ||
  // SHOP_ADMIN can access routes that allow MANAGER or CASHIER
  (session.role === 'SHOP_ADMIN' && 
    (requiredRoles.includes('MANAGER') || 
     requiredRoles.includes('CASHIER') || 
     requiredRoles.includes('CHEF')))
```

**This enables**:
- SHOP_ADMIN (Owner) to view Record Production (CASHIER page)
- SHOP_ADMIN to access admin features through Manager routes
- Role hierarchy without hardcoding permissions everywhere

---

### 4. Backward Compatibility Strategy

#### Approach 1: Query Param Fallback
The `CashierDashboard` still reads `?tab=` for backward compatibility.

#### Approach 2: Redirect Component
The `LegacyPosRedirect` component automatically converts old URLs:
```jsx
// User visits: /app/cashier?tab=pending
// LegacyPosRedirect redirects to: /app/pos/pending
const tabMap = {
  new: '/app/pos/new-order',
  pending: '/app/pos/pending',
  // ...
}
```

#### Approach 3: Route Alias
The old `/app/cashier` route now renders `LegacyPosRedirect`:
```jsx
{
  path: 'cashier',  // Under /app
  element: <LegacyPosRedirect />,  // Redirects to /app/pos
}
```

**Result**: All old bookmarks and links still work.

---

## Router Configuration

### Complete POS Route Tree
```jsx
{
  path: '/app/pos',
  element: (
    <ProtectedRoute requiredRoles={['CASHIER', 'CHEF', 'WAITER', 'MANAGER', 'SHOP_ADMIN']}>
      <ShopProvider>
        <PosLayout />
      </ShopProvider>
    </ProtectedRoute>
  ),
  children: [
    { index: true, element: <Navigate to="/app/pos/new-order" replace /> },
    { path: 'new-order', element: <Suspense><PosNewOrder /></Suspense> },
    { path: 'pending', element: <Suspense><PosPending /></Suspense> },
    { path: 'awaiting-payment', element: <Suspense><PosAwaitingPayment /></Suspense> },
    { path: 'record-production', element: <Suspense><PosRecordProduction /></Suspense> },
    { path: 'history', element: <Suspense><PosHistory /></Suspense> },
    { path: 'loans', element: <Suspense><PosLoans /></Suspense> },
  ],
}
```

**Key Points**:
- Each route is wrapped in `<Suspense>` with `LoadingFallback`
- Each page component is lazy-loaded via `React.lazy()`
- All routes are children of `/app/pos` (single parent layout)
- `ProtectedRoute` guards the entire `/app/pos` tree

---

## Migration Path from Query Params

For users coming from old URLs:

1. **Initial Request**: `/app/cashier?tab=pending`
2. **Router Match**: Matches `/app/cashier` route
3. **Component Render**: `LegacyPosRedirect` checks query params
4. **Tab Map**: `pending` → `/app/pos/pending`
5. **Navigate**: `<Navigate to="/app/pos/pending" replace />`
6. **Final Route**: User sees `/app/pos/pending`

---

## Testing Scenarios

### Scenario 1: OWNER (SHOP_ADMIN) Access to POS
```
Login as OWNER
  ↓ Redirected to /app/admin/overview
  ↓ Click POS button
  ↓ Navigates to /app/pos/new-order
  ↓ Can view Record Production (requires SHOP_ADMIN → CASHIER role inheritance)
  ✅ Works due to role hierarchy in ProtectedRoute
```

### Scenario 2: CASHIER Access with Old URL
```
User has old bookmark: /app/cashier?tab=production
  ↓ Navigate to /app/cashier?tab=production
  ↓ Route matches /app/cashier
  ↓ LegacyPosRedirect component renders
  ↓ Detects tab=production in query params
  ↓ Redirects to /app/pos/record-production (replace: true)
  ✅ User sees new URL and page loads
```

### Scenario 3: Deep Link on Page Refresh
```
User is on /app/pos/pending and presses F5
  ↓ React Router matches /app/pos/pending
  ↓ PosLayout renders with proper context
  ↓ PosPending component renders with initialTab="pending"
  ↓ CashierDashboard shows pending tab
  ✅ State preserved correctly
```

### Scenario 4: CASHIER Tries to Access Admin
```
Login as CASHIER
  ↓ Navigate to /app/admin/overview
  ↓ ProtectedRoute checks requiredRoles: ['SHOP_ADMIN', 'MANAGER', 'AUDITOR']
  ↓ CASHIER not in list, and CASHIER != SHOP_ADMIN
  ↓ Redirect to /app/pos/new-order (fallback for CASHIER role)
  ✅ Access denied, user redirected
```

---

## CSS & Styling

No new CSS was created. The refactor reuses existing styles:
- `PosLayout` uses `.shop-app-modern` classes (same as AdminLayout)
- Tab styling uses existing `.modern-tab` and `.am-nav-link` classes
- Mobile responsiveness uses existing media queries
- Visual design is completely preserved

---

## Performance Metrics

### Bundle Size
```
Before: All routes in single chunk
After:  Route-specific chunks created:
  - PosNewOrder chunk: 0.18 kB (gzipped)
  - PosPending chunk: 0.16 kB (gzipped)
  - PosAwaitingPayment chunk: 0.16 kB (gzipped)
  - PosRecordProduction chunk: 0.16 kB (gzipped)
  - PosHistory chunk: 0.16 kB (gzipped)
  - PosLoans chunk: 0.15 kB (gzipped)

Total impact: ~0.97 kB gzipped for all POS pages
```

### Loading Time
```
First visit to /app/pos/new-order:
  1. Load PosLayout + parent routes
  2. Lazy-load PosNewOrder component (0.18 kB)
  3. Render CashierDashboard with initialTab="new"

Subsequent navigation (same page context):
  - Instant (components already in memory)
  - NavLink rendering only UI changes

Navigation to different POS page:
  - Minimal re-render (PosLayout reuses, only Outlet content changes)
  - Could lazy-load new PosXxx component (if not cached)
```

---

## Known Limitations & Trade-offs

### 1. Tab State Not Preserved Across Pages
**Current Behavior**: Each POS page is stateless
```jsx
// This will lose cart state if user navigates away
navigate('/app/pos/pending')  // Cart state cleared
navigate('/app/pos/new-order')  // Back to new order
```

**Reason**: CashierDashboard manages state internally per tab
**Solution**: Could store state in React Query or Zustand if needed
**Status**: Not required for current implementation

### 2. `setTab()` Function Removed
**What Happened**: Old tab switching logic via `setSearchParams()` no longer used
**Why**: NavLink handles routing instead of state updates
**Impact**: Tab switching is now routing (requires page transition)
**Benefit**: Browser history works correctly (back button works)

### 3. Warehouse Tab Merged with Pending
**Current**: `/app/cashier?tab=warehouse` → `/app/pos/pending`
**Reason**: Warehouse requests are part of pending order management
**Alternative**: Could create separate `/app/pos/warehouse` if needed

### 4. PIN Gate for Awaiting Payment
**Current**: Still implemented in CashierDashboard
**How**: PIN check happens when switching to `tab === 'ready'`
**Note**: PIN logic works even with `initialTab="ready"` due to use effect

---

## Potential Issues & Solutions

### Issue: Context Missing Provider
**Symptom**: "wrapProvider Context missing provider" error
**Root Cause**: Layout component calls `useShopContext()` without `ShopProvider`
**Solution**: Wrap `PosLayout` with `ShopProvider` in router ✅ (Already done)

### Issue: Recursive Redirects
**Symptom**: Infinite loop of redirects
**Example**: `/app/cashier` → `LegacyPosRedirect` → `/app/pos` → back to `/app/cashier`
**Prevention**: Use `replace: true` in Navigate components ✅ (Already done)

### Issue: Role Hierarchy Not Working
**Symptom**: SHOP_ADMIN cannot access CASHIER pages
**Root Cause**: Simple array.includes() check without role inheritance
**Solution**: Added role hierarchy logic in ProtectedRoute ✅ (Already done)

### Issue: Mobile Navigation
**Symptom**: NavLinks don't close sidebar on click
**Solution**: `onClick={() => setSidebarOpen(false)}` on each NavLink ✅ (Already done)

---

## Maintenance Guide

### Adding a New POS Tab

1. **Create Page Component**:
   ```jsx
   // src/pages/shop/PosNewTab.jsx
   import { usePageTitle } from '../../hooks/usePageTitle'
   import CashierDashboard from './CashierDashboard'
   
   export default function PosNewTab() {
     usePageTitle('New Tab Title')
     return <CashierDashboard initialTab="newtab" />
   }
   ```

2. **Update Router**:
   ```jsx
   // In src/router.jsx
   const PosNewTab = lazy(() => import('./pages/shop/PosNewTab.jsx'))
   
   // Add to children:
   {
     path: 'new-tab',
     element: <Suspense fallback={<LoadingFallback />}>
       <PosNewTab />
     </Suspense>,
   }
   ```

3. **Update PosLayout**:
   ```jsx
   const POS_NAV_ITEMS = [
     // ... existing items ...
     { path: '/app/pos/new-tab', label: '📋 New Tab', showBadge: false },
   ]
   ```

4. **Add Legacy Redirect** (in `LegacyPosRedirect.jsx`):
   ```jsx
   const tabMap = {
     // ... existing maps ...
     newtab: '/app/pos/new-tab',
   }
   ```

---

## Browser DevTools Debugging

### React DevTools
1. Open `/app/pos/pending`
2. Inspect React component tree
3. You'll see:
   ```
   <PosLayout>
     <Outlet context={{setSidebarOpen}}>
       <PosPending>
         <CashierDashboard initialTab="pending" />
       </PosPending>
     </Outlet>
   </PosLayout>
   ```

### Network Tab
1. Navigate between POS pages
2. Lazy-loaded chunks appear as new requests
3. Each chunk is ~0.15-0.18 kB
4. No wasteful re-downloads of CashierDashboard logic

### localStorage
The `useSearchParams` for backward compat stores cart state in URL:
```
URL: /app/pos/new-order?edit=order123
→ Editing existing order
```

---

## Deployment Checklist

- [ ] Build completes without errors: `npm run build`
- [ ] No console warnings (except size warnings)
- [ ] Dev server starts: `npm run dev`
- [ ] All routes accessible from `/app/pos`
- [ ] Old `/app/cashier` URLs redirect correctly
- [ ] SPA fallback configured on host (vercel.json, _redirects, etc.)
- [ ] Deep links work on page refresh
- [ ] Roles redirected correctly
- [ ] Mobile navigation works
- [ ] Logout works from POS pages

---

## References

- React Router v6: https://reactrouter.com/
- Code Splitting: https://reactrouter.com/en/main/components/Suspense
- Role-Based Access: See `src/components/ProtectedRoute.jsx`
- Hook Usage: See `src/hooks/usePageTitle.js`

---

**Document Version**: 1.0
**Last Updated**: 2025-07-16
**Status**: Complete - Ready for Testing ✅

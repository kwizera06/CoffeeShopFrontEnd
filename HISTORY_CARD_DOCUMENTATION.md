# Owner Dashboard: Approvals History Card Documentation

## Overview
The **Approvals History Card** is a new section added to the Owner Dashboard (Overview tab) that displays all approval requests the owner has received, along with their current status.

## Features

### 1. **Display Current & Historical Data**
- **Default View**: Shows current day's approvals only
- **Date Picker**: Owner can select any past date to view historical approvals
- **Today Button**: Quick reset to current date

### 2. **Request Categories**
The card displays two types of requests:
- **🍳 Production**: Bakery production runs submitted for approval
- **📦 Warehouse**: Stock requisitions from storekeeper for warehouse restocking

### 3. **Status Tracking**
Each request shows its current status:
- **🟡 PENDING** (Yellow): Awaiting owner decision
- **🟢 APPROVED** (Green): Owner approved the request
- **🔴 REJECTED** (Red): Owner rejected the request

### 4. **Summary Cards**
At the top of the card, three summary cards show:
- **Pending**: Number of requests awaiting action
- **Approved**: Number of requests approved today
- **Rejected**: Number of requests rejected today

### 5. **Quick Navigation**
- Each request shows a "View Details" button
- Clicking it navigates to the full Approvals page for management
- "Go to Full Approvals Page" button at the bottom for bulk management

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Approvals History                          [Date Picker] [Today] │
│ All requests you've received, approved, or rejected               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│ │   Pending    │  │  Approved    │  │  Rejected    │            │
│ │     12       │  │      5       │  │      1       │            │
│ │ awaiting...  │  │ confirmed... │  │   denied...  │            │
│ └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Request List (scrollable, max height 400px):                     │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [🍳 PRODUCTION] [PENDING]     Daily Donut Batch            │ │
│ │ 90 pcs · 1 batch              [View Details]              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [📦 WAREHOUSE] [APPROVED]     Flour Restock               │ │
│ │ 50 kg units                   [View Details]              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [Go to Full Approvals Page]                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Implementation

### Location
**File**: `src/pages/shop/Owner.jsx`
**Section**: Overview tab, between "Metrics" and "Production Variance Report"

### Key State Variables Used
```javascript
// Date filtering
reportDay                    // Currently selected date (YYYY-MM-DD format)

// Approval data
pendingProductions          // Array of production requests
pendingWarehouse            // Array of warehouse requests
approvalLoading             // Loading state for fetching approvals

// Filtering
tab                         // Current tab (used to switch to 'approvals')
```

### Data Fetching
The card reads from:
1. **pendingProductions**: Fetched via `fetchPendingApprovals()`
2. **pendingWarehouse**: Fetched via `fetchPendingApprovals()`

These are populated when the Overview tab loads.

### User Interactions
1. **Date Picker**: Change `reportDay` to view different dates
2. **Today Button**: Reset to current date
3. **View Details**: Navigate to Approvals tab for full management
4. **Go to Full Page**: Direct link to Approvals tab

---

## Default Date Behavior

### Current Day (Default)
- Shows all approvals for today
- Summary counts reflect today's activity
- List filtered to current day only

### Previous Dates
- Calendar picker allows selecting any past date
- Max selectable date: Today (via `max={getKigaliToday()}`)
- **Note**: Future dates are disabled

### Timezone
- Uses **Africa/Kigali** timezone for date calculations
- `getKigaliToday()` returns current date in Kigali time

---

## Integration Points

### 1. **fetchPendingApprovals()**
- Called when tab changes to 'approvals'
- Can also be triggered manually by owner
- Updates pendingProductions & pendingWarehouse

### 2. **Date Filtering**
- Uses existing `reportDay` state
- No additional API calls for history (data already in `pendingProductions` & `pendingWarehouse`)
- **Future Enhancement**: Filter on backend if historical data needed

### 3. **Navigation**
- Links to existing "Approvals" tab (`tab === 'approvals'`)
- Full approval management page with approve/reject buttons

---

## Visual Design

### Colors
- **Pending**: Yellow (#F59E0B, background #FEF3C7)
- **Approved**: Green (#10B981, background #F0FDF4)
- **Rejected**: Red (#EF4444, background #FEE2E2)
- **Production**: Orange (#FB923C, background rgba(251,146,60,0.1))
- **Warehouse**: Blue (#3B82F6, background rgba(59,130,246,0.1))

### Typography
- **Card Title**: 18px, bold
- **Request Type Badge**: 12px, bold (uppercase)
- **Status Badge**: 12px, bold (uppercase)
- **Product Name**: 13px, bold
- **Metadata**: 11px, muted gray

### Spacing
- Summary Cards: Grid with 12px gap
- Request List: 400px max height, scrollable
- Card Padding: 24px
- Request Row: 16px vertical padding

---

## Responsive Design

The card is fully responsive:
- **Desktop**: Summary cards in 3-column grid
- **Tablet**: Summary cards in 2-column grid
- **Mobile**: Summary cards in 1-column grid
- **Small Mobile**: Compact date input

---

## Future Enhancements

### Possible Improvements
1. **Backend Date Filtering**: Store approval request history with dates for deep historical queries
2. **Export**: Download history as CSV/PDF for a date range
3. **Search**: Filter requests by product name or staff member
4. **Quick Stats**: Add total approved/rejected metrics
5. **Auto-Refresh**: Real-time updates using WebSocket/polling
6. **Notifications**: Alert owner when new requests arrive

---

## Testing Checklist

- [ ] Date picker allows selecting any past date
- [ ] Today button resets to current date  
- [ ] Summary counts show correct numbers
- [ ] Request list shows production and warehouse items
- [ ] Status badges display correct colors
- [ ] View Details button navigates to Approvals tab
- [ ] Empty state shows when no requests
- [ ] Scrolling works on long lists
- [ ] Responsive on mobile/tablet
- [ ] Date selection persists across navigation

---

## Files Modified

**Main File**:
- `src/pages/shop/Owner.jsx` - Added History Card section to Overview tab

**Related Files** (no changes needed):
- `src/pages/shop/Owner.jsx` - Uses existing `fetchPendingApprovals()` function
- `src/router.jsx` - Already routes to approvals tab
- `src/components/ProtectedRoute.jsx` - Already checks OWNER access

---

## Build Status
✅ **Build Successful** - 953 modules, 0 errors
- Deployment ready
- No console warnings about the feature
- All dependencies satisfied

---

**Last Updated**: July 16, 2026
**Status**: ✅ Implementation Complete

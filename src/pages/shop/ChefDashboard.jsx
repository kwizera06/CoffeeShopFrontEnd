import { useState, useEffect, useCallback } from 'react'
import { api, getSession, clearSession } from '../../api'
import { supabase } from '../../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  HiOutlineClock,
  HiOutlineCube
} from 'react-icons/hi2'

export default function ChefDashboard() {
  const { role } = getSession()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [warehouseError, setWarehouseError] = useState('')

  // Warehouse state
  const [warehouseRequests, setWarehouseRequests] = useState([])
  const [warehouseInventory, setWarehouseInventory] = useState([])
  const [newWarehouseRequest, setNewWarehouseRequest] = useState({ productId: '', quantity: '', notes: '' })

  const allowed = role === 'CHEF'

  const loadWarehouseInventory = useCallback(async () => {
    try {
      const data = await api('/api/shop/warehouse/inventory')
      setWarehouseInventory(data)
    } catch (e) {
      setWarehouseError(e.message || 'Failed to load inventory')
    }
  }, [])

  // Load chef's warehouse requests
  const loadWarehouseRequests = useCallback(async () => {
    setWarehouseLoading(true)
    try {
      const reqs = await api('/api/shop/warehouse/requests')
      setWarehouseRequests(reqs)
      setWarehouseError('')
    } catch (e) {
      setWarehouseError(e.message || 'Failed to load requests')
    } finally {
      setWarehouseLoading(false)
    }
  }, [])

  // Create a new warehouse request
  const handleCreateWarehouseRequest = useCallback(async (e) => {
    e.preventDefault()
    if (!newWarehouseRequest.productId || !newWarehouseRequest.quantity) {
      setWarehouseError('Product and quantity required')
      return
    }
    
    setBusy(true)
    try {
      const selectedItem = warehouseInventory.find(i => i.productId === newWarehouseRequest.productId)
      
      await api('/api/shop/warehouse/requests', {
        method: 'POST',
        body: JSON.stringify({
          productId: newWarehouseRequest.productId,
          itemType: selectedItem ? selectedItem.itemType : 'MENU_ITEM',
          quantity: parseFloat(newWarehouseRequest.quantity),
          notes: newWarehouseRequest.notes
        })
      })
      setNewWarehouseRequest({ productId: '', quantity: '', notes: '' })
      setWarehouseError('')
      await loadWarehouseRequests()
    } catch (e) {
      setWarehouseError(e.message || 'Failed to create request')
    } finally {
      setBusy(false)
    }
  }, [newWarehouseRequest, loadWarehouseRequests])

  // Load warehouse data on mount
  useEffect(() => {
    if (!allowed) return
    void loadWarehouseInventory()
    void loadWarehouseRequests()
  }, [allowed, loadWarehouseInventory, loadWarehouseRequests])

  if (!allowed) return <div style={{ padding: 40, textAlign: 'center', fontSize: 24 }}>Unauthorized.</div>

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#F3F4F6', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1F2937', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <HiOutlineCube size={28} color="#60A5FA" />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Store Requests</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
             <Clock />
          </div>
          <button 
             onClick={handleLogout}
             style={{ background: '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ padding: 24, flex: 1, overflowY: 'auto', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 22, fontWeight: 700 }}>Request Items from Store</h2>

        {warehouseError && <div style={{ background: '#7F1D1D', color: '#FECACA', padding: 12, borderRadius: 8, marginBottom: 20 }}>{warehouseError}</div>}

        {/* New Request Form */}
        <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>New Request</h3>
          <form onSubmit={handleCreateWarehouseRequest} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#9CA3AF' }}>Product</label>
                <select
                  value={newWarehouseRequest.productId}
                  onChange={(e) => setNewWarehouseRequest(prev => ({ ...prev, productId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#111827',
                    color: '#F3F4F6',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    fontSize: 13
                  }}
                >
                  <option value="">Select product...</option>
                  {warehouseInventory.map(inv => (
                    <option key={inv.productId} value={inv.productId}>
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#9CA3AF' }}>Qty</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newWarehouseRequest.quantity}
                  onChange={(e) => setNewWarehouseRequest(prev => ({ ...prev, quantity: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#111827',
                    color: '#F3F4F6',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    fontSize: 13
                  }}
                  placeholder="Amount"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#9CA3AF' }}>Notes</label>
                <input
                  type="text"
                  value={newWarehouseRequest.notes}
                  onChange={(e) => setNewWarehouseRequest(prev => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#111827',
                    color: '#F3F4F6',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    fontSize: 13
                  }}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || warehouseLoading}
              style={{
                padding: '10px 16px',
                background: '#60A5FA',
                color: '#111827',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: busy || warehouseLoading ? 0.6 : 1
              }}
            >
              Submit Request
            </button>
          </form>
        </div>

        {/* My Requests */}
        <h3 style={{ marginTop: 24, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>My Requests</h3>
        {warehouseLoading ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
        ) : warehouseRequests.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>No requests yet</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {warehouseRequests.map(req => (
              <div
                key={req.id}
                style={{
                  background: req.status === 'COMPLETED' ? '#FEF3C7' : '#1F2937',
                  border: `1px solid ${req.status === 'COMPLETED' ? '#F59E0B' : req.status === 'FULFILLED' ? '#34D399' : '#F59E0B'}`,
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: req.status === 'COMPLETED' ? '#92400E' : '#F3F4F6' }}>
                    {req.productName}
                  </div>
                  <div style={{ fontSize: 12, color: req.status === 'COMPLETED' ? '#92400E' : '#9CA3AF', marginTop: 4 }}>
                    Quantity: {req.quantity} | Status: <span style={{ fontWeight: 600, color: req.status === 'COMPLETED' ? '#F59E0B' : req.status === 'FULFILLED' ? '#34D399' : '#F59E0B' }}>
                      {req.status === 'COMPLETED' ? 'READY FOR PICKUP' : req.status}
                    </span>
                  </div>
                  {req.notes && (
                    <div style={{ fontSize: 12, color: req.status === 'COMPLETED' ? '#92400E' : '#6B7280', marginTop: 4 }}>
                      Notes: {req.notes}
                    </div>
                  )}
                </div>
                {req.status === 'COMPLETED' && (
                  <button
                    onClick={async () => {
                      try {
                        await api(`/api/shop/warehouse/requests/${req.transferId}/receive`, { method: 'PUT' })
                        setError('')
                        await loadWarehouseRequests()
                      } catch (e) {
                        setError(e.message || 'Failed to confirm receipt')
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#10B981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ✓ Confirm Receipt
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
  useEffect(() => {
     const int = setInterval(() => setTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})), 60000)
     return () => clearInterval(int)
  }, [])
  return <div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><HiOutlineClock /> {time}</div>
}

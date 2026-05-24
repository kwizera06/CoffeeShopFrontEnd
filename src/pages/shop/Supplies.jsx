import { useState, useEffect, useCallback } from 'react'
import { api, getSession } from '../../api'
import { supabase } from '../../supabaseClient'
import './OwnerModern.css'

export default function Supplies() {
  const { role } = getSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  
  // Requisitions
  const [supplyItems, setSupplyItems] = useState([])
  const [newSupply, setNewSupply] = useState({ name: '', quantity: '', unit: 'pcs', price: '' })
  const [supplyNotes, setSupplyNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const allowed = role === 'CASHIER' || role === 'SHOP_ADMIN' || role === 'WAITER'

  const [requisitions, setRequisitions] = useState([])
  
  function addSupplyItem() {
    if (!newSupply.name || !newSupply.quantity) return
    setSupplyItems([...supplyItems, { ...newSupply }])
    setNewSupply({ name: '', quantity: '', unit: 'pcs', price: '' })
  }
  
  const loadRequisitions = useCallback(async () => {
    try {
      const data = await api('/api/shop/requisitions')
      setRequisitions(data)
    } catch(e) { /* ignore silent */ }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void loadRequisitions()

    if (!supabase) return
    const channel = supabase
      .channel('staff-requisitions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requisitions',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void loadRequisitions().catch(() => {})
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Supplies page subscribed to requisition changes')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, loadRequisitions])

  async function submitRequisition() {
    if (supplyItems.length === 0) return
    setBusy(true)
    setError('')
    setSuccess(false)
    try {
      await api('/api/shop/requisitions', {
        method: 'POST',
        body: JSON.stringify({ items: supplyItems, notes: supplyNotes })
      })
      setSupplyItems([])
      setSupplyNotes('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
      void loadRequisitions()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) return <div className="owner-modern-page"><p style={{ color: '#FF5252' }}>Unauthorized</p></div>

  return (
    <div className="owner-modern-page am-animate" style={{ minHeight: 'auto' }}>
      <header className="am-header">
        <div className="am-title">
          <h1>Shop Supplies</h1>
          <p>Request items needed for the coffee shop</p>
        </div>
      </header>

      {error ? <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#FF5252', padding: '10px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{error}</div> : null}
      {success ? (
        <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', color: '#4CAF50', padding: '12px 16px', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
          ✅ Request sent to Admin successfully!
        </div>
      ) : null}

      <div className="am-chart-card">
        <h3 style={{ marginBottom: 8, fontSize: 16 }}>New Supply Request</h3>
        <p style={{ color: '#A0A0A0', fontSize: 12, marginBottom: 20 }}>Add items to your list and submit to notify admin.</p>
        
        <div className="supplies-form-row">
          <label className="am-field" style={{ flex: 2 }}>
            <span>Item Name</span>
            <input 
              className="am-input"
              type="text" 
              placeholder="e.g. Milk, Sugar" 
              value={newSupply.name} 
              onChange={e => setNewSupply({...newSupply, name: e.target.value})} 
            />
          </label>
          <label className="am-field" style={{ flex: 1 }}>
            <span>Qty</span>
            <input 
              className="am-input"
              type="number" 
              placeholder="0" 
              value={newSupply.quantity} 
              onChange={e => setNewSupply({...newSupply, quantity: e.target.value})} 
            />
          </label>
          <label className="am-field" style={{ flex: 1 }}>
            <span>Unit</span>
            <input 
              className="am-input"
              type="text" 
              placeholder="pcs, kg" 
              value={newSupply.unit} 
              onChange={e => setNewSupply({...newSupply, unit: e.target.value})} 
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={addSupplyItem} style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', color: '#4CAF50', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', height: 42, whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>

        {supplyItems.length > 0 && (
          <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, fontSize: 10, fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Action</span>
            </div>
            {supplyItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                <span style={{ textAlign: 'right', color: '#A0A0A0', fontSize: 13 }}>{item.quantity} {item.unit}</span>
                <button onClick={() => setSupplyItems(supplyItems.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#FF5252', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <label className="am-field" style={{ marginTop: 20 }}>
          <span>Notes for Admin (Optional)</span>
          <textarea 
            className="am-input"
            style={{ height: 'auto', padding: '12px 16px' }}
            rows={3}
            placeholder="Explain why these items are needed or specify brands..." 
            value={supplyNotes} 
            onChange={e => setSupplyNotes(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
           <button 
             disabled={busy || supplyItems.length === 0} 
             onClick={submitRequisition}
             style={{ flex: 1, background: supplyItems.length === 0 ? '#222' : '#4CAF50', color: supplyItems.length === 0 ? '#666' : '#fff', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: supplyItems.length === 0 ? 'not-allowed' : 'pointer', boxShadow: supplyItems.length > 0 ? '0 4px 15px rgba(76,175,80,0.3)' : 'none' }}
           >
             {busy ? 'Sending...' : 'Submit Request to Admin'}
           </button>
           <button onClick={() => { setSupplyItems([]); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0A0', padding: '14px 20px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Clear</button>
        </div>
      </div>
    </div>
  )
}

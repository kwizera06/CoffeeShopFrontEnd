import { useState, useEffect, useCallback } from 'react'
import { api, getSession } from '../../api'
import { supabase } from '../../supabaseClient'
import './OwnerModern.css'
import { 
  HiOutlineClipboardDocumentList, 
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineQueueList,
  HiOutlineArrowPath
} from 'react-icons/hi2'

export default function ChefDashboard() {
  const { role } = getSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const [inventory, setInventory] = useState([])
  const [supplyItems, setSupplyItems] = useState([])
  const [newSupply, setNewSupply] = useState({ name: '', quantity: '', unit: 'pcs' })
  const [supplyNotes, setSupplyNotes] = useState('')

  const allowed = role === 'CHEF' || role === 'SHOP_ADMIN'

  const loadInventory = useCallback(async () => {
    try {
      const data = await api('/api/shop/owner/inventory')
      setInventory(data)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void loadInventory()

    if (!supabase) return

    const channel = supabase
      .channel('chef-inventory')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ingredients',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void loadInventory().catch(() => {})
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Chef Dashboard subscribed to inventory changes')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, loadInventory])

  if (!allowed) return <div className="panel">Unauthorized</div>

  function addSupplyItem() {
    if (!newSupply.name || !newSupply.quantity) return
    setSupplyItems([...supplyItems, { ...newSupply }])
    setNewSupply({ name: '', quantity: '', unit: 'pcs' })
  }

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
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const lowStock = inventory.filter(i => i.stock_level < i.min_threshold)

  return (
    <div className="owner-modern-page am-animate" style={{ minHeight: 'auto' }}>
      <header className="am-header">
        <div className="am-title">
          <h1>Chef Dashboard</h1>
          <p>Kitchen supplies & inventory monitor</p>
        </div>
        <button className="btn ghost" onClick={loadInventory} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827', padding: '8px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
           <HiOutlineArrowPath /> Refresh
        </button>
      </header>

      {error && <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#FF5252', padding: '10px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="chef-grid">
        {/* Left Column: Inventory Alerts */}
        <div className="am-chart-card">
          <div className="am-chart-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HiOutlineExclamationTriangle style={{ color: '#FF5722' }} /> Low Stock Alerts
            </h3>
            <span style={{ background: 'rgba(255,87,34,0.1)', color: '#FF5722', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{lowStock.length} Items</span>
          </div>
          
          {lowStock.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <HiOutlineCheckCircle size={32} style={{ color: '#1D3557', opacity: 0.5, marginBottom: 8 }} />
              <p style={{ color: '#A0A0A0', fontSize: 13 }}>Inventory levels are healthy.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStock.map(item => (
                <div key={item.id} className="am-order-row">
                   <div>
                     <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                     <div style={{ color: '#A0A0A0', fontSize: 11 }}>Min: {item.min_threshold} {item.unit}</div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                     <span style={{ fontWeight: 700, color: '#FF5722', fontSize: 14 }}>{item.stock_level} {item.unit}</span>
                     <button 
                       style={{ background: '#EDF2F9', border: '1px solid #B8CCE4', color: '#1D3557', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                       onClick={() => {
                         if (!supplyItems.find(s => s.name === item.name)) {
                           setSupplyItems([...supplyItems, { name: item.name, quantity: item.min_threshold, unit: item.unit }])
                         }
                       }}
                     >
                       + Req
                     </button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: New Requisition */}
        <div className="am-chart-card" style={{ position: 'relative' }}>
           {success && (
             <div style={{ position: 'absolute', top: 16, right: 16, background: '#1D3557', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10, fontWeight: 700 }}>
               <HiOutlineCheckCircle /> Submitted!
             </div>
           )}
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
             <HiOutlineClipboardDocumentList /> Create Requisition
          </h3>
          
          <div className="am-form-grid" style={{ marginTop: 0, gap: 12 }}>
             <label className="am-field" style={{ gridColumn: 'span 2' }}>
               <span>Item Name</span>
               <input 
                 type="text" 
                 className="am-input"
                 list="inventory-suggestions"
                 placeholder="e.g. Coffee Beans" 
                 value={newSupply.name} 
                 onChange={e => setNewSupply({...newSupply, name: e.target.value})} 
               />
               <datalist id="inventory-suggestions">
                  {inventory.map(i => <option key={i.id} value={i.name} />)}
               </datalist>
             </label>
             <label className="am-field">
               <span>Quantity</span>
               <input className="am-input" type="number" value={newSupply.quantity} onChange={e => setNewSupply({...newSupply, quantity: e.target.value})} />
             </label>
             <label className="am-field">
               <span>Unit</span>
               <input className="am-input" type="text" value={newSupply.unit} onChange={e => setNewSupply({...newSupply, unit: e.target.value})} />
             </label>
          </div>
          
          <button onClick={addSupplyItem} style={{ width: '100%', marginTop: 16, background: '#EDF2F9', border: '1px solid #B8CCE4', color: '#1D3557', padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Add to List
          </button>

          {supplyItems.length > 0 && (
            <div style={{ marginTop: 16, background: '#F9FAFB', borderRadius: 12, padding: 12, border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 8, borderBottom: '1px solid #E5E7EB', marginBottom: 8 }}>
                 <span>ITEM</span>
                 <span>QTY</span>
              </div>
              {supplyItems.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                   <span>{s.name}</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <span style={{ color: '#A0A0A0' }}>{s.quantity} {s.unit}</span>
                     <button onClick={() => setSupplyItems(supplyItems.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: '#FF5252', fontSize: 16, cursor: 'pointer' }}>×</button>
                   </div>
                </div>
              ))}
            </div>
          )}

          <label className="am-field" style={{ marginTop: 16 }}>
             <span>Notes</span>
             <textarea className="am-input" style={{ height: 'auto', padding: '12px 16px' }} rows={2} value={supplyNotes} onChange={e => setSupplyNotes(e.target.value)} placeholder="Any special instructions..." />
          </label>

          <button 
            style={{ width: '100%', marginTop: 16, background: supplyItems.length === 0 ? '#E5E7EB' : '#1D3557', color: supplyItems.length === 0 ? '#9CA3AF' : '#fff', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: supplyItems.length === 0 ? 'not-allowed' : 'pointer', boxShadow: supplyItems.length > 0 ? '0 4px 15px rgba(29,53,87,0.3)' : 'none' }}
            disabled={busy || supplyItems.length === 0}
            onClick={submitRequisition}
          >
            {busy ? 'Sending...' : 'Submit Requisition to Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}

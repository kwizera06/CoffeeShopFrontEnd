import { useState, useEffect, useCallback } from 'react'
import { api, getSession } from '../../api'
import { supabase } from '../../supabaseClient'
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
      .subscribe()

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
    <div className="panel animate-in">
      <div className="section-header">
        <div>
          <h2>Chef Dashboard</h2>
          <p className="muted">Manage kitchen supplies and monitor inventory</p>
        </div>
        <button className="btn ghost" onClick={loadInventory}>
           <HiOutlineArrowPath /> Refresh Stock
        </button>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Left Column: Inventory Alerts */}
        <div className="stack">
          <div className="card" style={{ padding: 20 }}>
            <div className="row-between" style={{ marginBottom: 16 }}>
               <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                 <HiOutlineExclamationTriangle style={{ color: 'var(--mahogany)' }} /> Low Stock Alerts
               </h3>
               <span className="badge badge-danger">{lowStock.length} Items</span>
            </div>
            
            {lowStock.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <HiOutlineCheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.5 }} />
                <p className="muted">Inventory levels are healthy.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {lowStock.map(item => (
                  <div key={item.id} className="row-between p-12" style={{ borderBottom: '1px solid var(--border)' }}>
                     <div>
                       <div style={{ fontWeight: 600 }}>{item.name}</div>
                       <div className="muted" style={{ fontSize: 12 }}>Min Threshold: {item.min_threshold} {item.unit}</div>
                     </div>
                     <div className="text-right">
                       <div style={{ fontWeight: 700, color: 'var(--mahogany)' }}>{item.stock_level} {item.unit}</div>
                       <button 
                         className="btn tiny ghost" 
                         style={{ color: 'var(--caramel)', fontSize: 11 }}
                         onClick={() => {
                           if (!supplyItems.find(s => s.name === item.name)) {
                             setSupplyItems([...supplyItems, { name: item.name, quantity: item.min_threshold, unit: item.unit }])
                           }
                         }}
                       >
                         + Add to Req
                       </button>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: New Requisition */}
        <div className="stack">
          <div className="card" style={{ padding: 24, position: 'relative' }}>
             {success && (
               <div className="alert-float" style={{ position: 'absolute', top: 12, right: 12, background: 'var(--success)', color: 'white', padding: '8px 16px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
                 <HiOutlineCheckCircle /> Submitted!
               </div>
             )}
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
               <HiOutlineClipboardDocumentList /> Create Requisition
            </h3>
            
            <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
               <label className="field" style={{ gridColumn: 'span 2' }}>
                 <span>Item Name</span>
                 <input 
                   type="text" 
                   list="inventory-suggestions"
                   placeholder="e.g. Coffee Beans" 
                   value={newSupply.name} 
                   onChange={e => setNewSupply({...newSupply, name: e.target.value})} 
                 />
                 <datalist id="inventory-suggestions">
                    {inventory.map(i => <option key={i.id} value={i.name} />)}
                 </datalist>
               </label>
               <label className="field">
                 <span>Quantity</span>
                 <input type="number" value={newSupply.quantity} onChange={e => setNewSupply({...newSupply, quantity: e.target.value})} />
               </label>
               <label className="field">
                 <span>Unit</span>
                 <input type="text" value={newSupply.unit} onChange={e => setNewSupply({...newSupply, unit: e.target.value})} />
               </label>
            </div>
            
            <button className="btn primary block" onClick={addSupplyItem}>Add to List</button>

            {supplyItems.length > 0 && (
              <div className="stack" style={{ marginTop: 20, background: '#FAF6F0', borderRadius: 8, padding: 12 }}>
                <div className="row-between head" style={{ fontSize: 12, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid #E5E0DA', marginBottom: 8 }}>
                   <span>ITEM</span>
                   <span>QTY</span>
                </div>
                {supplyItems.map((s, i) => (
                  <div key={i} className="row-between" style={{ padding: '4px 0', fontSize: 14 }}>
                     <span>{s.name}</span>
                     <div className="row" style={{ gap: 8 }}>
                       <span>{s.quantity} {s.unit}</span>
                       <button className="btn tiny danger ghost" onClick={() => setSupplyItems(supplyItems.filter((_, idx) => idx !== i))}>×</button>
                     </div>
                  </div>
                ))}
              </div>
            )}

            <label className="field" style={{ marginTop: 20 }}>
               <span>Notes</span>
               <textarea rows={2} value={supplyNotes} onChange={e => setSupplyNotes(e.target.value)} placeholder="Any special instructions..." />
            </label>

            <button 
              className="btn success xl block" 
              style={{ marginTop: 20 }}
              disabled={busy || supplyItems.length === 0}
              onClick={submitRequisition}
            >
              {busy ? 'Sending...' : '🚀 Submit Requisition to Admin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { api, getSession } from '../../api'

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

  function addSupplyItem() {
    if (!newSupply.name || !newSupply.quantity) return
    setSupplyItems([...supplyItems, { ...newSupply }])
    setNewSupply({ name: '', quantity: '', unit: 'pcs', price: '' })
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

  if (!allowed) return <div className="panel">Unauthorized</div>

  return (
    <div className="panel animate-in">
      <div className="section-header">
        <div>
          <h2>Shop Supplies</h2>
          <p className="muted">Request items needed for the coffee shop</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {success ? (
        <div style={{ background: 'var(--go)', color: 'var(--espresso)', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
          <span style={{ fontSize: 20 }}>✅</span> Request sent to Admin successfully!
        </div>
      ) : null}

      <div className="card stack" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 16 }}>New Supply Request</h3>
        <p className="muted" style={{ marginBottom: 24 }}>Add items to your list and click submit to notify the admin.</p>
        
        <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
          <label className="field">
            <span>Item Name</span>
            <input 
              type="text" 
              placeholder="e.g. Milk, Sugar" 
              value={newSupply.name} 
              onChange={e => setNewSupply({...newSupply, name: e.target.value})} 
            />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Qty</span>
              <input 
                type="number" 
                placeholder="0" 
                value={newSupply.quantity} 
                onChange={e => setNewSupply({...newSupply, quantity: e.target.value})} 
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Unit</span>
              <input 
                type="text" 
                placeholder="pcs, kg" 
                value={newSupply.unit} 
                onChange={e => setNewSupply({...newSupply, unit: e.target.value})} 
              />
            </label>
          </div>
          <div className="stack" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary block" onClick={addSupplyItem} style={{ height: 42 }}>Add to List</button>
          </div>
        </div>

        {supplyItems.length > 0 && (
          <div className="table" style={{ marginTop: 12, marginBottom: 20 }}>
            <div className="row head">
              <div>Item</div>
              <div style={{ textAlign: 'right' }}>Quantity</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>
            {supplyItems.map((item, idx) => (
              <div key={idx} className="row">
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ textAlign: 'right' }}>{item.quantity} {item.unit}</div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn small warn ghost" onClick={() => setSupplyItems(supplyItems.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="field">
          <span>Notes for Admin (Optional)</span>
          <textarea 
            placeholder="Explain why these items are needed or specify brands..." 
            value={supplyNotes} 
            onChange={e => setSupplyNotes(e.target.value)}
          />
        </label>

        <div className="row-actions" style={{ marginTop: 24 }}>
           <button className="btn success xl" disabled={busy || supplyItems.length === 0} onClick={submitRequisition}>
             {busy ? 'Sending...' : '🚀 Submit Request to Admin'}
           </button>
           <button className="btn ghost" onClick={() => { setSupplyItems([]); }}>Clear List</button>
        </div>
      </div>
    </div>
  )
}

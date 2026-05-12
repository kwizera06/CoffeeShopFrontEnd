import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getSession } from '../../api'
import { printKitchenTicket } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'

export default function Orders() {
  const nav = useNavigate()
  const { role } = getSession()
  const { context, shift } = useShopContext()

  const [menu, setMenu] = useState([])
  const [tableNumber, setTableNumber] = useState('1')
  const [qtyById, setQtyById] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const allowed = role === 'WAITER' || role === 'SHOP_ADMIN'
  const shopName = context?.name

  const reloadMenu = useCallback(async () => {
    const items = await api('/api/shop/menu')
    setMenu(items.filter((m) => m.available))
  }, [])

  useEffect(() => {
    if (!allowed) {
      nav('/app/billing', { replace: true })
      return
    }

    void reloadMenu().catch((e) => setError(e.message))

    if (!supabase) return

    const channel = supabase
      .channel('menu-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void reloadMenu().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, nav, reloadMenu])

  function setQty(id, next) {
    setQtyById((m) => {
      const copy = { ...m, [id]: next }
      if (next <= 0) {
        delete copy[id]
      }
      return copy
    })
  }

  const lines = useMemo(() => {
    return Object.entries(qtyById)
      .map(([menuItemId, quantity]) => {
        const mi = menu.find((x) => x.id === menuItemId)
        return mi ? { menuItemId: mi.id, quantity, name: mi.name } : null
      })
      .filter(Boolean)
  }, [qtyById, menu])

  async function sendToKitchen() {
    setError('')
    const tn = Number(tableNumber)
    if (!Number.isFinite(tn) || tn < 1) {
      setError('Pick a table number')
      return
    }
    const items = Object.entries(qtyById)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity: Number(quantity) }))
      .filter((x) => x.quantity > 0)
    if (items.length === 0) {
      setError('Add items first')
      return
    }
    setBusy(true)
    try {
      const created = await api('/api/shop/orders', {
        method: 'POST',
        body: JSON.stringify({ tableNumber: tn, items }),
      })
      const submitted = await api(`/api/shop/orders/${created.id}/submit-kitchen`, { method: 'POST' })
      printKitchenTicket({
        orderId: submitted.id,
        tableNumber: submitted.tableNumber,
        shopName,
        createdAt: submitted.createdAt,
        lines: submitted.lines.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
      })
      setQtyById({})
      setTableNumber('1')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel animate-in">
      <div className="section-header">
        <div>
          <h2>Orders</h2>
          <p className="muted">Build the order and send to kitchen</p>
        </div>
        <div style={{ width: 120 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Table</span>
            <input
              type="number"
              min="1"
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 700 }}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
          </label>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="billing-grid">
        <div className="menu-grid">
          {menu.map((m) => {
            const qty = qtyById[m.id] ?? 0
            const getItemIcon = (name) => {
              const n = name.toLowerCase();
              if (n.includes('cake') || n.includes('muffin') || n.includes('croissant')) return '🥐';
              if (n.includes('tea')) return '🍵';
              if (n.includes('ice') || n.includes('cold') || n.includes('shake')) return '🥤';
              if (n.includes('latte') || n.includes('capu') || n.includes('mocha')) return '☕';
              if (n.includes('pizza') || n.includes('burger') || n.includes('food')) return '🍔';
              return '☕';
            }
            return (
              <div key={m.id} className={`menu-card ${qty > 0 ? 'selected' : ''}`} onClick={() => setQty(m.id, qty + 1)}>
                <div className="row-between">
                  <div className="menu-card-emoji">{getItemIcon(m.name)}</div>
                  {qty > 0 && <div className="menu-card-badge">{qty}</div>}
                </div>
                <div className="menu-card-title">{m.name}</div>
                <div className="menu-card-footer">
                  <div className="menu-card-price">{Number(m.price).toLocaleString()} RWF</div>
                </div>
                {qty > 0 && (
                  <div className="qty-row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="qty-btn minus" onClick={() => setQty(m.id, qty - 1)}>−</button>
                    <div className="qty-val">{qty}</div>
                    <button type="button" className="qty-btn plus" onClick={() => setQty(m.id, qty + 1)}>+</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <aside className="detail">
          <div className="detail-title">Current Ticket</div>
          
          {lines.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <h4>Cart is empty</h4>
              <p className="muted">Select items from the menu to start an order.</p>
            </div>
          ) : (
            <div className="stack">
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {lines.map((l) => (
                  <div key={l.menuItemId} className="line">
                    <div>
                      <strong>{l.name}</strong>
                      <div className="muted">{qtyById[l.menuItemId]} × {Number(menu.find(x => x.id === l.menuItemId)?.price).toFixed(0)}</div>
                    </div>
                    <div className="row-actions">
                       <button className="btn ghost circle" style={{ width: 24, height: 24, fontSize: 12 }} onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] - 1)}>−</button>
                       <button className="btn ghost circle" style={{ width: 24, height: 24, fontSize: 12 }} onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="detail-total">
                <span>Total</span>
                <span className="detail-total-price">
                  {lines.reduce((acc, l) => acc + (l.quantity * (menu.find(x => x.id === l.menuItemId)?.price ?? 0)), 0).toLocaleString()} RWF
                </span>
              </div>

              <button 
                type="button" 
                className="btn primary xl block" 
                style={{ marginTop: 12 }}
                disabled={busy || !shift} 
                onClick={sendToKitchen}
              >
                {!shift ? '⚠️ Shift is CLOSED' : '⚡ Subimt to Kitchen'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

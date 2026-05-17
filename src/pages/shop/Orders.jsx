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
  const [search, setSearch] = useState('')
  const [staff, setStaff] = useState([])
  const [selectedWaiter, setSelectedWaiter] = useState('')

  const allowed = role === 'CASHIER' || role === 'WAITER' || role === 'SHOP_ADMIN'
  const shopName = context?.name

  const reloadMenu = useCallback(async () => {
    const [items, staffData] = await Promise.all([
       api('/api/shop/menu'),
       api('/api/shop/staff')
    ])
    setMenu(items.filter((m) => m.available))
    setStaff(staffData || [])
    
    // Default to self if current user is a waiter
    const myId = getSession().userId
    if (staffData?.some(s => s.id === myId)) {
       setSelectedWaiter(myId)
    }
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
    if (!selectedWaiter) {
      setError('Please select a waiter (Served By) first')
      return
    }
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
        body: JSON.stringify({ tableNumber: tn, items, waiterId: selectedWaiter }),
      })
      const submitted = await api(`/api/shop/orders/${created.id}/submit-kitchen`, { method: 'POST' })
      printKitchenTicket({
        orderId: submitted.id,
        tableNumber: submitted.tableNumber,
        shopName,
        waiterName: submitted.waiterName,
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
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>Orders</h2>
          <p className="muted" style={{ fontSize: 13 }}>Build the order and send to kitchen</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search products or category..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 40, borderRadius: 12, fontSize: 14 }}
            />
          </div>
          <div style={{ width: 100 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: 10 }}>TABLE</span>
              <input
                type="number"
                min="1"
                style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, borderRadius: 12 }}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
              />
            </label>
          </div>
          <div style={{ width: 160 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: 10 }}>SERVED BY (WAITER)</span>
              <select
                style={{ fontSize: 14, fontWeight: 600, borderRadius: 12, height: 44 }}
                value={selectedWaiter}
                onChange={(e) => setSelectedWaiter(e.target.value)}
              >
                <option value="">Select Waiter...</option>
                {staff.map(s => (
                   <option key={s.id} value={s.id}>{s.name} ({s.role.replace('SHOP_', '')})</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="billing-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {['DRINK', 'FOOD'].map((group) => {
            const groupTitle = group === 'DRINK' ? '☕ Drinks' : '🍔 Food';
            const s = search.toLowerCase();
            const groupItems = menu.filter(m => {
              const matchesGroup = (m.category_group || 'DRINK') === group;
              const matchesSearch = !s || m.name.toLowerCase().includes(s) || (m.category || '').toLowerCase().includes(s);
              return matchesGroup && matchesSearch;
            });
            if (groupItems.length === 0) return null;

            // Sort and unique categories within the group
            const categories = [...new Set(groupItems.map(m => m.category || 'Uncategorized'))].sort();

            return (
              <div key={group} className="stack" style={{ gap: 20 }}>
                <h2 style={{ fontSize: 24, paddingBottom: 8, borderBottom: '2px solid var(--caramel)', color: 'var(--mahogany)' }}>
                   {groupTitle}
                </h2>
                
                {categories.map(cat => {
                   const catItems = groupItems.filter(m => (m.category || 'Uncategorized') === cat);
                   return (
                     <div key={cat} className="stack" style={{ gap: 12 }}>
                        <h3 className="muted" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          — {cat}
                        </h3>
                        <div className="menu-grid">
                          {catItems.map((m) => {
                            const qty = qtyById[m.id] ?? 0;
                            const getItemIcon = (name, category) => {
                              const n = name.toLowerCase();
                              const c = (category || '').toLowerCase();
                              if (c.includes('coffee')) return '☕';
                              if (c.includes('tea')) return '🍵';
                              if (c.includes('soft') || c.includes('juice')) return '🥤';
                              if (c.includes('beer') || c.includes('alcohol')) return '🍺';
                              if (c.includes('fast') || c.includes('burger') || n.includes('burger')) return '🍔';
                              if (c.includes('bakery') || c.includes('dessert')) return '🥐';
                              if (c.includes('main') || c.includes('meal')) return '🍲';
                              if (c.includes('snack')) return '🍿';
                              return '☕';
                            }
                            return (
                              <div key={m.id} className={`menu-card ${qty > 0 ? 'selected' : ''}`} onClick={() => setQty(m.id, qty + 1)}>
                                <div className="menu-card-emoji">{getItemIcon(m.name, m.category)}</div>
                                {qty > 0 && <div className="menu-card-badge">{qty}</div>}
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
                            );
                          })}
                        </div>
                     </div>
                   );
                })}
              </div>
            );
          })}
        </div>

        <aside className="detail" style={{ border: '1px solid #E5E0DA', padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#FAF6F0', padding: '16px 24px', borderBottom: '1px solid #E5E0DA', fontWeight: 600, color: '#2D1A11' }}>
            Current Ticket
          </div>
          
          <div style={{ padding: 24 }}>
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
          </div>
        </aside>
      </div>
    </div>
  )
}

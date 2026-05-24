import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, getSession } from '../../api'
import { printKitchenTicket, printReceipt } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
import './OwnerModern.css'
import { 
  HiOutlineMagnifyingGlass, 
  HiOutlineShoppingCart, 
  HiOutlinePrinter,
  HiOutlineExclamationTriangle
} from 'react-icons/hi2'
import { 
  IoCafeOutline, 
  IoFastFoodOutline, 
  IoBeerOutline, 
  IoWineOutline, 
  IoBowlingBallOutline,
  IoIceCreamOutline
} from 'react-icons/io5'
import { MdOutlineLocalDrink, MdOutlineDinnerDining, MdBakeryDining } from 'react-icons/md'

export default function Orders() {
  const nav = useNavigate()
  const location = useLocation()
  const editId = new URLSearchParams(location.search).get('edit')
  const { role } = getSession()
  const { context, shift } = useShopContext()

  const [menu, setMenu] = useState([])
  const [tableNumber, setTableNumber] = useState('1')
  const [qtyById, setQtyById] = useState({})
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
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

    void reloadMenu().catch((e) => {
      // Don't surface menu loading errors when editing an existing order
      if (!editId) setError(e.message)
    })

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Orders page subscribed to menu changes')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, nav, reloadMenu])

  useEffect(() => {
    if (!editId) return
    setError('') // clear any stale error from previous requests
    api(`/api/shop/orders/${editId}`)
      .then(order => {
        setError('') // explicitly clear on success
        setTableNumber(String(order.tableNumber))
        setSelectedWaiter(order.waiterId || '')
        const qtys = {}
        order.lines.forEach(l => {
          qtys[l.menuItemId] = l.quantity
        })
        setQtyById(qtys)
      })
      .catch(() => {
        // Order not found or access denied — go back to billing
        nav('/app/billing', { replace: true })
      })
  }, [editId, nav])

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
        return mi ? { menuItemId: mi.id, quantity, name: mi.name, ingredients: mi.ingredients } : null
      })
      .filter(Boolean)
  }, [qtyById, menu])

  async function sendToKitchen() {
    setError('')
    // Waiter required only for new orders; edits preserve existing waiter on backend
    if (!editId && !selectedWaiter) {
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
      if (editId) {
        const updated = await api(`/api/shop/orders/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ tableNumber: tn, items, waiterId: selectedWaiter }),
        })
        nav('/app/billing')
      } else {
        const created = await api('/api/shop/orders', {
          method: 'POST',
          body: JSON.stringify({ tableNumber: tn, items, waiterId: selectedWaiter, submitToKitchen: true }),
        })
        
        setQtyById({})
        setTableNumber('1')
        setSuccessMsg('✅ Order successfully sent to kitchen!')
        setTimeout(() => setSuccessMsg(''), 4000)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  
  function handleManualPrint() {
    const items = lines.map(l => ({
      ...l,
      price: menu.find(x => x.id === l.menuItemId)?.price || 0,
      itemName: l.name
    }))
    
    printReceipt({
      shopName,
      order: {
        id: editId || 'DRAFT',
        tableNumber,
        lines: items,
        total: items.reduce((acc, i) => acc + (i.quantity * i.price), 0),
        waiterName: staff.find(s => s.id === selectedWaiter)?.name || 'Staff'
      },
      paymentMethod: 'CASH' // Preview default
    })
  }

  return (
    <div className="owner-modern-page am-animate" style={{ minHeight: 'auto' }}>
      <header className="am-header">
        <div className="am-title">
          <h1>Orders</h1>
          <p>Build the order and send to kitchen</p>
        </div>
        <div className="orders-controls">
          <div className="orders-search">
            <HiOutlineMagnifyingGlass style={{ color: '#666' }} />
            <input 
              type="text" 
              className="am-input"
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', height: 'auto', padding: '0' }}
            />
          </div>
          <label className="am-field" style={{ width: 80 }}>
            <span>TABLE</span>
            <input
              className="am-input"
              type="number"
              min="1"
              style={{ textAlign: 'center', fontWeight: 700, padding: '0 8px' }}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
          </label>
          <label className="am-field" style={{ width: 140 }}>
            <span>WAITER</span>
            <select
              className="am-input"
              style={{ cursor: editId ? 'not-allowed' : 'pointer' }}
              value={selectedWaiter}
              disabled={!!editId}
              onChange={(e) => setSelectedWaiter(e.target.value)}
            >
              <option value="">Select...</option>
              {staff.map(s => (
                 <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && !editId ? <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#FF5252', padding: '10px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{error}</div> : null}
      {successMsg && !editId ? <div style={{ padding: '12px 16px', background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', color: '#4CAF50', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: 13 }}>{successMsg}</div> : null}

      <div className="orders-layout">
        <div className="orders-menu-area">
          {['DRINK', 'FOOD'].map((group) => {
           const groupTitle = group === 'DRINK' ? <><IoCafeOutline /> Drinks</> : <><IoFastFoodOutline /> Food</>;
            const s = search.toLowerCase();
            const groupItems = menu.filter(m => {
              const matchesGroup = (m.category_group || 'DRINK') === group;
              const matchesSearch = !s || m.name.toLowerCase().includes(s) || (m.category || '').toLowerCase().includes(s);
              return matchesGroup && matchesSearch;
            });
            if (groupItems.length === 0) return null;

            const categories = [...new Set(groupItems.map(m => m.category || 'Uncategorized'))].sort();

            return (
              <div key={group} style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#4CAF50', borderBottom: '1px solid rgba(76,175,80,0.2)', paddingBottom: 8 }}>
                   {groupTitle}
                </h3>
                
                {categories.map(cat => {
                   const catItems = groupItems.filter(m => (m.category || 'Uncategorized') === cat);
                   return (
                     <div key={cat} style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#A0A0A0', marginBottom: 8, fontWeight: 700 }}>
                          {cat}
                        </p>
                        <div className="orders-items-grid">
                          {catItems.map((m) => {
                            const qty = qtyById[m.id] ?? 0;
                            const getItemIcon = (name, category) => {
                              const n = name.toLowerCase();
                              const c = (category || '').toLowerCase();
                              if (c.includes('coffee')) return <IoCafeOutline />;
                              if (c.includes('tea')) return <IoCafeOutline />;
                              if (c.includes('soft') || c.includes('juice')) return <MdOutlineLocalDrink />;
                              if (c.includes('beer') || c.includes('alcohol')) return <IoBeerOutline />;
                              if (c.includes('wine')) return <IoWineOutline />;
                              if (c.includes('fast') || c.includes('burger') || n.includes('burger')) return <IoFastFoodOutline />;
                              if (c.includes('bakery') || c.includes('dessert')) return <MdBakeryDining />;
                              if (c.includes('main') || c.includes('meal')) return <MdOutlineDinnerDining />;
                              if (c.includes('snack')) return <IoIceCreamOutline />;
                              return <IoCafeOutline />;
                            }
                            return (
                              <div key={m.id} className={`orders-item-card ${qty > 0 ? 'selected' : ''}`} onClick={() => setQty(m.id, qty + 1)}>
                                {qty > 0 && <div className="orders-item-qty">{qty}</div>}
                                <div style={{ color: '#4CAF50', fontSize: 20, marginBottom: 4 }}>{getItemIcon(m.name, m.category)}</div>
                                <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3, marginTop: 'auto' }}>{m.name}</div>
                                <div style={{ fontSize: 11, color: '#A0A0A0' }}>{Number(m.price).toLocaleString()}</div>
                                {qty > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                                    <button type="button" style={{ background: 'rgba(255,82,82,0.1)', border: 'none', color: '#FF5252', width: 22, height: 22, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }} onClick={() => setQty(m.id, qty - 1)}>−</button>
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{qty}</span>
                                    <button type="button" style={{ background: 'rgba(76,175,80,0.1)', border: 'none', color: '#4CAF50', width: 22, height: 22, borderRadius: 6, cursor: 'pointer', fontWeight: 700 }} onClick={() => setQty(m.id, qty + 1)}>+</button>
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

        <aside className="orders-ticket">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{editId ? '📝 Editing' : '🛒 Ticket'}</span>
            {editId && <button style={{ background: 'transparent', border: 'none', color: '#FF5252', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/app/billing')}>Cancel</button>}
          </div>
          
          <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
            {lines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#666' }}>
                <HiOutlineShoppingCart size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>Cart empty. Tap items to add.</p>
              </div>
            ) : (
              <>
                {lines.map((l) => (
                  <div key={l.menuItemId} className="am-order-row" style={{ marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
                      <div style={{ color: '#A0A0A0', fontSize: 11 }}>{qtyById[l.menuItemId]} × {Number(menu.find(x => x.id === l.menuItemId)?.price).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <button type="button" style={{ background: 'transparent', border: 'none', color: '#FF5252', fontSize: 18, cursor: 'pointer' }} onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] - 1)}>−</button>
                       <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qtyById[l.menuItemId]}</span>
                       <button type="button" style={{ background: 'transparent', border: 'none', color: '#4CAF50', fontSize: 18, cursor: 'pointer' }} onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          
          {lines.length > 0 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                <span>Total</span>
                <span>{lines.reduce((acc, l) => acc + (l.quantity * (menu.find(x => x.id === l.menuItemId)?.price ?? 0)), 0).toLocaleString()} RWF</span>
              </div>

              <button 
                type="button" 
                style={{ width: '100%', background: !shift ? '#333' : '#4CAF50', color: !shift ? '#666' : '#fff', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: busy || !shift ? 'not-allowed' : 'pointer', boxShadow: shift ? '0 4px 15px rgba(76,175,80,0.3)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                disabled={busy || !shift} 
                onClick={sendToKitchen}
              >
                {!shift ? <><HiOutlineExclamationTriangle /> Shift Closed</> : editId ? '💾 Update' : '⚡ Submit to Kitchen'}
              </button>
 
              <button 
                type="button" 
                style={{ width: '100%', marginTop: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0A0', padding: '10px', borderRadius: 12, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={handleManualPrint}
              >
                <HiOutlinePrinter /> Print Preview
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

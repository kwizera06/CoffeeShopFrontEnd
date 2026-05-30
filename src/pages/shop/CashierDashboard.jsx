import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, getSession, clearSession } from '../../api'
import { printKitchenTicket, printReceipt } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
import './CashierDashboard.css'
import {
  HiOutlineMagnifyingGlass,
  HiOutlineShoppingCart,
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineUser,
  HiOutlineArrowRightOnRectangle,
  HiOutlineMinusCircle,
  HiOutlinePlusCircle,
  HiOutlineChartBar
} from 'react-icons/hi2'
import {
  IoCafeOutline,
  IoFastFoodOutline,
  IoBeerOutline,
  IoWineOutline,
  IoIceCreamOutline
} from 'react-icons/io5'
import { MdOutlineLocalDrink, MdOutlineDinnerDining, MdBakeryDining } from 'react-icons/md'

function getItemIcon(name, category) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (c.includes('coffee') || c.includes('tea')) return <IoCafeOutline />;
  if (c.includes('soft') || c.includes('juice')) return <MdOutlineLocalDrink />;
  if (c.includes('beer') || c.includes('alcohol')) return <IoBeerOutline />;
  if (c.includes('wine')) return <IoWineOutline />;
  if (c.includes('fast') || c.includes('burger') || n.includes('burger')) return <IoFastFoodOutline />;
  if (c.includes('bakery') || c.includes('dessert')) return <MdBakeryDining />;
  if (c.includes('main') || c.includes('meal')) return <MdOutlineDinnerDining />;
  if (c.includes('snack')) return <IoIceCreamOutline />;
  return <IoCafeOutline />;
}

export default function CashierDashboard() {
  const nav = useNavigate()
  const { role } = getSession()
  const { context, shift, reload: reloadShift, setShift } = useShopContext()
  const shopName = context?.name || "Mama Prince's Coffee Shop"

  // Query Params
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'new'
  const editId = searchParams.get('edit')
  
  const setTab = (t) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', t)
      return next
    })
  }

  // Shared state
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Top header states
  const [showShiftModal, setShowShiftModal] = useState('') // 'OPEN' or 'CLOSE'
  const [shiftForm, setShiftForm] = useState({ initialCash: '0', initialMomo: '0', actualCash: '0', actualMomo: '0', cashout: '0', notes: '' })
  const [cartExpanded, setCartExpanded] = useState(false)

  // New Order states
  const [menu, setMenu] = useState([])
  const [staff, setStaff] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [tableNumber, setTableNumber] = useState('1')
  const [selectedWaiter, setSelectedWaiter] = useState('')
  const [qtyById, setQtyById] = useState({})

  // Dynamic Categories from available menu items
  const dynamicCategories = useMemo(() => {
    const cats = new Set();
    menu.forEach(m => {
      if (m.category) cats.add(m.category);
    });
    return ["All", ...Array.from(cats).sort()];
  }, [menu]);

  // Billing (Pending & Ready) states
  const [pending, setPending] = useState([])
  const [ready, setReady] = useState([])
  
  // Payment states for Awaiting Payment tab
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [clientName, setClientName] = useState('')

  // Load Menu & Staff (once)
  const loadMenu = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        api('/api/shop/menu'),
        api('/api/shop/staff')
      ])
      setMenu(m.filter(x => x.available))
      setStaff(s || [])
      
      const myId = getSession().userId
      if (s?.some(x => x.id === myId)) setSelectedWaiter(myId)
    } catch(e) { /* ignore */ }
  }, [])

  // Load Billing (real-time)
  const loadBilling = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api('/api/shop/orders/kitchen-queue'),
        api('/api/shop/orders/ready')
      ])
      setPending(p)
      const mappedReady = r.map(o => {
        const total = o.lines.reduce((sum, l) => sum + Number(l.price)*l.quantity, 0)
        return { ...o, total }
      })
      setReady(mappedReady)
    } catch (e) { /* ignore */ }
  }, [])

  useEffect(() => {
    void loadMenu()
    void loadBilling()
  }, [loadMenu, loadBilling])

  // Real-time subscriptions
  useEffect(() => {
    if (!supabase) return
    const channel1 = supabase.channel('cashier-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `tenant_id=eq.${getSession().tenantId}` }, () => { loadMenu().catch(()=>{}) })
      .subscribe()
      
    const channel2 = supabase.channel('cashier-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${getSession().tenantId}` }, () => { loadBilling().catch(()=>{}) })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel1)
      void supabase.removeChannel(channel2)
    }
  }, [loadMenu, loadBilling])

  // Load Order to edit (and switch to tab if needed)
  useEffect(() => {
    if (editId) {
      if (tab !== 'new') setTab('new');
      api(`/api/shop/orders/${editId}`).then(order => {
        setTableNumber(String(order.tableNumber))
        setSelectedWaiter(order.waiterId || '')
        const qtys = {}
        order.lines.forEach(l => { qtys[l.menuItemId] = l.quantity })
        setQtyById(qtys)
      }).catch(e => setError(e.message))
    }
  }, [editId])

  /* --- ACTIONS --- */

  // Shift Actions
  async function handleShiftAction() {
    setBusy(true)
    try {
      if (showShiftModal === 'OPEN') {
        await api('/api/shop/shifts/open', {
          method: 'POST', body: JSON.stringify({ initialCash: Number(shiftForm.initialCash), initialMomo: Number(shiftForm.initialMomo) })
        })
      } else {
        await api('/api/shop/shifts/close', {
          method: 'POST', body: JSON.stringify({ actualCash: Number(shiftForm.actualCash), actualMomo: Number(shiftForm.actualMomo), cashout: Number(shiftForm.cashout), notes: shiftForm.notes })
        })
        setShift(null)
      }
      setShowShiftModal('')
      await reloadShift()
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Cart Actions
  function setQty(id, next) {
    setQtyById(m => {
      const copy = { ...m, [id]: next }
      if (next <= 0) delete copy[id]
      return copy
    })
  }
  
  const cartLines = useMemo(() => {
    return Object.entries(qtyById).map(([id, qty]) => {
      const mi = menu.find(x => x.id === id)
      if (!mi) return null;

      const ingredients = (mi.ingredients || []).map(ri => ({
        name: ri.name,
        qty: (ri.qty || 0) * qty,
        unit: ri.unit
      })).filter(i => i.name);

      return { menuItemId: mi.id, quantity: qty, name: mi.name, price: Number(mi.price), ingredients }
    }).filter(Boolean)
  }, [qtyById, menu])
  const cartTotal = cartLines.reduce((acc, l) => acc + (l.quantity * l.price), 0)

  // Checkout (New Order)
  async function submitOrder() {
    if (!shift) { alert("Please open a shift first."); return; }
    if (!editId && !selectedWaiter) { alert("Select Waiter"); return; }
    const tn = Number(tableNumber)
    if (!tn || tn < 1) { alert("Invalid table"); return; }
    if (cartLines.length === 0) return;
    
    setBusy(true)
    try {
      if (editId) {
        await api(`/api/shop/orders/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ tableNumber: tn, items: cartLines, waiterId: selectedWaiter }),
        })
        // Print Kitchen Ticket for updated order too
        printKitchenTicket({
          orderId: editId, 
          tableNumber: tn, 
          lines: cartLines.map(l => ({ quantity: l.quantity, itemName: l.name, ingredients: l.ingredients })), 
          waiterName: staff.find(x=>x.id===selectedWaiter)?.name || 'Staff'
        })
        setSearchParams({})
        setQtyById({})
        setTableNumber('1')
      } else {
        const created = await api('/api/shop/orders', {
          method: 'POST',
          body: JSON.stringify({ tableNumber: tn, items: cartLines, waiterId: selectedWaiter, submitToKitchen: true })
        })
        // Print Kitchen Ticket immediately
        printKitchenTicket({
          orderId: created.id, 
          tableNumber: tn, 
          lines: cartLines.map(l => ({ quantity: l.quantity, itemName: l.name, ingredients: l.ingredients })), 
          waiterName: staff.find(x=>x.id===selectedWaiter)?.name || 'Staff'
        })
        setQtyById({})
        setTableNumber('1')
      }
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Pending Actions
  async function markReady(id) {
    try { await api(`/api/shop/orders/${id}/mark-ready`, { method: 'POST' }) } 
    catch(e) { alert(e.message) }
  }
  async function cancelOrderRequest(id) {
    if(!window.confirm('Cancel this order?')) return;
    try { await api(`/api/shop/orders/${id}`, { method: 'DELETE' }) }
    catch(e) { alert(e.message) }
  }

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  // Awaiting Payment Actions
  async function payOrder(o) {
    if (!paymentMethod) { alert("Select payment method"); return; }
    if (paymentMethod === 'LOAN' && !clientName.trim()) { alert("Enter client name"); return; }
    setBusy(true)
    try {
      const paid = await api(`/api/shop/orders/${o.id}/pay`, {
        method: 'POST', body: JSON.stringify({ method: paymentMethod, clientName: paymentMethod === 'LOAN' ? clientName : undefined })
      })
      printReceipt({ shopName, order: paid, paymentMethod })
      setPaymentMethod(null)
      setClientName('')
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }


  /* --- RENDER --- */

  const filteredMenu = menu.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== 'All' && m.category !== catFilter) return false;
    return true;
  })

  return (
    <div className="cashier-dashboard animate-in">
      {/* Top Header */}
      <header className="cashier-header">
        <div className="cashier-header-brand">
          <div className="cashier-brand-icon"><IoCafeOutline /></div>
          {shopName}
        </div>
        
        <div className="cashier-header-actions">
          {shift ? (
            <div className={`cashier-shift-pill`}>
              <div className="dot"></div>
              Shift active • {new Date(shift.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })} | 
              Cash: {Number(shift.initial_cash).toLocaleString()} | MoMo: {Number(shift.initial_momo).toLocaleString()}
            </div>
          ) : (
             <div className={`cashier-shift-pill closed`}>
              <div className="dot"></div> Shift closed
            </div>
          )}

          <div className="cashier-bell">
             <HiOutlineBell />
          </div>
          
          <button className="cashier-btn-logout" onClick={handleLogout} title="Logout">
            <HiOutlineArrowRightOnRectangle />
          </button>

          {role === 'SHOP_ADMIN' && (
             <button className="cashier-btn-admin-dash" onClick={() => nav('/app/admin')}>
               <HiOutlineChartBar /> <span>Admin Dashboard</span>
             </button>
           )}
          
          {shift ? (
            <button className="cashier-btn-close-shift" onClick={()=>setShowShiftModal('CLOSE')}><span>Close Shift</span></button>
          ) : (
            <button className="cashier-btn-open-shift" onClick={()=>setShowShiftModal('OPEN')}><span>Open Shift</span></button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="cashier-tabs">
        <button className={`cashier-tab ${tab==='new'?'active':''}`} onClick={()=>setTab('new')}>
          + New Order
        </button>
        <button className={`cashier-tab ${tab==='pending'?'active':''}`} onClick={()=>setTab('pending')}>
          <HiOutlineShoppingCart /> Pending
          <span className="cashier-tab-badge">{pending.length}</span>
        </button>
        <button className={`cashier-tab ${tab==='ready'?'active':''}`} onClick={()=>setTab('ready')}>
          <IoCafeOutline /> Awaiting Payment
          <span className="cashier-tab-badge blue">{ready.length}</span>
        </button>
      </div>

      <div className="cashier-main-area">
        {/* NEW ORDER TAB */}
        {tab === 'new' && (
          <>
            <div className="cashier-left-pane">
              <div className="cashier-filters-top">
                <div className="cashier-search">
                  <HiOutlineMagnifyingGlass className="cashier-search-icon" />
                  <input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                <div className="cashier-table-input">
                  <IoCafeOutline /> Tbl
                  <input type="number" min="1" className="cashier-table-val" value={tableNumber} onChange={e=>setTableNumber(e.target.value)} />
                </div>
                <select className="cashier-waiter-sel" value={selectedWaiter} disabled={!!editId} onChange={(e) => setSelectedWaiter(e.target.value)}>
                   <option value="">Waiter...</option>
                   {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="cashier-categories">
                {dynamicCategories.map(p => (
                  <button key={p} className={`cashier-cat-pill ${catFilter===p?'active':''}`} onClick={()=>setCatFilter(p)}>
                    {p === 'All' ? null : getItemIcon('', p)}
                    {p}
                  </button>
                ))}
              </div>
              
              <div className="cashier-grid">
                {filteredMenu.map(m => {
                  const qty = qtyById[m.id] || 0;
                  return (
                    <div key={m.id} className="cashier-card" onClick={() => setQty(m.id, qty + 1)}>
                      {qty > 0 && <div className="cashier-card-qty">{qty}</div>}
                      <div className="cashier-card-icon">{getItemIcon(m.name, m.category)}</div>
                      <div className="cashier-card-title">{m.name}</div>
                      <div className="cashier-card-price">{Number(m.price).toLocaleString()} RWF</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={`cashier-right-pane ${cartExpanded ? 'expanded' : ''}`}>
               <div className="cashier-ticket-header" style={editId ? { background: '#3A3022', borderBottomColor: '#E6CCB2' } : {}} onClick={() => setCartExpanded(!cartExpanded)}>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: 12}}>
                    <div className="cashier-ticket-title" style={editId ? { color: '#E6CCB2' } : {}}>
                      {editId ? '📝 Editing Order' : `🛒 Cart (${cartLines.length})`}
                    </div>
                    {editId && (
                      <button 
                        onClick={() => { setSearchParams({}); setQtyById({}); setTableNumber('1'); }}
                        style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    )}
                 </div>
                 <div className="cashier-ticket-meta">
                   <div className="cashier-meta-pill"><IoCafeOutline /> Table {tableNumber}</div>
                   <div className="cashier-meta-pill">{cartLines.length} items</div>
                   {editId && <div className="cashier-meta-pill" style={{borderColor:'#E6CCB2'}}>ID: {editId.slice(0,4)}</div>}
                 </div>
               </div>
               <div className="cashier-ticket-body">
                 {cartLines.length === 0 ? (
                    <div className="cashier-empty-cart">
                      <HiOutlineShoppingCart />
                      <p>Cart is empty.</p>
                      <span>Tap items to add.</span>
                    </div>
                 ) : (
                     cartLines.map(l => (
                       <div key={l.menuItemId} className="cashier-ticket-item">
                          <div style={{ flex: 1 }}>
                             <div style={{ fontWeight: 600, marginBottom: 4 }}>{l.name}</div>
                             <div style={{ color: '#A0A0A0', fontSize: 12 }}>{(l.quantity * l.price).toLocaleString()} RWF</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                             <button 
                               onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] - 1)}
                               style={{ background: 'transparent', border: 'none', color: '#A0A0A0', cursor: 'pointer', display: 'flex', fontSize: 32 }}
                             >
                               <HiOutlineMinusCircle />
                             </button>
                             <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center', color: '#E6CCB2', fontSize: 24 }}>{l.quantity}</span>
                             <button 
                               onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] + 1)}
                               style={{ background: 'transparent', border: 'none', color: '#E6CCB2', cursor: 'pointer', display: 'flex', fontSize: 32 }}
                             >
                               <HiOutlinePlusCircle />
                             </button>
                          </div>
                       </div>
                     ))
                 )}
               </div>
               <div className="cashier-ticket-footer">
                  <div className="cashier-total-row">
                    <span>Subtotal</span>
                    <span>{cartTotal.toLocaleString()} RWF</span>
                  </div>
                  <div className="cashier-total-row">
                    <span>Tax</span>
                    <span>0 RWF</span>
                  </div>
                  <div className="cashier-total-row grand">
                    <span>Total</span>
                    <span>{cartTotal.toLocaleString()} RWF</span>
                  </div>
                  <button 
                    className={`cashier-btn-submit ${cartLines.length > 0 ? 'active' : ''}`}
                    disabled={cartLines.length === 0 || busy}
                    onClick={submitOrder}
                  >
                    {editId ? '📝 Update Order' : '✈️ Post Order + Print Kitchen Ticket'}
                  </button>
               </div>
            </div>
          </>
        )}

        {/* PENDING TAB */}
        {tab === 'pending' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="cashier-billing-grid">
              {pending.length === 0 && <p className="muted" style={{padding: 24}}>No pending orders.</p>}
              {pending.map(o => (
                <div key={o.id} className="cashier-order-card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start'}}>
                    <div className="table-badge">Table {o.tableNumber}</div>
                    <div style={{fontSize: 12, color:'#8C9993'}}>{new Date(o.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' })}</div>
                  </div>
                  <div style={{fontSize: 14, color:'#8C9993'}}>Waiter: {o.waiterName}</div>
                  
                  <div style={{background: '#1C1C1C', color: '#E8E8E8', padding: 12, borderRadius: 8, fontSize: 13}}>
                     {o.lines.map((l, i) => (
                       <div key={i} style={{marginBottom: 4, display: 'flex', gap: '8px'}}>
                           <strong style={{color: '#4ADE80'}}>{l.quantity}x</strong> 
                           <span>{l.itemName}</span>
                       </div>
                     ))}
                  </div>

                  <div style={{display: 'flex', gap: 8, marginTop: 'auto'}}>
                     <button className="cashier-btn-close-shift active" style={{flex: 1, padding: 0}} onClick={()=>markReady(o.id)}>
                        <HiOutlineCheckCircle /> Mark Ready
                     </button>
                      <button className="cashier-btn-close-shift" style={{padding: '0 12px'}} onClick={() => setSearchParams({ tab: 'new', edit: o.id })}>
                         <HiOutlinePencilSquare />
                      </button>
                     <button className="cashier-btn-close-shift" style={{padding: '0 12px'}} onClick={()=>cancelOrderRequest(o.id)}>
                        <HiOutlineTrash />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* READY TAB */}
        {tab === 'ready' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="cashier-billing-grid">
              {ready.length === 0 && <p className="muted" style={{padding: 24}}>No orders waiting for payment.</p>}
              {ready.map(o => (
                <div key={o.id} className="cashier-order-card" style={{borderColor: '#E6CCB2'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start'}}>
                    <div className="table-badge" style={{background: '#3A3022', color: '#E6CCB2'}}>Table {o.tableNumber}</div>
                    <div style={{fontWeight: 700, fontSize: 18}}>{Number(o.total).toLocaleString()} RWF</div>
                  </div>
                  <div style={{fontSize: 14, color:'#8C9993'}}>Waiter: {o.waiterName}</div>
                  
                  <div style={{background: '#1C1C1C', color: '#E8E8E8', padding: 12, borderRadius: 8, fontSize: 13}}>
                     {o.lines.map((l, i) => (
                       <div key={i} style={{marginBottom: 4, display: 'flex', gap: '8px'}}>
                           <strong style={{color: '#4ADE80'}}>{l.quantity}x</strong> 
                           <span>{l.itemName}</span>
                       </div>
                     ))}
                  </div>

                  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                     {['CASH', 'MOBILE_MONEY', 'POS', 'LOAN'].map(m => (
                       <button 
                         key={m} 
                         className={`cashier-cat-pill ${paymentMethod === m ? 'active' : ''}`}
                         onClick={()=>setPaymentMethod(m)}
                         style={{ flex: 1, justifyContent: 'center' }}
                       >
                         {m === 'MOBILE_MONEY' ? 'MoMo' : m === 'CASH' ? 'Cash' : m}
                       </button>
                     ))}
                  </div>
                  {paymentMethod === 'LOAN' && (
                     <input type="text" placeholder="Client Name" value={clientName} onChange={e=>setClientName(e.target.value)} style={{padding: 8, border: '1px solid #3E3E3E', borderRadius: 8, background: '#1C1C1C', color: 'white'}}/>
                  )}
                  <div style={{display: 'flex', gap: 8, marginTop: 'auto'}}>
                     <button className="cashier-btn-close-shift" style={{flex: 1, padding: 12, border: '1px solid #E6CCB2', color: '#E6CCB2'}} onClick={()=>printReceipt({ shopName, order: o, paymentMethod: null })}>
                        Print Preview
                     </button>
                     <button className="cashier-btn-submit active" style={{flex: 1, padding: 12}} onClick={()=>payOrder(o)}>
                        Pay & Print
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* SHIFT MODAL */}
      {showShiftModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal">
             <h3 style={{marginBottom: 16}}>{showShiftModal === 'OPEN' ? '☕ Open Shift' : '🔒 Close Shift'}</h3>
             {showShiftModal === 'OPEN' ? (
                <div style={{display:'flex', flexDirection:'column', gap: 16}}>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Initial Cash</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.initialCash} onChange={e=>setShiftForm(f=>({...f, initialCash:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Initial MoMo</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.initialMomo} onChange={e=>setShiftForm(f=>({...f, initialMomo:e.target.value}))}/>
                  </div>
                </div>
             ) : (
                <div style={{display:'flex', flexDirection:'column', gap: 16}}>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Actual Cash Count</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.actualCash} onChange={e=>setShiftForm(f=>({...f, actualCash:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Actual MoMo Count</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.actualMomo} onChange={e=>setShiftForm(f=>({...f, actualMomo:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Cashout (Given to Owner)</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.cashout} onChange={e=>setShiftForm(f=>({...f, cashout:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Notes</label>
                    <textarea className="cashier-search" style={{width: '100%', marginTop: 4, padding:8}} value={shiftForm.notes} onChange={e=>setShiftForm(f=>({...f, notes:e.target.value}))}/>
                  </div>
                </div>
             )}
             
             <div style={{display:'flex', gap: 12, marginTop: 24}}>
                <button className="cashier-btn-submit active" style={{flex: 1, padding: 12}} onClick={handleShiftAction} disabled={busy}>Confirm</button>
                <button className="cashier-btn-close-shift" style={{padding: 12}} onClick={()=>setShowShiftModal('')}>Cancel</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getSession } from '../../api'
import { printReceipt } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
import './OwnerModern.css'
import { 
  HiOutlineBanknotes, 
  HiOutlineDevicePhoneMobile, 
  HiOutlineCreditCard, 
  HiOutlinePencilSquare, 
  HiOutlineClock, 
  HiOutlineCheckCircle, 
  HiOutlineFolderOpen, 
  HiOutlinePrinter,
  HiOutlineUsers,
  HiOutlineTrash
} from 'react-icons/hi2'

export default function Billing() {
  const nav = useNavigate()
  const { role } = getSession()
  const { context } = useShopContext()
  const [tab, setTab] = useState('pending')

  const [pending, setPending] = useState([])
  const [ready, setReady] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [clientName, setClientName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(null)

  const allowed = role === 'CASHIER' || role === 'SHOP_ADMIN'

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      api('/api/shop/orders/kitchen-queue'),
      api('/api/shop/orders/ready'),
    ])
    setPending(p)
    setReady(r)
  }, [])

  useEffect(() => {
    if (!allowed) {
      nav('/app/orders', { replace: true })
      return
    }

    void load().catch(() => {})

    if (!supabase) return

    const channel = supabase
      .channel('billing-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void load().catch(() => {})
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Billing page subscribed to order changes')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, nav, load])

  async function markReady(orderId) {
    setError('')
    try {
      await api(`/api/shop/orders/${orderId}/mark-ready`, { method: 'POST' })
    } catch (e) {
      setError(e.message)
    }
  }

  async function cancelOrderRequest(orderId) {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return
    }
    setError('')
    try {
      await api(`/api/shop/orders/${orderId}`, { method: 'DELETE' })
      setSelected(null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function pay(method) {
    if (!selected) {
      return
    }
    setBusy(true)
    setError('')
    try {
      if (method === 'LOAN' && !clientName.trim()) {
        setError('Please enter client name for credit/loan')
        setBusy(false)
        return
      }

      const paid = await api(`/api/shop/orders/${selected.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method, clientName: method === 'LOAN' ? clientName : undefined }),
      })
      printReceipt({ shopName: context?.name, order: paid, paymentMethod: method })
      setSelected(null)
      setClientName('')
      setPaymentMethod(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function handlePrintProForma() {
    if (!selected) return
    // Print without method to show as pro-forma/unpaid
    printReceipt({ 
      shopName: context?.name, 
      order: selected, 
      paymentMethod: 'UNPAID (PRO-FORMA)' 
    })
  }

  return (
    <div className="owner-modern-page am-animate" style={{ minHeight: 'auto' }}>
      <header className="am-header">
        <div className="am-title">
          <h1>Billing</h1>
          <p>Manage and checkout active orders</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
        <button type="button" onClick={() => setTab('pending')} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: tab === 'pending' ? 'rgba(255,152,0,0.1)' : 'transparent', color: tab === 'pending' ? '#FF9800' : '#A0A0A0' }}>
          <HiOutlineClock /> Pending ({pending.length})
        </button>
        <button type="button" onClick={() => setTab('ready')} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: tab === 'ready' ? 'rgba(76,175,80,0.1)' : 'transparent', color: tab === 'ready' ? '#4CAF50' : '#A0A0A0' }}>
          <HiOutlineCheckCircle /> Ready ({ready.length})
        </button>
      </div>

      {error ? <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#FF5252', padding: '10px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{error}</div> : null}

      <div className="billing-layout">
        <div className="billing-list">
          {(tab === 'pending' ? pending : ready).map((o) => (
            <div
              key={o.id}
              className={`billing-order-card ${selected?.id === o.id ? 'active' : ''}`}
              onClick={() => { setSelected(o); setPaymentMethod(null); setClientName(''); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>#{String(o.id).slice(0, 6)}</div>
                  <div style={{ color: '#A0A0A0', fontSize: 12 }}>Table {o.tableNumber}</div>
                </div>
                <span style={{ background: tab === 'pending' ? 'rgba(255,152,0,0.1)' : 'rgba(76,175,80,0.1)', color: tab === 'pending' ? '#FF9800' : '#4CAF50', padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                  {tab === 'pending' ? 'PREP' : 'READY'}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#A0A0A0', fontSize: 11 }}>{o.lines?.length ?? 0} items</span>
                <span style={{ fontWeight: 700, color: '#4CAF50' }}>{Number(o.total).toLocaleString()} RWF</span>
              </div>

              {tab === 'pending' && (
                <button
                  type="button"
                  style={{ width: '100%', marginTop: 10, background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', color: '#4CAF50', padding: '8px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    markReady(o.id)
                  }}
                >
                  Mark Ready
                </button>
              )}
            </div>
          ))}
          {(tab === 'pending' ? pending : ready).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
              <HiOutlineFolderOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>No {tab} orders.</p>
            </div>
          ) : null}
        </div>

        <aside className="billing-detail">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Checkout</span>
            {selected && (
              <button 
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0A0', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                onClick={handlePrintProForma}
              >
                🖨️ Bill
              </button>
            )}
          </div>
          
          <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
             {!selected ? (
               <div style={{ textAlign: 'center', padding: '32px 0', color: '#666' }}>
                 <p style={{ fontSize: 13 }}>Select an order to checkout.</p>
               </div>
             ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                   <div style={{ fontWeight: 700, fontSize: 16 }}>Table {selected.tableNumber}</div>
                   <div style={{ color: '#A0A0A0', fontSize: 11 }}>#{selected.id.slice(0, 8)}</div>
                </div>
                <span style={{ background: tab === 'pending' ? 'rgba(255,152,0,0.1)' : 'rgba(76,175,80,0.1)', color: tab === 'pending' ? '#FF9800' : '#4CAF50', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                  {tab === 'pending' ? 'PENDING' : 'READY'}
                </span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                {selected.lines?.map((l) => (
                  <div key={l.itemName + String(l.quantity)} className="am-order-row" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{l.itemName} <span style={{ color: '#A0A0A0' }}>×{l.quantity}</span></span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{Number(l.lineTotal).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 18, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Total</span>
                <span style={{ color: '#4CAF50' }}>{Number(selected.total).toLocaleString()} RWF</span>
              </div>

              <div style={{ marginTop: 20 }}>
                {tab === 'ready' ? (
                  <>
                    <p style={{ fontSize: 11, color: '#A0A0A0', marginBottom: 10, fontWeight: 700 }}>PAYMENT METHOD</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {[
                        { key: 'CASH', label: 'Cash', icon: <HiOutlineBanknotes /> },
                        { key: 'MOBILE_MONEY', label: 'MoMo', icon: <HiOutlineDevicePhoneMobile /> },
                        { key: 'POS', label: 'Card', icon: <HiOutlineCreditCard /> },
                        { key: 'LOAN', label: 'Credit', icon: <HiOutlineUsers /> }
                      ].map(m => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPaymentMethod(m.key)}
                          style={{ padding: '10px 8px', border: paymentMethod === m.key ? '1px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)', borderRadius: 10, background: paymentMethod === m.key ? 'rgba(76,175,80,0.1)' : 'transparent', color: paymentMethod === m.key ? '#4CAF50' : '#A0A0A0', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                           {m.icon} {m.label}
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'LOAN' && (
                      <div style={{ marginBottom: 16 }}>
                        <input 
                          type="text" 
                          className="am-input"
                          placeholder="Client Name (Required)" 
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      style={{ width: '100%', background: !paymentMethod ? '#222' : '#4CAF50', color: !paymentMethod ? '#666' : '#fff', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: !paymentMethod || busy ? 'not-allowed' : 'pointer', boxShadow: paymentMethod ? '0 4px 15px rgba(76,175,80,0.3)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      disabled={!paymentMethod || busy}
                      onClick={() => pay(paymentMethod)}
                    >
                      <HiOutlinePrinter /> Print Receipt
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button type="button" onClick={() => markReady(selected.id)} style={{ width: '100%', background: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <HiOutlineCheckCircle /> Mark Ready to Pay
                    </button>
                    <button type="button" onClick={() => nav(`/app/orders?edit=${selected.id}`)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0A0', padding: '10px', borderRadius: 12, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <HiOutlinePencilSquare /> Edit Items
                    </button>
                    <button type="button" onClick={() => cancelOrderRequest(selected.id)} style={{ width: '100%', background: 'rgba(255,82,82,0.05)', border: '1px solid rgba(255,82,82,0.2)', color: '#FF5252', padding: '10px', borderRadius: 12, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <HiOutlineTrash /> Cancel Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </aside>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getSession } from '../../api'
import { printReceipt } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
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
    <div className="panel animate-in">
      <div className="section-header">
        <div>
          <h2>Billing</h2>
          <p className="muted">Manage and checkout active orders</p>
        </div>
      </div>

      <div className="segmented xl">
        <button type="button" className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>
          <HiOutlineClock /> Pending
        </button>
        <button type="button" className={tab === 'ready' ? 'on' : ''} onClick={() => setTab('ready')}>
          <HiOutlineCheckCircle /> Ready
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="billing-grid">
        <div className="list">
          {(tab === 'pending' ? pending : ready).map((o) => (
            <div
              key={o.id}
              className={`list-item ${selected?.id === o.id ? 'active' : ''}`}
              role="presentation"
              onClick={() => { setSelected(o); setPaymentMethod(null); setClientName(''); }}
            >
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div>
                  <div className="list-item-title">Order #{String(o.id).slice(0, 8)}</div>
                  <div className="muted" style={{ fontSize: 13 }}>Table {o.tableNumber}</div>
                </div>
                <div className={`badge ${tab === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                  {tab === 'pending' ? 'PREPARING' : 'READY'}
                </div>
              </div>
              
              <div className="row-between">
                <div className="muted" style={{ fontSize: 11 }}>{o.lines?.length ?? 0} items</div>
                <div style={{ fontWeight: 600, color: 'var(--caramel)' }}>{Number(o.total).toLocaleString()} RWF</div>
              </div>

              {tab === 'pending' && (
                <button
                  type="button"
                  className="btn good block"
                  style={{ marginTop: 12, padding: '6px 0', fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    markReady(o.id)
                  }}
                >
                  Mark as Ready
                </button>
              )}
            </div>
          ))}
          {(tab === 'pending' ? pending : ready).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><HiOutlineFolderOpen /></span>
              <p className="muted">No {tab} orders at the moment.</p>
            </div>
          ) : null}
        </div>

        <aside className="detail" style={{ border: '1px solid #E5E0DA', padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#FAF6F0', padding: '16px 24px', borderBottom: '1px solid #E5E0DA', fontWeight: 600, color: '#2D1A11', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Order Checkout</span>
            {selected && (
              <button 
                className="btn ghost" 
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={handlePrintProForma}
              >
                🖨️ Print Bill
              </button>
            )}
          </div>
          
          <div style={{ padding: 24 }}>
             {!selected ? (
               <div className="empty-state" style={{ padding: '20px 0' }}>
                 <p className="muted">Select an order from the list to view details and process payment.</p>
               </div>
             ) : (
            <div className="stack">
              <div className="row-between" style={{ marginBottom: 12 }}>
                <div>
                   <div style={{ fontWeight: 700, fontSize: 16 }}>Table {selected.tableNumber}</div>
                   <div className="muted" style={{ fontSize: 12 }}>#{selected.id.slice(0, 8)}</div>
                </div>
                <div className={`badge ${tab === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                  {tab === 'pending' ? 'PENDING' : 'READY'}
                </div>
              </div>

              <div className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {selected.lines?.map((l) => (
                  <div key={l.itemName + String(l.quantity)} className="row-between" style={{ fontSize: 13, padding: '4px 0' }}>
                    <div>
                      {l.itemName} <span className="muted" style={{ marginLeft: 4 }}>× {l.quantity}</span>
                    </div>
                    <div style={{ fontWeight: 500 }}>{Number(l.lineTotal).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="detail-total">
                <span>Total Amount</span>
                <span className="detail-total-price">{Number(selected.total).toLocaleString()} RWF</span>
              </div>

              <div className="detail-actions" style={{ marginTop: 16 }}>
                {tab === 'ready' ? (
                  <>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#666' }}>Select Payment Method</h4>
                      <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
                        <button
                          type="button"
                          className={`btn ${paymentMethod === 'CASH' ? 'primary' : 'outline'} xl block`}
                          onClick={() => setPaymentMethod('CASH')}
                          style={paymentMethod === 'CASH' ? {} : { borderColor: '#ccc', color: '#333' }}
                        >
                           <HiOutlineBanknotes /> Cash
                        </button>
                        <button
                          type="button"
                          className={`btn ${paymentMethod === 'MOBILE_MONEY' ? 'primary' : 'outline'} xl block`}
                          onClick={() => setPaymentMethod('MOBILE_MONEY')}
                          style={paymentMethod === 'MOBILE_MONEY' ? {} : { borderColor: '#ccc', color: '#333' }}
                        >
                           <HiOutlineDevicePhoneMobile /> Mobile Money
                        </button>
                        <button
                          type="button"
                          className={`btn ${paymentMethod === 'POS' ? 'primary' : 'outline'} xl block`}
                          onClick={() => setPaymentMethod('POS')}
                          style={paymentMethod === 'POS' ? {} : { borderColor: '#ccc', color: '#333' }}
                        >
                           <HiOutlineCreditCard /> POS (Card)
                        </button>
                        <button
                          type="button"
                          className={`btn ${paymentMethod === 'LOAN' ? 'primary' : 'outline'} xl block`}
                          onClick={() => setPaymentMethod('LOAN')}
                          style={paymentMethod === 'LOAN' ? {} : { borderColor: '#ccc', color: '#333' }}
                        >
                          <HiOutlineUsers /> Credit / Loan
                        </button>
                      </div>

                      {paymentMethod === 'LOAN' && (
                        <div className="stack" style={{ gap: 12, padding: 16, background: '#FFF3E0', borderRadius: 12, marginBottom: 16 }}>
                          <h4 style={{ margin: 0, fontSize: 14 }}>Credit Details</h4>
                          <input 
                            type="text" 
                            placeholder="Client Name (Required)" 
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            style={{ borderColor: 'var(--caramel)' }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
                    <button
                      type="button"
                      className="btn outline xl block"
                      style={{ borderColor: 'var(--caramel)', color: 'var(--caramel)', marginBottom: 12 }}
                      disabled={!paymentMethod || busy}
                      onClick={() => pay(paymentMethod)}
                    >
                      <HiOutlinePrinter /> Generate Final Ticket
                    </button>
                  </>
                ) : (
                  <div className="stack" style={{ gap: 12 }}>
                    <button type="button" className="btn good xl block" onClick={() => markReady(selected.id)}>
                      <HiOutlineCheckCircle /> Mark as Ready to Pay
                    </button>
                    <button 
                      type="button" 
                      className="btn outline xl block" 
                      style={{ borderColor: 'var(--mahogany)', color: 'var(--mahogany)' }}
                      onClick={() => nav(`/app/orders?edit=${selected.id}`)}
                    >
                      <HiOutlinePencilSquare /> Edit Order Items
                    </button>
                    <button 
                      type="button" 
                      className="btn outline xl block" 
                      style={{ borderColor: '#E53935', color: '#E53935' }}
                      onClick={() => cancelOrderRequest(selected.id)}
                    >
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

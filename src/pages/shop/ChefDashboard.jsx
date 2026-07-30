import { useState, useEffect, useCallback, useRef } from 'react'
import { api, getSession, clearSession } from '../../api'
import { supabase } from '../../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  HiOutlineCheckCircle,
  HiOutlineQueueList,
  HiOutlineClock
} from 'react-icons/hi2'

function playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

export default function ChefDashboard() {
  const { role } = getSession()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState([])
  const [now, setNow] = useState(Date.now())
  const prevCount = useRef(0)

  const allowed = role === 'CHEF' || role === 'SHOP_ADMIN'

  // Update timer every 10 seconds
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(int)
  }, [])

  const loadQueue = useCallback(async () => {
    try {
      const data = await api('/api/shop/orders/kitchen-queue')
      setOrders(data)
      if (data.length > prevCount.current && prevCount.current !== 0) {
        playDing()
      }
      prevCount.current = data.length
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void loadQueue()

    if (!supabase) return
    const channel = supabase
      .channel('kds-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void loadQueue().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, loadQueue])

  if (!allowed) return <div style={{ padding: 40, textAlign: 'center', fontSize: 24 }}>Unauthorized.</div>

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  async function markReady(id) {
    setBusy(true)
    try {
      await api(`/api/shop/orders/${id}/chef-ready`, { method: 'POST' })
      await loadQueue()
    } catch(e) { 
      alert(e.message) 
    } finally { 
      setBusy(false) 
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#F3F4F6', display: 'flex', flexDirection: 'column' }}>
      {/* KDS Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1F2937', borderBottom: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <HiOutlineQueueList size={28} color="#60A5FA" />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Kitchen Display System</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
             <Clock />
          </div>
          <button 
             onClick={handleLogout}
             style={{ background: '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
        {error && <div style={{ background: '#7F1D1D', color: '#FECACA', padding: 12, borderRadius: 8, marginBottom: 20 }}>{error}</div>}
        
        {orders.length === 0 ? (
          <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
            <HiOutlineCheckCircle size={80} style={{ marginBottom: 16 }} />
            <h2 style={{ margin: 0, fontWeight: 300 }}>Queue is Empty</h2>
            <p>Waiting for new orders...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {orders.map(o => {
              const elapsedMs = now - new Date(o.createdAt).getTime()
              const elapsedMin = Math.floor(elapsedMs / 60000)
              
              let styleTheme = { bg: '#1F2937', border: '#374151', accent: '#60A5FA', text: '#F9FAFB', hl: '#374151', title: '#9CA3AF' } // Normal

              if (elapsedMin >= 30) {
                 styleTheme = { bg: '#7F1D1D', border: '#991B1B', accent: '#FECACA', text: '#FEF2F2', hl: '#991B1B', title: '#FCA5A5' } // Critical
              } else if (elapsedMin >= 10) {
                 styleTheme = { bg: '#78350F', border: '#92400E', accent: '#FDE68A', text: '#FFFBEB', hl: '#92400E', title: '#FCD34D' } // Warning
              }

              return (
                <div key={o.id} style={{ background: styleTheme.bg, border: `2px solid ${styleTheme.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
                  
                  {/* Ticket Header */}
                  <div style={{ padding: '16px 20px', borderBottom: `2px solid ${styleTheme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: styleTheme.title, letterSpacing: 1 }}>Table {o.tableNumber}</div>
                       <div style={{ fontSize: 16, fontWeight: 700, color: styleTheme.text, marginTop: 4 }}>{o.waiterName}</div>
                     </div>
                     <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: styleTheme.accent, fontWeight: 800, fontSize: 22 }}>
                          {elapsedMin}m
                        </div>
                        <div style={{ fontSize: 11, color: styleTheme.title }}>Elapsed</div>
                     </div>
                  </div>

                  {/* Body: Kitchen items only */}
                  <div style={{ padding: 20, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: styleTheme.title, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                      🍳 To Prepare
                    </div>
                    {(o.lines || [])
                      .filter(it => it.needsKitchen !== false) // show all lines (already filtered server-side)
                      .map((it, idx, arr) => (
                        <div key={idx} style={{ padding: '12px 0', borderBottom: idx < arr.length - 1 ? `1px solid ${styleTheme.hl}` : 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
                          <div style={{ background: styleTheme.hl, color: styleTheme.text, padding: '4px 12px', borderRadius: 20, fontWeight: 800, fontSize: 18 }}>
                            {it.quantity}x
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: styleTheme.text }}>
                            {it.itemName}
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Footer Action */}
                  <div style={{ padding: 16, background: styleTheme.hl }}>
                     <button
                       disabled={busy}
                       onClick={() => markReady(o.id)}
                       style={{ 
                         width: '100%', padding: 20, fontSize: 18, fontWeight: 800, 
                         background: styleTheme.text, color: styleTheme.bg, 
                         border: 'none', borderRadius: 8, cursor: 'pointer',
                         opacity: busy ? 0.7 : 1, transition: 'all 0.2s'
                       }}
                     >
                       ✅ READY
                     </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
  useEffect(() => {
     const int = setInterval(() => setTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})), 60000)
     return () => clearInterval(int)
  }, [])
  return <div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><HiOutlineClock /> {time}</div>
}

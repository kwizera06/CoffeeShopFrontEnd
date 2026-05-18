import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getSession } from '../../api'
import { supabase } from '../../supabaseClient'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { 
  HiOutlineCalendarDays,
  HiOutlineCurrencyDollar,
  HiOutlineBanknotes,
  HiOutlineDevicePhoneMobile,
  HiOutlineCreditCard,
  HiOutlineArrowTrendingUp,
  HiOutlineCheckCircle,
  HiOutlineBell,
  HiOutlineExclamationTriangle,
  HiOutlineArchiveBox,
  HiOutlineShoppingCart,
  HiOutlinePlusCircle,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineChevronDown,
  HiOutlineFire
} from 'react-icons/hi2'
import { IoCafeOutline } from 'react-icons/io5'
import { MdOutlineLocalFireDepartment, MdOutlineReceiptLong } from 'react-icons/md'

export default function Owner() {
  const nav = useNavigate()
  const { role } = getSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'overview'
  const setTab = (t) => setSearchParams({ tab: t })
  const [error, setError] = useState('')

  const [overview, setOverview] = useState(null)
  const [menu, setMenu] = useState([])
  const [staff, setStaff] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [requestedOrders, setRequestedOrders] = useState([])

  const [menuForm, setMenuForm] = useState({ id: '', name: '', price: '', category: 'Hot Coffee', available: true, productRecipe: [] })
  const [tempRecipeLine, setTempRecipeLine] = useState({ ingredient_id: '', quantity_required: '' })
  
  const SUB_CATEGORIES = [
    'Hot Coffee', 'Iced Coffee', 'Tea & Hot Drinks', 'Soft Drinks', 
    'Beer & Alcohol', 'Juice & Smoothies', 'Fast Food', 
    'Main Food / Meals', 'Bakery & Desserts', 'Snacks'
  ]

  const CATEGORY_MAP = {
    'Hot Coffee': 'DRINK',
    'Iced Coffee': 'DRINK',
    'Tea & Hot Drinks': 'DRINK',
    'Soft Drinks': 'DRINK',
    'Beer & Alcohol': 'DRINK',
    'Juice & Smoothies': 'DRINK',
    'Fast Food': 'FOOD',
    'Main Food / Meals': 'FOOD',
    'Bakery & Desserts': 'FOOD',
    'Snacks': 'FOOD'
  }
  const [staffForm, setStaffForm] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
  })
  const [ingForm, setIngForm] = useState({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0, buying_price: 0 })
  
  const [selectedRecipeItem, setSelectedRecipeItem] = useState(null)
  const [recipeLines, setRecipeLines] = useState([])
  const [recipeForm, setRecipeForm] = useState({ ingredient_id: '', quantity_required: 0 })

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [reportDay, setReportDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [dailyRows, setDailyRows] = useState([])
  const [monthlyRows, setMonthlyRows] = useState([])
  const [charts, setCharts] = useState({ hourly: [], topProducts: [] })
  const [shifts, setShifts] = useState([])
  const [categorySales, setCategorySales] = useState({})
  const [methodSales, setMethodSales] = useState({ Cash: 0, MoMo: 0, POS: 0, Total: 0 })

  const allowed = role === 'SHOP_ADMIN'

  const reloadCore = useCallback(async () => {
    const [o, m, s, i] = await Promise.all([
      api(`/api/shop/owner/overview?date=${reportDay}`),
      api('/api/shop/menu'),
      api('/api/shop/staff'),
      api('/api/shop/owner/inventory'),
    ])
    setOverview(o)
    setMenu(m)
    setStaff(s)
    setIngredients(i)
  }, [reportDay])

  useEffect(() => {
    if (!allowed) {
      return
    }
    
    void reloadCore().catch((e) => setError(e.message))

    if (!supabase) return

    // Subscribe to payments to refresh overview cards in real-time
    const channel = supabase
      .channel('owner-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `tenant_id=eq.${getSession().tenantId}`,
        },
        () => {
          void reloadCore().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [allowed, reloadCore])

  useEffect(() => {
    if (!allowed) {
      return
    }
    if (selectedRecipeItem) {
      api(`/api/shop/owner/recipes/${selectedRecipeItem.id}`)
        .then(setRecipeLines)
        .catch(e => setError(e.message))
    }
  }, [allowed, selectedRecipeItem])

  useEffect(() => {
    if (!allowed) {
      return
    }
    if (tab !== 'reports' && tab !== 'overview') {
      return
    }
      Promise.all([
        api(`/api/shop/owner/reports/daily?date=${reportDay}`),
        api(`/api/shop/owner/reports/monthly?year=${month.year}&month=${month.month}`),
        api(`/api/shop/owner/reports/charts?date=${reportDay}`),
        api(`/api/shop/shifts?date=${reportDay}`),
      ])
        .then(([d, moon, c, s]) => {
          setDailyRows(d)
          setMonthlyRows(moon)
          setCharts(c)
          setShifts(s)
          
          // Calculate Category & Method Sales from Daily
          const catMap = {}
          const metMap = { Cash: 0, MoMo: 0, POS: 0, Total: 0 }
          d.forEach(row => {
            metMap[row.methodLabel] = (metMap[row.methodLabel] || 0) + Number(row.amount)
            metMap.Total += Number(row.amount)
            if (row.rawItems) {
              row.rawItems.forEach(item => {
                const cat = item.category || 'Uncategorized'
                catMap[cat] = (catMap[cat] || 0) + (Number(item.price) * (item.qty || 1))
              })
            }
          })
          setCategorySales(catMap)
          setMethodSales(metMap)
        })
        .catch((e) => setError(e.message))
    }, [allowed, tab, reportDay, month.year, month.month])

  const fetchRequestedOrders = useCallback(async () => {
    try {
      const data = await api('/api/shop/requisitions');
      setRequestedOrders(data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (allowed && tab === 'requested_order') {
      fetchRequestedOrders();
    }
  }, [allowed, tab, fetchRequestedOrders]);

  async function updateRequestedOrderStatus(id, status) {
    setError('');
    try {
      await api(`/api/shop/requisitions/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      await fetchRequestedOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveMenu(e) {
    e.preventDefault()
    setError('')
    const payload = {
      name: menuForm.name,
      price: Number(menuForm.price),
      category: menuForm.category,
      category_group: CATEGORY_MAP[menuForm.category] || 'DRINK',
      available: menuForm.available,
      recipe: menuForm.productRecipe
    }
    try {
      if (menuForm.id) {
        await api(`/api/shop/menu/${menuForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/api/shop/menu', { method: 'POST', body: JSON.stringify(payload) })
      }
      setMenuForm({ id: '', name: '', price: '', category: 'Hot Coffee', available: true })
      setSelectedRecipeItem(null)
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteMenu(id) {
    if (!window.confirm('Remove this menu item?')) {
      return
    }
    setError('')
    try {
      await api(`/api/shop/menu/${id}`, { method: 'DELETE' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  async function editMenu(mi) {
    let currentRecipe = [];
    try {
      currentRecipe = await api(`/api/shop/owner/recipes/${mi.id}`);
    } catch(e) {}

    setMenuForm({ 
      id: mi.id, 
      name: mi.name, 
      price: String(mi.price), 
      category: mi.category || 'Hot Coffee',
      available: mi.available,
      productRecipe: currentRecipe.map(r => ({ ingredient_id: r.ingredient_id, quantity_required: r.quantity_required, name: r.ingredients?.name, unit: r.ingredients?.unit }))
    })
    setSelectedRecipeItem(mi)
  }

  async function saveStaff(e) {
    e.preventDefault()
    setError('')
    try {
      if (staffForm.id) {
        await api(`/api/shop/staff/${staffForm.id}`, { method: 'PUT', body: JSON.stringify(staffForm) })
      } else {
        await api('/api/shop/staff', { method: 'POST', body: JSON.stringify(staffForm) })
      }
      setStaffForm({ id: '', name: '', email: '', password: '', role: 'CASHIER' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  async function editStaff(u) {
    setStaffForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: '', // Don't show hashed password, leave blank for 'no change'
      role: u.role
    })
  }

  async function deleteStaff(userId) {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;
    setError('')
    try {
      await api(`/api/shop/staff/${userId}`, { method: 'DELETE' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="panel owner" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
      {error ? <div className="error" style={{ marginBottom: 20 }}>{error}</div> : null}

      {tab === 'overview' ? (
        overview ? (
          <section className="dashboard-overview animate-in">
            {/* Dashboard Header */}
            <header className="dashboard-header">
              <div className="dashboard-title">
                <h1>Admin Dashboard</h1>
                <p>Here's what's happening with your coffee shop today.</p>
              </div>
              <div className="date-selector" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.getElementById('dash-date').showPicker()}>
                <HiOutlineCalendarDays />
                <span>
                  {new Date(reportDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <input 
                  id="dash-date"
                  type="date" 
                  value={reportDay}
                  onChange={(e) => setReportDay(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', right: 0 }}
                />
                <HiOutlineChevronDown style={{ fontSize: 10, opacity: 0.5 }} />
              </div>
            </header>

            {/* Top Metrics Row */}
            <div className="metric-cards-grid" style={{ marginBottom: 24 }}>
              <div className="m-card" onClick={() => setTab('reports')}>
                <div className="m-card-header">
                  <span className="m-icon"><HiOutlineCurrencyDollar /></span>
                  <span className="m-title">TOTAL REVENUE</span>
                </div>
                <div className="m-value">{Number(overview?.todayRevenue ?? 0).toLocaleString()} RWF</div>
                <div className="m-trend positive">↑ Warm sales today</div>
              </div>
              
              <div className="m-card" onClick={() => setTab('reports')}>
                <div className="m-card-header">
                  <span className="m-icon"><HiOutlineBanknotes /></span>
                  <span className="m-title">CASH SALES</span>
                </div>
                <div className="m-value">{Number(overview?.todayCashSales ?? 0).toLocaleString()} RWF</div>
                <div className="m-trend neutral">• Physical cash today</div>
              </div>

              <div className="m-card" onClick={() => setTab('reports')}>
                <div className="m-card-header">
                  <span className="m-icon"><HiOutlineDevicePhoneMobile /></span>
                  <span className="m-title">MOMO SALES</span>
                </div>
                <div className="m-value">{Number(overview?.todayMomoSales ?? 0).toLocaleString()} RWF</div>
                <div className="m-trend neutral">• Mobile money today</div>
              </div>

              <div className="m-card" onClick={() => setTab('reports')}>
                <div className="m-card-header">
                  <span className="m-icon"><HiOutlineCreditCard /></span>
                  <span className="m-title">POS SALES</span>
                </div>
                <div className="m-value">{Number(overview?.todayPosSales ?? 0).toLocaleString()} RWF</div>
                <div className="m-trend neutral">• Card payments today</div>
              </div>

              <div className="m-card" onClick={() => setTab('reports')}>
                <div className="m-card-header">
                  <span className="m-icon"><HiOutlineArrowTrendingUp /></span>
                  <span className="m-title">TODAY'S PROFIT</span>
                </div>
                <div className="m-value">{Number(overview?.todayProfit ?? 0).toLocaleString()} RWF</div>
                <div className="m-trend positive">↑ Revenue minus costs</div>
              </div>
            </div>

            {/* Main Row: Chart + Status Cards */}
            <div className="main-dashboard-grid">
              <div className="chart-card" style={{ minWidth: 0 }}>
                <h3>Sales Overview <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>Today ▼</span></h3>
                <div style={{ width: '100%', height: 320, minWidth: 0 }}>
                  <ResponsiveContainer>
                    <AreaChart data={charts.hourly?.length > 0 ? charts.hourly : [{ hour: '6AM', total: 0 }, { hour: '9AM', total: 0 }, { hour: '12PM', total: 0 }, { hour: '3PM', total: 0 }, { hour: '6PM', total: 0 }, { hour: '9PM', total: 0 }]}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F0EB" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#AAA' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#AAA' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                      />
                      <Area type="monotone" dataKey="total" name="Revenue (RWF)" stroke="#4CAF50" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="secondary-grid">
                <div className="m-card mini" onClick={() => nav('/app/orders')}>
                  <div className="m-card-header">
                    <span className="m-icon"><HiOutlineCheckCircle /></span>
                    <span className="m-title">COMPLETED</span>
                  </div>
                  <div className="m-value" style={{ fontSize: 24 }}>{overview?.todayPaidOrdersCount ?? 0}</div>
                  <div className="m-trend positive">↑ Serving fast</div>
                </div>
                <div className="m-card mini" onClick={() => nav('/app/orders')}>
                  <div className="m-card-header">
                    <span className="m-icon"><HiOutlineFire /></span>
                    <span className="m-title">IN PREP</span>
                  </div>
                  <div className="m-value" style={{ fontSize: 24 }}>{overview?.pendingKitchenCount ?? 0}</div>
                  <div className="m-trend neutral">• Freshly roasting</div>
                </div>
                <div className="m-card mini" onClick={() => nav('/app/orders')}>
                  <div className="m-card-header">
                    <span className="m-icon"><HiOutlineBell /></span>
                    <span className="m-title">WAITING</span>
                  </div>
                  <div className="m-value" style={{ fontSize: 24 }}>{overview?.readyCount ?? 0}</div>
                  <div className="m-trend neutral">• Ready to serve</div>
                </div>
                <div className="m-card mini" onClick={() => setTab('inventory')}>
                  <div className="m-card-header">
                    <span className="m-icon"><HiOutlineExclamationTriangle /></span>
                    <span className="m-title">LOW STOCK</span>
                  </div>
                  <div className="m-value" style={{ fontSize: 24 }}>{overview?.lowStockCount ?? 0}</div>
                  <div className="m-trend warning">Check inventory</div>
                </div>
                <div className="m-card mini span-2" onClick={() => setTab('inventory')}>
                  <div className="m-card-header">
                    <span className="m-icon"><HiOutlineArchiveBox /></span>
                    <span className="m-title">INVENTORY VALUE</span>
                  </div>
                  <div className="m-value" style={{ fontSize: 24 }}>{Number(overview?.inventoryValue ?? 0).toLocaleString()} RWF</div>
                  <div className="m-trend neutral">• Total asset value</div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Top Items + Payment Donut + Activity + Actions */}
            <div className="main-dashboard-grid" style={{ marginTop: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Top Items */}
                <div className="chart-card">
                  <h3>Top Selling Items <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>Today ▼</span></h3>
                  <div className="top-items-list">
                    {(charts.topProducts || []).slice(0, 5).map((item, idx) => (
                      <div key={idx} className="top-item">
                        <span className="top-item-rank">{idx + 1}</span>
                        <div className="top-item-img"><IoCafeOutline /></div>
                        <div className="top-item-info">
                          <div className="top-item-name">{item.name}</div>
                          <div className="top-item-qty">{item.value} sold</div>
                        </div>
                        <div className="top-item-val">{Number(item.revenue || 0).toLocaleString()} RWF</div>
                      </div>
                    ))}
                    {(!charts.topProducts || charts.topProducts.length === 0) && <div className="muted italic" style={{ fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No sales data yet.</div>}
                  </div>
                </div>

                {/* Sales by Payment Method */}
                <div className="chart-card" style={{ minWidth: 0 }}>
                   <h3>Sales by Payment Method</h3>
                   <div style={{ height: 180, minWidth: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie 
                            data={[
                              { name: 'Cash', value: overview?.todayCashSales || 0 },
                              { name: 'MoMo', value: overview?.todayMomoSales || 0 },
                              { name: 'POS', value: overview?.todayPosSales || 0 }
                            ].filter(x => x.value > 0)}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                             <Cell fill="#4CAF50" />
                             <Cell fill="#3D1F08" />
                             <Cell fill="#C3A68D" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="donut-legend">
                      <div className="legend-item">
                        <div className="legend-label"><span className="legend-color" style={{ background: '#4CAF50' }}></span> Cash</div>
                        <div className="legend-val">{Number(overview?.todayCashSales || 0).toLocaleString()} RWF</div>
                      </div>
                      <div className="legend-item">
                        <div className="legend-label"><span className="legend-color" style={{ background: '#3D1F08' }}></span> MoMo</div>
                        <div className="legend-val">{Number(overview?.todayMomoSales || 0).toLocaleString()} RWF</div>
                      </div>
                      <div className="legend-item">
                        <div className="legend-label"><span className="legend-color" style={{ background: '#C3A68D' }}></span> POS</div>
                        <div className="legend-val">{Number(overview?.todayPosSales || 0).toLocaleString()} RWF</div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="stack" style={{ gap: 24 }}>
                {/* Recent Activity */}
                <div className="chart-card" style={{ flex: 1 }}>
                  <div className="row-between" style={{ marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>Recent Activity</h3>
                    <button className="btn outline tiny" style={{ fontSize: 10 }}>View all</button>
                  </div>
                  <div className="activity-list">
                    {dailyRows.slice(0, 3).map((row, idx) => (
                      <div key={idx} className="activity-item">
                        <div className="activity-icon"><MdOutlineReceiptLong /></div>
                        <div className="activity-info">
                          <div className="activity-name">Payment received</div>
                          <div className="activity-meta">#{row.orderId.slice(0, 8)} - {row.methodLabel}</div>
                        </div>
                        <div className="activity-time">{new Date(row.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ))}
                    
                    {overview?.lowStockCount > 0 && (
                      <div className="activity-item">
                        <div className="activity-icon" style={{ background: '#FFF3E0' }}><HiOutlineExclamationTriangle style={{ color: '#E67E22' }} /></div>
                        <div className="activity-info">
                          <div className="activity-name">Low Stock Alert</div>
                          <div className="activity-meta">{overview.lowStockCount} items need attention</div>
                        </div>
                        <div className="activity-time">Live</div>
                      </div>
                    )}
 
                    {dailyRows.length === 0 && (
                      <div className="activity-item">
                        <div className="activity-icon"><IoCafeOutline /></div>
                        <div className="activity-info">
                          <div className="activity-name">Shop is open</div>
                          <div className="activity-meta">Waiting for first order</div>
                        </div>
                        <div className="activity-time">Today</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="chart-card">
                  <h3>Quick Actions</h3>
                  <div className="quick-actions-grid">
                    <div className="action-btn" onClick={() => nav('/app/orders')}>
                       <span className="action-icon"><HiOutlineShoppingCart /></span>
                       <span className="action-text">New Order</span>
                    </div>
                    <div className="action-btn" onClick={() => setTab('inventory')}>
                       <span className="action-icon"><HiOutlinePlusCircle /></span>
                       <span className="action-text">Add Inventory</span>
                    </div>
                    <div className="action-btn" onClick={() => setTab('reports')}>
                       <span className="action-icon"><HiOutlineChartBar /></span>
                       <span className="action-text">View Reports</span>
                    </div>
                    <div className="action-btn" onClick={() => setTab('staff')}>
                       <span className="action-icon"><HiOutlineUsers /></span>
                       <span className="action-text">Manage Staff</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid #F5F0EB', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#AAA' }}>
               <span>© 2025 Mama Prince's Coffee Shop. All rights reserved.</span>
               <span>Made with ☕ and ❤️</span>
            </footer>
          </section>
        ) : (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading premium insights…</span>
          </div>
        )
      ) : null}

      {tab === 'menu' ? (
        <section className="stack">
          <form onSubmit={saveMenu} className="grid-form">
            <label className="field span-2">
              <span>Name</span>
              <input
                value={menuForm.name}
                onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select 
                value={menuForm.category} 
                onChange={(e) => setMenuForm((f) => ({ ...f, category: e.target.value }))}
              >
                {SUB_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={menuForm.price}
                onChange={(e) => setMenuForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </label>
            <label className="field chk">
              <input
                type="checkbox"
                checked={menuForm.available}
                onChange={(e) => setMenuForm((f) => ({ ...f, available: e.target.checked }))}
              />
              <span>Available</span>
            </label>
            <div className="span-2 card" style={{ padding: 16, background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
               <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                 <HiOutlineDocumentText /> Recipe (Inventory Deduction)
               </h4>
               
               <div className="grid-form" style={{ gridTemplateColumns: '2fr 1fr auto', alignItems: 'flex-end', gap: 10 }}>
                  <label className="field">
                    <span>Ingredient</span>
                    <select 
                      value={tempRecipeLine.ingredient_id} 
                      onChange={e => setTempRecipeLine(f => ({ ...f, ingredient_id: e.target.value }))}
                    >
                      <option value="">-- Select --</option>
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Qty</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={tempRecipeLine.quantity_required} 
                      onChange={e => setTempRecipeLine(f => ({ ...f, quantity_required: e.target.value }))} 
                    />
                  </label>
                  <button 
                    type="button" 
                    className="btn ghost" 
                    style={{ height: 42 }}
                    onClick={() => {
                      if (!tempRecipeLine.ingredient_id || !tempRecipeLine.quantity_required) return;
                      const ing = ingredients.find(x => x.id === tempRecipeLine.ingredient_id);
                      setMenuForm(f => ({
                        ...f,
                        productRecipe: [...f.productRecipe, { ...tempRecipeLine, name: ing?.name, unit: ing?.unit }]
                      }))
                      setTempRecipeLine({ ingredient_id: '', quantity_required: '' })
                    }}
                  >
                    Add
                  </button>
               </div>

               <div className="stack" style={{ marginTop: 12, gap: 8 }}>
                 {menuForm.productRecipe.map((line, idx) => (
                   <div key={idx} className="row-between" style={{ padding: '8px 12px', background: 'var(--bg-panel)', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)' }}>
                      <span><strong>{line.name}</strong>: {line.quantity_required} {line.unit}</span>
                      <button 
                        type="button" 
                        className="btn warn tiny" 
                        onClick={() => setMenuForm(f => ({ ...f, productRecipe: f.productRecipe.filter((_, i) => i !== idx) }))}
                      >
                        Remove
                      </button>
                   </div>
                 ))}
                 {menuForm.productRecipe.length === 0 && <div className="muted italic text-sm">No ingredients added yet.</div>}
               </div>
            </div>

            <div className="span-2 row-actions">
              <button className="btn primary xl" type="submit">
                {menuForm.id ? 'Save Changes' : 'Add to Menu'}
              </button>
              {menuForm.id ? (
                <button type="button" className="btn ghost" onClick={() => {
                  setMenuForm({ id: '', name: '', price: '', category: 'Hot Coffee', available: true, productRecipe: [] })
                  setSelectedRecipeItem(null)
                }}>
                  Done / Close
                </button>
              ) : null}
            </div>
          </form>

          {menuForm.id && (
            <div className="card" style={{ marginTop: 20, border: '2px solid var(--caramel-light)' }}>
              <h3>📜 Ingredients & Recipe for {menuForm.name}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Specify what this product consumes when sold.</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/api/shop/owner/recipes', { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                      menu_item_id: menuForm.id,
                      ingredient_id: recipeForm.ingredient_id,
                      quantity_required: Number(recipeForm.quantity_required)
                    }) 
                  });
                  setRecipeForm({ ingredient_id: '', quantity_required: 0 });
                  const updated = await api(`/api/shop/owner/recipes/${menuForm.id}`);
                  setRecipeLines(updated);
                } catch (err) { setError(err.message) }
              }} className="grid-form">
                <label className="field">
                  <span>Ingredient</span>
                  <select 
                    value={recipeForm.ingredient_id} 
                    onChange={e => setRecipeForm(f => ({ ...f, ingredient_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Choose Ingredient --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Usage Qty</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={recipeForm.quantity_required} 
                    onChange={e => setRecipeForm(f => ({ ...f, quantity_required: e.target.value }))} 
                    required 
                  />
                </label>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className="btn primary" style={{ height: 42, width: '100%' }}>Add Step</button>
                </div>
              </form>

              <div className="table tiny" style={{ marginTop: 16 }}>
                {recipeLines.map(line => (
                  <div key={line.id} className="row" style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{line.ingredients?.name}</div>
                    <div>{line.quantity_required} {line.ingredients?.unit}</div>
                    <div className="row-actions">
                      <button 
                        className="btn warn" 
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={async () => {
                          try {
                            await api(`/api/shop/owner/recipes/${line.id}`, { method: 'DELETE' });
                            const updated = await api(`/api/shop/owner/recipes/${menuForm.id}`);
                            setRecipeLines(updated);
                          } catch (err) { setError(err.message) }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {recipeLines.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center' }} className="muted text-sm italic">
                    No ingredients linked to this recipe yet.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="table owner-menu-table">
            <div className="row head">
              <div>Name</div>
              <div>Category</div>
              <div>Price</div>
              <div>Avail</div>
              <div></div>
            </div>
            {menu.map((m) => (
              <div key={m.id} className="row">
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{m.category || 'Uncategorized'}</div>
                <div>{Number(m.price).toLocaleString()} RWF</div>
                <div>
                  <span className={`badge ${m.available ? 'badge-success' : 'badge-danger'}`}>
                    {m.available ? 'AVAILABLE' : 'HIDDEN'}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn ghost" onClick={() => editMenu(m)}>Edit</button>
                  <button type="button" className="btn warn" style={{ padding: '4px 8px' }} onClick={() => deleteMenu(m.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'staff' ? (
        <section className="stack">
          <form onSubmit={saveStaff} className="grid-form card" style={{ padding: 24, background: '#FFF' }}>
            <h3 style={{ gridColumn: 'span 2', marginBottom: 12 }}>
              {staffForm.id ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h3>
            <label className="field">
              <span>Name</span>
              <input
                value={staffForm.name}
                onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>{staffForm.id ? 'New Password (leave blank to keep)' : 'Temporary password'}</span>
              <input
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                required={!staffForm.id}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="CASHIER">Shop Staff (Waiter + Billing)</option>
              </select>
            </label>
            <div className="span-2" style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn primary xl" type="submit">
                {staffForm.id ? 'Update Staff Member' : 'Register Staff'}
              </button>
              {staffForm.id && (
                <button type="button" className="btn ghost" onClick={() => setStaffForm({ id: '', name: '', email: '', password: '', role: 'CASHIER' })}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="table staff-table">
            <div className="row head">
              <div>Name</div>
              <div>Email</div>
              <div>Role</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            {staff.map((u) => (
              <div key={u.id} className="row">
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="muted">{u.email}</div>
                <div>
                  <span className="badge badge-neutral">{u.role === 'SHOP_ADMIN' ? 'OWNER' : 'STAFF'}</span>
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                   {u.role !== 'SHOP_ADMIN' && (
                     <>
                        <button type="button" className="btn ghost tiny" onClick={() => editStaff(u)}>Edit</button>
                        <button type="button" className="btn warn tiny" onClick={() => deleteStaff(u.id)}>Remove</button>
                     </>
                   )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'reports' ? (
        <section className="stack">
          <div className="grid-2">
            <label className="field">
              <span>Daily report</span>
              <input type="date" value={reportDay} onChange={(e) => setReportDay(e.target.value)} />
              <div className="muted">{today}</div>
            </label>
            <label className="field">
              <span>Monthly report</span>
              <div className="row-actions">
                <input
                  className="small-input"
                  type="number"
                  value={month.year}
                  onChange={(e) => setMonth((m) => ({ ...m, year: Number(e.target.value) }))}
                />
                <input
                  className="small-input"
                  type="number"
                  min="1"
                  max="12"
                  value={month.month}
                  onChange={(e) => setMonth((m) => ({ ...m, month: Number(e.target.value) }))}
                />
              </div>
            </label>
          </div>

          <div className="metric-cards-grid" style={{ marginBottom: 32 }}>
            <div className="m-card mini" style={{ borderColor: '#4CAF50' }}>
               <div className="m-label">Cash Revenue</div>
               <div className="m-value small">{methodSales.Cash.toLocaleString()} RWF</div>
            </div>
            <div className="m-card mini" style={{ borderColor: '#2196F3' }}>
               <div className="m-label">MoMo Revenue</div>
               <div className="m-value small">{methodSales.MoMo.toLocaleString()} RWF</div>
            </div>
            <div className="m-card mini" style={{ borderColor: '#FF9800' }}>
               <div className="m-label">POS/Card Revenue</div>
               <div className="m-value small">{methodSales.POS.toLocaleString()} RWF</div>
            </div>
            <div className="m-card mini">
               <div className="m-label">Total Day Sales</div>
               <div className="m-value small">{methodSales.Total.toLocaleString()} RWF</div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 24, marginBottom: 32 }}>
             <div className="card">
                <h3>Sales by Category</h3>
                <div className="table tiny">
                  <div className="row head">
                     <div>Category</div>
                     <div>Total Sold</div>
                  </div>
                  {Object.entries(categorySales).map(([cat, total]) => (
                    <div key={cat} className="row">
                       <div style={{ fontWeight: 600 }}>{cat}</div>
                       <div>{total.toLocaleString()} RWF</div>
                    </div>
                  ))}
                  {Object.keys(categorySales).length === 0 && <div className="muted pad italic">No sales yet today</div>}
                </div>
             </div>

             <div className="card">
                <h3>Shift Summary (Updated)</h3>
                <div className="table tiny">
                   <div className="row head">
                      <div>Shift</div>
                      <div>Expected</div>
                      <div>Given</div>
                      <div>Balance</div>
                   </div>
                     {shifts.map((s, idx) => {
                       const exp = (s.total_cash_sales || 0) + (s.total_momo_sales || 0)
                       const giv = (s.actual_cash_on_hand || 0) + (s.actual_momo_on_hand || 0)
                       const bal = giv - exp
                       return (
                         <div key={idx} className="row" style={{ borderLeft: `4px solid ${bal === 0 ? '#4CAF50' : bal < 0 ? '#f44336' : '#FF9800'}` }}>
                            <div style={{ fontSize: 11 }}>
                               <strong>{s.opened_by?.name || 'Staff'}</strong><br/>
                               <span className="muted">{new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}</span>
                            </div>
                            <div style={{ fontSize: 11 }}>
                               Cash: {Number(s.total_cash_sales || 0).toLocaleString()}<br/>
                               MoMo: {Number(s.total_momo_sales || 0).toLocaleString()}<br/>
                               <span className="muted">POS (Info): {Number(s.total_pos_sales || 0).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 11 }}>
                               Cash: {Number(s.actual_cash_on_hand || 0).toLocaleString()}<br/>
                               MoMo: {Number(s.actual_momo_on_hand || 0).toLocaleString()}
                            </div>
                            <div style={{ fontWeight: 700, color: (bal >= 0 ? '#4CAF50' : '#f44336'), fontSize: 13 }}>
                               {bal > 0 ? '+' : ''}{bal.toLocaleString()}
                            </div>
                         </div>
                       )
                     })}
                   {shifts.length === 0 && <div className="muted pad italic">No shift reconciliation data yet</div>}
                </div>
             </div>
          </div>


          <div className="grid-2 chart-row">
            <div className="card chart-card" style={{ minWidth: 0 }}>
              <h3>Hourly Sales Volume</h3>
              <div style={{ width: '100%', minHeight: 300, minWidth: 0 }}>
                {charts.hourly?.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={charts.hourly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,235,221,0.08)" vertical={false} />
                      <XAxis dataKey="hour" fontSize={11} tick={{ fill: 'rgba(245,235,221,0.45)' }} axisLine={false} tickLine={false} />
                      <YAxis fontSize={11} tick={{ fill: 'rgba(245,235,221,0.45)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#2C1810', border: '1px solid rgba(196,164,132,0.25)', borderRadius: 10, color: '#F5EBDD', fontSize: 13 }}
                        cursor={{ fill: 'rgba(196,164,132,0.08)' }}
                      />
                      <Bar dataKey="total" fill="#C4A484" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card chart-card" style={{ minWidth: 0 }}>
              <h3>Top Selling Products</h3>
              <div style={{ width: '100%', minHeight: 300, minWidth: 0 }}>
                {charts.topProducts?.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={charts.topProducts}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#C4A484"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: 'rgba(245,235,221,0.3)' }}
                      >
                        {charts.topProducts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#C4A484', '#6F4E37', '#D2B48C', '#8B6347', '#3E2723'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#2C1810', border: '1px solid rgba(196,164,132,0.25)', borderRadius: 10, color: '#F5EBDD', fontSize: 13 }}
                      />
                      <Legend wrapperStyle={{ color: 'rgba(245,235,221,0.6)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <h3>Daily payments</h3>
          <div className="table report-table">
            <div className="row head">
              <div>Time</div>
              <div>Order</div>
              <div>Products</div>
              <div>Method</div>
              <div>Amount</div>
            </div>
            {dailyRows.map((r) => (
              <div key={`${r.at}-${r.orderId}`} className="row">
                <div>{new Date(r.at).toLocaleString()}</div>
                <div><span className="muted">#</span>{String(r.orderId).slice(0, 8)}</div>
                <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {r.rawItems && Object.entries(r.rawItems.reduce((acc, curr) => {
                    const cat = curr.category || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(`${curr.qty}x ${curr.name}`);
                    return acc;
                  }, {})).map(([cat, prods]) => (
                    <div key={cat}>
                      <span style={{ fontWeight: 600, color: '#C4A484', fontSize: '11px', textTransform: 'uppercase' }}>{cat}:</span>{' '}
                      <span className="muted">{prods.join(', ')}</span>
                    </div>
                  ))}
                  {!r.rawItems && <div className="muted">{r.items || 'No items'}</div>}
                </div>
                <div>{r.methodLabel}</div>
                <div className="bold">{Number(r.amount).toLocaleString()} RWF</div>
              </div>
            ))}
          </div>

          <h3>Monthly payments</h3>
          <div className="table report-table">
            <div className="row head">
              <div>Time</div>
              <div>Order</div>
              <div>Products</div>
              <div>Method</div>
              <div>Amount</div>
            </div>
            {monthlyRows.map((r) => (
              <div key={`${r.at}-${r.orderId}`} className="row">
                <div>{new Date(r.at).toLocaleString()}</div>
                <div><span className="muted">#</span>{String(r.orderId).slice(0, 8)}</div>
                <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {r.rawItems && Object.entries(r.rawItems.reduce((acc, curr) => {
                    const cat = curr.category || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(`${curr.qty}x ${curr.name}`);
                    return acc;
                  }, {})).map(([cat, prods]) => (
                    <div key={cat}>
                      <span style={{ fontWeight: 600, color: '#C4A484', fontSize: '11px', textTransform: 'uppercase' }}>{cat}:</span>{' '}
                      <span className="muted">{prods.join(', ')}</span>
                    </div>
                  ))}
                  {!r.rawItems && <div className="muted">{r.items || 'No items'}</div>}
                </div>
                <div>{r.methodLabel}</div>
                <div className="bold">{Number(r.amount).toLocaleString()} RWF</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'inventory' ? (
        <section className="stack">
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/api/shop/owner/inventory', { method: 'POST', body: JSON.stringify(ingForm) });
              setIngForm({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0, buying_price: 0 });
              await reloadCore();
            } catch(err) { setError(err.message) }
          }} className="grid-form">
            <label className="field">
              <span>Ingredient name</span>
              <input value={ingForm.name} onChange={e => setIngForm(f => ({...f, name: e.target.value}))} required />
            </label>
            <label className="field">
              <span>Stock level</span>
              <input type="number" value={ingForm.stock_level} onChange={e => setIngForm(f => ({...f, stock_level: Number(e.target.value)}))} required />
            </label>
            <label className="field">
              <span>Unit</span>
              <select value={ingForm.unit} onChange={e => setIngForm(f => ({...f, unit: e.target.value}))}>
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="pcs">pcs</option>
                <option value="l">l</option>
                <option value="kg">kg</option>
              </select>
            </label>
            <label className="field">
              <span>Min threshold (Warning)</span>
              <input type="number" value={ingForm.min_threshold} onChange={e => setIngForm(f => ({...f, min_threshold: Number(e.target.value)}))} />
            </label>
            <label className="field">
              <span>Unit Price (RWF)</span>
              <input type="number" value={ingForm.buying_price} onChange={e => setIngForm(f => ({...f, buying_price: Number(e.target.value)}))} />
            </label>
            <div className="span-2">
              <button className="btn primary xl" type="submit">{ingForm.id ? 'Update' : 'Add Ingredient'}</button>
            </div>
          </form>

          <div className="table inventory-table">
            <div className="row head">
              <div>Ingredient</div>
              <div>Current Stock</div>
              <div>Min</div>
              <div>Price</div>
              <div>Status</div>
              <div></div>
            </div>
            {ingredients.map(ing => {
              const isLow = ing.stock_level < ing.min_threshold;
              return (
                <div key={ing.id} className={`row ${isLow ? 'warn-row' : ''}`}>
                  <div style={{ fontWeight: 600 }}>{ing.name}</div>
                  <div>{ing.stock_level} {ing.unit}</div>
                  <div className="muted">{ing.min_threshold}</div>
                  <div className="muted">{ing.buying_price || 0} RWF</div>
                  <div>
                    <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                      {isLow ? 'LOW STOCK' : 'HEALTHY'}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button className="btn ghost" onClick={() => setIngForm(ing)}>📝 Edit</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {tab === 'requested_order' ? (
        <section className="stack">
          <h3>Requested Orders</h3>
          {requestedOrders.length === 0 ? (
            <p className="muted">No requested orders found.</p>
          ) : (
            <div className="grid-2">
              {requestedOrders.map(req => (
                <div key={req.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#2D1A11' }}>Req #{String(req.id).slice(0, 8)}</h4>
                      <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                        By {req.users?.name || 'Staff'} on {new Date(req.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span>
                  </div>
                  
                  {req.notes && (
                    <div style={{ fontSize: '13px', background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '4px' }}>
                      <strong>Notes:</strong> {req.notes}
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '12px', flex: 1 }}>
                    <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: '#666' }}>Requested Items:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '14px', color: '#444' }}>
                      {req.requisition_items?.map(item => (
                        <li key={item.id}>
                          {item.quantity} {item.unit} x <strong>{item.item_name}</strong>
                          {item.estimated_price > 0 && ` (Est: ${item.estimated_price} RWF)`}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="row-actions" style={{ marginTop: '16px' }}>
                      <button className="btn success" onClick={() => updateRequestedOrderStatus(req.id, 'APPROVED')}>✅ Approve</button>
                      <button className="btn danger outline" onClick={() => updateRequestedOrderStatus(req.id, 'REJECTED')}>❌ Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

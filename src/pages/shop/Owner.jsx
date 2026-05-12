import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'recharts'

export default function Owner() {
  const nav = useNavigate()
  const { role } = getSession()
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState('')

  const [overview, setOverview] = useState(null)
  const [menu, setMenu] = useState([])
  const [staff, setStaff] = useState([])
  const [ingredients, setIngredients] = useState([])

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
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
  })
  const [ingForm, setIngForm] = useState({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0 })
  
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

  const allowed = role === 'SHOP_ADMIN'

  const reloadCore = useCallback(async () => {
    const [o, m, s, i] = await Promise.all([
      api('/api/shop/owner/overview'),
      api('/api/shop/menu'),
      api('/api/shop/staff'),
      api('/api/shop/owner/inventory'),
    ])
    setOverview(o)
    setMenu(m)
    setStaff(s)
    setIngredients(i)
  }, [])

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
    if (tab !== 'reports') {
      return
    }
    Promise.all([
      api(`/api/shop/owner/reports/daily?date=${reportDay}`),
      api(`/api/shop/owner/reports/monthly?year=${month.year}&month=${month.month}`),
      api(`/api/shop/owner/reports/charts?date=${reportDay}`),
    ])
      .then(([d, moon, c]) => {
        setDailyRows(d)
        setMonthlyRows(moon)
        setCharts(c)
      })
      .catch((e) => setError(e.message))
  }, [allowed, tab, reportDay, month.year, month.month])

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

  async function addStaff(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/shop/staff', { method: 'POST', body: JSON.stringify(staffForm) })
      setStaffForm({ name: '', email: '', password: '', role: 'CASHIER' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="panel owner">
      <h2>Admin</h2>
      <div className="segmented xl owner-tabs">
        <button type="button" className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
          <span>📊</span> Overview
        </button>
        <button type="button" className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>
          <span>🍽️</span> Menu
        </button>
        <button type="button" className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>
          <span>👥</span> Staff
        </button>
        <button type="button" className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>
          <span>📈</span> Reports
        </button>
        <button type="button" className={tab === 'inventory' ? 'on' : ''} onClick={() => setTab('inventory')}>
          <span>🧪</span> Inventory
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}

      {tab === 'overview' ? (
        overview ? (
          <section>
            <div className="cards">
              <div className="card animate-in stagger-1">
                <div className="label">☕ Total Revenue</div>
                <div className="v">{Number(overview?.todayRevenue ?? 0).toLocaleString()} RWF</div>
                <div className="delta up"><span>↑</span> Warm sales today</div>
              </div>
              <div className="card animate-in stagger-2">
                <div className="label">🧾 Completed Orders</div>
                <div className="v">{overview?.todayPaidOrdersCount ?? 0}</div>
                <div className="delta up"><span>↑</span> Brewing fast</div>
              </div>
              <div className="card animate-in stagger-3">
                <div className="label">♨️ In Preparation</div>
                <div className="v">{overview?.pendingKitchenCount ?? 0}</div>
                <div className="delta flat"><span>•</span> Freshly roasting</div>
              </div>
              <div className="card animate-in stagger-4">
                <div className="label">🛎️ Waiting for Pickup</div>
                <div className="v">{overview?.readyCount ?? 0}</div>
                <div className="delta flat"><span>•</span> Service is hot</div>
              </div>
            </div>
          </section>
        ) : (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading overview…</span>
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
               <h4 style={{ marginBottom: 12 }}>📜 Recipe (Inventory Deduction)</h4>
               
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
          <form onSubmit={addStaff} className="grid-form">
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
              <span>Temporary password</span>
              <input
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="CASHIER">Shop Staff (Waiter + Billing)</option>
              </select>
            </label>
            <div className="span-2">
              <button className="btn primary xl" type="submit">
                Add staff
              </button>
            </div>
          </form>

          <div className="table staff-table">
            <div className="row head">
              <div>Name</div>
              <div>Email</div>
              <div>Role</div>
            </div>
            {staff.map((u) => (
              <div key={u.id} className="row">
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="muted">{u.email}</div>
                <div>
                  <span className="badge badge-neutral">{u.role}</span>
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

          <div className="grid-2 chart-row">
            <div className="card chart-card">
              <h3>Hourly Sales Volume</h3>
              <div style={{ width: '100%', minHeight: 300 }}>
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

            <div className="card chart-card">
              <h3>Top Selling Products</h3>
              <div style={{ width: '100%', minHeight: 300 }}>
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
              <div>Method</div>
              <div>Amount</div>
            </div>
            {dailyRows.map((r) => (
              <div key={`${r.at}-${r.orderId}`} className="row">
                <div>{new Date(r.at).toLocaleString()}</div>
                <div>#{String(r.orderId).slice(0, 8)}</div>
                <div>{r.methodLabel}</div>
                <div>{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <h3>Monthly payments</h3>
          <div className="table report-table">
            <div className="row head">
              <div>Time</div>
              <div>Order</div>
              <div>Method</div>
              <div>Amount</div>
            </div>
            {monthlyRows.map((r) => (
              <div key={`${r.at}-${r.orderId}`} className="row">
                <div>{new Date(r.at).toLocaleString()}</div>
                <div>#{String(r.orderId).slice(0, 8)}</div>
                <div>{r.methodLabel}</div>
                <div>{Number(r.amount).toFixed(2)}</div>
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
              setIngForm({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0 });
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
            <div className="span-2">
              <button className="btn primary xl" type="submit">{ingForm.id ? 'Update' : 'Add Ingredient'}</button>
            </div>
          </form>

          <div className="table inventory-table">
            <div className="row head">
              <div>Ingredient</div>
              <div>Current Stock</div>
              <div>Min</div>
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
                  <div>
                    <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                      {isLow ? 'LOW STOCK' : 'HEALTHY'}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button className="btn ghost" onClick={() => setIngForm(ing)}>Edit</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

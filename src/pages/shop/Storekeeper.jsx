import { useCallback, useEffect, useState } from 'react'
import { api, getSession } from '../../api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  HiOutlineBeaker,
  HiOutlineArchiveBox,
  HiOutlineClipboardDocumentList,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineClock,
  HiOutlineTruck,
  HiOutlineCubeTransparent,
  HiOutlineArrowPathRoundedSquare,
  HiOutlineShieldCheck,
  HiOutlineArrowRightOnRectangle,
} from 'react-icons/hi2'
import './OwnerModern.css'
import './Storekeeper.css'

/* ─────────────────────────────────────────────────────────────
   Tiny shared helpers
───────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    IN_PROGRESS: { bg: 'rgba(234,179,8,0.12)',  color: '#B45309', label: 'In Progress' },
    COMPLETED:   { bg: 'rgba(34,197,94,0.12)',  color: '#15803D', label: 'Completed'   },
    PENDING:     { bg: 'rgba(96,165,250,0.12)', color: '#1D4ED8', label: 'Pending'      },
    APPROVED:    { bg: 'rgba(34,197,94,0.12)',  color: '#15803D', label: 'Approved'     },
    SENT:        { bg: 'rgba(168,85,247,0.12)', color: '#7C3AED', label: 'Sent'         },
    RECEIVED:    { bg: 'rgba(34,197,94,0.12)',  color: '#166534', label: 'Received'     },
    REJECTED:    { bg: 'rgba(239,68,68,0.12)',  color: '#B91C1C', label: 'Rejected'     },
  }
  const s = map[status] || { bg: '#F3F4F6', color: '#374151', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function Card({ children, style }) {
  return (
    <div className="am-card" style={{ padding: 24, marginBottom: 0, ...style }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="am-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: -2 }}>{hint}</span>}
      {children}
    </label>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 1 — Production Entry
───────────────────────────────────────────────────────────── */
function ProductionScreen() {
  const [products, setProducts]     = useState([])
  const [recipe, setRecipe]         = useState(null)
  const [plannedQty, setPlannedQty] = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const [logs, setLogs]             = useState([])
  // Phase-2 confirm state: { log, actualQty, comment }
  const [confirming, setConfirming]  = useState(null)
  const [phase2Busy, setPhase2Busy]  = useState(false)

  const loadLogs = useCallback(async () => {
    try {
      const data = await api('/api/shop/storekeeper/production')
      setLogs(data || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    api('/api/shop/storekeeper/prepared-products')
      .then(d => setProducts(d || []))
      .catch(e => setError(e.message))
    loadLogs()
  }, [loadLogs])

  async function onProductSelect(menuItemId) {
    setRecipe(null)
    setPlannedQty('')
    setError('')
    if (!menuItemId) return
    try {
      const r = await api(`/api/shop/storekeeper/recipe/${menuItemId}`)
      setRecipe(r)
    } catch (e) { setError(e.message) }
  }

  // Derive scaled ingredient list from recipe + plannedQty
  const scaledLines = recipe && plannedQty > 0
    ? recipe.recipeLines.map(r => ({
        ...r,
        required: parseFloat(((r.quantityPerBatch / recipe.standardYield) * plannedQty).toFixed(4)),
      }))
    : (recipe?.recipeLines || []).map(r => ({ ...r, required: 0 }))

  async function handleStartProduction(e) {
    e.preventDefault()
    setError('')
    if (!recipe) return
    const planned = parseFloat(plannedQty)
    if (!planned || planned <= 0) { setError('Enter a valid planned quantity'); return }
    setBusy(true)
    try {
      await api('/api/shop/storekeeper/production', {
        method: 'POST',
        body: JSON.stringify({ menuItemId: recipe.menuItemId, plannedQty: planned }),
      })
      setRecipe(null)
      setPlannedQty('')
      await loadLogs()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleCompleteProduction(e) {
    e.preventDefault()
    setError('')
    const actual   = parseFloat(confirming.actualQty)
    const planned  = parseFloat(confirming.log.planned_qty)
    const variance = planned - actual
    if (Math.abs(variance) > 0.001 && !confirming.comment?.trim()) {
      setError('A comment explaining the variance is required')
      return
    }
    setPhase2Busy(true)
    try {
      await api(`/api/shop/storekeeper/production/${confirming.log.id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ actualQty: actual, varianceComment: confirming.comment }),
      })
      setConfirming(null)
      await loadLogs()
    } catch (e) { setError(e.message) }
    finally { setPhase2Busy(false) }
  }

  const inProgress = logs.filter(l => l.status === 'IN_PROGRESS')
  const completed  = logs.filter(l => l.status === 'COMPLETED')

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Phase-2 modal: confirm actual qty ── */}
      {confirming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setConfirming(null)}>
          <div className="am-card am-animate" style={{ width: '100%', maxWidth: 440, padding: 28 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', color: '#111827', fontSize: 18, fontWeight: 800 }}>
              Confirm Production Output
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
              Planned: <strong>{confirming.log.planned_qty}</strong> units of{' '}
              <strong>{confirming.log.menu_items?.name}</strong>
            </p>
            <form onSubmit={handleCompleteProduction} className="stack" style={{ gap: 16 }}>
              <Field label="Actual quantity produced">
                <input
                  className="am-input"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={confirming.actualQty}
                  onChange={e => setConfirming(c => ({ ...c, actualQty: e.target.value }))}
                  placeholder="e.g. 36"
                />
              </Field>
              {confirming.actualQty !== '' &&
               Math.abs(parseFloat(confirming.log.planned_qty) - parseFloat(confirming.actualQty || 0)) > 0.001 && (
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)',
                  borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                    ⚠ Variance detected ({(parseFloat(confirming.log.planned_qty) - parseFloat(confirming.actualQty || 0)).toFixed(2)} units) — comment required
                  </p>
                  <Field label="Variance explanation" hint="e.g. 4 pieces burnt during cooking">
                    <textarea
                      className="am-input"
                      rows={2}
                      required
                      value={confirming.comment}
                      onChange={e => setConfirming(c => ({ ...c, comment: e.target.value }))}
                      placeholder="Explain the difference..."
                    />
                  </Field>
                </div>
              )}
              {error && <p style={{ color: '#B91C1C', fontSize: 13, margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn primary xl" type="submit" disabled={phase2Busy}
                  style={{ flex: 1 }}>
                  {phase2Busy ? 'Saving…' : 'Confirm & Add to Stock'}
                </button>
                <button type="button" className="btn ghost xl"
                  onClick={() => { setConfirming(null); setError('') }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Start new production ── */}
      <Card>
        <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#1D3557', fontSize: 16 }}>
          <HiOutlineBeaker style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Record New Production Run
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
          Select a prepared product, enter the desired output quantity, and the system
          will calculate and immediately deduct the required ingredients.
        </p>
        <form onSubmit={handleStartProduction} className="stack" style={{ gap: 20 }}>
          <Field label="Prepared Product">
            <select className="am-input" required
              onChange={e => onProductSelect(e.target.value)}>
              <option value="">— Select a product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · Std. yield: {p.recipe_reference_yield} pcs
                </option>
              ))}
            </select>
          </Field>

          {recipe && (
            <Field label="Planned output quantity (units)"
              hint={`Standard recipe yield is ${recipe.standardYield} units. Ingredients will be scaled proportionally.`}>
              <input
                className="am-input"
                type="number"
                min="1"
                step="1"
                required
                value={plannedQty}
                onChange={e => setPlannedQty(e.target.value)}
                placeholder={`e.g. ${recipe.standardYield}`}
              />
            </Field>
          )}

          {recipe && scaledLines.length > 0 && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1D3557' }}>
                Ingredients that will be deducted from stock
              </p>
              <table className="am-modern-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>INGREDIENT</th>
                    <th>IN STOCK</th>
                    <th>WILL DEDUCT</th>
                    <th>REMAINING</th>
                  </tr>
                </thead>
                <tbody>
                  {scaledLines.map(r => {
                    const after    = r.currentStock - r.required
                    const isLow    = after < 0
                    const isWarn   = after >= 0 && after < r.currentStock * 0.1
                    return (
                      <tr key={r.ingredientId} style={{ background: isLow ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td style={{ fontWeight: 600 }}>{r.ingredientName}</td>
                        <td>{r.currentStock} {r.unit}</td>
                        <td style={{ color: '#E8751A', fontWeight: 700 }}>
                          -{r.required} {r.unit}
                        </td>
                        <td style={{ fontWeight: 700,
                          color: isLow ? '#B91C1C' : isWarn ? '#92400E' : '#15803D' }}>
                          {isLow && '⚠ '}
                          {after.toFixed(3)} {r.unit}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {recipe && (
            <button className="btn primary xl" type="submit" disabled={busy || !plannedQty}
              style={{ borderRadius: 10, height: 48, fontSize: 15, fontWeight: 700 }}>
              {busy ? 'Deducting ingredients…' : '🚀 Start Production & Deduct Ingredients'}
            </button>
          )}
        </form>
      </Card>

      {/* ── Awaiting confirmation ── */}
      {inProgress.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, color: '#92400E', fontSize: 15 }}>
            <HiOutlineClock style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Awaiting Actual Output ({inProgress.length})
          </h3>
          <div className="stack" style={{ gap: 12 }}>
            {inProgress.map(log => (
              <div key={log.id} style={{ border: '1px solid rgba(234,179,8,0.4)',
                borderRadius: 12, padding: 16, background: 'rgba(234,179,8,0.04)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {log.menu_items?.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    Planned: <strong>{log.planned_qty}</strong> units ·{' '}
                    {new Date(log.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Kigali',
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button className="btn primary"
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}
                  onClick={() => { setError(''); setConfirming({ log, actualQty: log.planned_qty, comment: '' }) }}>
                  ✅ Enter Actual Output
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Completed history ── */}
      {completed.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, color: '#1D3557', fontSize: 15 }}>
            Production History
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="am-modern-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PRODUCT</th>
                  <th>PLANNED</th>
                  <th>ACTUAL</th>
                  <th>VARIANCE</th>
                  <th>COMMENT</th>
                </tr>
              </thead>
              <tbody>
                {completed.map(log => {
                  const v = parseFloat(log.variance ?? 0)
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12 }}>
                        {new Date(log.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.menu_items?.name}</td>
                      <td>{log.planned_qty}</td>
                      <td style={{ fontWeight: 700 }}>{log.actual_qty}</td>
                      <td style={{ fontWeight: 700,
                        color: v === 0 ? '#15803D' : v > 0 ? '#B91C1C' : '#15803D' }}>
                        {v === 0 ? '✓ 0' : (v > 0 ? `-${v}` : `+${Math.abs(v)}`)}
                      </td>
                      <td style={{ fontSize: 11, color: '#6B7280', maxWidth: 180,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.variance_comment || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 2 — Warehouse Inventory (view warehouse & floor stock)
───────────────────────────────────────────────────────────── */
function WarehouseInventoryScreen() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'low_warehouse', 'low_floor'
  const [searchQuery, setSearchQuery] = useState('')
  
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [savingId, setSavingId] = useState(null)

  const handleSaveQuantity = async (item) => {
    if (editQty === '' || isNaN(editQty)) return;
    setSavingId(item.productId);
    try {
      const targetQuantity = parseFloat(editQty);
      
      if (item.isDuplicate && item.duplicates && item.duplicates.length > 0) {
        // Fix for "ghost stock": if item is merged from multiple sources (like Menu Item + Ingredient),
        // apply the total requested quantity to the first source, and zero out the rest.
        // This ensures the new merged total exactly equals targetQuantity.
        for (let i = 0; i < item.duplicates.length; i++) {
          const dup = item.duplicates[i];
          const qtyToSet = i === 0 ? targetQuantity : 0;
          await api('/api/shop/warehouse/set-warehouse-quantity', {
            method: 'PUT',
            body: JSON.stringify({
              productId: dup.productId,
              itemType: dup.itemType,
              quantity: qtyToSet,
              notes: 'Storekeeper updated inventory quantity directly (merged deduplication)'
            })
          });
        }
      } else {
        await api('/api/shop/warehouse/set-warehouse-quantity', {
          method: 'PUT',
          body: JSON.stringify({
            productId: item.productId,
            itemType: item.itemType,
            quantity: targetQuantity,
            notes: 'Storekeeper updated inventory quantity directly'
          })
        });
      }

      setEditingId(null);
      await loadInventory(); // refresh list
    } catch (e) {
      setError(e.message || 'Failed to update quantity');
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const data = await api('/api/shop/warehouse/inventory')
      
      // Merge duplicates by name (e.g., "Amstel" and "Amstel (pcs)" become one)
      const nameMap = {}
      const rawData = data || []
      
      rawData.forEach(item => {
        // Normalize name: remove "(pcs)" and extra spaces
        const nameKey = item.name
          .replace(/\s*\(pcs\)\s*$/i, '') // Remove (pcs) at end
          .toLowerCase()
          .trim()
        
        if (!nameMap[nameKey]) {
          nameMap[nameKey] = {
            ...item,
            duplicateIds: [item.productId],
            duplicates: [item],
            isDuplicate: false
          }
        } else {
          // Merge: sum the quantities
          nameMap[nameKey].warehouseQty += item.warehouseQty
          nameMap[nameKey].shopFloorQty += item.shopFloorQty
          nameMap[nameKey].totalQty += item.totalQty
          nameMap[nameKey].duplicateIds.push(item.productId)
          nameMap[nameKey].duplicates.push(item)
          nameMap[nameKey].isDuplicate = true
        }
      })
      
      const mergedData = Object.values(nameMap)
      setInventory(mergedData)
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const filtered = inventory.filter(item => {
    // Filter by status
    if (filter === 'low_warehouse') return item.warehouseQty < item.warehouseQty * 0.2
    if (filter === 'low_floor') return item.shopFloorQty < item.shopFloorQty * 0.2
    
    // Filter by search query
    if (searchQuery.trim()) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    
    return true
  })

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error && (
        <Card style={{ background: '#FEE2E2', borderLeft: '4px solid #DC2626' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <HiOutlineExclamationTriangle size={20} style={{ color: '#DC2626', marginTop: 2, flexShrink: 0 }} />
            <span style={{ color: '#991B1B' }}>{error}</span>
          </div>
        </Card>
      )}

      {/* ── Header ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Warehouse Inventory</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              Total items: {filtered.length} {searchQuery && `(filtered from ${inventory.length})`}
            </p>
          </div>
          <button
            onClick={loadInventory}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* ── Search Bar ── */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="🔍 Search items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 13,
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
            onFocus={e => {
              e.target.style.borderColor = '#3B82F6'
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#E5E7EB'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* ── Filter Pills ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setFilter('all')}
            className={`cashier-cat-pill ${filter === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            All Items ({inventory.length})
          </button>
          <button
            onClick={() => setFilter('low_warehouse')}
            className={`cashier-cat-pill ${filter === 'low_warehouse' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Low Warehouse
          </button>
          <button
            onClick={() => setFilter('low_floor')}
            className={`cashier-cat-pill ${filter === 'low_floor' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Low Floor
          </button>
        </div>
      </Card>

      {/* ── Inventory Grid ── */}
      {loading ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          Loading inventory...
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          No items to display
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(item => {
            const warehousePercent = item.warehouseQty > 0 ? 100 : 0
            
            return (
              <div
                key={item.productId}
                style={{
                  padding: 16,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {item.name}
                  </h3>
                </div>

                {/* ── Warehouse Stock Only ── */}
                <div style={{ background: 'rgba(234,179,8,0.08)', padding: 12, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Warehouse Stock</span>
                    {editingId === item.productId ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          style={{ width: 60, padding: '4px 8px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 4 }}
                          value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity(item)}
                        />
                        <button 
                          onClick={() => handleSaveQuantity(item)}
                          disabled={savingId === item.productId}
                          style={{ background: '#10B981', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >
                          {savingId === item.productId ? '...' : 'Save'}
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          style={{ background: '#EF4444', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#B45309' }}>
                          {item.warehouseQty} units
                        </span>
                        <button
                          onClick={() => { setEditingId(item.productId); setEditQty(item.warehouseQty); }}
                          style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ background: '#FEF3C7', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: '#EA8208',
                        width: `${warehousePercent}%`,
                        transition: 'width 0.2s'
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 3 — All Warehouse Requests (Cashier, Chef, Manager)
───────────────────────────────────────────────────────────── */
function WarehouseRequestsScreen() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('PENDING')
  const [actionInProgress, setActionInProgress] = useState({})
  const [rejectReason, setRejectReason] = useState({})
  const [showRejectForm, setShowRejectForm] = useState({})
  const [editingQuantity, setEditingQuantity] = useState({})
  const [isEditMode, setIsEditMode] = useState({})

  useEffect(() => {
    loadRequests()
  }, [filter])

  const loadRequests = async () => {
    setLoading(true)
    try {
      let status = filter === 'all' ? null : filter
      const data = await api(`/api/shop/warehouse/requests${status ? `?status=${status}` : ''}`)
      // Backend already handles role-based filtering:
      // - STOREKEEPER sees ALL requests  
      // - CASHIER/CHEF/MANAGER see only their own
      setRequests(data || [])
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (transferId) => {
    setActionInProgress(prev => ({ ...prev, [transferId]: 'approving' }))
    try {
      const editedQty = editingQuantity[transferId]
      const approveData = editedQty ? { quantity: parseFloat(editedQty) } : {}
      
      await api(`/api/shop/warehouse/requests/${transferId}/approve`, {
        method: 'PUT',
        body: approveData && Object.keys(approveData).length > 0 ? JSON.stringify(approveData) : undefined
      })
      await loadRequests()
      setEditingQuantity(prev => ({ ...prev, [transferId]: '' }))
      setIsEditMode(prev => ({ ...prev, [transferId]: false }))
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to approve request')
    } finally {
      setActionInProgress(prev => ({ ...prev, [transferId]: null }))
    }
  }

  const handleReject = async (transferId) => {
    const reason = rejectReason[transferId]?.trim()
    if (!reason) {
      setError('Rejection reason is required')
      return
    }
    
    setActionInProgress(prev => ({ ...prev, [transferId]: 'rejecting' }))
    try {
      await api(`/api/shop/warehouse/requests/${transferId}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason })
      })
      setRejectReason(prev => ({ ...prev, [transferId]: '' }))
      setShowRejectForm(prev => ({ ...prev, [transferId]: false }))
      await loadRequests()
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to reject request')
    } finally {
      setActionInProgress(prev => ({ ...prev, [transferId]: null }))
    }
  }

  const handleSend = async (transferId) => {
    setActionInProgress(prev => ({ ...prev, [transferId]: 'sending' }))
    try {
      await api(`/api/shop/warehouse/requests/${transferId}/send`, {
        method: 'PUT'
      })
      await loadRequests()
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to send items')
    } finally {
      setActionInProgress(prev => ({ ...prev, [transferId]: null }))
    }
  }

  const statusGroups = {
    PENDING: requests.filter(r => r.status === 'PENDING'),
    APPROVED: requests.filter(r => r.status === 'APPROVED'),
    COMPLETED: requests.filter(r => r.status === 'COMPLETED'),
    REJECTED: requests.filter(r => r.status === 'REJECTED')
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error && (
        <Card style={{ background: '#FEE2E2', borderLeft: '4px solid #DC2626' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <HiOutlineExclamationTriangle size={20} style={{ color: '#DC2626', marginTop: 2, flexShrink: 0 }} />
            <span style={{ color: '#991B1B' }}>{error}</span>
          </div>
        </Card>
      )}

      {/* ── Header ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Warehouse Requests</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              Approve or reject warehouse requests from cashiers, chefs, and managers
            </p>
          </div>
          <button
            onClick={loadRequests}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* ── Filter Pills ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter('PENDING')}
            className={`cashier-cat-pill ${filter === 'PENDING' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Pending ({statusGroups.PENDING.length})
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            className={`cashier-cat-pill ${filter === 'APPROVED' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Approved ({statusGroups.APPROVED.length})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`cashier-cat-pill ${filter === 'COMPLETED' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Completed ({statusGroups.COMPLETED.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`cashier-cat-pill ${filter === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            All
          </button>
        </div>
      </Card>

      {/* ── Requests List ── */}
      {loading ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          Loading requests...
        </Card>
      ) : requests.length === 0 ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          No requests to display
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {requests.map(req => {
            const isBusy = !!actionInProgress[req.transferId]
            const isShowingRejectForm = showRejectForm[req.transferId]
            
            return (
              <div
                key={req.transferId}
                style={{
                  padding: 16,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {/* ── Header Row ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      {req.productName}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                      Requested by: <strong>{req.requestedBy}</strong>
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                {/* ── Quantity Info ── */}
                <div style={{ 
                  background: '#F3F4F6',
                  padding: 12,
                  borderRadius: 8,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12
                }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                      {req.status === 'PENDING' && isEditMode[req.transferId] ? 'New Quantity' : 'Quantity Requested'}
                    </span>
                    {req.status === 'PENDING' && isEditMode[req.transferId] ? (
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editingQuantity[req.transferId] !== undefined ? editingQuantity[req.transferId] : req.quantity}
                        onChange={(e) => setEditingQuantity(prev => ({ ...prev, [req.transferId]: e.target.value }))}
                        style={{
                          width: '100%',
                          marginTop: 4,
                          padding: '8px 12px',
                          border: '2px solid #3B82F6',
                          borderRadius: 6,
                          outline: 'none',
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#111827'
                        }}
                        autoFocus
                      />
                    ) : (
                      <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        {editingQuantity[req.transferId] ? `${editingQuantity[req.transferId]} units` : `${req.quantity} units`}
                      </p>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Requested Date</span>
                    <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* ── Notes ── */}
                {req.notes && (
                  <div style={{ 
                    background: '#F0F9FF',
                    padding: 12,
                    borderRadius: 8,
                    borderLeft: '3px solid #3B82F6'
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#1E40AF', fontStyle: 'italic' }}>
                      Notes: {req.notes}
                    </p>
                  </div>
                )}

                {/* ── Rejection Reason (if rejected) ── */}
                {req.status === 'REJECTED' && req.rejectionReason && (
                  <div style={{ 
                    background: '#FEE2E2',
                    padding: 12,
                    borderRadius: 8,
                    borderLeft: '3px solid #DC2626'
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#991B1B', fontStyle: 'italic' }}>
                      Rejection: {req.rejectionReason}
                    </p>
                  </div>
                )}

                {/* ── Actions ── */}
                {req.status === 'PENDING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* ── Edit Toggle ── */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          if (isEditMode[req.transferId]) {
                            setEditingQuantity(prev => ({ ...prev, [req.transferId]: '' }))
                          } else {
                            setEditingQuantity(prev => ({ ...prev, [req.transferId]: req.quantity }))
                          }
                          setIsEditMode(prev => ({ ...prev, [req.transferId]: !isEditMode[req.transferId] }))
                        }}
                        disabled={isBusy}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: isEditMode[req.transferId] ? '#F59E0B' : '#F3F4F6',
                          color: isEditMode[req.transferId] ? 'white' : '#374151',
                          border: '1px solid #D1D5DB',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          transition: '0.2s'
                        }}
                      >
                        {isEditMode[req.transferId] ? '✎ Editing...' : '✎ Edit Qty'}
                      </button>
                    </div>
                    
                    {/* ── Approve/Reject Buttons ── */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleApprove(req.transferId)}
                        disabled={isBusy}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: isBusy ? '#D1D5DB' : '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          transition: '0.2s'
                        }}
                      >
                        {actionInProgress[req.transferId] === 'approving' ? '✓ Approving...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(prev => ({ ...prev, [req.transferId]: !isShowingRejectForm }))}
                        disabled={isBusy}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: isShowingRejectForm ? '#EF4444' : '#F3F4F6',
                          color: isShowingRejectForm ? 'white' : '#374151',
                          border: '1px solid #D1D5DB',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                          transition: '0.2s'
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                    {isShowingRejectForm && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Reason for rejection..."
                          value={rejectReason[req.transferId] || ''}
                          onChange={(e) => setRejectReason(prev => ({ ...prev, [req.transferId]: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: 6,
                            outline: 'none',
                            fontSize: 13
                          }}
                        />
                        <button
                          onClick={() => handleReject(req.transferId)}
                          disabled={isBusy || !rejectReason[req.transferId]?.trim()}
                          style={{
                            padding: '8px 16px',
                            background: isBusy || !rejectReason[req.transferId]?.trim() ? '#D1D5DB' : '#DC2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 600,
                            cursor: (isBusy || !rejectReason[req.transferId]?.trim()) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Confirm Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {req.status === 'APPROVED' && (
                  <button
                    onClick={() => handleSend(req.transferId)}
                    disabled={isBusy}
                    style={{
                      padding: '10px 16px',
                      background: isBusy ? '#D1D5DB' : '#7C3AED',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    {actionInProgress[req.transferId] === 'sending' ? '→ Sending...' : '→ Send to Floor'}
                  </button>
                )}

                {req.status === 'COMPLETED' && (
                  <div style={{ 
                    padding: 10,
                    background: '#DCFCE7',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#15803D'
                  }}>
                    ✓ Items sent to shop floor
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 4 — Stock Request  (with autocomplete)
───────────────────────────────────────────────────────────── */
function StockRequestScreen() {
  const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'bags', 'boxes', 'cups', 'shots']
  const emptyItem = () => ({ itemName: '', unit: 'kg', qtyRequested: '' })

  const [items, setItems]       = useState([emptyItem()])
  const [notes, setNotes]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [requests, setRequests] = useState([])
  // Catalogue for autocomplete
  const [catalogue, setCatalogue] = useState([]) // [{ id, name, unit, type:'INGREDIENT'|'MENU_ITEM' }]

  const loadRequests = useCallback(async () => {
    try {
      const data = await api('/api/shop/storekeeper/stock-requests')
      setRequests(data || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadRequests()
    // Load autocomplete catalogue (inventory + menu items)
    Promise.all([
      api('/api/shop/storekeeper/inventory').catch(() => []),
      api('/api/shop/storekeeper/menu-items').catch(() => []),
    ]).then(([ings, mis]) => {
      const ingEntries = (ings || []).map(i => ({ id: i.id, name: i.name, unit: i.unit || 'kg', type: 'INGREDIENT' }))
      const miEntries  = (mis  || []).map(m => ({ id: m.id, name: m.name, unit: 'pcs',          type: 'MENU_ITEM'  }))
      setCatalogue([...ingEntries, ...miEntries])
    })
  }, [loadRequests])

  function setItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  // When a catalogue name is chosen, auto-fill unit
  function handleItemNameChange(idx, value) {
    setItem(idx, 'itemName', value)
    const match = catalogue.find(c => c.name.toLowerCase() === value.toLowerCase())
    if (match) setItem(idx, 'unit', match.unit)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    const valid = items.filter(it => it.itemName.trim() && parseFloat(it.qtyRequested) > 0)
    if (!valid.length) { setError('Add at least one item with a name and quantity'); return }
    
    // Validate that all items exist in the catalogue
    for (const item of valid) {
      const exists = catalogue.find(c => c.name.toLowerCase() === item.itemName.toLowerCase())
      if (!exists) {
        setError(`"${item.itemName}" is not in the system. Please select from existing items only.`)
        return
      }
    }
    
    setBusy(true)
    try {
      await api('/api/shop/storekeeper/stock-requests', {
        method: 'POST',
        body: JSON.stringify({ notes, items: valid }),
      })
      setItems([emptyItem()])
      setNotes('')
      setSuccess('Stock request submitted successfully.')
      await loadRequests()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error   && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
        color: '#15803D', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>{success}</div>}

      {/* Hidden datalist for autocomplete */}
      <datalist id="sk-catalogue">
        {catalogue.map(c => <option key={`${c.type}-${c.id}`} value={c.name} />)}
      </datalist>

      <Card>
        <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#1D3557', fontSize: 16 }}>
          <HiOutlineArchiveBox style={{ verticalAlign: 'middle', marginRight: 8 }} />
          New Stock Request
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
          Start typing to find and select from existing inventory or menu items.
        </p>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 20 }}>
          <div className="stack" style={{ gap: 10 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ display: 'grid',
                gridTemplateColumns: '2fr 80px 100px 36px',
                gap: 8, alignItems: 'end' }}>
                <Field label={idx === 0 ? 'Item name' : ''}>
                  <input
                    className="am-input"
                    list="sk-catalogue"
                    placeholder="Search inventory or type new item…"
                    value={it.itemName}
                    required
                    onChange={e => handleItemNameChange(idx, e.target.value)}
                  />
                </Field>
                <Field label={idx === 0 ? 'Unit' : ''}>
                  <select className="am-input" value={it.unit}
                    onChange={e => setItem(idx, 'unit', e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label={idx === 0 ? 'Qty needed' : ''}>
                  <input className="am-input" type="number" min="0.01" step="any"
                    placeholder="0" value={it.qtyRequested} required
                    onChange={e => setItem(idx, 'qtyRequested', e.target.value)} />
                </Field>
                <button type="button" style={{ background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)', color: '#B91C1C',
                  borderRadius: 8, height: 38, cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: idx === 0 ? 22 : 0 }}
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <HiOutlineTrash size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="btn ghost"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              onClick={() => setItems(prev => [...prev, emptyItem()])}>
              <HiOutlinePlusCircle /> Add item
            </button>
          </div>

          <Field label="Notes (optional)" hint="e.g. urgency, supplier info">
            <textarea className="am-input" rows={2} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes for the owner..." />
          </Field>

          <button className="btn primary xl" type="submit" disabled={busy}
            style={{ height: 46, fontWeight: 700, fontSize: 14, borderRadius: 10 }}>
            {busy ? 'Submitting…' : '📤 Submit Stock Request'}
          </button>
        </form>
      </Card>

      {requests.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, color: '#1D3557', fontSize: 15 }}>
            My Requests
          </h3>
          <div className="stack" style={{ gap: 10 }}>
            {requests.map(r => (
              <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12,
                padding: '14px 16px', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    Request #{r.id.slice(0, 8)}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <StatusBadge status={r.status} />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {new Date(r.created_at).toLocaleDateString('en-GB',
                        { timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#374151' }}>
                  {(r.requisition_items || []).map(it => (
                    <span key={it.id} style={{ display: 'inline-block', marginRight: 12 }}>
                      {it.item_name} — {it.approved_qty ?? it.quantity} {it.unit}
                    </span>
                  ))}
                </div>
                {r.notes && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' }}>
                    {r.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 5 — Receive Delivery  (explicit destination per item)
───────────────────────────────────────────────────────────── */
function ReceiveDeliveryScreen() {
  const [requests, setRequests]       = useState([])
  const [selected, setSelected]       = useState(null)
  const [receiptItems, setReceiptItems] = useState([])
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  // Lookup data for destination dropdowns
  const [ingredients, setIngredients] = useState([])
  const [menuItems, setMenuItems]     = useState([])

  const loadRequests = useCallback(async () => {
    try {
      const [sent, approved] = await Promise.all([
        api('/api/shop/storekeeper/stock-requests?status=SENT').catch(() => []),
        api('/api/shop/storekeeper/stock-requests?status=APPROVED').catch(() => []),
      ])
      setRequests([...(sent || []), ...(approved || [])])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadRequests()
    api('/api/shop/storekeeper/inventory').then(d => setIngredients(d || [])).catch(() => {})
    api('/api/shop/storekeeper/menu-items').then(d => setMenuItems(d || [])).catch(() => {})
  }, [loadRequests])

  function openReceive(req) {
    setError(''); setSuccess('')
    setSelected(req)
    setReceiptItems(
      (req.requisition_items || []).map(it => {
        // Auto-match: find an ingredient whose name matches the requested item_name
        const matchedIng = ingredients.find(
          ing => ing.name.toLowerCase().trim() === it.item_name.toLowerCase().trim()
        )
        // Also check menu items
        const matchedMenu = menuItems.find(
          m => m.name.toLowerCase().trim() === it.item_name.toLowerCase().trim()
        )
        
        const matched = matchedIng || matchedMenu
        
        return {
          ...it,
          sentQty:         it.sent_qty ?? it.approved_qty ?? it.quantity,
          receivedQty:     it.sent_qty ?? it.approved_qty ?? it.quantity,
          varianceComment: '',
          // Auto-resolved destination (no manual selection needed)
          targetType: matchedIng ? 'INGREDIENT' : (matchedMenu ? 'MENU_ITEM' : 'NEW_INGREDIENT'),
          targetId:   matched ? (matchedIng ? matchedIng.id : matchedMenu.id) : '',
          newItemName: it.item_name,
          newItemUnit: it.unit || 'kg',
          newItemCategory: '',
        }
      })
    )
  }

  function setRI(idx, field, value) {
    setReceiptItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  // When switching targetType reset targetId
  function handleTargetTypeChange(idx, newType) {
    setReceiptItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      return { ...it, targetType: newType, targetId: '' }
    }))
  }

  async function handleReceive(e) {
    e.preventDefault()
    setError('')
    // Validate only variance comments
    for (const it of receiptItems) {
      const sent     = parseFloat(it.sentQty || 0)
      const received = parseFloat(it.receivedQty || 0)
      if (Math.abs(sent - received) > 0.001 && !it.varianceComment?.trim()) {
        setError(`Comment required for "${it.item_name}" — received ${received} vs sent ${sent}`)
        return
      }
    }
    setBusy(true)
    try {
      await api(`/api/shop/storekeeper/stock-requests/${selected.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          items: receiptItems.map(it => ({
            itemName:        it.item_name,
            unit:            it.unit,
            sentQty:         parseFloat(it.sentQty || 0),
            receivedQty:     parseFloat(it.receivedQty || 0),
            varianceComment: it.varianceComment,
            targetType:      it.targetType,
            targetId:        it.targetId || undefined,
            newItemName:     it.newItemName,
            newItemUnit:     it.newItemUnit,
            newItemCategory: it.newItemCategory,
          })),
        }),
      })
      setSelected(null); setReceiptItems([])
      setSuccess('Delivery confirmed. Stock has been updated.')
      await loadRequests()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }


  return (
    <div className="stack" style={{ gap: 24 }}>
      {error   && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
        color: '#15803D', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>{success}</div>}

      {selected ? (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#1D3557', fontSize: 16 }}>
                Confirm Delivery — Request #{selected.id.slice(0, 8)}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
                For each item: enter the actual quantity received. Stock will be updated automatically.
              </p>
            </div>
            <button className="btn ghost" onClick={() => { setSelected(null); setError('') }}>
              ← Back
            </button>
          </div>

          <form onSubmit={handleReceive} className="stack" style={{ gap: 20 }}>
            {receiptItems.map((it, idx) => {
              const sent     = parseFloat(it.sentQty || 0)
              const received = parseFloat(it.receivedQty || 0)
              const variance = sent - received
              const hasVariance = Math.abs(variance) > 0.001
              const matchedIng = it.targetType === 'INGREDIENT' && it.targetId
                ? ingredients.find(ing => ing.id === it.targetId)
                : null
              return (
                <div key={it.id || idx} style={{
                  border: `1px solid ${hasVariance ? 'rgba(234,179,8,0.5)' : '#E5E7EB'}`,
                  borderRadius: 12, padding: 18,
                  background: hasVariance ? 'rgba(234,179,8,0.04)' : '#FAFAFA' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: '#111827' }}>
                    {it.item_name}
                    <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 8, fontWeight: 400 }}>
                      Sent: {sent} {it.unit}
                    </span>
                  </div>

                  {/* Auto-matched destination indicator */}
                  {matchedIng ? (
                    <div style={{ fontSize: 12, color: '#15803D', marginBottom: 12,
                      background: 'rgba(34,197,94,0.08)', padding: '4px 10px',
                      borderRadius: 6, display: 'inline-block' }}>
                      ✓ Will update: <strong>{matchedIng.name}</strong> (current stock: {matchedIng.stock_level} {matchedIng.unit})
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#B45309', marginBottom: 12,
                      background: 'rgba(234,179,8,0.1)', padding: '4px 10px',
                      borderRadius: 6, display: 'inline-block' }}>
                      ⚠ New ingredient will be created: <strong>{it.item_name}</strong>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <Field label="Received qty">
                      <input className="am-input" type="number" min="0" step="any" required
                        value={it.receivedQty}
                        onChange={e => setRI(idx, 'receivedQty', e.target.value)} />
                    </Field>
                    {hasVariance && (
                      <Field label={`Variance: ${variance.toFixed(3)} ${it.unit} short`}
                        hint="Required — explain the shortage">
                        <input className="am-input" required
                          placeholder="e.g. 1kg meat spoiled in transit"
                          value={it.varianceComment}
                          onChange={e => setRI(idx, 'varianceComment', e.target.value)} />
                      </Field>
                    )}
                  </div>
                </div>
              )
            })}

            <button className="btn primary xl" type="submit" disabled={busy}
              style={{ height: 46, fontWeight: 700, fontSize: 14, borderRadius: 10 }}>
              {busy ? 'Confirming…' : '✅ Confirm Receipt & Update Stock'}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#1D3557', fontSize: 16 }}>
            <HiOutlineTruck style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Deliveries Awaiting Confirmation
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
            These requests have been sent by the owner. Confirm what was actually delivered.
          </p>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
              No pending deliveries to confirm.
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {requests.map(r => (
                <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12,
                  padding: '14px 16px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#FAFAFA' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      Request #{r.id.slice(0, 8)} <StatusBadge status={r.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      {(r.requisition_items || []).map(it =>
                        `${it.item_name} (${it.sent_qty ?? it.approved_qty ?? it.quantity} ${it.unit})`
                      ).join(' · ')}
                    </div>
                  </div>
                  <button className="btn primary"
                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}
                    onClick={() => openReceive(r)}>
                    Receive Delivery
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SCREEN 6 — Personal Stock (Storekeeper's own stock account)
───────────────────────────────────────────────────────────── */
function PersonalStockScreen() {
  const [stockItems, setStockItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [busy, setBusy] = useState(false)

  const loadPersonalStock = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/api/shop/storekeeper/personal-stock')
      setStockItems(data || [])
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to load personal stock')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPersonalStock()
  }, [loadPersonalStock])

  const handleEditQuantity = async (itemId, currentQty) => {
    const newQty = parseFloat(editQty)
    if (isNaN(newQty) || newQty < 0) {
      setError('Quantity must be a valid number ≥ 0')
      return
    }

    setBusy(true)
    try {
      await api(`/api/shop/storekeeper/personal-stock/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQty })
      })
      await loadPersonalStock()
      setEditingId(null)
      setEditQty('')
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to update stock quantity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      {error && (
        <Card style={{ background: '#FEE2E2', borderLeft: '4px solid #DC2626' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <HiOutlineExclamationTriangle size={20} style={{ color: '#DC2626', marginTop: 2, flexShrink: 0 }} />
            <span style={{ color: '#991B1B' }}>{error}</span>
          </div>
        </Card>
      )}

      <Card>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
          <HiOutlineBeaker style={{ marginRight: 8, verticalAlign: 'middle' }} />
          My Stock Account
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
          Manage your personal stock quantities and adjustments
        </p>
      </Card>

      {loading ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          Loading your stock items...
        </Card>
      ) : stockItems.length === 0 ? (
        <Card style={{ textAlign: 'center', color: '#9CA3AF' }}>
          No stock items assigned to your account
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {stockItems.map(item => (
            <div key={item.id} style={{
              padding: 16,
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              ':hover': {
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }
            }}>
              {/* Left: Item Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {item.itemName || item.name || 'Unknown'}
                </h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF', background: '#F3F4F6', padding: '2px 8px', borderRadius: 4 }}>
                    {item.category || 'Uncategorized'}
                  </span>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    Unit: {item.unit || 'pcs'}
                  </span>
                </div>
              </div>

              {/* Middle: Quantity Display or Input */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
                {editingId === item.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <label style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>
                        New Quantity:
                      </label>
                      <input
                        type="number"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        min="0"
                        step="0.1"
                        style={{
                          padding: '10px 12px',
                          border: '2px solid #3B82F6',
                          borderRadius: 6,
                          outline: 'none',
                          fontSize: 14,
                          fontWeight: 700,
                          width: 100,
                          textAlign: 'right',
                          background: '#F0F9FF'
                        }}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => handleEditQuantity(item.id, item.quantity)}
                      disabled={busy}
                      style={{
                        padding: '8px 14px',
                        background: busy ? '#D1D5DB' : '#10B981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 700,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        height: 'fit-content'
                      }}
                    >
                      {busy ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditQty('')
                      }}
                      disabled={busy}
                      style={{
                        padding: '8px 14px',
                        background: '#FEE2E2',
                        color: '#991B1B',
                        border: '1px solid #FECACA',
                        borderRadius: 6,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        height: 'fit-content'
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Quantity Display */}
                    <div style={{ textAlign: 'right', paddingRight: 12, borderRight: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        {item.quantity || 0}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {item.unit || 'units'}
                      </div>
                    </div>

                    {/* Edit Button - PROMINENT */}
                    <button
                      onClick={() => {
                        setEditingId(item.id)
                        setEditQty(item.quantity || 0)
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 13,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#2563EB'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#3B82F6'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      ✎ Edit Qty
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ROOT — Storekeeper Dashboard (tab shell)
───────────────────────────────────────────────────────────── */
const TABS = [
  { key: 'inventory',  label: 'Warehouse Stock',    Icon: HiOutlineArchiveBox,           color: '#EA8208', desc: 'View warehouse & floor inventory'          },
  { key: 'requests',   label: 'Warehouse Requests', Icon: HiOutlineClipboardDocumentList, color: '#3B82F6', desc: 'Approve/reject requests from staff'          },
  { key: 'request',    label: 'Request Stock',      Icon: HiOutlineClipboardDocumentList, color: '#7C3AED', desc: 'Submit stock requests to the owner'        },
  { key: 'personal',   label: 'My Stock',           Icon: HiOutlineBeaker,               color: '#8B5CF6', desc: 'Manage your personal stock account'        },
  { key: 'receive',    label: 'Receive Delivery',   Icon: HiOutlineTruck,                color: '#047857', desc: 'Confirm and record arrived deliveries'     },
]

export default function Storekeeper() {
  const nav = useNavigate()
  const { role, name } = getSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'inventory'
  const [stats, setStats] = useState({ ingredients: 0, inProgress: 0, pendingDeliveries: 0 })

  useEffect(() => {
    const allowed = ['STOREKEEPER', 'SHOP_ADMIN', 'MANAGER']
    if (role && !allowed.includes(role)) nav('/app/cashier', { replace: true })
  }, [role, nav])

  useEffect(() => {
    Promise.all([
      api('/api/shop/storekeeper/inventory').catch(() => []),
      api('/api/shop/storekeeper/production').catch(() => []),
      api('/api/shop/storekeeper/stock-requests?status=SENT').catch(() => []),
      api('/api/shop/storekeeper/stock-requests?status=APPROVED').catch(() => []),
    ]).then(([inv, prod, sent, approved]) => {
      setStats({
        ingredients: (inv || []).length,
        inProgress:  (prod || []).filter(p => p.status === 'IN_PROGRESS').length,
        pendingDeliveries: [...(sent || []), ...(approved || [])].length,
      })
    }).catch(() => {})
  }, [tab])

  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      sessionStorage.clear()
      nav('/login', { replace: true })
    }
  }

  return (
    <div className="sk-page am-animate">

      {/* ── Hero Header ── */}
      <div className="sk-hero">
        <div className="sk-hero-left">
          <div className="sk-hero-avatar">{initials}</div>
          <div>
            <p className="sk-hero-greeting">{greeting}, {name?.split(' ')[0] || 'Storekeeper'} 👋</p>
            <h1 className="sk-hero-title">Warehouse Control</h1>
            <p className="sk-hero-sub">Manage production · stock requests · deliveries</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="sk-hero-badge">
            <HiOutlineShieldCheck size={18} />
            Active Session
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => {
              e.target.style.background = '#FCA5A5'
              e.target.style.borderColor = '#F87171'
            }}
            onMouseOut={e => {
              e.target.style.background = '#FEE2E2'
              e.target.style.borderColor = '#FECACA'
            }}
          >
            <HiOutlineArrowRightOnRectangle size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="sk-stats-row">
        <div className="sk-stat-card">
          <div className="sk-stat-icon" style={{ background: 'rgba(29,53,87,0.1)', color: '#1D3557' }}>
            <HiOutlineCubeTransparent size={22} />
          </div>
          <div>
            <div className="sk-stat-value">{stats.ingredients}</div>
            <div className="sk-stat-label">Inventory Items</div>
          </div>
        </div>
        <div className="sk-stat-card">
          <div className="sk-stat-icon" style={{ background: 'rgba(234,179,8,0.12)', color: '#B45309' }}>
            <HiOutlineArrowPathRoundedSquare size={22} />
          </div>
          <div>
            <div className="sk-stat-value">{stats.inProgress}</div>
            <div className="sk-stat-label">Productions In Progress</div>
          </div>
        </div>
        <div className="sk-stat-card">
          <div className="sk-stat-icon" style={{ background: 'rgba(4,120,87,0.12)', color: '#047857' }}>
            <HiOutlineTruck size={22} />
          </div>
          <div>
            <div className="sk-stat-value">{stats.pendingDeliveries}</div>
            <div className="sk-stat-label">Pending Deliveries</div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="sk-tabs">
        {TABS.map(({ key, label, Icon, color, desc }) => (
          <button key={key} type="button"
            className={`sk-tab-btn ${tab === key ? 'active' : ''}`}
            style={tab === key ? { '--tab-color': color, borderColor: color } : {}}
            onClick={() => setSearchParams({ tab: key })}>
            <div className="sk-tab-icon" style={tab === key ? { background: color, color: '#fff' } : {}}>
              <Icon size={18} />
            </div>
            <div className="sk-tab-text">
              <span className="sk-tab-label">{label}</span>
              <span className="sk-tab-desc">{desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Screen content ── */}
      <div className="sk-content">
        {tab === 'inventory'  && <WarehouseInventoryScreen />}
        {tab === 'requests'   && <WarehouseRequestsScreen />}
        {tab === 'request'    && <StockRequestScreen />}
        {tab === 'personal'   && <PersonalStockScreen />}
        {tab === 'receive'    && <ReceiveDeliveryScreen />}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, getSession, clearSession } from '../../api'
import { shouldShowAdminDashboard } from '../../utils/adminAccess.js'
import { getDashboardLabel } from '../../utils/roles.js'
import { printKitchenTicket, printReceipt } from '../../printUtil'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
import olitechLogo from '../../assets/Olitech Logo.png'
import { getKigaliToday } from '../../utils/kigaliDate.js'
import socket, { connectSocket } from '../../socket'
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
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineReceiptPercent,
  HiOutlinePrinter,
  HiOutlineCube,
  HiOutlineBeaker
} from 'react-icons/hi2'
import {
  IoCafeOutline,
  IoFastFoodOutline,
  IoBeerOutline,
  IoWineOutline,
  IoIceCreamOutline
} from 'react-icons/io5'
import { MdOutlineLocalDrink, MdOutlineDinnerDining, MdBakeryDining } from 'react-icons/md'

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = (freq, start, dur) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    play(880, 0, 0.15)       // first ding
    play(1100, 0.2, 0.15)    // second ding (higher)
    play(880, 0.4, 0.2)      // third ding
  } catch (e) {}
}

const CATEGORY_THEMES = {
  'Hot Coffee':           { bg: '#FFF3E0', border: '#FFB74D', text: '#E65100' },
  'Tea & Hot Drinks':     { bg: '#E8F5E9', border: '#66BB6A', text: '#2E7D32' },
  'Juice & Smoothies':    { bg: '#FCE4EC', border: '#F48FB1', text: '#AD1457' },
  'Main Food / Meals':    { bg: '#E3F2FD', border: '#42A5F5', text: '#1565C0' },
  'Beer & Alcohol':       { bg: '#F3E5F5', border: '#CE93D8', text: '#6A1B9A' },
  'Soft Drinks':          { bg: '#E0F7FA', border: '#4DD0E1', text: '#00695C' },
  'Wines':                { bg: '#FFF8E1', border: '#FFD54F', text: '#F57F17' },
  'Fast Food':            { bg: '#FBE9E7', border: '#FF8A65', text: '#BF360C' },
  'Snacks':               { bg: '#F9FBE7', border: '#DCE775', text: '#827717' },
  'Accompaniments':       { bg: '#EFEBE9', border: '#A1887F', text: '#4E342E' },
  'Gift Shop':            { bg: '#FCE4EC', border: '#EC407A', text: '#C2185B' },
  'Cups&Takeaway':        { bg: '#E0F2F1', border: '#4DB6AC', text: '#004D40' },
};

function getCategoryColors(category) {
  return CATEGORY_THEMES[category] || { bg: '#FFFFFF', border: '#E5E7EB', text: '#1D3557' };
}

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

function formatShiftTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Kigali',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShiftLabel(s) {
  const opener = s.opened_by_user?.name || 'Staff';
  const closed = s.closed_at ? formatShiftTime(s.closed_at) : '—';
  return `${formatShiftTime(s.opened_at)} → ${closed} · ${opener}`;
}

function roleDisplayLabel(role) {
  if (role === 'SHOP_ADMIN') return 'Owner'
  if (role === 'MANAGER') return 'Manager'
  if (role === 'CASHIER') return 'Cashier'
  if (role === 'WAITER') return 'Waiter'
  return role || 'Staff'
}

/* ─────────────────────────────────────────────────────────────
/* ─────────────────────────────────────────────────────────────
   Production Recording Screen (Cashier Version)
───────────────────────────────────────────────────────────── */
function ProductionRecordingScreen() {
  const [products, setProducts]     = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [recipe, setRecipe]         = useState(null)
  const [quantityToAdd, setQuantityToAdd] = useState('')
  const [notes, setNotes]           = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [productionSearch, setProductionSearch] = useState('')
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [recipeForm, setRecipeForm] = useState({
    standardYield: '',
    ingredients: []
  })
  const [availableIngredients, setAvailableIngredients] = useState([])

  // Load prepared products and ingredients
  useEffect(() => {
    Promise.all([
      api('/api/shop/cashier/prepared-products'),
      api('/api/shop/ingredients')
    ])
      .then(([prods, ings]) => {
        setProducts(prods || [])
        setAvailableIngredients(ings || [])
      })
      .catch(e => setError(e.message))
  }, [])

  async function onProductSelect(productId) {
    setSelectedProduct(products.find(p => p.id === productId))
    setRecipe(null)
    setQuantityToAdd('')
    setError('')
    setSuccess('')
    if (!productId) return
    
    try {
      const r = await api(`/api/shop/cashier/recipes/${productId}`)
      setRecipe(r)
    } catch (e) { 
      setError(e.message)
      // If no recipe, show create recipe modal
      if (e.message?.includes('NO_RECIPE') || e.message?.includes('not found')) {
        setShowRecipeModal(true)
        const productStandardYield = selectedProduct?.standardYield || 1
        setRecipeForm({
          standardYield: String(productStandardYield),
          ingredients: []
        })
      }
    }
  }

  // Calculate batches and ingredient deductions
  // Use recipe's standardYield, fallback to product's if not available
  const standardYield = recipe?.standardYield || selectedProduct?.standardYield || 1
  const batchesNeeded = recipe && quantityToAdd > 0 
    ? parseFloat(quantityToAdd) / standardYield 
    : 0

  const scaledIngredients = recipe && quantityToAdd > 0
    ? recipe.ingredients.map(ing => ({
        ...ing,
        deduction: parseFloat((ing.quantityRequired * batchesNeeded).toFixed(4)),
        remaining: ing.currentStock - (ing.quantityRequired * batchesNeeded)
      }))
    : (recipe?.ingredients || [])

  // Check if recipe is complete (has ingredients)
  const hasCompleteRecipe = recipe && recipe.ingredients && recipe.ingredients.length > 0

  // Check if all ingredients are zero
  const allIngredientsZero = scaledIngredients.length > 0 && 
    scaledIngredients.every(ing => ing.currentStock <= 0)

  // Check if any ingredient would go negative
  const hasInsufficientStock = scaledIngredients.some(ing => ing.remaining < 0)

  async function handleRecordProduction(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // BLOCK: Recipe is required
    if (!selectedProduct) {
      setError('⚠️ Select a product first')
      return
    }
    
    if (!recipe) {
      setError('🛑 RECIPE REQUIRED: This product has no recipe. Create a recipe first before recording production.')
      return
    }
    
    // BLOCK: Recipe must have ingredients
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      setError('🛑 INCOMPLETE RECIPE: Add ingredients to the recipe before recording production.')
      return
    }

    // BLOCK: No negative stock - check if any ingredient would go negative
    const hasInsufficientStock = scaledIngredients.some(ing => ing.remaining < 0)
    if (hasInsufficientStock) {
      const insufficientItems = scaledIngredients
        .filter(ing => ing.remaining < 0)
        .map(ing => `${ing.name} (need ${ing.deduction.toFixed(2)}, have ${ing.currentStock.toFixed(2)})`)
        .join('\n')
      setError(`❌ INSUFFICIENT STOCK:\n${insufficientItems}\n\nCannot proceed with negative stock.`)
      return
    }
    
    const qty = parseFloat(quantityToAdd)
    if (!qty || qty <= 0) { 
      setError('Enter a valid quantity to add'); 
      return 
    }
    
    setBusy(true)
    try {
      const result = await api('/api/shop/cashier/production', {
        method: 'POST',
        body: JSON.stringify({ 
          menuItemId: selectedProduct.id, 
          quantityToAdd: qty,
          notes 
        }),
      })
      
      setSuccess(`✅ Production recorded! Added ${result.quantityAdded} units. New stock: ${result.newStock}`)
      setQuantityToAdd('')
      setNotes('')
      setSelectedProduct(null)
      setRecipe(null)
      setProductionSearch('')
      
      // Refresh products to show updated stock
      const prods = await api('/api/shop/cashier/prepared-products')
      setProducts(prods || [])
    } catch (e) { 
      setError(e.message || 'Failed to record production') 
    }
    finally { setBusy(false) }
  }

  async function handleSaveRecipe(e) {
    e.preventDefault()
    setError('')
    
    if (!selectedProduct) return
    if (!recipeForm.standardYield || parseFloat(recipeForm.standardYield) <= 0) {
      setError('Standard yield must be greater than 0')
      return
    }
    if (recipeForm.ingredients.length === 0) {
      setError('Add at least one ingredient')
      return
    }
    
    setBusy(true)
    try {
      await api('/api/shop/cashier/recipes', {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: selectedProduct.id,
          standardYield: parseFloat(recipeForm.standardYield),
          ingredients: recipeForm.ingredients.map(ing => ({
            ingredientId: ing.id,
            quantity: parseFloat(ing.quantity)
          }))
        })
      })
      
      setShowRecipeModal(false)
      setSuccess('✅ Recipe saved! You can now record production.')
      
      // Reload recipe
      const r = await api(`/api/shop/cashier/recipes/${selectedProduct.id}`)
      setRecipe(r)
    } catch (e) {
      setError(e.message || 'Failed to save recipe')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', zIndex: 1, overflow: 'visible' }}>
      {/* Success Message */}
      {success && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#065F46', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#B91C1C', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Recipe Creation Modal */}
      {showRecipeModal && selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setShowRecipeModal(false); setError('') }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 500, padding: 28, borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', color: '#111827', fontSize: 18, fontWeight: 800 }}>
              Create Recipe for {selectedProduct.name}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
              Define the ingredients and batch size for this product
            </p>
            <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  Standard Yield (units per batch)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={recipeForm.standardYield}
                  onChange={e => setRecipeForm(f => ({ ...f, standardYield: e.target.value }))}
                  placeholder="e.g. 25"
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, border: '1px solid #D1D5DB', borderRadius: 8 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                  How many units does one batch produce?
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8, display: 'block' }}>
                  Ingredients
                </label>
                {recipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select
                      value={ing.id}
                      onChange={e => {
                        const selected = availableIngredients.find(i => i.id === e.target.value)
                        setRecipeForm(f => ({
                          ...f,
                          ingredients: f.ingredients.map((item, i) =>
                            i === idx ? { ...item, id: e.target.value, name: selected?.name || '' } : item
                          )
                        }))
                      }}
                      style={{ flex: 2, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8 }}
                    >
                      <option value="">Select ingredient...</option>
                      {availableIngredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={e => {
                        setRecipeForm(f => ({
                          ...f,
                          ingredients: f.ingredients.map((item, i) =>
                            i === idx ? { ...item, quantity: e.target.value } : item
                          )
                        }))
                      }}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeForm(f => ({
                          ...f,
                          ingredients: f.ingredients.filter((_, i) => i !== idx)
                        }))
                      }}
                      style={{ padding: '8px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setRecipeForm(f => ({
                      ...f,
                      ingredients: [...f.ingredients, { id: '', name: '', quantity: '' }]
                    }))
                  }}
                  style={{ width: '100%', padding: '8px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add Ingredient
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="submit" disabled={busy} style={{
                  flex: 1, padding: 12, background: busy ? '#D1D5DB' : '#10B981', color: 'white', border: 'none', 
                  borderRadius: 8, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer'
                }}>
                  {busy ? 'Saving…' : '✓ Save Recipe'}
                </button>
                <button type="button" onClick={() => { setShowRecipeModal(false); setError('') }} style={{
                  flex: 1, padding: 12, background: '#F3F4F6', color: '#374151', border: 'none',
                  borderRadius: 8, fontWeight: 600, cursor: 'pointer'
                }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production Form */}
      <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 16, border: '1px solid var(--pos-border)', overflow: 'visible' }}>
        <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: '#1D3557', fontSize: 16 }}>
          <HiOutlineBeaker style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Record Production
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
          Add finished product quantity to stock. Ingredients will be auto-deducted based on recipe.
        </p>
        <form onSubmit={handleRecordProduction} style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'visible', zIndex: 1 }}>
          <div style={{ position: 'relative', zIndex: 100 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Prepared Product</label>
            <div style={{ position: 'relative', marginTop: 4, overflow: 'visible' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                background: '#FFFFFF',
                gap: 8
              }}>
                <HiOutlineMagnifyingGlass style={{ color: '#6B7280', fontSize: 18 }} />
                <input
                  type="text"
                  placeholder="🔍 Search prepared products..."
                  value={productionSearch}
                  onChange={(e) => setProductionSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13
                  }}
                />
              </div>
            </div>
          </div>

          {selectedProduct && !recipe && !showRecipeModal && (
            <div style={{ padding: 16, background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#F57F17', fontWeight: 600 }}>
                ⚠️ This product has no recipe. Create a recipe first to record production.
              </p>
              <button
                type="button"
                onClick={() => setShowRecipeModal(true)}
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Create Recipe
              </button>
            </div>
          )}

          {/* Show form fields when product selected (with or without recipe) */}
          {selectedProduct && (
            <>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  Quantity to Add (units)
                </label>
                {recipe && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    Standard yield: {standardYield} units per batch. Current stock: {selectedProduct?.currentStock || 0}
                  </p>
                )}
                {!recipe && (
                  <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#F59E0B' }}>
                    ⚠️ Create a recipe first to see production details
                  </p>
                )}
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={quantityToAdd}
                  onChange={e => setQuantityToAdd(e.target.value)}
                  placeholder="e.g. 1"
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, border: '1px solid #D1D5DB', borderRadius: 8 }}
                  disabled={!recipe}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Morning batch"
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, border: '1px solid #D1D5DB', borderRadius: 8 }}
                />
              </div>
            </>
          )}

          {recipe && (
            <>
              {quantityToAdd > 0 && scaledIngredients.length > 0 && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1D3557' }}>
                    Ingredients to Deduct ({batchesNeeded.toFixed(2)} batches)
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 11, color: '#6B7280' }}>
                    Calculation: {quantityToAdd} units ÷ {standardYield} = {batchesNeeded.toFixed(2)} batches
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scaledIngredients.map((ing, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: ing.remaining < 0 ? 'rgba(239,68,68,0.05)' : '#FFFFFF',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: ing.remaining < 0 ? 'rgba(239,68,68,0.2)' : '#E5E7EB'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{ing.name}</div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            Stock: {ing.currentStock} → Will deduct: {ing.deduction} → Remaining: {' '}
                            <span style={{ 
                              fontWeight: 700,
                              color: ing.remaining < 0 ? '#DC2626' : ing.remaining < ing.currentStock * 0.1 ? '#F59E0B' : '#10B981'
                            }}>
                              {ing.remaining.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {ing.remaining < 0 && (
                          <span style={{ fontSize: 20 }}>⚠️</span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {allIngredientsZero && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>
                        ❌ Cannot produce: All ingredients are out of stock
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  type="submit" 
                  disabled={busy || !quantityToAdd || allIngredientsZero || !hasCompleteRecipe || hasInsufficientStock} 
                  style={{
                  flex: 1,
                    borderRadius: 10, 
                    height: 48, 
                    fontSize: 15, 
                    fontWeight: 700,
                    background: (busy || !quantityToAdd || allIngredientsZero || !hasCompleteRecipe || hasInsufficientStock) ? '#D1D5DB' : '#10B981', 
                    color: 'white', 
                    border: 'none', 
                    cursor: (busy || !quantityToAdd || allIngredientsZero || !hasCompleteRecipe || hasInsufficientStock) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? 'Recording…' : '✅ Record Production'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecipeModal(true)
                    setRecipeForm({
                      standardYield: recipe.standardYield.toString(),
                      ingredients: recipe.ingredients.map(ing => ({
                        id: ing.ingredientId || ing.componentMenuItemId,
                        name: ing.name,
                        quantity: ing.quantityRequired.toString()
                      }))
                    })
                  }}
                  style={{
                    padding: '0 16px',
                    background: '#F3F4F6',
                    color: '#374151',
                    border: '1px solid #D1D5DB',
                    borderRadius: 10,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ✏️ Edit Recipe
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Search Results Dropdown - RENDERED OUTSIDE FORM */}
      {productionSearch && (
        <div style={{
          position: 'fixed',
          width: 'calc(100% - 200px)',
          background: '#FFFFFF',
          border: '2px solid #3B82F6',
          borderRadius: '12px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 9999,
          boxShadow: '0 12px 32px rgba(59, 130, 246, 0.35)',
          pointerEvents: 'auto',
          left: 24,
          top: 'auto'
        }}>
          {products.filter(p => p.name.toLowerCase().includes(productionSearch.toLowerCase())).length > 0 ? (
            <div>
              {products
                .filter(p => p.name.toLowerCase().includes(productionSearch.toLowerCase()))
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onProductSelect(p.id);
                      setProductionSearch('');
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F3F4F6',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F0F9FF'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    <div style={{ fontWeight: 700, color: '#111827', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      Current stock: {p.currentStock} | Standard yield: {p.standardYield}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#DC2626', fontSize: 13 }}>
              No products found matching "{productionSearch}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}


export default function CashierDashboard() {
  const nav = useNavigate()
  const session = getSession()
  const { role } = session

  useEffect(() => {
    if (role === 'STOREKEEPER') {
      nav('/app/storekeeper', { replace: true })
    } else if (role === 'AUDITOR') {
      nav('/app/auditor', { replace: true })
    }
  }, [role, nav])

  const { context, shift, reload: reloadShift, setShift, isShopAdmin } = useShopContext()
  const shopName = context?.name || ''
  const showAdmin = shouldShowAdminDashboard(session, context) || isShopAdmin
  const canManageShift = role === 'CASHIER' || role === 'SHOP_ADMIN' || role === 'MANAGER' || showAdmin

  // Query Params
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'new'
  const editId = searchParams.get('edit')
  
  const setTab = (t) => {
    // Gate the ready tab — only CASHIER, MANAGER, SHOP_ADMIN can enter directly
    if (t === 'ready') {
      const canEnterDirectly = role === 'CASHIER' || role === 'MANAGER' || role === 'SHOP_ADMIN'
      if (!canEnterDirectly) {
        // Waiter — show PIN gate
        setShowReadyPinModal(true)
        setReadyPinInput('')
        setReadyPinError('')
        return
      }
      if (!readyTabUnlocked) {
        setShowReadyPinModal(true)
        setReadyPinInput('')
        setReadyPinError('')
        return
      }
    }
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
  const [shiftForm, setShiftForm] = useState({ initialCash: '0', initialMomo: '0', actualCash: '0', actualMomo: '0', cashout: '0', expenses: '0', notes: '' })
  const [cartExpanded, setCartExpanded] = useState(false)

  // New Order states
  const [menu, setMenu] = useState([])
  const [staff, setStaff] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [tableNumber, setTableNumber] = useState('1')
  const [selectedWaiter, setSelectedWaiter] = useState('')
  const [pendingWaiterId, setPendingWaiterId] = useState(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [longPressTimer, setLongPressTimer] = useState(null)
  const [selectedOrderForTicket, setSelectedOrderForTicket] = useState(null)
  const [selectedItemsForPrint, setSelectedItemsForPrint] = useState({}) // Track which items to print
  const [pinError, setPinError] = useState('')
  const [showRemovalPinModal, setShowRemovalPinModal] = useState(false) // PIN modal for removing items
  const [pendingItemRemovalId, setPendingItemRemovalId] = useState(null) // Which item is being removed
  const [pendingClearAllItems, setPendingClearAllItems] = useState(false) // Flag for clear all action
  const [qtyById, setQtyById] = useState({})
  const [initialQtyById, setInitialQtyById] = useState({})
  
  const [showCashierAuthPayload, setShowCashierAuthPayload] = useState(null)
  const [cashierAuthPin, setCashierAuthPin] = useState('')
  const [cashierAuthError, setCashierAuthError] = useState('')

  // Ready tab PIN gate
  const [readyTabUnlocked, setReadyTabUnlocked] = useState(false)
  const [showReadyPinModal, setShowReadyPinModal] = useState(false)
  const [readyPinInput, setReadyPinInput] = useState('')
  const [readyPinError, setReadyPinError] = useState('')

  // Which order cards have their billing section expanded
  const [expandedBilling, setExpandedBilling] = useState({})

  // Warehouse Requests state
  const [warehouseRequests, setWarehouseRequests] = useState([])
  const [warehouseInventory, setWarehouseInventory] = useState([])
  const [newWarehouseRequest, setNewWarehouseRequest] = useState({ productId: '', quantity: '', notes: '' })
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [warehouseError, setWarehouseError] = useState('')
  const [warehouseSearchOpen, setWarehouseSearchOpen] = useState(false)
  const [warehouseSearchInput, setWarehouseSearchInput] = useState('')
  const [warehouseProductSearch, setWarehouseProductSearch] = useState('')
  const [warehouseProductDropdownOpen, setWarehouseProductDropdownOpen] = useState(false)

  // Billing (Pending & Ready) states
  const [pending, setPending] = useState([])
  const [ready, setReady] = useState([])

  // Ready orders should always be visible for payment, regardless of shift
  // (they were created in previous shifts and need to be paid before closing)
  const filteredReadyOrders = (ready || []);
  
  if (ready.length > 0 || !shift) {
    console.log(`📊 [Refund] ready.length=${ready.length}, shift=${shift ? '✓ active' : '✗ closed'}, filtered=${filteredReadyOrders.length}`);
  }

  // History states (closed shifts only)
  const [historyDate, setHistoryDate] = useState(() => getKigaliToday())
  const [closedShifts, setClosedShifts] = useState([])
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [historyData, setHistoryData] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Loan states
  const [loans, setLoans] = useState([])
  const [loadingLoans, setLoadingLoans] = useState(false)
  const [showRepaymentModal, setShowRepaymentModal] = useState(null) // loan object
  const [repaymentForm, setRepaymentForm] = useState({ amount: '', method: 'CASH' })
  
  const [paymentMethods, setPaymentMethods] = useState({})
  const [clientNames, setClientNames] = useState({})
  const [splitModes, setSplitModes] = useState({})
  const [splitAmounts, setSplitAmounts] = useState({})

  const handleSplitAmountChange = (orderId, method, value) => {
    setSplitAmounts(prev => {
      const orderSplits = prev[orderId] || {};
      return {
        ...prev,
        [orderId]: {
          ...orderSplits,
          [method]: value
        }
      };
    });
  };

  const getSplitTotal = (orderId) => {
    const splits = splitAmounts[orderId] || {};
    return (parseFloat(splits.CASH) || 0) + 
           (parseFloat(splits.MOBILE_MONEY) || 0) + 
           (parseFloat(splits.POS) || 0) + 
           (parseFloat(splits.LOAN) || 0);
  };

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

  const loadClosedShifts = useCallback(async (date) => {
    try {
      const shifts = await api(`/api/shop/shifts/closed?date=${date}`)
      setClosedShifts(shifts)
      if (shifts.length > 0) {
        setSelectedShiftId(prev => (prev && shifts.some(s => s.id === prev) ? prev : shifts[0].id))
      } else {
        setSelectedShiftId('')
        setHistoryData([])
        setHistoryTotal(0)
      }
    } catch (e) {
      console.error('Failed to load closed shifts:', e)
    }
  }, [])

  const isHistoryToday = historyDate === getKigaliToday()

  // Load History for a closed shift only
  const loadHistory = useCallback(async (shiftId) => {
    if (!shiftId) {
      setHistoryData([])
      setHistoryTotal(0)
      return
    }
    setLoadingHistory(true)
    try {
      const res = await api(`/api/shop/reports/shift/${shiftId}/sales`)
      
      let totalAmount = 0
      const summary = {}
      const processedOrders = new Set()

      res.forEach(p => {
        if (p.methodLabel !== 'CR/Loan') {
          totalAmount += Number(p.amount || 0)
        }

        // Count products (only once per order to avoid duplicating items on split payments)
        if (p.rawItems && p.orderId && !processedOrders.has(p.orderId)) {
          processedOrders.add(p.orderId)
          p.rawItems.forEach(item => {
            if (!summary[item.name]) {
              summary[item.name] = { name: item.name, qty: 0, amount: 0, category: item.category }
            }
            summary[item.name].qty += Number(item.qty)
            summary[item.name].amount += (Number(item.qty) * Number(item.price))
          })
        }
      })
      
      const sorted = Object.values(summary).sort((a, b) => b.qty - a.qty)
      setHistoryData(sorted)
      
      const itemsSum = sorted.reduce((acc, item) => acc + item.amount, 0)
      
      // Store BOTH the raw payments and the items sum so we can show the discrepancy
      setHistoryTotal(itemsSum)
      // We will attach total payments as a separate property to use in the view
      sorted._totalPaymentsReceived = totalAmount
    } catch (e) {
      console.error("Failed to load history:", e)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // Load Loans
  const loadLoans = useCallback(async (status) => {
    setLoadingLoans(true)
    try {
      const res = await api(`/api/shop/loans?status=${status || ''}`)
      setLoans(res)
    } catch (e) {
      console.error("Failed to load loans:", e)
    } finally {
      setLoadingLoans(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'history') {
      void loadClosedShifts(historyDate)
    }
    if (tab === 'loans') {
      loadLoans('UNPAID')
    }
    // Lock the ready tab whenever user navigates away from it
    if (tab !== 'ready') {
      setReadyTabUnlocked(false)
      setExpandedBilling({})
    }
  }, [tab, historyDate, loadClosedShifts, loadLoans])

  useEffect(() => {
    if (tab === 'history' && selectedShiftId) {
      void loadHistory(selectedShiftId)
    }
  }, [tab, selectedShiftId, loadHistory])

  // Close warehouse product dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const warehouseProductField = document.querySelector('[data-warehouse-product-field]')
      if (warehouseProductField && !warehouseProductField.contains(e.target)) {
        setWarehouseProductDropdownOpen(false)
      }
    }

    if (warehouseProductDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [warehouseProductDropdownOpen])

  const loadBilling = useCallback(async () => {
    try {
      const [kitchen, drafts, chefReady, r] = await Promise.all([
        api('/api/shop/orders/kitchen-queue'),
        api('/api/shop/orders/drafts'),
        api('/api/shop/orders/chef-ready'),
        api('/api/shop/orders/ready')
      ])
      // Merge and sort
      setPending([...kitchen, ...chefReady, ...drafts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      const mappedReady = r.map(o => {
        const total = o.lines.reduce((sum, l) => sum + Number(l.price)*l.quantity, 0)
        return { ...o, total }
      })
      setReady(mappedReady)
    } catch (e) { /* ignore */ }
  }, [])

  // Load warehouse inventory for requests
  const loadWarehouseInventory = useCallback(async () => {
    try {
      const inv = await api('/api/shop/warehouse/inventory')
      setWarehouseInventory(inv)
    } catch (e) {
      console.error('Failed to load warehouse inventory:', e)
    }
  }, [])

  // Load cashier's warehouse requests
  const loadWarehouseRequests = useCallback(async () => {
    setWarehouseLoading(true)
    try {
      const reqs = await api('/api/shop/warehouse/requests')
      setWarehouseRequests(reqs)
      setWarehouseError('')
    } catch (e) {
      setWarehouseError(e.message || 'Failed to load requests')
    } finally {
      setWarehouseLoading(false)
    }
  }, [])

  // Create a new warehouse request
  const handleCreateWarehouseRequest = useCallback(async (e) => {
    e.preventDefault()
    if (!newWarehouseRequest.productId || !newWarehouseRequest.quantity) {
      setWarehouseError('Product and quantity required')
      return
    }
    
    // Validate that the selected product exists in the system
    const selectedItem = warehouseInventory.find(i => i.productId === newWarehouseRequest.productId)
    if (!selectedItem) {
      setWarehouseError('Selected product is not in the system. Please select from available items only.')
      return
    }
    
    setBusy(true)
    try {
      await api('/api/shop/warehouse/requests', {
        method: 'POST',
        body: JSON.stringify({
          productId: newWarehouseRequest.productId,
          itemType: selectedItem.itemType,
          quantity: parseFloat(newWarehouseRequest.quantity),
          notes: newWarehouseRequest.notes
        })
      })
      setNewWarehouseRequest({ productId: '', quantity: '', notes: '' })
      setWarehouseProductSearch('')
      setWarehouseError('')
      await loadWarehouseRequests()
    } catch (e) {
      setWarehouseError(e.message || 'Failed to create request')
    } finally {
      setBusy(false)
    }
  }, [newWarehouseRequest, loadWarehouseRequests])

  // Load warehouse data when tab changes
  useEffect(() => {
    if (tab === 'warehouse') {
      void loadWarehouseInventory()
      void loadWarehouseRequests()
    }
  }, [tab, loadWarehouseInventory, loadWarehouseRequests])

  useEffect(() => {
    void loadMenu()
    void loadBilling()
  }, [loadMenu, loadBilling])

  // Real-time subscriptions (Socket.io) + polling fallback
  useEffect(() => {
    const tenantId = getSession().tenantId;
    if (!tenantId) return;

    connectSocket(tenantId);

    const onMenuUpdate = () => { loadMenu().catch(()=>{}) };
    const onStockUpdate = () => { loadMenu().catch(()=>{}) };
    const onStaffUpdate = () => { loadMenu().catch(()=>{}) };
    const onEodUpdate = () => { reloadShift().catch(()=>{}) };
    const onOrderUpdate = (data) => { 
      // Add 500ms delay to allow Supabase replication to complete
      // This ensures the order is visible when we query the database
      // 100ms was too short for multi-machine scenarios with network latency
      setTimeout(() => {
        loadBilling().catch(()=>{})
      }, 500)
      // Beep for cashier/waiter when chef marks an order ready
      if (data && data.action === 'MARK_READY') {
        playBeep()
      }
    };

    socket.on('menuUpdate', onMenuUpdate);
    socket.on('stockUpdate', onStockUpdate);
    socket.on('staffUpdate', onStaffUpdate);
    socket.on('eodUpdate', onEodUpdate);
    socket.on('orderUpdate', onOrderUpdate);

    // Polling fallback: refresh billing every 2s (more aggressive polling for multi-machine sync)
    // This ensures all devices see new orders within 2 seconds
    const pollInterval = setInterval(() => {
      loadBilling().catch(() => {});
    }, 2_000);

    return () => {
      socket.off('menuUpdate', onMenuUpdate);
      socket.off('stockUpdate', onStockUpdate);
      socket.off('staffUpdate', onStaffUpdate);
      socket.off('eodUpdate', onEodUpdate);
      socket.off('orderUpdate', onOrderUpdate);
      clearInterval(pollInterval);
    };
  }, [loadMenu, loadBilling, reloadShift])

  // Load Order to edit (and switch to tab if needed)
  useEffect(() => {
    if (editId) {
      // Don't auto-switch tabs - user can stay on pending/waiting to edit in context
      api(`/api/shop/orders/${editId}`).then(order => {
        setTableNumber(String(order.tableNumber))
        setSelectedWaiter(order.waiterId || '')
        const qtys = {}
        order.lines.forEach(l => { qtys[l.menuItemId] = l.quantity })
        setQtyById(qtys)
        setInitialQtyById(qtys)
      }).catch(e => setError(e.message))
    }
  }, [editId])

  /* --- ACTIONS --- */

  // Shift Actions
  async function handleShiftAction() {
    setBusy(true)
    const closingShift = showShiftModal === 'CLOSE'
    try {
      if (showShiftModal === 'OPEN') {
        await api('/api/shop/shifts/open', {
          method: 'POST', body: JSON.stringify({ initialCash: Number(shiftForm.initialCash), initialMomo: Number(shiftForm.initialMomo) })
        })
      } else {
        await api('/api/shop/shifts/close', {
          method: 'POST', body: JSON.stringify({ actualCash: Number(shiftForm.actualCash), actualMomo: Number(shiftForm.actualMomo), cashout: Number(shiftForm.cashout), expenses: Number(shiftForm.expenses), notes: shiftForm.notes })
        })
        setShift(null)
      }
      setShowShiftModal('')
      await reloadShift()
      if (closingShift) void loadClosedShifts(historyDate)
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Cart Actions
  function setQty(id, next) {
    if (editId && (role === 'CASHIER' || role === 'WAITER')) {
      const initialQty = initialQtyById[id] || 0;
      // If reducing below initial quantity, require PIN verification
      if (next < initialQty) {
        setPendingItemRemovalId(id)
        setShowRemovalPinModal(true)
        setPinInput('')
        setPinError('')
        return
      }
    }
    // Allow adding items without PIN
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

  const serviceStaff = useMemo(
    () => staff.filter(s => s.role === 'WAITER' || s.role === 'CASHIER' || s.role === 'MANAGER'),
    [staff],
  )

  const dynamicCategories = useMemo(() => {
    const cats = ['All', ...new Set(menu.map(m => m.category).filter(Boolean))]
    return cats
  }, [menu])

  const kitchenTicketLines = () => cartLines.map(l => ({
    quantity: l.quantity,
    itemName: l.name,
    ingredients: l.ingredients,
  }))

  const waiterLabel = () => staff.find(x => x.id === selectedWaiter)?.name || 'Staff'

  // Waiter Selection with PIN authentication
  async function handleWaiterSelect(waiterId) {
    if (!waiterId) {
      setSelectedWaiter('')
      return
    }

    // Check if waiter requires PIN
    const waiter = staff.find(s => s.id === waiterId)
    if (waiter && waiter.security_pin) {
      setPendingWaiterId(waiterId)
      setShowPinModal(true)
      setPinInput('')
      setPinError('')
    } else {
      setSelectedWaiter(waiterId)
    }
  }

  async function confirmRemovalPin(e) {
    e.preventDefault()
    if (!pinInput) {
      setPinError('Enter PIN')
      return
    }

    try {
      // Find a cashier/manager with matching security_key
      const approver = staff.find(s =>
        (s.role === 'CASHIER' || s.role === 'MANAGER' || s.role === 'SHOP_ADMIN') &&
        s.security_key === pinInput.trim()
      )
      
      if (!approver) {
        setPinError('Incorrect PIN or insufficient permissions')
        setPinInput('')
        return
      }

      // IMPORTANT: Only allow PIN from the cashier who opened the current shift
      // Debug logs
      console.log('Shift opened_by:', shift?.opened_by, 'Approver ID:', approver?.id, 'Match:', shift?.opened_by === approver?.id)
      
      if (shift && shift.opened_by && shift.opened_by !== approver.id) {
        setPinError('This PIN belongs to a different cashier. Only the shift opener can modify orders.')
        setPinInput('')
        return
      }

      // PIN verified - now allow the action
      if (pendingClearAllItems) {
        // Clear all items
        setQtyById({})
        setPendingClearAllItems(false)
      } else if (pendingItemRemovalId) {
        // Remove single item
        const initialQty = initialQtyById[pendingItemRemovalId] || 0
        setQtyById(m => {
          const copy = { ...m, [pendingItemRemovalId]: initialQty - 1 }
          if (copy[pendingItemRemovalId] <= 0) delete copy[pendingItemRemovalId]
          return copy
        })
        setPendingItemRemovalId(null)
      }

      // Close modal
      setShowRemovalPinModal(false)
      setPinInput('')
      setPinError('')
    } catch (err) {
      setPinError(err.message)
    }
  }

  // Checkout (New Order) — printKitchen=false skips kitchen ticket
  async function submitOrder(printKitchen = false) {
    if (!shift) { alert("Please open a shift first."); return; }
    
    // FIX: Better waiter validation for mobile
    if (!editId && !selectedWaiter) { 
      alert("⚠️ Please select a waiter/cashier before posting"); 
      return; 
    }
    
    const tn = Number(tableNumber)
    if (!tn || tn < 1) { alert("Invalid table number"); return; }
    if (cartLines.length === 0) { alert("Cart is empty"); return; }
    
    setBusy(true)
    try {
      if (editId) {
        // Check if any items were removed - if so, user must have passed PIN verification
        const originalQtys = initialQtyById || {};
        const currentQtys = qtyById || {};
        let hasRemoval = false;
        
        for (const [itemId, originalQty] of Object.entries(originalQtys)) {
          const currentQty = currentQtys[itemId] || 0;
          if (currentQty < originalQty) {
            hasRemoval = true;
            break;
          }
        }
        
        // Check if items were completely removed
        for (const [itemId, originalQty] of Object.entries(originalQtys)) {
          if (!(itemId in currentQtys) && originalQty > 0) {
            hasRemoval = true;
            break;
          }
        }
        
        await api(`/api/shop/orders/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            tableNumber: tn, 
            items: cartLines, 
            waiterId: selectedWaiter,
            itemsRemoved: hasRemoval  // Flag indicating removals were made
          }),
        })
        if (printKitchen) {
          printKitchenTicket({
            orderId: editId,
            tableNumber: tn,
            shopName,
            lines: kitchenTicketLines(),
            waiterName: waiterLabel(),
          })
        }
        await loadBilling()
        setSearchParams({ tab: 'pending' })
        setQtyById({})
        setInitialQtyById({})
        setTableNumber('1')
        setSelectedWaiter('')
      } else {
        const created = await api('/api/shop/orders', {
          method: 'POST',
          body: JSON.stringify({ tableNumber: tn, items: cartLines, waiterId: selectedWaiter, submitToKitchen: printKitchen })
        })
        
        console.log('✅ Order created:', created.id, 'Status:', created.status, 'Locked:', created.locked)
        
        if (printKitchen) {
          printKitchenTicket({
            orderId: created.id,
            tableNumber: tn,
            shopName,
            lines: kitchenTicketLines(),
            waiterName: waiterLabel(),
          })
        }
        // Optimistically add the new order
        setPending(prev => [created, ...prev])
        // Don't auto-switch tabs - user stays on current tab
        setQtyById({})
        setInitialQtyById({})
        setTableNumber('1')
        setSelectedWaiter('')
        void loadBilling()
      }
    } catch(e) { 
      console.error('Order submission error:', e)
      alert('❌ Failed to submit order: ' + (e.message || 'Unknown error')) 
    }
    finally { setBusy(false) }
  }

  // Pending Actions
  async function markReady(id) {
    setBusy(true)
    try {
      await api(`/api/shop/orders/${id}/mark-ready`, { method: 'POST' })
      await loadBilling()
      // Don't auto-switch tabs - user stays on current tab
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }
  async function handleRevertToPending(id) {
    if (!window.confirm('Revert this order back to the kitchen queue?')) return;
    setBusy(true)
    try {
      await api(`/api/shop/orders/${id}/revert-pending`, { method: 'POST' })
      await loadBilling()
      // Don't auto-switch tabs - user stays on current tab
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }
  async function cancelOrderRequest(id) {
    if(!window.confirm('Cancel this order?')) return;
    try {
      await api(`/api/shop/orders/${id}`, { method: 'DELETE' })
      await loadBilling()
    } catch(e) { alert(e.message) }
  }

  async function handleLogout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  // Awaiting Payment Actions
  async function payOrder(o) {
    setBusy(true)
    try {
      let payload = {};
      let printPayMethod = null;

      if (splitModes[o.id]) {
        const splits = splitAmounts[o.id] || {};
        const paymentsList = [];
        const totalPaidInput = getSplitTotal(o.id);

        if (Math.abs(totalPaidInput - o.total) > 0.05) {
          alert(`Split payments sum (${totalPaidInput.toLocaleString()} RWF) must match order total of ${Number(o.total).toLocaleString()} RWF`);
          setBusy(false);
          return;
        }

        if (parseFloat(splits.CASH || 0) > 0) {
          paymentsList.push({ method: 'CASH', amount: parseFloat(splits.CASH) });
        }
        if (parseFloat(splits.MOBILE_MONEY || 0) > 0) {
          paymentsList.push({ method: 'MOBILE_MONEY', amount: parseFloat(splits.MOBILE_MONEY) });
        }
        if (parseFloat(splits.POS || 0) > 0) {
          paymentsList.push({ method: 'POS', amount: parseFloat(splits.POS) });
        }
        if (parseFloat(splits.LOAN || 0) > 0) {
          const cName = clientNames[o.id] || '';
          if (!cName.trim()) {
            alert("Enter loan client name");
            setBusy(false);
            return;
          }
          paymentsList.push({ method: 'LOAN', amount: parseFloat(splits.LOAN), clientName: cName });
        }

        payload = { payments: paymentsList };
        // We will pass the list of split payments as paymentMethod param to printReceipt!
        printPayMethod = paymentsList;
      } else {
        const method = paymentMethods[o.id]
        const cName = clientNames[o.id] || ''
        if (!method) { alert("Select payment method"); setBusy(false); return; }
        if (method === 'LOAN' && !cName.trim()) { alert("Enter client name"); setBusy(false); return; }

        payload = { method, clientName: method === 'LOAN' ? cName : undefined };
        printPayMethod = method;
      }

      const paid = await api(`/api/shop/orders/${o.id}/pay`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      await loadBilling()
      await loadMenu()
      
      // Cleanup states
      setPaymentMethods(prev => {
        const copy = { ...prev };
        delete copy[o.id];
        return copy;
      })
      setClientNames(prev => {
        const copy = { ...prev };
        delete copy[o.id];
        return copy;
      })
      setSplitModes(prev => {
        const copy = { ...prev };
        delete copy[o.id];
        return copy;
      })
      setSplitAmounts(prev => {
        const copy = { ...prev };
        delete copy[o.id];
        return copy;
      })
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }


  // Loan Repayment Actions
  async function handleRepayment() {
    if (!showRepaymentModal) return;
    const { id } = showRepaymentModal;
    const { amount, method } = repaymentForm;
    if (!amount || Number(amount) <= 0) { alert("Enter valid amount"); return; }
    
    setBusy(true)
    try {
      await api(`/api/shop/loans/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), method })
      })
      setShowRepaymentModal(null)
      setRepaymentForm({ amount: '', method: 'CASH' })
      void loadLoans('UNPAID')
      void reloadShift()
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
          <img src={olitechLogo} alt="Olitech Hub" style={{ height: 56, width: 'auto', objectFit: 'contain', marginRight: 12 }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1D3557' }}>{shopName}</span>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              Logged in as: <strong>{showAdmin ? roleDisplayLabel(role === 'MANAGER' ? 'MANAGER' : 'SHOP_ADMIN') : roleDisplayLabel(role)}</strong>
            </div>
          </div>
        </div>
        
        <div className="cashier-header-actions">
          {shift ? (
            <div className={`cashier-shift-pill`}>
              <div className="dot"></div>
              Shift active • {new Date(shift.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })} | 
              Cash: {Number(shift.initial_cash).toLocaleString()}
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

          {showAdmin && (
             <button className="cashier-btn-admin-dash" onClick={() => nav('/app/admin?tab=overview')}>
               <HiOutlineChartBar /> <span>{getDashboardLabel(role)}</span>
             </button>
           )}

          {canManageShift && (shift ? (
            <button className="cashier-btn-close-shift" onClick={()=>setShowShiftModal('CLOSE')}><span>Close Shift</span></button>
          ) : (
            <button className="cashier-btn-open-shift" onClick={()=>setShowShiftModal('OPEN')}><span>Open Shift</span></button>
          ))}
          {!canManageShift && !shift && (
            <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Ask cashier to open shift</span>
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
          <span className="cashier-tab-badge blue">{filteredReadyOrders.length}</span>
        </button>
        <button className={`cashier-tab ${tab==='production'?'active':''}`} onClick={()=>setTab('production')}>
          <HiOutlineBeaker /> Record Production
        </button>
        {(role === 'CASHIER' || role === 'MANAGER' || role === 'STOREKEEPER') && (
        <button className={`cashier-tab ${tab==='warehouse'?'active':''}`} onClick={()=>setTab('warehouse')}>
          <HiOutlineCube /> Warehouse Requests
          <span className="cashier-tab-badge">{warehouseRequests.filter(r => r.status === 'PENDING').length}</span>
        </button>
        )}
        <button className={`cashier-tab ${tab==='history'?'active':''}`} onClick={()=>setTab('history')}>
          <HiOutlineClock /> History
        </button>
        <button className={`cashier-tab ${tab==='loans'?'active':''}`} onClick={()=>setTab('loans')}>
          <HiOutlineReceiptPercent /> Loans
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
                <select 
                  className="cashier-waiter-sel" 
                  value={selectedWaiter} 
                  disabled={!!editId} 
                  onChange={(e) => handleWaiterSelect(e.target.value)}
                  onBlur={(e) => {
                    // Ensure mobile touch selection registers properly
                    if (e.target.value && e.target.value !== selectedWaiter) {
                      handleWaiterSelect(e.target.value)
                    }
                  }}
                >
                   <option value="">Waiter / Cashier...</option>
                   {serviceStaff.map(s => (
                     <option key={s.id} value={s.id}>
                       {s.name} ({s.role === 'CASHIER' ? 'Cashier' : 'Waiter'})
                     </option>
                   ))}
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
                  const theme = getCategoryColors(m.category);
                  
                  // Enforcement: Stock restrictions apply ONLY to these specific categories
                  const normCat = (m.category || '').toLowerCase().replace(/\s/g, '');
                  const restrictedCats = [
                    'snacks', 'others', 'giftshop', 'softdrinks', 'softdrink',
                    'beer&alcohol', 'cups&takeaway', 'cups&takeway', 'wines', 'wine', 'whisky'
                  ];
                  const isRestricted = restrictedCats.includes(normCat);
                  const isOutOfStock = isRestricted && m.stock_level <= 0;
                  const hasEnoughStock = !isRestricted || qty < m.stock_level;

                  return (
                    <div
                      key={m.id}
                      className={`cashier-card ${isOutOfStock ? 'disabled' : ''}`}
                      onClick={() => {
                        if (isOutOfStock) return;
                        if (!hasEnoughStock) {
                            alert(`Not enough stock for ${m.name}. Only ${m.stock_level} left.`);
                            return;
                        }
                        setQty(m.id, qty + 1);
                      }}
                      style={{
                        background: isOutOfStock ? '#f3f4f6' : theme.bg,
                        borderColor: theme.border,
                        opacity: isOutOfStock ? 0.6 : 1,
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div className="cashier-card-decor" style={{ background: theme.border }} />
                      {qty > 0 && <div className="cashier-card-qty">{qty}</div>}
                      <div className="cashier-card-icon" style={{ color: isOutOfStock ? '#9ca3af' : theme.text }}>{getItemIcon(m.name, m.category)}</div>
                      <div className="cashier-card-title" style={{ color: isOutOfStock ? '#9ca3af' : theme.text }}>{m.name}</div>
                      <div className="cashier-card-price" style={{ color: isOutOfStock ? '#ef4444' : theme.text, fontWeight: isOutOfStock ? 'bold' : 'normal' }}>
                          {isOutOfStock ? 'Out of Stock' : `${Number(m.price).toLocaleString()} RWF`}
                      </div>
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
                        onClick={() => { setSearchParams({}); setQtyById({}); setInitialQtyById({}); setTableNumber('1'); }}
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
                               onClick={() => {
                                 const nextQty = qtyById[l.menuItemId] - 1
                                 setQty(l.menuItemId, nextQty)
                               }}
                               style={{ background: 'transparent', border: 'none', color: '#A0A0A0', cursor: 'pointer', display: 'flex', fontSize: 32 }}
                             >
                               <HiOutlineMinusCircle />
                             </button>
                             <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center', color: '#E6CCB2', fontSize: 24 }}>{l.quantity}</span>
                             <button 
                               onClick={() => {
                                 const mi = menu.find(x => x.id === l.menuItemId);
                                 if (mi && mi.is_recipe === false && qtyById[l.menuItemId] >= mi.stock_level) {
                                    alert(`Not enough stock for ${mi.name}. Only ${mi.stock_level} left.`);
                                    return;
                                 }
                                 setQty(l.menuItemId, qtyById[l.menuItemId] + 1)
                               }}
                               style={{ background: 'transparent', border: 'none', color: '#E6CCB2', cursor: 'pointer', display: 'flex', fontSize: 32 }}
                             >
                               <HiOutlinePlusCircle />
                             </button>
                             {editId && (
                               <button
                                 onClick={() => {
                                   const nextQty = qtyById[l.menuItemId] - 1;
                                   setQty(l.menuItemId, nextQty);
                                 }}
                                 style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', fontSize: 20, marginLeft: 8 }}
                                 title="Remove item"
                               >
                                 <HiOutlineTrash />
                               </button>
                             )}
                          </div>
                       </div>
                     ))
                 )}
               </div>
               {editId && (
                 <div style={{ padding: '8px 0', borderTop: '1px solid #E6CCB2', display: 'flex', gap: 8, marginBottom: 8 }}>
                   <button
                     className="cashier-btn"
                     onClick={() => {
                       setPendingClearAllItems(true)
                       setShowRemovalPinModal(true)
                       setPinInput('')
                       setPinError('')
                     }}
                     style={{ flex: 1, background: '#EF4444', borderColor: '#DC2626', fontSize: 12, padding: '6px 12px' }}
                   >
                     🗑️ Clear All Items
                   </button>
                 </div>
               )}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      className={`cashier-btn-submit ${cartLines.length > 0 ? 'active' : ''}`}
                      disabled={cartLines.length === 0 || busy}
                      onClick={() => submitOrder(false)}
                    >
                      {editId ? '📝 Update Order' : '✈️ Post Order'}
                    </button>
                    <button
                      className={`cashier-btn-submit ${cartLines.length > 0 ? 'active' : ''}`}
                      disabled={cartLines.length === 0 || busy}
                      onClick={() => submitOrder(true)}
                      style={{ background: '#E8751A', borderColor: '#D06612' }}
                    >
                      {editId ? '🖨️ Update + Kitchen Ticket' : '🖨️ Post + Kitchen Ticket'}
                    </button>
                  </div>
               </div>
            </div>
          </>
        )}

        {/* PENDING TAB */}
        {tab === 'pending' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="cashier-billing-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px', padding: '16px' }}>
              {pending.length === 0 && <p className="muted" style={{padding: 24}}>No pending orders.</p>}
              {pending.map(o => {
                const isChefReady = o.status === 'CHEF_READY'
                const isKitchen = o.locked === true && !isChefReady
                const isDraft = !isKitchen && !isChefReady
                
                const handlePointerDown = () => {
                  const timer = setTimeout(() => {
                    setSelectedOrderForTicket(o)
                  }, 500)
                  setLongPressTimer(timer)
                }
                
                const handlePointerUp = () => {
                  if (longPressTimer) clearTimeout(longPressTimer)
                }
                
                return (
                <div 
                  key={o.id} 
                  className="cashier-order-card" 
                  style={{ borderLeft: isChefReady ? '3px solid #EAB308' : isKitchen ? '3px solid #4ADE80' : '3px solid #60A5FA', display: 'flex', flexDirection: 'column', minHeight: '320px' }}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start', marginBottom: '8px'}}>
                    <div className="table-badge">Table {o.tableNumber}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {isChefReady 
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: '#EAB308', background: 'rgba(234,179,8,0.12)', padding: '2px 8px', borderRadius: 20 }}>🔔 READY IN KITCHEN</span>
                        : isKitchen
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: '#4ADE80', background: 'rgba(74,222,128,0.12)', padding: '2px 8px', borderRadius: 20 }}>🍳 IN KITCHEN</span>
                        : <span style={{ fontSize: 10, fontWeight: 800, color: '#60A5FA', background: 'rgba(96,165,250,0.12)', padding: '2px 8px', borderRadius: 20 }}>📋 NO KITCHEN</span>
                      }
                      <div style={{fontSize: 12, color:'#8C9993'}}>{new Date(o.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' })}</div>
                    </div>
                  </div>
                  <div style={{fontSize: 13, color:'#8C9993', marginBottom: '8px'}}>Waiter: {o.waiterName}</div>
                  
                  <div style={{background: '#1C1C1C', color: '#E8E8E8', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: '12px', flex: 1, overflowY: 'auto'}}>
                     {o.lines.map((l, i) => (
                       <div key={i} style={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <strong style={{ color: l.needsKitchen ? '#FB923C' : '#4ADE80', minWidth: 24 }}>
                           {l.quantity}x
                         </strong>
                         <span style={{ flex: 1, fontSize: 12 }}>{l.itemName}</span>
                         {l.needsKitchen && (
                           <span style={{ fontSize: 8, fontWeight: 800, color: '#FB923C', background: 'rgba(251,146,60,0.15)', padding: '1px 4px', borderRadius: 8, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                             🍳 KITCHEN
                           </span>
                         )}
                       </div>
                     ))}
                  </div>

                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto'}}>
                     {(isKitchen || isChefReady || isDraft) && (
                       <button className="cashier-btn-close-shift active" style={{flex: 1, padding: '8px', fontSize: '12px', minWidth: '120px'}} onClick={()=>markReady(o.id)} disabled={busy}>
                         ✓ Ready
                       </button>
                     )}
                     <button title="Print Preview" className="cashier-btn-close-shift" style={{padding: '8px 10px', borderColor: '#E6CCB2', color: '#E6CCB2', fontSize: '14px'}} onClick={() => {
                        const previewOrder = {
                          ...o,
                          total: o.total ?? o.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.price || 0), 0),
                          lines: o.lines.map(l => ({
                            ...l,
                            itemName: l.itemName || l.name,
                          })),
                        }
                        printReceipt({ 
                          shopName, 
                          order: previewOrder, 
                          paymentMethod: null,
                          momoName: context?.momoName,
                          momoNumber: context?.momoNumber
                        });
                     }}>
                        🖨️
                     </button>
                     <button className="cashier-btn-close-shift" style={{flex: 1, padding: '8px', borderColor: '#8B7355', color: '#E6CCB2', fontSize: '12px', minWidth: '100px'}} onClick={() => setSearchParams({ tab: 'new', edit: o.id })}>
                        ✏️ Edit
                     </button>
                     <button className="cashier-btn-close-shift" style={{padding: '8px 10px', color: '#EF4444', borderColor: '#EF4444', fontSize: '14px'}} onClick={() => cancelOrderRequest(o.id)} title="Delete Order">
                        🗑️
                     </button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}

        {/* READY TAB */}
        {tab === 'ready' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="cashier-billing-grid">
              {filteredReadyOrders.length === 0 && <p className="muted" style={{padding: 24}}>No orders waiting for payment.</p>}
              {filteredReadyOrders.map(o => (
                <div key={o.id} className="cashier-order-card" style={{borderColor: '#E6CCB2', display: 'flex', flexDirection: 'column'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px'}}>
                    <div className="table-badge" style={{background: '#3A3022', color: '#E6CCB2'}}>Table {o.tableNumber}</div>
                    <div style={{fontWeight: 700, fontSize: 15}}>{Number(o.total).toLocaleString()} RWF</div>
                  </div>
                  
                  {/* Time and Waiter — mobile responsive */}
                  <div style={{fontSize: 12, color:'#8C9993', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px'}}>
                    <div>⏰ {new Date(o.createdAt).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali'})}</div>
                    <div>👤 {o.waiterName}</div>
                  </div>
                  
                  <div style={{background: '#1C1C1C', color: '#E8E8E8', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: '8px'}}>
                     {o.lines.map((l, i) => (
                       <div key={i} style={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                         <strong style={{ color: l.needsKitchen ? '#FB923C' : '#4ADE80', minWidth: 24 }}>
                           {l.quantity}x
                         </strong>
                         <span style={{ flex: 1, minWidth: '100px' }}>{l.itemName}</span>
                         {l.needsKitchen && (
                           <span style={{ fontSize: 9, fontWeight: 800, color: '#FB923C', background: 'rgba(251,146,60,0.15)', padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                             🍳
                           </span>
                         )}
                       </div>
                     ))}
                  </div>

                  {/* Billing section — only visible after clicking Pay */}
                  {expandedBilling[o.id] && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: '700', color: '#E6CCB2' }}>Billing Option</span>
                        <button
                          onClick={() => setSplitModes(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                          style={{ background: splitModes[o.id] ? '#D90429' : '#1D3557', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                        >
                          {splitModes[o.id] ? '← Single Payment' : '⇌ Split Payment'}
                        </button>
                      </div>

                      {!splitModes[o.id] ? (
                        <>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {['CASH', 'MOBILE_MONEY', 'POS', 'LOAN'].map(m => (
                              <button
                                key={m}
                                className={`cashier-cat-pill ${paymentMethods[o.id] === m ? 'active' : ''}`}
                                onClick={() => setPaymentMethods(prev => ({ ...prev, [o.id]: m }))}
                                style={{ flex: 1, justifyContent: 'center' }}
                              >
                                {m === 'MOBILE_MONEY' ? 'MoMo' : m === 'CASH' ? 'Cash' : m}
                              </button>
                            ))}
                          </div>
                          {paymentMethods[o.id] === 'LOAN' && (
                            <input type="text" placeholder="Client Name" value={clientNames[o.id] || ''} onChange={e => { const val = e.target.value; setClientNames(prev => ({ ...prev, [o.id]: val })); }} style={{ padding: 8, border: '1px solid #3E3E3E', borderRadius: 8, background: '#1C1C1C', color: 'white' }} />
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#181818', padding: '10px 12px', borderRadius: 8, border: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Cash (RWF):</span>
                            <input type="number" inputMode="decimal" placeholder="0" value={splitAmounts[o.id]?.CASH || ''} onChange={e => handleSplitAmountChange(o.id, 'CASH', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>MoMo (RWF):</span>
                            <input type="number" inputMode="decimal" placeholder="0" value={splitAmounts[o.id]?.MOBILE_MONEY || ''} onChange={e => handleSplitAmountChange(o.id, 'MOBILE_MONEY', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Card/POS:</span>
                            <input type="number" inputMode="decimal" placeholder="0" value={splitAmounts[o.id]?.POS || ''} onChange={e => handleSplitAmountChange(o.id, 'POS', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Loan (RWF):</span>
                            <input type="number" inputMode="decimal" placeholder="0" value={splitAmounts[o.id]?.LOAN || ''} onChange={e => handleSplitAmountChange(o.id, 'LOAN', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }} />
                          </div>
                          {parseFloat(splitAmounts[o.id]?.LOAN || 0) > 0 && (
                            <input type="text" placeholder="Loan Client Name" value={clientNames[o.id] || ''} onChange={e => { const val = e.target.value; setClientNames(prev => ({ ...prev, [o.id]: val })); }} style={{ padding: '6px 8px', border: '1px solid #3E3E3E', borderRadius: 6, background: '#111', color: 'white', fontSize: 12, marginTop: 2 }} />
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold', borderTop: '1px solid #2A2828', paddingTop: 6, marginTop: 4 }}>
                            <span style={{ color: '#A0A0A0' }}>Sum Entered:</span>
                            <span style={{ color: Math.abs(getSplitTotal(o.id) - o.total) <= 0.05 ? '#4ADE80' : '#FF4D4D' }}>
                              {getSplitTotal(o.id).toLocaleString()} / {Number(o.total).toLocaleString()} RWF
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    {/* Print Preview — always visible */}
                    <button className="cashier-btn-close-shift" style={{ flex: 1, padding: 12, border: '1px solid #E6CCB2', color: '#E6CCB2' }} onClick={() => {
                      let printPayMethod = null;
                      if (splitModes[o.id]) {
                        const splits = splitAmounts[o.id] || {};
                        const pList = [];
                        if (parseFloat(splits.CASH || 0) > 0) pList.push({ method: 'CASH', amount: parseFloat(splits.CASH) });
                        if (parseFloat(splits.MOBILE_MONEY || 0) > 0) pList.push({ method: 'MOBILE_MONEY', amount: parseFloat(splits.MOBILE_MONEY) });
                        if (parseFloat(splits.POS || 0) > 0) pList.push({ method: 'POS', amount: parseFloat(splits.POS) });
                        if (parseFloat(splits.LOAN || 0) > 0) pList.push({ method: 'LOAN', amount: parseFloat(splits.LOAN), clientName: clientNames[o.id] || 'Client' });
                        printPayMethod = pList;
                      } else {
                        printPayMethod = paymentMethods[o.id] || null;
                      }
                      const previewOrder = {
                        ...o,
                        total: o.total ?? o.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.price || 0), 0),
                        lines: o.lines.map(l => ({ ...l, itemName: l.itemName || l.name })),
                      };
                      printReceipt({ shopName, order: previewOrder, paymentMethod: printPayMethod, momoName: context?.momoName, momoNumber: context?.momoNumber });
                    }}>
                      Print Preview
                    </button>

                    {/* Pay button: first click expands billing, second click (with method selected) processes payment */}
                    {!expandedBilling[o.id] ? (
                      <button
                        className="cashier-btn-submit active"
                        style={{ flex: 1, padding: 12 }}
                        onClick={() => setExpandedBilling({ [o.id]: true })}
                      >
                        Pay
                      </button>
                    ) : (
                      <button
                        className="cashier-btn-submit active"
                        style={{ flex: 1, padding: 12 }}
                        onClick={() => payOrder(o)}
                      >
                        Confirm Pay
                      </button>
                    )}
                  </div>

                  {role === 'SHOP_ADMIN' && (
                    <button
                      className="cashier-btn-close-shift"
                      style={{ width: '100%', marginTop: 8, padding: 8, fontSize: 12, border: '1px dashed #DC2626', color: '#DC2626', background: 'rgba(220,38,38,0.05)' }}
                      onClick={() => handleRevertToPending(o.id)}
                    >
                      ↩️ Revert to Pending (Owner Only)
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTION TAB */}
        {tab === 'production' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="cashier-main-area">
              {/* Production Entry Form & History - Full Component */}
              <ProductionRecordingScreen />
            </div>
          </div>
        )}

        {/* WAREHOUSE REQUESTS TAB */}
        {tab === 'warehouse' && (
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 16, border: '1px solid var(--pos-border)' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px', color: '#111827' }}>
                <HiOutlineCube style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Warehouse Requests
              </h2>

              {/* New Request Form */}
              <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#374151' }}>
                  Request Items from Warehouse
                </h3>
                <form onSubmit={handleCreateWarehouseRequest} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 150, position: 'relative' }} data-warehouse-product-field>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Product</label>
                    {/* Searchable product input */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={warehouseProductSearch}
                        onChange={(e) => {
                          setWarehouseProductSearch(e.target.value)
                          setWarehouseProductDropdownOpen(true)
                        }}
                        onFocus={() => setWarehouseProductDropdownOpen(true)}
                        style={{ 
                          width: '100%',
                          padding: '8px 12px', 
                          border: '1px solid #D1D5DB', 
                          borderRadius: 8, 
                          marginTop: 4, 
                          outline: 'none', 
                          background: '#FFFFFF',
                          fontSize: 14
                        }}
                      />
                      
                      {/* Dropdown menu */}
                      {warehouseProductDropdownOpen && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          background: '#FFFFFF',
                          border: '1px solid #D1D5DB',
                          borderRadius: 8,
                          maxHeight: 300,
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                          {warehouseInventory
                            .filter(item => 
                              item.name.toLowerCase().includes(warehouseProductSearch.toLowerCase())
                            )
                            .map(item => (
                              <button
                                key={item.productId}
                                type="button"
                                onClick={() => {
                                  setNewWarehouseRequest(prev => ({ ...prev, productId: item.productId }))
                                  setWarehouseProductSearch(item.name)
                                  setWarehouseProductDropdownOpen(false)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  textAlign: 'left',
                                  border: 'none',
                                  background: 'none',
                                  borderBottom: '1px solid #F3F4F6',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: '#111827',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                                    W: {item.warehouseQty} | F: {item.shopFloorQty}
                                  </div>
                                </div>
                              </button>
                            ))}
                          
                          {warehouseInventory.filter(item => 
                            item.name.toLowerCase().includes(warehouseProductSearch.toLowerCase())
                          ).length === 0 && (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                              No products found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 0.5, minWidth: 100 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Qty</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newWarehouseRequest.quantity}
                      onChange={(e) => setNewWarehouseRequest(prev => ({ ...prev, quantity: e.target.value }))}
                      min="0.1"
                      step="0.1"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, marginTop: 4, outline: 'none', background: '#FFFFFF' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={newWarehouseRequest.notes}
                      onChange={(e) => setNewWarehouseRequest(prev => ({ ...prev, notes: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, marginTop: 4, outline: 'none', background: '#FFFFFF' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !newWarehouseRequest.productId || !newWarehouseRequest.quantity}
                    style={{
                      padding: '8px 16px',
                      background: busy ? '#D1D5DB' : '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    {busy ? 'Sending...' : 'Request'}
                  </button>
                </form>
                {warehouseError && (
                  <div style={{ marginTop: 12, padding: 12, background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: 13 }}>
                    {warehouseError}
                  </div>
                )}

                {/* Mobile Search Modal */}
                {warehouseSearchOpen && (
                  <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    zIndex: 2000
                  }}>
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '20px 20px 0 0',
                      width: '100%',
                      maxHeight: '80vh',
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '100%'
                    }}>
                      <div style={{ padding: '16px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Search Items</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setWarehouseSearchOpen(false)
                            setWarehouseSearchInput('')
                          }}
                          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280' }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
                        <input
                          type="text"
                          placeholder="Search item name..."
                          autoFocus
                          value={warehouseSearchInput}
                          onChange={(e) => setWarehouseSearchInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #D1D5DB',
                            borderRadius: 8,
                            outline: 'none',
                            fontSize: 16,
                            fontWeight: 600
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                        {warehouseInventory
                          .filter(item => item.name.toLowerCase().includes(warehouseSearchInput.toLowerCase()))
                          .map(item => (
                            <button
                              key={item.productId}
                              type="button"
                              onClick={() => {
                                setNewWarehouseRequest(prev => ({ ...prev, productId: item.productId }))
                                setWarehouseSearchOpen(false)
                                setWarehouseSearchInput('')
                              }}
                              style={{
                                width: '100%',
                                padding: '16px',
                                textAlign: 'left',
                                border: 'none',
                                background: 'none',
                                borderBottom: '1px solid #F3F4F6',
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#111827',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>
                                Warehouse: {item.warehouseQty} | Floor: {item.shopFloorQty}
                              </div>
                            </button>
                          ))}
                        {warehouseInventory.filter(item => item.name.toLowerCase().includes(warehouseSearchInput.toLowerCase())).length === 0 && (
                          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                            No items found
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Requests List */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#374151' }}>
                  My Requests
                </h3>
                {warehouseLoading ? (
                  <p style={{ textAlign: 'center', color: '#6B7280', padding: 24 }}>Loading requests...</p>
                ) : warehouseRequests.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6B7280', padding: 24 }}>No warehouse requests yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {warehouseRequests.map(req => (
                      <div
                        key={req.transferId}
                        style={{
                          padding: 16,
                          border: '1px solid #E5E7EB',
                          borderRadius: 12,
                          background: req.status === 'PENDING' ? '#F0F9FF' : req.status === 'APPROVED' ? '#F0FDF4' : req.status === 'COMPLETED' ? '#FEF3C7' : req.status === 'REJECTED' ? '#FEF2F2' : '#F9FAFB'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>{req.productName}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                              Qty: {req.quantity} units
                            </p>
                          </div>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: req.status === 'PENDING' ? '#DBEAFE' : req.status === 'APPROVED' ? '#DCFCE7' : req.status === 'COMPLETED' ? '#FCD34D' : req.status === 'REJECTED' ? '#FECACA' : '#E5E7EB',
                            color: req.status === 'PENDING' ? '#0369A1' : req.status === 'APPROVED' ? '#15803D' : req.status === 'COMPLETED' ? '#92400E' : req.status === 'REJECTED' ? '#DC2626' : '#374151'
                          }}>
                            {req.status === 'COMPLETED' ? 'READY FOR PICKUP' : req.status}
                          </span>
                        </div>
                        {req.rejectionReason && (
                          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#DC2626', fontStyle: 'italic' }}>
                            Reason: {req.rejectionReason}
                          </p>
                        )}
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6B7280' }}>
                          Requested: {new Date(req.createdAt).toLocaleString()}
                        </p>
                        {req.notes && (
                          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                            Notes: {req.notes}
                          </p>
                        )}
                        {req.status === 'COMPLETED' && (
                          <button
                            onClick={async () => {
                              try {
                                await api(`/api/shop/warehouse/requests/${req.transferId}/receive`, { method: 'PUT' })
                                setWarehouseError('')
                                await loadWarehouseRequests()
                              } catch (e) {
                                setWarehouseError(e.message || 'Failed to confirm receipt')
                              }
                            }}
                            style={{
                              marginTop: 12,
                              padding: '8px 16px',
                              background: '#10B981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontSize: 13
                            }}
                          >
                            ✓ Confirm Receipt & Add to Stock
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 16, border: '1px solid var(--pos-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#111827' }}>Sales History</h2>
                  <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>Pick a date, then view sales from closed shifts on that day.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontWeight: 600, color: '#374151' }}>
                    <HiOutlineCalendar style={{ verticalAlign: 'text-bottom', fontSize: 18 }} /> Date:
                  </label>
                  <input
                    type="date"
                    value={historyDate}
                    max={getKigaliToday()}
                    onChange={e => setHistoryDate(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--pos-border)', borderRadius: 8, outline: 'none', background: '#F9FAFB', fontWeight: 600 }}
                  />
                  {closedShifts.length > 0 && (
                    <>
                      <label style={{ fontWeight: 600, color: '#374151' }}>
                        <HiOutlineClock style={{ verticalAlign: 'text-bottom', fontSize: 18 }} /> Shift:
                      </label>
                      <select
                        value={selectedShiftId}
                        onChange={e => setSelectedShiftId(e.target.value)}
                        style={{ padding: '8px 12px', border: '1px solid var(--pos-border)', borderRadius: 8, outline: 'none', background: '#F9FAFB', fontWeight: 600, minWidth: 240, maxWidth: 380 }}
                      >
                        {closedShifts.map(s => (
                          <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {shift && isHistoryToday && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 13, color: '#1D3557' }}>
                  Current shift is still open. Its sales will appear here after you close the shift.
                </div>
              )}

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading history...</div>
              ) : closedShifts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', background: '#F9FAFB', borderRadius: 12 }}>
                  No closed shifts found for {new Date(historyDate + 'T12:00:00').toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' })}.
                  {isHistoryToday && shift ? ' The current shift is still open.' : ''}
                </div>
              ) : (
                <>
                  {historyData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', background: '#F9FAFB', borderRadius: 12 }}>
                      No sales recorded for this closed shift.
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--pos-bg)', borderRadius: '12px 12px 0 0', fontWeight: 700, color: '#374151', border: '1px solid var(--pos-border)', borderBottom: 'none' }}>
                        <div style={{ flex: 2 }}>Product</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>Quantity Sold</div>
                        <div style={{ flex: 1, textAlign: 'right' }}>Total Amount (RWF)</div>
                      </div>
                      <div style={{ border: '1px solid var(--pos-border)', borderRadius: '0 0 12px 12px', background: '#FFFFFF' }}>
                        {historyData.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: i < historyData.length - 1 ? '1px solid var(--pos-border)' : 'none', color: '#111827', fontSize: 15 }}>
                            <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 20 }}>{getItemIcon(item.name, item.category)}</span>
                              <span style={{ fontWeight: 600 }}>{item.name}</span>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{item.qty}</div>
                            <div style={{ flex: 1, textAlign: 'right', color: '#10B981', fontWeight: 800 }}>{item.amount.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, padding: 16, background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0', color: '#065F46' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, marginRight: 16 }}>Total Products Value:</span>
                        <span style={{ fontSize: 20, fontWeight: 800 }}>{historyTotal.toLocaleString()} RWF</span>
                      </div>

                      {historyData._totalPaymentsReceived && historyData._totalPaymentsReceived !== historyTotal && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFF8E1', borderRadius: 8, border: '1px solid #FFD54F', fontSize: 13, color: '#F57F17' }}>
                          <strong>Note:</strong> Total cash payments received in the drawer was <strong>{Number(historyData._totalPaymentsReceived).toLocaleString()} RWF</strong>. The {Math.abs(historyData._totalPaymentsReceived - historyTotal).toLocaleString()} RWF difference is usually due to free bundled accompaniments, multi-day loans, or manual discounts.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* LOANS TAB */}
        {tab === 'loans' && (
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 16, border: '1px solid var(--pos-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#111827' }}>Pending Loans</h2>
                  <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>Track and receive payments for outstanding customer loans.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                   <button 
                     className={`cashier-cat-pill ${!loans.some(l => l.status === 'PAID') ? 'active' : ''}`}
                     onClick={() => loadLoans('UNPAID')}
                   >Unpaid Only</button>
                   <button 
                     className="cashier-cat-pill"
                     onClick={() => loadLoans('')}
                   >All Loans</button>
                </div>
              </div>

              {loadingLoans ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading loans...</div>
              ) : (
                <div className="cashier-billing-grid">
                  {loans.length === 0 && <p className="muted" style={{padding: 24}}>No loans found.</p>}
                  {loans.map(l => {
                    const totalPaid = (l.loan_payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                    const remaining = parseFloat(l.amount) - totalPaid;
                    return (
                      <div key={l.id} className="cashier-order-card" style={{borderColor: remaining > 0 ? '#FFD54F' : '#BBF7D0'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start'}}>
                           <div className="table-badge" style={{background: remaining > 0 ? '#FFF8E1' : '#F0FDF4', color: remaining > 0 ? '#F57F17' : '#065F46'}}>
                              {l.status}
                           </div>
                           <div style={{fontSize: 12, color:'#8C9993'}}>{new Date(l.created_at).toLocaleDateString()}</div>
                        </div>
                        
                        <div style={{marginTop: 12}}>
                           <div style={{fontSize: 16, fontWeight: 800, color: '#111827'}}>{l.client_name}</div>
                           <div style={{fontSize: 13, color: '#6B7280'}}>Total Amount: {Number(l.amount).toLocaleString()} RWF</div>
                        </div>

                        <div style={{background: '#F9FAFB', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #E5E7EB'}}>
                           <div style={{display:'flex', justifyContent:'space-between', fontSize: 13, marginBottom: 4}}>
                              <span>Already Paid:</span>
                              <span style={{fontWeight: 700, color: '#10B981'}}>{totalPaid.toLocaleString()} RWF</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid #E5E7EB', paddingTop: 4}}>
                              <span>Balance:</span>
                              <span style={{color: remaining > 0 ? '#EF4444' : '#10B981'}}>{remaining.toLocaleString()} RWF</span>
                           </div>
                        </div>

                        {remaining > 0 && (
                           <button className="cashier-btn-submit active" style={{marginTop: 16, width: '100%'}} onClick={() => {
                              setShowRepaymentModal(l);
                              setRepaymentForm({ amount: String(remaining), method: 'CASH' });
                           }}>
                              Receive Payment
                           </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* SHIFT MODAL */}
      {showShiftModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal">
             <h3 style={{marginBottom: 16}}>{showShiftModal === 'OPEN' ? '☕ Open Shift' : '🔒 Close Shift'}</h3>
             {showShiftModal === 'CLOSE' && (
               <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                 All sales from when this shift was opened until now are included in this shift report.
               </p>
             )}
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
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>MoMo Withdrawn (Given to Owner)</label>
                    <input type="number" className="cashier-search" title="Amount deducted from MoMo and given to Owner" style={{width: '100%', marginTop: 4}} value={shiftForm.cashout} onChange={e=>setShiftForm(f=>({...f, cashout:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize: 12, fontWeight: 700, color:'#8C9993'}}>Expenses (Deducted from Cash)</label>
                    <input type="number" className="cashier-search" style={{width: '100%', marginTop: 4}} value={shiftForm.expenses} onChange={e=>setShiftForm(f=>({...f, expenses:e.target.value}))}/>
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

      {/* REPAYMENT MODAL */}
      {showRepaymentModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal" style={{ maxWidth: 400 }}>
             <h3 style={{ marginBottom: 4 }}>💸 Receive Repayment</h3>
             <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>Receiving payment from <strong>{showRepaymentModal.client_name}</strong></p>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                   <label style={{ fontSize: 12, fontWeight: 700, color: '#8C9993' }}>Amount to Pay (RWF)</label>
                   <input 
                      type="number" 
                      className="cashier-search" 
                      style={{ width: '100%', marginTop: 4, fontSize: 18, fontWeight: 700 }} 
                      value={repaymentForm.amount} 
                      onChange={e => setRepaymentForm(f => ({ ...f, amount: e.target.value }))}
                   />
                </div>

                <div>
                   <label style={{ fontSize: 12, fontWeight: 700, color: '#8C9993' }}>Payment Method</label>
                   <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {['CASH', 'MOBILE_MONEY', 'POS'].map(m => (
                         <button 
                            key={m}
                            className={`cashier-cat-pill ${repaymentForm.method === m ? 'active' : ''}`}
                            onClick={() => setRepaymentForm(f => ({ ...f, method: m }))}
                            style={{ flex: 1, justifyContent: 'center' }}
                         >
                            {m === 'MOBILE_MONEY' ? 'MoMo' : m.charAt(0) + m.slice(1).toLowerCase()}
                         </button>
                      ))}
                   </div>
                </div>
             </div>

             <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button 
                  className="cashier-btn-submit active" 
                  style={{ flex: 1, padding: 14, fontSize: 15 }} 
                  onClick={handleRepayment} 
                  disabled={busy}
                >
                  Confirm Repayment
                </button>
                <button 
                  className="cashier-btn-close-shift" 
                  style={{ padding: 14 }} 
                  onClick={() => setShowRepaymentModal(null)}
                >
                  Cancel
                </button>
             </div>
          </div>
        </div>
      )}

      {/* ITEM REMOVAL PIN VERIFICATION MODAL */}
      {showRemovalPinModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 8 }}>🔒 {pendingClearAllItems ? 'Confirm Clear All Items' : 'Confirm Item Removal'}</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              {pendingClearAllItems 
                ? 'Enter the cashier/manager PIN to remove all items from this order'
                : 'Enter the cashier/manager PIN (same as Awaiting Payment tab) to remove this item from the order'
              }
            </p>
            <form onSubmit={confirmRemovalPin}>
              {pinError && <div style={{ marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{pinError}</div>}
              <input
                type="password"
                className="cashier-search"
                style={{ fontSize: 24, padding: '12px 16px', textAlign: 'center', letterSpacing: 12, marginBottom: 24, fontWeight: 'bold', width: '100%' }}
                autoFocus
                placeholder="****"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError('') }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button type="button" className="cashier-btn-close-shift" onClick={() => { 
                  setShowRemovalPinModal(false); 
                  setPendingItemRemovalId(null)
                  setPendingClearAllItems(false)
                  setPinInput(''); 
                  setPinError(''); 
                }}>Cancel</button>
                <button type="submit" className="cashier-btn-submit active">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAITER PIN VERIFICATION MODAL */}
      {showPinModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Enter the security PIN for {serviceStaff.find(s => s.id === pendingWaiterId)?.name}
            </p>
            <form onSubmit={confirmWaiterPin}>
              {pinError && <div style={{ marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{pinError}</div>}
              <input
                type="password"
                className="cashier-search"
                style={{ fontSize: 24, padding: '12px 16px', textAlign: 'center', letterSpacing: 12, marginBottom: 24, fontWeight: 'bold', width: '100%' }}
                autoFocus
                placeholder="****"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError('') }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button type="button" className="cashier-btn-close-shift" onClick={() => { setShowPinModal(false); setPendingWaiterId(null); setPinInput(''); setPinError(''); }}>Cancel</button>
                <button type="submit" className="cashier-btn-submit active">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ready Tab PIN Gate */}
      {showReadyPinModal && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 8 }}>🔒 Cashier Access Required</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              {role === 'WAITER'
                ? 'Waiters are not allowed to access the Awaiting Payment tab. Ask your cashier or manager.'
                : 'Enter a cashier or manager PIN to access the payment tab.'}
            </p>
            {role === 'WAITER' ? (
              <button
                className="cashier-btn-close-shift"
                style={{ width: '100%' }}
                onClick={() => setShowReadyPinModal(false)}
              >
                Close
              </button>
            ) : (
              <form onSubmit={e => {
                e.preventDefault()
                const approver = staff.find(s =>
                  (s.role === 'CASHIER' || s.role === 'MANAGER' || s.role === 'SHOP_ADMIN') &&
                  s.security_key === readyPinInput.trim()
                )
                
                // Debug logs
                console.log('Ready Tab - Shift opened_by:', shift?.opened_by, 'Approver ID:', approver?.id, 'Match:', shift?.opened_by === approver?.id)
                
                // IMPORTANT: Only allow PIN from the cashier who opened the current shift
                if (approver && shift && shift.opened_by && shift.opened_by !== approver.id) {
                  setReadyPinError('This PIN belongs to a different cashier. Only the shift opener can access Ready tab.')
                  setReadyPinInput('')
                  return
                }
                
                if (approver) {
                  setReadyTabUnlocked(true)
                  setShowReadyPinModal(false)
                  setReadyPinInput('')
                  setReadyPinError('')
                  setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'ready'); return n })
                } else {
                  setReadyPinError('Invalid PIN. Try again.')
                  setReadyPinInput('')
                }
              }}>
                {readyPinError && (
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{readyPinError}</div>
                )}
                <input
                  type="password"
                  className="cashier-search"
                  style={{ fontSize: 24, padding: '12px 16px', textAlign: 'center', letterSpacing: 12, marginBottom: 24, fontWeight: 'bold', width: '100%' }}
                  autoFocus
                  placeholder="****"
                  value={readyPinInput}
                  onChange={e => { setReadyPinInput(e.target.value); setReadyPinError('') }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button type="button" className="cashier-btn-close-shift" onClick={() => { setShowReadyPinModal(false); setReadyPinInput(''); setReadyPinError('') }}>Cancel</button>
                  <button type="submit" className="cashier-btn-submit active">Enter</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* KITCHEN ORDER TICKET MODAL — Long Press on Order Card */}
      {selectedOrderForTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => {
          setSelectedOrderForTicket(null)
          setSelectedItemsForPrint({})
        }}>
          <div style={{ background: '#1C1C1C', borderRadius: 12, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, border: '2px solid #E6CCB2' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: '#E6CCB2', fontSize: 22 }}>🍳 Kitchen Order Ticket</h2>
              <button onClick={() => {
                setSelectedOrderForTicket(null)
                setSelectedItemsForPrint({})
              }} style={{ background: 'none', border: 'none', color: '#E6CCB2', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {/* Order Header */}
            <div style={{ background: '#111', padding: 16, borderRadius: 8, marginBottom: 20, borderLeft: '4px solid #E6CCB2' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Table</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#E6CCB2' }}>Table {selectedOrderForTicket.tableNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Waiter</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E8E8E8' }}>{selectedOrderForTicket.waiterName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Time</div>
                  <div style={{ fontSize: 14, color: '#E8E8E8' }}>{new Date(selectedOrderForTicket.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Items</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4ADE80' }}>{selectedOrderForTicket.lines.length} items</div>
                </div>
              </div>
            </div>

            {/* Order Items with Selection Checkboxes */}
            <div style={{ background: '#111', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Items to Prepare</div>
                <button 
                  onClick={() => {
                    // Select/Deselect all
                    const allSelected = selectedOrderForTicket.lines.every((_, i) => selectedItemsForPrint[i])
                    const newSelection = {}
                    if (!allSelected) {
                      selectedOrderForTicket.lines.forEach((_, i) => { newSelection[i] = true })
                    }
                    setSelectedItemsForPrint(newSelection)
                  }}
                  style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: '#E6CCB2', 
                    background: 'transparent', 
                    border: '1px solid #E6CCB2', 
                    borderRadius: 4, 
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  {selectedOrderForTicket.lines.every((_, i) => selectedItemsForPrint[i]) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {selectedOrderForTicket.lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #2A2A2A', background: selectedItemsForPrint[idx] ? 'rgba(230, 204, 178, 0.15)' : 'transparent', paddingLeft: 12, paddingRight: 12, marginLeft: -12, marginRight: -12, borderRadius: 6, transition: 'all 0.2s ease' }}>
                  <input 
                    type="checkbox"
                    checked={selectedItemsForPrint[idx] || false}
                    onChange={(e) => {
                      setSelectedItemsForPrint(prev => ({
                        ...prev,
                        [idx]: e.target.checked
                      }))
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                      accent: '#E6CCB2'
                    }}
                  />
                  <div style={{ fontWeight: 800, fontSize: 18, color: selectedItemsForPrint[idx] ? '#E6CCB2' : '#888', minWidth: 40, transition: 'color 0.2s ease' }}>{line.quantity}×</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: selectedItemsForPrint[idx] ? '#E6CCB2' : '#E8E8E8', fontSize: 14, transition: 'color 0.2s ease' }}>{line.itemName}</div>
                    {line.needsKitchen && <div style={{ fontSize: 10, color: selectedItemsForPrint[idx] ? '#FFB84D' : '#FB923C', marginTop: 4, transition: 'color 0.2s ease' }}>🍳 Kitchen preparation required</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Selection Counter */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E6CCB2', marginBottom: 16, padding: '8px 12px', background: '#111', borderRadius: 6 }}>
              ✓ Selected: {Object.values(selectedItemsForPrint).filter(Boolean).length} / {selectedOrderForTicket.lines.length} items
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button 
                onClick={() => {
                  // Get selected lines only
                  const selectedLines = selectedOrderForTicket.lines.filter((_, idx) => selectedItemsForPrint[idx])
                  
                  if (selectedLines.length === 0) {
                    alert('⚠️ Please select at least one item to print')
                    return
                  }

                  printKitchenTicket({ 
                    order: {
                      ...selectedOrderForTicket,
                      lines: selectedLines
                    },
                    shopName,
                    totalItems: selectedLines.reduce((s, l) => s + l.quantity, 0),
                    isPartialOrder: selectedLines.length < selectedOrderForTicket.lines.length
                  });
                  setSelectedOrderForTicket(null)
                  setSelectedItemsForPrint({})
                }}
                disabled={Object.values(selectedItemsForPrint).filter(Boolean).length === 0}
                style={{ 
                  padding: '14px 20px', 
                  background: Object.values(selectedItemsForPrint).filter(Boolean).length === 0 ? '#999' : '#E6CCB2',
                  color: '#1C1C1C',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: Object.values(selectedItemsForPrint).filter(Boolean).length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <HiOutlinePrinter /> Print Selected Items
              </button>
              <button 
                onClick={() => {
                  setSelectedOrderForTicket(null)
                  setSelectedItemsForPrint({})
                }}
                style={{ 
                  padding: '12px 20px', 
                  background: '#333', 
                  color: '#E6CCB2',
                  border: '1px solid #555',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {/* Instructions */}
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(230,204,178,0.1)', borderRadius: 8, borderLeft: '3px solid #E6CCB2' }}>
              <div style={{ fontSize: 11, color: '#E6CCB2', fontWeight: 700, marginBottom: 6 }}>📋 Instructions</div>
              <div style={{ fontSize: 12, color: '#B0B0B0', lineHeight: 1.6 }}>
                1. ☑️ Select which items to send to kitchen<br/>
                2. Click "Print Selected Items" to generate ticket<br/>
                3. Take the printed slip to the chef/kitchen<br/>
                4. Chef will prepare items and mark when ready
              </div>
            </div>
          </div>
        </div>
      )}

      {showCashierAuthPayload && null}

    </div>
  )
}

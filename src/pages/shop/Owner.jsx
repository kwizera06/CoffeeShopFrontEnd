import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineBars3, HiOutlineXMark } from 'react-icons/hi2'
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getSession } from '../../api'
import { useShopContext } from '../../shop/ShopContext'
import { supabase } from '../../supabaseClient'
import { getKigaliToday, formatShiftRange } from '../../utils/kigaliDate.js'
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
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  HiOutlineFire,
  HiOutlineMagnifyingGlass
} from 'react-icons/hi2'
import { IoCafeOutline } from 'react-icons/io5'
import { MdOutlineLocalFireDepartment, MdOutlineReceiptLong } from 'react-icons/md'

import socket, { connectSocket, disconnectSocket } from '../../socket'
import './OwnerModern.css'
import { canAccessDashboard, canAccessTab, getDashboardLabel, isManagerRole, isOwnerRole, staffRoleLabel, staffRoleStyle } from '../../utils/roles.js'

export default function Owner() {
  const nav = useNavigate()
  const { role } = getSession()
  const { isShopAdmin, context } = useShopContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'overview'
  const setTab = (t) => setSearchParams({ tab: t })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [eodProductPage, setEodProductPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [dateRange, setDateRange] = useState('daily')

  const [overview, setOverview] = useState(null)
  const [menu, setMenu] = useState([])
  const [staff, setStaff] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [requestedOrders, setRequestedOrders] = useState([])
  const [loans, setLoans] = useState([])

  const [menuForm, setMenuForm] = useState({ 
    id: '', 
    name: '', 
    price: '', 
    category: 'Hot Coffee', 
    category_group: '',
    available: true, 
    productRecipe: [],
    variantOutputs: [], // [{ name: '', price: 0, standard_yield: 0 }]
    isRecipe: false,
    stockLevel: '',
    buyingPrice: ''
  })
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [tempRecipeLine, setTempRecipeLine] = useState({ ingredient_id: '', quantity_required: '' })
  
  const SUB_CATEGORIES = [
    'Hot Coffee', 'Iced Coffee', 'Tea & Hot Drinks', 'Soft Drinks', 
    'Beer & Alcohol', 'Juice & Smoothies', 'Fast Food', 
    'Main Food / Meals','Wines' ,'Bakery & Desserts', 'Snacks','Accompaniments','breakFast','whisky'
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
    role: 'WAITER',
    security_key: '',
  })
  const [ingForm, setIngForm] = useState({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0, buying_price: 0, category: 'General' })
  const [productionForm, setProductionForm] = useState({ 
    menu_item_id: '', 
    recipe_id: '',
    batch_size: 1, 
    ingredientsUsed: [], 
    outputs: [],
    notes: '',
    actual_yield: 0,
    wastage_notes: ''
  })
  const [productionLoading, setProductionLoading] = useState(false)
  const [bakerySubTab, setBakerySubTab] = useState('PRODUCTION') // PRODUCTION | PRODUCTS | HISTORY
  const [bakerySummary, setBakerySummary] = useState(null)
  const [bakeryHistory, setBakeryHistory] = useState([])
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL')
  
  const [actionMenu, setActionMenu] = useState(null)
  const [productActionMenu, setProductActionMenu] = useState(null)
  const [stockHistory, setStockHistory] = useState(null)
  const [ingredientStockHistory, setIngredientStockHistory] = useState(null)
  const [linkedProducts, setLinkedProducts] = useState(null)
  const [managerAdditions, setManagerAdditions] = useState([])
  const [managerAdditionsLoading, setManagerAdditionsLoading] = useState(false)
  const longPressTimer = useRef(null)

  const handlePointerDown = (ing) => {
    longPressTimer.current = setTimeout(() => {
      setActionMenu(ing)
    }, 500)
  }
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const productLongPressTimer = useRef(null)

  const handleProductPointerDown = (m) => {
    if (productLongPressTimer.current) clearTimeout(productLongPressTimer.current)
    productLongPressTimer.current = setTimeout(() => {
      setProductActionMenu(m)
    }, 500)
  }
  const handleProductPointerUp = () => {
    if (productLongPressTimer.current) clearTimeout(productLongPressTimer.current)
  }

  async function openIngredientHistory(ing) {
    setActionMenu(null)
    setError('')
    try {
      const data = await api(`/api/shop/owner/stock-history?itemId=${ing.id}&itemType=INGREDIENT&fromBeginning=true`)
      setIngredientStockHistory({ ...data, productName: ing.name, unit: ing.unit })
    } catch (err) {
      setError(err.message || 'Failed to load stock history')
    }
  }

  async function openStockItemHistory(item) {
    setError('')
    try {
      const data = await api(`/api/shop/owner/stock-history?itemId=${item.id}&itemType=${item.itemType}&fromBeginning=true`)
      setStockHistory({ ...data, productName: item.name, unit: item.unit, itemType: item.itemType })
    } catch (err) {
      setError(err.message || 'Failed to load stock history')
    }
  }

  function openLinkedProducts(ing) {
    setActionMenu(null)
    // Find all menu items that use this ingredient
    const linked = menu.filter(m => {
      const recipe = m.recipe || m.ingredients || m.recipe_items || []
      return recipe.some(r => r.ingredient_id === ing.id || r.id === ing.id)
    })
    setLinkedProducts({ ingredient: ing, products: linked })
  }

  async function openProductHistory(m) {
    setProductActionMenu(null)
    setError('')
    try {
      const isSimple = ['Beer & Alcohol', 'Soft Drinks', 'Wines', 'Soda & Water'].includes(m.category)
      let itemId = m.id
      let itemType = 'MENU_ITEM'
      if (!isSimple) {
        // For recipe-based items, try to find the first ingredient
        const recipe = await api(`/api/shop/owner/recipes/${m.id}`)
        if (recipe && recipe.length > 0 && recipe[0].ingredient_id) {
          itemId = recipe[0].ingredient_id
          itemType = 'INGREDIENT'
        }
      }
      const data = await api(`/api/shop/owner/stock-history?itemId=${itemId}&itemType=${itemType}&fromBeginning=true`)
      setStockHistory({ ...data, productName: m.name, itemType })
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Remove this product?')) return
    setError('')
    try {
      await api(`/api/shop/menu/${id}`, { method: 'DELETE' })
      await reloadCore()
      setProductActionMenu(null)
    } catch (err) {
      setError(err.message)
    }
  }
  
  async function deleteIngredient(id) {
    if (!window.confirm('Are you sure you want to delete this ingredient?')) return;
    setError('')
    try {
      await api(`/api/shop/owner/inventory/${id}`, { method: 'DELETE' })
      setActionMenu(null)
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteProduction(id) {
    if (!window.confirm('Revert this production run? This will restore ingredients and remove produced items from stock.')) return;
    setError('')
    try {
      await api(`/api/shop/owner/production/${id}`, { method: 'DELETE' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }
  
  const [selectedRecipeItem, setSelectedRecipeItem] = useState(null)
  const [recipeLines, setRecipeLines] = useState([])
  const [recipeForm, setRecipeForm] = useState({ ingredient_id: '', quantity_required: 0 })

  const [reportDay, setReportDay] = useState(() => getKigaliToday())

  // Defer chart mount until after first layout pass so Recharts'
  // ResponsiveContainer can measure its parent correctly on first paint.
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
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
  const [topStaff, setTopStaff] = useState([])

  const [menuSearch, setMenuSearch] = useState('')
  const [menuPage, setMenuPage] = useState(1)
  
  const [inventorySearch, setInventorySearch] = useState('')
  const [criticalPage, setCriticalPage] = useState(1);
  const [healthyPage, setHealthyPage] = useState(1);
  
  const [loanSearch, setLoanSearch] = useState('')
  const [loanFilter, setLoanFilter] = useState('ALL')
  const [loanForm, setLoanForm] = useState({ client_name: '', amount: '', amount_paid: 0, notes: '', status: 'UNPAID' })

  const [reqSearch, setReqSearch] = useState('')
  const [reqFilter, setReqFilter] = useState('ALL')
  
  const [staffSearch, setStaffSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('ALL')
  const [staffAddType, setStaffAddType] = useState('WAITER')
  const [showAllOrdersModal, setShowAllOrdersModal] = useState(false)
  const [stockFilter, setStockFilter] = useState('ALL')
  const [stockSearch, setStockSearch] = useState('')

  const MENU_LOW_THRESHOLD = 10

  function getItemStockStatus(item) {
    if (item.itemType === 'INGREDIENT') {
      if (item.stock <= 0) return 'CRITICAL'
      if (item.stock < item.minThreshold) return 'LOW'
      return 'HEALTHY'
    }
    if (item.stock <= 0) return 'CRITICAL'
    if (item.stock <= MENU_LOW_THRESHOLD) return 'LOW'
    return 'HEALTHY'
  }

  const stockItems = useMemo(() => {
    const products = menu
      .filter(m => !m.is_recipe)
      .map(m => ({
        id: m.id,
        name: m.name,
        itemType: 'MENU_ITEM',
        category: m.category || 'Product',
        unit: 'pcs',
        stock: Number(m.stock_level ?? m.stockLevel ?? 0),
        minThreshold: MENU_LOW_THRESHOLD,
      }))
    const ings = ingredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      itemType: 'INGREDIENT',
      category: 'Ingredient',
      unit: ing.unit,
      stock: Number(ing.stock_level ?? 0),
      minThreshold: Number(ing.min_threshold ?? 0),
    }))
    return [...products, ...ings].sort((a, b) => {
      const order = { CRITICAL: 0, LOW: 1, HEALTHY: 2 }
      const sa = getItemStockStatus(a)
      const sb = getItemStockStatus(b)
      if (order[sa] !== order[sb]) return order[sa] - order[sb]
      return a.name.localeCompare(b.name)
    })
  }, [menu, ingredients])

  const filteredStockItems = useMemo(() => {
    return stockItems.filter(item => {
      const status = getItemStockStatus(item)
      if (stockFilter === 'LOW' && status !== 'LOW') return false
      if (stockFilter === 'CRITICAL' && status !== 'CRITICAL') return false
      if (stockFilter === 'HEALTHY' && status !== 'HEALTHY') return false
      if (stockSearch && !item.name.toLowerCase().includes(stockSearch.toLowerCase())) return false
      return true
    })
  }, [stockItems, stockFilter, stockSearch])

  // Drill-down modal state: { type: 'revenue'|'cash'|'momo'|'pos'|'profit'|'completed'|'prep'|'waiting'|'lowstock', data?: any }
  const [drilldown, setDrilldown] = useState(null)
  
  const ownerAccess = isShopAdmin || role === 'SHOP_ADMIN' || context?.isOwner
  const allowed = ownerAccess || canAccessDashboard(role)
  const canEdit = ownerAccess

  useEffect(() => {
    if (role && !allowed) {
      nav('/app/cashier', { replace: true })
    }
  }, [role, allowed, nav])

  useEffect(() => {
    if (role && allowed && !canAccessTab(role, tab)) {
      setSearchParams({ tab: 'overview' })
    }
  }, [role, tab, allowed, setSearchParams])

  const reloadManagerAdditions = useCallback(async () => {
    if (role !== 'SHOP_ADMIN') return
    setManagerAdditionsLoading(true)
    try {
      const data = await api('/api/shop/owner/reports/manager-additions')
      setManagerAdditions(data || [])
    } catch (err) {
      console.error('Failed to load manager additions:', err)
    } finally {
      setManagerAdditionsLoading(false)
    }
  }, [role])

  const reloadCore = useCallback(async () => {
    const [o, m, s, i, l, b, bh] = await Promise.all([
      api(`/api/shop/owner/overview?date=${reportDay}`),
      api('/api/shop/menu'),
      api('/api/shop/staff'),
      api('/api/shop/owner/inventory'),
      api('/api/shop/loans'),
      api(`/api/shop/owner/reports/bakery?date=${reportDay}`),
      api('/api/shop/owner/production'),
    ])
    setOverview(o)
    setMenu(m)
    setStaff(s)
    setIngredients(i)
    setLoans(l || [])
    setBakerySummary(b)
    setBakeryHistory(bh || [])

    if (role === 'SHOP_ADMIN') {
      void reloadManagerAdditions().catch(() => {})
    }
  }, [reportDay, role, reloadManagerAdditions])

  useEffect(() => {
    if (tab === 'audit' && role === 'SHOP_ADMIN') {
      void reloadManagerAdditions().catch(() => {})
    }
  }, [tab, role, reloadManagerAdditions])

  const reloadOverview = useCallback(async () => {
    try {
      const o = await api(`/api/shop/owner/overview?date=${reportDay}`)
      setOverview(o)
    } catch {}
  }, [reportDay])

  useEffect(() => {
    if (!allowed) {
      return
    }
    
    void reloadCore().catch((e) => setError(e.message))

    if (!supabase) return

    const tenantId = getSession().tenantId

    // ── Channel 1: Orders table (In Prep / Waiting counts) ──────────────
    const ordersChannel = supabase
      .channel(`owner-orders-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => {
          // Just refresh the overview (kitchen counts) — fast & lightweight
          void reloadOverview().catch(() => {})
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('✅ [Realtime] Orders channel live')
        else console.log('⚠️ [Realtime] Orders channel status:', status)
      })

    // ── Channel 2: Payments table (revenue/completed counts) ────────────
    const paymentsChannel = supabase
      .channel(`owner-payments-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${tenantId}` },
        () => {
          void reloadOverview().catch(() => {})
        }
      )
      .subscribe()

    // ── Channel 3: Menu/inventory/staff (full reload only when needed) ──
    const coreChannel = supabase
      .channel(`owner-core-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `tenant_id=eq.${tenantId}` },
        () => void reloadCore().catch(() => {})
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ingredients', filter: `tenant_id=eq.${tenantId}` },
        () => void reloadCore().catch(() => {})
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productions', filter: `tenant_id=eq.${tenantId}` },
        () => void reloadCore().catch(() => {})
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'production_outputs', filter: `tenant_id=eq.${tenantId}` },
        () => void reloadCore().catch(() => {})
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(paymentsChannel)
      void supabase.removeChannel(coreChannel)
    }
  }, [allowed, reloadCore, reloadOverview])

  const reloadEOD = useCallback(async () => {
    if (!allowed || (tab !== 'reports' && tab !== 'overview' && tab !== 'eod')) {
      return
    }
    try {
      const [d, moon, c, s] = await Promise.all([
        api(`/api/shop/owner/reports/daily?date=${reportDay}`),
        api(`/api/shop/owner/reports/monthly?year=${month.year}&month=${month.month}`),
        api(`/api/shop/owner/reports/charts?date=${reportDay}`),
        api(`/api/shop/shifts?date=${reportDay}`),
      ])
      
      setDailyRows(d)
      setMonthlyRows(moon)
      setCharts(c)
      setShifts(s)
      
      // Calculate Category & Method Sales from Daily
      const catMap = {}
      const metMap = { Cash: 0, MoMo: 0, POS: 0, Total: 0 }
      const staffMap = {}
      const staffOrderSeen = {}
      const serviceNames = new Set(
        (staff || [])
          .filter(s => s.role === 'WAITER' || s.role === 'CASHIER' || s.role === 'MANAGER')
          .map(s => s.name),
      )
      
      d.forEach(row => {
        metMap[row.methodLabel] = (metMap[row.methodLabel] || 0) + Number(row.amount)
        metMap.Total += Number(row.amount)

        if (row.rawItems) {
          row.rawItems.forEach(item => {
            const cat = item.category || 'Uncategorized'
            catMap[cat] = (catMap[cat] || 0) + (Number(item.price) * (item.qty || 1))
          })
        }

        const sName = row.waiterName || 'Unknown'
        if (serviceNames.size > 0 && !serviceNames.has(sName)) return

        if (!staffMap[sName]) {
          staffMap[sName] = { name: sName, amount: 0, count: 0, products: {} }
        }
        staffMap[sName].amount += Number(row.amount)

        if (!staffOrderSeen[sName]) staffOrderSeen[sName] = new Set()
        if (row.orderId && !staffOrderSeen[sName].has(row.orderId)) {
          staffOrderSeen[sName].add(row.orderId)
          staffMap[sName].count += 1
          if (row.rawItems) {
            row.rawItems.forEach(item => {
              const key = item.name || 'Unknown'
              const qty = Number(item.qty || 1)
              const lineAmount = qty * Number(item.price || 0)
              if (!staffMap[sName].products[key]) {
                staffMap[sName].products[key] = { name: key, qty: 0, amount: 0 }
              }
              staffMap[sName].products[key].qty += qty
              staffMap[sName].products[key].amount += lineAmount
            })
          }
        }
      })

      const staffPerformance = Object.values(staffMap)
        .map(s => ({
          ...s,
          products: Object.values(s.products).sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.amount - a.amount)

      setCategorySales(catMap)
      setMethodSales(metMap)
      setTopStaff(staffPerformance)
    } catch(e) {
      setError(e.message)
    }
  }, [allowed, tab, reportDay, month.year, month.month, staff])

  useEffect(() => {
    if (!allowed) return

    const tenantId = getSession().tenantId
    connectSocket(tenantId)

    const handleEodUpdate = (payload) => {
      console.log('📡 [WebSocket] EOD Update received:', payload)
      // Refresh both core overview and EOD report data
      void reloadCore().catch(() => {})
      void reloadEOD().catch(() => {})
    }

    socket.on('eodUpdate', handleEodUpdate)

    return () => {
      socket.off('eodUpdate', handleEodUpdate)
      disconnectSocket()
    }
  }, [allowed, reloadCore, reloadEOD])

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
    void reloadEOD()
  }, [reloadEOD])

  // ──────────────────── Drill-Down Openers ────────────────────
  const openDrilldown = async (type) => {
    try {
      if (type === 'revenue') {
        // All products sold today aggregated by item
        const items = aggregateItems(dailyRows)
        setDrilldown({ type, title: 'All Sales Today', items, total: overview?.todayRevenue || 0 })
      } else if (type === 'cash') {
        const filtered = dailyRows.filter(r => r.methodLabel === 'Cash')
        setDrilldown({ type, title: 'Cash Sales', items: aggregateItems(filtered), total: overview?.todayCashSales || 0 })
      } else if (type === 'momo') {
        const filtered = dailyRows.filter(r => r.methodLabel === 'MoMo')
        setDrilldown({ type, title: 'MoMo Sales', items: aggregateItems(filtered), total: overview?.todayMomoSales || 0 })
      } else if (type === 'pos') {
        const filtered = dailyRows.filter(r => r.methodLabel === 'POS')
        setDrilldown({ type, title: 'POS/Card Sales', items: aggregateItems(filtered), total: overview?.todayPosSales || 0 })
      } else if (type === 'profit') {
        const items = aggregateItemsWithProfit(dailyRows)
        setDrilldown({ type, title: 'Profit Breakdown', items, total: overview?.todayProfit || 0 })
      } else if (type === 'completed') {
        // Products sold grouped by category
        const items = aggregateItems(dailyRows)
        const byCategory = groupByCategory(items)
        setDrilldown({ type, title: 'Completed Orders', byCategory, count: overview?.todayPaidOrdersCount || 0 })
      } else if (type === 'prep') {
        const orders = await api('/api/shop/orders/kitchen-queue')
        const byCategory = groupOrdersByCategory(orders)
        setDrilldown({ type, title: 'In Preparation', byCategory, count: orders.length })
      } else if (type === 'waiting') {
        const orders = await api('/api/shop/orders/ready')
        const byCategory = groupOrdersByCategory(orders)
        setDrilldown({ type, title: 'Ready for Payment', byCategory, count: orders.length })
      } else if (type === 'lowstock') {
        const low = ingredients.filter(ing => ing.stock_level <= ing.min_threshold)
        setDrilldown({ type, title: 'Low Stock Items', items: low })
      } else if (type === 'bakeryToday') {
        const stats = await api(`/api/shop/owner/reports/bakery?date=${reportDay}`)
        setDrilldown({ type, title: 'Bakery Production Summary', stats })
      }
    } catch (e) {
      setError(e.message)
    }
  }

  // Aggregate rawItems from payment rows into product summary
  function aggregateItems(rows) {
    const map = {}
    rows.forEach(row => {
      // Calculate attribution ratio for split payments
      const orderTotal = row.orderTotal || (row.rawItems || []).reduce((acc, it) => acc + (Number(it.price) * (it.qty || 1)), 0);
      const ratio = orderTotal > 0 ? (Number(row.amount) / orderTotal) : 1;

      (row.rawItems || []).forEach(item => {
        const key = item.name || item.item_name || 'Unknown'
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0, category: item.category || 'Uncategorized' }
        map[key].qty += (item.qty || 1) * ratio
        map[key].revenue += (Number(item.price) || 0) * (item.qty || 1) * ratio
      })
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }

  // Same as aggregateItems but also calculates profit
  function aggregateItemsWithProfit(rows) {
    const map = {}
    rows.forEach(row => {
      const orderTotal = row.orderTotal || (row.rawItems || []).reduce((acc, it) => acc + (Number(it.price) * (it.qty || 1)), 0);
      const ratio = orderTotal > 0 ? (Number(row.amount) / orderTotal) : 1;

      (row.rawItems || []).forEach(item => {
        const key = item.name || item.item_name || 'Unknown'
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0, cost: 0, category: item.category || 'Uncategorized' }
        const qty = (item.qty || 1) * ratio
        map[key].qty += qty
        map[key].revenue += (Number(item.price) || 0) * qty
        map[key].cost += (Number(item.buying_price) || 0) * qty
      })
    })
    return Object.values(map).map(i => ({ ...i, profit: i.revenue - i.cost })).sort((a, b) => b.profit - a.profit)
  }

  // Group items by category
  function groupByCategory(items) {
    const grouped = {}
    items.forEach(item => {
      const cat = item.category || 'Uncategorized'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    })
    return grouped
  }

  // Group orders (from kitchen-queue/drafts) by category
  function groupOrdersByCategory(orders) {
    const grouped = {}
    ;(orders || []).forEach(order => {
      (order.lines || order.order_items || order.items || []).forEach(item => {
        const cat = item.category || 'Order #' + (order.tableNumber || order.id?.slice(-4))
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push({ name: item.itemName || item.item_name || item.name || 'Unknown', qty: item.quantity || 1, orderId: order.id })
      })
    })
    return grouped
  }
  // ──────────────────────────────────────────────────────────────

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

  // Close all modals when switching tabs
  useEffect(() => {
    setActionMenu(null)
    setProductActionMenu(null)
    setStockHistory(null)
    setIngredientStockHistory(null)
    setLinkedProducts(null)
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }, [tab])

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
      is_recipe: menuForm.isRecipe,
      recipe_reference_yield: Number(menuForm.recipe_reference_yield || 1),
      stock_level: Number(menuForm.stockLevel || 0),
      buying_price: Number(menuForm.buyingPrice || 0),
      recipe: menuForm.isRecipe ? menuForm.productRecipe : []
    }
    try {
      if (menuForm.id) {
        await api(`/api/shop/menu/${menuForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/api/shop/menu', { method: 'POST', body: JSON.stringify(payload) })
      }
      setMenuForm({ 
        id: '', name: '', price: '', category: 'Hot Coffee', 
        available: true, productRecipe: [], isRecipe: false, stockLevel: '', buyingPrice: '',
        recipe_reference_yield: 1
      })
      setSelectedRecipeItem(null)
      setShowMenuForm(false)
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

    const isBeverage = ['Soft Drinks', 'Beer & Alcohol', 'Wines', 'Soda & Water'].includes(mi.category);
    let autoStock = mi.stock_level || '';
    let autoBuyingPrice = mi.buying_price || '';

    // If it's a beverage, try to pull the REAL data from inventory
    if (isBeverage) {
      if (currentRecipe.length > 0 && currentRecipe[0].ingredients) {
        // Option A: Pull from existing recipe link
        autoStock = currentRecipe[0].ingredients.stock_level;
        autoBuyingPrice = currentRecipe[0].ingredients.buying_price;
      } else {
        // Option B: Fallback - Match by Name in the ingredients list
        const matchedIng = ingredients.find(ing => ing.name.toLowerCase() === mi.name.toLowerCase());
        if (matchedIng) {
          autoStock = matchedIng.stock_level;
          autoBuyingPrice = matchedIng.buying_price;
        }
      }
    }

    setMenuForm({ 
      id: mi.id, 
      name: mi.name, 
      price: String(mi.price), 
      category: mi.category || 'Hot Coffee',
      available: mi.available,
      productRecipe: currentRecipe.map(r => {
        if (r.ingredient_id) {
          return {
            ingredient_id: r.ingredient_id,
            quantity_required: r.quantity_required,
            name: r.ingredients?.name,
            unit: r.ingredients?.unit,
            type: 'INGREDIENT'
          };
        }
        if (r.component_menu_item_id) {
          return {
            component_menu_item_id: r.component_menu_item_id,
            quantity_required: r.quantity_required,
            name: r.component_menu_item?.name,
            unit: 'unit',
            type: 'MENU_ITEM'
          };
        }
        return null;
      }).filter(Boolean),
      isRecipe: mi.is_recipe || currentRecipe.length > 0,
      recipe_reference_yield: mi.recipe_reference_yield || 1,
      stockLevel: autoStock,
      buyingPrice: autoBuyingPrice
    })
    setSelectedRecipeItem(mi)
  }

  async function saveStaff(e) {
    e.preventDefault()
    setError('')
    const payload = staffForm.id ? staffForm : { ...staffForm, role: staffAddType }
    try {
      if (staffForm.id) {
        await api(`/api/shop/staff/${staffForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/api/shop/staff', { method: 'POST', body: JSON.stringify(payload) })
      }
      setStaffForm({ id: '', name: '', email: '', password: '', role: staffAddType, security_key: '' })
      await reloadCore()
    } catch (err) {
      setError(err.message)
    }
  }

  async function editStaff(staffMember) {
    setStaffAddType(
      staffMember.role === 'CASHIER' ? 'CASHIER'
      : staffMember.role === 'MANAGER' ? 'MANAGER'
      : 'WAITER',
    )
    setStaffForm({
      id: staffMember.id,
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      role: staffMember.role,
      security_key: staffMember.security_key || ''
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
    <div className="panel owner am-content-wrapper" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
      <div className="am-dashboard-content owner-modern-page am-animate">
        {error ? <div className="error" style={{ marginBottom: 20 }}>{error}</div> : null}

      {tab === 'overview' && canAccessTab(role, 'overview') ? (
        overview ? (
          <>
            {/* Header */}
            <header className="am-header">
              <div className="am-title">
                <h1>{getDashboardLabel(role)}</h1>
                <p>
                  {overview?.hasActiveShift
                    ? 'Current shift overview'
                    : reportDay === getKigaliToday()
                      ? "Today's shifts"
                      : 'Shift overview'}
                  {' · '}
                  {new Date(reportDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Kigali' })}
                  {overview?.shifts?.[0] && (
                    <span style={{ display: 'block', fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: 500 }}>
                      Shift opened {formatShiftRange(overview.shifts[0])}
                      {overview.shifts.length > 1 ? ` (+${overview.shifts.length - 1} more)` : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="am-date-picker" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  onClick={() => document.getElementById('modern-date').showPicker?.()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  title="Pick a date"
                >
                  <HiOutlineCalendarDays />
                  <span>
                    {reportDay === getKigaliToday()
                      ? 'Today'
                      : new Date(reportDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Africa/Kigali' })}
                  </span>
                </div>
                {reportDay !== getKigaliToday() && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setReportDay(getKigaliToday()); }}
                    style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.3)', color: '#1D3557', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Today
                  </button>
                )}
                <input 
                  id="modern-date" 
                  type="date" 
                  value={reportDay} 
                  onChange={e => setReportDay(e.target.value)} 
                  max={getKigaliToday()}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
              </div>
            </header>

            {/* Metrics Row 1: Top 4 */}
            <div className="am-metrics-grid-top">
              <div className="am-metric-card" onClick={() => openDrilldown('revenue')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon"><HiOutlineCurrencyDollar /></div>
                  TOTAL REVENUE
                </div>
                <div className="am-metric-value">{Number(overview?.todayRevenue ?? 0).toLocaleString()} RWF</div>
                <div className="am-metric-trend am-trend-pos"><HiOutlineArrowTrendingUp /> +12% vs yesterday</div>
              </div>

              <div className="am-metric-card" onClick={() => openDrilldown('cash')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon"><HiOutlineBanknotes /></div>
                  CASH
                </div>
                <div className="am-metric-value">{Number(overview?.todayCashSales ?? 0).toLocaleString()}</div>
                <div className="am-metric-trend am-trend-neu">RWF today</div>
              </div>

              <div className="am-metric-card" onClick={() => openDrilldown('momo')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon"><HiOutlineDevicePhoneMobile /></div>
                  MOMO
                </div>
                <div className="am-metric-value">{Number(overview?.todayMomoSales ?? 0).toLocaleString()}</div>
                <div className="am-metric-trend am-trend-neu">RWF today</div>
              </div>

              <div className="am-metric-card" onClick={() => openDrilldown('pos')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon"><HiOutlineCreditCard /></div>
                  POS/CARD
                </div>
                <div className="am-metric-value">{Number(overview?.todayPosSales ?? 0).toLocaleString()}</div>
                <div className="am-metric-trend am-trend-neu">RWF today</div>
              </div>
            </div>

            {/* Metrics Row 2 */}
            <div className="am-metrics-grid-mid">
              <div className="am-metric-card" onClick={() => setTab('loans')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon" style={{ background: 'rgba(230, 126, 34, 0.1)', color: '#E67E22' }}><HiOutlineUsers /></div>
                  CREDIT / LOANS
                </div>
                <div className="am-metric-value">{Number(overview?.todayLoanSales ?? 0).toLocaleString()} RWF</div>
                <div className="am-metric-trend" style={{ color: '#E67E22' }}><HiOutlineExclamationTriangle /> Unpaid client credit</div>
              </div>

              <div className="am-metric-card" onClick={() => openDrilldown('profit')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon"><HiOutlineArrowTrendingUp /></div>
                  PROFIT
                </div>
                <div className="am-metric-value">{Number(overview?.todayProfit ?? 0).toLocaleString()}</div>
                <div className="am-metric-trend am-trend-pos">↑ Net today</div>
              </div>

              <div className="am-metric-card" onClick={() => setTab(isManagerRole(role) ? 'stock' : 'inventory')}>
                <div className="am-metric-header">
                  <div className="am-metric-icon" style={{ background: 'rgba(33, 150, 243, 0.1)', color: '#2196F3' }}><HiOutlineArchiveBox /></div>
                  STOCK VALUE
                </div>
                <div className="am-metric-value">{Number(overview?.inventoryValue ?? 0).toLocaleString()}</div>
                <div className="am-metric-trend" style={{ color: '#2196F3' }}>RWF in inventory</div>
              </div>
            </div>

            {/* Status Badges Grid */}
            <div className="am-status-grid">
              <div className="am-mini-status" onClick={() => openDrilldown('completed')}>
                 <div className="am-status-icon" style={{ background: 'rgba(76,175,80,0.1)', color: '#1D3557' }}><HiOutlineCheckCircle /></div>
                 <div className="am-status-info">
                   <h4>{overview?.todayPaidOrdersCount ?? 0}</h4>
                   <p>Completed</p>
                 </div>
              </div>

              <div className="am-mini-status" onClick={() => openDrilldown('prep')}>
                 <div className="am-status-icon" style={{ background: 'rgba(33,150,243,0.1)', color: '#2196F3' }}><HiOutlineFire /></div>
                 <div className="am-status-info">
                   <h4>{overview?.pendingKitchenCount ?? 0}</h4>
                   <p>In Prep</p>
                 </div>
              </div>

              <div className="am-mini-status" onClick={() => openDrilldown('waiting')}>
                 <div className="am-status-icon" style={{ background: 'rgba(255,152,0,0.1)', color: '#FF9800' }}><HiOutlineShoppingCart /></div>
                 <div className="am-status-info">
                   <h4>{overview?.waitingOrdersCount ?? 0}</h4>
                   <p>Waiting</p>
                 </div>
              </div>

              <div className="am-mini-status" onClick={() => openDrilldown('bakeryToday')}>
                 <div className="am-status-icon" style={{ background: 'rgba(233, 30, 99, 0.1)', color: '#E91E63' }}><MdOutlineLocalFireDepartment /></div>
                 <div className="am-status-info">
                   <h4>Bakery</h4>
                   <p>Manage & Produce</p>
                 </div>
              </div>

              <div className="am-mini-status" onClick={() => openDrilldown('lowstock')}>
                 <div className="am-status-icon" style={{ background: 'rgba(255,87,34,0.1)', color: '#FF5722' }}><HiOutlineExclamationTriangle /></div>
                 <div className="am-status-info">
                   <h4>{overview?.lowStockCount ?? 0}</h4>
                   <p>Low Stock</p>
                 </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="am-main-grid">
              {/* Left Column: Chart & Recent Orders */}
              <div className="am-left-col">
                <div className="am-chart-card">
                  <div className="am-chart-header">
                    <h3>Sales Overview</h3>
                    <div className="am-chart-tabs">
                      <div className="am-chart-tab active">Today</div>
                      <div className="am-chart-tab">Week</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 250, minWidth: 0 }}>
                    {chartsReady && charts.hourly?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.hourly.slice(6, 22)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 10 }} />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', color: '#111827' }}
                          />
                          <Bar dataKey="total" fill="var(--admin-accent-green)" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13 }}>
                        No sales data for this date yet
                      </div>
                    )}
                  </div>
                </div>

                <div className="am-table-card">
                  <div className="am-chart-header">
                    <h3>Recent Orders</h3>
                    <button className="btn ghost tiny" onClick={() => setShowAllOrdersModal(true)}>All</button>
                  </div>
                  <div className="am-order-list">
                    {dailyRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="am-order-row">
                        <div className="am-order-main">
                          <div className="am-order-tbl">Tbl {idx + 1}</div>
                          <div className="am-order-items">{row.items.length > 30 ? row.items.slice(0, 30) + '...' : row.items}</div>
                        </div>
                        <div className="am-order-right">
                          <div className="am-order-total">{Number(row.amount).toLocaleString()}</div>
                          <div className={`am-status-badge ${row.status === 'PAID' ? 'done' : row.status === 'PENDING' ? 'pending' : 'payment'}`}>
                            {row.status === 'PAID' ? 'Done' : row.status === 'PENDING' ? 'Pend' : 'Pay'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {dailyRows.length === 0 && <div className="muted pad text-center">No orders yet today.</div>}
                  </div>
                </div>

                <div className="am-table-card" style={{ cursor: 'pointer' }} onClick={() => setTab('reports')}>
                  <h3>Payment Methods</h3>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>💵 Cash</span> <span>{Number(overview?.todayCashSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayCashSales / overview?.todayRevenue) * 100 || 0}%`, background: '#1D3557' }} /></div>
                  </div>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>📱 MoMo</span> <span>{Number(overview?.todayMomoSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayMomoSales / overview?.todayRevenue) * 100 || 0}%`, background: '#2196F3' }} /></div>
                  </div>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>💳 Card</span> <span>{Number(overview?.todayPosSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayPosSales / overview?.todayRevenue) * 100 || 0}%`, background: '#FF9800' }} /></div>
                  </div>
                </div>
              </div>

              {/* Right Column: Info Cards (hidden on mobile via CSS, shown on desktop) */}
              <div className="am-info-stack">
                <div className="am-table-card" style={{ marginTop: 0, cursor: 'pointer' }} onClick={() => setTab('reports')}>
                  <h3>Payment Methods</h3>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>Cash</span> <span>{Number(overview?.todayCashSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayCashSales / overview?.todayRevenue) * 100 || 0}%`, background: '#1D3557' }} /></div>
                  </div>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>MoMo</span> <span>{Number(overview?.todayMomoSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayMomoSales / overview?.todayRevenue) * 100 || 0}%`, background: '#2196F3' }} /></div>
                  </div>
                  <div className="am-progress-item">
                     <div className="am-progress-label"><span>Card / POS</span> <span>{Number(overview?.todayPosSales || 0).toLocaleString()} RWF</span></div>
                     <div className="am-progress-bar"><div className="am-progress-fill" style={{ width: `${(overview?.todayPosSales / overview?.todayRevenue) * 100 || 0}%`, background: '#FF9800' }} /></div>
                  </div>
                </div>

                <div className="am-table-card" style={{ marginTop: 0, cursor: 'pointer' }} onClick={() => setTab('staff')}>
                  <h3>Top Staff Today</h3>
                  {topStaff.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="am-staff-row">
                      <div className="am-staff-avatar">{s.name[0]}</div>
                      <div className="am-staff-info">
                        <div className="am-staff-name">{s.name}</div>
                        <div className="am-staff-meta">{s.count} orders</div>
                      </div>
                      <div className="am-staff-val">
                        <div className="am-staff-amt">{Number(s.amount).toLocaleString()} RWF</div>
                      </div>
                    </div>
                  ))}
                  {topStaff.length === 0 && <div className="muted italic text-sm">No activity recorded for staff today.</div>}
                </div>
              </div>
            </div>
            <footer style={{ marginTop: 48, opacity: 0.3, textAlign: 'center', fontSize: 11, borderTop: '1px solid #E5E7EB', padding: '24px 0' }}>
               © 2026 Olitech Market POS. Midnight Espresso Premium Dashboard.
            </footer>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 20 }}>
            <div className="loading-spinner"></div>
            <span>Brewing your dashboard...</span>
          </div>
        )
      ) : null}

      {tab === 'menu' && ownerAccess ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Product & Menu Management</h1>
              <p>Organize your shop offerings by category</p>
            </div>
            <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
               <div className="am-report-sel-item">
                  <label>Search Products</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                      type="text" 
                      className="am-input" 
                      style={{ paddingLeft: 40, height: 40 }}
                      placeholder="Find a product..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
               </div>
            </div>
          </header>

          {showMenuForm && <form id="menu-form" onSubmit={saveMenu} className={`am-card am-animate ${menuForm.id || menuForm.category !== 'Hot Coffee' ? 'glow-active' : ''}`} style={{ padding: '32px', marginBottom: 40 }}>
            <h3 style={{ marginBottom: 24, color: '#1D3557', display: 'flex', alignItems: 'center', gap: 12, fontSize: '20px', fontWeight: 800 }}>
              {menuForm.id ? 'Edit Product' : `Add Product to ${menuForm.category}`}
            </h3>

            <div className="am-form-grid">
              <label className="am-field span-2">
                <span>Product Name</span>
                <input
                  id="menu-name-input"
                  className="am-input"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Cappuccino Large"
                />
              </label>

              <div className="am-field span-2">
                <span>Production Method</span>
                <div className="am-type-toggle">
                   <button 
                     type="button" 
                     className={!menuForm.isRecipe ? 'active' : ''} 
                     onClick={() => setMenuForm(f => ({ ...f, isRecipe: false }))}
                   >
                     Ready-to-Sell (Soda, Water...)
                   </button>
                   <button 
                     type="button" 
                     className={menuForm.isRecipe ? 'active' : ''} 
                     onClick={() => setMenuForm(f => ({ ...f, isRecipe: true }))}
                   >
                     Prepared (Coffee, Food...)
                   </button>
                </div>
              </div>

              <label className="am-field">
                <span>Price (RWF)</span>
                <input
                  className="am-input"
                  type="number"
                  value={menuForm.price}
                  onChange={(e) => setMenuForm((f) => ({ ...f, price: e.target.value }))}
                  required
                  placeholder="0"
                />
              </label>

              <label className="am-field">
                <span>Category</span>
                <select 
                  className="am-input"
                  value={menuForm.category} 
                  onChange={(e) => setMenuForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {SUB_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </label>

              {menuForm.isRecipe && (
                <label className="am-field">
                  <span>Standard Yield (Batch Size)</span>
                  <p style={{ fontSize: 10, color: '#666' }}>Units produced by this recipe (e.g. 90)</p>
                  <input
                    className="am-input"
                    type="number"
                    value={menuForm.recipe_reference_yield || 1}
                    onChange={(e) => setMenuForm((f) => ({ ...f, recipe_reference_yield: Number(e.target.value) }))}
                    required
                  />
                </label>
              )}

              {(!menuForm.isRecipe || ['Soft Drinks', 'Beer & Alcohol', 'Wines', 'Soda & Water', 'Wine'].includes(menuForm.category)) ? (
                 <div className="span-2 am-form-grid-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                   <label className="am-field">
                     <span>Current Stock Level</span>
                     <input 
                       className="am-input"
                       type="number" 
                       value={menuForm.stockLevel} 
                       onChange={e => setMenuForm(f => ({ ...f, stockLevel: e.target.value }))}
                       placeholder="e.g. 50"
                     />
                   </label>
                   <label className="am-field">
                     <span>Purchase Price (RWF)</span>
                     <input 
                       className="am-input"
                       type="number" 
                       value={menuForm.buyingPrice} 
                       onChange={e => setMenuForm(f => ({ ...f, buyingPrice: e.target.value }))}
                       placeholder="e.g. 500"
                     />
                   </label>
                 </div>
              ) : (
                <div className="am-field">
                  <span style={{ opacity: 0.5 }}>Availability</span>
                  <label className="am-checkbox-label">
                    <input
                      type="checkbox"
                      checked={menuForm.available}
                      onChange={(e) => setMenuForm((f) => ({ ...f, available: e.target.checked }))}
                    />
                    <span>Visible in Point of Sale</span>
                  </label>
                </div>
              )}
            </div>

            {menuForm.isRecipe && (
              <div className="item-recipe-area anim-fade" style={{ marginTop: 24, padding: 20, background: '#F9FAFB', borderRadius: 16, border: '1px solid #E5E7EB' }}>
                 <h4 style={{ color: '#1D3557', marginBottom: 16, fontSize: '15px', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <HiOutlineDocumentText /> Recipe Ingredients
                 </h4>
                 
                 <div className="am-recipe-input-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                    <label className="am-field">
                      <span style={{ fontSize: '11px' }}>Component</span>
                      <select 
                        className="am-input"
                        value={tempRecipeLine.componentValue || ''} 
                        style={{ height: '38px' }}
                        onChange={e => {
                          const val = e.target.value;
                          if (!val) {
                            setTempRecipeLine({ componentValue: '', quantity_required: '' });
                            return;
                          }
                          const [type, id] = val.split(':');
                          setTempRecipeLine(f => ({ ...f, componentValue: val, componentType: type, componentId: id }));
                        }}
                      >
                        <option value="">-- Select --</option>
                        <optgroup label="Raw Ingredients">
                          {ingredients.map(ing => (
                            <option key={ing.id} value={`ing:${ing.id}`}>{ing.name} ({ing.unit})</option>
                          ))}
                        </optgroup>
                        <optgroup label="Menu Products">
                          {menu.filter(m => m.id !== menuForm.id && m.id !== selectedRecipeItem?.id).map(m => (
                            <option key={m.id} value={`prod:${m.id}`}>{m.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <label className="am-field">
                      <span style={{ fontSize: '11px' }}>Qty</span>
                      <input 
                        className="am-input"
                        type="number" 
                        step="0.01" 
                        style={{ height: '38px' }}
                        value={tempRecipeLine.quantity_required} 
                        onChange={e => setTempRecipeLine(f => ({ ...f, quantity_required: e.target.value }))} 
                      />
                    </label>
                    <button 
                      type="button" 
                      className="btn primary" 
                      style={{ height: 38, padding: '0 20px' }}
                      onClick={() => {
                        if (!tempRecipeLine.componentValue || !tempRecipeLine.quantity_required) return;
                        const type = tempRecipeLine.componentType;
                        const id = tempRecipeLine.componentId;
                        let line = { quantity_required: tempRecipeLine.quantity_required };
                        if (type === 'ing') {
                          const ing = ingredients.find(x => x.id === id);
                          line = { ...line, ingredient_id: id, name: ing?.name, unit: ing?.unit, type: 'INGREDIENT' };
                        } else if (type === 'prod') {
                          const prod = menu.find(x => x.id === id);
                          line = { ...line, component_menu_item_id: id, name: prod?.name, unit: 'unit', type: 'MENU_ITEM' };
                        }
                        setMenuForm(f => ({
                          ...f,
                          productRecipe: [...f.productRecipe, line]
                        }))
                        setTempRecipeLine({ componentValue: '', componentType: '', componentId: '', quantity_required: '' })
                      }}
                    >
                      Add
                    </button>
                 </div>

                 <div className="am-recipe-list" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                   {menuForm.productRecipe.map((line, idx) => (
                   <div key={idx} className="am-recipe-tag">
                        <span>
                          {line.type === 'MENU_ITEM' ? '📦 ' : '🧪 '}
                          {line.name}: <strong>{line.quantity_required} {line.unit}</strong>
                        </span>
                        <button type="button" onClick={() => setMenuForm(f => ({ ...f, productRecipe: f.productRecipe.filter((_, i) => i !== idx) }))}>×</button>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            <div className="span-2 row-actions" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn primary xl" type="submit" style={{ minWidth: 160 }}>
                {menuForm.id ? 'Save Changes' : 'Add to Menu'}
              </button>
              <button type="button" className="btn ghost" onClick={() => {
                setMenuForm({ id: '', name: '', price: '', category: 'Hot Coffee', available: true, productRecipe: [], isRecipe: false, stockLevel: '', buyingPrice: '', recipe_reference_yield: 1 })
                setSelectedRecipeItem(null)
                setShowMenuForm(false)
              }}>
                Cancel
              </button>
              {menuForm.id && canEdit && (
                <button type="button" className="btn warn" style={{ marginLeft: 'auto' }} onClick={() => {
                  deleteMenu(menuForm.id)
                  setShowMenuForm(false)
                }}>
                  Delete Product
                </button>
              )}
            </div>
          </form>}

          {menuForm.id && (
            <div className="card" style={{ marginTop: 20, border: '2px solid var(--caramel-light)' }}>
              <h3>📜 Recipe Components for {menuForm.name}</h3>
              <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Specify what this product consumes when sold (ingredients or other menu products).</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const val = recipeForm.componentValue || '';
                  const [type, id] = val.split(':');
                  const body = {
                    menu_item_id: menuForm.id,
                    quantity_required: Number(recipeForm.quantity_required)
                  };
                  if (type === 'ing') {
                    body.ingredient_id = id;
                  } else if (type === 'prod') {
                    body.component_menu_item_id = id;
                  } else {
                    setError('Please select a component');
                    return;
                  }
                  await api('/api/shop/owner/recipes', { 
                    method: 'POST', 
                    body: JSON.stringify(body) 
                  });
                  setRecipeForm({ componentValue: '', quantity_required: 0 });
                  const updated = await api(`/api/shop/owner/recipes/${menuForm.id}`);
                  setRecipeLines(updated);
                } catch (err) { setError(err.message) }
              }} className="grid-form">
                <label className="field">
                  <span>Component</span>
                  <select 
                    value={recipeForm.componentValue || ''} 
                    onChange={e => setRecipeForm(f => ({ ...f, componentValue: e.target.value }))}
                    required
                  >
                    <option value="">-- Choose Component --</option>
                    <optgroup label="Raw Ingredients">
                      {ingredients.map(ing => (
                        <option key={ing.id} value={`ing:${ing.id}`}>{ing.name} ({ing.unit})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Menu Products">
                      {menu.filter(m => m.id !== menuForm.id).map(m => (
                        <option key={m.id} value={`prod:${m.id}`}>{m.name}</option>
                      ))}
                    </optgroup>
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
                  <button type="submit" className="btn primary" style={{ height: 42, width: '100%' }}>Add Component</button>
                </div>
              </form>

              <div className="table tiny" style={{ marginTop: 16 }}>
                {recipeLines.map(line => (
                  <div key={line.id} className="row" style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>
                      {line.ingredients?.name || line.component_menu_item?.name || 'Unknown'}
                      {line.component_menu_item_id && <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 6 }}>(product)</span>}
                    </div>
                    <div>{line.quantity_required} {line.ingredients?.unit || 'unit'}</div>
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
                    No components linked to this recipe yet.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="row-between" style={{ marginBottom: 20 }}>
             <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
               <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
               <input 
                 type="text" 
                 placeholder="Search products..." 
                 value={menuSearch}
                 onChange={(e) => { setMenuSearch(e.target.value); setMenuPage(1); }}
                 style={{ 
                   paddingLeft: 36, 
                   borderRadius: 14, 
                   width: '100%', 
                   height: 44, 
                   fontSize: 14,
                   background: '#FFFFFF',
                   border: '1px solid #E5E7EB',
                   color: '#111827'
                 }}
               />
             </div>
          </div>

          {/* Global Add Product button — always visible */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <button
              className="btn primary"
              onClick={() => {
                setMenuForm({ id: '', name: '', price: '', category: 'Hot Coffee', available: true, productRecipe: [], isRecipe: false, stockLevel: '', buyingPrice: '' });
                setShowMenuForm(true);
                setTimeout(() => {
                  document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' });
                  document.getElementById('menu-name-input')?.focus();
                }, 100);
              }}
            >
              + Add New Product
            </button>
          </div>

          <div className="stack" style={{ gap: 40 }}>
            {Object.entries(
              menu.filter(m => !m.is_bakery).reduce((acc, m) => {
                const cat = m.category || 'Uncategorized';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(m);
                return acc;
              }, {})
            )
            .filter(([cat]) => !['Bakery', 'Bakery & Desserts'].includes(cat) && !cat.toLowerCase().includes('bakery'))
            .filter(([cat]) => cat.toLowerCase().includes(menuSearch.toLowerCase()) || menuSearch === '')
            .map(([cat, items]) => (
              <div key={cat} className="am-category-group am-animate">
                <div className="row-between" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: '20px', color: '#111827', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800 }}>
                    <span style={{ color: '#1D3557' }}>•</span> {cat}
                    <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 400 }}>{items.length} Products</span>
                  </h3>
                  <button 
                    className="btn primary tiny" 
                    onClick={() => {
                      setMenuForm({ id: '', name: '', price: '', category: cat, available: true, productRecipe: [], isRecipe: false, stockLevel: '', buyingPrice: '' });
                      setShowMenuForm(true);
                      setTimeout(() => {
                        document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' });
                        document.getElementById('menu-name-input')?.focus();
                      }, 100);
                    }}
                  >
                    + Add Product
                  </button>
                </div>

                <div className="am-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                  {(() => {
                    const isSimpleListing = ['Beer & Alcohol', 'Wines', 'Soft Drinks'].includes(cat);
                    const matchingItems = items.filter(i => 
                      i.name.toLowerCase().includes(menuSearch.toLowerCase()) || 
                      (i.category && i.category.toLowerCase().includes(menuSearch.toLowerCase()))
                    );

                    if (matchingItems.length === 0) {
                      return <p style={{ padding: '24px', color: '#6B7280', textAlign: 'center', margin: 0 }}>No matching products found.</p>;
                    }

                    return (
                      <table className="am-modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            <th style={{ padding: '16px 24px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Product Name</th>
                            {isSimpleListing && <th style={{ padding: '16px 24px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Quantity</th>}
                            {isSimpleListing && <th style={{ padding: '16px 24px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Buying Price</th>}
                            <th style={{ padding: '16px 24px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>{isSimpleListing ? 'Selling Price' : 'Price'}</th>
                            <th style={{ padding: '16px 24px', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchingItems.map((m) => {
                            const recipeList = m.recipe || m.recipe_items || m.ingredients || m.product_recipes || m.ingredients_list || [];
                            const hasRecipeArray = Array.isArray(recipeList) && recipeList.length > 0;
                            
                            // Categories that MUST be recipe-based
                            const isRecipeCategory = ['Hot Coffee', 'Iced Coffee', 'Tea & Hot Drinks', 'Fast Food', 'Main Food / Meals', 'Juice & Smoothies', 'Bakery & Desserts'].includes(m.category);
                            
                            // Categories that MUST be simple stock (bottles/cans)
                            const isSimpleCategory = ['Beer & Alcohol', 'Soft Drinks', 'Wines', 'Soda & Water'].includes(m.category);
                            
                            const isRecipeBased = (m.is_recipe || hasRecipeArray || isRecipeCategory) && !isSimpleCategory;

                            // Check if recipe is actually configured
                            const recipeConfigured = hasRecipeArray && recipeList.length > 0;
                            const needsRecipe = isRecipeBased && !recipeConfigured;
                            
                            // Row border color: purple=has recipe, orange=needs recipe, blue=simple stock
                            const rowBorderColor = isRecipeBased 
                              ? (needsRecipe ? '#F39C12' : '#9b59b6') 
                              : '#3498db';

                            return (
                              <tr 
                                key={m.id} 
                                style={{ 
                                  borderBottom: '1px solid #F3F4F6', 
                                  cursor: 'pointer', 
                                  borderLeft: `4px solid ${rowBorderColor}`,
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none'
                                }} 
                                onPointerDown={() => handleProductPointerDown(m)} 
                                onPointerUp={handleProductPointerUp} 
                                onPointerLeave={handleProductPointerUp} 
                                onContextMenu={e => e.preventDefault()}
                                onClick={() => {
                                  editMenu(m);
                                  setShowMenuForm(true);
                                  setTimeout(() => {
                                    document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' });
                                    document.getElementById('menu-name-input')?.focus();
                                  }, 100);
                                }}
                              >
                                <td style={{ padding: '16px 24px' }}>
                                  <div style={{ fontWeight: 600, color: '#111827' }}>
                                    {m.name}
                                    {m.available ? null : <span style={{ opacity: 0.3, fontSize: '10px', marginLeft: 8 }}>(Hidden)</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                                    {isRecipeBased ? (
                                      <span className="badge" style={{ background: needsRecipe ? 'rgba(243, 156, 18, 0.12)' : 'rgba(155, 89, 182, 0.12)', color: needsRecipe ? '#d35400' : '#9b59b6', fontSize: '10px', padding: '3px 10px', fontWeight: 800, borderRadius: 12, letterSpacing: '0.5px' }}>
                                        {needsRecipe ? '⚠️ NEEDS RECIPE' : '🍳 NEEDS PREPARATION'}
                                      </span>
                                    ) : (
                                      <span className="badge" style={{ background: 'rgba(52, 152, 219, 0.12)', color: '#2980b9', fontSize: '10px', padding: '3px 10px', fontWeight: 800, borderRadius: 12, letterSpacing: '0.5px' }}>
                                        ✅ READY TO SELL
                                      </span>
                                    )}
                                    
                                    {needsRecipe && (
                                      <span className="badge" style={{ background: 'rgba(231, 76, 60, 0.12)', color: '#c0392b', fontSize: '10px', padding: '3px 10px', fontWeight: 800, borderRadius: 12 }}>
                                        <HiOutlineExclamationTriangle style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} /> NO RECIPE CONFIGURED
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {isSimpleListing && (
                                  <td style={{ padding: '16px 24px', color: 'rgba(52, 152, 219, 1)', fontWeight: 600 }}>
                                    {m.stock_level !== undefined && m.stock_level !== null ? m.stock_level : 0}
                                  </td>
                                )}
                                {isSimpleListing && (
                                  <td style={{ padding: '16px 24px', color: '#6B7280' }}>
                                    {m.buying_price !== undefined && m.buying_price !== null ? Number(m.buying_price).toLocaleString() : 0} RWF
                                  </td>
                                )}
                                <td style={{ padding: '16px 24px', color: '#1D3557', fontWeight: 700 }}>
                                  {Number(m.price).toLocaleString()} RWF
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                  <span className={`badge ${m.available ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                                    {m.available ? 'AVAILABLE' : 'HIDDEN'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            ))}
              {menu.length === 0 && (
                <div className="am-card" style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                  <h3 style={{ color: '#1D3557', marginBottom: 8 }}>No Products Yet</h3>
                  <p style={{ color: '#6B7280', marginBottom: 24 }}>Get started by adding your first product to the menu.</p>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setMenuForm({ id: '', name: '', price: '', category: 'Hot Coffee', available: true, productRecipe: [], isRecipe: false, stockLevel: '', buyingPrice: '' });
                      setShowMenuForm(true);
                      setTimeout(() => {
                        document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' });
                        document.getElementById('menu-name-input')?.focus();
                      }, 100);
                    }}
                  >
                    + Add First Product
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}

      {tab === 'staff' && ownerAccess ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Staff Management</h1>
              <p>Monitor employee performance and sales</p>
            </div>
             <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
               <div className="am-report-sel-item">
                  <label>Search Staff</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                      type="text" 
                      className="am-input" 
                      style={{ paddingLeft: 40, height: 40 }}
                      placeholder="Find a member..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
               </div>
            </div>
          </header>

          <div className="am-animate" style={{ padding: '0' }}>
          {/* Staff Metrics */}
          <div className="am-reports-grid" style={{ marginBottom: 32 }}>
             <div className="am-metric-card">
                <div className="am-metric-header">TOTAL STAFF</div>
                <div className="am-metric-value">{staff.length}</div>
                <div className="am-metric-trend am-trend-neu">registered members</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">ACTIVE NOW</div>
                <div className="am-metric-value">{staff.length > 2 ? 3 : staff.length}</div>
                <div className="am-metric-trend am-trend-pos">on shift today</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">ROLES</div>
                <div className="am-metric-value">{new Set(staff.map(s => s.role)).size}</div>
                <div className="am-metric-trend am-trend-neu">owner · manager · waiter · cashier</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">LAST ADDED</div>
                <div className="am-metric-value" style={{ fontSize: 18 }}>{staff.length > 0 ? new Date(Math.max(...staff.map(s => new Date(s.created_at || Date.now())))).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Africa/Kigali' }) : 'N/A'}</div>
                <div className="am-metric-trend am-trend-neu">newest member</div>
             </div>
          </div>

          <div className="am-main-grid am-grid-form-list">
            {/* Form Card */}
            <div className="am-category-sales-card" style={{ height: 'fit-content' }}>
               <h3 className="am-card-title">{staffForm.id ? 'Edit staff member' : 'Register new staff'}</h3>

               {!staffForm.id && (
                 <div className="am-staff-type-picker" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
                   <button
                     type="button"
                     className={`am-staff-type-card ${staffAddType === 'WAITER' ? 'active' : ''}`}
                     onClick={() => {
                       setStaffAddType('WAITER')
                       setStaffForm(f => ({ ...f, role: 'WAITER' }))
                     }}
                     style={{
                       textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                       border: staffAddType === 'WAITER' ? '2px solid #4CAF50' : '1px solid #E5E7EB',
                       background: staffAddType === 'WAITER' ? 'rgba(76,175,80,0.08)' : '#fff',
                     }}
                   >
                     <div style={{ fontWeight: 800, fontSize: 15, color: '#2E7D32', marginBottom: 6 }}>Waiter</div>
                     <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                       Takes orders and serves tables.
                     </div>
                   </button>
                   <button
                     type="button"
                     className={`am-staff-type-card ${staffAddType === 'CASHIER' ? 'active' : ''}`}
                     onClick={() => {
                       setStaffAddType('CASHIER')
                       setStaffForm(f => ({ ...f, role: 'CASHIER' }))
                     }}
                     style={{
                       textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                       border: staffAddType === 'CASHIER' ? '2px solid #2196F3' : '1px solid #E5E7EB',
                       background: staffAddType === 'CASHIER' ? 'rgba(33,150,243,0.08)' : '#fff',
                     }}
                   >
                     <div style={{ fontWeight: 800, fontSize: 15, color: '#2196F3', marginBottom: 6 }}>Cashier</div>
                     <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                       POS and billing access. Opens/closes shifts.
                     </div>
                   </button>
                   <button
                     type="button"
                     className={`am-staff-type-card ${staffAddType === 'MANAGER' ? 'active' : ''}`}
                     onClick={() => {
                       setStaffAddType('MANAGER')
                       setStaffForm(f => ({ ...f, role: 'MANAGER' }))
                     }}
                     style={{
                       textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                       border: staffAddType === 'MANAGER' ? '2px solid #9C27B0' : '1px solid #E5E7EB',
                       background: staffAddType === 'MANAGER' ? 'rgba(156,39,176,0.08)' : '#fff',
                     }}
                   >
                     <div style={{ fontWeight: 800, fontSize: 15, color: '#7B1FA2', marginBottom: 6 }}>Manager</div>
                     <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                       Supervises daily ops, reports, EOD.
                     </div>
                   </button>
                   <button
                     type="button"
                     className={`am-staff-type-card ${staffAddType === 'CHEF' ? 'active' : ''}`}
                     onClick={() => {
                       setStaffAddType('CHEF')
                       setStaffForm(f => ({ ...f, role: 'CHEF' }))
                     }}
                     style={{
                       textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                       border: staffAddType === 'CHEF' ? '2px solid #FF5722' : '1px solid #E5E7EB',
                       background: staffAddType === 'CHEF' ? 'rgba(255,87,34,0.08)' : '#fff',
                     }}
                   >
                     <div style={{ fontWeight: 800, fontSize: 15, color: '#BF360C', marginBottom: 6 }}>🍳 Chef</div>
                     <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                       Kitchen display. Sees & marks orders ready.
                     </div>
                   </button>
                   <button
                     type="button"
                     className={`am-staff-type-card ${staffAddType === 'AUDITOR' ? 'active' : ''}`}
                     onClick={() => {
                       setStaffAddType('AUDITOR')
                       setStaffForm(f => ({ ...f, role: 'AUDITOR' }))
                     }}
                     style={{
                       textAlign: 'left', padding: 16, borderRadius: 12, cursor: 'pointer',
                       border: staffAddType === 'AUDITOR' ? '2px solid #00BCD4' : '1px solid #E5E7EB',
                       background: staffAddType === 'AUDITOR' ? 'rgba(0,188,212,0.08)' : '#fff',
                     }}
                   >
                     <div style={{ fontWeight: 800, fontSize: 15, color: '#00838F', marginBottom: 6 }}>👁️ Auditor</div>
                     <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                       Read-only access to reports and audit logs.
                     </div>
                   </button>
                 </div>
               )}

               <form 
                 onSubmit={saveStaff}
                 className="stack" 
                 style={{ gap: 20 }}
               >
                  {!staffForm.id && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F3F4F6', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      Creating: <span style={{ color: staffAddType === 'CASHIER' ? '#2196F3' : staffAddType === 'MANAGER' ? '#9C27B0' : staffAddType === 'CHEF' ? '#FF5722' : staffAddType === 'AUDITOR' ? '#00BCD4' : '#2E7D32' }}>{staffAddType === 'CASHIER' ? 'Cashier' : staffAddType === 'MANAGER' ? 'Manager' : staffAddType === 'CHEF' ? 'Chef' : staffAddType === 'AUDITOR' ? 'Auditor' : 'Waiter'}</span>
                    </div>
                  )}
                  <div className="grid-2" style={{ gap: 16 }}>
                    <label className="am-field">
                      <span>Full Name</span>
                      <input className="am-input" value={staffForm.name} onChange={e => setStaffForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Amina Kayitesi" />
                    </label>
                    <label className="am-field">
                      <span>Email (login)</span>
                      <input className="am-input" type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({...f, email: e.target.value}))} required placeholder="e.g. amina@mama.local" />
                    </label>
                  </div>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <label className="am-field">
                      <span>{staffForm.id ? 'New Password' : 'Temporary Password'}</span>
                      <input className="am-input" type="password" value={staffForm.password} onChange={e => setStaffForm(f => ({...f, password: e.target.value}))} required={!staffForm.id} placeholder="Set a password" />
                    </label>
                    {staffForm.id ? (
                      <label className="am-field">
                        <span>Role</span>
                        <select className="am-input" value={staffForm.role} onChange={e => setStaffForm(f => ({...f, role: e.target.value}))}>
                           <option value="WAITER">Waiter — orders & tables</option>
                           <option value="CASHIER">Cashier — POS & billing</option>
                           <option value="MANAGER">Manager — reports & supervision</option>
                           <option value="CHEF">Chef — kitchen display</option>
                           <option value="AUDITOR">Auditor — read-only reports</option>
                           {staffForm.role === 'SHOP_ADMIN' && <option value="SHOP_ADMIN">Owner</option>}
                        </select>
                      </label>
                    ) : (
                      <label className="am-field">
                        <span>Access level</span>
                        <input className="am-input" readOnly value={
                          staffAddType === 'CASHIER' ? 'Cashier — POS, billing & shifts'
                          : staffAddType === 'MANAGER' ? 'Manager — reports, EOD & supervision'
                          : staffAddType === 'CHEF' ? 'Chef — kitchen display & order queue'
                          : staffAddType === 'AUDITOR' ? 'Auditor — read-only access to ops/reports'
                          : 'Waiter — orders & tables'
                        } />
                      </label>
                    )}
                  </div>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <label className="am-field">
                      <span>Security PIN (Optional)</span>
                      <input className="am-input" type="text" maxLength="12" value={staffForm.security_key || ''} onChange={e => setStaffForm(f => ({...f, security_key: e.target.value}))} placeholder="e.g. 12345678" />
                      <span style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Used by waiters to authenticate on POS</span>
                    </label>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn success xl flex-1" type="submit" style={{ borderRadius: 12 }}>
                      {staffForm.id ? 'Update member' : (staffAddType === 'CASHIER' ? 'Register Cashier' : staffAddType === 'MANAGER' ? 'Register Manager' : staffAddType === 'CHEF' ? 'Register Chef' : staffAddType === 'AUDITOR' ? 'Register Auditor' : 'Register Waiter')}
                    </button>
                    <button
                      className="btn outline xl"
                      type="button"
                      onClick={() => {
                        setStaffForm({ id: '', name: '', email: '', password: '', role: staffAddType, security_key: '' })
                      }}
                      style={{ borderRadius: 12 }}
                    >
                      Clear
                    </button>
                  </div>
               </form>
            </div>

            {/* List Group */}
            <div className="stack" style={{ gap: 24 }}>
               <div className="am-filter-pills" style={{ margin: 0 }}>
                  {['ALL', 'OWNER', 'MANAGER', 'AUDITOR', 'WAITER', 'CASHIER', 'CHEF'].map(f => (
                    <div 
                      key={f} 
                      className={`am-pill ${staffFilter === f ? 'active' : ''}`}
                      onClick={() => setStaffFilter(f)}
                    >
                       {f === 'ALL' && <HiOutlineUsers size={14} />}
                       {f === 'OWNER' && <HiOutlinePlusCircle size={14} style={{ color: '#1D3557' }} />}
                       {f === 'MANAGER' && <HiOutlineChartBar size={14} style={{ color: '#9C27B0' }} />}
                       {f === 'AUDITOR' && <HiOutlineDocumentText size={14} style={{ color: '#00BCD4' }} />}
                       {f === 'WAITER' && <HiOutlineUsers size={14} style={{ color: '#4CAF50' }} />}
                       {f === 'CASHIER' && <HiOutlineShoppingCart size={14} style={{ color: '#2196F3' }} />}
                       {f === 'CHEF' && <span style={{ color: '#FF5722', fontSize: 14 }}>🍳</span>}
                       {f === 'OWNER' ? 'Owner' : f === 'MANAGER' ? 'Manager' : f === 'CHEF' ? 'Chef' : f === 'AUDITOR' ? 'Auditor' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </div>
                  ))}
               </div>

               <div className="am-category-sales-card am-staff-list" style={{ padding: 0 }}>
                  <table className="am-modern-table">
                     <thead>
                        <tr>
                           <th>NAME</th>
                           <th>EMAIL</th>
                           <th>ROLE</th>
                           <th>STATUS</th>
                           <th></th>
                        </tr>
                     </thead>
                     <tbody>
                        {staff
                          .filter(staffMember => (staffFilter === 'ALL' || (staffFilter === 'OWNER' ? staffMember.role === 'SHOP_ADMIN' : staffMember.role === staffFilter)) && (
                            staffMember.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                            staffMember.email.toLowerCase().includes(staffSearch.toLowerCase())
                          ))
                          .map(staffMember => {
                             const initials = staffMember.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                             const isOwner = staffMember.role === 'SHOP_ADMIN'
                             const roleStyle = staffRoleStyle(staffMember.role)
                             const active = true; // Placeholder for real shift status
                             
                             return (
                               <tr key={staffMember.id}>
                                  <td>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="am-loan-avatar">{initials}</div>
                                        <div>
                                           <div style={{ fontWeight: 700 }}>{staffMember.name}</div>
                                           <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>Since {new Date(staffMember.created_at || Date.now()).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' })}</div>
                                           <span style={{ 
                                             fontSize: 14, 
                                             fontWeight: 800, 
                                             color: '#0F172A' 
                                           }}>
                                             {Math.floor((Math.min(...(menuForm.productRecipe || []).map(r => 
                                               r.quantity_required > 0 ? (r.stock_level / r.quantity_required) : Infinity
                                             )) || 0) * (menuForm.recipe_reference_yield || 81)).toLocaleString()} <small style={{ fontSize: 10 }}>pcs</small>
                                           </span>
                                        </div>
                                     </div>
                                  </td>
                                  <td style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>{staffMember.email}</td>
                                  <td>
                                     <span style={{ 
                                       padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                       background: roleStyle.bg,
                                       color: roleStyle.color,
                                       border: `1px solid ${roleStyle.border}`
                                     }}>
                                       {staffRoleLabel(staffMember.role)}
                                     </span>
                                  </td>
                                  <td>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                        <span className="am-priority-dot" style={{ background: active ? '#1D3557' : '#B0B0B0' }}></span>
                                        {active ? 'Active' : 'Off shift'}
                                     </div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                     <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button className="btn ghost tiny" onClick={() => editStaff(staffMember)}>📝</button>
                                        {!isOwner && canEdit && (
                                          <button className="btn ghost tiny" style={{ color: '#FF5252' }} onClick={() => deleteStaff(staffMember.id)}>🗑️</button>
                                        )}
                                     </div>
                                  </td>
                               </tr>
                             )
                          })}
                        {staff.length === 0 && (
                          <tr>
                             <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>No staff found</td>
                          </tr>
                        )}
                     </tbody>
                   </table>
                </div>
             </div>
           </div>
          </div>
        </>
      ) : null}


      {tab === 'inventory' && canAccessTab(role, 'inventory') ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Stock Inventory</h1>
              <p>Manage ingredients, supplies, and stock levels</p>
            </div>
            <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
               <div className="am-report-sel-item">
                  <label>Search Inventory</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                      type="text" 
                      className="am-input" 
                      style={{ paddingLeft: 40, height: 40 }}
                      placeholder="Find an item..."
                      value={inventorySearch}
                      onChange={e => setInventorySearch(e.target.value)}
                    />
                  </div>
               </div>
            </div>
          </header>

          <div className="am-metrics-grid-top">
             <div className="am-metric-card">
                <div className="am-metric-header">TOTAL ITEMS</div>
                <div className="am-metric-value">{ingredients.length}</div>
                <div className="am-metric-trend am-trend-neu">Ingredients tracked</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">HEALTHY</div>
                <div className="am-metric-value">{ingredients.filter(i => i.stock_level >= i.min_threshold).length}</div>
                <div className="am-metric-trend am-trend-pos">Above minimum</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">LOW STOCK</div>
                <div className="am-metric-value">{ingredients.filter(i => i.stock_level < i.min_threshold && i.stock_level > 0).length}</div>
                <div className="am-metric-trend am-trend-neg">Need restocking</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">CRITICAL</div>
                <div className="am-metric-value">{ingredients.filter(i => i.stock_level <= 0).length}</div>
                <div className="am-metric-trend am-trend-neg" style={{ color: '#FF5252' }}>Below zero</div>
             </div>
          </div>

          {!canEdit && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: '#F3E5F5', color: '#6A1B9A', fontSize: 13, fontWeight: 600 }}>
              View only — managers can monitor stock levels. Contact the owner to add or edit ingredients.
            </div>
          )}

          <div className="am-main-grid am-grid-form-list">
            {/* Form Column */}
            {canEdit && (
            <div className="am-category-sales-card" style={{ height: 'fit-content' }}>
             <h3 className="am-card-title">{ingForm.id ? '✏️ Edit Ingredient' : '+ Add Ingredient'}</h3>
               <form 
                 onSubmit={async (e) => {
                   e.preventDefault();
                   try {
                     if (ingForm.id) {
                       await api(`/api/shop/owner/inventory/${ingForm.id}`, { method: 'PUT', body: JSON.stringify(ingForm) });
                     } else {
                       await api('/api/shop/owner/inventory', { method: 'POST', body: JSON.stringify(ingForm) });
                     }
                     setIngForm({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0, buying_price: 0, category: 'General' });
                     await reloadCore();
                   } catch(err) { setError(err.message) }
                 }} 
                 className="stack" 
                 style={{ gap: 20 }}
               >
                  <label className="am-field">
                    <span>Ingredient Name</span>
                    <input className="am-input" value={ingForm.name} onChange={e => setIngForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Whole milk" />
                  </label>
                  <label className="am-field">
                    <span>Stock Level</span>
                    <input className="am-input" type="number" value={ingForm.stock_level} onChange={e => setIngForm(f => ({...f, stock_level: Number(e.target.value)}))} required />
                  </label>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <label className="am-field">
                      <span>Unit</span>
                      <select className="am-input" value={ingForm.unit} onChange={e => setIngForm(f => ({...f, unit: e.target.value}))}>
                        {['ml','g','pcs','l','kg','cups','shots','oz','bags'].map(unitOption => <option key={unitOption} value={unitOption}>{unitOption}</option>)}
                      </select>
                    </label>
                    <label className="am-field">
                      <span>Min Threshold (Warning)</span>
                      <input className="am-input" type="number" value={ingForm.min_threshold} onChange={e => setIngForm(f => ({...f, min_threshold: Number(e.target.value)}))} />
                    </label>
                  </div>
                  <div className="grid-2" style={{ gap: 16 }}>
                    <label className="am-field">
                      <span>Unit Price (RWF)</span>
                      <input className="am-input" type="number" value={ingForm.buying_price} onChange={e => setIngForm(f => ({...f, buying_price: Number(e.target.value)}))} />
                    </label>
                    <label className="am-field">
                      <span>Category</span>
                      <select className="am-input" value={ingForm.category} onChange={e => setIngForm(f => ({...f, category: e.target.value}))}>
                        <option value="General">General</option>
                        <option value="Bakery">Bakery</option>
                      </select>
                    </label>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn success xl flex-1" type="submit" style={{ borderRadius: 12 }}>{ingForm.id ? 'Update' : 'Add Ingredient'}</button>
                    <button 
                      className="btn outline xl" 
                      type="button" 
                      onClick={() => setIngForm({ id: '', name: '', stock_level: 0, unit: 'ml', min_threshold: 0, buying_price: 0, category: 'General' })}
                      style={{ borderRadius: 12 }}
                    >
                      Clear
                    </button>
                  </div>
               </form>
            </div>
            )}

            {/* List Column */}
            <div className="stack" style={{ gap: 24 }}>
               <div className="am-report-control-bar" style={{ padding: '12px 24px', margin: 0 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                     <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
                     <input 
                       className="am-input" 
                       placeholder="Search inventory..." 
                       value={inventorySearch}
                       onChange={e => setInventorySearch(e.target.value)}
                       style={{ background: 'transparent !important', border: 'none !important', paddingLeft: 28 }} 
                     />
                  </div>
               </div>

               <div className="am-filter-pills" style={{ margin: 0 }}>
                  {['ALL', 'General', 'Bakery'].map(f => (
                    <div 
                      key={f} 
                      className={`am-pill ${inventoryCategoryFilter === f ? 'active' : ''}`}
                      onClick={() => setInventoryCategoryFilter(f)}
                    >
                       {f}
                    </div>
                  ))}
               </div>

               {/* Critical Stock Group */}
               {ingredients.filter(i => i.stock_level < i.min_threshold).length > 0 && (
                 <div className="am-category-sales-card">
                    <h3 className="am-card-title" style={{ color: '#FF5252 !important', fontSize: '14px' }}>CRITICAL & LOW STOCK</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                      {ingredients
                        .filter(i => (inventoryCategoryFilter === 'ALL' || i.category === inventoryCategoryFilter) && i.stock_level < i.min_threshold && i.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                        .map(ing => (
                          <div key={ing.id} className="am-metric-card" style={{ border: `1px solid ${ing.stock_level <= 0 ? '#FF5252' : '#FF9800'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <div>
                                <div style={{ fontWeight: 700 }}>{ing.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{ing.unit}</div>
                              </div>
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: ing.stock_level <= 0 ? 'rgba(255,82,82,0.1)' : 'rgba(255,152,0,0.1)', color: ing.stock_level <= 0 ? '#FF5252' : '#FF9800' }}>
                                {ing.stock_level <= 0 ? 'CRITICAL' : 'LOW'}
                              </span>
                            </div>
                            <div style={{ margin: '12px 0' }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: ing.stock_level <= 0 ? '#FF5252' : '#FF9800' }}>{ing.stock_level}</div>
                              <div className="am-prod-bar-bg" style={{ width: '100%', marginTop: 4 }}>
                                <div className="am-prod-bar-fill" style={{ width: `${Math.max(0, Math.min(100, (ing.stock_level / Math.max(1, ing.min_threshold)) * 100))}%`, backgroundColor: ing.stock_level <= 0 ? '#FF5252' : '#FF9800' }}></div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {canEdit && <button className="btn tiny primary" onClick={() => { setIngForm(ing); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️</button>}
                              {canEdit && <button className="btn tiny" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }} onClick={() => deleteIngredient(ing.id)}>🗑️</button>}
                              <button onClick={() => setActionMenu(ing)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9CA3AF', padding: '2px 6px' }}>⋮</button>
                            </div>
                          </div>
                        ))}
                    </div>
                 </div>
               )}

               {/* Healthy Stock Group */}
               <div className="am-category-sales-card">
                  <h3 className="am-card-title" style={{ fontSize: '14px' }}>HEALTHY STOCK</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {ingredients
                      .filter(i => i.stock_level >= i.min_threshold && i.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                      .map(ing => (
                        <div key={ing.id} className="am-metric-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{ing.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{ing.unit}</div>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: 'rgba(76,175,80,0.1)', color: '#1D3557' }}>HEALTHY</span>
                          </div>
                          <div style={{ margin: '12px 0' }}>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>{ing.stock_level}</div>
                            <div className="am-prod-bar-bg" style={{ width: '100%', marginTop: 4 }}>
                              <div className="am-prod-bar-fill" style={{ width: '100%', backgroundColor: '#1D3557' }}></div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {canEdit && <button className="btn tiny primary" onClick={() => { setIngForm(ing); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️</button>}
                            {canEdit && <button className="btn tiny" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }} onClick={() => deleteIngredient(ing.id)}>🗑️</button>}
                            <button onClick={() => setActionMenu(ing)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9CA3AF', padding: '2px 6px' }}>⋮</button>
                          </div>
                        </div>
                      ))}
                  </div>
               </div>
            </div>
          </div>

           {actionMenu && createPortal(
             <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setActionMenu(null)}>
               <div className="am-animate" style={{ background: '#FFF', padding: 24, borderRadius: 20, width: '90%', maxWidth: 300, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#111827', textAlign: 'center' }}>Manage {actionMenu.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     {canEdit && <button className="btn primary xl" style={{ width: '100%' }} onClick={() => { setIngForm(actionMenu); setActionMenu(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️ Edit Item</button>}
                     <button className="btn xl" style={{ width: '100%', background: '#EDF2F9', color: '#1D3557', borderColor: '#B8CCE4' }} onClick={() => openIngredientHistory(actionMenu)}>📜 Stock History</button>
                     <button className="btn xl" style={{ width: '100%', background: '#E8F5E9', color: '#2E7D32', borderColor: '#A5D6A7' }} onClick={() => openLinkedProducts(actionMenu)}>🔗 Linked Products</button>
                     {canEdit && <button className="btn warn xl" style={{ width: '100%', background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }} onClick={() => deleteIngredient(actionMenu.id)}>🗑️ Delete Item</button>}
                     <button className="btn ghost xl" style={{ width: '100%', marginTop: 8 }} onClick={() => setActionMenu(null)}>Cancel</button>
                  </div>
               </div>
             </div>,
             document.body
           )}

           {/* Product Long-Press Action Menu */}
           {productActionMenu && createPortal(
             <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setProductActionMenu(null)}>
               <div className="am-animate" style={{ background: '#FFF', padding: 24, borderRadius: 20, width: '90%', maxWidth: 300, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#111827', textAlign: 'center' }}>Manage {productActionMenu.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <button className="btn primary xl" style={{ width: '100%' }} onClick={() => { setProductActionMenu(null); editMenu(productActionMenu); setShowMenuForm(true); setTimeout(() => document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>✏️ Edit Product</button>
                     <button className="btn xl" style={{ width: '100%', background: '#EDF2F9', color: '#1D3557', borderColor: '#B8CCE4' }} onClick={() => openProductHistory(productActionMenu)}>📜 Stock History</button>
                     {canEdit && <button className="btn warn xl" style={{ width: '100%', background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }} onClick={() => deleteProduct(productActionMenu.id)}>🗑️ Delete Product</button>}
                     <button className="btn ghost xl" style={{ width: '100%', marginTop: 8 }} onClick={() => setProductActionMenu(null)}>Cancel</button>
                  </div>
               </div>
             </div>,
             document.body
           )}

           {/* Linked Products Modal */}
           {linkedProducts && createPortal(
             <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setLinkedProducts(null)}>
               <div className="am-animate" style={{ background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>🔗 Products Using {linkedProducts.ingredient?.name}</h3>
                     <button onClick={() => setLinkedProducts(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
                  </div>
                  <div style={{ padding: 20, overflowY: 'auto' }}>
                     {linkedProducts.products.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6B7280', padding: '24px 0' }}>No products use this ingredient.</p>
                     ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                           {linkedProducts.products.map(p => (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                 <div>
                                    <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{p.name}</div>
                                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.category} · {Number(p.price).toLocaleString()} RWF</div>
                                 </div>
                                 <span className={`badge ${p.available ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                                    {p.available ? 'AVAILABLE' : 'HIDDEN'}
                                 </span>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
             </div>,
             document.body
           )}

        </>
      ) : null}


      {tab === 'audit' && role === 'SHOP_ADMIN' ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Manager Audit Dashboard</h1>
              <p>Verifiable log of activities and stock increases recorded by managers.</p>
            </div>
          </header>
           {/* Manager Additions Audit Section — Owner only */}
           {role === 'SHOP_ADMIN' && (
             <div className="am-category-sales-card" style={{ marginTop: 24 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <div>
                   <h3 className="am-card-title" style={{ margin: 0, fontSize: '18px' }}>Manager Action Audit</h3>
                   <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                     Verifiable log of stock increases and refunds recorded by managers
                   </p>
                 </div>
                 <button
                   type="button"
                   className="btn outline tiny"
                   onClick={reloadManagerAdditions}
                   disabled={managerAdditionsLoading}
                 >
                   {managerAdditionsLoading ? 'Loading...' : '🔄 Refresh Audit'}
                 </button>
               </div>

               <div style={{ overflowX: 'auto' }}>
                 <table className="am-modern-table">
                   <thead>
                     <tr>
                       <th>ITEM</th>
                       <th>TYPE</th>
                       <th>QTY ADDED</th>
                       <th>STOCK BEFORE → AFTER</th>
                       <th>RECORDED BY</th>
                       <th>DATE / TIME</th>
                       <th>NOTES</th>
                     </tr>
                   </thead>
                   <tbody>
                     {managerAdditions.length === 0 ? (
                       <tr>
                         <td colSpan="7" style={{ textAlign: 'center', padding: '32px 0', opacity: 0.5 }}>
                           {managerAdditionsLoading ? 'Loading actions...' : 'No manager actions found in audit logs.'}
                         </td>
                       </tr>
                     ) : (
                       managerAdditions.map(row => {
                         const dateFormatted = new Date(row.createdAt).toLocaleString('en-GB', {
                           day: '2-digit',
                           month: 'short',
                           year: 'numeric',
                           hour: '2-digit',
                           minute: '2-digit',
                           timeZone: 'Africa/Kigali',
                         });
                         return (
                           <tr key={row.id}>
                             <td>
                               <div style={{ fontWeight: 700 }}>{row.itemName}</div>
                               <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{row.itemCategory}</div>
                             </td>
                             <td>
                               <span style={{
                                 padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                 background: row.itemType === 'INGREDIENT' ? 'rgba(76,175,80,0.1)' : 'rgba(33,150,243,0.1)',
                                 color: row.itemType === 'INGREDIENT' ? '#2E7D32' : '#2196F3',
                               }}>
                                 {row.itemType === 'INGREDIENT' ? 'Ingredient' : 'Product'}
                               </span>
                               <span style={{
                                 display: 'inline-block', marginLeft: 6, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                 background: row.movementType === 'REFUND_RESTORE' ? 'rgba(233,30,99,0.1)' : 'rgba(156,39,176,0.1)',
                                 color: row.movementType === 'REFUND_RESTORE' ? '#E91E63' : '#9C27B0'
                               }}>
                                 {row.movementType === 'REFUND_RESTORE' ? 'Refund' : 'Added'}
                               </span>
                             </td>
                             <td style={{ fontWeight: 800, color: row.movementType === 'REFUND_RESTORE' ? '#E91E63' : '#2E7D32' }}>
                               +{row.quantityAdded} {row.unit}
                             </td>
                             <td style={{ fontSize: 13 }}>
                               <span style={{ opacity: 0.6 }}>{row.previousStock ?? 0}</span>
                               <span style={{ margin: '0 8px' }}>→</span>
                               <span style={{ fontWeight: 700 }}>{row.newStock ?? 0}</span>
                             </td>
                             <td>
                               <div style={{ fontWeight: 600 }}>{row.addedBy}</div>
                             </td>
                             <td style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                               {dateFormatted}
                             </td>
                             <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.notes}>
                               {row.notes || <span style={{ opacity: 0.3 }}>N/A</span>}
                             </td>
                           </tr>
                         );
                       })
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
           )}
        </>
      ) : null}

      {tab === 'stock' && canAccessTab(role, 'stock') ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Stock Levels</h1>
              <p>All products & ingredients — tap any row to see full movement history</p>
            </div>
            <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
              <div className="am-report-sel-item">
                <label>Search</label>
                <div style={{ position: 'relative' }}>
                  <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input
                    type="text"
                    className="am-input"
                    style={{ paddingLeft: 40, height: 40 }}
                    placeholder="Search products or ingredients..."
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="am-metrics-grid-top">
            <div className="am-metric-card">
              <div className="am-metric-header">TOTAL ITEMS</div>
              <div className="am-metric-value">{stockItems.length}</div>
              <div className="am-metric-trend am-trend-neu">products + ingredients</div>
            </div>
            <div className="am-metric-card">
              <div className="am-metric-header">HEALTHY</div>
              <div className="am-metric-value">{stockItems.filter(i => getItemStockStatus(i) === 'HEALTHY').length}</div>
              <div className="am-metric-trend am-trend-pos">Above minimum</div>
            </div>
            <div className="am-metric-card">
              <div className="am-metric-header">LOW STOCK</div>
              <div className="am-metric-value">{stockItems.filter(i => getItemStockStatus(i) === 'LOW').length}</div>
              <div className="am-metric-trend am-trend-neg">Need restocking</div>
            </div>
            <div className="am-metric-card">
              <div className="am-metric-header">CRITICAL</div>
              <div className="am-metric-value">{stockItems.filter(i => getItemStockStatus(i) === 'CRITICAL').length}</div>
              <div className="am-metric-trend am-trend-neg" style={{ color: '#FF5252' }}>Out or below zero</div>
            </div>
          </div>

          <div className="am-report-control-bar" style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'LOW', 'HEALTHY'].map(f => (
              <button
                key={f}
                type="button"
                className={`am-pill ${stockFilter === f ? 'active' : ''}`}
                onClick={() => setStockFilter(f)}
              >
                {f === 'ALL' ? 'All Items' : f.charAt(0) + f.slice(1).toLowerCase()}
                {f !== 'ALL' && (
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>
                    ({stockItems.filter(i => getItemStockStatus(i) === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredStockItems.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#6B7280', background: 'var(--admin-card-bg)', borderRadius: 16, border: '1px solid var(--admin-border)' }}>
                {stockFilter === 'ALL' ? 'No stock items found.' : `No ${stockFilter.toLowerCase()} stock items.`}
              </div>
            ) : filteredStockItems.map(item => {
              const status = getItemStockStatus(item)
              const isIng = item.itemType === 'INGREDIENT'
              const ing = isIng ? ingredients.find(i => i.id === item.id) : null
              const menuItem = !isIng ? menu.find(m => m.id === item.id) : null
              return (
                <div
                  key={`${item.itemType}-${item.id}`}
                  style={{
                    background: 'var(--admin-card-bg)',
                    borderRadius: 14,
                    border: `1.5px solid ${ status === 'CRITICAL' ? '#FF5252' : status === 'LOW' ? '#FF9800' : 'var(--admin-border)'}`,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--admin-text)' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{item.category} · {item.unit}</div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                      background: status === 'CRITICAL' ? 'rgba(255,82,82,0.1)' : status === 'LOW' ? 'rgba(255,152,0,0.1)' : 'rgba(76,175,80,0.1)',
                      color: status === 'CRITICAL' ? '#FF5252' : status === 'LOW' ? '#FF9800' : '#1D3557',
                    }}>{status}</span>
                  </div>

                  {/* Stock bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: 'var(--admin-text-muted)' }}>Stock</span>
                      <span style={{ fontWeight: 700, color: status === 'CRITICAL' ? '#FF5252' : status === 'LOW' ? '#FF9800' : '#1D3557' }}>
                        {item.stock} {item.unit}
                      </span>
                    </div>
                    <div style={{ background: '#E5E7EB', borderRadius: 4, height: 6 }}>
                      <div style={{
                        height: 6, borderRadius: 4,
                        width: `${Math.max(4, Math.min(100, item.minThreshold > 0 ? (item.stock / item.minThreshold) * 60 : Math.min(100, item.stock * 2)))}%`,
                        background: status === 'CRITICAL' ? '#FF5252' : status === 'LOW' ? '#FF9800' : '#2E7D32',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 4 }}>Min: {item.minThreshold} {item.unit}</div>
                  </div>

                  {/* Type badge */}
                  <div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: isIng ? 'rgba(76,175,80,0.1)' : 'rgba(33,150,243,0.1)',
                      color: isIng ? '#2E7D32' : '#2196F3',
                    }}>{isIng ? 'Ingredient' : 'Product'}</span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn outline tiny"
                      style={{ flex: 1, minWidth: 70 }}
                      onClick={() => openStockItemHistory(item)}
                    >📜 History</button>

                    {canEdit && isIng && ing && (
                      <button
                        type="button"
                        className="btn tiny primary"
                        style={{ flex: 1, minWidth: 70 }}
                        onClick={() => { setIngForm(ing); setTab('inventory'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >✏️ Edit</button>
                    )}
                    {canEdit && !isIng && menuItem && (
                      <button
                        type="button"
                        className="btn tiny primary"
                        style={{ flex: 1, minWidth: 70 }}
                        onClick={() => { editMenu(menuItem); setShowMenuForm(true); setTab('menu'); setTimeout(() => document.getElementById('menu-form')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                      >✏️ Edit</button>
                    )}
                    {(ownerAccess || isManagerRole(role)) && isIng && (
                      <button
                        type="button"
                        className="btn tiny"
                        style={{ flex: 1, minWidth: 70, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                        onClick={() => deleteIngredient(item.id)}
                      >🗑️ Delete</button>
                    )}
                    {canEdit && !isIng && (
                      <button
                        type="button"
                        className="btn tiny"
                        style={{ flex: 1, minWidth: 70, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                        onClick={() => deleteProduct(item.id)}
                      >🗑️ Delete</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#6B7280' }}>
            Click History on any card to see every stock movement from the beginning.
          </p>
        </>
      ) : null}

      {tab === 'requested_order' && ownerAccess ? (
        <>
          <header className="am-header">
            <div className="am-title">
              <h1>Requested Orders</h1>
              <p>Staff requisitions for ingredients and supplies</p>
            </div>
            <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
               <div className="am-report-sel-item">
                  <label>Search Requisitions</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                      type="text" 
                      className="am-input" 
                      style={{ paddingLeft: 40, height: 40 }}
                      placeholder="Search orders..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
               </div>
            </div>
          </header>

          <div className="am-metrics-grid-top">
             <div className="am-metric-card">
                <div className="am-metric-header">TOTAL REQUESTS</div>
                <div className="am-metric-value">{requestedOrders.length}</div>
                <div className="am-metric-trend am-trend-neu">submitted this week</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">PENDING</div>
                <div className="am-metric-value">{requestedOrders.filter(r => r.status === 'PENDING').length}</div>
                <div className="am-metric-trend am-trend-neg" style={{ color: '#FF9800' }}>awaiting approval</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">APPROVED</div>
                <div className="am-metric-value">{requestedOrders.filter(r => r.status === 'APPROVED').length}</div>
                <div className="am-metric-trend am-trend-pos">ready to order</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">RECEIVED</div>
                <div className="am-metric-value">{requestedOrders.filter(r => r.status === 'RECEIVED').length}</div>
                <div className="am-metric-trend am-trend-pos" style={{ color: '#2196F3' }}>delivered & stocked</div>
             </div>
          </div>

          <div className="stack" style={{ gap: 24, marginTop: 32 }}>
             <div className="am-filter-pills" style={{ margin: 0 }}>
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED'].map(f => (
                  <div 
                    key={f} 
                    className={`am-pill ${reqFilter === f ? 'active' : ''}`}
                    onClick={() => setReqFilter(f)}
                  >
                     {f === 'ALL' && <HiOutlineArchiveBox size={14} />}
                     {f === 'PENDING' && <HiOutlineBell size={14} style={{ color: '#FF9800' }} />}
                     {f === 'APPROVED' && <HiOutlineCheckCircle size={14} style={{ color: '#1D3557' }} />}
                     {f === 'REJECTED' && <HiOutlineExclamationTriangle size={14} style={{ color: '#FF5252' }} />}
                     {f === 'RECEIVED' && <HiOutlineShoppingCart size={14} style={{ color: '#2196F3' }} />}
                     {f}
                  </div>
                ))}
             </div>

             <div className="am-category-sales-card">
                <table className="am-modern-table">
                   <thead>
                      <tr>
                         <th>REQUESTED BY</th>
                         <th>ITEM</th>
                         <th>QTY</th>
                         <th>PRIORITY</th>
                         <th>DATE</th>
                         <th>STATUS</th>
                         <th></th>
                      </tr>
                   </thead>
                   <tbody>
                      {requestedOrders
                        .filter(r => (reqFilter === 'ALL' || r.status === reqFilter) && (
                          r.users?.name?.toLowerCase().includes(reqSearch.toLowerCase()) ||
                          r.requisition_items?.some(i => i.item_name.toLowerCase().includes(reqSearch.toLowerCase()))
                        ))
                        .map(req => {
                           const initials = (req.users?.name || 'Staff').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                           const mainItem = req.requisition_items?.[0] || { item_name: 'Unknown', quantity: 0, unit: '' }
                           
                           return (
                             <tr key={req.id}>
                                <td>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <div className="am-loan-avatar">{initials}</div>
                                      <div>
                                         <div style={{ fontWeight: 700 }}>{req.users?.name || 'Staff'}</div>
                                         <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{req.users?.role || 'Staff'}</div>
                                      </div>
                                   </div>
                                </td>
                                <td>
                                   <div style={{ fontWeight: 700 }}>{mainItem.item_name}</div>
                                   <div style={{ fontSize: 10, color: 'var(--admin-text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {req.notes || 'Routine restock'}
                                   </div>
                                </td>
                                <td style={{ fontWeight: 800 }}>{mainItem.quantity} {mainItem.unit}</td>
                                <td>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                      <span className="am-priority-dot" style={{ background: req.notes?.toLowerCase().includes('urgent') ? '#FF5252' : '#B0B0B0' }}></span>
                                      {req.notes?.toLowerCase().includes('urgent') ? 'Urgent' : 'Normal'}
                                   </div>
                                </td>
                                <td style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{new Date(req.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' })}</td>
                                <td>
                                   <span className="am-status-badge" style={{ 
                                     background: req.status === 'APPROVED' ? 'rgba(76,175,80,0.1)' : (req.status === 'PENDING' ? 'rgba(255,152,0,0.1)' : 'rgba(255,82,82,0.1)'),
                                     color: req.status === 'APPROVED' ? '#1D3557' : (req.status === 'PENDING' ? '#FF9800' : '#FF5252')
                                   }}>
                                     {req.status}
                                   </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                   <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                      {req.status === 'PENDING' && (
                                        <>
                                           <button className="btn success tiny" onClick={() => updateRequestedOrderStatus(req.id, 'APPROVED')}>✅</button>
                                           <button className="btn ghost tiny" onClick={() => updateRequestedOrderStatus(req.id, 'REJECTED')}>❌</button>
                                        </>
                                      )}
                                      {req.status === 'APPROVED' && (
                                         <button className="btn ghost tiny" style={{ color: '#2196F3' }} onClick={() => updateRequestedOrderStatus(req.id, 'RECEIVED')}>📦 Mark Received</button>
                                      )}
                                      <button className="btn ghost tiny">👁️</button>
                                   </div>
                                </td>
                             </tr>
                           )
                        })}
                      {requestedOrders.length === 0 && (
                        <tr>
                           <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>No requests found</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </>
      ) : null}

      {tab === 'eod' && canAccessTab(role, 'eod') ? (
        (() => {
          if (!overview || !dailyRows) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 20 }}>
                <div className="loading-spinner"></div>
                <span>Brewing your report...</span>
              </div>
            )
          }

          // Compute EOD aggregates from existing state
          const eodRevenue = overview?.todayRevenue || 0
          const eodCash = overview?.todayCashSales || 0
          const eodMomo = overview?.todayMomoSales || 0
          const eodPos = overview?.todayPosSales || 0
          const eodProfit = overview?.todayProfit || 0
          const eodOrders = overview?.todayPaidOrdersCount || 0
          const eodCost = eodRevenue - eodProfit

          const activeLoansCount = loans.filter(l => l.status !== 'PAID').length
          const totalOwed = loans.reduce((acc, l) => acc + (Number(l.amount) - Number(l.amount_paid || 0)), 0)

          // Product breakdown from dailyRows
          const productMap = {}
          const catBreakdown = {}
          const hourlyMap = {}
          let totalItemsSold = 0
          const processedOrders = new Set()

          dailyRows.forEach(row => {
            if (row.rawItems && !processedOrders.has(row.orderId)) {
              processedOrders.add(row.orderId)
              row.rawItems.forEach(item => {
                const key = item.name || 'Unknown'
                const cat = item.category || 'Uncategorized'
                const qty = item.qty || 1
                const rev = Number(item.price) * qty
                const cost = Number(item.buying_price || 0) * qty
                totalItemsSold += qty

                if (!productMap[key]) productMap[key] = { name: key, category: cat, qty: 0, revenue: 0, cost: 0 }
                productMap[key].qty += qty
                productMap[key].revenue += rev
                productMap[key].cost += cost

                if (!catBreakdown[cat]) catBreakdown[cat] = { revenue: 0, qty: 0, cost: 0 }
                catBreakdown[cat].revenue += rev
                catBreakdown[cat].qty += qty
                catBreakdown[cat].cost += cost
              })
            }
            // Hourly distribution
            if (row.paidAt) {
              const hr = new Date(row.paidAt).getHours()
              hourlyMap[hr] = (hourlyMap[hr] || 0) + Number(row.amount)
            }
          })

          const allProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
          const paidProducts = allProducts.filter(p => p.revenue > 0)
          const bundledItems = allProducts.filter(p => p.revenue === 0)
          const sortedCategories = Object.entries(catBreakdown).sort((a, b) => b[1].revenue - a[1].revenue)
          const peakHour = Object.entries(hourlyMap).sort((a, b) => b[1] - a[1])[0]

          // Net figures excluding free bundled accompaniments
          const paidRevenue = paidProducts.reduce((s, p) => s + p.revenue, 0)
          const paidCost = paidProducts.reduce((s, p) => s + p.cost, 0)
          const paidProfit = paidRevenue - paidCost
          const bundledCost = bundledItems.reduce((s, p) => s + p.cost, 0)

          const avgOrderValue = eodOrders > 0 ? Math.round(paidRevenue / eodOrders) : 0
          const profitMargin = paidRevenue > 0 ? ((paidProfit / paidRevenue) * 100).toFixed(1) : 0

          // Low stock
          const lowStockItems = ingredients.filter(i => i.stock_level < i.min_threshold)

          const generatePDF = async (mode) => {
    setIsExporting(true)
    try {
      // ── 1. DETERMINE PERIOD DATES ──────────────────────────────
      let title = '', dateRange = '', startStr = '', endStr = ''
      if (mode === 'daily') {
        title = 'Daily Operations Report'
        dateRange = reportDay
        startStr = reportDay
        endStr = reportDay
      } else if (mode === 'weekly') {
        const weekly = await api(`/api/shop/owner/reports/weekly?date=${reportDay}`)
        title = 'Weekly Operations Report'
        startStr = weekly.startDate
        endStr = weekly.endDate
        dateRange = `${weekly.startDate}  →  ${weekly.endDate}`
      } else {
        title = 'Monthly Operations Report'
        const lastDay = new Date(month.year, month.month, 0).getDate()
        startStr = `${month.year}-${String(month.month).padStart(2, '0')}-01`
        endStr   = `${month.year}-${String(month.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        dateRange = `${new Date(startStr).toLocaleDateString('en-GB', { month: 'long' })} ${month.year}`
      }

      // ── 2. FETCH SHIFTS FRESH FROM API (always accurate) ────────
      let shiftsList = []
      if (mode === 'daily') {
        const fetched = await api(`/api/shop/shifts?date=${startStr}`)
        shiftsList = fetched || []
      } else {
        const fetched = await api(`/api/shop/shifts/range?start=${startStr}&end=${endStr}`)
        shiftsList = fetched || []
      }

      // Sum all shift financials
      const agg = {
        initial_cash: 0, initial_momo: 0,
        total_cash_sales: 0, total_momo_sales: 0, total_pos_sales: 0,
        actual_cash_on_hand: 0, actual_momo_on_hand: 0,
        cashout: 0, expenses: 0,
        total_loan_sales: 0, total_loan_repayments: 0,
      }
      shiftsList.forEach(sh => {
        agg.initial_cash        += parseFloat(sh.initial_cash        || 0)
        agg.initial_momo        += parseFloat(sh.initial_momo        || 0)
        agg.total_cash_sales    += parseFloat(sh.total_cash_sales    || 0)
        agg.total_momo_sales    += parseFloat(sh.total_momo_sales    || 0)
        agg.total_pos_sales     += parseFloat(sh.total_pos_sales     || 0)
        agg.actual_cash_on_hand += parseFloat(sh.actual_cash_on_hand || 0)
        agg.actual_momo_on_hand += parseFloat(sh.actual_momo_on_hand || 0)
        agg.cashout             += parseFloat(sh.cashout             || 0)
        agg.expenses            += parseFloat(sh.expenses            || 0)
        agg.total_loan_sales    += parseFloat(sh.total_loan_sales    || 0)
        agg.total_loan_repayments += parseFloat(sh.total_loan_repayments || 0)
      })

      // ── 3. COMPUTE EXPECTED vs ACTUAL ──────────────────────────
      const expectedCash = agg.initial_cash + agg.total_cash_sales - agg.expenses
      const diffCash     = agg.actual_cash_on_hand - expectedCash
      const expectedMomo = agg.initial_momo + agg.total_momo_sales - agg.cashout
      const diffMomo     = agg.actual_momo_on_hand - expectedMomo

      // ── 4. FETCH LOANS FRESH & FILTER BY PERIOD ────────────────
      const isInPeriod = (iso) => {
        if (!iso) return false
        const d = new Date(iso)
        return d >= new Date(`${startStr}T00:00:00+02:00`) &&
               d <= new Date(`${endStr}T23:59:59.999+02:00`)
      }

      let freshLoans = []
      try {
        freshLoans = await api('/api/shop/loans') || []
      } catch {
        freshLoans = loans || []
      }

      const loansIssued  = []
      const loansRepaid  = []
      let totalIssued = 0, totalRepaid = 0
      freshLoans.forEach(loan => {
        if (isInPeriod(loan.created_at)) {
          loansIssued.push({ name: loan.client_name, amount: Number(loan.amount), status: loan.status })
          totalIssued += Number(loan.amount)
        }
        ;(loan.loan_payments || []).forEach(p => {
          if (isInPeriod(p.paid_at)) {
            loansRepaid.push({ name: loan.client_name, amount: Number(p.amount), method: p.method })
            totalRepaid += Number(p.amount)
          }
        })
      })

      // ── 5. BUILD PDF ───────────────────────────────────────────
      const doc = new jsPDF()
      const f   = (v) => `${Number(v || 0).toLocaleString()} RWF`
      const BLUE  = [29, 53, 87]
      const RED   = [220, 38, 38]
      const GREEN = [22, 163, 74]

      // Track vertical position for sequential layout
      let y = 48
      const newPageIfNeeded = (needed) => {
        if (y + needed > 278) { doc.addPage(); y = 18 }
      }

      // ── HEADER ─────────────────────────────────────────────────
      doc.setFillColor(...BLUE)
      doc.rect(0, 0, 210, 36, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text((context?.name || 'OLITECH COFFEE SHOP').toUpperCase(), 105, 14, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(14)
      doc.text(title, 105, 23, { align: 'center' })
      doc.setFontSize(12)
      doc.text(`Period: ${dateRange}`, 105, 30, { align: 'center' })

      doc.setTextColor(120)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Kigali' })}`, 14, 44)
      doc.text(`Shifts included: ${shiftsList.length}`, 196, 44, { align: 'right' })

      y = 52;

      // ── SECTION 1: MONEY RECONCILIATION ────────────────────────
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('1. MONEY RECONCILIATION', 14, y)
      y += 6

      const reconBody = [
        [{ content: 'CASH', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['Opening Balance',                 f(agg.initial_cash),          ''],
        ['Sales Collected',                 f(agg.total_cash_sales),      ''],
        ['Expenses Paid Out',          `- ${f(agg.expenses)}`,            ''],
        ['Expected Closing',                f(expectedCash),              'System'],
        ['Actual Counted',                  f(agg.actual_cash_on_hand),   'Cashier'],
        ['Variance',                        f(diffCash),                  diffCash === 0 ? '✓ Balanced' : '⚠ MISMATCH'],
        [{ content: 'MOBILE MONEY (MOMO)', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['Opening Balance',                 f(agg.initial_momo),          ''],
        ['Sales Received',                  f(agg.total_momo_sales),      ''],
        ['Transferred to Owner',       `- ${f(agg.cashout)}`,            ''],
        ['Actual Phone Balance',            f(agg.actual_momo_on_hand),   'Cashier'],
        [{ content: 'CARD (POS) & LOANS', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['POS / CARD — Total Sales',        f(agg.total_pos_sales),       ''],
        ['LOANS — Credits Issued',          f(agg.total_loan_sales),      ''],
        ['LOANS — Repayments Received',     f(agg.total_loan_repayments), ''],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount (RWF)', 'Note']],
        body: reconBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 10, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const label = String(data.row.cells[0]?.raw || '')
          
          if (data.row.cells.length === 1) return; // Skip subheaders

          const isVariance = label.includes('Variance')
          const isMismatch = (label.includes('Variance') && diffCash !== 0)
          const isBalanced = (label.includes('Variance') && diffCash === 0)
          
          if (isMismatch) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [255, 240, 240]
          } else if (isBalanced) {
            data.cell.styles.textColor = GREEN
            data.cell.styles.fontStyle = 'bold'
          } else if (label.includes('Expected') || label.includes('Actual') || label.includes('Phone')) {
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })
      y = doc.lastAutoTable.finalY + 12

      // ── SECTION 2: ALL CURRENT STOCK ───────────────────────────
      newPageIfNeeded(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('2. CURRENT STOCK LEVELS', 14, y)
      y += 6

      const stockBody = stockItems.map(item => {
        const status = getItemStockStatus(item)
        return [
          item.name,
          `${item.stock} ${item.unit || 'pcs'}`,
          status,
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [['Name', 'In Stock', 'Status']],
        body: stockBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 10, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 2) return
          const val = String(data.cell.raw || '')
          if (val === 'CRITICAL') {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'LOW') {
            data.cell.styles.textColor = [217, 119, 6]
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'HEALTHY') {
            data.cell.styles.textColor = GREEN
          }
        }
      })
      y = doc.lastAutoTable.finalY + 12

      // ── SECTION 3: LOANS & CREDITS ─────────────────────────────
      newPageIfNeeded(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('3. CREDIT & LOANS ACTIVITY', 14, y)
      y += 6

      const loanSummaryBody = [
        ['New Credits Issued (count)',    String(loansIssued.length),  ''],
        ['Total Amount Issued',           f(totalIssued),              ''],
        ['Repayments Collected (count)',  String(loansRepaid.length),  ''],
        ['Total Amount Repaid',           f(totalRepaid),              ''],
        ['Net Outstanding Change',
          `${totalIssued - totalRepaid >= 0 ? '+' : ''}${f(totalIssued - totalRepaid)}`,
          totalIssued - totalRepaid > 0 ? 'Debt Increased' : totalIssued - totalRepaid < 0 ? 'Debt Reduced' : 'No Change'],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Note']],
        body: loanSummaryBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 10, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const label = String(data.row.cells[0]?.raw || '')
          if (label.includes('Net Outstanding')) {
            const netVal = totalIssued - totalRepaid
            data.cell.styles.fontStyle = 'bold'
            if (netVal > 0) data.cell.styles.textColor = RED
            else if (netVal < 0) data.cell.styles.textColor = GREEN
          }
        }
      })
      y = doc.lastAutoTable.finalY + 8

      // Detailed loans issued (if any)
      if (loansIssued.length > 0) {
        newPageIfNeeded(30)
        y += 2
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(12)
        doc.setTextColor(80)
        doc.text('Credits Issued This Period:', 14, y)
        y += 6
        autoTable(doc, {
          startY: y,
          head: [['Client Name', 'Amount', 'Status']],
          body: loansIssued.map(l => [l.name, f(l.amount), l.status]),
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], fontSize: 10, textColor: 255 },
          styles: { fontSize: 10, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      if (loansRepaid.length > 0) {
        newPageIfNeeded(30)
        y += 2
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(12)
        doc.setTextColor(80)
        doc.text('Repayments Collected This Period:', 14, y)
        y += 6
        autoTable(doc, {
          startY: y,
          head: [['Client Name', 'Amount Paid', 'Method']],
          body: loansRepaid.map(r => [r.name, f(r.amount), r.method]),
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], fontSize: 10, textColor: 255 },
          styles: { fontSize: 10, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }
      doc.save(`Olitech_${mode}_Report_${reportDay}.pdf`)
    } catch (err) {
      console.error(err)
      alert('Failed to generate PDF: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }
  return (
    <>
      <header className="am-header">
        <div className="am-title">
          <h1>End of Day Report</h1>
          <p>Shift-based summary for shifts opened on {new Date(reportDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Kigali' })}</p>
        </div>
        <div className="am-date-picker">
          <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', padding: 6, borderRadius: 12, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
             {['daily', 'weekly', 'monthly'].map(m => (
               <button 
                key={m}
                onClick={() => generatePDF(m)}
                disabled={isExporting}
                className="btn ghost tiny"
                style={{ 
                  textTransform: 'capitalize',
                  background: isExporting ? '#E2E8F0' : 'transparent',
                  color: '#475569',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
               >
                 {isExporting ? '...' : (m + ' PDF')}
               </button>
             ))}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              className="am-input"
              style={{ 
                height: 48, 
                paddingLeft: 44,
                minWidth: 160,
                fontSize: 14,
                fontWeight: 600
              }}
              value={reportDay}
              onChange={e => setReportDay(e.target.value)}
            />
            <span style={{ position: 'absolute', left: 16, color: '#64748B', pointerEvents: 'none' }}>📅</span>
          </div>
        </div>
      </header>

              <div className="am-eod-report">
                {/* ── Current Stock Levels ── */}
                <section className="am-eod-section">
                  <h3 className="am-eod-section-title">Current Stock Levels</h3>
                  <div className="am-eod-table">
                    <div className="am-eod-table-head">
                      <span>Item Name</span>
                      <span>Category</span>
                      <span>In Stock</span>
                      <span>Status</span>
                    </div>
                    {stockItems.map((item, idx) => {
                      const status = getItemStockStatus(item);
                      return (
                        <div key={idx} className="am-eod-table-row">
                          <span className="am-eod-cell-name">
                            {item.name} <span className="am-eod-cell-cat">{item.itemType === 'INGREDIENT' ? 'Ingredient' : 'Product'}</span>
                          </span>
                          <span>{item.category}</span>
                          <span style={{ fontWeight: 600 }}>{item.stock} {item.unit || 'pcs'}</span>
                          <span>
                            <span className={`badge ${status === 'HEALTHY' ? 'badge-success' : status === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                              {status}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                  {/* ── Outstanding Credits ── */}
                  <section className="am-eod-section">
                    <h3 className="am-eod-section-title">Outstanding Credits</h3>
                    <div className="am-eod-grid-3">
                      <div className="am-eod-stat">
                        <span className="am-eod-stat-label">Active Loans</span>
                        <span className="am-eod-stat-value">{activeLoansCount}</span>
                      </div>
                      <div className="am-eod-stat">
                        <span className="am-eod-stat-label">Total Owed</span>
                        <span className="am-eod-stat-value" style={{ color: '#E57373' }}>{Number(totalOwed).toLocaleString()} RWF</span>
                      </div>
                      <div className="am-eod-stat">
                        <span className="am-eod-stat-label">Loan Clients</span>
                        <span className="am-eod-stat-value">{loans.filter(l => l.status !== 'PAID').length}</span>
                      </div>
                    </div>
                  </section>

                {/* ── Cash Reconciliation ── */}
                {shifts.length > 0 && (
                  <section className="am-eod-section">
                    <h3 className="am-eod-section-title">Cash Reconciliation</h3>
                    {shifts.filter(sh => sh.status === 'CLOSED').length === 0 ? (
                      <div className="am-eod-empty">No closed shifts for this date yet</div>
                    ) : (
                      shifts.filter(sh => sh.status === 'CLOSED').map((sh, idx) => {
                        const shiftCashout = parseFloat(sh.cashout) || 0
                        const shiftExpenses = parseFloat(sh.expenses) || 0
                        const initialCash = parseFloat(sh.initial_cash) || 0
                        const initialMomo = parseFloat(sh.initial_momo) || 0
                        const cashSales = parseFloat(sh.total_cash_sales) || 0
                        const momoSales = parseFloat(sh.total_momo_sales) || 0
                        const posSales = parseFloat(sh.total_pos_sales) || 0
                        const actualCash = parseFloat(sh.actual_cash_on_hand) || 0
                        const actualMomo = parseFloat(sh.actual_momo_on_hand) || 0
                        const loanSales = parseFloat(sh.total_loan_sales) || 0
                        const loanRepayments = parseFloat(sh.total_loan_repayments) || 0

                        const expectedCash = initialCash + cashSales - shiftExpenses
                        const expectedMomo = initialMomo + momoSales - shiftCashout

                        const diffCash = actualCash - expectedCash

                        const format = n => Number(n).toLocaleString()

                        const FlowRow = ({ label, value, color = '#E2E8F0', isTotal }) => (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isTotal ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.06)', fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 15 : 13 }}>
                            <span style={{ color: isTotal ? '#F8FAFC' : '#94A3B8' }}>{label}</span>
                            <span style={{ color: isTotal ? '#F8FAFC' : '#CBD5E1', fontFamily: 'monospace' }}>{value} RWF</span>
                          </div>
                        )

                        return (
                          <div key={idx} className="am-eod-reconciliation-block">
                            <div className="am-eod-recon-header">
                              <span className="am-eod-recon-staff">{sh.opened_by_user?.name || 'Cashier'}</span>
                              <span className="am-eod-recon-time">
                                {sh.opened_at ? new Date(sh.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }) : ''}
                                {' → '}
                                {sh.closed_at ? new Date(sh.closed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }) : ''}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
                              {/* ── CASH ── */}
                              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                  <span style={{ fontSize: 18 }}>💵</span>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: '#34D399' }}>Cash</span>
                                </div>
                                <FlowRow label="Opening Balance" value={format(initialCash)} />
                                <FlowRow label="Sales & Repayments" value={`+ ${format(cashSales)}`} />
                                {shiftExpenses > 0 && <FlowRow label="Expenses" value={`- ${format(shiftExpenses)}`} color="#FCA5A5" />}
                                <FlowRow label="Should Remain" value={format(expectedCash)} color="#34D399" isTotal />
                                <FlowRow label="Cashier Counted" value={format(actualCash)} />
                                <FlowRow label="Variance" value={`${diffCash >= 0 ? '+' : ''}${format(diffCash)}`} color={diffCash === 0 ? '#34D399' : diffCash > 0 ? '#60A5FA' : '#F87171'} isTotal />
                              </div>

                              {/* ── MOMO ── */}
                              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 10, padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                  <span style={{ fontSize: 18 }}>📱</span>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: '#38BDF8' }}>MoMo</span>
                                </div>
                                <FlowRow label="Opening Balance" value={format(initialMomo)} />
                                <FlowRow label="Sales / Repayments Received" value={`+ ${format(momoSales)}`} />
                                {shiftCashout > 0 && <FlowRow label="Transferred to Owner" value={`- ${format(shiftCashout)}`} color="#FCA5A5" />}
                                <FlowRow label="Should Remain" value={format(expectedMomo)} color="#38BDF8" isTotal />
                                <FlowRow label="Phone Balance" value={format(actualMomo)} />
                              </div>

                              {/* ── POS / CARD ── */}
                              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 10, padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                  <span style={{ fontSize: 18 }}>💳</span>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: '#A78BFA' }}>POS / Card</span>
                                </div>
                                <FlowRow label="Sales" value={`+ ${format(posSales)}`} />
                                <FlowRow label="Total" value={format(posSales)} color="#A78BFA" isTotal />
                              </div>

                              {/* ── LOANS ── */}
                              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                  <span style={{ fontSize: 18 }}>🤝</span>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: '#F59E0B' }}>Loans</span>
                                </div>
                                <FlowRow label="Loans Issued (Credit out)" value={`${format(loanSales)}`} />
                                <FlowRow label="Loans Repaid (Cash/MoMo in)" value={`${format(loanRepayments)}`} />
                                <FlowRow label="Net Outstanding Change" value={`${loanSales - loanRepayments > 0 ? '+' : ''}${format(loanSales - loanRepayments)}`} color="#F59E0B" isTotal />
                              </div>
                            </div>

                            {sh.notes && (
                              <div className="am-eod-recon-notes">
                                <span className="am-eod-recon-notes-label">Cashier Notes:</span>
                                <p>{sh.notes}</p>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                </section>
                )}

                {/* ── Shifts ── */}
                {shifts.length > 0 && (
                  <section className="am-eod-section">
                    <h3 className="am-eod-section-title">Shift Timeline</h3>
                    <div className="am-eod-table">
                      <div className="am-eod-table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                        <span>Staff</span>
                        <span>Start</span>
                        <span>End</span>
                        <span>Cashout</span>
                        <span>Status</span>
                      </div>
                      {shifts.map((sh, idx) => (
                        <div key={idx} className="am-eod-table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                          <span className="am-eod-cell-name">{sh.opened_by_user?.name || 'Staff'}</span>
                          <span>{sh.opened_at ? new Date(sh.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }) : '-'}</span>
                          <span>{sh.closed_at ? new Date(sh.closed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }) : 'Active'}</span>
                          <span style={{ color: (parseFloat(sh.cashout) || 0) > 0 ? '#FF9800' : '#888', fontWeight: (parseFloat(sh.cashout) || 0) > 0 ? 700 : 400 }}>
                            {(parseFloat(sh.cashout) || 0) > 0 ? `${Number(parseFloat(sh.cashout)).toLocaleString()} RWF` : '—'}
                          </span>
                          <span>
                            <span className={`badge ${sh.status === 'CLOSED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                              {sh.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE'}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Staff Work Performance ── */}
                <section className="am-eod-section">
                  <h3 className="am-eod-section-title" style={{ marginBottom: 16 }}>Staff Work Performance</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {topStaff.map((staffStats, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                            {staffStats.name[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>{staffStats.name}</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>{staffStats.count} orders handled</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
                           <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Total Sales</span>
                           <span style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>{Number(staffStats.amount).toLocaleString()} RWF</span>
                        </div>
                        <div>
                           <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Top Products Sold</div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                             {staffStats.products.slice(0, 3).map((p, i) => (
                               <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                 <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}><strong style={{ color: '#0F172A' }}>{p.qty}x</strong> {p.name}</span>
                                 <span style={{ fontWeight: 600, color: '#1D3557' }}>{Number(p.amount).toLocaleString()} RWF</span>
                               </div>
                             ))}
                             {staffStats.products.length === 0 && <span style={{ fontSize: 11, color: '#94A3B8' }}>No specific products</span>}
                           </div>
                        </div>
                      </div>
                    ))}
                    {topStaff.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: '#94A3B8', background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0' }}>
                         No staff performance data for this date.
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Completed Orders ── */}
                <section className="am-eod-section">
                  <h3 className="am-eod-section-title">Completed Orders</h3>
                  <div className="am-eod-table">
                    <div className="am-eod-table-head" style={{ gridTemplateColumns: '0.8fr 3.5fr 1fr 1fr 1.2fr' }}>
                      <span>Time</span>
                      <span>Items</span>
                      <span>Waiter</span>
                      <span>Method</span>
                      <span>Total Amount</span>
                    </div>
                    {dailyRows.sort((a, b) => new Date(a.at) - new Date(b.at)).map((row, idx) => (
                      <div key={idx} className="am-eod-table-row" style={{ gridTemplateColumns: '0.8fr 3.5fr 1fr 1fr 1.2fr' }}>
                        <span style={{ fontSize: 11, color: '#64748B' }}>
                          {row.at ? new Date(row.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }) : '-'}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.rawItems && row.rawItems.length > 0 ? row.rawItems.map((item, i) => (
                            <span key={i} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: 6, fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                              <strong style={{ color: '#0F172A', marginRight: 4 }}>{item.qty}x</strong>{item.name}
                            </span>
                          )) : (
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>No items</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{row.waiterName || '-'}</span>
                        <span>
                          <span className="am-status-badge" style={{ background: 'rgba(33,150,243,0.1)', color: '#2196F3', fontSize: 10, padding: '4px 8px' }}>
                            {row.methodLabel || 'Cash'}
                          </span>
                        </span>
                        <span style={{ fontWeight: 800, color: '#10B981', fontSize: 13 }}>{Number(row.amount || 0).toLocaleString()} RWF</span>
                      </div>
                    ))}
                    {dailyRows.length === 0 && (
                      <div className="am-eod-empty">No completed orders found for this date.</div>
                    )}
                  </div>
                </section>

                {/* ── Footer ── */}
                <div className="am-eod-footer">
                  <p>Report generated at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })} · {new Date(reportDay).toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' })}</p>
                  <p>Olitech POS · End of Day Summary</p>
                </div>
              </div>
            </>
          )
        })()
      ) : null}

      {tab === 'bakery' && (
        <div className="bakery-hub">
          <header className="am-header">
<div className="am-title">
               <h1>Bakery Management Hub</h1>
               <p>Manage bakery items and record daily production batches</p>
            </div>
            {/* Sub-navigation for Bakery */}
            <div className="am-filter-pills" style={{ margin: 0, background: 'rgba(0,0,0,0.05)', padding: '4px 8px' }}>
              {['PRODUCTION', 'PRODUCTS', 'HISTORY'].map(sub => (
                <div 
                  key={sub} 
                  className={`am-pill ${bakerySubTab === sub ? 'active' : ''}`}
                  onClick={() => setBakerySubTab(sub)}
                  style={{ fontSize: 11, padding: '6px 16px' }}
                >
                  {sub}
                </div>
              ))}
            </div>
          </header>

          {bakerySubTab === 'PRODUCTS' && (
            <div className="am-main-grid am-grid-form-list">
              {/* Summary Header for Products */}
              <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 8 }}>
                <div className="am-category-sales-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: '#E0F2FE', color: '#0369A1', padding: 12, borderRadius: 12 }}>
                    <HiOutlineBanknotes size={24} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Financial Value</p>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0' }}>
                      {menu.filter(m => m.category === 'Bakery & Desserts' || m.category === 'Bakery')
                           .reduce((acc, m) => acc + (Number(m.price || 0) * Number(m.stock_level || 0)), 0)
                           .toLocaleString()} RWF
                    </h2>
                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Expected revenue from current bakery stock</p>
                  </div>
                </div>
              </div>

              {/* Add Bakery Product Form */}
              <div id="bakery-form" className="am-category-sales-card" style={{ height: 'fit-content' }}>
                 <h3 className="am-card-title">{menuForm.id ? "✏️ Edit Bakery Item" : "+ New Multi-Product Recipe"}</h3>
                 <p style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>{menuForm.id ? "Update your recipe and variants." : "Set your standard recipe and the products it produces (e.g. donuts of different sizes)"}</p>
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     try {
                        const mainItemName = menuForm.name;

                        if (menuForm.id) {
                          // ── EDIT MODE: UPDATE existing item ─────────────────
                          await api(`/api/shop/menu/${menuForm.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              name: menuForm.name,
                              price: Number(menuForm.price || 0),
                              recipe_reference_yield: Number(menuForm.recipe_reference_yield || 1),
                              category: 'Bakery',
                              is_recipe: true,
                              is_bakery: true,
                              category_group: menuForm.category_group || mainItemName,
                              available: menuForm.available,
                              recipe: menuForm.productRecipe || []
                            })
                          });
                          setMenuForm({ id: '', name: '', price: '', category: 'Bakery', category_group: '', available: true, productRecipe: [], variantOutputs: [], is_recipe: true, recipe_reference_yield: 81 });
                          await reloadCore();
                          alert(`✅ Recipe "${mainItemName}" updated successfully!`);

                        } else {
                          // ── CREATE MODE: POST new item + variants ────────────
                          // 1. Create the Main Recipe Item
                          const item = await api('/api/shop/menu', { 
                            method: 'POST', 
                            body: JSON.stringify({
                              ...menuForm, 
                              price: Number(menuForm.price || 0),
                              recipe_reference_yield: Number(menuForm.recipe_reference_yield || 1),
                              category: 'Bakery', 
                              is_recipe: true, 
                              is_bakery: true, 
                              category_group: mainItemName
                            }) 
                          });
                         
                          // 2. Create Variants
                          if (menuForm.variantOutputs && menuForm.variantOutputs.length > 0) {
                            for (const v of menuForm.variantOutputs) {
                              await api('/api/shop/menu', {
                                method: 'POST',
                                body: JSON.stringify({
                                  name: v.name,
                                  price: Number(v.price || 0),
                                  category: 'Bakery',
                                  category_group: mainItemName,
                                  available: true,
                                  is_bakery: true,
                                  recipe_reference_yield: Number(v.standard_yield || 0)
                                })
                              });
                            }
                          }

                          // 3. Save Ingredients
                          if (item?.id && menuForm.productRecipe && menuForm.productRecipe.length > 0) {
                            for (const r of menuForm.productRecipe) {
                              if (!r.ingredient_id && !r.component_menu_item_id) continue;
                              await api('/api/shop/owner/recipes', {
                                method: 'POST',
                                body: JSON.stringify({
                                  menu_item_id: item.id,
                                  ingredient_id: r.ingredient_id,
                                  component_menu_item_id: r.component_menu_item_id,
                                  quantity_required: Number(r.quantity_required || 0)
                                })
                              });
                            }
                          }

                          setMenuForm({ id: '', name: '', price: '', category: 'Bakery', category_group: '', available: true, productRecipe: [], variantOutputs: [], is_recipe: true, recipe_reference_yield: 81 });
                          await reloadCore();
                          alert(`🌟 Recipe "${mainItemName}" and its variants created!`);
                        }
                     } catch(err) { alert(err.message) }
                  }} className="stack" style={{ gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                       <label className="am-field">
                         <span>Recipe / Batch Name</span>
                         <input className="am-input" value={menuForm.name} onChange={e => setMenuForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Daily Donut Batch" />
                       </label>
                       <label className="am-field">
                         <span>Base Standard Yield</span>
                         <input className="am-input" type="number" value={menuForm.recipe_reference_yield || 81} onChange={e => setMenuForm(f => ({...f, recipe_reference_yield: Number(e.target.value)}))} required />
                       </label>
                    </div>

                    {/* Produceable Products Section */}
                    <div style={{ padding: '12px', background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0369A1' }}>Items Produced with this Recipe</span>
                          <button type="button" className="btn tiny primary" onClick={() => setMenuForm(f => ({...f, variantOutputs: [...(f.variantOutputs || []), { name: '', price: '', standard_yield: '' }]}))}>+ Add Item</button>
                       </div>
                       <p style={{ fontSize: 10, color: '#0C4A6E', marginBottom: 8 }}>Define the actual products users can buy from this batch</p>
                       
                       <div className="stack" style={{ gap: 8 }}>
                          {menuForm.variantOutputs?.map((v, idx) => (
                             <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input className="am-input tiny" style={{ flex: 2 }} placeholder="Product Name (e.g. Large Donut)" value={v.name} onChange={e => {
                                   const next = [...menuForm.variantOutputs];
                                   next[idx].name = e.target.value;
                                   setMenuForm(f => ({...f, variantOutputs: next}));
                                }} />
                                <input className="am-input tiny" style={{ flex: 1 }} type="number" placeholder="Price" value={v.price} onChange={e => {
                                   const next = [...menuForm.variantOutputs];
                                   next[idx].price = e.target.value;
                                   setMenuForm(f => ({...f, variantOutputs: next}));
                                }} />
                                <input className="am-input tiny" style={{ flex: 1 }} type="number" placeholder="Std Yield" value={v.standard_yield} onChange={e => {
                                   const next = [...menuForm.variantOutputs];
                                   next[idx].standard_yield = e.target.value;
                                   setMenuForm(f => ({...f, variantOutputs: next}));
                                }} />
                                <button type="button" className="btn tiny danger" onClick={() => setMenuForm(f => ({...f, variantOutputs: f.variantOutputs.filter((_, i) => i !== idx)}))}>✕</button>
                             </div>
                          ))}
                          {(!menuForm.variantOutputs || menuForm.variantOutputs.length === 0) && (
                            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748B', padding: '8px 0', fontStyle: 'italic' }}>
                               No specific items added. Will produce the main batch item by default.
                            </div>
                          )}
                       </div>
                    </div>

                    <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
                       <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Standard Amounts (for {menuForm.recipe_reference_yield || 81} units)</span>
                       <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                          <select 
                            className="am-input" 
                            style={{ fontSize: 12 }}
                            onChange={(e) => {
                              const ing = ingredients.find(i => i.id === e.target.value);
                              if (ing && !menuForm.productRecipe?.find(r => r.ingredient_id === ing.id)) {
                                setMenuForm(f => ({
                                  ...f, 
                                  productRecipe: [...(f.productRecipe || []), { 
                                    ingredient_id: ing.id, 
                                    name: ing.name, 
                                    quantity_required: 0
                                  }]
                                }));
                              }
                            }}
                          >
                            <option value="">+ Add Ingredient</option>
                            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                          </select>

                          {menuForm.productRecipe?.map((r, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, flex: 1 }}>{r.name}</span>
                              <input 
                                type="number" 
                                className="am-input" 
                                style={{ width: 80, padding: '4px' }} 
                                value={r.quantity_required}
                                onChange={e => {
                                  const newRecipe = [...menuForm.productRecipe];
                                  newRecipe[idx].quantity_required = Number(e.target.value);
                                  setMenuForm(f => ({...f, productRecipe: newRecipe}));
                                }}
                              />
                            </div>
                          ))}
                       </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn success xl" style={{ flex: 1 }} type="submit">{menuForm.id ? "Update Item" : "Create Item & Set Standard"}</button>
                      {menuForm.id && (
                        <button 
                          className="btn ghost xl" 
                          type="button" 
                          onClick={() => setMenuForm({ id: '', name: '', price: '', category: 'Bakery', category_group: '', available: true, productRecipe: [], variantOutputs: [], is_recipe: true, recipe_reference_yield: 81 })}
                        >Cancel</button>
                      )}
                    </div>
                 </form>
              </div>

              {/* Bakery Catalog List */}
              <div className="am-category-sales-card">
                 <h3 className="am-card-title">Bakery Catalog</h3>
                 <table className="am-modern-table">
                   <thead>
                     <tr>
                       <th>ITEM</th>
                       <th>PRICE</th>
                       <th>RECIPE</th>
                       <th>STOCK</th>
                       <th style={{ textAlign: 'right' }}>VALUE (RWF)</th>
                       <th></th>
                     </tr>
                   </thead>
                   <tbody>
                     {menu.filter(m => m.category === 'Bakery & Desserts' || m.category === 'Bakery').map(m => {
                       const stockVal = Number(m.price || 0) * Number(m.stock_level || 0);
                       return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>
                            {m.name}
                            {m.category_group && <div style={{ fontSize: 9, color: '#64748B', fontWeight: 400 }}>Group: {m.category_group}</div>}
                          </td>
                          <td>{Number(m.price).toLocaleString()}</td>
                          <td style={{ verticalAlign: 'middle' }}>
                            {m.is_recipe ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 4, width: 'fit-content', fontWeight: 800 }}>MADE IN-HOUSE</span>
                                <button className="btn tiny primary" onClick={() => { setTab('menu'); setMenuForm(m); }} style={{ padding: '4px 10px', fontSize: 11 }}>Manage Recipe</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, background: '#F3F4F6', color: '#4B5563', padding: '2px 6px', borderRadius: 4, width: 'fit-content', fontWeight: 800 }}>RESALE ITEM</span>
                                <button className="btn tiny success" onClick={async () => {
                                  try {
                                    await api(`/api/shop/menu/${m.id}`, { method: 'PUT', body: JSON.stringify({ is_recipe: true }) });
                                    await reloadCore();
                                  } catch(err) { alert(err.message) }
                                }} style={{ padding: '4px 10px', fontSize: 11 }}>Enable Production</button>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: m.stock_level < 10 ? '#FF5252' : '#1D3557' }}>
                            {m.stock_level} pcs
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                            {stockVal.toLocaleString()}
                          </td>
                           <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className="btn tiny primary"
                                style={{ padding: '6px 10px' }}
                                onClick={() => { editMenu(m); document.getElementById('bakery-form')?.scrollIntoView({ behavior: 'smooth' }); }}
                              >✏️ Edit</button>
                              {(ownerAccess || isManagerRole(role)) && (
                                <button
                                  className="btn tiny"
                                  style={{ padding: '6px 10px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                                  onClick={() => canEdit && deleteProduct(m.id)}
                                >🗑️</button>
                              )}
                            </div>
                          </td>
                        </tr>
                       )
                     })}
                   </tbody>
                 </table>
              </div>
            </div>
          )}

          {bakerySubTab === 'HISTORY' && (
            <div className="am-category-sales-card">
              <h3 className="am-card-title">Production History</h3>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Review and manage past production batches. Reverting a run will restore ingredient stock and remove produced products.</p>
              
              <div style={{ overflowX: 'auto' }}>
                <table className="am-modern-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>PRODUCT(S)</th>
                      <th>YIELD</th>
                      <th>COST (RWF)</th>
                      <th>NOTES</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bakeryHistory.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No production history found.</td></tr>
                    ) : (
                      bakeryHistory.map(run => (
                        <tr key={run.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{new Date(run.created_at).toLocaleDateString('en-GB')}</div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(run.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{run.menu_items?.name || 'Multi-Product Batch'}</div>
                            {run.production_outputs?.length > 1 && (
                              <div style={{ fontSize: 10, color: '#64748B' }}>
                                {run.production_outputs.map(o => `${o.menu_items?.name} (${o.quantity})`).join(', ')}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 700 }}>{run.actual_yield} units</td>
                          <td>{Number(run.total_cost || 0).toLocaleString()}</td>
                          <td style={{ fontSize: 11, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             {run.notes || run.wastage_notes || '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn tiny"
                              style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '6px 12px' }}
                              onClick={() => canEdit && deleteProduction(run.id)}
                            >🗑️ Revert</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bakerySubTab === 'PRODUCTION' && (
            <div className="am-main-grid" style={{ gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
              {/* Step 1: Selection */}
              <div className="am-category-sales-card" style={{ height: 'fit-content' }}>
                 <h3 className="am-card-title">1. What are we baking?</h3>
                 <div className="stack" style={{ gap: 20 }}>
                    <label className="am-field">
                      <span>Select Item</span>
                      <select 
                        className="am-input" 
                        value={productionForm.menu_item_id} 
                            onChange={async (e) => {
                              const mid = e.target.value;
                              if (!mid) {
                                setProductionForm(f => ({ ...f, menu_item_id: '', recipe_id: '', ingredientsUsed: [], outputs: [] }));
                                return;
                              }
                               const targetItem = menu.find(m => m.id === mid);
                               const recipeData = await api(`/api/shop/owner/recipes/${mid}`);
                               const mi = mid ? menu.find(m => m.id === mid) : null;
                               const recipeItems = Array.isArray(recipeData) ? recipeData : (recipeData?.recipe_items || []);
                               const stdYield = recipeData?.standard_yield || targetItem?.recipe_reference_yield || 1;
                               
                               // Auto-populate related output products in the same group!
                               const variants = menu.filter(m => m.category_group === targetItem.name && m.id !== targetItem.id);
                               const defaultOutputs = variants.length > 0 
                                 ? variants.map(v => ({ menuItemId: v.id, quantity: v.recipe_reference_yield || 0, unitPrice: v.price }))
                                 : [{ menuItemId: targetItem.id, quantity: stdYield, unitPrice: targetItem.price }];

                               setProductionForm(f => ({
                                 ...f,
                                 menu_item_id: mid,
                                 recipe_id: recipeData?.id || '',
                                 batch_size: 1, 
                                 actual_yield: stdYield,
                                 outputs: defaultOutputs,
                                 ingredientsUsed: recipeItems.map(r => {
                                   const baseQty = r.quantity_required || 0;
                                   return {
                                     ingredient_id: r.ingredient_id,
                                     component_menu_item_id: r.component_menu_item_id,
                                     name: r.ingredients?.name || r.component_menu_item?.name || 'Unknown',
                                     unit: r.ingredients?.unit || 'unit',
                                     quantity_used: baseQty,
                                     unit_cost: r.ingredients?.buying_price || r.component_menu_item?.price || 0,
                                     base_recipe_qty: baseQty,
                                     reference_yield: stdYield
                                   };
                                 }),
                                 wastage_notes: ''
                               }));
                            }}
                      >
                        <option value="">-- Select Bakery Item --</option>
                        {menu.filter(m => m.category === 'Bakery & Desserts' || m.category === 'Bakery').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="am-field">
                      <span>Target Yield (Scale Recipe)</span>
                      <p style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Scales base ingredient amounts proportionally</p>
                      <input 
                        className="am-input" 
                        type="number" 
                        value={productionForm.batch_size} 
                        onChange={e => {
                          const newSize = Number(e.target.value);
                          setProductionForm(f => ({
                            ...f,
                            batch_size: newSize,
                            ingredientsUsed: f.ingredientsUsed.map(ing => ({
                              ...ing,
                              quantity_used: ing.base_recipe_qty * (newSize / (ing.reference_yield || 1))
                            })),
                            actual_yield: newSize
                          }));
                        }} 
                      />
                    </label>

                    <div className="am-field" style={{ background: '#F8FAFC', padding: 16, borderRadius: 16, border: '1px solid #E2E8F0', gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ color: '#1D3557', fontWeight: 800, fontSize: 16 }}>Produced Products (Yield)</span>
                        <button 
                          className="btn primary tiny"
                          onClick={() => setProductionForm(f => ({
                            ...f,
                            outputs: [...f.outputs, { menuItemId: '', quantity: 1, unitPrice: 0 }]
                          }))}
                        >+ Add Product</button>
                      </div>
                      
                      <div className="stack" style={{ gap: 8 }}>
                        {productionForm.outputs.map((out, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 40px', gap: 8, alignItems: 'center', background: '#fff', padding: 8, borderRadius: 12, border: '1px solid #EDF2F7' }}>
                            <select 
                              className="am-input tiny"
                              value={out.menuItemId}
                              onChange={e => {
                                const mid = e.target.value;
                                const item = menu.find(m => m.id === mid);
                                setProductionForm(f => {
                                  const next = [...f.outputs];
                                  next[idx] = { ...next[idx], menuItemId: mid, unitPrice: item?.price || 0 };
                                  return { ...f, outputs: next };
                                });
                              }}
                            >
                              <option value="">-- Product --</option>
                              {(() => {
                                const mainItem = menu.find(m => m.id === productionForm.menu_item_id);
                                const bakeryItems = menu.filter(m => m.category === 'Bakery & Desserts' || m.category === 'Bakery');
                                
                                // Smart Filter: Priority to group members or similar names
                                const filtered = bakeryItems.filter(m => {
                                  if (!mainItem) return true;
                                  const belongsToGroup = mainItem.category_group && m.category_group === mainItem.category_group;
                                  const matchesName = m.name.toLowerCase().includes(mainItem.name.toLowerCase().split(' ')[0]);
                                  return belongsToGroup || matchesName;
                                });

                                const list = filtered.length > 0 ? filtered : bakeryItems;

                                return list.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ));
                              })()}
                            </select>
                            <input 
                              type="number" 
                              className="am-input tiny" 
                              placeholder="Qty"
                              value={out.quantity}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setProductionForm(f => {
                                  const next = [...f.outputs];
                                  next[idx] = { ...next[idx], quantity: val };
                                  return { ...f, outputs: next };
                                });
                              }}
                            />
                            <button 
                              className="btn danger tiny"
                              onClick={() => setProductionForm(f => ({
                                ...f,
                                outputs: f.outputs.filter((_, i) => i !== idx)
                              }))}
                              style={{ padding: '4px 8px' }}
                            >✕</button>
                          </div>
                        ))}
                        {productionForm.outputs.length === 0 && (
                          <div style={{ textAlign: 'center', fontSize: 12, color: '#666', padding: '12px 0' }}>Click "Add Product" to record what you produced</div>
                        )}
                      </div>
                    </div>

                      <label className="am-field">
                        <span>General Notes</span>
                        <textarea 
                          className="am-input" 
                          rows="2"
                          value={productionForm.notes} 
                          onChange={e => setProductionForm(f => ({...f, notes: e.target.value}))}
                          placeholder="Event notes..."
                        />
                      </label>
                    </div>

                    <label className="am-field" style={{ background: '#FFF0F0', padding: 12, borderRadius: 12, border: '1px solid #FFD1D1' }}>
                      <span style={{ color: '#D32F2F', fontWeight: 700 }}>Wastage / Loss Notes</span>
                      <p style={{ fontSize: 10, marginBottom: 8, color: '#666' }}>Mention if any product was damaged or lost</p>
                      <input 
                        className="am-input" 
                        value={productionForm.wastage_notes} 
                        onChange={e => setProductionForm(f => ({...f, wastage_notes: e.target.value}))}
                        placeholder="e.g. 5 burnt, 2 dropped"
                      />
                    </label>
                 </div>
              
              {/* Step 2: Recipe Adjustment & Predictor */}
              <div className="am-category-sales-card">
                 <h3 className="am-card-title">2. Ingredients & Prediction</h3>
                 
                 {productionForm.menu_item_id ? (
                   <div className="stack" style={{ gap: 24 }}>
                      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                        <table className="am-modern-table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>INGREDIENT</th>
                              <th>STOCKED</th>
                              <th>QTY TO USE</th>
                              <th style={{ textAlign: 'right' }}>COST (RWF)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(productionForm.ingredientsUsed || []).map((ing, idx) => {
                              const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                              const isLow = ingredient && ingredient.stock_level < ing.quantity_used;
                              const lineCost = (ing.quantity_used || 0) * (ing.unit_cost || 0);
                              
                              return (
                                <tr key={idx} style={{ background: isLow ? '#FFF5F5' : 'transparent' }}>
                                  <td>
                                    <div style={{ fontWeight: 600, color: isLow ? '#D32F2F' : 'inherit' }}>{ing.name}</div>
                                    {isLow && <div style={{ fontSize: 9, color: '#D32F2F', fontWeight: 700 }}>⚠️ INSUFFICIENT STOCK</div>}
                                  </td>
                                  <td>
                                    <div style={{ fontSize: 11, color: '#666' }}>{ingredient?.stock_level || 0} {ing.unit}</div>
                                  </td>
                                  <td style={{ width: 140 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <input 
                                        className={`am-input tiny ${isLow ? 'warn' : ''}`} 
                                        type="number" 
                                        value={ing.quantity_used} 
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setProductionForm(f => {
                                            const next = [...f.ingredientsUsed];
                                            next[idx] = { ...next[idx], quantity_used: val };
                                            return { ...f, ingredientsUsed: next };
                                          });
                                        }}
                                      />
                                      <span style={{ fontSize: 11 }}>{ing.unit}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                     {Math.round(lineCost).toLocaleString()}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Predictor Section */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                         <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Total Production Cost</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#1D3557' }}>
                               {Math.round((productionForm.ingredientsUsed || []).reduce((acc, ing) => acc + (ing.quantity_used * ing.unit_cost), 0)).toLocaleString()} RWF
                            </div>
                         </div>
                         <div style={{ background: '#F0FDF4', padding: 12, borderRadius: 12, border: '1px solid #DCFCE7' }}>
                            <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Estimated Revenue</div>
                             {(() => {
                                const totalRevenue = (productionForm.outputs || []).reduce((acc, out) => acc + (out.quantity * out.unitPrice), 0);
                                return (
                                   <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>
                                      {Math.round(totalRevenue).toLocaleString()} RWF
                                   </div>
                                )
                             })()}
                         </div>
                         <div style={{ background: '#F1F8E9', padding: 12, borderRadius: 12, border: '1px solid #DCEDC8' }}>
                            <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Actual Profit</div>
                            {(() => {
                               const cost = (productionForm.ingredientsUsed || []).reduce((acc, ing) => acc + (ing.quantity_used * ing.unit_cost), 0);
                               const rev = (productionForm.outputs || []).reduce((acc, out) => acc + (out.quantity * out.unitPrice), 0);
                               const profit = rev - cost;
                               return (
                                 <div style={{ fontSize: 18, fontWeight: 800, color: profit >= 0 ? '#1D3557' : '#D32F2F' }}>
                                    {Math.round(profit).toLocaleString()} RWF
                                 </div>
                               )
                            })()}
                         </div>
                         <div style={{ background: '#FFF8E1', padding: 12, borderRadius: 12, border: '1px solid #FFECB3' }}>
                            <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Efficiency</div>
                            {(() => {
                                const menuItem = menu.find(m => m.id === productionForm.menu_item_id);
                                const refYield = menuItem?.recipe_reference_yield || 1;
                                const totalProduced = (productionForm.outputs || []).reduce((acc, out) => acc + Number(out.quantity), 0);
                                const expectedYield = (productionForm.batch_size || 1) * refYield;
                                const efficiency = (totalProduced / (expectedYield || 1)) * 100;
                                return (
                                  <div style={{ fontSize: 18, fontWeight: 800, color: efficiency >= 100 ? '#16A34A' : (efficiency >= 90 ? '#EAB308' : '#D32F2F') }}>
                                     {efficiency.toFixed(1)}%
                                  </div>
                                )
                             })()}
                         </div>
                      </div>

                      <button 
                        className={`btn success xl w-full ${productionLoading ? 'loading' : ''}`} 
                        disabled={productionLoading || !productionForm.menu_item_id}
                        onClick={async () => {
                          const hasLow = (productionForm.ingredientsUsed || []).some(ing => {
                            const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                            return ingredient && ingredient.stock_level < ing.quantity_used;
                          });
                          
                          if (hasLow && !window.confirm('Some ingredients are low in stock. Proceed anyway?')) return;
                          
                          try {
                            setProductionLoading(true);
                            await api('/api/shop/owner/production', { 
                              method: 'POST', 
                              body: JSON.stringify({
                                menuItemId: productionForm.menu_item_id,
                                recipeId: productionForm.recipe_id,
                                batchSize: productionForm.batch_size,
                                ingredientsUsed: productionForm.ingredientsUsed,
                                outputs: productionForm.outputs,
                                wastageNotes: productionForm.wastage_notes,
                                notes: productionForm.notes
                              }) 
                            });
                            const totalProduced = (productionForm.outputs || []).reduce((acc, out) => acc + Number(out.quantity), 0);
                            setProductionForm({ menu_item_id: '', recipe_id: '', batch_size: 1, ingredientsUsed: [], outputs: [], notes: '', actual_yield: 0, wastage_notes: '' });
                            await reloadCore();
                            alert(`🌟 Production successful! ${totalProduced} units added to stock.`);
                          } catch(err) { alert(err.message) }
                          finally { setProductionLoading(false) }
                        }}
                        style={{ borderRadius: 12, height: 60, fontSize: 18, fontWeight: 800 }}
                      >
                        🚀 Complete Production Run
                      </button>
                   </div>
                 ) : (
                   <div style={{ padding: '60px 0', textAlign: 'center', opacity: 0.4 }}>
                      <p>Select an item on the left to begin production</p>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'loans' && canAccessTab(role, 'loans') ? (
        <>
          <header className="am-header">
            <div className="am-title">
               <h1>Client Credits & Loans</h1>
               <p>Track and manage unpaid client bills</p>
            </div>
            <div className="am-report-selectors" style={{ background: 'transparent', padding: 0 }}>
               <div className="am-report-sel-item">
                  <label>Search Clients</label>
                  <div style={{ position: 'relative' }}>
                    <HiOutlineMagnifyingGlass style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                      type="text" 
                      className="am-input" 
                      style={{ paddingLeft: 40, height: 40 }}
                      placeholder="Search clients..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
               </div>
            </div>
          </header>

          <div className="am-metrics-grid-top">
             <div className="am-metric-card">
                <div className="am-metric-header">ACTIVE LOANS</div>
                <div className="am-metric-value">{loans.filter(l => l.status !== 'PAID').length}</div>
                <div className="am-metric-trend am-trend-neu">clients with balance</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">TOTAL OWED</div>
                <div className="am-metric-value">{(loans.reduce((acc, l) => acc + (parseFloat(l.amount) - (l.loan_payments || []).reduce((a,p) => a + parseFloat(p.amount), 0)), 0)).toLocaleString()} RWF</div>
                <div className="am-metric-trend am-trend-neg">outstanding amount</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">TOTAL PAID</div>
                <div className="am-metric-value">{(loans.reduce((acc, l) => acc + (l.loan_payments || []).reduce((a,p) => a + parseFloat(p.amount), 0), 0)).toLocaleString()} RWF</div>
                <div className="am-metric-trend am-trend-pos">collected so far</div>
             </div>
             <div className="am-metric-card">
                <div className="am-metric-header">SETTLED TODAY</div>
                <div className="am-metric-value">{loans.filter(l => l.status === 'PAID' && new Date(l.updated_at).toDateString() === new Date().toDateString()).length}</div>
                <div className="am-metric-trend am-trend-pos">fully paid this session</div>
             </div>
          </div>
            {/* List Group */}
            <div className="stack" style={{ gap: 24 }}>
               <div className="am-filter-pills" style={{ margin: 0 }}>
                  {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map(f => (
                    <div 
                      key={f} 
                      className={`am-pill ${loanFilter === f ? 'active' : ''}`}
                      onClick={() => setLoanFilter(f)}
                    >
                       {f === 'ALL' && <HiOutlineUsers size={14} />}
                       {f === 'UNPAID' && <HiOutlineExclamationTriangle size={14} style={{ color: '#FF5252' }} />}
                       {f === 'PARTIAL' && <HiOutlineArrowTrendingUp size={14} style={{ color: '#FF9800' }} />}
                       {f === 'PAID' && <HiOutlineCheckCircle size={14} style={{ color: '#1D3557' }} />}
                       {f}
                    </div>
                  ))}
               </div>

               <div className="am-category-sales-card">
                  <table className="am-modern-table">
                     <thead>
                        <tr>
                           <th>CLIENT</th>
                           <th>AMOUNT</th>
                           <th>PAID / BALANCE</th>
                           <th>DATE</th>
                           <th>STATUS</th>
                           <th></th>
                        </tr>
                     </thead>
                     <tbody>
                        {loans
                          .filter(l => (loanFilter === 'ALL' || l.status === loanFilter) && l.client_name.toLowerCase().includes(loanSearch.toLowerCase()))
                          .map(loan => {
                             const totalPaid = (loan.loan_payments || []).reduce((acc, p) => acc + parseFloat(p.amount), 0)
                             const balance = parseFloat(loan.amount) - totalPaid
                             const percent = Math.min(100, Math.round((totalPaid / parseFloat(loan.amount)) * 100))
                             const initials = loan.client_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                             
                             return (
                               <tr key={loan.id}>
                                  <td>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="am-loan-avatar">{initials}</div>
                                        <div>
                                           <div style={{ fontWeight: 700 }}>{loan.client_name}</div>
                                           <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{loan.notes || 'No note'}</div>
                                        </div>
                                     </div>
                                  </td>
                                  <td style={{ fontWeight: 700 }}>{Number(loan.amount).toLocaleString()} RWF</td>
                                  <td>
                                     <div style={{ fontSize: 11 }}>
                                        <span style={{ color: '#1D3557', fontWeight: 600 }}>{totalPaid.toLocaleString()} paid</span>
                                        {' · '}
                                        <span style={{ color: balance > 0 ? '#FF9800' : 'var(--admin-text-muted)' }}>{balance.toLocaleString()} left</span>
                                     </div>
                                     <div className="am-loan-bar-bg">
                                        <div 
                                          className="am-loan-bar-fill" 
                                          style={{ 
                                            width: `${percent}%`, 
                                            backgroundColor: percent === 100 ? '#1D3557' : '#FF9800'
                                          }}
                                        ></div>
                                     </div>
                                  </td>
                                  <td style={{ color: 'var(--admin-text-muted)', fontSize: 11 }}>{new Date(loan.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' })}</td>
                                  <td>
                                     <span className="am-status-badge" style={{ 
                                       background: loan.status === 'PAID' ? 'rgba(76,175,80,0.1)' : (loan.status === 'PARTIAL' ? 'rgba(255,152,0,0.1)' : 'rgba(255,82,82,0.1)'),
                                       color: loan.status === 'PAID' ? '#1D3557' : (loan.status === 'PARTIAL' ? '#FF9800' : '#FF5252')
                                     }}>
                                       {loan.status}
                                     </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                     <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        {(ownerAccess || isManagerRole(role)) && loan.status !== 'PAID' && (
                                          <button 
                                            className="btn ghost tiny"
                                            onClick={async () => {
                                              const amt = window.prompt(`Enter payment for ${loan.client_name}:`, balance)
                                              if (!amt) return
                                              try {
                                                await api(`/api/shop/loans/${loan.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: Number(amt), method: 'CASH' }) })
                                                await reloadCore()
                                              } catch(e) { alert(e.message) }
                                            }}
                                          >💸</button>
                                        )}
                                        <button className="btn ghost tiny">👁️</button>
                                     </div>
                                  </td>
                               </tr>
                             )
                          })}
                        {loans.length === 0 && (
                          <tr>
                             <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>No records found</td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
        </>
      ) : null}
      </div>

      {/* ──── Drill-Down Modal (outside scrollable container for mobile) ──── */}
      {showAllOrdersModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowAllOrdersModal(false)}>
          <div className="am-animate" style={{ background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>All Orders — {new Date(reportDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Kigali' })}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>{dailyRows.length} payment{dailyRows.length !== 1 ? 's' : ''} recorded</p>
              </div>
              <button type="button" onClick={() => setShowAllOrdersModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              {dailyRows.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6B7280', padding: '32px 0' }}>No orders recorded for this date.</p>
              ) : (
                <table className="am-modern-table">
                  <thead>
                    <tr>
                      <th>TIME</th>
                      <th>ORDER</th>
                      <th>ITEMS</th>
                      <th>STAFF</th>
                      <th>METHOD</th>
                      <th style={{ textAlign: 'right' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((r, idx) => (
                      <tr key={r.orderId || idx}>
                        <td style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                          {r.at ? new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Kigali' }) : '—'}
                        </td>
                        <td style={{ fontWeight: 600 }}>#{String(r.orderId || idx).slice(0, 8)}</td>
                        <td style={{ fontSize: 13, maxWidth: 280 }}>{r.items || r.rawItems?.map(ri => `${ri.qty || 1}× ${ri.name}`).join(', ') || '—'}</td>
                        <td style={{ fontSize: 13 }}>{r.waiterName || '—'}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                            background: r.methodLabel === 'Cash' ? 'rgba(76,175,80,0.1)' : (r.methodLabel === 'MoMo' ? 'rgba(255,152,0,0.1)' : 'rgba(33,150,243,0.1)'),
                            color: r.methodLabel === 'Cash' ? '#1D3557' : (r.methodLabel === 'MoMo' ? '#FF9800' : '#2196F3'),
                          }}>
                            {(r.methodLabel || '—').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(r.amount || 0).toLocaleString()} RWF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {(stockHistory || ingredientStockHistory) && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setStockHistory(null); setIngredientStockHistory(null) }}>
          {(() => {
            const modal = stockHistory || ingredientStockHistory
            return (
              <div className="am-animate" style={{ background: '#FFF', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>Stock History — {modal.productName}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>All movements from the beginning (oldest first)</p>
                  </div>
                  <button type="button" onClick={() => { setStockHistory(null); setIngredientStockHistory(null) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
                </div>
                <div style={{ padding: 20, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#15803D', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Total In</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>+{modal.summary?.totalPurchased ?? 0}</div>
                    </div>
                    <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#DC2626', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Total Out</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>-{modal.summary?.totalSold ?? 0}</div>
                    </div>
                    <div style={{ background: '#EDF2F9', border: '1px solid #B8CCE4', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#1D3557', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Net Change</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#1D3557', marginTop: 4 }}>{(modal.summary?.totalPurchased ?? 0) - (modal.summary?.totalSold ?? 0)}</div>
                    </div>
                  </div>
                  {!modal.history?.length ? (
                    <p style={{ textAlign: 'center', color: '#6B7280', padding: '24px 0' }}>No stock movements recorded yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {modal.history.map((mv, idx) => (
                        <div key={mv.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                            background: mv.movement_type === 'SALE_DEDUCTION' ? '#FEE2E2' : (mv.movement_type === 'REQUISITION_ADDITION' ? '#EDF2F9' : '#F0FDF4'),
                            color: mv.movement_type === 'SALE_DEDUCTION' ? '#DC2626' : (mv.movement_type === 'REQUISITION_ADDITION' ? '#1D3557' : '#16A34A'),
                          }}>
                            {mv.movement_type === 'SALE_DEDUCTION' ? '−' : '+'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{mv.notes || mv.movement_type.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>{new Date(mv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: mv.movement_type === 'SALE_DEDUCTION' ? '#DC2626' : '#16A34A' }}>
                              {mv.movement_type === 'SALE_DEDUCTION' ? '' : '+'}{mv.quantity} {modal.unit || ''}
                            </div>
                            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{mv.previous_stock ?? '-'} → {mv.new_stock ?? '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>,
        document.body
      )}

      {drilldown && (
        <div className="am-drilldown-overlay" onClick={() => setDrilldown(null)}>
          <div className="am-drilldown-modal" onClick={e => e.stopPropagation()}>
            <div className="am-drilldown-header">
              <h2>{drilldown.title}</h2>
              <button className="am-drilldown-close" onClick={() => setDrilldown(null)}><HiOutlineXMark /></button>
            </div>

            {drilldown.total !== undefined && (
              <div className="am-drilldown-total">{Number(drilldown.total).toLocaleString()} RWF</div>
            )}
            {drilldown.count !== undefined && (
              <div className="am-drilldown-total">{drilldown.count} item{drilldown.count !== 1 ? 's' : ''}</div>
            )}

            {drilldown.items && !drilldown.byCategory && drilldown.type !== 'lowstock' && (
              <div className="am-drilldown-list">
                {drilldown.items.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 32 }}>No data for this period</p>}
                {drilldown.items.map((item, idx) => (
                  <div key={idx} className="am-drilldown-row">
                    <div className="am-drilldown-row-info">
                      <span className="am-drilldown-name">{item.name}</span>
                      <span className="am-drilldown-cat">{item.category}</span>
                    </div>
                    <div className="am-drilldown-row-nums">
                      <span className="am-drilldown-qty">{item.qty}x</span>
                      {item.profit !== undefined ? (
                        <span className="am-drilldown-amount" style={{ color: item.profit >= 0 ? '#1D3557' : '#E57373' }}>
                          {Number(item.profit).toLocaleString()} RWF
                        </span>
                      ) : (
                        <span className="am-drilldown-amount">{Number(item.revenue).toLocaleString()} RWF</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drilldown.type === 'profit' && drilldown.items && (
              <div style={{ fontSize: 11, color: '#6B7280', padding: '8px 16px', borderTop: '1px solid #E5E7EB' }}>
                Revenue: {drilldown.items.reduce((a, i) => a + i.revenue, 0).toLocaleString()} RWF &nbsp;|&nbsp; 
                Cost: {drilldown.items.reduce((a, i) => a + i.cost, 0).toLocaleString()} RWF
              </div>
            )}

            {drilldown.byCategory && (
              <div className="am-drilldown-list">
                {Object.keys(drilldown.byCategory).length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 32 }}>No items</p>}
                {Object.entries(drilldown.byCategory).map(([cat, items]) => (
                  <div key={cat} className="am-drilldown-cat-group">
                    <div className="am-drilldown-cat-header">{cat}</div>
                    {items.map((item, idx) => (
                      <div key={idx} className="am-drilldown-row">
                        <div className="am-drilldown-row-info">
                          <span className="am-drilldown-name">{item.name}</span>
                        </div>
                        <div className="am-drilldown-row-nums">
                          <span className="am-drilldown-qty">{item.qty}x</span>
                          {item.revenue ? <span className="am-drilldown-amount">{Number(item.revenue).toLocaleString()} RWF</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {drilldown.type === 'bakeryToday' && drilldown.stats && (
              <div className="am-drilldown-list">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: '0 16px' }}>
                   <div style={{ background: '#FCE4EC', padding: 16, borderRadius: 12 }}>
                      <div style={{ fontSize: 11, color: '#E91E63', fontWeight: 700 }}>TOTAL COST</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{drilldown.stats.totalCost.toLocaleString()}</div>
                   </div>
                   <div style={{ background: '#E8F5E9', padding: 16, borderRadius: 12 }}>
                      <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 700 }}>TOTAL PROFIT</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{drilldown.stats.totalProfit.toLocaleString()}</div>
                   </div>
                </div>
                {drilldown.stats.productions.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 32 }}>No bakery production recorded today</p>}
                {drilldown.stats.productions.map((p, idx) => (
                  <div key={idx} style={{ marginBottom: 16, padding: '0 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                       <span>{p.recipeName}</span>
                       <span style={{ color: '#666', fontSize: 12 }}>{p.yield} pcs</span>
                    </div>
                    {p.outputs.map((o, oIdx) => (
                      <div key={oIdx} className="am-drilldown-row" style={{ paddingLeft: 12, borderLeft: '2px solid #E91E63' }}>
                        <div className="am-drilldown-row-info">
                          <span className="am-drilldown-name">{o.name}</span>
                          <span className="am-drilldown-cat">{o.price} RWF each</span>
                        </div>
                        <div className="am-drilldown-row-nums">
                          <span className="am-drilldown-qty">{o.qty}x</span>
                          <span className="am-drilldown-amount">{o.revenue.toLocaleString()} RWF</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12, color: '#BDBDBD' }}>
                       Cost: {p.cost.toLocaleString()} RWF | Profit: {p.profit.toLocaleString()} RWF
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

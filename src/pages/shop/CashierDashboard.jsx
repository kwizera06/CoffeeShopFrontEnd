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
  HiOutlinePrinter
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

export default function CashierDashboard() {
  const nav = useNavigate()
  const session = getSession()
  const { role } = session
  const { context, shift, reload: reloadShift, setShift, isShopAdmin } = useShopContext()
  const shopName = context?.name || ''
  const showAdmin = shouldShowAdminDashboard(session, context) || isShopAdmin
  const canManageShift = role === 'CASHIER' || role === 'SHOP_ADMIN' || role === 'MANAGER' || showAdmin

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
  const [pinError, setPinError] = useState('')
  const [qtyById, setQtyById] = useState({})
  const [initialQtyById, setInitialQtyById] = useState({})
  
  const [showCashierAuthPayload, setShowCashierAuthPayload] = useState(null)
  const [cashierAuthPin, setCashierAuthPin] = useState('')
  const [cashierAuthError, setCashierAuthError] = useState('')

  const serviceStaff = useMemo(
    () => staff.filter(s => s.role === 'WAITER' || s.role === 'CASHIER' || s.role === 'MANAGER'),
    [staff],
  )

  // Dynamic Categories from available menu items
  const dynamicCategories = useMemo(() => {
    const cats = new Set(menu.map(m => m.category).filter(Boolean))
    return ['All', ...Array.from(cats)].sort()
  }, [menu])

  const handleWaiterSelect = (waiterId) => {
    if (!waiterId) {
      setSelectedWaiter('')
      return
    }
    const staffMember = serviceStaff.find(s => s.id === waiterId)
    if (staffMember && staffMember.security_key) {
      setPendingWaiterId(waiterId)
      setPinInput('')
      setPinError('')
      setShowPinModal(true)
    } else {
      setSelectedWaiter(waiterId)
    }
  }

  const confirmWaiterPin = (e) => {
    e.preventDefault()
    const staffMember = serviceStaff.find(s => s.id === pendingWaiterId)
    if (staffMember && staffMember.security_key === pinInput.trim()) {
      setSelectedWaiter(pendingWaiterId)
      setShowPinModal(false)
      setPendingWaiterId(null)
    } else {
      setPinError('Incorrect PIN')
      setPinInput('')
    }
  };

  // Billing (Pending & Ready) states
  const [pending, setPending] = useState([])
  const [ready, setReady] = useState([])

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
        totalAmount += Number(p.amount || 0)

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
  }, [tab, historyDate, loadClosedShifts, loadLoans])

  useEffect(() => {
    if (tab === 'history' && selectedShiftId) {
      void loadHistory(selectedShiftId)
    }
  }, [tab, selectedShiftId, loadHistory])

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

  useEffect(() => {
    void loadMenu()
    void loadBilling()
  }, [loadMenu, loadBilling])

  // Real-time subscriptions (Socket.io)
  useEffect(() => {
    const tenantId = getSession().tenantId;
    if (!tenantId) return;

    connectSocket(tenantId);

    const onMenuUpdate = () => { loadMenu().catch(()=>{}) };
    const onStockUpdate = () => { loadMenu().catch(()=>{}) };
    const onStaffUpdate = () => { loadMenu().catch(()=>{}) };
    const onEodUpdate = () => { reloadShift().catch(()=>{}) };
    const onOrderUpdate = (data) => { 
      loadBilling().catch(()=>{})
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

    return () => {
      socket.off('menuUpdate', onMenuUpdate);
      socket.off('stockUpdate', onStockUpdate);
      socket.off('staffUpdate', onStaffUpdate);
      socket.off('eodUpdate', onEodUpdate);
      socket.off('orderUpdate', onOrderUpdate);
    };
  }, [loadMenu, loadBilling, reloadShift])

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
      if (next < initialQty) {
        alert(`Cashiers and waiters cannot reduce quantities below the original ordered amount (${initialQty}).`);
        return;
      }
    }
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

  const kitchenTicketLines = () => cartLines.map(l => ({
    quantity: l.quantity,
    itemName: l.name,
    ingredients: l.ingredients,
  }))

  const waiterLabel = () => staff.find(x => x.id === selectedWaiter)?.name || 'Staff'

  // Checkout (New Order) — printKitchen=false skips kitchen ticket
  async function submitOrder(printKitchen = false) {
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
        if (printKitchen) {
          printKitchenTicket({
            orderId: editId,
            tableNumber: tn,
            shopName,
            lines: kitchenTicketLines(),
            waiterName: waiterLabel(),
          })
        }
        setSearchParams({ tab: 'pending' })
        setQtyById({})
        setInitialQtyById({})
        setTableNumber('1')
      } else {
        const created = await api('/api/shop/orders', {
          method: 'POST',
          body: JSON.stringify({ tableNumber: tn, items: cartLines, waiterId: selectedWaiter, submitToKitchen: printKitchen })
        })
        if (printKitchen) {
          printKitchenTicket({
            orderId: created.id,
            tableNumber: tn,
            shopName,
            lines: kitchenTicketLines(),
            waiterName: waiterLabel(),
          })
        }
        setQtyById({})
        setInitialQtyById({})
        setTableNumber('1')
        setTab('pending')
      }
      await loadBilling()
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Pending Actions
  async function markReady(id) {
    setBusy(true)
    try {
      await api(`/api/shop/orders/${id}/mark-ready`, { method: 'POST' })
      await loadBilling()
      setTab('ready')
    } catch(e) { alert(e.message) }
    finally { setBusy(false) }
  }
  async function handleRevertToPending(id) {
    if (!window.confirm('Revert this order back to the kitchen queue?')) return;
    setBusy(true)
    try {
      await api(`/api/shop/orders/${id}/revert-pending`, { method: 'POST' })
      await loadBilling()
      setTab('pending')
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
  async function payOrder(o, forceAuthorize = false) {
    if ((role === 'WAITER' || role === 'CASHIER') && !forceAuthorize) {
      setShowCashierAuthPayload(o);
      setCashierAuthPin('');
      setCashierAuthError('');
      return;
    }
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

      printReceipt({ 
        shopName, 
        order: paid, 
        paymentMethod: printPayMethod,
        momoName: context?.momoName,
        momoNumber: context?.momoNumber
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
          <span className="cashier-tab-badge blue">{ready.length}</span>
        </button>
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
                <select className="cashier-waiter-sel" value={selectedWaiter} disabled={!!editId} onChange={(e) => handleWaiterSelect(e.target.value)}>
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
                  const isOutOfStock = m.is_recipe === false && m.stock_level <= 0;
                  const hasEnoughStock = m.is_recipe !== false || qty < m.stock_level;

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
                          {isOutOfStock ? 'Empty in Stock' : `${Number(m.price).toLocaleString()} RWF`}
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
                               onClick={() => setQty(l.menuItemId, qtyById[l.menuItemId] - 1)}
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
            <div className="cashier-billing-grid">
              {pending.length === 0 && <p className="muted" style={{padding: 24}}>No pending orders.</p>}
              {pending.map(o => {
                const isChefReady = o.status === 'CHEF_READY'
                const isKitchen = o.locked === true && !isChefReady
                const isDraft = !isKitchen && !isChefReady
                return (
                <div key={o.id} className="cashier-order-card" style={{ borderLeft: isChefReady ? '3px solid #EAB308' : isKitchen ? '3px solid #4ADE80' : '3px solid #60A5FA' }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems: 'flex-start'}}>
                    <div className="table-badge">Table {o.tableNumber}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isChefReady 
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: '#EAB308', background: 'rgba(234,179,8,0.12)', padding: '2px 8px', borderRadius: 20 }}>🔔 READY IN KITCHEN</span>
                        : isKitchen
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: '#4ADE80', background: 'rgba(74,222,128,0.12)', padding: '2px 8px', borderRadius: 20 }}>🍳 IN KITCHEN</span>
                        : <span style={{ fontSize: 10, fontWeight: 800, color: '#60A5FA', background: 'rgba(96,165,250,0.12)', padding: '2px 8px', borderRadius: 20 }}>📋 NO KITCHEN</span>
                      }
                      <div style={{fontSize: 12, color:'#8C9993'}}>{new Date(o.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' })}</div>
                    </div>
                  </div>
                  <div style={{fontSize: 14, color:'#8C9993'}}>Waiter: {o.waiterName}</div>
                  
                  <div style={{background: '#1C1C1C', color: '#E8E8E8', padding: 12, borderRadius: 8, fontSize: 13}}>
                     {o.lines.map((l, i) => (
                       <div key={i} style={{marginBottom: 4, display: 'flex', gap: '8px'}}>
                           <strong style={{color: isChefReady ? '#EAB308' : '#4ADE80'}}>{l.quantity}x</strong> 
                           <span>{l.itemName}</span>
                       </div>
                     ))}
                  </div>

                  <div style={{display: 'flex', gap: 8, marginTop: 'auto'}}>
                     {(isKitchen || isChefReady || isDraft) && (
                       <button className="cashier-btn-close-shift active" style={{flex: 1, padding: 0}} onClick={()=>markReady(o.id)} disabled={busy}>
                         <HiOutlineCheckCircle /> Mark Ready to Pay
                       </button>
                     )}
                     <button title="Print Preview" className="cashier-btn-close-shift" style={{padding: '0 12px', borderColor: '#E6CCB2', color: '#E6CCB2'}} onClick={() => {
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
                        <HiOutlinePrinter />
                     </button>
                     <button className="cashier-btn-close-shift" style={{ flex: (!isKitchen && !isChefReady) ? 1 : undefined, padding: (!isKitchen && !isChefReady) ? undefined : '0 12px' }} onClick={() => setSearchParams({ tab: 'new', edit: o.id })}>
                        <HiOutlinePencilSquare /> {(!isKitchen && !isChefReady) && 'Edit'}
                     </button>
                     {showAdmin && (
                       <button className="cashier-btn-close-shift" style={{padding: '0 12px', color: '#EF4444', borderColor: '#EF4444'}} onClick={() => cancelOrderRequest(o.id)} title="Cancel Order">
                          <HiOutlineTrash />
                       </button>
                     )}
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: '700', color: '#E6CCB2' }}>Billing Option</span>
                    <button 
                      onClick={() => setSplitModes(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                      style={{
                        background: splitModes[o.id] ? '#D90429' : '#1D3557',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: '0.2s'
                      }}
                    >
                      {splitModes[o.id] ? '← Single Payment' : '⇌ Split Payment'}
                    </button>
                  </div>

                  {!splitModes[o.id] ? (
                     <>
                        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                           {['CASH', 'MOBILE_MONEY', 'POS', 'LOAN'].map(m => (
                             <button 
                               key={m} 
                               className={`cashier-cat-pill ${paymentMethods[o.id] === m ? 'active' : ''}`}
                               onClick={()=>setPaymentMethods(prev => ({ ...prev, [o.id]: m }))}
                               style={{ flex: 1, justifyContent: 'center' }}
                             >
                               {m === 'MOBILE_MONEY' ? 'MoMo' : m === 'CASH' ? 'Cash' : m}
                             </button>
                           ))}
                        </div>
                        {paymentMethods[o.id] === 'LOAN' && (
                           <input type="text" placeholder="Client Name" value={clientNames[o.id] || ''} onChange={e=>{
                             const val = e.target.value;
                             setClientNames(prev => ({ ...prev, [o.id]: val }));
                           }} style={{padding: 8, border: '1px solid #3E3E3E', borderRadius: 8, background: '#1C1C1C', color: 'white'}}/>
                        )}
                     </>
                  ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#181818', padding: '10px 12px', borderRadius: 8, border: '1px solid #333' }}>
                        {/* Cash Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                           <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Cash (RWF):</span>
                           <input 
                              type="number" 
                              inputMode="decimal"
                              placeholder="0" 
                              value={splitAmounts[o.id]?.CASH || ''} 
                              onChange={e => handleSplitAmountChange(o.id, 'CASH', e.target.value)}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }}
                           />
                        </div>
                        {/* MoMo Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                           <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>MoMo (RWF):</span>
                           <input 
                              type="number" 
                              inputMode="decimal"
                              placeholder="0" 
                              value={splitAmounts[o.id]?.MOBILE_MONEY || ''} 
                              onChange={e => handleSplitAmountChange(o.id, 'MOBILE_MONEY', e.target.value)}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }}
                           />
                        </div>
                        {/* POS Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                           <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Card/POS:</span>
                           <input 
                              type="number" 
                              inputMode="decimal"
                              placeholder="0" 
                              value={splitAmounts[o.id]?.POS || ''} 
                              onChange={e => handleSplitAmountChange(o.id, 'POS', e.target.value)}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }}
                           />
                        </div>
                        {/* Loan Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                           <span style={{ fontSize: 12, width: '80px', color: '#A0A0A0', fontWeight: 'bold' }}>Loan (RWF):</span>
                           <input 
                              type="number" 
                              inputMode="decimal"
                              placeholder="0" 
                              value={splitAmounts[o.id]?.LOAN || ''} 
                              onChange={e => handleSplitAmountChange(o.id, 'LOAN', e.target.value)}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #333', borderRadius: 6, background: '#111', color: 'white', fontSize: 13, textAlign: 'right' }}
                           />
                        </div>
                        {/* Loan Client Name if Loan amount > 0 */}
                        {parseFloat(splitAmounts[o.id]?.LOAN || 0) > 0 && (
                           <input 
                              type="text" 
                              placeholder="Loan Client Name" 
                              value={clientNames[o.id] || ''} 
                              onChange={e => {
                                 const val = e.target.value;
                                 setClientNames(prev => ({ ...prev, [o.id]: val }));
                              }}
                              style={{ padding: '6px 8px', border: '1px solid #3E3E3E', borderRadius: 6, background: '#111', color: 'white', fontSize: 12, marginTop: 2 }}
                           />
                        )}
                        {/* Live Balance / Remaining Check */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 'bold', borderTop: '1px solid #2A2828', paddingTop: 6, marginTop: 4 }}>
                           <span style={{ color: '#A0A0A0' }}>Sum Entered:</span>
                           <span style={{ color: Math.abs(getSplitTotal(o.id) - o.total) <= 0.05 ? '#4ADE80' : '#FF4D4D' }}>
                              {getSplitTotal(o.id).toLocaleString()} / {Number(o.total).toLocaleString()} RWF
                           </span>
                        </div>
                     </div>
                  )}

                  <div style={{display: 'flex', gap: 8, marginTop: 'auto'}}>
                     <button className="cashier-btn-close-shift" style={{flex: 1, padding: 12, border: '1px solid #E6CCB2', color: '#E6CCB2'}} onClick={() => {
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
                          lines: o.lines.map(l => ({
                            ...l,
                            itemName: l.itemName || l.name,
                          })),
                        }
                        printReceipt({ 
                          shopName, 
                          order: previewOrder, 
                          paymentMethod: printPayMethod,
                          momoName: context?.momoName,
                          momoNumber: context?.momoNumber
                        });
                     }}>
                        Print Preview
                     </button>
                      <button className="cashier-btn-submit active" style={{flex: 1, padding: 12}} onClick={()=>payOrder(o)}>
                         Pay & Print
                      </button>
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

      {showCashierAuthPayload && (
        <div className="cashier-modal-overlay">
          <div className="cashier-modal" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 8 }}>Cashier Authorization</h3>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              A cashier MUST enter their secure PIN to confirm and process this payment.
            </p>
            <form onSubmit={e => {
              e.preventDefault();
              const approver = staff.find(s => (s.role === 'CASHIER' || s.role === 'MANAGER' || s.role === 'SHOP_ADMIN') && s.security_key === cashierAuthPin.trim());
              if (approver) {
                const o = showCashierAuthPayload;
                setShowCashierAuthPayload(null);
                payOrder(o, true);
              } else {
                setCashierAuthError('Invalid Cashier PIN');
                setCashierAuthPin('');
              }
            }}>
              {cashierAuthError && <div style={{ marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{cashierAuthError}</div>}
              <input
                type="password"
                className="cashier-search"
                style={{ fontSize: 24, padding: '12px 16px', textAlign: 'center', letterSpacing: 12, marginBottom: 24, fontWeight: 'bold', width: '100%' }}
                autoFocus
                placeholder="****"
                value={cashierAuthPin}
                onChange={e => { setCashierAuthPin(e.target.value); setCashierAuthError('') }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button type="button" className="cashier-btn-close-shift" onClick={() => { setShowCashierAuthPayload(null); setCashierAuthPin(''); setCashierAuthError(''); }}>Cancel</button>
                <button type="submit" className="cashier-btn-submit active">Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import ShopLayout from './shop/ShopLayout.jsx'
import Supplies from './pages/shop/Supplies.jsx'
import Owner from './pages/shop/Owner.jsx'
import Auditor from './pages/shop/Auditor.jsx'
import Orders from './pages/shop/Orders.jsx'
import Billing from './pages/shop/Billing.jsx'
import ChefDashboard from './pages/shop/ChefDashboard.jsx'
import CashierDashboard from './pages/shop/CashierDashboard.jsx'
import { getSession } from './api'
import './screenshot-ui.css'

function AppIndex() {
  const { role } = getSession()
  if (role === 'SHOP_ADMIN' || role === 'MANAGER') return <Navigate to="admin?tab=overview" replace />
  if (role === 'AUDITOR') return <Navigate to="auditor" replace />
  if (role === 'CHEF') return <Navigate to="chef" replace />
  return <Navigate to="cashier" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminHome />} />

        <Route path="/app" element={<ShopLayout />}>
          <Route index element={<AppIndex />} />
          <Route path="cashier" element={<CashierDashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="billing" element={<Billing />} />
          <Route path="supplies" element={<Supplies />} />
          <Route path="admin" element={<Owner />} />
          <Route path="auditor" element={<Auditor />} />
          <Route path="chef" element={<ChefDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

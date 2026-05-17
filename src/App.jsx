import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import ShopLayout from './shop/ShopLayout.jsx'
import Orders from './pages/shop/Orders.jsx'
import Billing from './pages/shop/Billing.jsx'
import Supplies from './pages/shop/Supplies.jsx'
import Owner from './pages/shop/Owner.jsx'
import { getSession } from './api'
import './screenshot-ui.css'

function AppIndex() {
  const { role } = getSession()
  if (role === 'SHOP_ADMIN') return <Navigate to="admin" replace />
  return <Navigate to="orders" replace />
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
          <Route path="orders" element={<Orders />} />
          <Route path="billing" element={<Billing />} />
          <Route path="supplies" element={<Supplies />} />
          <Route path="admin" element={<Owner />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

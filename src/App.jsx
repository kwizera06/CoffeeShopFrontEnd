import { RouterProvider } from 'react-router-dom'
import { useEffect, useState } from 'react'
import router from './router.jsx'
import { MaintenancePage } from './components/MaintenancePage.jsx'
import { getMaintenanceState } from './api.js'
import './screenshot-ui.css'

/**
 * App Component
 * Uses RouterProvider with createBrowserRouter for better routing support
 * The router configuration is defined in ./router.jsx
 * 
 * Wraps the app with maintenance mode detection to show MaintenancePage
 * when a 503 maintenance response is received
 */
export default function App() {
  const [maintenanceActive, setMaintenanceActive] = useState(false)

  useEffect(() => {
    // Check maintenance state periodically
    const checkInterval = setInterval(() => {
      const state = getMaintenanceState()
      if (state.showPage) {
        setMaintenanceActive(true)
      }
    }, 100)

    return () => clearInterval(checkInterval)
  }, [])

  if (maintenanceActive) {
    return <MaintenancePage onMaintenanceEnd={() => setMaintenanceActive(false)} />
  }

  return <RouterProvider router={router} />
}

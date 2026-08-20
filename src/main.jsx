import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './App.css'
import './print.css'
import App from './App.jsx'

// React Query client with 30-second cache for Supabase egress optimization
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,           // Cache data for 30 seconds
      cacheTime: 300000,          // Keep in memory for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      retry: 1,                   // Only retry failed queries once
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

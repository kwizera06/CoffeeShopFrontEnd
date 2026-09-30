import React, { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'

export function MaintenancePage({ onMaintenanceEnd }) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    // Poll /health every 30 seconds to check if maintenance is over
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/health')
        const data = await res.json()
        
        if (data.maintenance === false) {
          // Maintenance is over, reload the app
          window.location.reload()
        }
      } catch (err) {
        // Silently fail, continue polling
        console.log('Health check in progress...')
      }
    }, 30000)

    return () => clearInterval(pollInterval)
  }, [])

  const handleReload = () => {
    setReloading(true)
    window.location.reload()
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        flexDirection: 'column',
        gap: '2rem'
      }}
    >
      {/* Wrench Icon */}
      <Wrench
        size={80}
        style={{
          color: '#FFD60A',
          strokeWidth: 1.5
        }}
      />

      {/* Title */}
      <h1
        style={{
          color: '#FFD60A',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          margin: 0,
          textAlign: 'center'
        }}
      >
        System under maintenance
      </h1>

      {/* Message */}
      <p
        style={{
          color: '#FFFFFF',
          fontSize: '1.1rem',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '1rem 0 0 0',
          lineHeight: '1.6'
        }}
      >
        We are improving our system. We will be back shortly. Thank you for your patience.
      </p>

      {/* Try Again Button */}
      <button
        onClick={handleReload}
        disabled={reloading}
        style={{
          backgroundColor: '#FFD60A',
          color: '#000000',
          border: 'none',
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          fontWeight: '600',
          borderRadius: '0.5rem',
          cursor: reloading ? 'not-allowed' : 'pointer',
          marginTop: '1rem',
          opacity: reloading ? 0.7 : 1,
          transition: 'opacity 0.2s'
        }}
      >
        {reloading ? 'Reloading...' : 'Try again'}
      </button>

      {/* Loading indicator */}
      <p
        style={{
          color: '#888888',
          fontSize: '0.9rem',
          marginTop: '2rem',
          textAlign: 'center'
        }}
      >
        Auto-checking every 30 seconds...
      </p>
    </div>
  )
}

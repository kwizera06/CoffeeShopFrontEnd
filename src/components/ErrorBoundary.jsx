import { useNavigate } from 'react-router-dom'
import { HiOutlineExclamationTriangle, HiOutlineArrowLeft } from 'react-icons/hi2'

/**
 * ErrorBoundary Component
 * Displays a friendly error page when route errors occur
 */
export default function ErrorBoundary({ error, resetErrorBoundary }) {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f9fafb',
      padding: '24px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <div style={{
          fontSize: '64px',
          color: '#ef4444',
          marginBottom: '24px'
        }}>
          <HiOutlineExclamationTriangle style={{ display: 'inline' }} />
        </div>
        
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '8px'
        }}>
          Oops! Something went wrong
        </h1>
        
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          We encountered an unexpected error. Please try again or return to the dashboard.
        </p>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#991b1b',
            textAlign: 'left',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: '150px'
          }}>
            {error.message}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Page
          </button>
          
          <button
            onClick={() => navigate('/app')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <HiOutlineArrowLeft />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

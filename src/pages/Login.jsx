import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setSession } from '../api'
import { isSupabaseConfigured, supabase } from '../supabaseClient.js'
import olitechLogo from '../assets/Olitech Logo.png'
import './Login.css'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const supabaseOn = isSupabaseConfigured() && supabase

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setSession({
        token: res.token,
        role: res.role,
        tenantId: res.tenantId,
        name: res.name,
        email: res.email,
      })
      navigateByRole(nav, res.role)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSupabaseSignIn(e) {
    e.preventDefault()
    if (!supabaseOn) {
      return
    }
    setError('')
    setBusy(true)
    try {
      const { data, error: sbErr } = await supabase.auth.signInWithPassword({ email, password })
      if (sbErr) {
        throw new Error(sbErr.message)
      }
      const tok = data.session?.access_token
      if (!tok) {
        throw new Error('No Supabase session')
      }
      const me = await api('/api/auth/me', { headers: { Authorization: `Bearer ${tok}` } })
      setSession({
        token: tok,
        role: me.role,
        tenantId: me.tenantId,
        name: me.name,
        email: me.email,
      })
      navigateByRole(nav, me.role)
    } catch (err) {
      setError(err.message || 'Supabase sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page-container">
      <div className="login-card-new">
        {/* LEFT PANEL — IMAGE SIDE */}
        <div className="login-left-panel">
          <div className="login-image-bg"></div>
          <div className="login-overlay"></div>
          <div className="login-left-content">
            <h1>Welcome Back</h1>
            <p className="login-subline">Let's continue brewing success</p>
            <div className="login-divider-thin"></div>
            <div className="login-features">
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                </div>
                <span className="feature-title">Fast Checkout</span>
                <span className="feature-body">Speed up your sales process</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                </div>
                <span className="feature-title">Real-time Reports</span>
                <span className="feature-body">Track your business performance</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <span className="feature-title">Secure & Reliable</span>
                <span className="feature-body">Your data is safe with us</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — LOGIN FORM */}
        <div className="login-right-panel">
          <div className="login-logo-area">
            <div className="login-logo-box"><img src={olitechLogo} alt="Olitech Hub" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
            <div className="login-brand-name-new">
              <span className="brand-olitech">Olitech</span>{' '}
              <span className="brand-hub">Hub</span>
            </div>
            <div className="login-tagline-new">Point of Sale System</div>
            <div className="login-motto">We create. We build. <strong>You grow.</strong></div>
          </div>

          <form className="login-form-new" onSubmit={onSubmit}>
            <div className="login-field-group">
              <label className="login-label">EMAIL ADDRESS</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">PASSWORD</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="login-input-icon-right" 
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="login-error-msg">{error}</div>}

            <button className="login-btn-primary" type="submit" disabled={busy}>
              {busy ? 'Signing In...' : 'Sign In →'}
            </button>

            <div className="login-secure-note">
              🔒 Secure login — Your data is protected.
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function navigateByRole(nav, role) {
  if (role === 'PLATFORM_ADMIN') {
    nav('/admin', { replace: true })
  } else if (role === 'SHOP_ADMIN') {
    nav('/app/admin', { replace: true })
  } else {
    nav('/app/cashier', { replace: true })
  }
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setSession } from '../api'
import { isSupabaseConfigured, supabase } from '../supabaseClient.js'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${tok}` } })
      const bodyText = await meRes.text()
      if (!meRes.ok) {
        let msg = bodyText || meRes.statusText
        try {
          const parsed = JSON.parse(bodyText)
          msg = parsed.error ?? msg
        } catch {
          /* ignore */
        }
        throw new Error(msg || 'Could not load profile')
      }
      const me = JSON.parse(bodyText)
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
    <div className="page login-page">
      <div className="login-card animate-in">
        <div className="login-brand">
          <div className="login-brand-icon">☕</div>
          <div className="login-brand-name">Olitech Coffee</div>
          <div className="login-brand-tagline">Point of Sale System</div>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {supabaseOn ? (
            <button className="btn ghost block" type="button" disabled={busy} onClick={onSupabaseSignIn}
              style={{ color: 'rgba(250,246,239,0.6)', borderColor: 'rgba(250,246,239,0.15)', marginTop: 4 }}>
              Sign in with Supabase
            </button>
          ) : null}
        </form>

        {!supabaseOn ? (
          <p style={{ marginTop: 20, fontSize: 12, color: 'rgba(250,246,239,0.35)', lineHeight: 1.6, textAlign: 'center' }}>
            Set <code style={{ fontFamily: 'monospace', color: 'rgba(250,246,239,0.5)' }}>VITE_SUPABASE_URL</code> &amp; <code style={{ fontFamily: 'monospace', color: 'rgba(250,246,239,0.5)' }}>VITE_SUPABASE_ANON_KEY</code> to enable Supabase sign-in.
          </p>
        ) : (
          <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(250,246,239,0.35)', textAlign: 'center' }}>
            Your Supabase email must match a user in the <code style={{ fontFamily: 'monospace' }}>users</code> table.
          </p>
        )}
      </div>
    </div>
  )
}

function navigateByRole(nav, role) {
  if (role === 'PLATFORM_ADMIN') {
    nav('/admin', { replace: true })
  } else if (role === 'CASHIER') {
    nav('/app/billing', { replace: true })
  } else {
    nav('/app/orders', { replace: true })
  }
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearSession, getSession } from '../../api'
import { supabase } from '../../supabaseClient.js'

export default function AdminHome() {
  const nav = useNavigate()
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  })

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api('/api/admin/stats'), api('/api/admin/tenants')])
      setStats(s)
      setTenants(t)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    const s = getSession()
    if (!s.token || s.role !== 'PLATFORM_ADMIN') {
      nav('/login', { replace: true })
      return
    }

    void load()

    if (!supabase) return
    const channel1 = supabase.channel('admin-tenants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => { load().catch(() => {}) })
      .subscribe()
      
    // Subscribe to orders to update the Lifetime Revenue dynamically
    const channel2 = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { load().catch(() => {}) })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel1)
      void supabase.removeChannel(channel2)
    }
  }, [nav, load])

  async function createShop(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/api/admin/tenants', { method: 'POST', body: JSON.stringify(form) })
      setForm({ shopName: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setTenantStatus(id, status) {
    setError('')
    try {
      await api(`/api/admin/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function resetPassword(id) {
    const pw = window.prompt('New password for shop owner login?')
    if (!pw) {
      return
    }
    setError('')
    try {
      await api(`/api/admin/tenants/${id}/reset-owner-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: pw }),
      })
      alert('Password updated.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function logout() {
    await supabase?.auth.signOut().catch(() => {})
    clearSession()
    nav('/login', { replace: true })
  }

  return (
    <div className="page admin-page">
      <header className="admin-header">
        <div>
          <h1 className="title">Platform admin</h1>
          <p className="muted">{getSession().email}</p>
        </div>
        <button type="button" className="btn ghost" onClick={logout}>
          Log out
        </button>
      </header>

      {stats ? (
        <section className="cards">
          <div className="card">
            <div className="k">Total shops</div>
            <div className="v">{stats.totalTenants}</div>
          </div>
          <div className="card">
            <div className="k">Active shops</div>
            <div className="v">{stats.activeTenants}</div>
          </div>
          <div className="card">
            <div className="k">Lifetime revenue</div>
            <div className="v">{Number(stats.lifetimeRevenue ?? 0).toFixed(2)}</div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Create coffee shop</h2>
        <p className="muted">Creates the tenant and a shop admin user you can sign in with.</p>
        <form onSubmit={createShop} className="grid-form">
          <label className="field">
            <span>Shop name</span>
            <input
              value={form.shopName}
              onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Owner name</span>
            <input
              value={form.ownerName}
              onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Owner email</span>
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Owner password</span>
            <input
              type="password"
              value={form.ownerPassword}
              onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))}
              required
            />
          </label>
          <div className="span-2">
            <button className="btn primary xl" type="submit" disabled={busy}>
              Create shop
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Shops</h2>
        {error ? <div className="error">{error}</div> : null}
        <div className="table admin-table">
          <div className="row head">
            <div>Name</div>
            <div>Owner email</div>
            <div>Status</div>
            <div></div>
          </div>
          {tenants.map((t) => (
            <div key={t.id} className="row">
              <div>{t.name}</div>
              <div>{t.ownerEmail}</div>
              <div>{t.status}</div>
              <div className="row-actions">
                {t.status === 'ACTIVE' ? (
                  <button type="button" className="btn warn" onClick={() => setTenantStatus(t.id, 'SUSPENDED')}>
                    Suspend
                  </button>
                ) : (
                  <button type="button" className="btn good" onClick={() => setTenantStatus(t.id, 'ACTIVE')}>
                    Activate
                  </button>
                )}
                <button type="button" className="btn ghost" onClick={() => resetPassword(t.id)}>
                  Reset password
                </button>
              </div>
            </div>
          ))}
          {tenants.length === 0 ? <div className="muted pad">No shops yet.</div> : null}
        </div>
      </section>
    </div>
  )
}

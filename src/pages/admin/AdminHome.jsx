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
    momoName: '',
    momoNumber: '',
  })
  const [editId, setEditId] = useState(null)

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

  async function saveShop(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (editId) {
        await api(`/api/admin/tenants/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            shopName: form.shopName,
            momoName: form.momoName,
            momoNumber: form.momoNumber,
          }),
        })
        setEditId(null)
      } else {
        await api('/api/admin/tenants', { method: 'POST', body: JSON.stringify(form) })
      }
      setForm({ shopName: '', ownerName: '', ownerEmail: '', ownerPassword: '', momoName: '', momoNumber: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function enterEditMode(t) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setEditId(t.id)
    setForm({
      shopName: t.shopName,
      ownerName: t.ownerName || '', // Not editable but keep form consistent
      ownerEmail: t.ownerEmail || '', 
      ownerPassword: '', // Not editable
      momoName: t.momoName || '',
      momoNumber: t.momoNumber || '',
    })
  }

  function cancelEdit() {
    setEditId(null)
    setForm({ shopName: '', ownerName: '', ownerEmail: '', ownerPassword: '', momoName: '', momoNumber: '' })
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
        <h2>{editId ? 'Edit coffee shop' : 'Create coffee shop'}</h2>
        <p className="muted">
          {editId 
            ? 'Updating shop name or MoMo details. Owner credentials cannot be changed here.' 
            : 'Creates the tenant and a shop admin user you can sign in with.'}
        </p>
        <form onSubmit={saveShop} className="grid-form">
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
          <label className="field" style={{ opacity: editId ? 0.5 : 1 }}>
            <span>Owner email</span>
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => !editId && setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              required
              disabled={!!editId}
            />
          </label>
          <label className="field" style={{ opacity: editId ? 0.5 : 1 }}>
            <span>Owner password</span>
            <input
              type="password"
              value={form.ownerPassword}
              onChange={(e) => !editId && setForm((f) => ({ ...f, ownerPassword: e.target.value }))}
              required={!editId}
              disabled={!!editId}
              placeholder={editId ? '(Stored)' : ''}
            />
          </label>
          <label className="field">
            <span>MoMo name</span>
            <input
              placeholder="e.g. Olitech Hub"
              value={form.momoName}
              onChange={(e) => setForm((f) => ({ ...f, momoName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>MoMo number / Code</span>
            <input
              placeholder="e.g. 0788..."
              value={form.momoNumber}
              onChange={(e) => setForm((f) => ({ ...f, momoNumber: e.target.value }))}
            />
          </label>
          <div className="span-2" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn primary xl" type="submit" disabled={busy}>
              {editId ? 'Update shop' : 'Create shop'}
            </button>
            {editId && (
              <button className="btn ghost xl" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
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
            <div>MoMo details</div>
            <div>Status</div>
            <div></div>
          </div>
          {tenants.map((t) => (
            <div key={t.id} className="row">
              <div>{t.name}</div>
              <div>{t.ownerEmail}</div>
              <div style={{ fontSize: '12px' }}>
                {t.momoName || t.momoNumber ? (
                  <>
                    <div style={{ fontWeight: 'bold' }}>{t.momoName || '—'}</div>
                    <div>{t.momoNumber || '—'}</div>
                  </>
                ) : (
                  <span className="muted">Not set</span>
                )}
              </div>
              <div>{t.status}</div>
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={() => enterEditMode(t)}>
                  Edit
                </button>
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

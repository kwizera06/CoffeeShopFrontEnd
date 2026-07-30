import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearSession, getSession } from '../../api'
import { supabase } from '../../supabaseClient.js'

const ALL_TABS = [
  { key: 'overview',         label: 'Overview' },
  { key: 'menu',             label: 'Menu' },
  { key: 'inventory',        label: 'Inventory' },
  { key: 'bakery',           label: 'Bakery' },
  { key: 'stock',            label: 'Stock Levels' },
  { key: 'loans',            label: 'Loans' },
  { key: 'requested_order',  label: 'Requisitions' },
  { key: 'staff',            label: 'Staff' },
  { key: 'eod',              label: 'EOD Report' },
  { key: 'audit',            label: 'Manager Audit' },
]

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

  // Tab configuration panel
  const [tabConfigId, setTabConfigId] = useState(null)   // tenant id whose panel is open
  const [tabConfigDraft, setTabConfigDraft] = useState({}) // { [tenantId]: Set of enabled tab keys }

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
      await api(`/api/admin/tenants/${id}/reset-password`, {
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

  // ── Tab config helpers ──────────────────────────────────────────
  function openTabConfig(t) {
    // Initialise draft from existing enabledTabs (null = all enabled)
    const current = t.enabledTabs
      ? new Set(t.enabledTabs)
      : new Set(ALL_TABS.map(x => x.key))
    setTabConfigDraft(prev => ({ ...prev, [t.id]: current }))
    setTabConfigId(prev => (prev === t.id ? null : t.id))
  }

  function toggleTabKey(tenantId, key) {
    setTabConfigDraft(prev => {
      const next = new Set(prev[tenantId])
      if (next.has(key)) {
        // Never allow deselecting overview — it's the landing tab
        if (key === 'overview') return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return { ...prev, [tenantId]: next }
    })
  }

  async function saveTabConfig(tenantId) {
    setError('')
    setBusy(true)
    try {
      const draft = tabConfigDraft[tenantId]
      // If all tabs selected → send null (means unrestricted)
      const allSelected = ALL_TABS.every(t => draft.has(t.key))
      const enabledTabs = allSelected ? null : [...draft]
      await api(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabledTabs }),
      })
      setTabConfigId(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
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
            <div key={t.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
              {/* Main tenant row */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>{t.shopName}</div>
                <div style={{ flex: '1 1 180px' }}>{t.ownerEmail}</div>
                <div style={{ fontSize: '12px', flex: '1 1 120px' }}>
                  {t.momoName || t.momoNumber ? (
                    <>
                      <div style={{ fontWeight: 'bold' }}>{t.momoName || '—'}</div>
                      <div>{t.momoNumber || '—'}</div>
                    </>
                  ) : (
                    <span className="muted">Not set</span>
                  )}
                </div>
                <div style={{ flex: '0 0 70px' }}>{t.status}</div>
                <div className="row-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
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
                  <button
                    type="button"
                    className={`btn ${tabConfigId === t.id ? 'primary' : 'ghost'}`}
                    onClick={() => openTabConfig(t)}
                    title="Configure which tabs this shop can see"
                  >
                    {tabConfigId === t.id ? '▲ Tabs' : '⚙ Tabs'}
                  </button>
                </div>
              </div>

              {/* Inline tab configuration panel */}
              {tabConfigId === t.id && tabConfigDraft[t.id] && (
                <div style={{
                  background: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#1D3557' }}>Tab Access — {t.shopName}</strong>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                        Checked tabs are visible to the shop owner. Overview is always required.
                        {!t.enabledTabs && <span style={{ color: '#16A34A', fontWeight: 600 }}> Currently: all tabs enabled.</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ fontSize: 12 }}
                        onClick={() => setTabConfigDraft(prev => ({ ...prev, [t.id]: new Set(ALL_TABS.map(x => x.key)) }))}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ fontSize: 12 }}
                        onClick={() => setTabConfigDraft(prev => ({ ...prev, [t.id]: new Set(['overview']) }))}
                      >
                        Minimal
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '10px 24px',
                  }}>
                    {ALL_TABS.map(tabDef => {
                      const isChecked = tabConfigDraft[t.id].has(tabDef.key)
                      const isLocked = tabDef.key === 'overview'
                      return (
                        <label
                          key={tabDef.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: isLocked ? 'not-allowed' : 'pointer',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: isChecked ? 'rgba(29,53,87,0.06)' : '#fff',
                            border: isChecked ? '1px solid rgba(29,53,87,0.25)' : '1px solid #E5E7EB',
                            transition: 'all 0.15s',
                            opacity: isLocked ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isLocked}
                            onChange={() => toggleTabKey(t.id, tabDef.key)}
                            style={{ width: 16, height: 16, accentColor: '#1D3557', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ fontSize: 13, fontWeight: isChecked ? 700 : 400, color: isChecked ? '#1D3557' : '#6B7280' }}>
                            {tabDef.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => saveTabConfig(t.id)}
                      style={{ minWidth: 120 }}
                    >
                      {busy ? 'Saving…' : 'Save tab access'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setTabConfigId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tenants.length === 0 ? <div className="muted pad">No shops yet.</div> : null}
        </div>
      </section>
    </div>
  )
}

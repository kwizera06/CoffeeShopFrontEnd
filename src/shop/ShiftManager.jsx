import { useState } from 'react'
import { api } from '../api'
import { useShopContext } from './ShopContext'

export default function ShiftManager() {
    const { shift, reload, setShift } = useShopContext()
    const [busy, setBusy] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [initialCash, setInitialCash] = useState('0')
    const [initialMomo, setInitialMomo] = useState('0')
    const [actualCash, setActualCash] = useState('0')
    const [actualMomo, setActualMomo] = useState('0')
    const [notes, setNotes] = useState('')

    async function handleOpen() {
        setBusy(true)
        try {
            await api('/api/shop/shifts/open', {
                method: 'POST',
                body: JSON.stringify({ 
                    initialCash: Number(initialCash),
                    initialMomo: Number(initialMomo)
                })
            })
            setShowModal(false)
            await reload()
        } catch (e) {
            alert(e.message)
        } finally {
            setBusy(false)
        }
    }

    async function handleClose() {
        setBusy(true)
        try {
            await api('/api/shop/shifts/close', {
                method: 'POST',
                body: JSON.stringify({ 
                    actualCash: Number(actualCash), 
                    actualMomo: Number(actualMomo),
                    notes 
                })
            })
            setShowModal(false)
            setShift(null)
            await reload()
        } catch (e) {
            alert(e.message)
        } finally {
            setBusy(false)
        }
    }

    if (!shift) {
        return (
            <div className="shift-bar closed">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="shift-dot" />
                    <span>🔴 Shift CLOSED — you cannot process orders</span>
                </div>
                <button className="btn good" style={{ padding: '6px 18px', fontSize: 13 }} onClick={() => {
                    setInitialCash('0')
                    setInitialMomo('0')
                    setShowModal(true)
                }}>Open Shift</button>

                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-content stack">
                            <h3 style={{ marginBottom: 4 }}>☕ Open New Shift</h3>
                            <p className="muted" style={{ marginBottom: 16 }}>Set your starting cash drawer amount.</p>
                            <label className="field">
                                <span>Initial Cash in Drawer (RWF)</span>
                                <input type="number" value={initialCash} onChange={e => setInitialCash(e.target.value)} />
                            </label>
                            <label className="field">
                                <span>Initial Mobile Money Balance (RWF)</span>
                                <input type="number" value={initialMomo} onChange={e => setInitialMomo(e.target.value)} />
                            </label>
                            <div className="row-actions">
                                <button className="btn good" disabled={busy} onClick={handleOpen}>✅ Confirm Open</button>
                                <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="shift-bar open">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="shift-dot" />
                <span>
                    Shift ACTIVE · Started {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    <span className="muted" style={{ marginLeft: 8, opacity: 0.8, fontWeight: 400 }}>
                        by {shift.opened_by_user?.name || 'Staff'} (Cash: {shift.initial_cash} | MoMo: {shift.initial_momo})
                    </span>
                </span>
            </div>
            <button className="btn warn" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => {
                setActualCash('0')
                setActualMomo('0')
                setShowModal(true)
            }}>Close Shift</button>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content stack">
                        <h3 style={{ marginBottom: 4 }}>🔒 Close Current Shift</h3>
                        <p className="muted" style={{ marginBottom: 16 }}>Auditing and finalizing daily totals.</p>
                        <label className="field">
                            <span>Actual Cash in Drawer (Physical Count)</span>
                            <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} />
                        </label>
                        <label className="field">
                            <span>Actual Mobile Money Balance (Phone Count)</span>
                            <input type="number" value={actualMomo} onChange={e => setActualMomo(e.target.value)} />
                        </label>
                        <label className="field">
                            <span>End of Day Notes</span>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any discrepancies or counts?"></textarea>
                        </label>
                        <div className="row-actions">
                            <button className="btn warn" disabled={busy} onClick={handleClose}>Complete End-of-Day</button>
                            <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

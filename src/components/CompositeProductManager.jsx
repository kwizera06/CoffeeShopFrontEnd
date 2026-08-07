import React, { useState, useEffect } from 'react';
import { HiOutlineTrash, HiOutlinePencil, HiOutlinePlus } from 'react-icons/hi';
import { api } from '../api';

export default function CompositeProductManager({ allMenuItems }) {
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    parentMenuItemId: '',
    name: '',
    components: []
  });

  // Load composites on mount
  useEffect(() => {
    loadComposites();
  }, []);

  // Load all composites
  const loadComposites = async () => {
    setLoading(true);
    try {
      const data = await api('/api/shop/composites');
      setComposites(data || []);
    } catch (err) {
      setError('Failed to load composite products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ parentMenuItemId: '', name: '', components: [] });
    setEditingId(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  // Add component row
  const addComponentRow = () => {
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { componentMenuItemId: '', quantityPerUnit: 1 }]
    }));
  };

  // Remove component row
  const removeComponentRow = (index) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  // Update component
  const updateComponent = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }));
  };

  // Handle parent selection
  const handleParentSelect = (menuItemId) => {
    const selectedItem = allMenuItems.find(m => m.id === menuItemId);
    setFormData(prev => ({
      ...prev,
      parentMenuItemId: menuItemId,
      name: selectedItem?.name || ''
    }));
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.parentMenuItemId) {
      setError('Please select a parent product');
      return;
    }

    if (formData.components.length === 0) {
      setError('Please add at least one component');
      return;
    }

    if (formData.components.some(c => !c.componentMenuItemId || !c.quantityPerUnit)) {
      setError('Please fill all component fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        parentMenuItemId: formData.parentMenuItemId,
        name: formData.name,
        components: formData.components.map(c => ({
          componentMenuItemId: c.componentMenuItemId,
          quantityPerUnit: parseFloat(c.quantityPerUnit)
        }))
      };

      await api('/api/shop/composites', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccess(`Composite "${formData.name}" created successfully!`);
      await loadComposites();
      setTimeout(() => resetForm(), 1500);
    } catch (err) {
      setError('Failed to create composite: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete composite
  const handleDelete = async (compositeId) => {
    if (!window.confirm('Delete this composite product?')) return;

    try {
      setLoading(true);
      await api(`/api/shop/composites/${compositeId}`, { method: 'DELETE' });
      setSuccess('Composite deleted successfully!');
      await loadComposites();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to delete composite: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMenuItemName = (id) => allMenuItems.find(m => m.id === id)?.name || 'Unknown';
  const getMenuItemStock = (id) => allMenuItems.find(m => m.id === id)?.stock_level || 0;

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: '#F0F9FF',
        border: '1px solid #0EA5E9',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#0C4A6E',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          🍗 Composite Products Manager
        </h2>
        <p style={{ fontSize: 13, color: '#0284C7', marginBottom: 16 }}>
          Create products that can be sold whole or in parts. System automatically decomposes wholes when selling parts.
        </p>

        {/* Alerts */}
        {error && (
          <div style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#DCFCE7',
            border: '1px solid #BBF7D0',
            color: '#166534',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13
          }}>
            ✅ {success}
          </div>
        )}

        {/* Create Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 20px',
              background: '#0EA5E9',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <HiOutlinePlus /> Create New Composite
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: '#FFFFFF',
          border: '2px solid #0EA5E9',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 20 }}>
            Create New Composite Product
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Parent Item Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>
                Select Parent Product (Whole Chicken, etc.)
              </label>
              <select
                value={formData.parentMenuItemId}
                onChange={(e) => handleParentSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">-- Select a product --</option>
                {allMenuItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Stock: {item.stock_level || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Components */}
            {formData.parentMenuItemId && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 12 }}>
                  Components (Parts that make up the whole)
                </label>

                {formData.components.map((component, index) => (
                  <div key={index} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 1fr',
                    gap: 12,
                    marginBottom: 12,
                    alignItems: 'end'
                  }}>
                    {/* Component Dropdown */}
                    <select
                      value={component.componentMenuItemId}
                      onChange={(e) => updateComponent(index, 'componentMenuItemId', e.target.value)}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 13,
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Select component --</option>
                      {allMenuItems
                        .filter(item => item.id !== formData.parentMenuItemId)
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>

                    {/* Quantity Input */}
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={component.quantityPerUnit}
                      onChange={(e) => updateComponent(index, 'quantityPerUnit', e.target.value)}
                      placeholder="Qty"
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 13,
                        outline: 'none',
                        textAlign: 'center'
                      }}
                    />

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeComponentRow(index)}
                      style={{
                        padding: '8px 12px',
                        background: '#FEE2E2',
                        color: '#991B1B',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      <HiOutlineTrash /> Remove
                    </button>
                  </div>
                ))}

                {/* Add Component Button */}
                <button
                  type="button"
                  onClick={addComponentRow}
                  style={{
                    padding: '8px 16px',
                    background: '#DBEAFE',
                    color: '#0C4A6E',
                    border: '1px solid #0EA5E9',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  <HiOutlinePlus /> Add Component
                </button>
              </div>
            )}

            {/* Form Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  background: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '✓ Creating...' : '✓ Create Composite'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '10px 24px',
                  background: '#F1F5F9',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Composites List */}
      {composites.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>
            Existing Composite Products ({composites.length})
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: 16
          }}>
            {composites.map(composite => (
              <div key={composite.id} style={{
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {/* Header */}
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1E293B',
                    marginBottom: 4
                  }}>
                    🍗 {composite.parent_menu_item?.name}
                  </h4>
                  <p style={{
                    fontSize: 12,
                    color: '#64748B',
                    marginBottom: 8
                  }}>
                    Stock: {composite.parent_menu_item?.stock_level || 0} units
                  </p>
                </div>

                {/* Components */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: 8
                  }}>
                    Components:
                  </p>
                  {composite.composite_components?.map((comp, idx) => (
                    <div key={idx} style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginLeft: 16,
                      marginBottom: 4
                    }}>
                      • {comp.component_menu_item?.name} (×{comp.quantity_per_unit})
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDelete(composite.id)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: '#FEE2E2',
                      color: '#991B1B',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    <HiOutlineTrash2 /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && composites.length === 0 && !showForm && (
        <div style={{
          background: '#F8FAFC',
          border: '2px dashed #CBD5E1',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#94A3B8'
        }}>
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            No composite products created yet
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 20px',
              background: '#0EA5E9',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Create Your First Composite
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: '#64748B'
        }}>
          ⏳ Loading...
        </div>
      )}
    </div>
  );
}

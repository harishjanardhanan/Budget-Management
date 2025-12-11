import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Recurring() {
    const [recurring, setRecurring] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        type: 'expense',
        amount: '',
        categoryId: '',
        description: '',
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        isPrivate: false
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [recurringRes, categoriesRes] = await Promise.all([
                api.get('/recurring'),
                api.get('/categories')
            ]);
            setRecurring(recurringRes.data.recurringTransactions || []);
            setCategories(categoriesRes.data.categories || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/recurring/${editingId}`, formData);
            } else {
                await api.post('/recurring', formData);
            }
            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error saving recurring transaction:', error);
            alert('Failed to save recurring transaction');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this recurring transaction?')) return;
        try {
            await api.delete(`/recurring/${id}`);
            fetchData();
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const toggleActive = async (id, currentStatus) => {
        try {
            await api.put(`/recurring/${id}`, { isActive: !currentStatus });
            fetchData();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'expense',
            amount: '',
            categoryId: '',
            description: '',
            frequency: 'monthly',
            startDate: new Date().toISOString().split('T')[0],
            isPrivate: false
        });
        setEditingId(null);
    };

    const openEditModal = (item) => {
        setFormData({
            type: item.type,
            amount: item.amount,
            categoryId: item.category_id || '',
            description: item.description || '',
            frequency: item.frequency,
            startDate: item.start_date,
            isPrivate: item.is_private
        });
        setEditingId(item.id);
        setShowModal(true);
    };

    const frequencyLabels = {
        daily: '📅 Daily',
        weekly: '📆 Weekly',
        monthly: '🗓️ Monthly',
        yearly: '📋 Yearly'
    };

    if (loading) {
        return (
            <div className="page container">
                <div className="skeleton" style={{ height: '200px' }}></div>
            </div>
        );
    }

    return (
        <div className="page container animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
                <h1>🔄 Recurring Transactions</h1>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
                    + Add Recurring
                </button>
            </div>

            {recurring.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        No recurring transactions yet. Add your first one!
                    </p>
                </div>
            ) : (
                <div className="grid grid-2">
                    {recurring.map((item) => (
                        <div key={item.id} className="glass-card" style={{ padding: '1.5rem' }}>
                            <div className="flex justify-between items-start mb-md">
                                <div>
                                    <div className="flex items-center gap-sm mb-sm">
                                        <span style={{ fontSize: '1.5rem' }}>{item.category_icon || '💰'}</span>
                                        <h3 style={{ margin: 0 }}>{item.description || 'Recurring Transaction'}</h3>
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                        {frequencyLabels[item.frequency]}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        color: item.type === 'income' ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)}
                                    </div>
                                    <span className={`badge ${item.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                                        {item.type}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-sm mb-md" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                <span>Next: {new Date(item.next_occurrence).toLocaleDateString()}</span>
                                {item.category_name && (
                                    <>
                                        <span>•</span>
                                        <span>{item.category_name}</span>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-sm">
                                <button
                                    onClick={() => toggleActive(item.id, item.is_active)}
                                    className={`btn ${item.is_active ? 'btn-accent' : 'btn-ghost'}`}
                                    style={{ flex: 1, fontSize: '0.875rem' }}
                                >
                                    {item.is_active ? '✓ Active' : '⏸ Paused'}
                                </button>
                                <button onClick={() => openEditModal(item)} className="btn btn-ghost">
                                    ✏️ Edit
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="btn btn-ghost" style={{ color: 'var(--danger)' }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingId ? 'Edit' : 'Add'} Recurring Transaction</h2>
                        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="input-group">
                                <label className="input-label">Type</label>
                                <select
                                    className="input-field"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    required
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-field"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Category</label>
                                <select
                                    className="input-field"
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                >
                                    <option value="">Select Category (Optional)</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Description</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="e.g., Netflix Subscription"
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Frequency</label>
                                <select
                                    className="input-field"
                                    value={formData.frequency}
                                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                                    required
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Start Date</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex gap-md" style={{ marginTop: '1.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {editingId ? 'Update' : 'Create'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

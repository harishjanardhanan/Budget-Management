import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        type: 'expense',
        amount: '',
        categoryId: '',
        description: '',
        transactionDate: new Date().toISOString().split('T')[0],
        isPrivate: false
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [transData, catData] = await Promise.all([
                api.getTransactions(),
                api.getCategories()
            ]);
            setTransactions(transData.transactions);
            setCategories(catData.categories);
        } catch (error) {
            console.error('Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createTransaction({
                ...formData,
                amount: parseFloat(formData.amount),
                categoryId: parseInt(formData.categoryId) || null
            });
            setShowModal(false);
            setFormData({
                type: 'expense',
                amount: '',
                categoryId: '',
                description: '',
                transactionDate: new Date().toISOString().split('T')[0],
                isPrivate: false
            });
            loadData();
        } catch (error) {
            alert('Failed to create transaction');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this transaction?')) {
            try {
                await api.deleteTransaction(id);
                loadData();
            } catch (error) {
                alert('Failed to delete');
            }
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: '400px' }}></div></div>;

    return (
        <div className="page container animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
                <h1>Transactions</h1>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    + Add Transaction
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
                {transactions.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No transactions yet</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {transactions.map((t) => (
                            <div key={t.id} className="flex justify-between items-center" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                                <div className="flex items-center gap-md">
                                    <span style={{ fontSize: '1.5rem' }}>{t.category_icon || '📌'}</span>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{t.description || 'No description'}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {t.category_name} • {new Date(t.transaction_date).toLocaleDateString()}
                                            {t.is_private && <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Private</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-md">
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: t.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                                        {t.type === 'income' ? '+' : '-'}${t.amount}
                                    </div>
                                    <button onClick={() => handleDelete(t.id)} className="btn btn-ghost" style={{ padding: '0.5rem' }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="mb-lg">Add Transaction</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label className="input-label">Type</label>
                                <select className="input-field" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Amount</label>
                                <input type="number" step="0.01" className="input-field" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Category</label>
                                <select className="input-field" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                                    <option value="">Select category</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Description</label>
                                <input type="text" className="input-field" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Date</label>
                                <input type="date" className="input-field" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formData.isPrivate} onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })} />
                                    <span>Mark as private</span>
                                </label>
                            </div>
                            <div className="flex gap-md">
                                <button type="submit" className="btn btn-primary w-full">Save</button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost w-full">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

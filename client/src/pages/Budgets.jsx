import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Budgets() {
    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        categoryId: '',
        amount: '',
        period: 'monthly'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [budgetData, catData] = await Promise.all([
                api.getBudgets(),
                api.getCategories()
            ]);
            setBudgets(budgetData.budgets);
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
            await api.saveBudget({
                ...formData,
                categoryId: parseInt(formData.categoryId),
                amount: parseFloat(formData.amount)
            });
            setShowModal(false);
            setFormData({ categoryId: '', amount: '', period: 'monthly' });
            loadData();
        } catch (error) {
            alert('Failed to save budget');
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: '400px' }}></div></div>;

    return (
        <div className="page container animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
                <h1>Budgets</h1>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    + Set Budget
                </button>
            </div>

            <div className="grid grid-2">
                {budgets.map((budget) => (
                    <div key={budget.id} className="glass-card" style={{ padding: '1.5rem' }}>
                        <div className="flex items-center gap-md mb-md">
                            <span style={{ fontSize: '1.5rem' }}>{budget.category_icon}</span>
                            <div>
                                <div style={{ fontWeight: '600' }}>{budget.category_name}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {budget.period}
                                </div>
                            </div>
                        </div>
                        <div className="mb-md">
                            <div className="flex justify-between mb-sm" style={{ fontSize: '0.875rem' }}>
                                <span>₹{budget.spent.toFixed(2)} spent</span>
                                <span>₹{budget.amount} budget</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${Math.min(budget.percentage, 100)}%` }}></div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`badge ${budget.status === 'exceeded' ? 'badge-danger' : budget.status === 'warning' ? 'badge-warning' : 'badge-success'}`}>
                                {budget.percentage.toFixed(0)}%
                            </span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                ₹{budget.remaining.toFixed(2)} remaining
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="mb-lg">Set Budget</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label className="input-label">Category</label>
                                <select className="input-field" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} required>
                                    <option value="">Select category</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Amount</label>
                                <input type="number" step="0.01" className="input-field" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Period</label>
                                <select className="input-field" value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })}>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
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

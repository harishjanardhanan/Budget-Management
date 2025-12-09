import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Reports() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        loadReport();
    }, [month, year]);

    const loadReport = async () => {
        try {
            const data = await api.getMonthlyReport(year, month);
            setReport(data);
        } catch (error) {
            console.error('Failed to load report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            await api.exportTransactions();
        } catch (error) {
            alert('Failed to export');
        }
    };

    if (loading) return <div className="page container"><div className="skeleton" style={{ height: '400px' }}></div></div>;

    const { summary, categoryBreakdown } = report || {};

    return (
        <div className="page container animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
                <h1>Reports</h1>
                <button onClick={handleExport} className="btn btn-accent">
                    📥 Export CSV
                </button>
            </div>

            <div className="flex gap-md mb-lg" style={{ alignItems: 'center' }}>
                <select className="input-field" value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ width: 'auto' }}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                        </option>
                    ))}
                </select>
                <select className="input-field" value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
                    {Array.from({ length: 5 }, (_, i) => {
                        const y = new Date().getFullYear() - i;
                        return <option key={y} value={y}>{y}</option>;
                    })}
                </select>
            </div>

            <div className="grid grid-3 mb-lg">
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Income</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>
                        ${summary?.totalIncome.toFixed(2) || '0.00'}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Expenses</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>
                        ${summary?.totalExpense.toFixed(2) || '0.00'}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Net</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        ${summary?.balance.toFixed(2) || '0.00'}
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 className="mb-md">Category Breakdown</h3>
                {categoryBreakdown && categoryBreakdown.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {categoryBreakdown.map((cat, idx) => (
                            <div key={idx} style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)' }}>
                                <div className="flex justify-between items-center mb-sm">
                                    <div className="flex items-center gap-md">
                                        <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                                        <span style={{ fontWeight: '600' }}>{cat.name}</span>
                                    </div>
                                    <div style={{ fontWeight: '700', color: cat.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                                        ${parseFloat(cat.total).toFixed(2)}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {cat.count} transactions
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>No data for this period</p>
                )}
            </div>
        </div>
    );
}

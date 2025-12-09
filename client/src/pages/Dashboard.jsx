import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, transactionsData] = await Promise.all([
                api.getTransactionStats(),
                api.getTransactions({ limit: 5 })
            ]);
            setStats(statsData);
            setRecentTransactions(transactionsData.transactions.slice(0, 5));
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page container">
                <div className="skeleton" style={{ height: '200px', marginBottom: '1rem' }}></div>
                <div className="skeleton" style={{ height: '300px' }}></div>
            </div>
        );
    }

    const balance = stats?.balance || 0;
    const income = stats?.totalIncome || 0;
    const expense = stats?.totalExpense || 0;

    return (
        <div className="page container animate-fade-in">
            <h1 className="mb-lg">Dashboard</h1>

            <div className="grid grid-3 mb-lg">
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Total Balance
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        ${balance.toFixed(2)}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Total Income
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>
                        ${income.toFixed(2)}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Total Expenses
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>
                        ${expense.toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 className="mb-md">Recent Transactions</h3>
                {recentTransactions.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No transactions yet. Start tracking your expenses!</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {recentTransactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="flex justify-between items-center"
                                style={{
                                    padding: '1rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <div className="flex items-center gap-md">
                                    <span style={{ fontSize: '1.5rem' }}>{transaction.category_icon || '📌'}</span>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{transaction.description || 'No description'}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {transaction.category_name || 'Uncategorized'} • {new Date(transaction.transaction_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '700',
                                        color: transaction.type === 'income' ? 'var(--success)' : 'var(--danger)'
                                    }}
                                >
                                    {transaction.type === 'income' ? '+' : '-'}${transaction.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

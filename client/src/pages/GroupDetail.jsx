import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function GroupDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [debts, setDebts] = useState([]);
    const [activeTab, setActiveTab] = useState('expenses');
    const [loading, setLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        description: '',
        splits: []
    });
    const [newMemberUsername, setNewMemberUsername] = useState('');

    useEffect(() => {
        fetchGroupData();
    }, [id]);

    const fetchGroupData = async () => {
        try {
            const [groupRes, membersRes, expensesRes, debtsRes] = await Promise.all([
                api.get(`/groups/${id}`),
                api.get(`/groups/${id}/members`),
                api.get(`/groups/${id}/expenses`),
                api.get(`/groups/${id}/debts`)
            ]);

            setGroup(groupRes.group);
            setMembers(membersRes.members || []);
            setExpenses(expensesRes.expenses || []);
            setDebts(debtsRes.debts || []);
        } catch (error) {
            console.error('Error fetching group data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = () => {
        // Initialize equal split
        const equalAmount = expenseForm.amount ? (parseFloat(expenseForm.amount) / members.length).toFixed(2) : '0';
        const splits = members.map(m => ({
            userId: m.user_id,
            username: m.username,
            amount: equalAmount
        }));
        setExpenseForm({ ...expenseForm, splits });
        setShowExpenseModal(true);
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/groups/${id}/expenses`, expenseForm);
            setShowExpenseModal(false);
            setExpenseForm({ amount: '', description: '', splits: [] });
            fetchGroupData();
        } catch (error) {
            console.error('Error creating expense:', error);
            alert('Failed to create expense');
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/groups/${id}/members`, { username: newMemberUsername });
            setShowMemberModal(false);
            setNewMemberUsername('');
            fetchGroupData();
        } catch (error) {
            console.error('Error adding member:', error);
            alert(error.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('Remove this member from the group?')) return;
        try {
            await api.delete(`/groups/${id}/members/${userId}`);
            fetchGroupData();
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member');
        }
    };

    const handleSettleDebt = async (creditorId, amount) => {
        if (!confirm(`Settle ₹${amount} debt?`)) return;
        try {
            await api.post(`/groups/${id}/debts/settle`, { creditorId, amount });
            fetchGroupData();
        } catch (error) {
            console.error('Error settling debt:', error);
            alert('Failed to settle debt');
        }
    };

    const updateSplit = (userId, newAmount) => {
        const splits = expenseForm.splits.map(s =>
            s.userId === userId ? { ...s, amount: newAmount } : s
        );
        setExpenseForm({ ...expenseForm, splits });
    };

    const splitEqually = () => {
        const equalAmount = (parseFloat(expenseForm.amount) / members.length).toFixed(2);
        const splits = expenseForm.splits.map(s => ({ ...s, amount: equalAmount }));
        setExpenseForm({ ...expenseForm, splits });
    };

    if (loading) return <div className="page"><div className="container">Loading...</div></div>;
    if (!group) return <div className="page"><div className="container">Group not found</div></div>;

    const myDebts = debts.filter(d => d.debtor_id === user.id);
    const owedToMe = debts.filter(d => d.creditor_id === user.id);

    return (
        <div className="page">
            <div className="container">
                <h1 className="animate-fade-in">{group.name}</h1>
                {group.description && (
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                        {group.description}
                    </p>
                )}

                {/* Debt Summary */}
                <div className="grid" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                    <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            You owe
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>
                            ₹{myDebts.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Owed to you
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>
                            ₹{owedToMe.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <button
                        className={`tab ${activeTab === 'expenses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('expenses')}
                    >
                        Expenses
                    </button>
                    <button
                        className={`tab ${activeTab === 'debts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('debts')}
                    >
                        Debts
                    </button>
                    <button
                        className={`tab ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => setActiveTab('members')}
                    >
                        Members
                    </button>
                </div>

                {/* Expenses Tab */}
                {activeTab === 'expenses' && (
                    <div>
                        <button onClick={handleAddExpense} className="btn btn-primary mb-lg">
                            + Add Expense
                        </button>

                        {expenses.length === 0 ? (
                            <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>No expenses yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {expenses.map(expense => (
                                    <div key={expense.id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                                    {expense.description}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    Paid by {expense.paid_by_name} • {new Date(expense.expense_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                                ₹{parseFloat(expense.amount).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Debts Tab */}
                {activeTab === 'debts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {debts.length === 0 ? (
                            <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>All settled up! 🎉</p>
                            </div>
                        ) : (
                            debts.map(debt => (
                                <div key={debt.id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div style={{ fontWeight: '600' }}>
                                                {debt.debtor_name} owes {debt.creditor_name}
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginTop: '0.5rem' }}>
                                                ₹{parseFloat(debt.amount).toFixed(2)}
                                            </div>
                                        </div>
                                        {debt.debtor_id === user.id && (
                                            <button
                                                onClick={() => handleSettleDebt(debt.creditor_id, debt.amount)}
                                                className="btn btn-success"
                                            >
                                                Settle
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div>
                        {group.userRole === 'admin' && (
                            <button onClick={() => setShowMemberModal(true)} className="btn btn-primary mb-lg">
                                + Add Member
                            </button>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {members.map(member => (
                                <div key={member.user_id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-md">
                                            <div className="user-avatar">
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                ) : (
                                                    member.full_name?.charAt(0) || member.username?.charAt(0) || 'U'
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{member.full_name || member.username}</div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    @{member.username}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-md">
                                            {member.role === 'admin' && (
                                                <span className="badge badge-primary">Admin</span>
                                            )}
                                            {group.userRole === 'admin' && member.user_id !== user.id && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.user_id)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.5rem' }}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Expense Modal */}
                {showExpenseModal && (
                    <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Add Expense</h2>
                            <form onSubmit={handleSubmitExpense}>
                                <div className="input-group">
                                    <label className="input-label">Description</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={expenseForm.description}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                        required
                                        placeholder="What was this expense for?"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Total Amount (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input-field"
                                        value={expenseForm.amount}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="input-group">
                                    <div className="flex justify-between items-center mb-sm">
                                        <label className="input-label">Split Between</label>
                                        <button type="button" onClick={splitEqually} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                                            Split Equally
                                        </button>
                                    </div>
                                    {expenseForm.splits.map(split => (
                                        <div key={split.userId} className="flex items-center gap-md mb-sm">
                                            <span style={{ flex: 1 }}>{split.username}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input-field"
                                                style={{ width: '120px' }}
                                                value={split.amount}
                                                onChange={(e) => updateSplit(split.userId, e.target.value)}
                                                required
                                            />
                                        </div>
                                    ))}
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                        Total: ₹{expenseForm.splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0).toFixed(2)}
                                    </div>
                                </div>

                                <div className="flex gap-md" style={{ marginTop: 'var(--spacing-lg)' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        Add Expense
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowExpenseModal(false)}
                                        className="btn btn-ghost"
                                        style={{ flex: 1 }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add Member Modal */}
                {showMemberModal && (
                    <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Add Member</h2>
                            <form onSubmit={handleAddMember}>
                                <div className="input-group">
                                    <label className="input-label">Username</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={newMemberUsername}
                                        onChange={(e) => setNewMemberUsername(e.target.value)}
                                        required
                                        placeholder="Enter username"
                                    />
                                </div>

                                <div className="flex gap-md" style={{ marginTop: 'var(--spacing-lg)' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        Add Member
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMemberModal(false)}
                                        className="btn btn-ghost"
                                        style={{ flex: 1 }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

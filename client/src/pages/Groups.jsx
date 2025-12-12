import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await api.get('/groups');
            setGroups(response.groups || []);
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/groups', formData);
            setShowModal(false);
            setFormData({ name: '', description: '' });
            fetchGroups();
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Failed to create group');
        }
    };

    if (loading) return <div className="page"><div className="container">Loading...</div></div>;

    return (
        <div className="page">
            <div className="container">
                <div className="flex justify-between items-center mb-xl">
                    <h1 className="animate-fade-in">👥 Groups</h1>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary">
                        + Create Group
                    </button>
                </div>

                {groups.length === 0 ? (
                    <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                            No groups yet. Create one to start splitting expenses!
                        </p>
                    </div>
                ) : (
                    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
                        {groups.map(group => (
                            <Link key={group.id} to={`/groups/${group.id}`} style={{ textDecoration: 'none' }}>
                                <div className="glass-card hover-lift" style={{ padding: 'var(--spacing-lg)' }}>
                                    <div className="flex justify-between items-start mb-md">
                                        <div>
                                            <h3 style={{ marginBottom: 'var(--spacing-xs)' }}>{group.name}</h3>
                                            {group.description && (
                                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    {group.description}
                                                </p>
                                            )}
                                        </div>
                                        <span className="badge badge-primary">{group.member_count} members</span>
                                    </div>

                                    <div className="flex gap-lg" style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border-color)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                You owe
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--danger)' }}>
                                                ₹{parseFloat(group.you_owe || 0).toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                Owed to you
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--success)' }}>
                                                ₹{parseFloat(group.owed_to_you || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Create Group Modal */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Create New Group</h2>
                            <form onSubmit={handleSubmit}>
                                <div className="input-group">
                                    <label className="input-label">Group Name</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g., Family, Friends, Roommates"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Description (Optional)</label>
                                    <textarea
                                        className="input-field"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        placeholder="What's this group for?"
                                    />
                                </div>

                                <div className="flex gap-md" style={{ marginTop: 'var(--spacing-lg)' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        Create Group
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
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

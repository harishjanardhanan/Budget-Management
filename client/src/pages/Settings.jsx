import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import '../index.css';

function Settings() {
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTeam, setShowCreateTeam] = useState(false);
    const [showInviteMember, setShowInviteMember] = useState(false);
    const [teamForm, setTeamForm] = useState({ name: '', description: '' });
    const [inviteEmail, setInviteEmail] = useState('');

    useEffect(() => {
        fetchTeamData();
        fetchInvitations();
    }, []);

    const fetchTeamData = async () => {
        try {
            const [teamRes, membersRes] = await Promise.all([
                api.get('/teams/my-team'),
                api.get('/teams/my-team/members')
            ]);
            setTeam(teamRes.team);
            setMembers(membersRes.members || []);
        } catch (error) {
            console.error('Error fetching team:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvitations = async () => {
        try {
            const res = await api.get('/teams/invitations/pending');
            setInvitations(res.invitations || []);
        } catch (error) {
            console.error('Error fetching invitations:', error);
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            await api.post('/teams', teamForm);
            // Just reload the page to show the new team
            window.location.reload();
        } catch (error) {
            console.error('Create team error:', error);
            alert(error.message || 'Failed to create team');
        }
    };

    const handleInviteMember = async (e) => {
        e.preventDefault();
        try {
            await api.post('/teams/my-team/invite', { email: inviteEmail });
            setShowInviteMember(false);
            setInviteEmail('');
            alert('Invitation sent successfully!');
        } catch (error) {
            alert(error.message || 'Failed to send invitation');
        }
    };

    const handleAcceptInvitation = async (invitationId) => {
        if (!confirm('Accepting this invitation will remove you from your current team. Continue?')) {
            return;
        }
        try {
            await api.post(`/teams/invitations/${invitationId}/accept`);
            fetchTeamData();
            fetchInvitations();
            alert('Successfully joined the team!');
        } catch (error) {
            alert(error.message || 'Failed to accept invitation');
        }
    };

    const handleRejectInvitation = async (invitationId) => {
        try {
            await api.post(`/teams/invitations/${invitationId}/reject`);
            fetchInvitations();
            alert('Invitation rejected');
        } catch (error) {
            alert(error.message || 'Failed to reject invitation');
        }
    };

    const handleLeaveTeam = async () => {
        if (!confirm('Are you sure you want to leave this team?')) {
            return;
        }
        try {
            await api.post('/teams/my-team/leave');
            fetchTeamData();
            alert('Successfully left the team');
        } catch (error) {
            alert(error.message || 'Failed to leave team');
        }
    };

    const handleDeleteTeam = async () => {
        if (!confirm('Are you sure you want to delete this team? This will remove all members.')) {
            return;
        }
        try {
            await api.delete('/teams/my-team');
            fetchTeamData();
            alert('Team deleted successfully');
        } catch (error) {
            alert(error.message || 'Failed to delete team');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('Are you sure you want to remove this member?')) {
            return;
        }
        try {
            await api.delete(`/teams/my-team/members/${userId}`);
            fetchTeamData();
            alert('Member removed successfully');
        } catch (error) {
            alert(error.message || 'Failed to remove member');
        }
    };

    return (
        <div className="page">
            <div className="container">
                <h1 className="animate-fade-in">⚙️ Settings</h1>

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                    <div className="glass-card" style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-xl)', background: 'var(--warning-bg)', borderLeft: '4px solid var(--warning)' }}>
                        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>📬 Pending Team Invitations ({invitations.length})</h3>
                        {invitations.map(inv => (
                            <div key={inv.id} style={{ padding: 'var(--spacing-md)', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong>{inv.team_name}</strong>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                                            Invited by {inv.invited_by_username}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <button onClick={() => handleAcceptInvitation(inv.id)} className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                                            Accept
                                        </button>
                                        <button onClick={() => handleRejectInvitation(inv.id)} className="btn" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Team Section */}
                <div className="glass-card" style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-xl)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>👥 Team Management</h3>

                    {loading ? (
                        <p>Loading team information...</p>
                    ) : team ? (
                        <>
                            {/* Team Info */}
                            <div style={{ padding: 'var(--spacing-lg)', background: 'var(--hover-bg)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                        <h4 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-sm)' }}>{team.name}</h4>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>{team.description}</p>
                                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            <span>👤 {members.length} member{members.length !== 1 ? 's' : ''}</span>
                                            <span>🎭 Your role: <strong style={{ color: 'var(--primary-500)' }}>{user?.teamRole}</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        {(user?.teamRole === 'owner' || user?.teamRole === 'admin') && (
                                            <button onClick={() => setShowInviteMember(true)} className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
                                                ➕ Invite Member
                                            </button>
                                        )}
                                        {user?.teamRole !== 'owner' && (
                                            <button onClick={handleLeaveTeam} className="btn" style={{ fontSize: '0.875rem' }}>
                                                🚪 Leave Team
                                            </button>
                                        )}
                                        {user?.teamRole === 'owner' && (
                                            <button onClick={handleDeleteTeam} className="btn" style={{ fontSize: '0.875rem', background: 'var(--danger)', color: 'white' }}>
                                                🗑️ Delete Team
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Members List */}
                            <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Team Members</h4>
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                {members.map(member => (
                                    <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-md)', background: 'var(--hover-bg)', borderRadius: 'var(--radius-md)' }}>
                                        <div>
                                            <strong>{member.full_name || member.username}</strong>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                                @{member.username} • {member.email}
                                            </div>
                                            <span style={{
                                                display: 'inline-block',
                                                marginTop: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                background: member.team_role === 'owner' ? 'var(--primary-500)' : member.team_role === 'admin' ? 'var(--success)' : 'var(--text-muted)',
                                                color: 'white',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem',
                                                fontWeight: '600'
                                            }}>
                                                {member.team_role?.toUpperCase()}
                                            </span>
                                        </div>
                                        {(user?.teamRole === 'owner' || user?.teamRole === 'admin') && member.team_role !== 'owner' && member.id !== user?.id && (
                                            <button onClick={() => handleRemoveMember(member.id)} className="btn" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                                You're not currently in a team. Create a team to manage budgets and transactions with others.
                            </p>
                            <button onClick={() => setShowCreateTeam(true)} className="btn btn-primary">
                                ➕ Create Team
                            </button>
                        </>
                    )}
                </div>

                {/* Appearance Section */}
                <div className="glass-card" style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-xl)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Appearance</h3>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h4>Theme</h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 'var(--spacing-xs)' }}>
                                Choose between light and dark mode
                            </p>
                        </div>

                        <label className="theme-toggle">
                            <input
                                type="checkbox"
                                checked={theme === 'dark'}
                                onChange={toggleTheme}
                                aria-label="Toggle theme"
                            />
                            <span className="toggle-slider">
                                <span className="toggle-icon">
                                    {theme === 'dark' ? '🌙' : '☀️'}
                                </span>
                            </span>
                        </label>
                    </div>
                </div>

                {/* About Section */}
                <div className="glass-card" style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-xl)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>About</h3>

                    <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                        <p><strong>Budget Manager</strong></p>
                        <p style={{ marginTop: 'var(--spacing-sm)' }}>Version 1.0.0</p>
                        <p style={{ marginTop: 'var(--spacing-md)' }}>
                            A modern budget management application to track your expenses and manage your finances.
                        </p>
                        <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-muted)' }}>
                            Created with ❤️ by <strong style={{ color: 'var(--primary-500)' }}>Harish</strong>
                        </p>
                    </div>
                </div>

                {/* Modals - Rendered at root level for proper z-index */}
                {/* Invite Member Modal */}
                {showInviteMember && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: 'var(--spacing-md)'
                    }} onClick={() => setShowInviteMember(false)}>
                        <div style={{
                            background: 'var(--card-bg)',
                            padding: 'var(--spacing-xl)',
                            borderRadius: '16px',
                            maxWidth: '500px',
                            width: '100%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            border: '1px solid var(--border-color)',
                            animation: 'slideUp 0.2s ease-out'
                        }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.5rem', fontWeight: '600' }}>Invite Team Member</h3>
                            <form onSubmit={handleInviteMember}>
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label className="form-label" style={{ fontWeight: '500', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Email Address</label>
                                    <input
                                        type="email"
                                        className="input-field"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="member@example.com"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
                                    <button type="button" onClick={() => setShowInviteMember(false)} className="btn" style={{ padding: '0.75rem 1.5rem' }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                                        Send Invitation
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Team Modal */}
                {showCreateTeam && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: 'var(--spacing-md)'
                    }} onClick={() => setShowCreateTeam(false)}>
                        <div style={{
                            background: 'var(--card-bg)',
                            padding: 'var(--spacing-xl)',
                            borderRadius: '16px',
                            maxWidth: '500px',
                            width: '100%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                            border: '1px solid var(--border-color)',
                            animation: 'slideUp 0.2s ease-out'
                        }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.5rem', fontWeight: '600' }}>Create New Team</h3>
                            <form onSubmit={handleCreateTeam}>
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label className="form-label" style={{ fontWeight: '500', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Team Name</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={teamForm.name}
                                        onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                                        placeholder="My Team"
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <label className="form-label" style={{ fontWeight: '500', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Description (Optional)</label>
                                    <textarea
                                        className="input-field"
                                        value={teamForm.description}
                                        onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                                        placeholder="Describe your team..."
                                        rows="3"
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
                                    <button type="button" onClick={() => setShowCreateTeam(false)} className="btn" style={{ padding: '0.75rem 1.5rem' }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                                        Create Team
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

export default Settings;

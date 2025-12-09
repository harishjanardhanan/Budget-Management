import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/', label: '📊 Dashboard' },
        { path: '/transactions', label: '💸 Transactions' },
        { path: '/budgets', label: '🎯 Budgets' },
        { path: '/recurring', label: '🔄 Recurring' },
        { path: '/reports', label: '📈 Reports' },
    ];

    return (
        <nav className="glass-card" style={{ margin: '1rem', padding: '1rem', position: 'sticky', top: '1rem', zIndex: 100 }}>
            <div className="container">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-lg">
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>💰</h2>
                        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`btn ${location.pathname === item.path ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-md">
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {user?.fullName || user?.username}
                        </span>
                        <button onClick={logout} className="btn btn-ghost" style={{ padding: '0.5rem 1rem' }}>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

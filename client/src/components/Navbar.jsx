import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const navItems = [
        { path: '/', label: '📊 Dashboard' },
        { path: '/transactions', label: '💸 Transactions' },
        { path: '/budgets', label: '🎯 Budgets' },
        { path: '/groups', label: '👥 Groups' },
        { path: '/recurring', label: '🔄 Recurring' },
        { path: '/reports', label: '📈 Reports' },
    ];

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <>
            <nav className="glass-card navbar-container">
                <div className="container">
                    <div className="navbar-content">
                        {/* Logo and Hamburger */}
                        <div className="navbar-left">
                            <button
                                className="hamburger-btn"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle menu"
                            >
                                <span className="hamburger-icon">
                                    {mobileMenuOpen ? '✕' : '☰'}
                                </span>
                            </button>
                            <Link to="/" className="navbar-logo-link">
                                <h2 className="navbar-logo">💰 Budget Manager</h2>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="navbar-links desktop-only">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* User Menu */}
                        <div className="user-menu-container">
                            <button
                                className="user-menu-btn"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                            >
                                <div className="user-avatar">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    ) : (
                                        user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'
                                    )}
                                </div>
                                <span className="user-name desktop-only">
                                    {user?.fullName || user?.username}
                                </span>
                                <span className="dropdown-arrow">▼</span>
                            </button>

                            {userMenuOpen && (
                                <>
                                    <div className="dropdown-overlay" onClick={() => setUserMenuOpen(false)} />
                                    <div className="user-dropdown">
                                        <Link to="/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                            <span>👤</span> Profile
                                        </Link>
                                        <Link to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                            <span>⚙️</span> Settings
                                        </Link>
                                        <button onClick={logout} className="dropdown-item logout-btn">
                                            <span>🚪</span> Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <>
                    <div className="mobile-menu-overlay" onClick={closeMobileMenu} />
                    <div className="mobile-menu">
                        <div className="mobile-menu-header">
                            <h3>Menu</h3>
                            <button onClick={closeMobileMenu} className="close-btn">✕</button>
                        </div>
                        <div className="mobile-menu-items">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`mobile-menu-item ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={closeMobileMenu}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

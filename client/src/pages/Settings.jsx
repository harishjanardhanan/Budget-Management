import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

function Settings() {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="page">
            <div className="container">
                <h1 className="animate-fade-in">⚙️ Settings</h1>

                <div className="glass-card" style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-xl)' }}>
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
            </div>
        </div>
    );
}

export default Settings;

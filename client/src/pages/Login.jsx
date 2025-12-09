import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        fullName: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = isLogin
            ? await login(formData.username, formData.password)
            : await register(formData);

        if (!result.success) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '1rem' }}>
            <div className="glass-card animate-scale-in" style={{ maxWidth: '450px', width: '100%', padding: '2rem' }}>
                <div className="text-center mb-lg">
                    <h1 style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
                        💰 Budget Manager
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {isLogin ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                {error && (
                    <div style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            type="text"
                            className="input-field"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="input-group">
                                <label className="input-label">Email</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Full Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
                    </button>
                </form>

                <div className="text-center mt-lg">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="btn btn-ghost"
                    >
                        {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}

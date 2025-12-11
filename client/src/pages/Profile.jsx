import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function Profile() {
    const { user, updateUser } = useAuth();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        bio: user?.bio || '',
        avatar: user?.avatar || ''
    });

    // Update form data when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                bio: user.bio || '',
                avatar: user.avatar || ''
            });
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.put('/auth/profile', formData);
            console.log('Profile update response:', response);

            // Update user in context and localStorage
            if (response.user) {
                updateUser(response.user);
                setEditing(false);
                alert('Profile updated successfully!');
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert(`Failed to update profile: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, avatar: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <h1 className="animate-fade-in">👤 Profile</h1>

                <div className="glass-card" style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-xl)' }}>
                    <div className="profile-header">
                        <div className="profile-avatar-container">
                            <div className="profile-avatar-large">
                                {formData.avatar ? (
                                    <img src={formData.avatar} alt="Profile" />
                                ) : (
                                    <span className="avatar-placeholder">
                                        {formData.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                                    </span>
                                )}
                            </div>
                            {editing && (
                                <label className="avatar-upload-btn">
                                    📷 Change Photo
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>

                        {!editing && (
                            <button onClick={() => setEditing(true)} className="btn btn-primary">
                                ✏️ Edit Profile
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: 'var(--spacing-xl)' }}>
                        <div className="input-group">
                            <label className="input-label">Full Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                disabled={!editing}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!editing}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Phone Number</label>
                            <input
                                type="tel"
                                className="input-field"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                disabled={!editing}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Bio</label>
                            <textarea
                                className="input-field"
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                disabled={!editing}
                                rows="4"
                                placeholder="Tell us about yourself..."
                                style={{ resize: 'vertical', minHeight: '100px' }}
                            />
                        </div>

                        {editing && (
                            <div className="flex gap-md" style={{ marginTop: 'var(--spacing-lg)' }}>
                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? 'Saving...' : '💾 Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditing(false);
                                        setFormData({
                                            fullName: user?.fullName || '',
                                            email: user?.email || '',
                                            phone: user?.phone || '',
                                            bio: user?.bio || '',
                                            avatar: user?.avatar || ''
                                        });
                                    }}
                                    className="btn btn-ghost"
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                <div className="glass-card" style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-xl)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Account Information</h3>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                        <p><strong>Username:</strong> {user?.username}</p>
                        <p style={{ marginTop: 'var(--spacing-sm)' }}>
                            <strong>Member since:</strong> {new Date(user?.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

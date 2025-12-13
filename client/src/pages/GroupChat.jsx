import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroupChat } from '../hooks/useSocket';
import api from '../utils/api';

export default function GroupChat() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [showReactionPicker, setShowReactionPicker] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

    // WebSocket chat hook
    const {
        messages,
        setMessages,
        typingUsers,
        onlineUsers,
        isConnected,
        sendMessage,
        editMessage: editSocketMessage,
        deleteMessage: deleteSocketMessage,
        sendTyping,
        addReaction,
        removeReaction,
        markAsRead
    } = useGroupChat(id);

    useEffect(() => {
        fetchGroupData();
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchGroupData = async () => {
        try {
            const [groupRes, membersRes] = await Promise.all([
                api.get(`/groups/${id}`),
                api.get(`/groups/${id}/members`)
            ]);
            setGroup(groupRes.group);
            setMembers(membersRes.members || []);
        } catch (error) {
            console.error('Error fetching group data:', error);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        sendMessage(newMessage, replyingTo?.id);
        setNewMessage('');
        setReplyingTo(null);
        sendTyping(false);
    };

    const handleEditMessage = () => {
        if (!editingMessage || !newMessage.trim()) return;
        editSocketMessage(editingMessage.id, newMessage);
        setEditingMessage(null);
        setNewMessage('');
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        sendTyping(true);

        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(false);
        }, 1000);
    };

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getOnlineCount = () => {
        return members.filter(m => onlineUsers.has(m.user_id)).length;
    };

    if (!group) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="telegram-chat">
            {/* Telegram-style Header */}
            <div className="telegram-header">
                <button className="back-button" onClick={() => navigate(`/groups/${id}`)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                <div className="header-info" onClick={() => navigate(`/groups/${id}`)}>
                    <div className="group-avatar">
                        {group.name?.charAt(0) || 'G'}
                    </div>
                    <div className="header-text">
                        <div className="group-name">{group.name}</div>
                        <div className="group-status">
                            {getOnlineCount()} online, {members.length} members
                        </div>
                    </div>
                </div>

                <div className="header-actions">
                    <button className="icon-button">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="telegram-messages">
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <div className="empty-icon">💬</div>
                        <p>No messages yet</p>
                        <p className="empty-subtitle">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`telegram-message ${msg.user_id === user.id ? 'sent' : 'received'}`}
                        >
                            {msg.user_id !== user.id && (
                                <div className="message-avatar">
                                    {msg.avatar ? (
                                        <img src={msg.avatar} alt={msg.username} />
                                    ) : (
                                        msg.full_name?.charAt(0) || msg.username?.charAt(0) || 'U'
                                    )}
                                </div>
                            )}

                            <div className="message-content-wrapper">
                                {msg.user_id !== user.id && (
                                    <div className="message-sender">{msg.username}</div>
                                )}

                                {msg.reply_to && (
                                    <div className="message-reply">
                                        <div className="reply-line"></div>
                                        <div className="reply-content">
                                            <div className="reply-name">
                                                {messages.find(m => m.id === msg.reply_to)?.username || 'User'}
                                            </div>
                                            <div className="reply-text">
                                                {messages.find(m => m.id === msg.reply_to)?.message || 'Message'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="message-bubble">
                                    <div className="message-text">{msg.message}</div>
                                    <div className="message-meta">
                                        {msg.edited && <span className="edited-badge">edited</span>}
                                        <span className="message-time">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.user_id === user.id && (
                                            <span className="message-status">✓✓</span>
                                        )}
                                    </div>
                                </div>

                                {/* Message Actions */}
                                {showReactionPicker !== msg.id && (
                                    <div className="message-actions-telegram">
                                        <button onClick={() => setReplyingTo(msg)} title="Reply">↩️</button>
                                        <button onClick={() => setShowReactionPicker(msg.id)} title="React">😊</button>
                                        {msg.user_id === user.id && (
                                            <>
                                                <button onClick={() => { setEditingMessage(msg); setNewMessage(msg.message); }} title="Edit">✏️</button>
                                                <button onClick={() => deleteSocketMessage(msg.id)} title="Delete">🗑️</button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Reaction Picker */}
                                {showReactionPicker === msg.id && (
                                    <div className="reaction-picker-telegram">
                                        {emojis.map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => {
                                                    addReaction(msg.id, emoji);
                                                    setShowReactionPicker(null);
                                                }}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        <button onClick={() => setShowReactionPicker(null)}>✕</button>
                                    </div>
                                )}

                                {/* Reactions */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="message-reactions-telegram">
                                        {Object.entries(
                                            msg.reactions.reduce((acc, r) => {
                                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                                return acc;
                                            }, {})
                                        ).map(([emoji, count]) => (
                                            <span
                                                key={emoji}
                                                className="reaction-item"
                                                onClick={() => removeReaction(msg.id, emoji)}
                                            >
                                                {emoji} {count}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                    <div className="typing-indicator-telegram">
                        <div className="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span className="typing-text">typing...</span>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Reply/Edit Preview */}
            {(replyingTo || editingMessage) && (
                <div className="input-preview">
                    {replyingTo && (
                        <>
                            <div className="preview-content">
                                <div className="preview-label">Reply to {replyingTo.username}</div>
                                <div className="preview-text">{replyingTo.message}</div>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="preview-close">✕</button>
                        </>
                    )}
                    {editingMessage && (
                        <>
                            <div className="preview-content">
                                <div className="preview-label">Edit message</div>
                                <div className="preview-text">{editingMessage.message}</div>
                            </div>
                            <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="preview-close">✕</button>
                        </>
                    )}
                </div>
            )}

            {/* Telegram-style Input Bar */}
            <form onSubmit={editingMessage ? handleEditMessage : handleSendMessage} className="telegram-input">
                <button type="button" className="input-icon-button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                <input
                    type="text"
                    className="telegram-input-field"
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder="Message"
                />

                <button type="submit" className="send-button-telegram" disabled={!newMessage.trim()}>
                    {editingMessage ? '✓' : '✈️'}
                </button>
            </form>
        </div>
    );
}

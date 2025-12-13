import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

// Socket.io connects to server root, not /api path
const SOCKET_URL = import.meta.env.VITE_API_URL?.startsWith('http')
    ? import.meta.env.VITE_API_URL.replace('/api', '') // Remove /api for Socket.io
    : (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

export function useSocket() {
    const { user } = useAuth();
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        // Initialize socket connection
        socketRef.current = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketRef.current.on('error', (error) => {
            console.error('Socket error:', error);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user]);

    return {
        socket: socketRef.current,
        isConnected
    };
}

// Hook for group chat
export function useGroupChat(groupId) {
    const { socket, isConnected } = useSocket();
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        if (!socket || !groupId) return;

        // Fetch initial messages from database
        const fetchInitialMessages = async () => {
            try {
                const response = await api.get(`/groups/${groupId}/messages`);
                setMessages(response.messages || []);
            } catch (error) {
                console.error('Error fetching initial messages:', error);
            }
        };

        fetchInitialMessages();

        // Join group room
        socket.emit('join-group', groupId);

        // Listen for new messages
        socket.on('new-message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        // Listen for message edits
        socket.on('message-edited', ({ messageId, newMessage, editedAt }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, message: newMessage, edited: true, edited_at: editedAt }
                    : msg
            ));
        });

        // Listen for message deletions
        socket.on('message-deleted', ({ messageId }) => {
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
        });

        // Listen for typing indicators
        socket.on('user-typing', ({ userId, isTyping }) => {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                if (isTyping) {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
                }
                return newSet;
            });
        });

        // Listen for reactions
        socket.on('reaction-added', ({ messageId, userId, emoji }) => {
            setMessages(prev => prev.map(msg => {
                if (msg.id === messageId) {
                    const reactions = msg.reactions || [];
                    return { ...msg, reactions: [...reactions, { userId, emoji }] };
                }
                return msg;
            }));
        });

        socket.on('reaction-removed', ({ messageId, userId, emoji }) => {
            setMessages(prev => prev.map(msg => {
                if (msg.id === messageId) {
                    const reactions = (msg.reactions || []).filter(
                        r => !(r.userId === userId && r.emoji === emoji)
                    );
                    return { ...msg, reactions };
                }
                return msg;
            }));
        });

        // Listen for user join/leave
        socket.on('user-joined', ({ userId }) => {
            setOnlineUsers(prev => new Set([...prev, userId]));
        });

        socket.on('user-left', ({ userId }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        });

        return () => {
            socket.emit('leave-group', groupId);
            socket.off('new-message');
            socket.off('message-edited');
            socket.off('message-deleted');
            socket.off('user-typing');
            socket.off('reaction-added');
            socket.off('reaction-removed');
            socket.off('user-joined');
            socket.off('user-left');
        };
    }, [socket, groupId]);

    const sendMessage = (message, replyTo = null, attachmentUrl = null, attachmentType = null) => {
        if (!socket) return;
        socket.emit('send-message', { groupId, message, replyTo, attachmentUrl, attachmentType });
    };

    const editMessage = (messageId, newMessage) => {
        if (!socket) return;
        socket.emit('edit-message', { messageId, newMessage });
    };

    const deleteMessage = (messageId) => {
        if (!socket) return;
        socket.emit('delete-message', { messageId });
    };

    const sendTyping = (isTyping) => {
        if (!socket) return;
        socket.emit('typing', { groupId, isTyping });
    };

    const addReaction = (messageId, emoji) => {
        if (!socket) return;
        socket.emit('add-reaction', { messageId, emoji });
    };

    const removeReaction = (messageId, emoji) => {
        if (!socket) return;
        socket.emit('remove-reaction', { messageId, emoji });
    };

    const markAsRead = (messageId) => {
        if (!socket) return;
        socket.emit('mark-read', { messageId });
    };

    return {
        messages,
        setMessages,
        typingUsers,
        onlineUsers,
        isConnected,
        sendMessage,
        editMessage,
        deleteMessage,
        sendTyping,
        addReaction,
        removeReaction,
        markAsRead
    };
}

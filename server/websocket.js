import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './db.js';

let io;

export function initializeWebSocket(server) {
    io = new Server(server, {
        cors: {
            origin: true, // Allow all origins since we're on the same server
            credentials: true
        }
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;

            // Update user status to online
            await pool.query(
                `INSERT INTO user_status (user_id, is_online, last_seen)
                 VALUES ($1, TRUE, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id)
                 DO UPDATE SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
                [decoded.userId]
            );

            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Join group rooms
        socket.on('join-group', async (groupId) => {
            try {
                // Verify user is member of group
                const memberCheck = await pool.query(
                    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
                    [groupId, socket.userId]
                );

                if (memberCheck.rows.length > 0) {
                    socket.join(`group-${groupId}`);
                    console.log(`User ${socket.userId} joined group ${groupId}`);

                    // Notify others in group
                    socket.to(`group-${groupId}`).emit('user-joined', {
                        userId: socket.userId,
                        groupId
                    });
                }
            } catch (error) {
                console.error('Join group error:', error);
            }
        });

        // Leave group room
        socket.on('leave-group', (groupId) => {
            socket.leave(`group-${groupId}`);
            socket.to(`group-${groupId}`).emit('user-left', {
                userId: socket.userId,
                groupId
            });
        });

        // Send message
        socket.on('send-message', async (data) => {
            try {
                const { groupId, message, replyTo, attachmentUrl, attachmentType } = data;

                // Insert message into database
                const result = await pool.query(
                    `INSERT INTO group_messages (group_id, user_id, message, reply_to, attachment_url, attachment_type)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [groupId, socket.userId, message, replyTo || null, attachmentUrl || null, attachmentType || null]
                );

                // Get user info
                const userInfo = await pool.query(
                    `SELECT username, full_name, avatar FROM users WHERE id = $1`,
                    [socket.userId]
                );

                const messageData = {
                    ...result.rows[0],
                    username: userInfo.rows[0].username,
                    full_name: userInfo.rows[0].full_name,
                    avatar: userInfo.rows[0].avatar
                };

                // Broadcast to group
                io.to(`group-${groupId}`).emit('new-message', messageData);
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Edit message
        socket.on('edit-message', async (data) => {
            try {
                const { messageId, newMessage } = data;

                // Verify ownership
                const ownerCheck = await pool.query(
                    'SELECT group_id FROM group_messages WHERE id = $1 AND user_id = $2',
                    [messageId, socket.userId]
                );

                if (ownerCheck.rows.length > 0) {
                    await pool.query(
                        'UPDATE group_messages SET message = $1, edited = TRUE, edited_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [newMessage, messageId]
                    );

                    const groupId = ownerCheck.rows[0].group_id;
                    io.to(`group-${groupId}`).emit('message-edited', {
                        messageId,
                        newMessage,
                        editedAt: new Date()
                    });
                }
            } catch (error) {
                console.error('Edit message error:', error);
            }
        });

        // Delete message
        socket.on('delete-message', async (data) => {
            try {
                const { messageId } = data;

                const ownerCheck = await pool.query(
                    'SELECT group_id FROM group_messages WHERE id = $1 AND user_id = $2',
                    [messageId, socket.userId]
                );

                if (ownerCheck.rows.length > 0) {
                    await pool.query('DELETE FROM group_messages WHERE id = $1', [messageId]);

                    const groupId = ownerCheck.rows[0].group_id;
                    io.to(`group-${groupId}`).emit('message-deleted', { messageId });
                }
            } catch (error) {
                console.error('Delete message error:', error);
            }
        });

        // Typing indicator
        socket.on('typing', (data) => {
            const { groupId, isTyping } = data;
            socket.to(`group-${groupId}`).emit('user-typing', {
                userId: socket.userId,
                isTyping
            });
        });

        // Message reaction
        socket.on('add-reaction', async (data) => {
            try {
                const { messageId, emoji } = data;

                await pool.query(
                    `INSERT INTO message_reactions (message_id, user_id, emoji)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
                    [messageId, socket.userId, emoji]
                );

                // Get group_id for broadcasting
                const msgInfo = await pool.query(
                    'SELECT group_id FROM group_messages WHERE id = $1',
                    [messageId]
                );

                if (msgInfo.rows.length > 0) {
                    io.to(`group-${msgInfo.rows[0].group_id}`).emit('reaction-added', {
                        messageId,
                        userId: socket.userId,
                        emoji
                    });
                }
            } catch (error) {
                console.error('Add reaction error:', error);
            }
        });

        // Remove reaction
        socket.on('remove-reaction', async (data) => {
            try {
                const { messageId, emoji } = data;

                await pool.query(
                    'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
                    [messageId, socket.userId, emoji]
                );

                const msgInfo = await pool.query(
                    'SELECT group_id FROM group_messages WHERE id = $1',
                    [messageId]
                );

                if (msgInfo.rows.length > 0) {
                    io.to(`group-${msgInfo.rows[0].group_id}`).emit('reaction-removed', {
                        messageId,
                        userId: socket.userId,
                        emoji
                    });
                }
            } catch (error) {
                console.error('Remove reaction error:', error);
            }
        });

        // Mark message as read
        socket.on('mark-read', async (data) => {
            try {
                const { messageId } = data;

                await pool.query(
                    `INSERT INTO message_read_receipts (message_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (message_id, user_id) DO NOTHING`,
                    [messageId, socket.userId]
                );

                const msgInfo = await pool.query(
                    'SELECT group_id FROM group_messages WHERE id = $1',
                    [messageId]
                );

                if (msgInfo.rows.length > 0) {
                    io.to(`group-${msgInfo.rows[0].group_id}`).emit('message-read', {
                        messageId,
                        userId: socket.userId
                    });
                }
            } catch (error) {
                console.error('Mark read error:', error);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.userId}`);

            // Update user status to offline
            try {
                await pool.query(
                    `UPDATE user_status
                     SET is_online = FALSE, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1`,
                    [socket.userId]
                );
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        });
    });

    return io;
}

export function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}

import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticateToken);

// Get group messages
router.get('/', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { since } = req.query; // For polling - get messages since timestamp

    try {
        // Check if user is member
        const memberCheck = await pool.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        let query = `
            SELECT gm.*, u.username, u.full_name, u.avatar
            FROM group_messages gm
            INNER JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = $1
        `;
        const params = [groupId];

        if (since) {
            query += ' AND gm.created_at > $2';
            params.push(since);
        }

        query += ' ORDER BY gm.created_at ASC LIMIT 100';

        const result = await pool.query(query, params);

        res.json({ messages: result.rows });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send message
router.post('/',
    body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Message required (max 1000 chars)'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { groupId } = req.params;
        const userId = req.user.userId;
        const { message } = req.body;

        try {
            // Check if user is member
            const memberCheck = await pool.query(
                'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }

            const result = await pool.query(
                `INSERT INTO group_messages (group_id, user_id, message)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [groupId, userId, message]
            );

            // Get user info for response
            const messageWithUser = await pool.query(
                `SELECT gm.*, u.username, u.full_name, u.avatar
                 FROM group_messages gm
                 INNER JOIN users u ON gm.user_id = u.id
                 WHERE gm.id = $1`,
                [result.rows[0].id]
            );

            res.status(201).json({ message: messageWithUser.rows[0] });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
);

// Delete message (own messages only or admin)
router.delete('/:messageId', async (req, res) => {
    const { groupId, messageId } = req.params;
    const userId = req.user.userId;

    try {
        // Check if user is message sender or admin
        const messageCheck = await pool.query(
            'SELECT user_id FROM group_messages WHERE id = $1 AND group_id = $2',
            [messageId, groupId]
        );

        if (messageCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const isOwner = messageCheck.rows[0].user_id === userId;

        if (!isOwner) {
            const adminCheck = await pool.query(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );

            if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Only message owner or admin can delete' });
            }
        }

        await pool.query('DELETE FROM group_messages WHERE id = $1', [messageId]);

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

export default router;

import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticateToken);

// Get group members
router.get('/', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.userId;

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
            `SELECT gm.*, u.username, u.full_name, u.email, u.avatar
             FROM group_members gm
             INNER JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = $1
             ORDER BY gm.role DESC, gm.joined_at ASC`,
            [groupId]
        );

        res.json({ members: result.rows });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// Add member to group
router.post('/',
    body('username').trim().notEmpty().withMessage('Username required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { groupId } = req.params;
        const userId = req.user.userId;
        const { username } = req.body;

        try {
            // Check if current user is admin
            const adminCheck = await pool.query(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );

            if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can add members' });
            }

            // Find user by username
            const userResult = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const newUserId = userResult.rows[0].id;

            // Add member
            await pool.query(
                'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
                [groupId, newUserId]
            );

            res.status(201).json({ message: 'Member added successfully' });
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'User already in group' });
            }
            console.error('Add member error:', error);
            res.status(500).json({ error: 'Failed to add member' });
        }
    }
);

// Remove member from group
router.delete('/:memberId', async (req, res) => {
    const { groupId, memberId } = req.params;
    const userId = req.user.userId;

    try {
        // Check if current user is admin
        const adminCheck = await pool.query(
            'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );

        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can remove members' });
        }

        // Don't allow removing the last admin
        const adminCount = await pool.query(
            'SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND role = $2',
            [groupId, 'admin']
        );

        const memberToRemove = await pool.query(
            'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, memberId]
        );

        if (memberToRemove.rows[0]?.role === 'admin' && parseInt(adminCount.rows[0].count) === 1) {
            return res.status(400).json({ error: 'Cannot remove the last admin' });
        }

        await pool.query(
            'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, memberId]
        );

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

export default router;

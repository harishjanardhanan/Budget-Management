import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all groups for current user
router.get('/', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `SELECT g.*, 
                    COUNT(DISTINCT gm.user_id) as member_count,
                    COALESCE(SUM(CASE WHEN d.debtor_id = $1 THEN d.amount ELSE 0 END), 0) as you_owe,
                    COALESCE(SUM(CASE WHEN d.creditor_id = $1 THEN d.amount ELSE 0 END), 0) as owed_to_you
             FROM groups g
             INNER JOIN group_members gm ON g.id = gm.group_id
             LEFT JOIN debts d ON g.id = d.group_id
             WHERE gm.user_id = $1
             GROUP BY g.id
             ORDER BY g.updated_at DESC`,
            [userId]
        );

        res.json({ groups: result.rows });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// Create new group
router.post('/',
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name required'),
    body('description').optional().trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const userId = req.user.userId;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create group
            const groupResult = await client.query(
                'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
                [name, description || null, userId]
            );

            const group = groupResult.rows[0];

            // Add creator as admin member
            await client.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
                [group.id, userId, 'admin']
            );

            await client.query('COMMIT');

            res.status(201).json({ message: 'Group created successfully', group });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create group error:', error);
            res.status(500).json({ error: 'Failed to create group' });
        } finally {
            client.release();
        }
    }
);

// Get group details
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        // Check if user is member
        const memberCheck = await pool.query(
            'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }

        // Get group details
        const groupResult = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const group = groupResult.rows[0];
        group.userRole = memberCheck.rows[0].role;

        res.json({ group });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

// Update group
router.put('/:id',
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userId = req.user.userId;
        const { name, description } = req.body;

        try {
            // Check if user is admin
            const memberCheck = await pool.query(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [id, userId]
            );

            if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can update group' });
            }

            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramIndex}`);
                values.push(name);
                paramIndex++;
            }

            if (description !== undefined) {
                updates.push(`description = $${paramIndex}`);
                values.push(description);
                paramIndex++;
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);

            const query = `UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
            const result = await pool.query(query, values);

            res.json({ message: 'Group updated successfully', group: result.rows[0] });
        } catch (error) {
            console.error('Update group error:', error);
            res.status(500).json({ error: 'Failed to update group' });
        }
    }
);

// Delete group
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        // Check if user is admin
        const memberCheck = await pool.query(
            'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete group' });
        }

        await pool.query('DELETE FROM groups WHERE id = $1', [id]);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

export default router;

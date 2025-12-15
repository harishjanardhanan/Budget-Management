import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all categories (public endpoint, no auth required)
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.userId; // Optional auth
        let query, params;

        if (userId) {
            // Show default categories + user's team categories
            query = `SELECT c.*, u.username as created_by_username
               FROM categories c
               LEFT JOIN users u ON c.created_by = u.id
               LEFT JOIN users current_user ON current_user.id = $1
               WHERE c.is_default = true OR c.team_id = current_user.team_id
               ORDER BY c.is_default DESC, c.name ASC`;
            params = [userId];
        } else {
            // Show only default categories if not authenticated
            query = `SELECT c.*, u.username as created_by_username
               FROM categories c
               LEFT JOIN users u ON c.created_by = u.id
               WHERE c.is_default = true
               ORDER BY c.name ASC`;
            params = [];
        }

        const result = await pool.query(query, params);

        res.json({
            categories: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create custom category (requires authentication)
router.post('/',
    authenticateToken,
    body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Name must be 1-50 characters'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex code'),
    body('icon').optional().trim().isLength({ max: 50 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, color, icon } = req.body;
        const userId = req.user.userId;

        try {
            // Check if category already exists
            const existing = await pool.query(
                'SELECT id FROM categories WHERE name = $1',
                [name]
            );

            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Category already exists' });
            }

            // Get user's team_id
            const userTeam = await pool.query('SELECT team_id FROM users WHERE id = $1', [userId]);
            const teamId = userTeam.rows[0]?.team_id;

            const result = await pool.query(
                `INSERT INTO categories (name, color, icon, created_by, is_default, team_id)
         VALUES ($1, $2, $3, $4, false, $5)
         RETURNING *`,
                [name, color || '#6366f1', icon || '📌', userId, teamId]
            );

            res.status(201).json({
                message: 'Category created successfully',
                category: result.rows[0]
            });
        } catch (error) {
            console.error('Create category error:', error);
            res.status(500).json({ error: 'Failed to create category' });
        }
    }
);

// Update category (requires authentication)
router.put('/:id',
    authenticateToken,
    body('name').optional().trim().isLength({ min: 1, max: 50 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('icon').optional().trim().isLength({ max: 50 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userId = req.user.userId;
        const updates = req.body;

        try {
            // Check if category exists and user created it (can't update default categories)
            const checkResult = await pool.query(
                'SELECT created_by, is_default FROM categories WHERE id = $1',
                [id]
            );

            if (checkResult.rows.length === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            if (checkResult.rows[0].is_default) {
                return res.status(403).json({ error: 'Cannot modify default categories' });
            }

            if (checkResult.rows[0].created_by !== userId) {
                return res.status(403).json({ error: 'Not authorized to update this category' });
            }

            // Build update query
            const fields = [];
            const values = [];
            let paramIndex = 1;

            if (updates.name) {
                fields.push(`name = $${paramIndex}`);
                values.push(updates.name);
                paramIndex++;
            }

            if (updates.color) {
                fields.push(`color = $${paramIndex}`);
                values.push(updates.color);
                paramIndex++;
            }

            if (updates.icon) {
                fields.push(`icon = $${paramIndex}`);
                values.push(updates.icon);
                paramIndex++;
            }

            if (fields.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(id);
            const query = `UPDATE categories SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query(query, values);

            res.json({
                message: 'Category updated successfully',
                category: result.rows[0]
            });
        } catch (error) {
            console.error('Update category error:', error);
            res.status(500).json({ error: 'Failed to update category' });
        }
    }
);

// Delete category (requires authentication)
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        // Check if category exists and user created it
        const checkResult = await pool.query(
            'SELECT created_by, is_default FROM categories WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (checkResult.rows[0].is_default) {
            return res.status(403).json({ error: 'Cannot delete default categories' });
        }

        if (checkResult.rows[0].created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this category' });
        }

        // Check if category is in use
        const usageResult = await pool.query(
            'SELECT COUNT(*) as count FROM transactions WHERE category_id = $1',
            [id]
        );

        if (parseInt(usageResult.rows[0].count) > 0) {
            return res.status(409).json({
                error: 'Cannot delete category that is in use by transactions',
                transactionCount: parseInt(usageResult.rows[0].count)
            });
        }

        await pool.query('DELETE FROM categories WHERE id = $1', [id]);

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;

import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all recurring transactions
router.get('/', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM recurring_transactions r
       LEFT JOIN categories c ON r.category_id = c.id
       JOIN users u ON u.id = $1
       WHERE r.team_id = u.team_id
       ORDER BY r.next_occurrence ASC`,
            [userId]
        );

        res.json({
            recurringTransactions: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Get recurring transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch recurring transactions' });
    }
});

// Create recurring transaction
router.post('/',
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('categoryId').optional().isInt(),
    body('description').optional().trim(),
    body('frequency').isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid frequency'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('isPrivate').optional().isBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { type, amount, categoryId, description, frequency, startDate, isPrivate } = req.body;
        const userId = req.user.userId;

        try {
            // Calculate next occurrence based on frequency
            const start = new Date(startDate);
            let nextOccurrence = new Date(start);

            // Get user's team_id
            const userTeam = await pool.query('SELECT team_id FROM users WHERE id = $1', [userId]);
            const teamId = userTeam.rows[0]?.team_id;

            const result = await pool.query(
                `INSERT INTO recurring_transactions 
         (user_id, type, amount, category_id, description, frequency, start_date, next_occurrence, is_private, team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
                [userId, type, amount, categoryId || null, description || null, frequency, startDate, nextOccurrence, isPrivate || false, teamId]
            );

            res.status(201).json({
                message: 'Recurring transaction created successfully',
                recurringTransaction: result.rows[0]
            });
        } catch (error) {
            console.error('Create recurring transaction error:', error);
            res.status(500).json({ error: 'Failed to create recurring transaction' });
        }
    }
);

// Process due recurring transactions (create actual transactions)
router.post('/process', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Find all active recurring transactions that are due
        const dueRecurring = await pool.query(
            `SELECT * FROM recurring_transactions
       WHERE is_active = true AND next_occurrence <= $1`,
            [today]
        );

        const processed = [];

        for (const recurring of dueRecurring.rows) {
            // Create the actual transaction
            await pool.query(
                `INSERT INTO transactions (user_id, type, amount, category_id, description, transaction_date, is_private)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    recurring.user_id,
                    recurring.type,
                    recurring.amount,
                    recurring.category_id,
                    recurring.description,
                    recurring.next_occurrence,
                    recurring.is_private
                ]
            );

            // Calculate next occurrence
            const current = new Date(recurring.next_occurrence);
            let next = new Date(current);

            switch (recurring.frequency) {
                case 'daily':
                    next.setDate(next.getDate() + 1);
                    break;
                case 'weekly':
                    next.setDate(next.getDate() + 7);
                    break;
                case 'monthly':
                    next.setMonth(next.getMonth() + 1);
                    break;
                case 'yearly':
                    next.setFullYear(next.getFullYear() + 1);
                    break;
            }

            // Update next occurrence
            await pool.query(
                `UPDATE recurring_transactions 
         SET next_occurrence = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
                [next.toISOString().split('T')[0], recurring.id]
            );

            processed.push(recurring.id);
        }

        res.json({
            message: `Processed ${processed.length} recurring transactions`,
            processedIds: processed
        });
    } catch (error) {
        console.error('Process recurring transactions error:', error);
        res.status(500).json({ error: 'Failed to process recurring transactions' });
    }
});

// Update recurring transaction
router.put('/:id',
    body('amount').optional().isFloat({ min: 0.01 }),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
    body('isPrivate').optional().isBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const userId = req.user.userId;
        const updates = req.body;

        try {
            // Check ownership
            const checkResult = await pool.query(
                'SELECT user_id FROM recurring_transactions WHERE id = $1',
                [id]
            );

            if (checkResult.rows.length === 0) {
                return res.status(404).json({ error: 'Recurring transaction not found' });
            }

            if (checkResult.rows[0].user_id !== userId) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            // Build update query
            const fields = [];
            const values = [];
            let paramIndex = 1;

            if (updates.amount !== undefined) {
                fields.push(`amount = $${paramIndex}`);
                values.push(updates.amount);
                paramIndex++;
            }

            if (updates.description !== undefined) {
                fields.push(`description = $${paramIndex}`);
                values.push(updates.description);
                paramIndex++;
            }

            if (updates.isActive !== undefined) {
                fields.push(`is_active = $${paramIndex}`);
                values.push(updates.isActive);
                paramIndex++;
            }

            if (updates.isPrivate !== undefined) {
                fields.push(`is_private = $${paramIndex}`);
                values.push(updates.isPrivate);
                paramIndex++;
            }

            fields.push(`updated_at = CURRENT_TIMESTAMP`);

            if (fields.length === 1) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(id);
            const query = `UPDATE recurring_transactions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query(query, values);

            res.json({
                message: 'Recurring transaction updated successfully',
                recurringTransaction: result.rows[0]
            });
        } catch (error) {
            console.error('Update recurring transaction error:', error);
            res.status(500).json({ error: 'Failed to update recurring transaction' });
        }
    }
);

// Delete recurring transaction
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const checkResult = await pool.query(
            'SELECT user_id FROM recurring_transactions WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recurring transaction not found' });
        }

        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await pool.query('DELETE FROM recurring_transactions WHERE id = $1', [id]);

        res.json({ message: 'Recurring transaction deleted successfully' });
    } catch (error) {
        console.error('Delete recurring transaction error:', error);
        res.status(500).json({ error: 'Failed to delete recurring transaction' });
    }
});

export default router;

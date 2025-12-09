import express from 'express';
import { body, query, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all budgets with spending comparison
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       ORDER BY c.name ASC`
        );

        // Get current spending for each budget
        const budgetsWithSpending = await Promise.all(
            result.rows.map(async (budget) => {
                let dateFilter = '';
                const now = new Date();

                if (budget.period === 'weekly') {
                    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                    dateFilter = `AND transaction_date >= '${weekStart.toISOString().split('T')[0]}'`;
                } else if (budget.period === 'monthly') {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateFilter = `AND transaction_date >= '${monthStart.toISOString().split('T')[0]}'`;
                } else if (budget.period === 'yearly') {
                    const yearStart = new Date(now.getFullYear(), 0, 1);
                    dateFilter = `AND transaction_date >= '${yearStart.toISOString().split('T')[0]}'`;
                }

                const spendingResult = await pool.query(
                    `SELECT COALESCE(SUM(amount), 0) as spent
           FROM transactions
           WHERE category_id = $1 AND type = 'expense' ${dateFilter}`,
                    [budget.category_id]
                );

                const spent = parseFloat(spendingResult.rows[0].spent);
                const budgetAmount = parseFloat(budget.amount);
                const remaining = budgetAmount - spent;
                const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

                return {
                    ...budget,
                    spent,
                    remaining,
                    percentage: Math.round(percentage * 10) / 10,
                    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
                };
            })
        );

        res.json({
            budgets: budgetsWithSpending,
            count: budgetsWithSpending.length
        });
    } catch (error) {
        console.error('Get budgets error:', error);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

// Create or update budget
router.post('/',
    body('categoryId').isInt().withMessage('Category ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('period').isIn(['weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { categoryId, amount, period } = req.body;
        const userId = req.user.userId;

        try {
            // Check if budget already exists for this category and period
            const existing = await pool.query(
                'SELECT id FROM budgets WHERE category_id = $1 AND period = $2',
                [categoryId, period]
            );

            let result;
            if (existing.rows.length > 0) {
                // Update existing budget
                result = await pool.query(
                    `UPDATE budgets 
           SET amount = $1, updated_at = CURRENT_TIMESTAMP
           WHERE category_id = $2 AND period = $3
           RETURNING *`,
                    [amount, categoryId, period]
                );
            } else {
                // Create new budget
                result = await pool.query(
                    `INSERT INTO budgets (category_id, amount, period, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
                    [categoryId, amount, period, userId]
                );
            }

            res.status(existing.rows.length > 0 ? 200 : 201).json({
                message: existing.rows.length > 0 ? 'Budget updated successfully' : 'Budget created successfully',
                budget: result.rows[0]
            });
        } catch (error) {
            console.error('Create/update budget error:', error);
            res.status(500).json({ error: 'Failed to save budget' });
        }
    }
);

// Delete budget
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM budgets WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        console.error('Delete budget error:', error);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

export default router;

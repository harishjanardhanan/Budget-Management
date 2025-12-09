import express from 'express';
import { query, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get monthly summary report
router.get('/monthly',
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.userId;
        const year = req.query.year || new Date().getFullYear();
        const month = req.query.month || new Date().getMonth() + 1;

        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            // Get income and expense totals
            const totalsResult = await pool.query(
                `SELECT 
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
           COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
           COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
         FROM transactions
         WHERE (is_private = false OR user_id = $1)
           AND transaction_date >= $2 AND transaction_date <= $3`,
                [userId, startDate, endDate]
            );

            // Get category breakdown
            const categoryResult = await pool.query(
                `SELECT c.id, c.name, c.color, c.icon, t.type,
                SUM(t.amount) as total,
                COUNT(t.id) as count
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE (t.is_private = false OR t.user_id = $1)
           AND t.transaction_date >= $2 AND t.transaction_date <= $3
         GROUP BY c.id, c.name, c.color, c.icon, t.type
         ORDER BY total DESC`,
                [userId, startDate, endDate]
            );

            // Get daily trend
            const dailyResult = await pool.query(
                `SELECT transaction_date,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
         FROM transactions
         WHERE (is_private = false OR user_id = $1)
           AND transaction_date >= $2 AND transaction_date <= $3
         GROUP BY transaction_date
         ORDER BY transaction_date ASC`,
                [userId, startDate, endDate]
            );

            const totals = totalsResult.rows[0];
            const balance = parseFloat(totals.total_income || 0) - parseFloat(totals.total_expense || 0);

            res.json({
                period: { year: parseInt(year), month: parseInt(month) },
                summary: {
                    totalIncome: parseFloat(totals.total_income || 0),
                    totalExpense: parseFloat(totals.total_expense || 0),
                    balance: balance,
                    incomeCount: parseInt(totals.income_count || 0),
                    expenseCount: parseInt(totals.expense_count || 0)
                },
                categoryBreakdown: categoryResult.rows,
                dailyTrend: dailyResult.rows
            });
        } catch (error) {
            console.error('Monthly report error:', error);
            res.status(500).json({ error: 'Failed to generate monthly report' });
        }
    }
);

// Get yearly summary report
router.get('/yearly',
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    async (req, res) => {
        const userId = req.user.userId;
        const year = req.query.year || new Date().getFullYear();

        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            // Get monthly breakdown
            const monthlyResult = await pool.query(
                `SELECT 
           EXTRACT(MONTH FROM transaction_date) as month,
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
         FROM transactions
         WHERE (is_private = false OR user_id = $1)
           AND transaction_date >= $2 AND transaction_date <= $3
         GROUP BY EXTRACT(MONTH FROM transaction_date)
         ORDER BY month ASC`,
                [userId, startDate, endDate]
            );

            // Get category totals
            const categoryResult = await pool.query(
                `SELECT c.id, c.name, c.color, c.icon, t.type,
                SUM(t.amount) as total
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE (t.is_private = false OR t.user_id = $1)
           AND t.transaction_date >= $2 AND t.transaction_date <= $3
         GROUP BY c.id, c.name, c.color, c.icon, t.type
         ORDER BY total DESC`,
                [userId, startDate, endDate]
            );

            res.json({
                year: parseInt(year),
                monthlyBreakdown: monthlyResult.rows,
                categoryBreakdown: categoryResult.rows
            });
        } catch (error) {
            console.error('Yearly report error:', error);
            res.status(500).json({ error: 'Failed to generate yearly report' });
        }
    }
);

// Export transactions as CSV
router.get('/export',
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    async (req, res) => {
        const userId = req.user.userId;
        const { startDate, endDate } = req.query;

        try {
            let query = `
        SELECT t.id, t.type, t.amount, t.description, t.transaction_date,
               t.is_private, t.created_at,
               c.name as category, u.username
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE (t.is_private = false OR t.user_id = $1)
      `;
            const params = [userId];
            let paramIndex = 2;

            if (startDate) {
                query += ` AND t.transaction_date >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }

            if (endDate) {
                query += ` AND t.transaction_date <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }

            query += ' ORDER BY t.transaction_date DESC, t.created_at DESC';

            const result = await pool.query(query, params);

            // Generate CSV
            const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'User', 'Private', 'Created At'];
            const rows = result.rows.map(row => [
                row.id,
                row.transaction_date,
                row.type,
                row.category || 'Uncategorized',
                row.amount,
                row.description || '',
                row.username,
                row.is_private ? 'Yes' : 'No',
                row.created_at
            ]);

            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=transactions-${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csv);
        } catch (error) {
            console.error('Export error:', error);
            res.status(500).json({ error: 'Failed to export data' });
        }
    }
);

export default router;

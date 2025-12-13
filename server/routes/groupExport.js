import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticateToken);

// Export group expenses to CSV
router.get('/export', async (req, res) => {
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

        // Get group info
        const groupResult = await pool.query('SELECT name FROM groups WHERE id = $1', [groupId]);
        const groupName = groupResult.rows[0]?.name || 'Group';

        // Get expenses with splits
        const result = await pool.query(
            `SELECT ge.*, u.username as paid_by_name,
                    c.name as category_name,
                    json_agg(json_build_object(
                        'username', u2.username,
                        'amount', es.amount,
                        'settled', es.settled
                    )) as splits
             FROM group_expenses ge
             LEFT JOIN users u ON ge.paid_by = u.id
             LEFT JOIN categories c ON ge.category_id = c.id
             LEFT JOIN expense_splits es ON ge.id = es.expense_id
             LEFT JOIN users u2 ON es.user_id = u2.id
             WHERE ge.group_id = $1
             GROUP BY ge.id, u.username, c.name
             ORDER BY ge.expense_date DESC, ge.created_at DESC`,
            [groupId]
        );

        // Generate CSV
        let csv = 'Date,Description,Amount,Category,Paid By,Split Details\n';

        result.rows.forEach(expense => {
            const date = new Date(expense.expense_date).toLocaleDateString();
            const description = `"${expense.description.replace(/"/g, '""')}"`;
            const amount = expense.amount;
            const category = expense.category_name || 'Uncategorized';
            const paidBy = expense.paid_by_name;

            const splitDetails = expense.splits
                .map(s => `${s.username}: ₹${s.amount}${s.settled ? ' (settled)' : ''}`)
                .join('; ');

            csv += `${date},${description},₹${amount},${category},${paidBy},"${splitDetails}"\n`;
        });

        // Set headers for download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${groupName}-expenses-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export expenses' });
    }
});

export default router;

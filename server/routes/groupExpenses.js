import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticateToken);

// Get group expenses
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
            `SELECT ge.*, u.username as paid_by_name, u.full_name as paid_by_full_name,
                    c.name as category_name, c.icon as category_icon,
                    json_agg(json_build_object(
                        'user_id', es.user_id,
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
             GROUP BY ge.id, u.username, u.full_name, c.name, c.icon
             ORDER BY ge.expense_date DESC, ge.created_at DESC`,
            [groupId]
        );

        res.json({ expenses: result.rows });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Create group expense with splits
router.post('/',
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').trim().notEmpty().withMessage('Description required'),
    body('splits').isArray({ min: 1 }).withMessage('At least one split required'),
    body('splits.*.userId').isInt().withMessage('Valid user ID required'),
    body('splits.*.amount').isFloat({ min: 0 }).withMessage('Valid split amount required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { groupId } = req.params;
        const userId = req.user.userId;
        const { amount, description, categoryId, expenseDate, splits } = req.body;

        const client = await pool.connect();
        try {
            // Check if user is member
            const memberCheck = await client.query(
                'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }

            // Validate splits sum to total amount
            const totalSplit = splits.reduce((sum, split) => sum + parseFloat(split.amount), 0);
            if (Math.abs(totalSplit - parseFloat(amount)) > 0.01) {
                return res.status(400).json({ error: 'Splits must sum to total amount' });
            }

            // Validate all split users are group members
            const userIds = splits.map(s => s.userId);
            const membersCheck = await client.query(
                'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2)',
                [groupId, userIds]
            );

            if (membersCheck.rows.length !== userIds.length) {
                return res.status(400).json({ error: 'All split users must be group members' });
            }

            await client.query('BEGIN');

            // Create expense
            const expenseResult = await client.query(
                `INSERT INTO group_expenses (group_id, paid_by, amount, description, category_id, expense_date)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [groupId, userId, amount, description, categoryId || null, expenseDate || new Date()]
            );

            const expense = expenseResult.rows[0];

            // Create splits
            for (const split of splits) {
                await client.query(
                    'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
                    [expense.id, split.userId, split.amount]
                );
            }

            // Update debts
            await updateDebts(client, groupId, userId, splits);

            await client.query('COMMIT');

            res.status(201).json({ message: 'Expense created successfully', expense });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create expense error:', error);
            res.status(500).json({ error: 'Failed to create expense' });
        } finally {
            client.release();
        }
    }
);

// Helper function to update debts
async function updateDebts(client, groupId, paidBy, splits) {
    for (const split of splits) {
        if (split.userId === paidBy) continue; // Skip if user paid for themselves

        const amount = parseFloat(split.amount);

        // Check if debt already exists
        const existingDebt = await client.query(
            'SELECT * FROM debts WHERE group_id = $1 AND debtor_id = $2 AND creditor_id = $3',
            [groupId, split.userId, paidBy]
        );

        if (existingDebt.rows.length > 0) {
            // Update existing debt
            await client.query(
                'UPDATE debts SET amount = amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [amount, existingDebt.rows[0].id]
            );
        } else {
            // Check for reverse debt (creditor owes debtor)
            const reverseDebt = await client.query(
                'SELECT * FROM debts WHERE group_id = $1 AND debtor_id = $2 AND creditor_id = $3',
                [groupId, paidBy, split.userId]
            );

            if (reverseDebt.rows.length > 0) {
                const currentAmount = parseFloat(reverseDebt.rows[0].amount);
                if (currentAmount > amount) {
                    // Reduce reverse debt
                    await client.query(
                        'UPDATE debts SET amount = amount - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [amount, reverseDebt.rows[0].id]
                    );
                } else {
                    // Reverse debt is less, flip it
                    await client.query('DELETE FROM debts WHERE id = $1', [reverseDebt.rows[0].id]);
                    if (amount > currentAmount) {
                        await client.query(
                            'INSERT INTO debts (group_id, debtor_id, creditor_id, amount) VALUES ($1, $2, $3, $4)',
                            [groupId, split.userId, paidBy, amount - currentAmount]
                        );
                    }
                }
            } else {
                // Create new debt
                await client.query(
                    'INSERT INTO debts (group_id, debtor_id, creditor_id, amount) VALUES ($1, $2, $3, $4)',
                    [groupId, split.userId, paidBy, amount]
                );
            }
        }
    }
}

// Delete expense
router.delete('/:expenseId', async (req, res) => {
    const { groupId, expenseId } = req.params;
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
        // Check if user is expense creator or admin
        const expenseCheck = await client.query(
            'SELECT paid_by FROM group_expenses WHERE id = $1 AND group_id = $2',
            [expenseId, groupId]
        );

        if (expenseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const isCreator = expenseCheck.rows[0].paid_by === userId;

        if (!isCreator) {
            const adminCheck = await client.query(
                'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );

            if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
                return res.status(403).json({ error: 'Only expense creator or admin can delete' });
            }
        }

        await client.query('BEGIN');

        // Get splits to reverse debts
        const splits = await client.query(
            'SELECT user_id, amount FROM expense_splits WHERE expense_id = $1',
            [expenseId]
        );

        const paidBy = expenseCheck.rows[0].paid_by;

        // Reverse debts
        for (const split of splits.rows) {
            if (split.user_id === paidBy) continue;

            const amount = parseFloat(split.amount);

            const debt = await client.query(
                'SELECT * FROM debts WHERE group_id = $1 AND debtor_id = $2 AND creditor_id = $3',
                [groupId, split.user_id, paidBy]
            );

            if (debt.rows.length > 0) {
                const newAmount = parseFloat(debt.rows[0].amount) - amount;
                if (newAmount <= 0.01) {
                    await client.query('DELETE FROM debts WHERE id = $1', [debt.rows[0].id]);
                } else {
                    await client.query(
                        'UPDATE debts SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [newAmount, debt.rows[0].id]
                    );
                }
            }
        }

        // Delete expense (splits will cascade)
        await client.query('DELETE FROM group_expenses WHERE id = $1', [expenseId]);

        await client.query('COMMIT');

        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete expense error:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    } finally {
        client.release();
    }
});

export default router;

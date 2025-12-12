import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticateToken);

// Get debts for a group
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
            `SELECT d.*, 
                    u1.username as debtor_name, u1.full_name as debtor_full_name, u1.avatar as debtor_avatar,
                    u2.username as creditor_name, u2.full_name as creditor_full_name, u2.avatar as creditor_avatar
             FROM debts d
             INNER JOIN users u1 ON d.debtor_id = u1.id
             INNER JOIN users u2 ON d.creditor_id = u2.id
             WHERE d.group_id = $1 AND d.amount > 0.01
             ORDER BY d.amount DESC`,
            [groupId]
        );

        res.json({ debts: result.rows });
    } catch (error) {
        console.error('Get debts error:', error);
        res.status(500).json({ error: 'Failed to fetch debts' });
    }
});

// Get user's debt summary across all groups
router.get('/summary', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await pool.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN d.debtor_id = $1 THEN d.amount ELSE 0 END), 0) as total_you_owe,
                COALESCE(SUM(CASE WHEN d.creditor_id = $1 THEN d.amount ELSE 0 END), 0) as total_owed_to_you,
                json_agg(DISTINCT jsonb_build_object(
                    'group_id', g.id,
                    'group_name', g.name,
                    'you_owe', (SELECT COALESCE(SUM(amount), 0) FROM debts WHERE group_id = g.id AND debtor_id = $1),
                    'owed_to_you', (SELECT COALESCE(SUM(amount), 0) FROM debts WHERE group_id = g.id AND creditor_id = $1)
                )) FILTER (WHERE g.id IS NOT NULL) as groups
             FROM debts d
             INNER JOIN groups g ON d.group_id = g.id
             WHERE d.debtor_id = $1 OR d.creditor_id = $1`,
            [userId]
        );

        res.json(result.rows[0] || { total_you_owe: 0, total_owed_to_you: 0, groups: [] });
    } catch (error) {
        console.error('Get debt summary error:', error);
        res.status(500).json({ error: 'Failed to fetch debt summary' });
    }
});

// Settle debt
router.post('/settle', async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { creditorId, amount } = req.body;

    if (!creditorId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid creditor and amount required' });
    }

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

        await client.query('BEGIN');

        // Get current debt
        const debtResult = await client.query(
            'SELECT * FROM debts WHERE group_id = $1 AND debtor_id = $2 AND creditor_id = $3',
            [groupId, userId, creditorId]
        );

        if (debtResult.rows.length === 0) {
            return res.status(404).json({ error: 'Debt not found' });
        }

        const currentDebt = parseFloat(debtResult.rows[0].amount);
        const settleAmount = parseFloat(amount);

        if (settleAmount > currentDebt) {
            return res.status(400).json({ error: 'Settlement amount exceeds debt' });
        }

        const newDebt = currentDebt - settleAmount;

        if (newDebt < 0.01) {
            // Debt fully settled, delete it
            await client.query(
                'DELETE FROM debts WHERE id = $1',
                [debtResult.rows[0].id]
            );
        } else {
            // Partially settled, update amount
            await client.query(
                'UPDATE debts SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newDebt, debtResult.rows[0].id]
            );
        }

        await client.query('COMMIT');

        res.json({ message: 'Debt settled successfully', remaining: newDebt });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Settle debt error:', error);
        res.status(500).json({ error: 'Failed to settle debt' });
    } finally {
        client.release();
    }
});

export default router;

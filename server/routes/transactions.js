import express from 'express';
import { body, query, validationResult } from 'express-validator';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create transaction
router.post('/',
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('categoryId').optional().isInt(),
  body('description').optional().trim(),
  body('transactionDate').optional().isISO8601(),
  body('isPrivate').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, amount, categoryId, description, transactionDate, isPrivate } = req.body;
    const userId = req.user.userId;

    try {
      // Get user's team_id
      const userTeam = await pool.query('SELECT team_id FROM users WHERE id = $1', [userId]);
      const teamId = userTeam.rows[0]?.team_id;

      const result = await pool.query(
        `INSERT INTO transactions (user_id, type, amount, category_id, description, transaction_date, is_private, team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, user_id, type, amount, category_id, description, transaction_date, is_private, created_at`,
        [userId, type, amount, categoryId || null, description || null, transactionDate || new Date(), isPrivate || false, teamId]
      );

      res.status(201).json({
        message: 'Transaction created successfully',
        transaction: result.rows[0]
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
);

// Get all transactions with filtering
router.get('/',
  query('type').optional().isIn(['income', 'expense']),
  query('categoryId').optional().isInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('includePrivate').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, categoryId, startDate, endDate, includePrivate } = req.query;
    const userId = req.user.userId;

    try {
      let query = `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
               u.username, u.full_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.user_id = u.id
        JOIN users auth_user ON auth_user.id = $1
        WHERE t.team_id = auth_user.team_id
      `;
      const params = [userId];
      let paramIndex = 2;

      // If user explicitly wants to see only their own transactions (including private)
      if (includePrivate === 'true') {
        query = `
          SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                 u.username, u.full_name
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          LEFT JOIN users u ON t.user_id = u.id
          JOIN users auth_user ON auth_user.id = $1
          WHERE t.user_id = $1 AND t.team_id = auth_user.team_id
        `;
      }

      if (type) {
        query += ` AND t.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (categoryId) {
        query += ` AND t.category_id = $${paramIndex}`;
        params.push(categoryId);
        paramIndex++;
      }

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

      res.json({
        transactions: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// Get transaction statistics
router.get('/stats',
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  async (req, res) => {
    const { startDate, endDate } = req.query;
    const userId = req.user.userId;

    try {
      let dateFilter = '';
      const params = [userId];
      let paramIndex = 2;

      if (startDate) {
        dateFilter += ` AND transaction_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        dateFilter += ` AND transaction_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get total income and expenses (respecting privacy)
      const totalsResult = await pool.query(
        `SELECT 
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
         FROM transactions t
         JOIN users u ON u.id = $1
         WHERE t.team_id = u.team_id ${dateFilter}`,
        params
      );

      // Get category breakdown
      const categoryResult = await pool.query(
        `SELECT c.id, c.name, c.color, c.icon, t.type,
                SUM(t.amount) as total,
                COUNT(t.id) as count
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         JOIN users u ON u.id = $1
         WHERE t.team_id = u.team_id ${dateFilter}
         GROUP BY c.id, c.name, c.color, c.icon, t.type
         ORDER BY total DESC`,
        params
      );

      const totals = totalsResult.rows[0];
      const balance = parseFloat(totals.total_income || 0) - parseFloat(totals.total_expense || 0);

      res.json({
        totalIncome: parseFloat(totals.total_income || 0),
        totalExpense: parseFloat(totals.total_expense || 0),
        balance: balance,
        categoryBreakdown: categoryResult.rows
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

// Update transaction
router.put('/:id',
  body('type').optional().isIn(['income', 'expense']),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('categoryId').optional().isInt(),
  body('description').optional().trim(),
  body('transactionDate').optional().isISO8601(),
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
      // Check if transaction exists and user owns it
      const checkResult = await pool.query(
        'SELECT user_id FROM transactions WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (checkResult.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this transaction' });
      }

      // Build update query dynamically
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.type) {
        fields.push(`type = $${paramIndex}`);
        values.push(updates.type);
        paramIndex++;
      }

      if (updates.amount !== undefined) {
        fields.push(`amount = $${paramIndex}`);
        values.push(updates.amount);
        paramIndex++;
      }

      if (updates.categoryId !== undefined) {
        fields.push(`category_id = $${paramIndex}`);
        values.push(updates.categoryId);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.transactionDate) {
        fields.push(`transaction_date = $${paramIndex}`);
        values.push(updates.transactionDate);
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
      const query = `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await pool.query(query, values);

      res.json({
        message: 'Transaction updated successfully',
        transaction: result.rows[0]
      });
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  }
);

// Delete transaction
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    // Check if transaction exists and user owns it
    const checkResult = await pool.query(
      'SELECT user_id FROM transactions WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this transaction' });
    }

    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;

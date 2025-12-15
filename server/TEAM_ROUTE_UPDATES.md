# Team System Route Updates

This document outlines the changes needed to existing routes to support team-based filtering.

## Key Changes

All routes that fetch or modify budgets, transactions, categories, and recurring transactions need to:
1. Filter by the user's `team_id`
2. Set `team_id` when creating new records
3. Verify team membership before allowing modifications

## Auth Routes (`server/routes/auth.js`)

**Update user response to include team info:**

```javascript
// In register, login, and /me endpoints, update the user object:
user: {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    teamId: user.team_id,
    teamRole: user.team_role,
    joinedTeamAt: user.joined_team_at,
    createdAt: user.created_at
}
```

**Update SELECT queries to include team fields:**
```sql
SELECT id, username, email, full_name, team_id, team_role, joined_team_at, created_at
FROM users WHERE ...
```

## Budget Routes (`server/routes/budgets.js`)

**GET /api/budgets** - Filter by team:
```javascript
const result = await pool.query(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    JOIN users u ON u.id = $1
    WHERE b.team_id = u.team_id
    ORDER BY b.created_at DESC
`, [req.user.id]);
```

**POST /api/budgets** - Set team_id:
```javascript
const teamResult = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
const teamId = teamResult.rows[0]?.team_id;

const result = await pool.query(`
    INSERT INTO budgets (category_id, amount, period, created_by, team_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
`, [category_id, amount, period, req.user.id, teamId]);
```

**PUT/DELETE** - Verify team membership:
```javascript
const budget = await pool.query(`
    SELECT b.* FROM budgets b
    JOIN users u ON u.id = $1
    WHERE b.id = $2 AND b.team_id = u.team_id
`, [req.user.id, budgetId]);

if (budget.rows.length === 0) {
    return res.status(404).json({ error: 'Budget not found or access denied' });
}
```

## Transaction Routes (`server/routes/transactions.js`)

**GET /api/transactions** - Filter by team:
```javascript
const result = await pool.query(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    JOIN users u ON u.id = $1
    WHERE t.team_id = u.team_id
    ORDER BY t.transaction_date DESC, t.created_at DESC
    LIMIT $2 OFFSET $3
`, [req.user.id, limit, offset]);
```

**POST /api/transactions** - Set team_id:
```javascript
const teamResult = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
const teamId = teamResult.rows[0]?.team_id;

const result = await pool.query(`
    INSERT INTO transactions (user_id, type, amount, category_id, description, transaction_date, team_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
`, [req.user.id, type, amount, category_id, description, transaction_date, teamId]);
```

## Category Routes (`server/routes/categories.js`)

**GET /api/categories** - Include team categories + defaults:
```javascript
const result = await pool.query(`
    SELECT * FROM categories
    WHERE is_default = true
    OR (team_id = (SELECT team_id FROM users WHERE id = $1))
    ORDER BY is_default DESC, name ASC
`, [req.user.id]);
```

**POST /api/categories** - Set team_id for custom categories:
```javascript
const teamResult = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
const teamId = teamResult.rows[0]?.team_id;

const result = await pool.query(`
    INSERT INTO categories (name, color, icon, created_by, team_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
`, [name, color, icon, req.user.id, teamId]);
```

## Recurring Routes (`server/routes/recurring.js`)

**GET /api/recurring** - Filter by team:
```javascript
const result = await pool.query(`
    SELECT r.*, c.name as category_name, c.color as category_color
    FROM recurring_transactions r
    LEFT JOIN categories c ON r.category_id = c.id
    JOIN users u ON u.id = $1
    WHERE r.team_id = u.team_id AND r.is_active = true
    ORDER BY r.next_occurrence ASC
`, [req.user.id]);
```

**POST /api/recurring** - Set team_id:
```javascript
const teamResult = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
const teamId = teamResult.rows[0]?.team_id;

const result = await pool.query(`
    INSERT INTO recurring_transactions (user_id, type, amount, category_id, description, frequency, start_date, next_occurrence, team_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
`, [req.user.id, type, amount, category_id, description, frequency, start_date, next_occurrence, teamId]);
```

## Reports Routes (`server/routes/reports.js`)

**All report queries** - Filter by team:
```javascript
// Add JOIN with users and filter by team_id
FROM transactions t
JOIN users u ON u.id = $1
WHERE t.team_id = u.team_id
AND t.transaction_date BETWEEN $2 AND $3
```

## Implementation Strategy

1. Update each route file one by one
2. Test each endpoint after update
3. Ensure backward compatibility (handle null team_id gracefully)
4. Deploy incrementally to avoid breaking changes

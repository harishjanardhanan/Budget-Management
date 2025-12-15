-- Teams System Migration (Simplified - One Team Per User)
-- This migration adds team-based access control to the budget management system

BEGIN;

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invited_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- 3. Add team_id and team_role to users table (simplified - no separate team_members table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_role VARCHAR(20) DEFAULT 'member' CHECK (team_role IN ('owner', 'admin', 'member'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_team_at TIMESTAMP;

-- 4. Add team_id to budgets table
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;

-- 5. Add team_id to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

-- 6. Add team_id to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;

-- 7. Add team_id to recurring_transactions table
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user_id ON team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_budgets_team_id ON budgets(team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_team_id ON transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_categories_team_id ON categories(team_id);
CREATE INDEX IF NOT EXISTS idx_recurring_team_id ON recurring_transactions(team_id);

-- 9. Create personal teams for existing users
INSERT INTO teams (name, description, created_by)
SELECT 
    CONCAT(username, '''s Team'),
    'Personal budget and transactions',
    id
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE created_by = users.id
);

-- 10. Assign users to their personal teams as owners
UPDATE users u
SET 
    team_id = (SELECT id FROM teams WHERE created_by = u.id LIMIT 1),
    team_role = 'owner',
    joined_team_at = CURRENT_TIMESTAMP
WHERE team_id IS NULL;

-- 11. Assign existing budgets to user's teams
UPDATE budgets b
SET team_id = (
    SELECT team_id FROM users WHERE id = b.created_by LIMIT 1
)
WHERE team_id IS NULL;

-- 12. Assign existing transactions to user's teams
UPDATE transactions t
SET team_id = (
    SELECT team_id FROM users WHERE id = t.user_id LIMIT 1
)
WHERE team_id IS NULL;

-- 13. Assign custom categories to creator's team
UPDATE categories c
SET team_id = (
    SELECT team_id FROM users WHERE id = c.created_by LIMIT 1
)
WHERE c.is_default = false AND team_id IS NULL;

-- 14. Assign recurring transactions to user's teams
UPDATE recurring_transactions rt
SET team_id = (
    SELECT team_id FROM users WHERE id = rt.user_id LIMIT 1
)
WHERE team_id IS NULL;

COMMIT;

-- Verify migration
SELECT 'Teams created:' as info, COUNT(*) as count FROM teams;
SELECT 'Users with team:' as info, COUNT(*) as count FROM users WHERE team_id IS NOT NULL;
SELECT 'Budgets with team_id:' as info, COUNT(*) as count FROM budgets WHERE team_id IS NOT NULL;
SELECT 'Transactions with team_id:' as info, COUNT(*) as count FROM transactions WHERE team_id IS NOT NULL;

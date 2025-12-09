import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://budget_user:budget_password@localhost:5432/budget_app',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        color VARCHAR(7) DEFAULT '#6366f1',
        icon VARCHAR(50),
        is_default BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name)
      )
    `);

    // Insert default categories
    await client.query(`
      INSERT INTO categories (name, color, icon, is_default) VALUES
        ('Groceries', '#10b981', '🛒', true),
        ('Transportation', '#3b82f6', '🚗', true),
        ('Utilities', '#f59e0b', '💡', true),
        ('Entertainment', '#ec4899', '🎬', true),
        ('Healthcare', '#ef4444', '🏥', true),
        ('Education', '#8b5cf6', '📚', true),
        ('Dining Out', '#f97316', '🍽️', true),
        ('Shopping', '#06b6d4', '🛍️', true),
        ('Salary', '#22c55e', '💰', true),
        ('Investment', '#14b8a6', '📈', true),
        ('Other', '#6b7280', '📌', true)
      ON CONFLICT (name) DO NOTHING
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        is_private BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
      ON transactions(user_id, transaction_date DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_category 
      ON transactions(category_id)
    `);

    // Budgets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        period VARCHAR(20) DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, period)
      )
    `);

    // Recurring transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
        start_date DATE NOT NULL,
        next_occurrence DATE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_private BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;

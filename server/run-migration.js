import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('📦 Running teams system migration...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', 'add_teams_system.sql'),
            'utf8'
        );

        await client.query(migrationSQL);

        console.log('✅ Teams system migration completed successfully!');

        // Show results
        const teamsCount = await client.query('SELECT COUNT(*) FROM teams');
        const usersWithTeam = await client.query('SELECT COUNT(*) FROM users WHERE team_id IS NOT NULL');
        const budgetsWithTeam = await client.query('SELECT COUNT(*) FROM budgets WHERE team_id IS NOT NULL');
        const transactionsWithTeam = await client.query('SELECT COUNT(*) FROM transactions WHERE team_id IS NOT NULL');

        console.log('\n📊 Migration Results:');
        console.log(`   Teams created: ${teamsCount.rows[0].count}`);
        console.log(`   Users with team: ${usersWithTeam.rows[0].count}`);
        console.log(`   Budgets with team_id: ${budgetsWithTeam.rows[0].count}`);
        console.log(`   Transactions with team_id: ${transactionsWithTeam.rows[0].count}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('\n✅ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });

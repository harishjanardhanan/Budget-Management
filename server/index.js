import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import budgetRoutes from './routes/budgets.js';
import recurringRoutes from './routes/recurring.js';
import reportRoutes from './routes/reports.js';
import groupsRoutes from './routes/groups.js';
import groupMembersRoutes from './routes/groupMembers.js';
import groupExpensesRoutes from './routes/groupExpenses.js';
import groupDebtsRoutes from './routes/groupDebts.js';
import groupMessagesRoutes from './routes/groupMessages.js';
import groupExportRoutes from './routes/groupExport.js';
import { initializeWebSocket } from './websocket.js';
import { createServer } from 'http';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for profile photo uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/groups/:groupId/members', groupMembersRoutes);
app.use('/api/groups/:groupId/expenses', groupExpensesRoutes);
app.use('/api/groups/:groupId/debts', groupDebtsRoutes);
app.use('/api/groups/:groupId/messages', groupMessagesRoutes);
app.use('/api/groups/:groupId', groupExportRoutes);

// Serve static files in production (Docker deployment)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('public'));

    // Catch-all route to serve index.html for client-side routing
    app.get('*', (req, res) => {
        res.sendFile('index.html', { root: 'public' });
    });
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize database and start server
async function startServer() {
    try {
        console.log('🔄 Initializing database...');
        await initializeDatabase();

        const httpServer = createServer(app);

        // Initialize WebSocket
        initializeWebSocket(httpServer);
        console.log('✅ WebSocket initialized');

        httpServer.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
            console.log(`💚 Health check: http://localhost:${PORT}/health`);
            console.log(`🔌 WebSocket server running\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, closing server...');
    await pool.end();
    process.exit(0);
});

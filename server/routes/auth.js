import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';

const router = express.Router();

// Register new user
router.post('/register',
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').optional().trim().isLength({ max: 100 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, fullName } = req.body;

        try {
            // Check if user already exists
            const existingUser = await pool.query(
                'SELECT id FROM users WHERE username = $1 OR email = $2',
                [username, email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({ error: 'Username or email already exists' });
            }

            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Insert new user
            const result = await pool.query(
                `INSERT INTO users (username, email, password_hash, full_name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, email, full_name, created_at`,
                [username, email, passwordHash, fullName || null]
            );

            const user = result.rows[0];

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                message: 'User registered successfully',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    createdAt: user.created_at
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Failed to register user' });
        }
    }
);

// Login user
router.post('/login',
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Find user by username or email
            const result = await pool.query(
                'SELECT * FROM users WHERE username = $1 OR email = $1',
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = result.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    phone: user.phone,
                    bio: user.bio,
                    avatar: user.avatar,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Failed to login' });
        }
    }
);

// Update user profile
router.put('/profile',
    body('fullName').optional().trim().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('avatar').optional().trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Get user ID from JWT token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;

            const { fullName, email, phone, bio, avatar } = req.body;

            // Build update query dynamically
            const fields = [];
            const values = [];
            let paramIndex = 1;

            if (fullName !== undefined) {
                fields.push(`full_name = $${paramIndex}`);
                values.push(fullName);
                paramIndex++;
            }

            if (email !== undefined) {
                // Check if email is already taken by another user
                const emailCheck = await pool.query(
                    'SELECT id FROM users WHERE email = $1 AND id != $2',
                    [email, userId]
                );
                if (emailCheck.rows.length > 0) {
                    return res.status(409).json({ error: 'Email already in use' });
                }
                fields.push(`email = $${paramIndex}`);
                values.push(email);
                paramIndex++;
            }

            if (phone !== undefined) {
                fields.push(`phone = $${paramIndex}`);
                values.push(phone);
                paramIndex++;
            }

            if (bio !== undefined) {
                fields.push(`bio = $${paramIndex}`);
                values.push(bio);
                paramIndex++;
            }

            if (avatar !== undefined) {
                fields.push(`avatar = $${paramIndex}`);
                values.push(avatar);
                paramIndex++;
            }

            if (fields.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(userId);

            const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, email, full_name, phone, bio, avatar, created_at, updated_at`;

            const result = await pool.query(query, values);
            const user = result.rows[0];

            res.json({
                message: 'Profile updated successfully',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
                    phone: user.phone,
                    bio: user.bio,
                    avatar: user.avatar,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            });
        } catch (error) {
            console.error('Profile update error:', error);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token' });
            }
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
);

export default router;

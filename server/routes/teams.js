import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Get current user's team
router.get('/my-team', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, 
                   (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count
            FROM teams t
            WHERE t.id = (SELECT team_id FROM users WHERE id = $1)
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.json({ team: null });
        }

        res.json({ team: result.rows[0] });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// Get team members
router.get('/my-team/members', authenticateToken, async (req, res) => {
    try {
        const userTeam = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);

        if (!userTeam.rows[0]?.team_id) {
            return res.json({ members: [] });
        }

        const result = await pool.query(`
            SELECT u.id, u.username, u.email, u.full_name, u.team_role, u.joined_team_at
            FROM users u
            WHERE u.team_id = $1
            ORDER BY 
                CASE u.team_role 
                    WHEN 'owner' THEN 1 
                    WHEN 'admin' THEN 2 
                    ELSE 3 
                END,
                u.joined_team_at
        `, [userTeam.rows[0].team_id]);

        res.json({ members: result.rows });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

// Create team
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if user is already in a team
        const userCheck = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
        if (userCheck.rows[0]?.team_id) {
            return res.status(400).json({ error: 'You are already in a team. Leave your current team first.' });
        }

        // Create team
        const teamResult = await pool.query(`
            INSERT INTO teams (name, description, created_by)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name, description, req.user.id]);

        const team = teamResult.rows[0];

        // Add creator to team as owner
        await pool.query(`
            UPDATE users 
            SET team_id = $1, team_role = 'owner', joined_team_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [team.id, req.user.id]);

        res.status(201).json({ team });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update team
router.put('/my-team', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if user is owner or admin
        const userCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [req.user.id]);

        if (!userCheck.rows[0]?.team_id) {
            return res.status(404).json({ error: 'You are not in a team' });
        }

        if (!['owner', 'admin'].includes(userCheck.rows[0].team_role)) {
            return res.status(403).json({ error: 'Only team owners and admins can update team details' });
        }

        const result = await pool.query(`
            UPDATE teams 
            SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [name, description, userCheck.rows[0].team_id]);

        res.json({ team: result.rows[0] });
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Leave team
router.post('/my-team/leave', authenticateToken, async (req, res) => {
    try {
        const userCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [req.user.id]);

        if (!userCheck.rows[0]?.team_id) {
            return res.status(404).json({ error: 'You are not in a team' });
        }

        if (userCheck.rows[0].team_role === 'owner') {
            return res.status(400).json({ error: 'Team owner cannot leave. Delete the team or transfer ownership first.' });
        }

        // Remove user from team
        await pool.query(`
            UPDATE users 
            SET team_id = NULL, team_role = NULL, joined_team_at = NULL
            WHERE id = $1
        `, [req.user.id]);

        res.json({ message: 'Successfully left the team' });
    } catch (error) {
        console.error('Error leaving team:', error);
        res.status(500).json({ error: 'Failed to leave team' });
    }
});

// Delete team (owner only)
router.delete('/my-team', authenticateToken, async (req, res) => {
    try {
        const userCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [req.user.id]);

        if (!userCheck.rows[0]?.team_id) {
            return res.status(404).json({ error: 'You are not in a team' });
        }

        if (userCheck.rows[0].team_role !== 'owner') {
            return res.status(403).json({ error: 'Only team owner can delete the team' });
        }

        const teamId = userCheck.rows[0].team_id;

        // Remove all users from team
        await pool.query(`
            UPDATE users 
            SET team_id = NULL, team_role = NULL, joined_team_at = NULL
            WHERE team_id = $1
        `, [teamId]);

        // Delete team (cascade will handle team_invitations)
        await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// Invite user to team
router.post('/my-team/invite', authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user is admin or owner
        const userCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [req.user.id]);

        if (!userCheck.rows[0]?.team_id) {
            return res.status(404).json({ error: 'You are not in a team' });
        }

        if (!['owner', 'admin'].includes(userCheck.rows[0].team_role)) {
            return res.status(403).json({ error: 'Only team owners and admins can invite members' });
        }

        const teamId = userCheck.rows[0].team_id;

        // Check if user exists
        const invitedUser = await pool.query('SELECT id, team_id FROM users WHERE email = $1', [email]);

        if (invitedUser.rows.length === 0) {
            return res.status(404).json({ error: 'User with this email not found' });
        }

        if (invitedUser.rows[0].team_id === teamId) {
            return res.status(400).json({ error: 'User is already in your team' });
        }

        if (invitedUser.rows[0].team_id) {
            return res.status(400).json({ error: 'User is already in another team' });
        }

        // Check for existing pending invitation
        const existingInvite = await pool.query(`
            SELECT id FROM team_invitations 
            WHERE team_id = $1 AND invited_email = $2 AND status = 'pending'
        `, [teamId, email]);

        if (existingInvite.rows.length > 0) {
            return res.status(400).json({ error: 'Invitation already sent to this user' });
        }

        // Create invitation
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const result = await pool.query(`
            INSERT INTO team_invitations (team_id, invited_by, invited_email, invited_user_id, token, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [teamId, req.user.id, email, invitedUser.rows[0].id, token, expiresAt]);

        res.status(201).json({ invitation: result.rows[0] });
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: 'Failed to create invitation' });
    }
});

// Get pending invitations for current user
router.get('/invitations/pending', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ti.*, t.name as team_name, u.username as invited_by_username
            FROM team_invitations ti
            JOIN teams t ON ti.team_id = t.id
            JOIN users u ON ti.invited_by = u.id
            WHERE ti.invited_user_id = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
            ORDER BY ti.created_at DESC
        `, [req.user.id]);

        res.json({ invitations: result.rows });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Accept invitation
router.post('/invitations/:id/accept', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Get invitation
        const inviteResult = await pool.query(`
            SELECT * FROM team_invitations 
            WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'
        `, [id, req.user.id]);

        if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or already processed' });
        }

        const invitation = inviteResult.rows[0];

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            await pool.query(`UPDATE team_invitations SET status = 'expired' WHERE id = $1`, [id]);
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        // Check if user is already in a team
        const userCheck = await pool.query('SELECT team_id FROM users WHERE id = $1', [req.user.id]);
        if (userCheck.rows[0]?.team_id) {
            return res.status(400).json({ error: 'You are already in a team. Leave your current team first.' });
        }

        // Add user to team
        await pool.query(`
            UPDATE users 
            SET team_id = $1, team_role = 'member', joined_team_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [invitation.team_id, req.user.id]);

        // Update invitation status
        await pool.query(`
            UPDATE team_invitations 
            SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [id]);

        res.json({ message: 'Successfully joined the team' });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Reject invitation
router.post('/invitations/:id/reject', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE team_invitations 
            SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'
            RETURNING *
        `, [id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or already processed' });
        }

        res.json({ message: 'Invitation rejected' });
    } catch (error) {
        console.error('Error rejecting invitation:', error);
        res.status(500).json({ error: 'Failed to reject invitation' });
    }
});

// Remove member from team (admin/owner only)
router.delete('/my-team/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if requester is admin or owner
        const requesterCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [req.user.id]);

        if (!requesterCheck.rows[0]?.team_id) {
            return res.status(404).json({ error: 'You are not in a team' });
        }

        if (!['owner', 'admin'].includes(requesterCheck.rows[0].team_role)) {
            return res.status(403).json({ error: 'Only team owners and admins can remove members' });
        }

        // Check if target user is in the same team
        const targetCheck = await pool.query('SELECT team_id, team_role FROM users WHERE id = $1', [userId]);

        if (!targetCheck.rows[0] || targetCheck.rows[0].team_id !== requesterCheck.rows[0].team_id) {
            return res.status(404).json({ error: 'User not found in your team' });
        }

        if (targetCheck.rows[0].team_role === 'owner') {
            return res.status(400).json({ error: 'Cannot remove team owner' });
        }

        // Remove user from team
        await pool.query(`
            UPDATE users 
            SET team_id = NULL, team_role = NULL, joined_team_at = NULL
            WHERE id = $1
        `, [userId]);

        res.json({ message: 'Member removed from team' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

export default router;

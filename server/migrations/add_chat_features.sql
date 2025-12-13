-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES group_messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Message read receipts table
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES group_messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- User online status table
CREATE TABLE IF NOT EXISTS user_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to group_messages for replies and edits
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_to INTEGER REFERENCES group_messages(id) ON DELETE SET NULL;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message_id ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to ON group_messages(reply_to);

ALTER TABLE chat_messages ADD COLUMN conversation_id TEXT NOT NULL DEFAULT 'conversation-1';
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_conversation_time ON chat_messages(user_id, conversation_id, created_at);

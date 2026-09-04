CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time ON chat_messages(user_id, created_at);

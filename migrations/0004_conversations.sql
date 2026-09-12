CREATE TABLE IF NOT EXISTS conversations (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_number ON conversations(user_id, number);

INSERT OR IGNORE INTO conversations (id, user_id, number, created_at)
VALUES ('conversation-1', 'local-user', 1, '1970-01-01T00:00:00.000Z');

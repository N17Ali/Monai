CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  kind TEXT NOT NULL DEFAULT 'unknown',
  bank_id TEXT,
  account_id TEXT,
  amount_rial INTEGER NOT NULL,
  balance_after_rial INTEGER,
  occurred_at TEXT NOT NULL,
  source_date_text TEXT,
  date_was_inferred INTEGER NOT NULL DEFAULT 0,
  bank_description TEXT,
  user_note TEXT,
  category_id TEXT,
  original_message TEXT,
  fingerprint TEXT,
  extraction_meta TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions(user_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_fingerprint
  ON transactions(user_id, fingerprint) WHERE fingerprint IS NOT NULL;
